import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, where,
} from 'firebase/firestore';
import { db, formatFirestoreDate } from '../../firebase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { markTaskAsExpired } from '../../lib/workflow';
import { formatCurrency } from '../../config';

const MS_PER_DAY = 86_400_000;
const REPOST_WINDOW_DAYS = 1;

const daysAgo = (ts) => {
  if (!ts) return 0;
  const ms = typeof ts === 'object' && ts.seconds ? ts.seconds * 1000 : Number(ts);
  return Math.floor((Date.now() - ms) / MS_PER_DAY);
};

const OwnerExpiredTasks = () => {
  const [tasks, setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]  = useState('');
  const [toast, setToast]    = useState(null);

  useEffect(() => {
    // Watch open tasks and expired tasks
    const q = query(collection(db, 'tasks'), where('status', 'in', ['open', 'expired']));
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // Auto-expire candidates: open tasks with no bids, older than 7 days
  const autoExpireCandidates = useMemo(() => tasks.filter((t) => {
    if (t.status !== 'open') return false;
    const bids = Array.isArray(t.bids) ? t.bids : [];
    if (bids.length > 0) return false;
    const age = daysAgo(t.createdAt?.seconds ? t.createdAt : t.clientCreatedAt);
    return age >= 7;
  }), [tasks]);

  // Expired tasks: those already marked expired
  const expiredTasks = useMemo(() => tasks.filter((t) => t.status === 'expired'), [tasks]);

  // Auto-delete candidates: expired tasks older than REPOST_WINDOW_DAYS since expiredAt
  const autoDeleteCandidates = useMemo(() => expiredTasks.filter((t) => {
    const expiredMs = t.expiredAt?.seconds ? t.expiredAt.seconds * 1000 : Number(t.expiredAt || 0);
    if (!expiredMs) return false;
    return (Date.now() - expiredMs) >= REPOST_WINDOW_DAYS * MS_PER_DAY;
  }), [expiredTasks]);

  const handleMarkExpired = async (task) => {
    setBusyId(`expire-${task.id}`);
    try {
      await markTaskAsExpired(task.id);
      showToast('success', `Task "${task.title}" marked as expired.`);
    } catch (err) {
      showToast('error', err.message || 'Failed to mark task as expired.');
    } finally {
      setBusyId('');
    }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`Permanently delete task "${task.title}"? This cannot be undone.`)) return;
    setBusyId(`delete-${task.id}`);
    try {
      await deleteDoc(doc(db, 'tasks', task.id));
      showToast('success', `Task "${task.title}" deleted.`);
    } catch (err) {
      showToast('error', err.message || 'Failed to delete task.');
    } finally {
      setBusyId('');
    }
  };

  const handleBulkDelete = async () => {
    if (!autoDeleteCandidates.length) return;
    if (!window.confirm(`Delete ${autoDeleteCandidates.length} expired task(s) that have not been reposted within ${REPOST_WINDOW_DAYS} day(s)? This cannot be undone.`)) return;
    setBusyId('bulk-delete');
    try {
      await Promise.all(autoDeleteCandidates.map((t) => deleteDoc(doc(db, 'tasks', t.id))));
      showToast('success', `${autoDeleteCandidates.length} task(s) deleted.`);
    } catch (err) {
      showToast('error', err.message || 'Bulk delete failed.');
    } finally {
      setBusyId('');
    }
  };

  if (loading) return <LoadingSpinner label="Loading expired tasks..." />;

  const TaskCard = ({ task, actions }) => {
    const age = daysAgo(task.createdAt?.seconds ? task.createdAt : task.clientCreatedAt);
    const expiredAge = task.expiredAt ? daysAgo(task.expiredAt) : null;
    return (
      <div className="overflow-hidden rounded-[1.5rem] border border-base-200 bg-base-100 p-5 space-y-3 hover:border-primary/20 hover:shadow-[0_8px_24px_rgba(102,126,234,0.08)] transition-all">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-sm break-words">{task.title || 'Untitled task'}</span>
              <span className={`badge badge-sm ${task.status === 'expired' ? 'badge-error' : 'badge-warning'}`}>{task.status}</span>
            </div>
            <div className="text-xs text-base-content/45">
              Posted by: {task.postedByName || task.postedBy || '—'} · {age} day(s) old
              {expiredAge !== null ? ` · Expired ${expiredAge} day(s) ago` : ''}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-base font-bold text-primary">{formatCurrency(task.budget || task.amount || 0)}</div>
            <div className="text-xs text-base-content/45">{(task.bids || []).length} bids</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[400] flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl text-sm font-medium transition-all ${
          toast.type === 'success' ? 'border-success/25 bg-success/15 text-success' : 'border-error/25 bg-error/15 text-error'
        }`}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-base-content sm:text-3xl">Expired Task Cleanup</h1>
        <p className="mt-1 text-sm text-base-content/55">
          Manage tasks that have expired (no freelancer selected). Clients have {REPOST_WINDOW_DAYS} day(s) to repost before auto-deletion.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: 'Expire candidates', value: autoExpireCandidates.length, color: 'text-warning',  icon: '⏰' },
          { label: 'Already expired',   value: expiredTasks.length,          color: 'text-error',   icon: '🗂️' },
          { label: 'Ready to delete',   value: autoDeleteCandidates.length,  color: 'text-error',   icon: '🗑️' },
        ].map((s) => (
          <div key={s.label} className="rounded-[1.5rem] border border-base-200 bg-base-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-base-content/45">{s.label}</span>
              <span className="text-lg">{s.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Section 1: Auto-expire candidates */}
      <div>
        <h2 className="text-lg font-bold mb-3">Open tasks with no bids (7+ days old)</h2>
        <p className="text-sm text-base-content/55 mb-4">These tasks have been open for 7+ days with no bids. Mark them expired so clients can repost.</p>
        {autoExpireCandidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-base-300 py-10 text-center">
            <div className="mb-2 text-3xl">✅</div>
            <p className="text-sm font-medium text-base-content/55">No tasks need expiring right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {autoExpireCandidates.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                actions={
                  <button
                    type="button"
                    className="btn btn-warning btn-sm"
                    disabled={Boolean(busyId)}
                    onClick={() => handleMarkExpired(task)}
                  >
                    {busyId === `expire-${task.id}` ? 'Marking...' : '⏰ Mark as expired'}
                  </button>
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Expired tasks pending client repost */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-lg font-bold">Expired tasks — awaiting client repost</h2>
          {autoDeleteCandidates.length > 0 && (
            <button
              type="button"
              className="btn btn-error btn-sm"
              disabled={busyId === 'bulk-delete'}
              onClick={handleBulkDelete}
            >
              {busyId === 'bulk-delete' ? 'Deleting...' : `🗑️ Delete ${autoDeleteCandidates.length} overdue task(s)`}
            </button>
          )}
        </div>
        <p className="text-sm text-base-content/55 mb-4">
          Clients have {REPOST_WINDOW_DAYS} day(s) to repost after expiry. Tasks past this window are marked for deletion below.
        </p>
        {expiredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-base-300 py-10 text-center">
            <div className="mb-2 text-3xl">🎉</div>
            <p className="text-sm font-medium text-base-content/55">No expired tasks right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {expiredTasks.map((task) => {
              const isOverdue = autoDeleteCandidates.some((t) => t.id === task.id);
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  actions={
                    <>
                      {isOverdue && (
                        <span className="badge badge-error badge-sm">Overdue — delete eligible</span>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline btn-error btn-sm"
                        disabled={Boolean(busyId)}
                        onClick={() => handleDeleteTask(task)}
                      >
                        {busyId === `delete-${task.id}` ? 'Deleting...' : '🗑️ Delete'}
                      </button>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerExpiredTasks;
