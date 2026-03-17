import Razorpay from 'razorpay';

const toRupees = (subunits = 0) => Number(subunits || 0) / 100;
const roundCurrency = (value) => Math.max(0, Math.round(Number(value || 0)));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    res.status(500).json({ error: 'Missing Razorpay server credentials.' });
    return;
  }

  try {
    const { paymentId, amount, taskId, refundRequestId, reason } = req.body || {};
    const refundAmountRupees = roundCurrency(amount);

    if (!paymentId) {
      res.status(400).json({ error: 'Razorpay payment ID is required.' });
      return;
    }

    if (!Number.isFinite(refundAmountRupees) || refundAmountRupees < 1) {
      res.status(400).json({ error: 'Refund amount must be at least ₹1.' });
      return;
    }

    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });

    const payment = await razorpay.payments.fetch(paymentId);
    if (!payment?.id) {
      res.status(404).json({ error: 'Payment could not be fetched from Razorpay.' });
      return;
    }

    if (!(payment.captured || payment.status === 'captured')) {
      res.status(400).json({ error: 'Refunds can only be created for captured Razorpay payments.' });
      return;
    }

    const paymentAmountRupees = toRupees(payment.amount);
    const alreadyRefundedRupees = toRupees(payment.amount_refunded);
    const remainingRefundableRupees = roundCurrency(paymentAmountRupees - alreadyRefundedRupees);

    if (refundAmountRupees > remainingRefundableRupees) {
      res.status(400).json({ error: `Refund amount exceeds the remaining refundable balance of ₹${remainingRefundableRupees}.` });
      return;
    }

    const refund = await razorpay.payments.refund(paymentId, {
      amount: refundAmountRupees * 100,
      speed: 'normal',
      notes: {
        taskId: String(taskId || '').slice(0, 100),
        refundRequestId: String(refundRequestId || '').slice(0, 100),
        reason: String(reason || '').slice(0, 200),
      },
    });

    res.status(200).json({
      payment: {
        id: payment.id,
        status: payment.status,
        captured: Boolean(payment.captured),
        amount_rupees: paymentAmountRupees,
        amount_refunded_rupees: toRupees(payment.amount_refunded),
      },
      refund: {
        ...refund,
        amount_rupees: toRupees(refund.amount),
        total_amount: payment.amount,
      },
    });
  } catch (error) {
    console.error('Razorpay refund-payment failed:', error);
    res.status(500).json({ error: error?.error?.description || error.message || 'Failed to process Razorpay refund.' });
  }
}
