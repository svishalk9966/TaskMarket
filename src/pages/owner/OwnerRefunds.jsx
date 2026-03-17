import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, onSnapshot, orderBy, query,
} from 'firebase/firestore';
import { db, formatFirestoreDate } from '../../firebase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { approveRefundRequest, rejectRefundRequest } from '../../lib/workflow';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../config';

const statusBadge = (status = '') => {
  const s = String(status).toLowerCase();
  if (s === 'approved') return 'badge-success';
  if (s === 'rejected') return 'badge-error';
  return 'badge-warning';
};

const OwnerRefunds = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busyId, setBusyId]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [rejectModal, setRejectModal] = useState(null); // { request }
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast]       = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'refundRequests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const visible = useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter((r) => String(r.status || '').toLowerCase() === filter);
  }, [requests, filter]);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleApprove = async (request) => {
    setBusyId(`approve-${request.id}`);
    try {
      await approveRefundRequest({ refundRequest: request, adminUser: user });
      showToast('success', `Refund approved for "${request.taskTitle}".`);
    } catch (err) {
      showToast('error', err.message || 'Failed to approve refund.');
    } finally {
      setBusyId('');
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal) return;
    setBusyId(`reject-${rejectModal.id}`);
    try {
      await rejectRefundRequest({ refundRequest: rejectModal, adminUser: user, rejectReason });
      showToast('success', `Refund request rejected for "${rejectModal.taskTitle}".`);
      setRejectModal(null);
      setRejectReason('');
    } catch (err) {
      showToast('error', err.message || 'Failed to reject refund.');
    } finally {
      setBusyId('');
    }
  };

  const counts = useMemo(() => ({
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  }), [requests]);

  if (loading) return <LoadingSpinner label="Loading refund requests..." />;

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

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-base-200 bg-base-100 p-6 shadow-2xl">
            <h3 className="text-lg font-bold">Reject refund request</h3>
            <p className="mt-1 text-sm text-base-content/60">Task: <span className="font-medium">{rejectModal.taskTitle}</span></p>
            <p className="mt-1 text-sm text-base-content/60">Client reason: <span className="italic">{rejectModal.reason}</span></p>
            <div className="mt-4">
              <label className="label"><span className="label-text font-medium">Rejection reason (optional)</span></label>
              <textarea
                className="textarea textarea-bordered h-24 w-full"
                placeholder="Let the client know why the refund was not approved..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                className="btn btn-error flex-1"
                disabled={Boolean(busyId)}
                onClick={handleRejectSubmit}
              >
                {busyId ? 'Rejecting...' : 'Reject request'}
              </button>
              <button
                type="button"
                className="btn btn-outline flex-1"
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-base-content sm:text-3xl">Refund Requests</h1>
        <p className="mt-1 text-sm text-base-content/55">Review and action client refund requests. Approving notifies the client, admin, and freelancer.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total',    value: counts.all,      color: 'text-primary',         icon: '📋' },
          { label: 'Pending',  value: counts.pending,  color: 'text-warning',         icon: '⏳' },
          { label: 'Approved', value: counts.approved, color: 'text-success',         icon: '✅' },
          { label: 'Rejected', value: counts.rejected, color: 'text-error',           icon: '❌' },
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

      {/* Filter tabs */}
      <div className="flex rounded-2xl border border-base-300 bg-base-200/50 p-1 w-fit">
        {[
          { id: 'all',      label: 'All',      count: counts.all },
          { id: 'pending',  label: 'Pending',  count: counts.pending },
          { id: 'approved', label: 'Approved', count: counts.approved },
          { id: 'rejected', label: 'Rejected', count: counts.rejected },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              filter === tab.id ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/55 hover:text-base-content'
            }`}
          >
            {tab.label}
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${filter === tab.id ? 'bg-primary/15 text-primary' : 'bg-base-300 text-base-content/50'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Request cards */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-base-300 py-16 text-center">
          <div className="mb-3 text-4xl">💸</div>
          <p className="font-semibold text-base-content/60">No refund requests found.</p>
          <p className="mt-1 text-sm text-base-content/40">Requests will appear here when clients submit them.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((req) => {
            const isPending = req.status === 'pending';
            return (
              <div key={req.id} className={`overflow-hidden rounded-[1.5rem] border transition-all ${
                req.status === 'approved' ? 'border-success/20 bg-success/5'
                : req.status === 'rejected' ? 'border-error/20 bg-error/5'
                : 'border-base-200 bg-base-100 hover:border-primary/20 hover:shadow-[0_8px_24px_rgba(102,126,234,0.1)]'
              }`}>
                <div className="p-5 space-y-4">
                  {/* Header row */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{req.taskTitle || req.taskId || 'Task'}</span>
                        <span className={`badge badge-sm ${statusBadge(req.status)}`}>{req.status || 'pending'}</span>
                      </div>
                      <div className="text-xs text-base-content/45">
                        Task ID: <span className="font-mono">{req.taskId?.slice(0, 12)}…</span> · {formatFirestoreDate(req.createdAt)}
                      </div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <div className="text-lg font-bold text-primary">{formatCurrency(req.refundAmount || req.amount || 0)}</div>
                      <div className="text-xs text-success">Refund to client</div>
                      {req.refundFeeAmount > 0 && (
                        <div className="text-xs text-error">Fee: − {formatCurrency(req.refundFeeAmount)} ({req.refundFeePercent || 0}%)</div>
                      )}
                      <div className="text-xs text-base-content/45">Paid: {formatCurrency(req.amount || 0)}</div>
                    </div>
                  </div>

                  {/* People */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-base-200 bg-base-200/50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-base-content/45 mb-1">Client</p>
                      <p className="text-sm font-medium">{req.clientName || '—'}</p>
                      <p className="text-xs text-base-content/55 break-all">{req.clientEmail || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-base-200 bg-base-200/50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-base-content/45 mb-1">Freelancer</p>
                      <p className="text-sm font-medium">{req.freelancerName || '—'}</p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="rounded-xl border border-base-200 bg-base-200/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-base-content/45 mb-1">Client reason</p>
                    <p className="text-sm text-base-content/80 whitespace-pre-wrap">{req.reason || '—'}</p>
                  </div>

                  {req.rejectReason ? (
                    <div className="rounded-xl border border-error/20 bg-error/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-error/60 mb-1">Rejection note</p>
                      <p className="text-sm text-base-content/80">{req.rejectReason}</p>
                    </div>
                  ) : null}

                  {/* Actions */}
                  {isPending ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        disabled={Boolean(busyId)}
                        onClick={() => handleApprove(req)}
                      >
                        {busyId === `approve-${req.id}` ? 'Approving...' : '✅ Approve refund'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-error btn-sm"
                        disabled={Boolean(busyId)}
                        onClick={() => setRejectModal(req)}
                      >
                        ❌ Reject request
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-base-content/45">
                      {req.status === 'approved' ? `Approved on ${formatFirestoreDate(req.approvedAt)}` : `Rejected on ${formatFirestoreDate(req.rejectedAt)}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OwnerRefunds;
