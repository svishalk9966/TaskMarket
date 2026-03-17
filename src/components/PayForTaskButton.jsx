import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { launchTaskPayment, getTaskPaymentSummary } from '../lib/payment';
import { formatCurrency } from '../config';

const PayForTaskButton = ({ task, onSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const { totalPaidByClient } = getTaskPaymentSummary(task);

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
      <button type="button" className={`btn btn-secondary w-full rounded-full ${loading ? 'loading' : ''}`} onClick={handlePay} disabled={loading}>
        {loading ? 'Processing...' : `Pay ${formatCurrency(totalPaidByClient)}`}
      </button>
      {message && <p className="text-sm text-base-content/70">{message}</p>}
    </div>
  );
};

export default PayForTaskButton;
