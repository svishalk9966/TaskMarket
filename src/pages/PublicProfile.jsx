import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { normalizeTask, TASKS_COLLECTION_NAME } from '../lib/tasks';
import {
  formatJoinedDate,
  formatReviewDate,
  getProfessionalTitle,
  getProfileInitial,
  normalizeProfileList,
  normalizeRating,
  uniqueProfileStrings,
} from '../lib/publicProfiles';

const ACTIVE_TASK_STATUSES = ['open', 'in_progress', 'submitted', 'revision_requested'];

const renderStars = (rating = 0) => {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  return Array.from({ length: 5 }, (_, index) => (
    <span key={`star-${index}`} className={index < Math.round(safeRating) ? 'text-amber-400' : 'text-base-content/20'}>★</span>
  ));
};

const StatCard = ({ label, value, helper = '' }) => (
  <div className="flex h-full flex-col rounded-[1.5rem] border border-base-300 bg-base-100/90 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/45">{label}</div>
    <div className="mt-3 text-3xl font-bold text-base-content">{value}</div>
    {helper ? <div className="mt-2 text-sm text-base-content/58">{helper}</div> : null}
  </div>
);

const SectionCard = ({ eyebrow, title, description, children }) => (
  <section className="rounded-[1.75rem] border border-base-300 bg-base-100 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.07)] sm:p-6">
    <div className="mb-5">
      {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/80">{eyebrow}</p> : null}
      <h2 className="mt-2 text-xl font-semibold sm:text-2xl">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-base-content/60">{description}</p> : null}
    </div>
    {children}
  </section>
);

const PublicProfile = () => {
  const { userId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const previewProfile = location.state?.publicProfilePreview || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadPublicProfile = async () => {
      if (!userId) {
        setLoading(false);
        setNotFound(true);
        return;
      }

      setLoading(true);
      setError('');
      setNotFound(false);

      try {
        const userRef = doc(db, 'users', userId);
        const postedTasksQuery = query(collection(db, TASKS_COLLECTION_NAME), where('postedById', '==', userId));
        const assignedTasksQuery = query(collection(db, TASKS_COLLECTION_NAME), where('assignedTo', '==', userId));

        const [userSnapshot, postedSnapshot, assignedSnapshot] = await Promise.all([
          getDoc(userRef),
          getDocs(postedTasksQuery),
          getDocs(assignedTasksQuery),
        ]);

        if (!isMounted) return;

        const postedTasks = postedSnapshot.docs.map((docSnapshot) => normalizeTask({ id: docSnapshot.id, ...docSnapshot.data() }));
        const assignedTasks = assignedSnapshot.docs.map((docSnapshot) => normalizeTask({ id: docSnapshot.id, ...docSnapshot.data() }));

        if (!userSnapshot.exists() && !previewProfile.name && postedTasks.length === 0 && assignedTasks.length === 0) {
          setNotFound(true);
          setProfile(null);
          setLoading(false);
          return;
        }

        const userData = userSnapshot.exists() ? userSnapshot.data() : {};
        const explicitSkills = normalizeProfileList(userData.skills);
        const explicitCategories = uniqueProfileStrings([
          ...normalizeProfileList(userData.categories),
          ...normalizeProfileList(userData.workCategories),
        ]);
        const derivedSkills = uniqueProfileStrings([
          ...explicitSkills,
          ...postedTasks.flatMap((task) => task.skills || []),
          ...assignedTasks.flatMap((task) => task.skills || []),
        ]).slice(0, 12);
        const derivedCategories = uniqueProfileStrings([
          ...explicitCategories,
          ...postedTasks.map((task) => task.category),
          ...assignedTasks.map((task) => task.category),
        ]).slice(0, 8);

        const postedCompletedCount = postedTasks.filter((task) => task.status === 'completed').length;
        const assignedCompletedCount = assignedTasks.filter((task) => task.status === 'completed').length;
        const completedProjects = Number(userData.completedTasks) || Number(userData.completedProjects) || postedCompletedCount + assignedCompletedCount;
        const activeProjectsCount = [...postedTasks, ...assignedTasks].filter((task) => ACTIVE_TASK_STATUSES.includes(task.status)).length;

        const rawReviews = Array.isArray(userData.reviews) ? userData.reviews.filter(Boolean) : [];
        const reviews = rawReviews.slice(0, 6).map((review, index) => {
          if (typeof review === 'string') {
            return {
              id: `review-${index}`,
              reviewerName: 'TaskMarket client',
              comment: review,
              rating: normalizeRating(userData.averageRating || userData.rating, 5) || 5,
              createdAt: '',
              reviewerPhoto: '',
            };
          }

          return {
            id: review.id || `review-${index}`,
            reviewerName: review.reviewerName || review.authorName || review.name || 'TaskMarket client',
            comment: review.comment || review.message || review.text || 'Review available.',
            rating: normalizeRating(review.rating, normalizeRating(userData.averageRating || userData.rating, 5) || 5),
            createdAt: review.createdAt || review.date || review.updatedAt || '',
            reviewerPhoto: review.reviewerPhoto || review.photoURL || '',
          };
        });

        const ratingValue = normalizeRating(userData.averageRating, normalizeRating(userData.rating, null));
        const reviewCount = Number(userData.reviewCount) || reviews.length;
        const memberSince = formatJoinedDate(userData.memberSince || userData.createdAt || userData.joinedAt);
        const title = getProfessionalTitle({
          professionalTitle: userData.professionalTitle || userData.title || '',
          categories: derivedCategories,
          assignedCount: assignedTasks.length,
          postedCount: postedTasks.length,
        });

        setProfile({
          id: userId,
          name: userData.name || userData.displayName || previewProfile.name || 'TaskMarket user',
          photoURL: userData.photoURL || previewProfile.photoURL || '',
          title,
          location: `${userData.location || previewProfile.location || ''}`.trim(),
          bio: typeof userData.bio === 'string' ? userData.bio.trim() : '',
          memberSince,
          skills: derivedSkills,
          categories: derivedCategories,
          completedTasks: completedProjects,
          rating: ratingValue,
          reviewCount,
          reviews,
          openClientTasks: postedTasks.filter((task) => task.status === 'open').length,
          activeProjects: activeProjectsCount,
          contactLabel: userData.contactInfo ? 'Contact details shared by this user' : 'Contact via TaskMarket',
        });
      } catch (profileError) {
        console.error('Failed to load public profile:', profileError);
        if (!isMounted) return;
        setError('Unable to load this public profile right now. Please try again.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPublicProfile();

    return () => {
      isMounted = false;
    };
  }, [previewProfile.location, previewProfile.name, previewProfile.photoURL, userId]);

  const actionCards = useMemo(() => {
    if (!profile) return [];
    if (user?.uid === profile.id) {
      return [
        { to: '/profile', label: 'Edit My Profile', tone: 'btn-primary text-white' },
        { to: '/dashboard', label: 'Open Dashboard', tone: 'btn-outline' },
      ];
    }

    return [
      { to: '/browse', label: 'Browse Tasks', tone: 'btn-primary text-white' },
      { to: '/dashboard', label: 'Open Dashboard', tone: 'btn-outline' },
    ];
  }, [profile, user?.uid]);

  if (loading) return <LoadingSpinner label="Loading public profile..." />;

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="alert alert-error rounded-2xl"><span>{error}</span></div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[12px] border border-dashed border-base-300 bg-base-100 px-6 py-14 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-base-200 text-2xl">👤</div>
          <h1 className="mt-5 text-2xl font-bold">Public profile not found</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-base-content/60 sm:text-base">
            This user profile is unavailable or no longer exists. Try returning to the marketplace and opening another profile.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/browse" className="btn btn-primary rounded-full px-6 text-white">Browse Tasks</Link>
            <Link to="/dashboard" className="btn btn-outline rounded-full px-6">Go to Dashboard</Link>
          </div>
        </section>
      </div>
    );
  }

  const profileInitial = getProfileInitial(profile.name);
  const primaryCtaLabel = user?.uid === profile.id ? 'This is how your public profile appears to others.' : `${profile.contactLabel}. Review their work history and categories before reaching out.`;

  return (
    <div className="relative mx-auto max-w-7xl animate-slide-in px-4 pb-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.07),transparent_28%)]"></div>

      <section className="overflow-hidden rounded-[12px] border border-base-300 bg-base-100 shadow-[0_28px_70px_rgba(15,23,42,0.14)]">
        <div className="relative overflow-hidden border-b border-base-300 bg-base-200/45 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_32%)]"></div>
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(99,102,241,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.08)_1px,transparent_1px)] [background-size:28px_28px]"></div>

          <div className="relative flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 flex-col gap-6 md:flex-row md:items-center">
              <div className="avatar mx-auto md:mx-0">
                <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-[5px] border-base-100 bg-base-100 text-4xl font-semibold text-primary shadow-[0_26px_70px_rgba(15,23,42,0.18)] sm:h-36 sm:w-36">
                  <div className="absolute inset-0 rounded-full ring-8 ring-primary/10"></div>
                  {profile.photoURL ? <img src={profile.photoURL} alt={profile.name} className="relative h-full w-full object-cover object-center" /> : <span className="relative">{profileInitial}</span>}
                </div>
              </div>

              <div className="min-w-0 text-center md:text-left">
                <p className="inline-flex rounded-full border border-primary/15 bg-primary/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Public profile</p>
                <h1 className="mt-4 break-words text-3xl font-bold tracking-tight text-base-content sm:text-5xl">{profile.name}</h1>
                <p className="mt-2 text-lg text-base-content/72 sm:text-2xl">{profile.title}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
                  {profile.location ? <span className="rounded-full border border-base-300 bg-base-100/85 px-3 py-1.5 text-sm font-medium text-base-content/72">📍 {profile.location}</span> : null}
                  <span className="rounded-full border border-base-300 bg-base-100/85 px-3 py-1.5 text-sm font-medium text-base-content/72">Member since {profile.memberSince || 'New member'}</span>
                  <span className="rounded-full border border-base-300 bg-base-100/85 px-3 py-1.5 text-sm font-medium text-base-content/72">{profile.reviewCount || 0} review{profile.reviewCount === 1 ? '' : 's'}</span>
                </div>
                <p className="mt-5 max-w-3xl text-sm leading-7 text-base-content/66 sm:text-base">
                  {profile.bio || 'This member has not added a bio yet, but their categories, project activity, and profile stats are available below.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:min-w-[32rem] xl:max-w-[34rem]">
              <StatCard label="Completed Tasks" value={profile.completedTasks} helper="Completed work across TaskMarket" />
              <StatCard label="Rating" value={profile.rating ? profile.rating.toFixed(1) : 'Unrated'} helper={profile.rating ? `${profile.reviewCount || 0} review${profile.reviewCount === 1 ? '' : 's'}` : 'No ratings yet'} />
              <StatCard label="Member Since" value={profile.memberSince || 'New'} helper="Marketplace presence" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 bg-base-100 px-5 py-8 sm:px-8 lg:px-10 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8">
          <div className="space-y-6">
            <SectionCard
              eyebrow="Expertise"
              title="Skills"
              description="Capabilities this member highlights across projects and profile data."
            >
              <div className="flex flex-wrap gap-2.5">
                {profile.skills.length ? profile.skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-primary/16 bg-primary/[0.08] px-4 py-2 text-sm font-medium text-primary shadow-sm">
                    {skill}
                  </span>
                )) : (
                  <div className="w-full rounded-[1.25rem] border border-dashed border-base-300 bg-base-200/30 px-4 py-5 text-sm text-base-content/55">No skills added yet.</div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Coverage"
              title="Categories"
              description="Service areas and work types associated with this profile."
            >
              <div className="flex flex-wrap gap-2.5">
                {profile.categories.length ? profile.categories.map((category) => (
                  <span key={category} className="rounded-full border border-secondary/18 bg-secondary/10 px-4 py-2 text-sm font-medium text-secondary shadow-sm">
                    {category}
                  </span>
                )) : (
                  <div className="w-full rounded-[1.25rem] border border-dashed border-base-300 bg-base-200/30 px-4 py-5 text-sm text-base-content/55">No categories added yet.</div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Profile summary"
              title="About"
              description="A concise professional overview for clients and freelancers reviewing this member."
            >
              <div className="rounded-[1.4rem] border border-base-300 bg-base-200/35 p-5 text-sm leading-8 text-base-content/76 sm:text-base">
                {profile.bio || 'No bio added yet.'}
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Social proof"
              title="Client Reviews"
              description={profile.reviewCount ? `A snapshot of feedback shared by clients on TaskMarket.` : 'No feedback has been added yet, but the profile still remains fully viewable.'}
            >
              <div className="space-y-3">
                {profile.reviews.length ? profile.reviews.map((review, index) => {
                  const initial = getProfileInitial(review.reviewerName);
                  return (
                    <div key={review.id || index} className="rounded-[1.45rem] border border-base-300 bg-base-100 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-base-300 bg-base-200 text-base font-semibold text-primary">
                          {review.reviewerPhoto ? <img src={review.reviewerPhoto} alt={review.reviewerName} className="h-full w-full object-cover" /> : <span className="flex items-center justify-center leading-none" style={{ lineHeight: 1 }}>{initial}</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-base font-semibold text-base-content sm:text-lg">{review.reviewerName}</div>
                              <div className="mt-1 flex items-center gap-1 text-lg">{renderStars(review.rating || 0)}</div>
                            </div>
                            <div className="text-sm text-base-content/50">{formatReviewDate(review.createdAt) || 'Recently added'}</div>
                          </div>
                          <p className="mt-3 text-sm leading-7 text-base-content/72 sm:text-base">{review.comment}</p>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-[1.5rem] border border-dashed border-base-300 bg-base-200/30 px-5 py-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-base-100 text-xl shadow-sm">⭐</div>
                    <h3 className="mt-4 text-lg font-semibold">No client reviews yet</h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-base-content/58">Once completed work receives feedback, reviews will appear here with rating details and timestamps.</p>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
            <section className="overflow-hidden rounded-[1.8rem] border border-base-300 bg-base-100 shadow-[0_20px_48px_rgba(15,23,42,0.1)]">
              <div className="border-b border-base-300 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_34%)] px-5 py-5">
                <h2 className="text-xl font-semibold">Profile Summary</h2>
                <p className="mt-1 text-sm leading-6 text-base-content/60">Quick signals for evaluating this member at a glance.</p>
              </div>

              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-4 rounded-[1.2rem] border border-base-300 bg-base-200/35 px-4 py-3 text-sm">
                  <span className="text-base-content/62">Open tasks</span>
                  <span className="font-semibold text-base-content">{profile.openClientTasks}</span>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-[1.2rem] border border-base-300 bg-base-200/35 px-4 py-3 text-sm">
                  <span className="text-base-content/62">Active work</span>
                  <span className="font-semibold text-base-content">{profile.activeProjects}</span>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-[1.2rem] border border-base-300 bg-base-200/35 px-4 py-3 text-sm">
                  <span className="text-base-content/62">Categories</span>
                  <span className="font-semibold text-base-content">{profile.categories.length}</span>
                </div>
                <div className="rounded-[1.2rem] border border-base-300 bg-base-200/35 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">Rating snapshot</div>
                  <div className="mt-2 flex items-center gap-2 text-lg">{renderStars(profile.rating || 0)}</div>
                  <div className="mt-2 text-sm text-base-content/60">{profile.rating ? `${profile.rating.toFixed(1)} average rating` : 'Currently unrated'}</div>
                </div>
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-base-300 bg-base-100 p-5 shadow-[0_20px_48px_rgba(15,23,42,0.1)]">
              <h2 className="text-xl font-semibold">Contact & Actions</h2>
              <p className="mt-2 text-sm leading-6 text-base-content/60">{primaryCtaLabel}</p>
              <div className="mt-5 space-y-3">
                {actionCards.map((action) => (
                  <Link key={action.to + action.label} to={action.to} className={`btn w-full rounded-full px-6 ${action.tone}`}>
                    {action.label}
                  </Link>
                ))}
              </div>
              <div className="mt-5 rounded-[1.25rem] border border-primary/16 bg-primary/[0.07] px-4 py-4 text-sm leading-6 text-base-content/68">
                Public profiles help users verify skills, categories, and marketplace activity without leaving TaskMarket.
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
};

export default PublicProfile;
