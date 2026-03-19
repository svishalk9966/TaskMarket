import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getTaskFeeBreakdown } from './feeModel';
import { NOTIFICATIONS_COLLECTION } from './workflow';
import { OWNER_EMAIL } from '../config';
import { updatePaymentsByTaskId } from './marketplace';

export const PAYOUT_REQUESTS_COLLECTION = 'payoutRequests';
export const PAYOUT_STATUSES = {
  NOT_REQUIRED: 'not_required',
  DETAILS_PENDING: 'details_pending',
  DETAILS_SUBMITTED: 'details_submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  REJECTED: 'rejected',
};

const roundCurrency = (value) => Math.max(0, Math.round(Number(value || 0)));
const sanitizeText = (value = '', maxLength = 120) => String(value || '').trim().slice(0, maxLength);
const normalizePayoutMethod = (value = '') => (String(value || '').trim().toLowerCase() === 'bank_account' ? 'bank_account' : 'upi');

const getComparableTimestamp = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return (value.seconds * 1000) + Math.floor(Number(value.nanoseconds || 0) / 1000000);
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortPayoutRequestsNewestFirst = (items = []) => [...items].sort((a, b) => {
  const bTime = getComparableTimestamp(b?.createdAt || b?.submittedAt || b?.processedAt || b?.approvedAt || b?.paidAt);
  const aTime = getComparableTimestamp(a?.createdAt || a?.submittedAt || a?.processedAt || a?.approvedAt || a?.paidAt);
  return bTime - aTime;
});
const createNotification = async ({ userId, title, message, type = 'info', taskId = '', metadata = {} }) => {
  if (!userId) return;
  await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    userId,
    title,
    message,
    type,
    taskId,
    metadata,
    read: false,
    createdAt: serverTimestamp(),
  });
};

const maskTrailing = (value = '', visibleChars = 4) => {
  const input = String(value || '').trim();
  if (!input) return '—';
  if (input.length <= visibleChars) return `${'*'.repeat(Math.max(0, input.length - 1))}${input.slice(-1)}`;
  return `${'*'.repeat(Math.max(4, input.length - visibleChars))}${input.slice(-visibleChars)}`;
};

export const maskPayoutDetails = (details = {}) => {
  const method = normalizePayoutMethod(details.method);
  if (method === 'bank_account') {
    return {
      method,
      accountHolderName: sanitizeText(details.accountHolderName, 80),
      bankName: sanitizeText(details.bankName, 80),
      accountNumberMasked: maskTrailing(details.accountNumber, 4),
      ifscMasked: sanitizeText(details.ifsc, 11) ? `${sanitizeText(details.ifsc, 11).slice(0, 4)}****` : '—',
      summary: `${sanitizeText(details.bankName, 40) || 'Bank'} • ${maskTrailing(details.accountNumber, 4)}`,
    };
  }
  return {
    method: 'upi',
    accountHolderName: sanitizeText(details.accountHolderName, 80),
    upiIdMasked: (() => {
      const upi = String(details.upiId || '').trim();
      if (!upi.includes('@')) return maskTrailing(upi, 3);
      const [handle, domain] = upi.split('@');
      const visible = handle.slice(-2);
      return `${'*'.repeat(Math.max(4, handle.length - 2))}${visible}@${domain}`;
    })(),
    summary: maskTrailing(details.upiId, 3),
  };
};

export const buildPayoutBreakdown = (task = {}) => {
  const breakdown = getTaskFeeBreakdown(task);
  return {
    acceptedAmount: roundCurrency(breakdown.acceptedAmount),
    clientPlatformFeeAmount: roundCurrency(breakdown.clientPlatformFeeAmount),
    freelancerFeeAmount: roundCurrency(breakdown.freelancerFeeAmount),
    totalPlatformRevenue: roundCurrency(breakdown.totalPlatformRevenue),
    finalPayoutAmount: roundCurrency(breakdown.netAmountToFreelancer),
    clientTotalPayable: roundCurrency(breakdown.clientTotalPayable),
    clientPlatformFeePercent: Number(breakdown.clientPlatformFeePercent || 0),
    freelancerFeePercent: Number(breakdown.freelancerFeePercent || 0),
  };
};

