import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../../components/owner/StatCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatFirestoreDate } from '../../firebase';
import { fetchOwnerDashboardData } from '../../lib/ownerData';

const panelBase = 'rounded-[1.75rem] border border-base-300 bg-base-100/95 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] sm:p-5';
const itemBase = 'rounded-2xl border border-base-300/70 bg-base-200/55 p-3.5';

const OwnerDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setData(await fetchOwnerDashboardData());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Admin overview</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Owner Dashboard</h1>
          <p className="mt-2 text-base-content/60">Monitor platform activity, users, tasks, payments, and platform revenue from one place with a more structured admin workspace.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="min-w-0 rounded-2xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-base-content/50">Platform users</div>
            <div className="mt-2 text-2xl font-semibold text-primary">{data.stats.totalUsers}</div>
          </div>
          <div className="min-w-0 rounded-2xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-base-content/50">Open disputes</div>
            <div className="mt-2 text-2xl font-semibold text-error">{data.stats.openDisputes}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard label="Total Users" value={data.stats.totalUsers} />
        <StatCard label="Total Tasks" value={data.stats.totalTasks} accent="text-secondary" />
        <StatCard label="Pending Tasks" value={data.stats.pendingTasks} accent="text-warning" />
        <StatCard label="Completed Tasks" value={data.stats.completedTasks} accent="text-success" />
        <StatCard label="Total Payments" value={data.stats.totalPayments} />
        <StatCard label="Pending Payments" value={data.stats.pendingPayments} accent="text-warning" />
        <StatCard label="Successful Payments" value={data.stats.successfulPayments} accent="text-success" />
        <StatCard label="Platform Earnings" value={`₹${Number(data.stats.totalPlatformEarnings || 0).toLocaleString()}`} accent="text-primary" />
        <StatCard label="Open Disputes" value={data.stats.openDisputes} accent="text-error" />
        <StatCard label="Ready For Release" value={data.stats.readyForRelease} accent="text-info" />
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <section className={panelBase}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">Recent Registrations</h2>
              <p className="mt-1 text-sm text-base-content/60">Latest users who joined the platform.</p>
            </div>
            <Link to="/owner/users" className="link link-primary whitespace-nowrap">View all</Link>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {data.recentUsers.map((user) => (
              <div key={user.id} className={itemBase}>
                <div className="font-semibold break-words">{user.name || 'User'}</div>
                <div className="mt-1 text-sm text-base-content/60 break-all">{user.email}</div>
                <div className="mt-2 text-xs text-base-content/50">Joined {formatFirestoreDate(user.createdAt)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={panelBase}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">Recent Posted Tasks</h2>
              <p className="mt-1 text-sm text-base-content/60">Newest task listings across the marketplace.</p>
            </div>
            <Link to="/owner/tasks" className="link link-primary whitespace-nowrap">View all</Link>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {data.recentTasks.map((task) => (
              <div key={task.id} className={itemBase}>
                <div className="font-semibold break-words">{task.title}</div>
                <div className="mt-1 text-sm text-base-content/60 break-all">{task.postedBy || task.userEmail || '—'}</div>
                <div className="mt-2 text-xs text-base-content/50">₹{Number(task.budget || 0).toLocaleString()} • {task.status || 'open'}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={panelBase}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">Recent Payments</h2>
              <p className="mt-1 text-sm text-base-content/60">Latest payment and payout activity.</p>
            </div>
            <Link to="/owner/payments" className="link link-primary whitespace-nowrap">View all</Link>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {data.recentPayments.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-base-300 p-6 text-base-content/60">No payments recorded yet.</p>
            ) : data.recentPayments.map((payment) => (
              <div key={payment.id} className={itemBase}>
                <div className="font-semibold break-all">{payment.userEmail || 'Unknown user'}</div>
                <div className="mt-1 text-sm text-base-content/60">₹{Number(payment.acceptedAmount || payment.grossAmount || payment.amount || 0).toLocaleString()} • {payment.paymentStatus || payment.status || 'pending'}</div>
                <div className="mt-2 text-xs text-base-content/50">Payout {payment.payoutStatus || 'pending'} • {formatFirestoreDate(payment.paymentDate)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={panelBase}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">Recent Disputes</h2>
              <p className="mt-1 text-sm text-base-content/60">Most recent escalation records needing review.</p>
            </div>
            <Link to="/owner/disputes" className="link link-primary whitespace-nowrap">View all</Link>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {data.recentDisputes.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-base-300 p-6 text-base-content/60">No disputes opened yet.</p>
            ) : data.recentDisputes.map((dispute) => (
              <div key={dispute.id} className={itemBase}>
                <div className="font-semibold break-words">{dispute.taskTitle || dispute.taskId}</div>
                <div className="mt-1 text-sm text-base-content/60">{dispute.status || 'open'}</div>
                <div className="mt-2 text-xs text-base-content/50">{formatFirestoreDate(dispute.createdAt)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default OwnerDashboard;
