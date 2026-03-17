import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, formatFirestoreDate } from '../../firebase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { resolveDisputeRecord } from '../../lib/marketplace';

const statusTone = (status = '') => {
  const value = String(status).toLowerCase();
  if (['resolved_for_client', 'rejected'].includes(value)) return 'badge-error';
  if (['resolved_for_freelancer', 'closed'].includes(value)) return 'badge-success';
  return 'badge-warning';
};

const OwnerDisputes = () => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, 'disputes'), orderBy('createdAt', 'desc')), (snapshot) => {
      setDisputes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const visibleDisputes = useMemo(() => disputes.filter((item) => filter === 'all' || String(item.status || '').toLowerCase() === filter), [disputes, filter]);

  const handleResolution = async (dispute, status) => {
    const confirmed = window.confirm(`Mark this dispute as ${status.replace(/_/g, ' ')}?`);
    if (!confirmed) return;
    setBusyId(`${dispute.id}-${status}`);
    try {
      await resolveDisputeRecord(dispute, status);
    } finally {
      setBusyId('');
    }
  };

  if (loading) return <LoadingSpinner label="Loading disputes..." />;

  return (
    <div className="bg-base-100 rounded-box border border-base-200 shadow-sm p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dispute Management</h1>
          <p className="mt-2 text-base-content/60">Review open disputes before payout release or refund handling.</p>
        </div>
        <select className="select select-bordered w-full sm:w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="under_review">Under review</option>
          <option value="resolved_for_client">Resolved for client</option>
          <option value="resolved_for_freelancer">Resolved for freelancer</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {visibleDisputes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-base-300 p-6 text-base-content/60">No disputes found for this filter.</div>
        ) : visibleDisputes.map((dispute) => (
          <div key={dispute.id} className="rounded-xl border border-base-200 bg-base-200/50 p-4 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="font-semibold break-words">{dispute.taskTitle || dispute.taskId || 'Task dispute'}</div>
                <div className="mt-1 text-sm text-base-content/60">Task ID: <span className="inline-block max-w-full truncate align-bottom" title={dispute.taskId || '—'}>{dispute.taskId || '—'}</span></div>
                <div className="text-sm text-base-content/60">Payment ID: <span className="inline-block max-w-full truncate align-bottom" title={dispute.paymentId || '—'}>{dispute.paymentId || '—'}</span></div>
                {dispute.reason ? <p className="mt-3 text-sm text-base-content/80 whitespace-pre-wrap">{dispute.reason}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`badge ${statusTone(dispute.status)}`}>{dispute.status || 'open'}</span>
                <span className="badge badge-outline">{formatFirestoreDate(dispute.createdAt)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button className="btn btn-sm btn-outline" disabled={busyId === `${dispute.id}-under_review`} onClick={() => handleResolution(dispute, 'under_review')}>Mark Under Review</button>
              <button className="btn btn-sm btn-success" disabled={busyId === `${dispute.id}-resolved_for_freelancer`} onClick={() => handleResolution(dispute, 'resolved_for_freelancer')}>Resolve for Freelancer</button>
              <button className="btn btn-sm btn-error" disabled={busyId === `${dispute.id}-resolved_for_client`} onClick={() => handleResolution(dispute, 'resolved_for_client')}>Resolve for Client</button>
              <button className="btn btn-sm btn-outline" disabled={busyId === `${dispute.id}-closed`} onClick={() => handleResolution(dispute, 'closed')}>Close</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OwnerDisputes;