export const isTaskPayoutEligible = (task = {}, payoutRequest = null) => {
  const selectedFreelancerId = task.selectedFreelancerId || task.assignedTo || '';
  const payoutStatus = String((payoutRequest?.status || task.payoutStatus || '')).toLowerCase();
  const paymentStatus = String(task.paymentStatus || '').toLowerCase();
  const refundStatus = String(task.refundStatus || '').toLowerCase();
  const disputeStatus = String(task.disputeStatus || '').toLowerCase();
  const breakdown = buildPayoutBreakdown(task);

  const eligible = Boolean(
    task.id
    && selectedFreelancerId
    && ['completed'].includes(String(task.status || '').toLowerCase())
    && ['escrow_held', 'released', 'paid'].includes(paymentStatus)
    && !['refund_pending', 'refunded', 'partial_refund'].includes(refundStatus)
    && !['cancelled', 'canceled'].includes(String(task.status || '').toLowerCase())
    && !['open', 'under_review'].includes(disputeStatus)
    && !['paid'].includes(payoutStatus)
    && breakdown.finalPayoutAmount > 0
  );

  return {
    eligible,
    breakdown,
    reasons: {
      hasAssignee: Boolean(selectedFreelancerId),
      approved: String(task.status || '').toLowerCase() === 'completed',
      paymentHeld: ['escrow_held', 'released', 'paid'].includes(paymentStatus),
      refundBlocked: ['refund_pending', 'refunded', 'partial_refund'].includes(refundStatus),
      disputeBlocked: ['open', 'under_review'].includes(disputeStatus),
      amountValid: breakdown.finalPayoutAmount > 0,
    },
  };
};

const getOwnerNotificationUserIds = async () => {
  const ownerIds = new Set();
  try {
    const ownerUsersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'owner')));
    ownerUsersSnap.forEach((entry) => ownerIds.add(entry.id));
  } catch {
    // Ignore and fall back to owner email lookup.
  }
  const ownerEmail = String(OWNER_EMAIL || '').trim().toLowerCase();
  if (ownerEmail) {
    try {
      const ownerEmailSnap = await getDocs(query(collection(db, 'users'), where('email', '==', ownerEmail), limit(5)));
      ownerEmailSnap.forEach((entry) => ownerIds.add(entry.id));
    } catch {
      // Ignore.
    }
  }
  return Array.from(ownerIds);
};

