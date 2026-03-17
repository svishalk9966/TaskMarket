import Razorpay from 'razorpay';

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
    const { paymentId, refundAmount, taskId, reason } = req.body || {};

    if (!paymentId) {
      res.status(400).json({ error: 'Razorpay paymentId is required to process a refund.' });
      return;
    }

    const amountInPaise = roundCurrency(Number(refundAmount || 0) * 100);
    if (!Number.isFinite(amountInPaise) || amountInPaise < 100) {
      res.status(400).json({ error: 'Refund amount must be at least ₹1.' });
      return;
    }

    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });

    // Initiate real Razorpay refund
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amountInPaise,
      speed: 'normal',
      notes: {
        taskId: String(taskId || '').slice(0, 100),
        reason: String(reason || 'Client refund request').slice(0, 200),
      },
    });

    res.status(200).json({
      success: true,
      refundId: refund.id,
      refundAmount: refund.amount / 100,
      status: refund.status,
      paymentId: refund.payment_id,
      createdAt: refund.created_at,
    });
  } catch (error) {
    console.error('Razorpay refund failed:', error);
    // Razorpay error codes
    const errMsg = error?.error?.description || error?.message || 'Refund failed.';
    res.status(500).json({ error: errMsg });
  }
}
