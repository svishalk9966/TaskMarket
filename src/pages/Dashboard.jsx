import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import TaskWorkflowPanel from '../components/TaskWorkflowPanel';
import { useAuth } from '../contexts/AuthContext';
import { useRole, ROLES } from '../contexts/RoleContext';
import ReviewModal from '../components/ReviewModal';
import { hasReviewed } from '../lib/reviews';
import { db } from '../firebase';
import { formatCurrency } from '../config';
import { normalizeTask, sortTasksNewestFirst, TASKS_COLLECTION_NAME } from '../lib/tasks';
import ReceiptModal from '../components/ReceiptModal';

const Dashboard = () => {
  const { user } = useAuth();
  const { role, canPost, canBid } = useRole();
  const [activeTab, setActiveTab] = useState(() => canPost ? 'posted' : canBid ? 'bids' : 'posted');
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState('');
  const [reviewModal, setReviewModal] = useState(null); // { task, targetUser, targetRole }
  const [reviewedTasks, setReviewedTasks] = useState({}); // taskId -> bool
  const [receiptModal, setReceiptModal] = useState(null); // { task, userRole }

  useEffect(() => {
    if (!user) return undefined;
    const unsubscribe = onSnapshot(collection(db, TASKS_COLLECTION_NAME), (snapshot) => {
      const allTasks = sortTasksNewestFirst(
        snapshot.docs.map((d) => normalizeTask({ id: d.id, ...d.data() }))
      );
      setTasks(allTasks);
      setLoading(false);
      setError('');
      if (!expandedTaskId && allTasks.length > 0) setExpandedTaskId(allTasks[0].id);
    }, (e) => { console.error(e); setError('Unable to load your dashboard right now.'); setLoading(false); });
    return () => unsubscribe();
  }, [user, expandedTaskId]);

  const normalizedEmail = (user?.email || '').toLowerCase();
  const postedTasks   = useMemo(() => tasks.filter((t) => t.postedById === user?.uid || (t.postedBy || '').toLowerCase() === normalizedEmail), [tasks, user?.uid, normalizedEmail]);
  const myBids        = useMemo(() => tasks.filter((t) => t.bids?.some((b) => b.freelancerId === user?.uid)), [tasks, user?.uid]);
  const assignedTasks = useMemo(() => tasks.filter((t) => t.assignedTo === user?.uid), [tasks, user?.uid]);

  // Expired tasks that need repost action
  const expiredTasksNeedingAction = useMemo(() =>
    postedTasks.filter((t) => t.status === 'expired'),
  [postedTasks]);

  // Canonical paid statuses — escrow_held means payment received and held
  const ACTIVE_PAYMENT_STATUSES = ['paid', 'escrow_held', 'released'];

  const stats = useMemo(() => ({
    posted:     postedTasks.length,
    active:     postedTasks.filter((t) => ['open','awaiting_payment','in_progress','delivered','revision_requested'].includes(t.status)).length,
    assigned:   assignedTasks.length,
    completed:  tasks.filter((t) => t.status === 'completed' && (t.postedById === user?.uid || t.assignedTo === user?.uid)).length,
    totalSpent: postedTasks.filter((t) => ACTIVE_PAYMENT_STATUSES.includes(t.paymentStatus)).reduce((a, t) => a + Number(t.clientTotalPayable || t.totalPaidByClient || t.amount || t.budget || 0), 0),
    bidsPlaced: myBids.length,
    earnings:   assignedTasks.filter((t) => ACTIVE_PAYMENT_STATUSES.includes(t.paymentStatus)).reduce((a, t) => a + Number(t.netAmountToFreelancer || t.amount || t.budget || 0), 0),
  }), [assignedTasks, myBids.length, postedTasks, tasks, user?.uid]);

  // ── Role-aware stat cards ──────────────────────────────────────────────────
  const statCards = useMemo(() => {
    const effectiveRole = role || ROLES.BOTH;
    if (effectiveRole === ROLES.CLIENT) return [
      { label: 'Tasks Posted',  value: stats.posted,               tone: 'text-primary',   helper: 'Created by you' },
      { label: 'Active Tasks',  value: stats.active,               tone: 'text-secondary', helper: 'In progress' },
      { label: 'Completed',     value: stats.completed,            tone: 'text-success',   helper: 'Finished tasks' },
      { label: 'Total Spent',   value: formatCurrency(stats.totalSpent), tone: 'text-info', helper: 'Amount paid' },
    ];
    if (effectiveRole === ROLES.FREELANCER) return [
      { label: 'Bids Placed',   value: stats.bidsPlaced,           tone: 'text-primary',   helper: 'Proposals sent' },
      { label: 'Assigned',      value: stats.assigned,             tone: 'text-secondary', helper: 'Active projects' },
      { label: 'Completed',     value: stats.completed,            tone: 'text-success',   helper: 'Finished work' },
      { label: 'Total Earned',  value: formatCurrency(stats.earnings), tone: 'text-accent', helper: 'From assignments' },
    ];
    // BOTH
    return [
      { label: 'Tasks Posted',  value: stats.posted,               tone: 'text-primary',   helper: 'Created by you' },
      { label: 'Active Tasks',  value: stats.active,               tone: 'text-secondary', helper: 'Currently moving' },
      { label: 'Assigned',      value: stats.assigned,             tone: 'text-accent',    helper: 'Given to you' },
      { label: 'Completed',     value: stats.completed,            tone: 'text-info',      helper: 'Finished work' },
      { label: 'Total Spent',   value: formatCurrency(stats.totalSpent), tone: 'text-success', helper: 'Paid tasks' },
    ];
  }, [role, stats]);

  // ── Role-aware tabs ────────────────────────────────────────────────────────
  // Assigned Tasks is only meaningful for freelancers (canBid users)
  const allTabs = [
    { id: 'posted',   label: 'My Posted Tasks',  show: canPost },
    { id: 'bids',     label: 'My Bids',          show: canBid },
    { id: 'assigned', label: 'Assigned Tasks',   show: canBid },
  ];
  const tabs = allTabs.filter((t) => t.show);

  // ── Role label + description for hero ─────────────────────────────────────
  const roleConfig = {
    [ROLES.CLIENT]:     { badge: 'Client',              color: 'border-primary/30 bg-primary/15',     desc: 'Post tasks, review bids, and manage your projects.' },
    [ROLES.FREELANCER]: { badge: 'Freelancer',          color: 'border-secondary/30 bg-secondary/20', desc: 'Browse open tasks, place bids, and track your work.' },
    [ROLES.BOTH]:       { badge: 'Client & Freelancer', color: 'border-accent/30 bg-accent/20',       desc: 'Post tasks as a client and bid on work as a freelancer.' },
  };
  const rc = roleConfig[role] || roleConfig[ROLES.BOTH];

  const visibleTasks = activeTab === 'posted' ? postedTasks : activeTab === 'bids' ? myBids : assignedTasks;

  // Check review status for completed tasks when tab changes
  useEffect(() => {
    if (!user) return;
    const completedVisible = visibleTasks.filter((t) => t.status === 'completed');
    completedVisible.forEach(async (t) => {
      if (reviewedTasks[t.id] !== undefined) return;
      const targetId = activeTab === 'posted' ? (t.assignedTo || t.selectedFreelancerId) : t.postedById;
      if (!targetId) return;
      const already = await hasReviewed(targetId, user.uid, t.id);
      setReviewedTasks((prev) => ({ ...prev, [t.id]: already }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, visibleTasks.length, user]);
  const selectedTask = visibleTasks.find((t) => t.id === expandedTaskId) || visibleTasks[0] || null;

  // ── Empty state CTA per tab ────────────────────────────────────────────────
  const emptyConfig = {
    posted:   { icon: '📝', title: "No tasks posted yet", desc: "Start with a clear brief so the right freelancers can respond fast.", cta: 'Post Your First Task', to: '/post' },
    bids:     { icon: '🛠️', title: "No bids placed yet",  desc: "Explore open tasks and start applying to projects that match your skills.", cta: 'Browse Tasks', to: '/browse' },
    assigned: { icon: '✅', title: "No assigned tasks",   desc: "Once you are selected for a task after bidding, it will appear here.", cta: 'Browse Tasks', to: '/browse' },
  };
  const ec = emptyConfig[activeTab];

  if (loading) return <LoadingSpinner label="Loading your dashboard..." />;

  return (
    <div className="mx-auto max-w-7xl animate-slide-in px-4 pb-2 pt-6 sm:px-6 sm:pb-3 sm:pt-8 lg:px-8">
      {error && <div className="alert alert-error mb-6 rounded-2xl"><span>{error}</span></div>}

      {/* Expired tasks alert banner */}
      {expiredTasksNeedingAction.length > 0 && (
        <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-4 flex items-start gap-3">
          <span className="text-xl shrink-0">⏰</span>
          <div>
            <p className="font-semibold text-warning">
              {expiredTasksNeedingAction.length} task{expiredTasksNeedingAction.length > 1 ? 's' : ''} expired without a freelancer
            </p>
            <p className="mt-0.5 text-sm text-base-content/70">
              Repost them to accept new bids. Tasks not reposted within 1 day will be automatically removed.
            </p>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <ReviewModal
          task={reviewModal.task}
          reviewer={{ uid: user.uid, displayName: user.displayName, photoURL: user.photoURL }}
          targetUser={reviewModal.targetUser}
          targetRole={reviewModal.targetRole}
          onClose={() => setReviewModal(null)}
          onSuccess={() => {
            setReviewedTasks((prev) => ({ ...prev, [reviewModal.task.id]: true }));
            setReviewModal(null);
          }}
        />
      )}

      <section className="rounded-[12px] border border-white/8 bg-base-100 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">

        {/* ── Hero banner ── */}
        <div className="relative overflow-hidden border-b border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(102,126,234,0.32),transparent_30%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_24%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.9))] px-5 pb-8 pt-6 sm:px-8 sm:pt-8 lg:px-10">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:26px_26px]" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">

            {/* Avatar + name */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="avatar">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white/18 bg-slate-950/40 text-3xl font-semibold text-white shadow-[0_20px_60px_rgba(15,23,42,0.3)] sm:h-28 sm:w-28">
                  {user?.photoURL
                    ? <img src={user.photoURL} alt={user.displayName || 'User'} className="h-full w-full rounded-full object-cover object-center" style={{ aspectRatio: '1/1' }} />
                    : <span className="flex items-center justify-center leading-none" style={{ lineHeight: 1 }}>{(user?.displayName || user?.email || 'U').slice(0, 1).toUpperCase()}</span>
                  }
                </div>
              </div>
              <div className="max-w-3xl text-white">
                <p className="mb-2 inline-flex rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-medium tracking-[0.2em] text-white/70">DASHBOARD</p>
                <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{user?.displayName || 'User'}</h1>
                <p className="mt-2 break-words text-sm text-white/75 [overflow-wrap:anywhere] sm:text-base">{user?.email}</p>
                {/* Role badge — dynamic */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium text-white ${rc.color}`}>
                    {rc.badge}
                  </span>
                </div>
              </div>
            </div>

            {/* Role-aware summary card */}
            <div className="max-w-md rounded-[1.75rem] border border-white/12 bg-white/8 p-4 text-white backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                {role === ROLES.CLIENT ? 'Client Workspace' : role === ROLES.FREELANCER ? 'Freelancer Workspace' : 'Workspace Summary'}
              </p>
              <p className="mt-3 text-sm leading-7 text-white/82">{rc.desc}</p>
              {/* Quick action button */}
              <div className="mt-4">
                {canPost && (
                  <Link to="/post" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Post a Task
                  </Link>
                )}
                {canBid && (
                  <Link to="/browse" className={`inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 ${canPost ? 'ml-2' : ''}`}>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    Browse Tasks
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="space-y-6 bg-base-100 p-5 sm:p-8 lg:p-8">

          {/* Stat cards — role-aware count */}
          <section className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${statCards.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-5'}`}>
            {statCards.map((card) => (
              <div key={card.label} className="rounded-[1.75rem] border border-white/8 bg-base-200/42 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
                <div className="min-w-0 text-sm font-medium leading-6 text-base-content/62">{card.label}</div>
                <div className={`mt-3 text-4xl font-bold tracking-tight ${card.tone}`}>{card.value}</div>
                <div className="mt-3 text-xs uppercase tracking-[0.18em] text-base-content/45">{card.helper}</div>
              </div>
            ))}
          </section>

          {/* Tabs — role-aware */}
          <section className="rounded-[1.75rem] border border-white/8 bg-base-200/32 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className={`grid gap-2 ${tabs.length === 1 ? 'grid-cols-1' : tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-primary text-white shadow-[0_14px_30px_rgba(102,126,234,0.3)]' : 'bg-transparent text-base-content/70 hover:bg-base-100 hover:text-base-content'}`}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {/* Task list / empty state */}
          {visibleTasks.length === 0 ? (
            <section className="rounded-[1.75rem] border border-dashed border-base-300 bg-[linear-gradient(180deg,rgba(102,126,234,0.06),transparent)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-10">
              <div className="flex min-h-[16rem] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/12 text-3xl">
                  {ec.icon}
                </div>
                <h2 className="text-2xl font-semibold">{ec.title}</h2>
                <p className="mt-3 max-w-md text-sm leading-7 text-base-content/65 sm:text-base">{ec.desc}</p>
                <Link to={ec.to} className="btn btn-primary mt-6 rounded-full px-6 text-white shadow-[0_14px_30px_rgba(102,126,234,0.3)]">
                  {ec.cta}
                </Link>
              </div>
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(24rem,0.95fr)_minmax(0,1.05fr)] xl:items-stretch">

              {/* LEFT — Task List */}
              <section className="rounded-[12px] border border-base-300 bg-base-100/95 shadow-[0_22px_56px_rgba(15,23,42,0.09)] xl:flex xl:min-h-[calc(100vh-10.75rem)] xl:max-h-[calc(100vh-10.75rem)] xl:flex-col xl:overflow-hidden">
                <div className="border-b border-base-300 bg-base-100/90 px-5 py-4 sm:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Task List</h2>
                      <p className="mt-1 text-sm text-base-content/58">Select any task to inspect workflow details.</p>
                    </div>
                    <div className="rounded-full bg-base-200/70 px-3 py-1.5 text-xs font-medium text-base-content/60">{visibleTasks.length} items</div>
                  </div>
                </div>
                <div className="task-scroll-shell rounded-b-[2rem] bg-base-100/55 p-1 pt-0 xl:min-h-0 xl:flex-1 xl:overflow-hidden">
                  <div className="task-list-scroll space-y-3 rounded-[8px] px-4 py-4 sm:px-5 sm:py-5 xl:h-full xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto xl:bg-base-100/60">
                    {visibleTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => setExpandedTaskId(task.id)}
                        className={`w-full rounded-[1.5rem] border p-4 text-left transition ${expandedTaskId === task.id ? 'border-primary/30 bg-primary/8 shadow-[0_16px_35px_rgba(102,126,234,0.18)]' : 'border-base-200 bg-base-200/45 hover:border-primary/20 hover:bg-base-200/72'}`}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="break-words text-base font-semibold">{task.title}</div>
                              <div className="mt-1 break-words text-sm text-base-content/60">{task.category} • {formatCurrency(task.budget)}</div>
                            </div>
                            {activeTab === 'bids' ? (
                              <div className="max-w-full rounded-full bg-base-100 px-3 py-1 text-xs font-medium text-base-content/70">
                                {(task.selectedFreelancerId || task.assignedTo) === user?.uid
                                  ? (['paid','escrow_held','released'].includes(task.paymentStatus) ? 'Order Active' : 'Awaiting Payment')
                                  : 'Pending'}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-base-content/60">
                            <span className="rounded-full border border-base-300 bg-base-100 px-3 py-1 capitalize">{task.status || 'open'}</span>
                            <span className="rounded-full border border-base-300 bg-base-100 px-3 py-1">{task.bids?.length || 0} bids</span>
                            {task.assignedFreelancerName ? <span className="max-w-full rounded-full border border-base-300 bg-base-100 px-3 py-1 [overflow-wrap:anywhere]">Assigned: {task.assignedFreelancerName}</span> : null}
                          </div>
                          {/* Receipt button — show when payment exists */}
                          {(() => {
                            const hasPaid = ['escrow_held','paid','released','refunded'].includes(task.paymentStatus);
                            const isRefunded = String(task.refundStatus||'').toLowerCase() === 'refunded';
                            const isThisFreelancer = (task.selectedFreelancerId || task.assignedTo) === user?.uid;
                            const showForClient = activeTab === 'posted' && hasPaid;
                            const showForFreelancer = activeTab === 'assigned' && isThisFreelancer && (hasPaid || isRefunded);
                            if (!showForClient && !showForFreelancer) return null;
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReceiptModal({
                                    task,
                                    userRole: showForClient ? 'client' : 'freelancer',
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/15"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                View Receipt
                              </button>
                            );
                          })()}

                          {/* Leave a Review — only on completed tasks */}
                          {task.status === 'completed' && (() => {
                            const targetId = activeTab === 'posted'
                              ? (task.assignedTo || task.selectedFreelancerId)
                              : task.postedById;
                            const targetName = activeTab === 'posted'
                              ? (task.assignedFreelancerName || task.selectedFreelancerName || 'Freelancer')
                              : (task.postedByName || task.clientName || 'Client');
                            const targetRole = activeTab === 'posted' ? 'freelancer' : 'client';
                            if (!targetId) return null;
                            if (reviewedTasks[task.id]) {
                              return (
                                <div className="flex items-center gap-1.5 text-xs text-success font-medium">
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                  Review submitted
                                </div>
                              );
                            }
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReviewModal({
                                    task,
                                    targetUser: { uid: targetId, displayName: targetName },
                                    targetRole,
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-500 transition hover:bg-amber-400/20"
                              >
                                ⭐ Leave a Review
                              </button>
                            );
                          })()}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* RIGHT — Task Workflow */}
              <div className="min-w-0 xl:min-h-[calc(100vh-10.75rem)] xl:max-h-[calc(100vh-10.75rem)]">
                {selectedTask ? (
                  <div className="task-scroll-shell flex h-full min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-[12px] border border-base-300 bg-base-100/95 shadow-[0_22px_56px_rgba(15,23,42,0.09)]">
                    <div className="shrink-0 border-b border-base-300 bg-base-100/90 px-5 py-4 sm:px-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold">Task Workflow</h2>
                          <p className="mt-1 text-sm text-base-content/58">Manage bids, payment gating, delivery, revisions, and workspace updates.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="badge badge-outline capitalize">{selectedTask.status || 'open'}</span>
                          {selectedTask.blocked && <span className="badge badge-warning">Blocked by Admin</span>}
                        </div>
                      </div>
                    </div>
                    <div className="task-detail-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-b-[12px] bg-base-100/60">
                      {selectedTask.blocked ? (
                        <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/15 text-3xl">🚫</div>
                          <h3 className="text-lg font-semibold text-base-content">Task Blocked by Admin</h3>
                          <p className="max-w-sm text-sm leading-6 text-base-content/60">
                            This task has been blocked by the platform admin. No further actions can be taken. Contact support if you believe this is an error.
                          </p>
                        </div>
                      ) : (
                        <TaskWorkflowPanel task={selectedTask} mode={activeTab === 'posted' ? 'client' : activeTab === 'assigned' ? 'assigned' : 'readonly'} />
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