export const subscribeToTaskPayoutRequest = (taskId, callback, onError) => {
  if (!taskId) return () => {};
  const payoutQuery = query(collection(db, PAYOUT_REQUESTS_COLLECTION), where('taskId', '==', taskId));
  return onSnapshot(payoutQuery, (snapshot) => {
    const items = sortPayoutRequestsNewestFirst(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    callback(items[0] || null);
  }, onError);
};

export const subscribeToAllPayoutRequests = (callback, onError) => {
  const payoutQuery = query(collection(db, PAYOUT_REQUESTS_COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(payoutQuery, (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
  }, onError);
};

export const subscribeToFreelancerPayoutRequests = (freelancerId, callback, onError) => {
  if (!freelancerId) return () => {};
  const payoutQuery = query(
    collection(db, PAYOUT_REQUESTS_COLLECTION),
    where('freelancerId', '==', freelancerId),
  );
  return onSnapshot(payoutQuery, (snapshot) => {
    callback(sortPayoutRequestsNewestFirst(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))));
  }, onError);
};

const mapPaymentToFreelancerHistoryItem = (payment = {}) => {
  const normalizedPaymentStatus = String(payment.paymentStatus || '').toLowerCase();
  const normalizedPayoutStatus = String(payment.payoutStatus || '').toLowerCase();
  const derivedStatus = normalizedPayoutStatus === PAYOUT_STATUSES.PAID
    ? PAYOUT_STATUSES.PAID
    : Object.values(PAYOUT_STATUSES).includes(normalizedPayoutStatus)
      ? normalizedPayoutStatus
      : ['escrow_held', 'released', 'paid'].includes(normalizedPaymentStatus)
        ? PAYOUT_STATUSES.DETAILS_PENDING
        : normalizedPayoutStatus || normalizedPaymentStatus || PAYOUT_STATUSES.DETAILS_PENDING;

  return {
    id: `payment_${payment.id}`,
    sourceId: payment.id,
    sourceType: 'payment',
    taskId: payment.taskId || '',
    taskTitle: payment.taskTitle || '',
    clientId: payment.clientId || payment.userId || '',
    clientName: payment.clientName || payment.clientEmail || payment.userEmail || '',
    freelancerId: payment.freelancerId || '',
    freelancerEmail: payment.freelancerEmail || '',
    paymentId: payment.paymentId || payment.transactionId || '',
    paymentOrderId: payment.paymentOrderId || payment.orderId || '',
    amount: roundCurrency(payment.netAmountToFreelancer || payment.amount || payment.acceptedAmount || payment.acceptedBidAmount || 0),
    acceptedAmount: roundCurrency(payment.acceptedAmount || payment.acceptedBidAmount || payment.amount || 0),
    clientPlatformFeeAmount: roundCurrency(payment.clientPlatformFeeAmount || payment.platformFeeAmount || payment.platformFee || 0),
    freelancerFeeAmount: roundCurrency(payment.freelancerFeeAmount || 0),
    totalPlatformRevenue: roundCurrency(payment.totalPlatformRevenue || payment.platformFeeAmount || payment.platformFee || 0),
    payoutMethod: payment.payoutMethod || '',
    provider: payment.provider || payment.paymentMethod || 'Razorpay',
    status: derivedStatus,
    submittedAt: payment.paymentDate || payment.createdAt || null,
    createdAt: payment.createdAt || payment.paymentDate || null,
    approvedAt: normalizedPayoutStatus === PAYOUT_STATUSES.PAID ? (payment.updatedAt || payment.paymentDate || null) : null,
    processedAt: normalizedPayoutStatus === PAYOUT_STATUSES.PAID ? (payment.updatedAt || payment.paymentDate || null) : null,
    paidAt: normalizedPayoutStatus === PAYOUT_STATUSES.PAID ? (payment.updatedAt || payment.paymentDate || null) : null,
    payoutDetailsMasked: payment.payoutDetailsMasked || null,
    payoutDetails: payment.payoutDetails || null,
    timelineLabel: ['escrow_held', 'released', 'paid'].includes(normalizedPaymentStatus) ? 'Payment received' : 'Payment created',
    historyNote: normalizedPayoutStatus === PAYOUT_STATUSES.PAID
      ? 'Payout recorded from payment history.'
      : 'Payment received. Payout details or final processing may still be pending.',
    isFallbackHistory: true,
  };
};

export const subscribeToFreelancerTransactionHistory = (freelancerId, callback, onError) => {
  if (!freelancerId) return () => {};

  let payoutItems = [];
  let paymentItems = [];

  const emitMerged = () => {
    const payoutTaskIds = new Set(payoutItems.map((item) => String(item.taskId || '').trim()).filter(Boolean));
    const paymentFallbackItems = paymentItems.filter((item) => {
      const taskId = String(item.taskId || '').trim();
      return !taskId || !payoutTaskIds.has(taskId);
    });
    callback(sortPayoutRequestsNewestFirst([...payoutItems, ...paymentFallbackItems]));
  };

  const payoutQuery = query(collection(db, PAYOUT_REQUESTS_COLLECTION), where('freelancerId', '==', freelancerId));
  const paymentsQuery = query(collection(db, 'payments'), where('freelancerId', '==', freelancerId));

  const unsubscribePayouts = onSnapshot(payoutQuery, (snapshot) => {
    payoutItems = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data(), sourceType: 'payout_request' }));
    emitMerged();
  }, onError);

  const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
    paymentItems = snapshot.docs
      .map((entry) => mapPaymentToFreelancerHistoryItem({ id: entry.id, ...entry.data() }))
      .filter((item) => Number(item.amount || 0) > 0)
      .filter((item) => ['details_pending', 'details_submitted', 'under_review', 'approved', 'processing', 'paid'].includes(String(item.status || '').toLowerCase()));
    emitMerged();
  }, onError);

  return () => {
    unsubscribePayouts();
    unsubscribePayments();
  };
};

export const getMaskedPayoutDestinationSummary = (payoutRequest = {}) => sanitizeText(
  payoutRequest?.payoutDetailsMasked?.summary
    || payoutRequest?.payoutDetailsMasked?.upiIdMasked
    || payoutRequest?.payoutDetailsMasked?.accountNumberMasked
    || '',
  120,
);

