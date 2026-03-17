import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { db, doc, ensureUserDocument, getDoc, serverTimestamp, setDoc, updateUserProfile } from '../firebase';
import { formatJoinedDate } from '../lib/publicProfiles';
import { uploadFileWithProgress } from '../lib/workflow';

const splitList = (value = '') => value.split(',').map((item) => item.trim()).filter(Boolean);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const profilePhotoInputId = 'profile-photo-input';

const SectionCard = ({ eyebrow, title, description, children, className = '' }) => (
  <section className={`rounded-[1.75rem] border border-base-300 bg-base-100 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-6 ${className}`.trim()}>
    <div className="mb-5">
      {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/80">{eyebrow}</p> : null}
      <h2 className="mt-2 text-xl font-semibold">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-base-content/60">{description}</p> : null}
    </div>
    {children}
  </section>
);

const Profile = () => {
  const { user, refreshUserContext } = useAuth();
  const location = useLocation();
  const [showWelcomePopup, setShowWelcomePopup] = useState(location.state?.newUser === true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [previewPhotoURL, setPreviewPhotoURL] = useState('');
  const [removePhoto, setRemovePhoto] = useState(false);
  const [memberSince, setMemberSince] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    photoURL: '',
    professionalTitle: '',
    location: '',
    bio: '',
    skills: '',
    categories: '',
    contactInfo: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const snapshot = await getDoc(userRef);
        const data = snapshot.exists() ? snapshot.data() : {};
        const nextPhotoURL = data.photoURL || user.photoURL || '';

        setForm({
          fullName: data.name || user.displayName || '',
          photoURL: nextPhotoURL,
          professionalTitle: data.professionalTitle || data.title || '',
          location: data.location || '',
          bio: data.bio || '',
          skills: Array.isArray(data.skills) ? data.skills.join(', ') : '',
          categories: Array.isArray(data.categories)
            ? data.categories.join(', ')
            : Array.isArray(data.workCategories)
              ? data.workCategories.join(', ')
              : '',
          contactInfo: data.contactInfo || user.email || '',
        });
        setPreviewPhotoURL(nextPhotoURL);
        setMemberSince(formatJoinedDate(data.memberSince || data.createdAt || data.joinedAt) || 'New member');
      } catch (profileError) {
        console.error('Failed to load profile:', profileError);
        setError('Unable to load your profile right now.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  useEffect(() => {
    if (!selectedPhotoFile) return undefined;
    const objectUrl = URL.createObjectURL(selectedPhotoFile);
    setPreviewPhotoURL(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedPhotoFile]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handlePhotoChange = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    setError('');
    setSuccess('');

    if (!ALLOWED_FILE_TYPES.includes(nextFile.type)) {
      setError('Please choose a JPG, PNG, or WEBP image.');
      event.target.value = '';
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      setError('Image size must be 5MB or smaller.');
      event.target.value = '';
      return;
    }

    setSelectedPhotoFile(nextFile);
    setRemovePhoto(false);
  };

  const handleRemovePhoto = () => {
    setSelectedPhotoFile(null);
    setPreviewPhotoURL('');
    setForm((current) => ({ ...current, photoURL: '' }));
    setRemovePhoto(true);
    setSuccess('Profile photo will be removed when you save changes.');
    setError('');
  };

  const uploadSelectedPhoto = async () => {
    if (!selectedPhotoFile || !user?.uid) {
      return form.photoURL || '';
    }

    const upload = await uploadFileWithProgress(
      `profile-photos/${user.uid}`,
      selectedPhotoFile,
      (progress) => setUploadProgress(progress),
    );

    if (!upload?.downloadURL) {
      throw new Error('Cloudinary upload completed without returning a profile photo URL.');
    }

    return upload.downloadURL;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user?.uid) return;

    setSaving(true);
    setUploadProgress(0);
    setError('');
    setSuccess('');

    try {
      let finalPhotoURL = removePhoto ? '' : form.photoURL;
      if (selectedPhotoFile) {
        finalPhotoURL = await uploadSelectedPhoto();
      }

      const name = form.fullName.trim();
      const categories = splitList(form.categories);
      const payload = {
        name,
        photoURL: finalPhotoURL,
        professionalTitle: form.professionalTitle.trim(),
        location: form.location.trim(),
        bio: form.bio.trim(),
        skills: splitList(form.skills),
        categories,
        workCategories: categories,
        contactInfo: form.contactInfo.trim(),
        updatedAt: serverTimestamp(),
      };

      await updateUserProfile(user, {
        displayName: payload.name || user.displayName || 'User',
        photoURL: payload.photoURL || '',
      });

      await ensureUserDocument({
        ...user,
        displayName: payload.name || user.displayName,
        photoURL: payload.photoURL || '',
      }, {
        displayName: payload.name || user.displayName || 'User',
      });

      await setDoc(doc(db, 'users', user.uid), payload, { merge: true });

      setForm((current) => ({ ...current, photoURL: finalPhotoURL }));
      setPreviewPhotoURL(finalPhotoURL);
      setSelectedPhotoFile(null);
      setRemovePhoto(false);
      refreshUserContext?.({
        displayName: payload.name || user.displayName || 'User',
        photoURL: payload.photoURL || '',
      });
      setSuccess('Profile updated successfully.');
    } catch (saveError) {
      console.error('[Profile] handleSubmit error:', saveError);
      // Surface the real error message (e.g. CORS/upload failure) instead of a generic fallback
      const displayMsg =
        saveError?.message && saveError.message.length < 300
          ? saveError.message
          : 'Unable to save your profile right now. Please try again.';
      setError(displayMsg);
    } finally {
      // Always release the saving lock so the button never stays stuck
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const skillList = useMemo(() => splitList(form.skills), [form.skills]);
  const categoryList = useMemo(() => splitList(form.categories), [form.categories]);
  const profileName = form.fullName || user?.displayName || 'User';
  const profileInitial = (profileName || user?.email || 'U').slice(0, 1).toUpperCase();
  const visiblePhotoURL = previewPhotoURL || form.photoURL || '';
  const completionItems = useMemo(() => [
    Boolean(form.fullName.trim()),
    Boolean(form.professionalTitle.trim()),
    Boolean(form.location.trim()),
    Boolean(form.bio.trim()),
    skillList.length > 0,
    categoryList.length > 0,
    Boolean(form.contactInfo.trim()),
    Boolean(visiblePhotoURL),
  ], [categoryList.length, form.bio, form.contactInfo, form.fullName, form.location, form.professionalTitle, skillList.length, visiblePhotoURL]);
  const completionScore = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);

  if (loading) return <LoadingSpinner label="Loading your profile..." />;

  return (
    <div className="relative mx-auto max-w-7xl animate-slide-in px-4 pb-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.07),transparent_28%)]"></div>

      {/* Welcome popup for new users */}
      {showWelcomePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md animate-slide-in rounded-3xl border border-base-300 bg-base-100 p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setShowWelcomePopup(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-base-200 text-base-content/50 transition hover:bg-base-300 hover:text-base-content"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>

            <div className="mb-6 text-center">
              <h3 className="text-xl font-bold gradient-text mb-1 sm:text-2xl">
                Welcome to TaskMarket! 🎉
              </h3>
              <p className="mt-2 text-sm text-base-content/60 leading-6">
                Your account is ready! Complete your profile so clients and freelancers can find you easily.
              </p>
            </div>

            <ul className="mb-6 space-y-2 rounded-2xl border border-base-300 bg-base-200/50 px-4 py-3 text-sm">
              {[
                { icon: '👤', label: 'Add a professional headline' },
                { icon: '📍', label: 'Set your location' },
                { icon: '✍️', label: 'Write your bio' },
                { icon: '🛠️', label: 'Add your skills and categories' },
                { icon: '🖼️', label: 'Upload a profile photo' },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-base-content/70">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setShowWelcomePopup(false)}
              className="btn btn-primary w-full rounded-2xl"
            >
              Start Completing Your Profile →
            </button>
          </div>
        </div>
      )}

      {error ? <div className="alert alert-error mb-6 rounded-2xl"><span>{error}</span></div> : null}
      {success ? <div className="alert alert-success mb-6 rounded-2xl"><span>{success}</span></div> : null}

      <section className="overflow-hidden rounded-[12px] border border-base-300 bg-base-100 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        <div className="relative overflow-hidden border-b border-base-300 bg-base-200/45 px-5 pb-8 pt-6 sm:px-8 sm:pt-8 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_32%)]"></div>
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(99,102,241,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.08)_1px,transparent_1px)] [background-size:28px_28px]"></div>

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <div className="avatar">
                <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-[5px] border-base-100 bg-base-100 text-4xl font-semibold text-primary shadow-[0_24px_70px_rgba(15,23,42,0.18)] sm:h-32 sm:w-32">
                  <div className="absolute inset-0 rounded-full ring-8 ring-primary/10"></div>
                  {visiblePhotoURL ? <img src={visiblePhotoURL} alt={profileName} className="relative h-full w-full object-cover object-center" /> : <span className="relative flex items-center justify-center leading-none" style={{ lineHeight: 1 }}>{profileInitial}</span>}
                </div>
              </div>
              <div className="max-w-3xl">
                <p className="mb-2 inline-flex rounded-full border border-primary/15 bg-primary/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Profile studio</p>
                <h1 className="break-words text-3xl font-bold tracking-tight text-base-content sm:text-4xl">{profileName}</h1>
                <p className="mt-2 text-lg text-base-content/72">{form.professionalTitle || 'Add a strong professional headline'}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-base-content/70">
                  <span className="rounded-full border border-base-300 bg-base-100/85 px-3 py-1.5">Member since {memberSince}</span>
                  {form.location ? <span className="rounded-full border border-base-300 bg-base-100/85 px-3 py-1.5">📍 {form.location}</span> : null}
                  <span className="rounded-full border border-base-300 bg-base-100/85 px-3 py-1.5">Profile completeness {completionScore}%</span>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-base-content/66 sm:text-base">
                  {form.bio || 'Build trust with a concise intro, clear role, and focused skills so your public profile feels immediately hire-ready.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:w-full xl:w-auto xl:min-w-[31rem]">
              <div className="rounded-[1.45rem] border border-base-300 bg-base-100/90 px-4 py-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/45">Skills</div>
                <div className="mt-2 text-3xl font-semibold text-base-content">{skillList.length}</div>
              </div>
              <div className="rounded-[1.45rem] border border-base-300 bg-base-100/90 px-4 py-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/45">Categories</div>
                <div className="mt-2 text-3xl font-semibold text-base-content">{categoryList.length}</div>
              </div>
              <div className="rounded-[1.45rem] border border-base-300 bg-base-100/90 px-4 py-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/45">Contact</div>
                <div className="mt-2 break-words text-sm font-medium text-base-content/82 [overflow-wrap:anywhere]">{form.contactInfo || 'Not added yet'}</div>
              </div>
            </div>
          </div>
        </div>

        <form className="grid grid-cols-1 gap-6 bg-base-100 p-5 sm:p-8 xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:gap-8" onSubmit={handleSubmit}>
          <aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
            <SectionCard
              eyebrow="Live preview"
              title="Public profile snapshot"
              description="This side panel shows how your public profile feels at a glance."
            >
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/50">About</p>
                  <p className="mt-2 text-sm leading-7 text-base-content/76">{form.bio || 'Add a short summary so clients and freelancers can quickly understand your background.'}</p>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/50">Skills</p>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{skillList.length} listed</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {skillList.length > 0 ? skillList.map((skill) => (
                      <span key={skill} className="rounded-full border border-primary/18 bg-primary/[0.08] px-3 py-1.5 text-xs font-medium text-primary">{skill}</span>
                    )) : (
                      <div className="w-full rounded-2xl border border-dashed border-base-300 bg-base-200/30 px-4 py-4 text-sm text-base-content/55">No skills added yet.</div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/50">Categories</p>
                    <span className="rounded-full bg-secondary/12 px-2.5 py-1 text-xs font-medium text-secondary">{categoryList.length} listed</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categoryList.length > 0 ? categoryList.map((category) => (
                      <span key={category} className="rounded-full border border-secondary/18 bg-secondary/10 px-3 py-1.5 text-xs font-medium text-secondary">{category}</span>
                    )) : (
                      <div className="w-full rounded-2xl border border-dashed border-base-300 bg-base-200/30 px-4 py-4 text-sm text-base-content/55">No categories added yet.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.3rem] border border-base-300 bg-base-200/35 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/50">Completion score</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="text-3xl font-semibold">{completionScore}%</div>
                    <div className="text-sm text-base-content/55">Strong profiles convert better.</div>
                  </div>
                  <progress className="progress progress-primary mt-3 w-full" value={completionScore} max="100"></progress>
                </div>
              </div>
            </SectionCard>
          </aside>

          <div className="space-y-6">
            <SectionCard
              eyebrow="Identity"
              title="Basic information"
              description="Sharpen your name, headline, and location so your profile reads like a polished marketplace listing."
            >
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="grid grid-cols-1 gap-4">
                  <label className="form-control">
                    <div className="label"><span className="label-text font-medium">Full name</span></div>
                    <input name="fullName" value={form.fullName} onChange={handleChange} className="input input-bordered h-12 w-full rounded-2xl border-base-300 bg-base-100/90" placeholder="Your full name" />
                  </label>
                  <label className="form-control">
                    <div className="label"><span className="label-text font-medium">Professional title / headline</span></div>
                    <input name="professionalTitle" value={form.professionalTitle} onChange={handleChange} className="input input-bordered h-12 w-full rounded-2xl border-base-300 bg-base-100/90" placeholder="Freelance Web Developer" />
                  </label>
                  <label className="form-control">
                    <div className="label"><span className="label-text font-medium">Location</span></div>
                    <input name="location" value={form.location} onChange={handleChange} className="input input-bordered h-12 w-full rounded-2xl border-base-300 bg-base-100/90" placeholder="New Delhi, India" />
                  </label>
                </div>

                <div className="rounded-[1.6rem] border border-base-300 bg-base-200/35 p-4 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Profile image editor</p>
                      <p className="text-xs text-base-content/55">Upload JPG, PNG, or WEBP up to 5MB.</p>
                    </div>
                    {visiblePhotoURL ? <button type="button" className="btn btn-ghost btn-xs rounded-full text-error" onClick={handleRemovePhoto}>Remove</button> : null}
                  </div>

                  <div className="flex flex-col items-center gap-4 text-center">
                    <label htmlFor={profilePhotoInputId} className="group relative cursor-pointer">
                      <div className="avatar">
                        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-base-300 bg-base-100 text-3xl font-semibold text-primary shadow-sm transition group-hover:border-primary/45 group-hover:shadow-[0_16px_36px_rgba(102,126,234,0.18)]">
                          {visiblePhotoURL ? <img src={visiblePhotoURL} alt={profileName} className="h-full w-full object-cover object-center" /> : <span className="flex items-center justify-center leading-none" style={{ lineHeight: 1 }}>{profileInitial}</span>}
                        </div>
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto inline-flex w-max rounded-full bg-slate-950/75 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm">Change photo</div>
                    </label>
                    <div className="w-full space-y-3">
                      <label htmlFor={profilePhotoInputId} className="btn btn-outline w-full rounded-full">{visiblePhotoURL ? 'Change Photo' : 'Upload Photo'}</label>
                      <input id={profilePhotoInputId} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
                      {selectedPhotoFile ? <p className="break-words text-xs text-base-content/55 [overflow-wrap:anywhere]">Selected: {selectedPhotoFile.name}</p> : <p className="text-xs text-base-content/55">Your avatar stays centered across devices.</p>}
                      {saving && uploadProgress > 0 ? (
                        <div className="space-y-2">
                          <progress className="progress progress-primary w-full" value={uploadProgress} max="100"></progress>
                          <p className="text-xs text-base-content/55">Uploading image... {uploadProgress}%</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Story"
              title="About / Bio"
              description="Give clients and freelancers a crisp summary of your background, strengths, and the work you want to attract."
            >
              <label className="form-control">
                <div className="label"><span className="label-text font-medium">About / bio</span></div>
                <textarea name="bio" value={form.bio} onChange={handleChange} className="textarea textarea-bordered min-h-40 w-full rounded-[1.5rem] border-base-300 bg-base-100/90" placeholder="Tell clients and freelancers what you do best." />
              </label>
            </SectionCard>

            <SectionCard
              eyebrow="Expertise"
              title="Skills & Categories"
              description="Keep these lists focused so your public profile feels specialized rather than generic."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="form-control">
                  <div className="label"><span className="label-text font-medium">Skills</span></div>
                  <input name="skills" value={form.skills} onChange={handleChange} className="input input-bordered h-12 w-full rounded-2xl border-base-300 bg-base-100/90" placeholder="React, Firebase, UI Design" />
                  <div className="label"><span className="label-text-alt text-base-content/55">Separate skills with commas.</span></div>
                </label>
                <label className="form-control">
                  <div className="label"><span className="label-text font-medium">Categories</span></div>
                  <input name="categories" value={form.categories} onChange={handleChange} className="input input-bordered h-12 w-full rounded-2xl border-base-300 bg-base-100/90" placeholder="Web Development, Design" />
                  <div className="label"><span className="label-text-alt text-base-content/55">Separate categories with commas.</span></div>
                </label>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-[1.35rem] border border-base-300 bg-base-200/35 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Skill preview</p>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{skillList.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {skillList.length ? skillList.map((skill) => (
                      <span key={skill} className="rounded-full border border-primary/18 bg-primary/[0.08] px-3 py-1.5 text-xs font-medium text-primary">{skill}</span>
                    )) : <div className="w-full rounded-2xl border border-dashed border-base-300 bg-base-100/65 px-4 py-4 text-sm text-base-content/55">No skills added yet.</div>}
                  </div>
                </div>
                <div className="rounded-[1.35rem] border border-base-300 bg-base-200/35 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Category preview</p>
                    <span className="rounded-full bg-secondary/12 px-2.5 py-1 text-xs font-medium text-secondary">{categoryList.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categoryList.length ? categoryList.map((category) => (
                      <span key={category} className="rounded-full border border-secondary/18 bg-secondary/10 px-3 py-1.5 text-xs font-medium text-secondary">{category}</span>
                    )) : <div className="w-full rounded-2xl border border-dashed border-base-300 bg-base-100/65 px-4 py-4 text-sm text-base-content/55">No categories added yet.</div>}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Reachability"
              title="Contact & Publishing"
              description="Add a contact method and then save once you are happy with how the profile preview feels."
            >
              <label className="form-control">
                <div className="label"><span className="label-text font-medium">Optional contact info</span></div>
                <input name="contactInfo" value={form.contactInfo} onChange={handleChange} className="input input-bordered h-12 w-full rounded-2xl border-base-300 bg-base-100/90" placeholder="Phone, Telegram, portfolio link, etc." />
              </label>

              <div className="mt-5 rounded-[1.4rem] border border-base-300 bg-base-200/35 p-4">
                <div className="flex flex-col gap-3 border-t-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-base-content/78">Save once you are happy with the preview.</p>
                    <p className="mt-1 text-sm text-base-content/55">Your public profile updates immediately after a successful save.</p>
                  </div>
                  <button type="submit" className={`btn btn-primary min-h-[3.5rem] rounded-full px-6 text-white shadow-[0_14px_30px_rgba(102,126,234,0.25)] ${saving ? 'btn-disabled' : ''}`} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>
        </form>
      </section>
    </div>
  );
};

export default Profile;
