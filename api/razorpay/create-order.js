import Razorpay from 'razorpay';

const roundCurrency = (value) => Math.max(0, Math.round(Number(value || 0)));
const sanitizeText = (value, maxLength = 120) => String(value || '').trim().slice(0, maxLength);
const toPercent = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

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
    const { amount, taskId, taskTitle, userId, userEmail, selectedBidId, selectedFreelancerId } = req.body || {};
    const acceptedAmount = Number(amount || 0);

    if (!Number.isFinite(acceptedAmount) || acceptedAmount < 1) {
      res.status(400).json({ error: 'Amount must be at least ₹1.' });
      return;
    }

    const clientPlatformFeePercent = toPercent(process.env.CLIENT_PLATFORM_FEE_PERCENT, 5);
    const freelancerFeePercent = toPercent(process.env.FREELANCER_FEE_PERCENT, 5);
    const clientPlatformFeeAmount = roundCurrency(acceptedAmount * (clientPlatformFeePercent / 100));
    const clientTotalPayable = roundCurrency(acceptedAmount + clientPlatformFeeAmount);
    const freelancerFeeAmount = roundCurrency(acceptedAmount * (freelancerFeePercent / 100));
    const netAmountToFreelancer = Math.max(0, roundCurrency(acceptedAmount - freelancerFeeAmount));
    const totalPlatformRevenue = roundCurrency(clientPlatformFeeAmount + freelancerFeeAmount);
    const amountInPaise = roundCurrency(clientTotalPayable * 100);

    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `task_${sanitizeText(taskId, 20) || 'unknown'}`,
      notes: {
        taskId: sanitizeText(taskId, 100),
        taskTitle: sanitizeText(taskTitle, 100),
        userId: sanitizeText(userId, 100),
        userEmail: sanitizeText(userEmail, 120),
        selectedBidId: sanitizeText(selectedBidId, 120),
        selectedFreelancerId: sanitizeText(selectedFreelancerId, 120),
        acceptedAmount: String(acceptedAmount),
        clientPlatformFeePercent: String(clientPlatformFeePercent),
        clientPlatformFeeAmount: String(clientPlatformFeeAmount),
        clientTotalPayable: String(clientTotalPayable),
        freelancerFeePercent: String(freelancerFeePercent),
        freelancerFeeAmount: String(freelancerFeeAmount),
        totalPlatformRevenue: String(totalPlatformRevenue),
        netAmountToFreelancer: String(netAmountToFreelancer),
      },
    });

    res.status(200).json({
      order,
      breakdown: {
        acceptedAmount,
        baseAmount: acceptedAmount,
        grossAmount: acceptedAmount,
        clientPlatformFeePercent,
        clientPlatformFeeAmount,
        clientTotalPayable,
        freelancerFeePercent,
        freelancerFeeAmount,
        totalPlatformRevenue,
        gatewayFee: null,
        netAmountToFreelancer,
        commissionPercent: clientPlatformFeePercent,
        platformFee: clientPlatformFeeAmount,
        totalPaidByClient: clientTotalPayable,
      },
    });
  } catch (error) {
    console.error('Razorpay create-order failed:', error);
    res.status(500).json({ error: error.message || 'Failed to create Razorpay order.' });
  }
}