const sanitizePayoutDetails = (details = {}) => {
  const method = normalizePayoutMethod(details.method);
  if (method === 'bank_account') {
    const accountHolderName = sanitizeText(details.accountHolderName, 80);
    const accountNumber = String(details.accountNumber || '').replace(/\s+/g, '');
    const ifsc = String(details.ifsc || '').replace(/\s+/g, '').toUpperCase();
    const bankName = sanitizeText(details.bankName, 80);
    if (!accountHolderName) throw new Error('Account holder name is required.');
    if (!/^\d{6,20}$/.test(accountNumber)) throw new Error('Enter a valid bank account number.');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new Error('Enter a valid IFSC code.');
    if (!bankName) throw new Error('Bank name is required.');
    return { method, accountHolderName, accountNumber, ifsc, bankName };
  }
  const accountHolderName = sanitizeText(details.accountHolderName, 80);
  const upiId = String(details.upiId || '').trim();
  if (!upiId || !/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) throw new Error('Enter a valid UPI ID.');
  if (!accountHolderName) throw new Error('Account holder name is required.');
  return { method: 'upi', accountHolderName, upiId };
};

export const submitTaskPayoutDetails = async ({ task, actor, details, existingRequest = null }) => {
  if (!task?.id) throw new Error('Task information is missing.');
  const freelancerId = task.selectedFreelancerId || task.assignedTo || '';
  if (!actor?.uid || freelancerId !== actor.uid) throw new Error('Only the assigned freelancer can submit payout details.');

  const eligibility = isTaskPayoutEligible(task, existingRequest);
  if (!eligibility.eligible) throw new Error('This task is not ready for payout details yet.');

  const cleanDetails = sanitizePayoutDetails(details);
  const masked = maskPayoutDetails(cleanDetails);
  const breakdown = eligibility.breakdown;
  const nowPatch = {
    taskId: task.id,
    taskTitle: task.title || '',
    clientId: task.postedById || '',
    clientName: task.postedByName || '',
    freelancerId,
    freelancerName: task.selectedFreelancerName || task.assignedFreelancerName || actor.displayName || actor.email || 'Freelancer',
    freelancerEmail: actor.email || task.selectedFreelancerEmail || '',
    paymentId: task.paymentId || '',
    paymentOrderId: task.paymentOrderId || '',
    amount: breakdown.finalPayoutAmount,
    acceptedAmount: breakdown.acceptedAmount,
    clientPlatformFeeAmount: breakdown.clientPlatformFeeAmount,
    freelancerFeeAmount: breakdown.freelancerFeeAmount,
    totalPlatformRevenue: breakdown.totalPlatformRevenue,
    payoutMethod: cleanDetails.method,
    payoutDetails: cleanDetails,
    payoutDetailsMasked: masked,
    status: PAYOUT_STATUSES.DETAILS_SUBMITTED,
    rejectionReason: '',
    failureReason: '',
    provider: 'manual',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (existingRequest?.payoutDetails || existingRequest?.payoutDetailsMasked || existingRequest?.submittedAt || existingRequest?.createdAt) {
    throw new Error('Payout details have already been submitted for this task.');
  }

  let payoutRequestId = existingRequest?.id || '';
  if (payoutRequestId) {
    await updateDoc(doc(db, PAYOUT_REQUESTS_COLLECTION, payoutRequestId), nowPatch);
  } else {
    const ref = await addDoc(collection(db, PAYOUT_REQUESTS_COLLECTION), {
      ...nowPatch,
      createdAt: serverTimestamp(),
    });
    payoutRequestId = ref.id;
  }

  await updateDoc(doc(db, 'tasks', task.id), {
    payoutStatus: PAYOUT_STATUSES.DETAILS_SUBMITTED,
    payoutRequestId,
    payoutMethod: cleanDetails.method,
    updatedAt: serverTimestamp(),
    clientUpdatedAt: Date.now(),
  });

  await updatePaymentsByTaskId(task.id, {
    payoutStatus: PAYOUT_STATUSES.DETAILS_SUBMITTED,
    payoutRequestId,
    payoutMethod: cleanDetails.method,
  });

  const ownerIds = await getOwnerNotificationUserIds();
  await Promise.all(ownerIds.map((ownerId) => createNotification({
    userId: ownerId,
    taskId: task.id,
    type: 'payout_details_submitted',
    title: 'Payout details submitted',
    message: `Payout details were submitted for task "${task.title}". Review the payout request before processing.`,
    metadata: { payoutRequestId },
  })));

  await createNotification({
    userId: freelancerId,
    taskId: task.id,
    type: 'payout_details_submitted',
    title: 'Payout details submitted',
    message: `Your payout details for "${task.title}" were submitted for admin review.`,
    metadata: { payoutRequestId },
  });

  return payoutRequestId;
};

export const rejectPayoutRequest = async ({ payoutRequest, ownerUser, reason = '' }) => {
  if (!payoutRequest?.id || !payoutRequest?.taskId) throw new Error('Payout request is missing.');
  const cleanReason = sanitizeText(reason, 240);
  await updateDoc(doc(db, PAYOUT_REQUESTS_COLLECTION, payoutRequest.id), {
    status: PAYOUT_STATUSES.REJECTED,
    rejectionReason: cleanReason,
    reviewedById: ownerUser?.uid || '',
    reviewedByEmail: ownerUser?.email || '',
    rejectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'tasks', payoutRequest.taskId), {
    payoutStatus: PAYOUT_STATUSES.REJECTED,
    updatedAt: serverTimestamp(),
    clientUpdatedAt: Date.now(),
  });
  await updatePaymentsByTaskId(payoutRequest.taskId, {
    payoutStatus: PAYOUT_STATUSES.REJECTED,
  });
  await createNotification({
    userId: payoutRequest.freelancerId,
    taskId: payoutRequest.taskId,
    type: 'payout_rejected',
    title: 'Payout request rejected',
    message: `Your payout request for "${payoutRequest.taskTitle}" was rejected.${cleanReason ? ` Reason: ${cleanReason}` : ''}`,
    metadata: { payoutRequestId: payoutRequest.id },
  });
};

export const approveAndProcessPayout = async ({ payoutRequest, ownerUser }) => {
  if (!payoutRequest?.id || !payoutRequest?.taskId) throw new Error('Payout request is missing.');

  const payoutAmount = roundCurrency(payoutRequest.amount);
  const payoutMethod = normalizePayoutMethod(payoutRequest.payoutMethod || payoutRequest.payoutDetails?.method);
  const payoutDestination = sanitizeText(
    payoutRequest.payoutDetailsMasked?.summary
      || (payoutMethod === 'bank_account' ? 'bank details' : 'UPI details'),
    120,
  );
  const destinationLabel = payoutMethod === 'bank_account' ? 'bank details' : 'UPI details';

  await updateDoc(doc(db, PAYOUT_REQUESTS_COLLECTION, payoutRequest.id), {
    status: PAYOUT_STATUSES.PAID,
    provider: 'manual',
    reviewedById: ownerUser?.uid || '',
    reviewedByEmail: ownerUser?.email || '',
    approvedAt: serverTimestamp(),
    processedAt: serverTimestamp(),
    paidAt: serverTimestamp(),
    failureReason: '',
    rejectionReason: '',
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'tasks', payoutRequest.taskId), {
    payoutStatus: PAYOUT_STATUSES.PAID,
    payoutProcessedAt: serverTimestamp(),
    paymentStatus: 'released',
    escrowStatus: 'released',
    updatedAt: serverTimestamp(),
    clientUpdatedAt: Date.now(),
  });

  await updatePaymentsByTaskId(payoutRequest.taskId, {
    payoutStatus: PAYOUT_STATUSES.PAID,
    provider: 'manual',
    paymentStatus: 'released',
    escrowStatus: 'released',
  });

  const paidAtIso = new Date().toISOString();

  await createNotification({
    userId: payoutRequest.freelancerId,
    taskId: payoutRequest.taskId,
    type: 'payout_paid',
    title: 'Payment completed',
    message: `Your payment is done through TaskMarket for ₹${payoutAmount} on ${new Date(paidAtIso).toLocaleString()}.${payoutDestination ? ` Transfer destination: ${payoutDestination}.` : ''}`,
    metadata: {
      payoutRequestId: payoutRequest.id,
      payoutAmount,
      provider: 'manual',
      payoutMethod,
      payoutDestination,
      paidAt: paidAtIso,
    },
  });

  return {
    success: true,
    status: PAYOUT_STATUSES.PAID,
    message: `Payout of ₹${payoutAmount} was manually marked as paid for ${payoutDestination}.`,
  };
};
