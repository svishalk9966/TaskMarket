import crypto from 'crypto';
import { adminDb, verifyOwnerBearerToken } from '../_lib/firebaseAdmin.js';

const sanitizeText = (value = '', maxLength = 120) => String(value || '').trim().slice(0, maxLength);
const roundCurrency = (value) => Math.max(0, Math.round(Number(value || 0)));
const normalizeMethod = (value = '') => (String(value || '').trim().toLowerCase() === 'bank_account' ? 'bank_account' : 'upi');

const getRazorpayXConfig = () => {
  const keyId = process.env.RAZORPAYX_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAYX_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
  const sourceAccountNumber = process.env.RAZORPAYX_SOURCE_ACCOUNT_NUMBER || process.env.RAZORPAYX_ACCOUNT_NUMBER;
  if (!keyId || !keySecret || !sourceAccountNumber) {
    throw new Error('Missing RazorpayX credentials. Set RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET, and RAZORPAYX_SOURCE_ACCOUNT_NUMBER.');
  }
  return {
    keyId,
    keySecret,
    sourceAccountNumber,
    baseUrl: process.env.RAZORPAYX_BASE_URL || 'https://api.razorpay.com/v1',
    ownerEmail: process.env.VITE_OWNER_EMAIL || process.env.OWNER_EMAIL || '',
    queueIfLowBalance: String(process.env.RAZORPAYX_QUEUE_IF_LOW_BALANCE || '1') !== '0',
  };
};

