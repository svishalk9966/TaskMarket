import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getTaskFeeBreakdown } from './feeModel';
import { isPaymentFunded, normalizePaymentStatus, normalizeRefundStatus } from './tasks';

export const DISPUTES_COLLECTION = 'disputes';

const roundCurrency = (value) => Math.max(0, Math.round(Number(value || 0)));
const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const PAYMENT_ACTIVE_STATUSES = ['paid', 'escrow_held', 'released'];

export const normalizePaymentState = (value = '') => normalizePaymentStatus(value);

export const normalizeDisputeState = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['open', 'under_review', 'resolved_for_client', 'resolved_for_freelancer', 'rejected', 'closed'].includes(normalized)) return normalized;
  return 'open';
};

export const getPaymentPresentation = (payment = {}) => {
  const breakdown = getTaskFeeBreakdown({
    acceptedAmount: payment.acceptedAmount ?? payment.acceptedBidAmount ?? payment.grossAmount ?? payment.amount,
    acceptedBidAmount: payment.acceptedBidAmount ?? payment.acceptedAmount ?? payment.grossAmount ?? payment.amount,
    amount: payment.amount ?? payment.acceptedAmount ?? payment.acceptedBidAmount ?? payment.grossAmount,
    clientPlatformFeePercent: payment.clientPlatformFeePercent,
    clientPlatformFeeAmount: payment.clientPlatformFeeAmount,
    clientTotalPayable: payment.clientTotalPayable ?? payment.totalPaidByClient,
    freelancerFeePercent: payment.freelancerFeePercent,
    freelancerFeeAmount: payment.freelancerFeeAmount,
    netAmountToFreelancer: payment.netAmountToFreelancer ?? payment.netFreelancerAmount ?? payment.freelancerPayoutAmount,
    totalPlatformRevenue: payment.totalPlatformRevenue ?? payment.platformRevenue,
  });

  return {
    breakdown,
    paymentStatus: normalizePaymentState(payment.paymentStatus || payment.status),
    escrowStatus: String(payment.escrowStatus || (normalizePaymentState(payment.paymentStatus || payment.status) === 'escrow_held' ? 'held' : 'not_funded')).toLowerCase(),
    payoutStatus: String(payment.payoutStatus || 'pending').toLowerCase(),
    refundStatus: normalizeRefundStatus(payment.refundStatus || 'none'),
    disputeStatus: normalizeDisputeState(payment.disputeStatus || ''),
    gatewayFee: toNumber(payment.gatewayFee),
    displayAcceptedAmount: toNumber(payment.acceptedAmount ?? payment.acceptedBidAmount ?? payment.grossAmount ?? payment.amount) ?? breakdown.acceptedAmount,
    displayPlatformRevenue: toNumber(payment.totalPlatformRevenue ?? payment.platformRevenue) ?? breakdown.totalPlatformRevenue,
    displayNetFreelancerAmount: toNumber(payment.netAmountToFreelancer ?? payment.netFreelancerAmount ?? payment.freelancerPayoutAmount) ?? breakdown.netAmountToFreelancer,
  };
};

export const updatePaymentsByTaskId = async (taskId, patch = {}) => {
  if (!taskId) return [];
  const snapshot = await getDocs(query(collection(db, 'payments'), where('taskId', '==', taskId)));
  const updates = snapshot.docs.map((entry) => updateDoc(doc(db, 'payments', entry.id), {
    ...patch,
    updatedAt: serverTimestamp(),
  }));
  await Promise.all(updates);
  return snapshot.docs.map((entry) => entry.id);
};

