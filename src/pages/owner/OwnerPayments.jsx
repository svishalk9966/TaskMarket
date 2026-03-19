import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, formatFirestoreDate } from '../../firebase';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/owner/StatCard';
import { useAuth } from '../../contexts/AuthContext';
import {
  getDisputeCounts,
  getOwnerPaymentCounts,
  getPaymentPresentation,
  markRefundForPayment,
} from '../../lib/marketplace';
import {
  approveAndProcessPayout,
  PAYOUT_STATUSES,
  rejectPayoutRequest,
  subscribeToAllPayoutRequests,
} from '../../lib/payouts';

const getPaymentStatusTone = (statusValue = '') => {
  const status = String(statusValue).toLowerCase();
  if (['success', 'paid', 'released', 'completed', 'escrow_held'].includes(status)) return 'badge-success';
  if (['failed', 'cancelled', 'canceled', 'refunded', 'refund_pending'].includes(status)) return 'badge-error';
  if (['disputed'].includes(status)) return 'badge-warning';
  return 'badge-warning';
};

const getPayoutStatusTone = (statusValue = '') => {
  const status = String(statusValue).toLowerCase();
  if ([PAYOUT_STATUSES.PAID].includes(status)) return 'badge-success';
  if ([PAYOUT_STATUSES.FAILED, PAYOUT_STATUSES.REJECTED].includes(status)) return 'badge-error';
  if ([PAYOUT_STATUSES.DETAILS_SUBMITTED, PAYOUT_STATUSES.UNDER_REVIEW, PAYOUT_STATUSES.APPROVED, PAYOUT_STATUSES.PROCESSING].includes(status)) return 'badge-warning';
  return 'badge-outline';
};

const normalizePaymentRecord = (payment = {}, disputeMap = {}) => {
  const presentation = getPaymentPresentation({
    ...payment,
    disputeStatus: payment.disputeStatus || disputeMap[payment.taskId] || payment.disputeStatus,
  });

  return {
    ...payment,
    ...presentation,
    displayStatus: presentation.paymentStatus,
  };
};