const basicAuthHeader = (keyId, keySecret) => `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

const callRazorpayX = async ({ path, method = 'POST', payload, headers = {}, config }) => {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: basicAuthHeader(config.keyId, config.keySecret),
      'Content-Type': 'application/json',
      ...headers,
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const upstreamMessage = data?.error?.description || data?.error?.reason || data?.message || data?.raw || `RazorpayX request failed with status ${response.status}.`;
    throw new Error(upstreamMessage);
  }
  return data;
};

const buildContactPayload = (request) => ({
  name: sanitizeText(request.payoutDetails?.accountHolderName || request.freelancerName || 'TaskMarket Freelancer', 120),
  email: sanitizeText(request.freelancerEmail || '', 120),
  type: 'employee',
  reference_id: sanitizeText(`taskmarket_contact_${request.id}`, 40),
  notes: {
    payoutRequestId: sanitizeText(request.id, 120),
    taskId: sanitizeText(request.taskId, 120),
    freelancerId: sanitizeText(request.freelancerId, 120),
  },
});

const buildFundAccountPayload = (request, contactId) => {
  const method = normalizeMethod(request.payoutMethod || request.payoutDetails?.method);
  if (method === 'bank_account') {
    return {
      contact_id: contactId,
      account_type: 'bank_account',
      bank_account: {
        name: sanitizeText(request.payoutDetails?.accountHolderName || request.freelancerName || 'TaskMarket Freelancer', 120),
        ifsc: sanitizeText(request.payoutDetails?.ifsc || '', 20).toUpperCase(),
        account_number: sanitizeText(request.payoutDetails?.accountNumber || '', 30),
      },
    };
  }
  return {
    contact_id: contactId,
    account_type: 'vpa',
    vpa: {
      address: sanitizeText(request.payoutDetails?.upiId || '', 80),
    },
  };
};

const buildPayoutPayload = (request, fundAccountId, config) => {
  const method = normalizeMethod(request.payoutMethod || request.payoutDetails?.method);
  const payoutMode = method === 'bank_account' ? (process.env.RAZORPAYX_BANK_PAYOUT_MODE || 'IMPS') : 'UPI';
  const amount = roundCurrency(request.amount);
  if (amount < 1) throw new Error('Payout amount must be at least ₹1.');

  return {
    account_number: config.sourceAccountNumber,
    fund_account_id: fundAccountId,
    amount: amount * 100,
    currency: 'INR',
    mode: payoutMode,
    purpose: 'payout',
    queue_if_low_balance: config.queueIfLowBalance,
    reference_id: sanitizeText(`taskmarket_payout_${request.id}`, 40),
    narration: sanitizeText(`TaskMarket payout ${request.taskId || request.id}`, 30),
    notes: {
      payoutRequestId: sanitizeText(request.id, 120),
      taskId: sanitizeText(request.taskId, 120),
      freelancerId: sanitizeText(request.freelancerId, 120),
      amountRupees: String(amount),
    },
  };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let config;
  try {
    config = getRazorpayXConfig();
    await verifyOwnerBearerToken(req, config.ownerEmail);
  } catch (error) {
    res.status(403).json({ error: error.message || 'Unauthorized payout request.' });
    return;
  }

  try {
    const { payoutRequestId, taskId } = req.body || {};
    if (!payoutRequestId || !taskId) {
      res.status(400).json({ error: 'Missing payoutRequestId or taskId.' });
      return;
    }

    const db = adminDb();
    const payoutRequestRef = db.collection('payoutRequests').doc(String(payoutRequestId));
    const payoutRequestSnap = await payoutRequestRef.get();
    if (!payoutRequestSnap.exists) {
      res.status(404).json({ error: 'Payout request not found.' });
      return;
    }
    const payoutRequest = { id: payoutRequestSnap.id, ...payoutRequestSnap.data() };
    if (String(payoutRequest.taskId || '') !== String(taskId)) {
      res.status(400).json({ error: 'Task mismatch for payout request.' });
      return;
    }

    const taskSnap = await db.collection('tasks').doc(String(taskId)).get();
    if (!taskSnap.exists) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    const task = { id: taskSnap.id, ...taskSnap.data() };

    const taskStatus = String(task.status || '').toLowerCase();
    const paymentStatus = String(task.paymentStatus || '').toLowerCase();
    const refundStatus = String(task.refundStatus || '').toLowerCase();
    if (taskStatus !== 'completed') throw new Error('Task is not client-approved for payout.');
    if (!['escrow_held', 'paid', 'released'].includes(paymentStatus)) throw new Error('Task payment is not in a payout-eligible escrow state.');
    if (['refund_pending', 'refunded', 'partial_refund'].includes(refundStatus)) throw new Error('Refunded tasks cannot be paid out.');

    let contact = null;
    let fundAccount = null;
    const requestPatch = {};

    if (payoutRequest.providerContactId) {
      contact = { id: payoutRequest.providerContactId };
    } else {
      contact = await callRazorpayX({
        path: '/contacts',
        payload: buildContactPayload(payoutRequest),
        config,
      });
      requestPatch.providerContactId = contact.id;
    }

    if (payoutRequest.providerFundAccountId) {
      fundAccount = { id: payoutRequest.providerFundAccountId };
    } else {
      fundAccount = await callRazorpayX({
        path: '/fund_accounts',
        payload: buildFundAccountPayload(payoutRequest, contact.id),
        config,
      });
      requestPatch.providerFundAccountId = fundAccount.id;
    }

    const idempotencyKey = crypto.createHash('sha256').update(`taskmarket-payout-${payoutRequest.id}-${taskId}`).digest('hex');
    const payout = await callRazorpayX({
      path: '/payouts',
      payload: buildPayoutPayload(payoutRequest, fundAccount.id, config),
      headers: { 'X-Payout-Idempotency': idempotencyKey },
      config,
    });

    if (Object.keys(requestPatch).length > 0) {
      requestPatch.updatedAt = new Date();
      await payoutRequestRef.set(requestPatch, { merge: true });
    }

    res.status(200).json({
      payoutRequest: {
        id: payoutRequest.id,
        providerContactId: requestPatch.providerContactId || payoutRequest.providerContactId || contact.id,
        providerFundAccountId: requestPatch.providerFundAccountId || payoutRequest.providerFundAccountId || fundAccount.id,
      },
      contact,
      fundAccount,
      payout,
      idempotencyKey,
    });
  } catch (error) {
    console.error('Razorpay payout creation failed:', error);
    res.status(500).json({ error: error.message || 'Failed to create payout.' });
  }
}
