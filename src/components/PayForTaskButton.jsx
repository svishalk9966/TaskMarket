import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { launchTaskPayment, getTaskPaymentSummary } from '../lib/payment';
import { formatCurrency } from '../config';
import { isPaymentFunded } from '../lib/tasks';

const PayForTaskButton = ({ task, onSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const { totalPaidByClient } = getTaskPaymentSummary(task);

  // ── Already paid check ────────────────────────────────────────────────────
  const paymentDone = isPaymentFunded(task.paymentStatus) || String(task.paymentStatus || '').toLowerCase() === 'refunded';

  if (paymentDone) {
    return (
      <div className="space-y-2">
        <div className="flex w-full items-center justify-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Payment Done — {formatCurrency(totalPaidByClient)}
        </div>
        <p className="text-center text-xs text-base-content/45">
          Funds are held securely in escrow
        </p>
      </div>
    );
  }

  // ── Normal pay flow ───────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!user) {
      setMessage('Please login first to make a payment.');
      return;
    }
    try {
      setLoading(true);
      setMessage('');
      const result = await launchTaskPayment({ task, user });
      setMessage(result.summary || 'Payment completed successfully.');
      onSuccess?.(result);
    } catch (error) {
      setMessage(error.message || 'Payment failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        className={`btn btn-secondary w-full rounded-full ${loading ? 'loading' : ''}`}
        onClick={handlePay}
        disabled={loading}
      >
        {loading ? 'Processing...' : `Pay ${formatCurrency(totalPaidByClient)}`}
      </button>
      {message && <p className="text-sm text-base-content/70">{message}</p>}
    </div>
  );
};

export default PayForTaskButton;
