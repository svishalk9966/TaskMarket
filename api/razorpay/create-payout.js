// MANUAL PAYOUT MODE
// RazorpayX is not available (no registered business).
// This endpoint now acts as a "mark as paid" handler.
// Owner manually transfers money via UPI/bank, then clicks "Approve" in dashboard.

import { adminDb, verifyOwnerBearerToken } from '../_lib/firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let ownerEmail = '';
  try {
    ownerEmail = process.env.VITE_OWNER_EMAIL || process.env.OWNER_EMAIL || '';
    await verifyOwnerBearerToken(req, ownerEmail);
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

    if (taskStatus !== 'completed') {
      res.status(400).json({ error: 'Task is not client-approved for payout.' });
      return;
    }
    if (!['escrow_held', 'paid', 'released'].includes(paymentStatus)) {
      res.status(400).json({ error: 'Task payment is not in a payout-eligible escrow state.' });
      return;
    }
    if (['refund_pending', 'refunded', 'partial_refund'].includes(refundStatus)) {
      res.status(400).json({ error: 'Refunded tasks cannot be paid out.' });
      return;
    }

    // Return a fake "processed" payout response
    // Owner has already manually transferred money via UPI/bank
    const fakePayout = {
      id: `manual_payout_${payoutRequestId}`,
      status: 'processed',
      mode: payoutRequest.payoutMethod === 'bank_account' ? 'IMPS' : 'UPI',
      amount: (payoutRequest.amount || 0) * 100,
      currency: 'INR',
      purpose: 'payout',
      notes: {
        payoutRequestId,
        taskId,
        freelancerId: payoutRequest.freelancerId || '',
        manual: true,
      },
    };

    res.status(200).json({
      payoutRequest: { id: payoutRequest.id },
      contact: { id: `manual_contact_${payoutRequest.freelancerId || payoutRequestId}` },
      fundAccount: { id: `manual_fund_${payoutRequestId}` },
      payout: fakePayout,
      manual: true,
    });

  } catch (error) {
    console.error('Manual payout handler error:', error);
    res.status(500).json({ error: error.message || 'Failed to process payout.' });
  }
}
