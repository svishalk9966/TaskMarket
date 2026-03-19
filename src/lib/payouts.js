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
import { auth, db } from '../firebase';
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
  const payoutQuery = query(collection(db, PAYOUT_REQUESTS_COLLECTION), where('taskId', '==', taskId), orderBy('createdAt', 'desc'));
  return onSnapshot(payoutQuery, (snapshot) => {
    const first = snapshot.docs[0];
    callback(first ? { id: first.id, ...first.data() } : null);
  }, onError);
};

export const subscribeToAllPayoutRequests = (callback, onError) => {
  const payoutQuery = query(collection(db, PAYOUT_REQUESTS_COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(payoutQuery, (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
  }, onError);
};

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
    provider: 'razorpayx',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

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

const postJson = async (url, payload, idToken) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) throw new Error(data.error || `Request failed with status ${response.status}.`);
  return data;
};

export const approveAndProcessPayout = async ({ payoutRequest, ownerUser }) => {
  if (!payoutRequest?.id || !payoutRequest?.taskId) throw new Error('Payout request is missing.');
  const currentUser = auth.currentUser;
  const idToken = currentUser ? await currentUser.getIdToken() : '';
  if (!idToken) throw new Error('Owner authentication token is missing. Please sign in again.');

  await updateDoc(doc(db, PAYOUT_REQUESTS_COLLECTION, payoutRequest.id), {
    status: PAYOUT_STATUSES.APPROVED,
    reviewedById: ownerUser?.uid || '',
    reviewedByEmail: ownerUser?.email || '',
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'tasks', payoutRequest.taskId), {
    payoutStatus: PAYOUT_STATUSES.APPROVED,
    updatedAt: serverTimestamp(),
    clientUpdatedAt: Date.now(),
  });
  await updatePaymentsByTaskId(payoutRequest.taskId, {
    payoutStatus: PAYOUT_STATUSES.APPROVED,
  });

  await updateDoc(doc(db, PAYOUT_REQUESTS_COLLECTION, payoutRequest.id), {
    status: PAYOUT_STATUSES.PROCESSING,
    processingStartedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'tasks', payoutRequest.taskId), {
    payoutStatus: PAYOUT_STATUSES.PROCESSING,
    updatedAt: serverTimestamp(),
    clientUpdatedAt: Date.now(),
  });
  await updatePaymentsByTaskId(payoutRequest.taskId, {
    payoutStatus: PAYOUT_STATUSES.PROCESSING,
  });

  try {
    const providerResponse = await postJson('/api/razorpay/create-payout', {
      payoutRequestId: payoutRequest.id,
      taskId: payoutRequest.taskId,
    }, idToken);

    const providerStatus = String(providerResponse.payout?.status || '').toLowerCase();
    const normalizedStatus = ['processed', 'paid'].includes(providerStatus)
      ? PAYOUT_STATUSES.PAID
      : ['queued', 'pending', 'processing'].includes(providerStatus)
        ? PAYOUT_STATUSES.PROCESSING
        : ['failed', 'reversed', 'cancelled', 'rejected'].includes(providerStatus)
          ? PAYOUT_STATUSES.FAILED
          : PAYOUT_STATUSES.PROCESSING;

    const payoutPatch = {
      status: normalizedStatus,
      providerPayoutId: providerResponse.payout?.id || '',
      providerContactId: providerResponse.contact?.id || providerResponse.payoutRequest?.providerContactId || '',
      providerFundAccountId: providerResponse.fundAccount?.id || providerResponse.payoutRequest?.providerFundAccountId || '',
      providerStatus: providerStatus || '',
      providerMode: providerResponse.payout?.mode || '',
      providerResponse,
      processedAt: serverTimestamp(),
      failureReason: providerResponse.payout?.status_details?.description || providerResponse.payout?.failure_reason || '',
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, PAYOUT_REQUESTS_COLLECTION, payoutRequest.id), payoutPatch);
    await updateDoc(doc(db, 'tasks', payoutRequest.taskId), {
      payoutStatus: normalizedStatus,
      payoutProcessedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      clientUpdatedAt: Date.now(),
      ...(normalizedStatus === PAYOUT_STATUSES.PAID ? { paymentStatus: 'released', escrowStatus: 'released' } : {}),
    });
    await updatePaymentsByTaskId(payoutRequest.taskId, {
      payoutStatus: normalizedStatus,
      providerPayoutId: providerResponse.payout?.id || '',
      providerContactId: providerResponse.contact?.id || providerResponse.payoutRequest?.providerContactId || '',
      providerFundAccountId: providerResponse.fundAccount?.id || providerResponse.payoutRequest?.providerFundAccountId || '',
      providerStatus: providerStatus || '',
      ...(normalizedStatus === PAYOUT_STATUSES.PAID ? { paymentStatus: 'released', escrowStatus: 'released' } : {}),
    });

    await createNotification({
      userId: payoutRequest.freelancerId,
      taskId: payoutRequest.taskId,
      type: normalizedStatus === PAYOUT_STATUSES.PAID ? 'payout_paid' : normalizedStatus === PAYOUT_STATUSES.PROCESSING ? 'payout_processing' : 'payout_failed',
      title: normalizedStatus === PAYOUT_STATUSES.PAID ? 'Payout sent' : normalizedStatus === PAYOUT_STATUSES.PROCESSING ? 'Payout processing' : 'Payout failed',
      message: normalizedStatus === PAYOUT_STATUSES.PAID
        ? `Your payout for "${payoutRequest.taskTitle}" has been initiated successfully.`
        : normalizedStatus === PAYOUT_STATUSES.PROCESSING
          ? `Your payout for "${payoutRequest.taskTitle}" is processing with the payout provider.`
          : `Your payout for "${payoutRequest.taskTitle}" failed.${payoutPatch.failureReason ? ` Reason: ${payoutPatch.failureReason}` : ''}`,
      metadata: { payoutRequestId: payoutRequest.id, providerPayoutId: providerResponse.payout?.id || '' },
    });

    return providerResponse;
  } catch (error) {
    await updateDoc(doc(db, PAYOUT_REQUESTS_COLLECTION, payoutRequest.id), {
      status: PAYOUT_STATUSES.FAILED,
      failureReason: error.message || 'Payout processing failed.',
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'tasks', payoutRequest.taskId), {
      payoutStatus: PAYOUT_STATUSES.FAILED,
      updatedAt: serverTimestamp(),
      clientUpdatedAt: Date.now(),
    });
    await updatePaymentsByTaskId(payoutRequest.taskId, {
      payoutStatus: PAYOUT_STATUSES.FAILED,
      failureReason: error.message || 'Payout processing failed.',
    });
    await createNotification({
      userId: payoutRequest.freelancerId,
      taskId: payoutRequest.taskId,
      type: 'payout_failed',
      title: 'Payout failed',
      message: `Your payout for "${payoutRequest.taskTitle}" could not be processed.${error.message ? ` Reason: ${error.message}` : ''}`,
      metadata: { payoutRequestId: payoutRequest.id },
    });
    throw error;
  }
};
