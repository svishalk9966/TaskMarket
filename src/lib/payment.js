import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_NAME, formatCurrency, RAZORPAY_KEY_ID } from '../config';
import { getAcceptedBidFromTask, getTaskFeeBreakdown } from './feeModel';

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);

    if (window.Razorpay) return resolve(true);

    const existingScript = document.querySelector('script[data-razorpay-checkout="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true), { once: true });
      existingScript.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const postJson = async (url, payload) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}.`);
  }

  return data;
};

export const getTaskPaymentSummary = (task) => getTaskFeeBreakdown(task);



export const launchTaskPayment = async ({ task, user }) => {
  if (!task?.id) throw new Error('Task information is missing.');
  if (!user?.uid) throw new Error('Please login first to make a payment.');
  if (task.postedById !== user.uid) throw new Error('Only the task owner can pay for this task.');
  if (task.paymentStatus === 'paid') throw new Error('This task is already marked as paid.');
  if (!RAZORPAY_KEY_ID) throw new Error('Missing VITE_RAZORPAY_KEY_ID.');

  const acceptedBid = getAcceptedBidFromTask(task);
  if (!acceptedBid) throw new Error('Please accept a freelancer bid before making payment.');
  if (!task.selectedFreelancerId && !task.assignedTo) throw new Error('Selected freelancer information is missing. Re-accept the bid and try again.');

  const {
    acceptedAmount,
    clientPlatformFeePercent,
    clientPlatformFeeAmount,
    clientTotalPayable,
    freelancerFeePercent,
    freelancerFeeAmount,
    netAmountToFreelancer,
    totalPlatformRevenue,
  } = getTaskPaymentSummary(task);
  if (!Number.isFinite(acceptedAmount) || acceptedAmount < 1) throw new Error('Accepted bid amount is invalid for payment.');
  if (!Number.isFinite(clientTotalPayable) || clientTotalPayable < 1) throw new Error('Total payable amount is invalid.');

  const scriptLoaded = await loadRazorpayScript();
  if (!scriptLoaded) throw new Error('Failed to load Razorpay checkout.');

  const orderPayload = await postJson('/api/razorpay/create-order', {
    amount: acceptedAmount,
    taskId: task.id,
    taskTitle: task.title,
    userId: user.uid,
    userEmail: user.email,
    selectedBidId: task.selectedBidId || `${acceptedBid.freelancerId}_${acceptedBid.createdAt}`,
    selectedFreelancerId: task.selectedFreelancerId || task.assignedTo || acceptedBid.freelancerId,
  });

  if (!orderPayload?.order?.id || !orderPayload?.order?.amount || !orderPayload?.order?.currency) {
    throw new Error('Invalid order response from server.');
  }

  const breakdown = orderPayload.breakdown || {};

  const pendingRef = await addDoc(collection(db, 'payments'), {
    orderId: orderPayload.order.id,
    paymentOrderId: orderPayload.order.id,
    taskId: task.id,
    taskTitle: task.title,
    userId: user.uid,
    clientId: user.uid,
    userEmail: user.email,
    clientEmail: user.email || '',
    freelancerId: task.selectedFreelancerId || task.assignedTo || acceptedBid.freelancerId,
    selectedBidId: task.selectedBidId || `${acceptedBid.freelancerId}_${acceptedBid.createdAt}`,
    grossAmount: Number(breakdown.acceptedAmount ?? acceptedAmount),
    amount: Number(breakdown.acceptedAmount ?? acceptedAmount),
    acceptedAmount: Number(breakdown.acceptedAmount ?? acceptedAmount),
    acceptedBidAmount: Number(breakdown.acceptedAmount ?? acceptedAmount),
    commissionPercent: Number(breakdown.clientPlatformFeePercent ?? clientPlatformFeePercent),
    clientPlatformFeePercent: Number(breakdown.clientPlatformFeePercent ?? clientPlatformFeePercent),
    clientPlatformFeeAmount: Number(breakdown.clientPlatformFeeAmount ?? clientPlatformFeeAmount),
    clientTotalPayable: Number(breakdown.clientTotalPayable ?? clientTotalPayable),
    platformFeePercent: Number(breakdown.clientPlatformFeePercent ?? clientPlatformFeePercent),
    platformFeeAmount: Number(breakdown.clientPlatformFeeAmount ?? clientPlatformFeeAmount),
    platformFee: Number(breakdown.clientPlatformFeeAmount ?? clientPlatformFeeAmount),
    freelancerFeePercent: Number(breakdown.freelancerFeePercent ?? freelancerFeePercent),
    freelancerFeeAmount: Number(breakdown.freelancerFeeAmount ?? freelancerFeeAmount),
    gatewayFee: breakdown.gatewayFee ?? null,
    totalPaidByClient: Number(breakdown.clientTotalPayable ?? clientTotalPayable),
    totalPlatformRevenue: Number(breakdown.totalPlatformRevenue ?? totalPlatformRevenue),
    netAmountToFreelancer: Number(breakdown.netAmountToFreelancer ?? netAmountToFreelancer),
    paymentMethod: 'Razorpay',
    paymentStatus: 'pending',
    status: 'created',
    escrowStatus: 'not_funded',
    payoutStatus: 'pending',
    refundStatus: 'none',
    disputeStatus: 'closed',
    paymentDate: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return new Promise((resolve, reject) => {
    let settled = false;

    const markFailed = async (reason) => {
      if (settled) return;
      settled = true;

      try {
        await updateDoc(doc(db, 'payments', pendingRef.id), {
          paymentStatus: 'failed',
          status: 'failed',
          failureReason: reason,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Failed to update failed payment state:', err);
      }

      reject(new Error(reason));
    };

    const razorpay = new window.Razorpay({
      key: RAZORPAY_KEY_ID,
      amount: orderPayload.order.amount,
      currency: orderPayload.order.currency,
      order_id: orderPayload.order.id,
      name: APP_NAME,
      description: `Payment for ${task.title}`,
      prefill: {
        email: user.email || '',
        name: user.displayName || user.email || 'User',
        contact: user.phoneNumber || '',
      },
      notes: {
        taskId: task.id,
        userId: user.uid,
      },
      handler: async (paymentResponse) => {
        if (settled) return;

        try {
          const verifiedPayload = await postJson('/api/razorpay/verify-payment', {
            ...paymentResponse,
            taskId: task.id,
            paymentDocId: pendingRef.id,
          });

          await updateDoc(doc(db, 'payments', pendingRef.id), {
            paymentId: paymentResponse.razorpay_payment_id,
            transactionId: paymentResponse.razorpay_payment_id,
            signature: paymentResponse.razorpay_signature,
            paymentStatus: 'escrow_held',
            status: 'paid',
            escrowStatus: 'held',
            payoutStatus: 'on_hold',
            refundStatus: 'none',
            disputeStatus: 'closed',
            paymentDate: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const taskRef = doc(db, 'tasks', task.id);
          const taskSnap = await getDoc(taskRef);

          if (taskSnap.exists()) {
            await updateDoc(taskRef, {
              status: 'in_progress',
              paymentStatus: 'escrow_held',
              escrowStatus: 'held',
              payoutStatus: 'on_hold',
              refundStatus: 'none',
              disputeStatus: 'closed',
              paymentId: paymentResponse.razorpay_payment_id,
              paymentOrderId: orderPayload.order.id,
              amount: Number(breakdown.acceptedAmount ?? acceptedAmount),
              acceptedAmount: Number(breakdown.acceptedAmount ?? acceptedAmount),
              acceptedBidAmount: Number(breakdown.acceptedAmount ?? acceptedAmount),
              clientPlatformFeePercent: Number(breakdown.clientPlatformFeePercent ?? clientPlatformFeePercent),
              clientPlatformFeeAmount: Number(breakdown.clientPlatformFeeAmount ?? clientPlatformFeeAmount),
              clientTotalPayable: Number(breakdown.clientTotalPayable ?? clientTotalPayable),
              platformFeePercent: Number(breakdown.clientPlatformFeePercent ?? clientPlatformFeePercent),
              platformFeeAmount: Number(breakdown.clientPlatformFeeAmount ?? clientPlatformFeeAmount),
              platformFee: Number(breakdown.clientPlatformFeeAmount ?? clientPlatformFeeAmount),
              freelancerFeePercent: Number(breakdown.freelancerFeePercent ?? freelancerFeePercent),
              freelancerFeeAmount: Number(breakdown.freelancerFeeAmount ?? freelancerFeeAmount),
              gatewayFee: breakdown.gatewayFee ?? null,
              totalPaidByClient: Number(breakdown.clientTotalPayable ?? clientTotalPayable),
              totalPlatformRevenue: Number(breakdown.totalPlatformRevenue ?? totalPlatformRevenue),
              netAmountToFreelancer: Number(breakdown.netAmountToFreelancer ?? netAmountToFreelancer),
              escrowStatus: 'funded',
              lastPaymentAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          settled = true;
          resolve({
            ...verifiedPayload,
            breakdown,
            summary: `Payment successful for ${formatCurrency(Number(breakdown.clientTotalPayable ?? clientTotalPayable))}.`,
          });
        } catch (error) {
          await markFailed(error.message || 'Payment verification failed.');
        }
      },
      modal: {
        ondismiss: () => {
          markFailed('Payment checkout was closed.');
        },
      },
      theme: {
        color: '#570df8',
      },
    });

    razorpay.on('payment.failed', async (response) => {
      const reason =
        response?.error?.description ||
        response?.error?.reason ||
        'Payment failed.';
      await markFailed(reason);
    });

    razorpay.open();
  });
};
