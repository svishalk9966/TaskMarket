import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatFirestoreDate } from '../firebase';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { formatCurrency } from '../config';
import { getMaskedPayoutDestinationSummary, subscribeToFreelancerPayoutRequests } from '../lib/payouts';

const normalizeStatus = (value = '') => String(value || '').trim().toLowerCase();

const Earnings = () => {
  const { user } = useAuth();
  const { canBid } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payoutRequests, setPayoutRequests] = useState([]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsubscribe = subscribeToFreelancerPayoutRequests(user.uid, (items) => {
      setPayoutRequests(items);
      setLoading(false);
      setError('');
    }, (snapshotError) => {
      console.error('Failed to load earnings history:', snapshotError);
      setError('Unable to load your earnings history right now.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const summary = useMemo(() => payoutRequests.reduce((acc, request) => {
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

  if (loading) return <LoadingSpinner label="Loading your earnings..." />;

  if (!canBid) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-base-300 bg-base-100 p-8 text-center shadow-sm">
          <div className="text-4xl">💼</div>
          <h1 className="mt-4 text-2xl font-bold">Earnings are available for freelancer accounts</h1>
          <p className="mt-2 text-base-content/65">Switch to a freelancer-enabled role to view payout history and completed earnings.</p>
          <div className="mt-6">
            <Link to="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-6 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      {error ? <div className="alert alert-error mb-6 rounded-2xl"><span>{error}</span></div> : null}

      <div className="rounded-[2rem] border border-white/10 bg-base-100/80 p-6 shadow-[0_24px_80px_rgba(2,8,23,0.12)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="badge badge-outline mb-3">Freelancer earnings</div>
            <h1 className="text-3xl font-bold tracking-tight">Transaction History</h1>
            <p className="mt-2 max-w-2xl text-sm text-base-content/65">
              Review your paid payouts, pending transfers, and task-by-task earnings using the existing payout records already stored in TaskMarket.
            </p>
          </div>
          <Link to="/dashboard" className="btn btn-ghost rounded-2xl">Back to Dashboard</Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-success/20 bg-success/5 p-5">
            <div className="text-sm text-base-content/60">Total paid earnings</div>
            <div className="mt-2 text-3xl font-bold text-success">{formatCurrency(summary.totalPaid)}</div>
            <div className="mt-1 text-xs text-base-content/55">{summary.paidCount} completed payout{summary.paidCount === 1 ? '' : 's'}</div>
          </div>
          <div className="rounded-3xl border border-warning/20 bg-warning/5 p-5">
            <div className="text-sm text-base-content/60">Pending payouts</div>
            <div className="mt-2 text-3xl font-bold text-warning">{formatCurrency(summary.pendingAmount)}</div>
            <div className="mt-1 text-xs text-base-content/55">{summary.pendingCount} request{summary.pendingCount === 1 ? '' : 's'} under review</div>
          </div>
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
            <div className="text-sm text-base-content/60">Total payout records</div>
            <div className="mt-2 text-3xl font-bold text-primary">{summary.count}</div>
            <div className="mt-1 text-xs text-base-content/55">History from manual payout records</div>
          </div>
        </div>

        {payoutRequests.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-base-300 bg-base-200/25 p-10 text-center">
            <div className="text-4xl">🧾</div>
            <h2 className="mt-4 text-xl font-semibold">No payout history yet</h2>
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

              return (
                <div key={request.id} className="rounded-3xl border border-white/10 bg-base-100/70 p-5 shadow-[0_18px_50px_rgba(2,8,23,0.08)]">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-semibold">{request.taskTitle || 'Untitled task'}</h2>
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
                        <div>Method: <span className="font-medium text-base-content">{request.payoutMethod || '—'}</span></div>
                        <div>Sent to: <span className="font-medium text-base-content">{destination || '—'}</span></div>
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
      </div>
    </div>
  );
};

export default Earnings;
