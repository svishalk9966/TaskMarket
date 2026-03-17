import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/owner/StatCard';
import { db, formatFirestoreDate } from '../../firebase';
import { getTaskFeeBreakdown } from '../../lib/feeModel';

const statusOptions = ['open', 'awaiting_payment', 'in_progress', 'delivered', 'revision_requested', 'completed', 'disputed', 'refunded', 'closed', 'cancelled'];

const OwnerTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [workspaceEntries, setWorkspaceEntries] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const taskQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const deliveriesQuery = query(collection(db, 'deliveries'), orderBy('submittedAt', 'desc'));
    const workspaceQuery = query(collection(db, 'workspaceEntries'), orderBy('createdAt', 'desc'));
    const disputesQuery = query(collection(db, 'disputes'), orderBy('createdAt', 'desc'));

    const unsubTasks = onSnapshot(taskQuery, (snapshot) => {
      setTasks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
    });
    const unsubDeliveries = onSnapshot(deliveriesQuery, (snapshot) => setDeliveries(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))));
    const unsubWorkspace = onSnapshot(workspaceQuery, (snapshot) => setWorkspaceEntries(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))));
    const unsubDisputes = onSnapshot(disputesQuery, (snapshot) => setDisputes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))));

    return () => {
      unsubTasks();
      unsubDeliveries();
      unsubWorkspace();
      unsubDisputes();
    };
  }, []);

  const handleStatusChange = async (taskId, nextStatus) => {
    await updateDoc(doc(db, 'tasks', taskId), { status: nextStatus, clientUpdatedAt: Date.now(), updatedAt: Date.now() });
  };

  const handleDelete = async (taskId) => {
    const confirmed = window.confirm('Delete this task? This action cannot be undone.');
    if (!confirmed) return;
    await deleteDoc(doc(db, 'tasks', taskId));
  };

  const handleBlockTask = async (task) => {
    const isBlocked = Boolean(task.blocked);
    const label = isBlocked ? 'Unblock' : 'Block';
    const confirmed = window.confirm(`${label} task "${task.title || 'Untitled'}"?\n${isBlocked ? 'It will be visible again on Browse Tasks.' : 'It will be hidden from Browse Tasks and no new bids can be placed.'}`);
    if (!confirmed) return;
    await updateDoc(doc(db, 'tasks', task.id), {
      blocked: !isBlocked,
      blockedAt: !isBlocked ? Date.now() : null,
      updatedAt: Date.now(),
    });
  };

  const taskMetrics = useMemo(() => tasks.map((task) => {
    const latestDispute = disputes.find((item) => item.taskId === task.id);
    return {
      ...task,
      feeBreakdown: getTaskFeeBreakdown(task),
      deliveriesCount: deliveries.filter((item) => item.taskId === task.id).length,
      workspaceCount: workspaceEntries.filter((item) => item.taskId === task.id).length,
      disputeStatus: latestDispute?.status || task.disputeStatus || 'closed',
      disputeReason: latestDispute?.reason || task.disputeNote || '',
    };
  }), [tasks, deliveries, workspaceEntries, disputes]);

  if (loading) return <LoadingSpinner label="Loading owner task data..." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tasks" value={tasks.length} accent="text-primary" />
        <StatCard label="Deliveries" value={deliveries.length} accent="text-secondary" />
        <StatCard label="Workspace Entries" value={workspaceEntries.length} accent="text-accent" />
        <StatCard
          label="Open Disputes"
          value={taskMetrics.filter((task) => ['open', 'under_review'].includes(String(task.disputeStatus || '').toLowerCase())).length}
          accent="text-error"
        />
      </div>

      <div className="hidden overflow-x-auto rounded-box bg-base-100 p-4 shadow 2xl:block">
        <table className="table min-w-[1480px]">
          <thead>
            <tr>
              <th>Title</th>
              <th>Owner</th>
              <th>Assigned</th>
              <th>Accepted Amount</th>
              <th>Payment</th>
              <th>Escrow</th>
              <th>Payout</th>
              <th>Dispute</th>
              <th>Deliveries</th>
              <th>Workspace</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {taskMetrics.map((task) => (
              <tr key={task.id}>
                <td><div className="max-w-[220px] truncate font-medium" title={task.title || 'Untitled task'}>{task.title || 'Untitled task'}</div></td>
                <td><div className="max-w-[190px] truncate" title={task.postedBy || task.userEmail || '—'}>{task.postedBy || task.userEmail || '—'}</div></td>
                <td><div className="max-w-[180px] truncate" title={task.assignedFreelancerName || '—'}>{task.assignedFreelancerName || '—'}</div></td>
                <td>₹{Number(task.feeBreakdown.acceptedAmount || 0).toLocaleString()}</td>
                <td>
                  <div className="flex flex-col gap-2">
                    <span className="badge badge-outline whitespace-nowrap">{task.paymentStatus || 'unpaid'}</span>
                    {task.blocked && <span className="badge badge-warning whitespace-nowrap">Blocked</span>}
                    <select className="select select-bordered select-sm min-w-[170px]" value={task.status || 'open'} onChange={(e) => handleStatusChange(task.id, e.target.value)}>
                      {statusOptions.map((status) => (<option key={status} value={status}>{status.replace(/_/g, ' ')}</option>))}
                    </select>
                  </div>
                </td>
                <td><span className="badge badge-outline whitespace-nowrap">{task.escrowStatus || 'not_funded'}</span></td>
                <td><span className="badge badge-outline whitespace-nowrap">{task.payoutStatus || 'pending'}</span></td>
                <td>
                  <div className="max-w-[180px] space-y-1">
                    <span className={`badge ${['open', 'under_review'].includes(String(task.disputeStatus || '').toLowerCase()) ? 'badge-warning' : 'badge-outline'}`}>{task.disputeStatus}</span>
                    {task.disputeReason ? <div className="truncate text-xs text-base-content/60" title={task.disputeReason}>{task.disputeReason}</div> : null}
                  </div>
                </td>
                <td>{task.deliveriesCount}</td>
                <td>{task.workspaceCount}</td>
                <td>{formatFirestoreDate(task.createdAt)}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`btn btn-sm btn-outline ${task.blocked ? 'btn-success' : 'btn-warning'}`}
                      onClick={() => handleBlockTask(task)}
                    >
                      {task.blocked ? 'Unblock' : 'Block'}
                    </button>
                    <button className="btn btn-sm btn-outline btn-error" onClick={() => handleDelete(task.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:hidden">
        {taskMetrics.map((task) => (
          <div key={task.id} className="space-y-3 rounded-xl border border-base-200 bg-base-200 p-4">
            <div>
              <div className="text-sm text-base-content/60">Title</div>
              <div className="font-semibold break-words" title={task.title || 'Untitled task'}>{task.title || 'Untitled task'}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-base-content/60">Owner</div><div className="break-all" title={task.postedBy || task.userEmail || '—'}>{task.postedBy || task.userEmail || '—'}</div></div>
              <div><div className="text-base-content/60">Assigned</div><div className="break-words" title={task.assignedFreelancerName || '—'}>{task.assignedFreelancerName || '—'}</div></div>
              <div><div className="text-base-content/60">Accepted Amount</div><div>₹{Number(task.feeBreakdown.acceptedAmount || 0).toLocaleString()}</div></div>
              <div><div className="text-base-content/60">Deliveries</div><div>{task.deliveriesCount}</div></div>
              <div><div className="text-base-content/60">Workspace</div><div>{task.workspaceCount}</div></div>
              <div><div className="text-base-content/60">Created</div><div>{formatFirestoreDate(task.createdAt)}</div></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-outline">Payment: {task.paymentStatus || 'unpaid'}</span>
              <span className="badge badge-outline">Escrow: {task.escrowStatus || 'not_funded'}</span>
              <span className="badge badge-outline">Payout: {task.payoutStatus || 'pending'}</span>
              <span className={`badge ${['open', 'under_review'].includes(String(task.disputeStatus || '').toLowerCase()) ? 'badge-warning' : 'badge-outline'}`}>Dispute: {task.disputeStatus}</span>
            </div>
            {task.disputeReason ? <div className="text-sm text-base-content/70 break-words" title={task.disputeReason}>Reason: {task.disputeReason}</div> : null}
            <select className="select select-bordered w-full" value={task.status || 'open'} onChange={(e) => handleStatusChange(task.id, e.target.value)}>
              {statusOptions.map((status) => (<option key={status} value={status}>{status.replace(/_/g, ' ')}</option>))}
            </select>
            <div className="flex gap-2">
              <button
                className={`btn btn-outline flex-1 ${task.blocked ? 'btn-success' : 'btn-warning'}`}
                onClick={() => handleBlockTask(task)}
              >
                {task.blocked ? 'Unblock' : 'Block'}
              </button>
              <button className="btn btn-outline btn-error flex-1" onClick={() => handleDelete(task.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OwnerTasks;
