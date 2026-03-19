import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import TaskWorkflowPanel from '../components/TaskWorkflowPanel';
import { useAuth } from '../contexts/AuthContext';
import { useRole, ROLES } from '../contexts/RoleContext';
import ReviewModal from '../components/ReviewModal';
import { hasReviewed } from '../lib/reviews';
import { db, formatFirestoreDate } from '../firebase';
import { formatCurrency } from '../config';
import { normalizeTask, sortTasksNewestFirst, TASKS_COLLECTION_NAME } from '../lib/tasks';
import ReceiptModal from '../components/ReceiptModal';
import { getMaskedPayoutDestinationSummary, subscribeToFreelancerPayoutRequests } from '../lib/payouts';

const normalizeStatus = (value = '') => String(value || '').trim().toLowerCase();

const Dashboard = () => {
  const { user } = useAuth();
  const { role, canPost, canBid } = useRole();
  const [activeTab, setActiveTab] = useState(() => canPost ? 'posted' : canBid ? 'bids' : 'assigned');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState('');
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewedTasks, setReviewedTasks] = useState({});
  const [receiptModal, setReceiptModal] = useState(null);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [payoutLoading, setPayoutLoading] = useState(() => canBid);

  useEffect(() => {
    if (!user) return undefined;
    const unsubscribe = onSnapshot(
      collection(db, TASKS_COLLECTION_NAME),
      (snapshot) => {
        const allTasks = sortTasksNewestFirst(snapshot.docs.map((d) => normalizeTask({ id: d.id, ...d.data() })));
        setTasks(allTasks);
        setLoading(false);
        setError('');
        if (!expandedTaskId && allTasks.length > 0) setExpandedTaskId(allTasks[0].id);
      },
      (e) => {
        console.error(e);
        setError('Unable to load your dashboard right now.');
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [user, expandedTaskId]);

  useEffect(() => {
    if (!canBid || !user?.uid) {
      setPayoutRequests([]);
      setPayoutLoading(false);
      return undefined;
    }
    setPayoutLoading(true);
    const unsubscribe = subscribeToFreelancerPayoutRequests(
      user.uid,
      (items) => {
        setPayoutRequests(items);
        setPayoutLoading(false);
      },
      (snapshotError) => {
        console.error('Failed to load dashboard payout history:', snapshotError);
        setPayoutRequests([]);
        setPayoutLoading(false);
      },
    );
    return () => unsubscribe();
  }, [canBid, user?.uid]);

  const normalizedEmail = (user?.email || '').toLowerCase();
  const getAssignedFreelancerId = (task = {}) => task.assignedTo || task.selectedFreelancerId || '';
  const getAssignedFreelancerName = (task = {}) => task.assignedFreelancerName || task.selectedFreelancerName || '';
  const hasAssignedFreelancer = (task = {}) => Boolean(getAssignedFreelancerId(task));
  const isTaskClientOwnedByUser = (task = {}) => task.postedById === user?.uid || (task.postedBy || '').toLowerCase() === normalizedEmail;
  const isTaskAssignedToUser = (task = {}) => getAssignedFreelancerId(task) === user?.uid;

  const postedTasks = useMemo(() => tasks.filter((t) => isTaskClientOwnedByUser(t)), [tasks, user?.uid, normalizedEmail]);
  const myBids = useMemo(() => tasks.filter((t) => t.bids?.some((b) => b.freelancerId === user?.uid)), [tasks, user?.uid]);
  const assignedTasks = useMemo(
    () => tasks.filter((t) => hasAssignedFreelancer(t) && (isTaskClientOwnedByUser(t) || isTaskAssignedToUser(t))),
    [tasks, user?.uid, normalizedEmail],
  );

  const expiredTasksNeedingAction = useMemo(() => postedTasks.filter((t) => t.status === 'expired'), [postedTasks]);

  const payoutSummary = useMemo(() => payoutRequests.reduce((acc, request) => {
    const status = normalizeStatus(request.status);
    const amount = Number(request.amount || 0);
    acc.count += 1;
    if (status === 'paid') {
      acc.paidCount += 1;
      acc.totalPaid += amount;
    }
    if (['details_submitted', 'under_review', 'approved', 'processing'].includes(status)) {
      acc.pendingCount += 1;
      acc.pendingAmount += amount;
    }
    return acc;
  }, {
    count: 0,
    paidCount: 0,
    pendingCount: 0,
    totalPaid: 0,
    pendingAmount: 0,
  }), [payoutRequests]);

  const stats = useMemo(() => ({
    posted: postedTasks.length,
    active: postedTasks.filter((t) => ['open', 'awaiting_payment', 'in_progress', 'delivered', 'revision_requested'].includes(t.status)).length,
    assigned: assignedTasks.length,
    completed: tasks.filter((t) => t.status === 'completed' && (t.postedById === user?.uid || (t.assignedTo || t.selectedFreelancerId) === user?.uid)).length,
    totalSpent: postedTasks.filter((t) => ['paid', 'released'].includes(t.paymentStatus)).reduce((a, t) => a + Number(t.totalPaidByClient || t.amount || t.budget || 0), 0),
    bidsPlaced: myBids.length,
    earnings: payoutSummary.totalPaid,
  }), [assignedTasks.length, myBids.length, payoutSummary.totalPaid, postedTasks, tasks, user?.uid]);

  const statCards = useMemo(() => {
    const effectiveRole = role || ROLES.BOTH;
    if (effectiveRole === ROLES.CLIENT) return [
      { label: 'Tasks Posted', value: stats.posted, tone: 'text-primary', helper: 'Created by you' },
      { label: 'Active Tasks', value: stats.active, tone: 'text-secondary', helper: 'In progress' },
      { label: 'Completed', value: stats.completed, tone: 'text-success', helper: 'Finished tasks' },
      { label: 'Total Spent', value: formatCurrency(stats.totalSpent), tone: 'text-info', helper: 'Amount paid' },
    ];
    if (effectiveRole === ROLES.FREELANCER) return [
      { label: 'Bids Placed', value: stats.bidsPlaced, tone: 'text-primary', helper: 'Proposals sent' },
      { label: 'Assigned', value: stats.assigned, tone: 'text-secondary', helper: 'Active projects' },
      { label: 'Completed', value: stats.completed, tone: 'text-success', helper: 'Finished work' },
      { label: 'Total Earned', value: formatCurrency(stats.earnings), tone: 'text-accent', helper: 'From payouts' },
    ];
    return [
      { label: 'Tasks Posted', value: stats.posted, tone: 'text-primary', helper: 'Created by you' },
      { label: 'Active Tasks', value: stats.active, tone: 'text-secondary', helper: 'Currently moving' },
      { label: 'Assigned', value: stats.assigned, tone: 'text-accent', helper: 'Given to you' },
      { label: 'Completed', value: stats.completed, tone: 'text-info', helper: 'Finished work' },
      { label: 'Total Spent', value: formatCurrency(stats.totalSpent), tone: 'text-success', helper: 'Paid tasks' },
    ];
  }, [role, stats]);

  const allTabs = [
    { id: 'posted', label: 'My Posted Tasks', show: canPost },
    { id: 'bids', label: 'My Bids', show: canBid },
    { id: 'assigned', label: 'Assigned Tasks', show: true },
  ];
  const tabs = allTabs.filter((t) => t.show);

  const roleConfig = {
    [ROLES.CLIENT]: { badge: 'Client', color: 'border-primary/30 bg-primary/15', desc: 'Post tasks, review bids, and manage your projects.' },
    [ROLES.FREELANCER]: { badge: 'Freelancer', color: 'border-secondary/30 bg-secondary/20', desc: 'Browse open tasks, place bids, and track your work.' },
    [ROLES.BOTH]: { badge: 'Client & Freelancer', color: 'border-accent/30 bg-accent/20', desc: 'Post tasks as a client and bid on work as a freelancer.' },
  };
  const rc = roleConfig[role] || roleConfig[ROLES.BOTH];
  const visibleTasks = activeTab === 'posted' ? postedTasks : activeTab === 'bids' ? myBids : assignedTasks;

  useEffect(() => {
    if (!user) return;
    const completedVisible = visibleTasks.filter((t) => t.status === 'completed');
    completedVisible.forEach(async (t) => {
      if (reviewedTasks[t.id] !== undefined) return;
      const targetId = isTaskClientOwnedByUser(t) ? getAssignedFreelancerId(t) : t.postedById;
      if (!targetId) return;
      const already = await hasReviewed(targetId, user.uid, t.id);
      setReviewedTasks((prev) => ({ ...prev, [t.id]: already }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, visibleTasks.length, user]);

  const selectedTask = visibleTasks.find((t) => t.id === expandedTaskId) || visibleTasks[0] || null;

  const emptyConfig = {
    posted: { icon: '📝', title: 'No tasks posted yet', desc: 'Start with a clear brief so the right freelancers can respond fast.', cta: 'Post Your First Task', to: '/post' },
    bids: { icon: '🛠️', title: 'No bids placed yet', desc: 'Explore open tasks and start applying to projects that match your skills.', cta: 'Browse Tasks', to: '/browse' },
    assigned: { icon: '✅', title: 'No assigned tasks', desc: 'Once you are selected for a task after bidding, it will appear here.', cta: 'Browse Tasks', to: '/browse' },
  };
  const ec = emptyConfig[activeTab];

  const renderTransactionHistory = () => {
    if (!canBid) return null;

    return (
      <section className="rounded-[1.75rem] border border-white/10 bg-base-100/80 p-6 shadow-[0_18px_50px_rgba(2,8,23,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="badge badge-outline mb-3">Freelancer earnings</div>
            <h2 className="text-2xl font-bold tracking-tight">Transaction History</h2>
            <p className="mt-2 max-w-2xl text-sm text-base-content/65">
              Review your paid payouts, pending transfers, and task-by-task earnings using the existing payout records already stored in TaskMarket.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-success/20 bg-success/5 p-5">
            <div className="text-sm text-base-content/60">Total paid earnings</div>
            <div className="mt-2 text-3xl font-bold text-success">{formatCurrency(payoutSummary.totalPaid)}</div>
            <div className="mt-1 text-xs text-base-content/55">{payoutSummary.paidCount} completed payout{payoutSummary.paidCount === 1 ? '' : 's'}</div>
          </div>
          <div className="rounded-3xl border border-warning/20 bg-warning/5 p-5">
            <div className="text-sm text-base-content/60">Pending payouts</div>
            <div className="mt-2 text-3xl font-bold text-warning">{formatCurrency(payoutSummary.pendingAmount)}</div>
            <div className="mt-1 text-xs text-base-content/55">{payoutSummary.pendingCount} request{payoutSummary.pendingCount === 1 ? '' : 's'} under review</div>
          </div>
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
            <div className="text-sm text-base-content/60">Total payout records</div>
            <div className="mt-2 text-3xl font-bold text-primary">{payoutSummary.count}</div>
            <div className="mt-1 text-xs text-base-content/55">History from manual payout records</div>
          </div>
        </div>

        {payoutLoading ? (
          <div className="mt-6 rounded-3xl border border-base-300 bg-base-200/25 p-6 text-center text-sm text-base-content/65">Loading payout history...</div>
        ) : payoutRequests.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-base-300 bg-base-200/25 p-10 text-center">
            <div className="text-4xl">🧾</div>
            <h3 className="mt-4 text-xl font-semibold">No payout history yet</h3>
            <p className="mt-2 text-sm text-base-content/65">When your completed tasks move into payout review, the transaction details will appear here.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {payoutRequests.map((request) => {
              const status = normalizeStatus(request.status);
              const destination = getMaskedPayoutDestinationSummary(request);
              const paidAt = request.paidAt || request.processedAt || request.approvedAt;
              const badgeClass = status === 'paid'
                ? 'badge-success'
                : ['rejected', 'failed'].includes(status)
                  ? 'badge-error'
                  : 'badge-warning';
              const transferDetails = request.transferDetailsMasked || request.transferDetails || {};

              return (
                <div key={request.id} className="rounded-3xl border border-white/10 bg-base-100/70 p-5 shadow-[0_18px_50px_rgba(2,8,23,0.08)]">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-xl font-semibold">{request.taskTitle || 'Untitled task'}</h3>
                        <span className={`badge ${badgeClass}`}>{status || 'pending'}</span>
                        {request.payoutMethod ? <span className="badge badge-outline">Method: {request.payoutMethod}</span> : null}
                      </div>
                      <div className="mt-2 text-sm text-base-content/65">
                        Client: <span className="font-medium text-base-content">{request.clientName || '—'}</span>
                      </div>
                      <div className="mt-1 text-xs text-base-content/50">Task ID: {request.taskId || '—'}</div>
                    </div>
                    <div className="grid min-w-0 gap-2 rounded-2xl border border-base-300 bg-base-200/30 p-4 sm:grid-cols-2 xl:min-w-[340px]">
                      <div>
                        <div className="text-xs text-base-content/55">Accepted amount</div>
                        <div className="font-semibold">{formatCurrency(request.acceptedAmount || 0)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-base-content/55">Freelancer fee</div>
                        <div className="font-semibold">{formatCurrency(request.freelancerFeeAmount || 0)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-base-content/55">Final payout</div>
                        <div className="font-bold text-success">{formatCurrency(request.amount || 0)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-base-content/55">Destination</div>
                        <div className="font-medium">{destination || '—'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-base-300 bg-base-200/20 p-4">
                      <div className="font-semibold">Timeline</div>
                      <div className="mt-3 space-y-2 text-sm text-base-content/70">
                        <div>Submitted: <span className="font-medium text-base-content">{formatFirestoreDate(request.submittedAt || request.createdAt)}</span></div>
                        <div>Approved: <span className="font-medium text-base-content">{formatFirestoreDate(request.approvedAt)}</span></div>
                        <div>Processed: <span className="font-medium text-base-content">{formatFirestoreDate(request.processedAt)}</span></div>
                        <div>Paid: <span className="font-medium text-base-content">{formatFirestoreDate(paidAt)}</span></div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-base-300 bg-base-200/20 p-4">
                      <div className="font-semibold">Transfer summary</div>
                      <div className="mt-3 space-y-2 text-sm text-base-content/70">
                        <div>Status: <span className="font-medium text-base-content">{status || 'pending'}</span></div>
                        <div>Method: <span className="font-medium text-base-content">{transferDetails.paymentMethodType || request.payoutMethod || '—'}</span></div>
                        <div>Provider: <span className="font-medium text-base-content">{transferDetails.paymentProvider || '—'}</span></div>
                        <div>Transaction ID: <span className="font-medium text-base-content">{transferDetails.transactionId || '—'}</span></div>
                        <div>Paid By: <span className="font-medium text-base-content">{transferDetails.payerDisplayName || '—'}</span></div>
                        <div>Sent to: <span className="font-medium text-base-content">{destination || '—'}</span></div>
                        {transferDetails.optionalNote ? <div>Note: <span className="font-medium text-base-content">{transferDetails.optionalNote}</span></div> : null}
                        {request.rejectionReason ? <div className="text-error">Rejection reason: {request.rejectionReason}</div> : null}
                        {request.failureReason ? <div className="text-error">Failure reason: {request.failureReason}</div> : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  if (loading) return <LoadingSpinner label="Loading your dashboard..." />;

  return (
    <div className="mx-auto max-w-7xl animate-slide-in px-4 pb-2 pt-6 sm:px-6 sm:pb-3 sm:pt-8 lg:px-8">
      {error && <div className="alert alert-error mb-6 rounded-2xl"><span>{error}</span></div>}

      {expiredTasksNeedingAction.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-4">
          <span className="shrink-0 text-xl">⏰</span>
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

      {receiptModal && (
        <ReceiptModal
          task={receiptModal.task}
          userRole={receiptModal.userRole}
          onClose={() => setReceiptModal(null)}
        />
      )}

      <section className="rounded-[12px] border border-white/8 bg-base-100 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="relative overflow-hidden border-b border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(102,126,234,0.32),transparent_30%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_24%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.9))] px-5 pb-8 pt-6 sm:px-8 sm:pt-8 lg:px-10">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:26px_26px]" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="avatar">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white/18 bg-slate-950/40 text-3xl font-semibold text-white shadow-[0_20px_60px_rgba(15,23,42,0.3)] sm:h-28 sm:w-28">
                  {user?.photoURL
                    ? <img src={user.photoURL} alt={user.displayName || 'User'} className="h-full w-full rounded-full object-cover object-center" style={{ aspectRatio: '1/1' }} />
                    : <span className="flex items-center justify-center leading-none" style={{ lineHeight: 1 }}>{(user?.displayName || user?.email || 'U').slice(0, 1).toUpperCase()}</span>}
                </div>
              </div>
              <div className="max-w-3xl text-white">
                <p className="mb-2 inline-flex rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-medium tracking-[0.2em] text-white/70">DASHBOARD</p>
                <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{user?.displayName || 'User'}</h1>
                <p className="mt-2 break-words text-sm text-white/75 [overflow-wrap:anywhere] sm:text-base">{user?.email}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium text-white ${rc.color}`}>{rc.badge}</span>
                </div>
              </div>
            </div>

            <div className="max-w-md rounded-[1.75rem] border border-white/12 bg-white/8 p-4 text-white backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                {role === ROLES.CLIENT ? 'Client Workspace' : role === ROLES.FREELANCER ? 'Freelancer Workspace' : 'Workspace Summary'}
              </p>
              <p className="mt-3 text-sm leading-7 text-white/82">{rc.desc}</p>
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

        <div className="space-y-6 bg-base-100 p-5 sm:p-8 lg:p-8">
          <section className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${statCards.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-5'}`}>
            {statCards.map((card) => (
              <div key={card.label} className="rounded-[1.75rem] border border-white/8 bg-base-200/42 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
                <div className="min-w-0 text-sm font-medium leading-6 text-base-content/62">{card.label}</div>
                <div className={`mt-3 text-4xl font-bold tracking-tight ${card.tone}`}>{card.value}</div>
                <div className="mt-3 text-xs uppercase tracking-[0.18em] text-base-content/45">{card.helper}</div>
              </div>
            ))}
          </section>

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

          {visibleTasks.length === 0 ? (
            <section className="rounded-[1.75rem] border border-dashed border-base-300 bg-[linear-gradient(180deg,rgba(102,126,234,0.06),transparent)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-10">
              <div className="flex min-h-[16rem] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/12 text-3xl">{ec.icon}</div>
                <h2 className="text-2xl font-semibold">{ec.title}</h2>
                <p className="mt-3 max-w-md text-sm leading-7 text-base-content/65 sm:text-base">{ec.desc}</p>
                <Link to={ec.to} className="btn btn-primary mt-6 rounded-full px-6 text-white shadow-[0_14px_30px_rgba(102,126,234,0.3)]">
                  {ec.cta}
                </Link>
              </div>
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(24rem,0.95fr)_minmax(0,1.05fr)] xl:items-stretch">
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
                                  ? (task.paymentStatus === 'paid' || task.paymentStatus === 'released' ? 'Order Active' : 'Awaiting Payment')
                                  : 'Pending'}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-base-content/60">
                            <span className="rounded-full border border-base-300 bg-base-100 px-3 py-1 capitalize">{task.status || 'open'}</span>
                            <span className="rounded-full border border-base-300 bg-base-100 px-3 py-1">{task.bids?.length || 0} bids</span>
                            {getAssignedFreelancerName(task) ? <span className="max-w-full rounded-full border border-base-300 bg-base-100 px-3 py-1 [overflow-wrap:anywhere]">Assigned: {getAssignedFreelancerName(task)}</span> : null}
                          </div>
                          {(() => {
                            const hasPaid = ['escrow_held', 'paid', 'released', 'refunded'].includes(task.paymentStatus);
                            const isRefunded = String(task.refundStatus || '').toLowerCase() === 'refunded';
                            const isThisFreelancer = isTaskAssignedToUser(task);
                            const isThisClient = isTaskClientOwnedByUser(task);
                            const showForClient = isThisClient && hasPaid;
                            const showForFreelancer = isThisFreelancer && (hasPaid || isRefunded);
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

                          {task.status === 'completed' && (() => {
                            const isClientReviewing = isTaskClientOwnedByUser(task);
                            const targetId = isClientReviewing ? getAssignedFreelancerId(task) : task.postedById;
                            const targetName = isClientReviewing ? (getAssignedFreelancerName(task) || 'Freelancer') : (task.postedByName || task.clientName || 'Client');
                            const targetRole = isClientReviewing ? 'freelancer' : 'client';
                            if (!targetId) return null;
                            if (reviewedTasks[task.id]) {
                              return (
                                <div className="flex items-center gap-1.5 text-xs font-medium text-success">
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
                        <TaskWorkflowPanel
                          task={selectedTask}
                          mode={isTaskClientOwnedByUser(selectedTask) ? 'client' : isTaskAssignedToUser(selectedTask) ? 'assigned' : 'readonly'}
                        />
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {renderTransactionHistory()}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
