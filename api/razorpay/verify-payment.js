import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.RAZORPAY_KEY_SECRET) {
    res.status(500).json({ error: 'Missing Razorpay secret.' });
    return;
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ error: 'Missing payment verification fields.' });
      return;
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      res.status(400).json({ error: 'Invalid payment signature.' });
      return;
    }

    res.status(200).json({ verified: true, paymentId: razorpay_payment_id });
  } catch (error) {
    console.error('Razorpay verify-payment failed:', error);
    res.status(500).json({ error: error.message || 'Payment verification failed.' });
  }
}