export const createDisputeForTask = async ({ task, actor, reason = '', paymentId = '' }) => {
  const taskId = task?.id;
  if (!taskId || !actor?.uid) throw new Error('Dispute could not be created.');

  const existing = await getDocs(query(collection(db, DISPUTES_COLLECTION), where('taskId', '==', taskId)));
  const openExisting = existing.docs.find((entry) => ['open', 'under_review'].includes(normalizeDisputeState(entry.data()?.status)));
  if (openExisting) {
    await updateDoc(doc(db, DISPUTES_COLLECTION, openExisting.id), {
      reason: reason.trim() || openExisting.data()?.reason || '',
      updatedAt: serverTimestamp(),
      status: 'under_review',
      paymentId: paymentId || openExisting.data()?.paymentId || '',
    });
    return openExisting.id;
  }

  const disputeRef = await addDoc(collection(db, DISPUTES_COLLECTION), {
    taskId,
    paymentId,
    taskTitle: task.title || '',
    clientId: task.postedById || '',
    freelancerId: task.selectedFreelancerId || task.assignedTo || '',
    createdById: actor.uid,
    createdByEmail: actor.email || '',
    reason: reason.trim(),
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return disputeRef.id;
};

export const releasePayoutForPayment = async (payment = {}) => {
  if (!payment?.id || !payment.taskId) throw new Error('Payment record is missing.');
  const presentation = getPaymentPresentation(payment);
  if (['open', 'under_review'].includes(presentation.disputeStatus)) {
    throw new Error('Resolve the dispute before releasing payout.');
  }
  await updateDoc(doc(db, 'payments', payment.id), {
    payoutStatus: 'released',
    escrowStatus: 'released',
    paymentStatus: 'released',
    releasedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'tasks', payment.taskId), {
    paymentStatus: 'released',
    escrowStatus: 'released',
    payoutStatus: 'released',
    status: 'completed',
    updatedAt: serverTimestamp(),
    completedAt: serverTimestamp(),
  });
};

export const markRefundForPayment = async (payment = {}, mode = 'refunded') => {
  if (!payment?.id || !payment.taskId) throw new Error('Payment record is missing.');
  const presentation = getPaymentPresentation(payment);
  const refundStatus = mode === 'partial_refund' ? 'partial_refund' : 'refunded';
  const nextPaymentStatus = refundStatus === 'refunded' ? 'refunded' : 'refund_pending';
  await updateDoc(doc(db, 'payments', payment.id), {
    refundStatus,
    paymentStatus: nextPaymentStatus,
    payoutStatus: 'on_hold',
    escrowStatus: refundStatus === 'refunded' ? 'refunded' : presentation.escrowStatus,
    refundedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'tasks', payment.taskId), {
    refundStatus,
    paymentStatus: nextPaymentStatus,
    payoutStatus: 'on_hold',
    escrowStatus: refundStatus === 'refunded' ? 'refunded' : presentation.escrowStatus,
    status: refundStatus === 'refunded' ? 'refunded' : 'disputed',
    updatedAt: serverTimestamp(),
  });
};

export const resolveDisputeRecord = async (dispute = {}, resolution = 'closed') => {
  if (!dispute?.id || !dispute.taskId) throw new Error('Dispute record is missing.');
  const normalizedResolution = normalizeDisputeState(resolution);
  await updateDoc(doc(db, DISPUTES_COLLECTION, dispute.id), {
    status: normalizedResolution,
    resolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const taskPatch = {
    disputeStatus: normalizedResolution,
    updatedAt: serverTimestamp(),
  };
  const paymentPatch = {
    disputeStatus: normalizedResolution,
    updatedAt: serverTimestamp(),
  };

  if (normalizedResolution === 'resolved_for_freelancer') {
    taskPatch.status = 'completed';
    taskPatch.payoutStatus = 'ready_for_release';
    paymentPatch.payoutStatus = 'ready_for_release';
  }

  if (normalizedResolution === 'resolved_for_client') {
    taskPatch.status = 'disputed';
    taskPatch.refundStatus = 'refund_pending';
    paymentPatch.refundStatus = 'refund_pending';
    paymentPatch.payoutStatus = 'on_hold';
  }

  await updateDoc(doc(db, 'tasks', dispute.taskId), taskPatch);
  if (dispute.paymentId) {
    await updateDoc(doc(db, 'payments', dispute.paymentId), paymentPatch);
  } else {
    await updatePaymentsByTaskId(dispute.taskId, paymentPatch);
  }
};

export const getOwnerPaymentCounts = (payments = []) => payments.reduce((acc, payment) => {
  const view = getPaymentPresentation(payment);
  acc.total += 1;
  if (view.escrowStatus === 'held') acc.escrowHeld += 1;
  if (view.payoutStatus === 'ready_for_release') acc.readyForRelease += 1;
  if (['refunded', 'partial_refund'].includes(view.refundStatus)) acc.refunded += 1;
  return acc;
}, { total: 0, escrowHeld: 0, readyForRelease: 0, refunded: 0 });

export const getDisputeCounts = (disputes = []) => disputes.reduce((acc, dispute) => {
  const status = normalizeDisputeState(dispute.status);
  acc.total += 1;
  if (['open', 'under_review'].includes(status)) acc.open += 1;
  if (status === 'resolved_for_client') acc.resolvedForClient += 1;
  if (status === 'resolved_for_freelancer') acc.resolvedForFreelancer += 1;
  return acc;
}, { total: 0, open: 0, resolvedForClient: 0, resolvedForFreelancer: 0 });

export const deriveEscrowAmount = (payment = {}) => roundCurrency(payment.escrowAmount ?? payment.acceptedAmount ?? payment.acceptedBidAmount ?? payment.grossAmount ?? payment.amount);