const OwnerPayments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [transferForms, setTransferForms] = useState({});

  useEffect(() => {
    let latestPayments = [];
    let latestDisputes = [];
    let latestPayouts = [];

    const sync = () => {
      const disputeMap = latestDisputes.reduce((acc, dispute) => {
        if (dispute.taskId && (!acc[dispute.taskId] || ['open', 'under_review'].includes(String(dispute.status || '').toLowerCase()))) {
          acc[dispute.taskId] = dispute.status || 'open';
        }
        return acc;
      }, {});
      setPayments(latestPayments.map((item) => normalizePaymentRecord(item, disputeMap)));
      setDisputes(latestDisputes);
      setPayoutRequests(latestPayouts);
      setLoading(false);
    };

    const paymentsQ = query(collection(db, 'payments'), orderBy('paymentDate', 'desc'));
    const disputesQ = query(collection(db, 'disputes'), orderBy('createdAt', 'desc'));

    const unsubPayments = onSnapshot(paymentsQ, (snapshot) => {
      latestPayments = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      sync();
    });
    const unsubDisputes = onSnapshot(disputesQ, (snapshot) => {
      latestDisputes = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      sync();
    });
    const unsubPayouts = subscribeToAllPayoutRequests((items) => {
      latestPayouts = items;
      sync();
    }, () => sync());

    return () => {
      unsubPayments();
      unsubDisputes();
      unsubPayouts();
    };
  }, []);

  const filteredPayments = useMemo(() => payments.filter((payment) => {
    const paymentStatus = String(payment.displayStatus || '').toLowerCase();
    const matchesStatus = statusFilter === 'all' || paymentStatus === statusFilter;
    const queryTerm = search.toLowerCase();
    const matchesSearch = !queryTerm || [payment.userEmail, payment.taskId, payment.paymentId, payment.id]
      .some((value) => String(value || '').toLowerCase().includes(queryTerm));
    return matchesStatus && matchesSearch;
  }), [payments, statusFilter, search]);

  const availableStatuses = useMemo(() => {
    const values = new Set(['all']);
    payments.forEach((payment) => {
      const status = String(payment.displayStatus || '').toLowerCase();
      if (status) values.add(status);
    });
    return Array.from(values);
  }, [payments]);

  const paymentCounts = useMemo(() => getOwnerPaymentCounts(payments), [payments]);
  const disputeCounts = useMemo(() => getDisputeCounts(disputes), [disputes]);
  const payoutCounts = useMemo(() => payoutRequests.reduce((acc, request) => {
    const status = String(request.status || '').toLowerCase();
    acc.total += 1;
    if ([PAYOUT_STATUSES.DETAILS_SUBMITTED, PAYOUT_STATUSES.UNDER_REVIEW, PAYOUT_STATUSES.APPROVED, PAYOUT_STATUSES.PROCESSING].includes(status)) acc.pending += 1;
    if (status === PAYOUT_STATUSES.PAID) acc.paid += 1;
    if ([PAYOUT_STATUSES.FAILED, PAYOUT_STATUSES.REJECTED].includes(status)) acc.failed += 1;
    return acc;
  }, { total: 0, pending: 0, paid: 0, failed: 0 }), [payoutRequests]);

  const pendingPayoutRequests = useMemo(() => payoutRequests.filter((request) => {
    const queryTerm = search.toLowerCase();
    if (!queryTerm) return true;
    return [request.taskTitle, request.taskId, request.freelancerEmail, request.freelancerName, request.id]
      .some((value) => String(value || '').toLowerCase().includes(queryTerm));
  }), [payoutRequests, search]);

  const getTransferForm = (request) => {
    const saved = request.transferDetails || {};
    return transferForms[request.id] || {
      paymentMethodType: saved.paymentMethodType || '',
      paymentProvider: saved.paymentProvider || '',
      transactionId: saved.transactionId || '',
      payerDisplayName: saved.payerDisplayName || '',
      optionalNote: saved.optionalNote || '',
    };
  };

  const updateTransferForm = (requestId, field, value) => {
    setTransferForms((prev) => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] || {}),
        [field]: value,
      },
    }));
  };

  const hasCompleteTransferForm = (request) => {
    const form = getTransferForm(request);
    return Boolean(
      String(form.paymentMethodType || '').trim()
      && String(form.paymentProvider || '').trim()
      && String(form.transactionId || '').trim()
      && String(form.payerDisplayName || '').trim()
    );
  };

  const handleRefund = async (payment, mode = 'refunded') => {
    const confirmed = window.confirm(mode === 'partial_refund' ? 'Mark this payment as partially refunded?' : 'Mark this payment as refunded?');
    if (!confirmed) return;
    setBusyAction(`${mode}-${payment.id}`);
    try {
      await markRefundForPayment(payment, mode);
    } finally {
      setBusyAction('');
    }
  };

  const handleApprovePayout = async (request) => {
    const form = getTransferForm(request);
    if (!hasCompleteTransferForm(request)) {
      window.alert('Please fill payment method, provider, transaction ID, and payer name before approval.');
      return;
    }
    const confirmed = window.confirm('Approve this payout and mark it as transferred?');
    if (!confirmed) return;
    setBusyAction(`approve-${request.id}`);
    try {
      await approveAndProcessPayout({ payoutRequest: request, ownerUser: user, transferDetails: form });
    } catch (error) {
      window.alert(error.message || 'Unable to process payout right now.');
    } finally {
      setBusyAction('');
    }
  };

  const handleRejectPayout = async (request) => {
    const reason = window.prompt('Reason for rejecting this payout request:', request.rejectionReason || '');
    if (reason === null) return;
    setBusyAction(`reject-${request.id}`);
    try {
      await rejectPayoutRequest({ payoutRequest: request, ownerUser: user, reason });
    } catch (error) {
      window.alert(error.message || 'Unable to reject payout right now.');
    } finally {
      setBusyAction('');
    }
  };

  if (loading) return <LoadingSpinner label="Loading payment records..." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Payments" value={paymentCounts.total} accent="text-primary" />
        <StatCard label="Escrow Held" value={paymentCounts.escrowHeld} accent="text-secondary" />
        <StatCard label="Payout Queue" value={payoutCounts.pending} accent="text-info" />
        <StatCard label="Open Disputes" value={disputeCounts.open} accent="text-error" />
      </div>

      <div className="bg-base-100 rounded-box border border-base-200 shadow-sm p-4 sm:p-6">
        <div className="mb-6 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Payment Management</h1>
            <p className="text-base-content/60 mt-2">Review escrow-held orders, payout requests, refunds, and dispute-linked payments.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input className="input input-bordered w-full sm:w-auto" placeholder="Search by email, task ID, payment ID" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="select select-bordered w-full sm:w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {availableStatuses.map((status) => (
                <option key={status} value={status}>{status === 'all' ? 'All statuses' : status.charAt(0).toUpperCase() + status.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="hidden 2xl:block overflow-x-auto">
          <table className="table min-w-[1560px]">
            <thead>
              <tr>
                <th>Payment ID</th><th>User Email</th><th>Task ID</th><th>Accepted Amount</th><th>Platform Revenue</th><th>Gateway Fee</th><th>Net Freelancer</th><th>Payment</th><th>Escrow</th><th>Payout</th><th>Refund</th><th>Dispute</th><th>Actions</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => {
                const hasOpenDispute = ['open', 'under_review'].includes(String(payment.disputeStatus || '').toLowerCase());
                return (
                  <tr key={payment.id}>
                    <td><div className="max-w-[170px] truncate whitespace-nowrap" title={payment.paymentId || payment.id}>{payment.paymentId || payment.id}</div></td>
                    <td><div className="max-w-[220px] truncate" title={payment.userEmail || '—'}>{payment.userEmail || '—'}</div></td>
                    <td><div className="max-w-[170px] truncate whitespace-nowrap" title={payment.taskId || '—'}>{payment.taskId || '—'}</div></td>
                    <td>₹{Number(payment.displayAcceptedAmount || 0).toLocaleString()}</td>
                    <td>₹{Number(payment.displayPlatformRevenue || 0).toLocaleString()}</td>
                    <td>{payment.gatewayFee === null ? '—' : `₹${Number(payment.gatewayFee || 0).toLocaleString()}`}</td>
                    <td>₹{Number(payment.displayNetFreelancerAmount || 0).toLocaleString()}</td>
                    <td><span className={`badge ${getPaymentStatusTone(payment.displayStatus)}`}>{payment.displayStatus}</span></td>
                    <td><span className="badge badge-outline">{payment.escrowStatus}</span></td>
                    <td><span className="badge badge-outline">{payment.payoutStatus}</span></td>
                    <td><span className="badge badge-outline">{payment.refundStatus}</span></td>
                    <td><span className={`badge ${hasOpenDispute ? 'badge-warning' : 'badge-outline'}`}>{payment.disputeStatus}</span></td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn btn-xs btn-error" disabled={busyAction === `refunded-${payment.id}`} onClick={() => handleRefund(payment, 'refunded')}>{busyAction === `refunded-${payment.id}` ? 'Saving...' : 'Refund'}</button>
                        <button className="btn btn-xs btn-outline" disabled={busyAction === `partial_refund-${payment.id}`} onClick={() => handleRefund(payment, 'partial_refund')}>Partial</button>
                      </div>
                    </td>
                    <td>{formatFirestoreDate(payment.paymentDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-4 2xl:hidden">
          {filteredPayments.map((payment) => {
            const hasOpenDispute = ['open', 'under_review'].includes(String(payment.disputeStatus || '').toLowerCase());
            return (
              <div key={payment.id} className="rounded-xl border border-base-200 bg-base-200 p-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div>
                    <div className="text-sm text-base-content/60">Payment ID</div>
                    <div className="break-all font-medium" title={payment.paymentId || payment.id}>{payment.paymentId || payment.id}</div>
                  </div>
                  <div>
                    <div className="text-sm text-base-content/60">Task ID</div>
                    <div className="break-all font-medium" title={payment.taskId || '—'}>{payment.taskId || '—'}</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-base-content/60">User Email</div>
                  <div className="break-all text-sm" title={payment.userEmail || '—'}>{payment.userEmail || '—'}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-base-content/60">Accepted</div><div>₹{Number(payment.displayAcceptedAmount || 0).toLocaleString()}</div></div>
                  <div><div className="text-base-content/60">Platform</div><div>₹{Number(payment.displayPlatformRevenue || 0).toLocaleString()}</div></div>
                  <div><div className="text-base-content/60">Gateway</div><div>{payment.gatewayFee === null ? '—' : `₹${Number(payment.gatewayFee || 0).toLocaleString()}`}</div></div>
                  <div><div className="text-base-content/60">Net freelancer</div><div>₹{Number(payment.displayNetFreelancerAmount || 0).toLocaleString()}</div></div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${getPaymentStatusTone(payment.displayStatus)}`}>{payment.displayStatus}</span>
                  <span className="badge badge-outline">Escrow: {payment.escrowStatus}</span>
                  <span className="badge badge-outline">Payout: {payment.payoutStatus}</span>
                  <span className="badge badge-outline">Refund: {payment.refundStatus}</span>
                  <span className={`badge ${hasOpenDispute ? 'badge-warning' : 'badge-outline'}`}>Dispute: {payment.disputeStatus}</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button className="btn btn-sm btn-error" disabled={busyAction === `refunded-${payment.id}`} onClick={() => handleRefund(payment, 'refunded')}>{busyAction === `refunded-${payment.id}` ? 'Saving...' : 'Refund'}</button>
                  <button className="btn btn-sm btn-outline" disabled={busyAction === `partial_refund-${payment.id}`} onClick={() => handleRefund(payment, 'partial_refund')}>Partial Refund</button>
                </div>
                <div className="text-sm text-base-content/60">Date: {formatFirestoreDate(payment.paymentDate)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-base-100 rounded-box border border-base-200 shadow-sm p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Payout Review Queue</h2>
            <p className="text-base-content/60 mt-2">Approve or reject freelancer payout requests after client approval and payout detail submission.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="badge badge-outline">Total: {payoutCounts.total}</span>
            <span className="badge badge-outline">Pending: {payoutCounts.pending}</span>
            <span className="badge badge-outline">Paid: {payoutCounts.paid}</span>
            <span className="badge badge-outline">Failed/Rejected: {payoutCounts.failed}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {pendingPayoutRequests.length === 0 ? (
            <div className="rounded-xl border border-base-200 bg-base-200/40 p-4 text-sm text-base-content/70">No payout requests found.</div>
          ) : pendingPayoutRequests.map((request) => {
            const status = String(request.status || '').toLowerCase();
            const canApprove = [PAYOUT_STATUSES.DETAILS_SUBMITTED, PAYOUT_STATUSES.FAILED].includes(status) && hasCompleteTransferForm(request);
            const canReject = [PAYOUT_STATUSES.DETAILS_SUBMITTED, PAYOUT_STATUSES.FAILED, PAYOUT_STATUSES.APPROVED].includes(status);
            return (
              <div key={request.id} className="rounded-xl border border-base-200 bg-base-200/30 p-4 space-y-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2 min-w-0">
                    <div className="font-semibold break-words">{request.taskTitle || 'Untitled task'}</div>
                    <div className="text-sm text-base-content/60 break-all">Task ID: {request.taskId || '—'}</div>
                    <div className="text-sm text-base-content/60 break-all">Freelancer: {request.freelancerName || '—'} {request.freelancerEmail ? `• ${request.freelancerEmail}` : ''}</div>
                    <div className="text-sm text-base-content/60 break-all">Client: {request.clientName || request.clientId || '—'}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <span className={`badge ${getPayoutStatusTone(status)}`}>{status || 'details_pending'}</span>
                    <span className="badge badge-outline">Method: {request.payoutMethod || '—'}</span>
                    <span className="badge badge-outline">Amount: ₹{Number(request.amount || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4 text-sm">
                  <div><div className="text-base-content/60">Accepted amount</div><div className="font-medium">₹{Number(request.acceptedAmount || 0).toLocaleString()}</div></div>
                  <div><div className="text-base-content/60">Client fee</div><div className="font-medium">₹{Number(request.clientPlatformFeeAmount || 0).toLocaleString()}</div></div>
                  <div><div className="text-base-content/60">Freelancer fee</div><div className="font-medium">₹{Number(request.freelancerFeeAmount || 0).toLocaleString()}</div></div>
                  <div><div className="text-base-content/60">Final payout</div><div className="font-medium">₹{Number(request.amount || 0).toLocaleString()}</div></div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 text-sm">
                  <div className="space-y-3">
                    <div>
                      <div className="text-base-content/60 font-semibold mb-1">💸 Transfer Details (Manual)</div>
                      {request.payoutMethod === 'bank_account' ? (
                        <div className="rounded-lg bg-base-300 p-3 space-y-1">
                          <div><span className="text-base-content/60">Name: </span><span className="font-bold">{request.payoutDetails?.accountHolderName || request.payoutDetailsMasked?.accountHolderName || '—'}</span></div>
                          <div><span className="text-base-content/60">Bank: </span><span className="font-bold">{request.payoutDetails?.bankName || request.payoutDetailsMasked?.bankName || '—'}</span></div>
                          <div><span className="text-base-content/60">Account No: </span><span className="font-bold">{request.payoutDetailsMasked?.accountNumberMasked || '—'}</span></div>
                          <div><span className="text-base-content/60">IFSC: </span><span className="font-bold">{request.payoutDetailsMasked?.ifscMasked || '—'}</span></div>
                          <div><span className="text-base-content/60">Amount: </span><span className="font-bold text-success">₹{Number(request.amount || 0).toLocaleString()}</span></div>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-base-300 p-3 space-y-1">
                          <div><span className="text-base-content/60">Name: </span><span className="font-bold">{request.payoutDetails?.accountHolderName || request.payoutDetailsMasked?.accountHolderName || '—'}</span></div>
                          <div><span className="text-base-content/60">UPI ID: </span><span className="font-bold">{request.payoutDetailsMasked?.upiIdMasked || '—'}</span></div>
                          <div><span className="text-base-content/60">Amount: </span><span className="font-bold text-success">₹{Number(request.amount || 0).toLocaleString()}</span></div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-base-300 bg-base-100/70 p-3">
                      <div className="mb-3 text-base-content/70 font-semibold">Approve payout after entering transfer details</div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label className="form-control">
                          <span className="label-text text-xs text-base-content/60">Payment method type</span>
                          <select className="select select-bordered select-sm mt-1" value={getTransferForm(request).paymentMethodType} onChange={(e) => updateTransferForm(request.id, 'paymentMethodType', e.target.value)}>
                            <option value="">Select method</option>
                            <option value="UPI">UPI</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Wallet">Wallet</option>
                            <option value="Other">Other</option>
                          </select>
                        </label>
                        <label className="form-control">
                          <span className="label-text text-xs text-base-content/60">Payment provider</span>
                          <select className="select select-bordered select-sm mt-1" value={getTransferForm(request).paymentProvider} onChange={(e) => updateTransferForm(request.id, 'paymentProvider', e.target.value)}>
                            <option value="">Select provider</option>
                            <option value="Google Pay">Google Pay</option>
                            <option value="PhonePe">PhonePe</option>
                            <option value="Paytm">Paytm</option>
                            <option value="BHIM">BHIM</option>
                            <option value="Bank NEFT">Bank NEFT</option>
                            <option value="Bank IMPS">Bank IMPS</option>
                            <option value="Bank RTGS">Bank RTGS</option>
                            <option value="Other">Other</option>
                          </select>
                        </label>
                        <label className="form-control">
                          <span className="label-text text-xs text-base-content/60">Transaction ID</span>
                          <input className="input input-bordered input-sm mt-1" value={getTransferForm(request).transactionId} onChange={(e) => updateTransferForm(request.id, 'transactionId', e.target.value)} placeholder="Enter transaction ID" />
                        </label>
                        <label className="form-control">
                          <span className="label-text text-xs text-base-content/60">Paid by</span>
                          <input className="input input-bordered input-sm mt-1" value={getTransferForm(request).payerDisplayName} onChange={(e) => updateTransferForm(request.id, 'payerDisplayName', e.target.value)} placeholder="Sender account name" />
                        </label>
                      </div>
                      <label className="form-control mt-3">
                        <span className="label-text text-xs text-base-content/60">Optional note</span>
                        <textarea className="textarea textarea-bordered textarea-sm mt-1 min-h-[80px]" value={getTransferForm(request).optionalNote} onChange={(e) => updateTransferForm(request.id, 'optionalNote', e.target.value)} placeholder="Optional payout note" />
                      </label>
                      <div className="mt-2 text-warning text-xs">⚠️ Required before final approval: method, provider, transaction ID, and payer name.</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-base-content/60">Timeline</div>
                      <div className="font-medium">Submitted: {formatFirestoreDate(request.submittedAt || request.createdAt)}</div>
                      <div className="text-base-content/60">Approved: {formatFirestoreDate(request.approvedAt)}</div>
                      <div className="text-base-content/60">Processed: {formatFirestoreDate(request.processedAt)}</div>
                    </div>
                    {request.transferDetailsMasked ? (
                      <div className="rounded-lg bg-base-300 p-3 space-y-1">
                        <div className="font-semibold text-base-content/70">Saved approval details</div>
                        <div><span className="text-base-content/60">Method: </span><span className="font-bold">{request.transferDetailsMasked.paymentMethodType || '—'}</span></div>
                        <div><span className="text-base-content/60">Provider: </span><span className="font-bold">{request.transferDetailsMasked.paymentProvider || '—'}</span></div>
                        <div><span className="text-base-content/60">Txn ID: </span><span className="font-bold">{request.transferDetailsMasked.transactionId || '—'}</span></div>
                        <div><span className="text-base-content/60">Paid by: </span><span className="font-bold">{request.transferDetailsMasked.payerDisplayName || '—'}</span></div>
                        {request.transferDetailsMasked.optionalNote ? <div><span className="text-base-content/60">Note: </span><span className="font-bold">{request.transferDetailsMasked.optionalNote}</span></div> : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {request.failureReason ? <div className="text-sm text-error">Failure reason: {request.failureReason}</div> : null}
                {request.rejectionReason ? <div className="text-sm text-error">Rejection reason: {request.rejectionReason}</div> : null}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" className="btn btn-success btn-sm" disabled={!canApprove || busyAction === `approve-${request.id}`} onClick={() => handleApprovePayout(request)}>
                    {busyAction === `approve-${request.id}` ? 'Marking paid...' : status === PAYOUT_STATUSES.FAILED ? '✅ Retry — Mark as Paid' : '✅ I Transferred — Mark as Paid'}
                  </button>
                  <button type="button" className="btn btn-outline btn-error btn-sm" disabled={!canReject || busyAction === `reject-${request.id}`} onClick={() => handleRejectPayout(request)}>
                    {busyAction === `reject-${request.id}` ? 'Saving...' : 'Reject payout'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OwnerPayments;
