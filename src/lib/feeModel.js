import { CLIENT_PLATFORM_FEE_PERCENT, FREELANCER_SERVICE_FEE_PERCENT } from '../config';

const roundCurrency = (value) => Math.max(0, Math.round(Number(value || 0)));

export const getAcceptedBidFromTask = (task = {}) => (
  Array.isArray(task.bids) ? task.bids.find((bid) => bid.status === 'accepted') || null : null
);

export const getAcceptedAmount = (task = {}) => {
  const acceptedBid = getAcceptedBidFromTask(task);
  const candidate = acceptedBid?.amount
    ?? task.acceptedAmount
    ?? task.acceptedBidAmount
    ?? task.amount
    ?? task.budget
    ?? 0;
  return roundCurrency(candidate);
};

const getPercent = (primaryValue, fallbackValue) => {
  const candidate = Number(primaryValue);
  if (Number.isFinite(candidate) && candidate >= 0) return candidate;
  return fallbackValue;
};

export const getTaskFeeBreakdown = (task = {}) => {
  const acceptedAmount = getAcceptedAmount(task);

  const clientPlatformFeePercent = getPercent(task.clientPlatformFeePercent, CLIENT_PLATFORM_FEE_PERCENT);
  const freelancerFeePercent = getPercent(task.freelancerFeePercent, FREELANCER_SERVICE_FEE_PERCENT);

  const clientPlatformFeeAmount = roundCurrency(
    task.clientPlatformFeeAmount
      ?? task.platformFeeAmount
      ?? task.platformFee
      ?? (acceptedAmount * (clientPlatformFeePercent / 100))
  );

  const clientTotalPayable = roundCurrency(
    task.clientTotalPayable
      ?? task.totalPaidByClient
      ?? (acceptedAmount + clientPlatformFeeAmount)
  );

  const freelancerFeeAmount = roundCurrency(
    task.freelancerFeeAmount
      ?? (acceptedAmount * (freelancerFeePercent / 100))
  );

  const netAmountToFreelancer = roundCurrency(
    task.netAmountToFreelancer
      ?? (acceptedAmount - freelancerFeeAmount)
  );

  const totalPlatformRevenue = roundCurrency(
    task.totalPlatformRevenue
      ?? (clientPlatformFeeAmount + freelancerFeeAmount)
  );

  return {
    acceptedAmount,
    acceptedBidAmount: acceptedAmount,
    clientPlatformFeePercent,
    clientPlatformFeeAmount,
    clientTotalPayable,
    freelancerFeePercent,
    freelancerFeeAmount,
    netAmountToFreelancer,
    totalPlatformRevenue,
    // legacy aliases for backward compatibility with existing UI/data readers
    baseAmount: acceptedAmount,
    platformFeePercent: clientPlatformFeePercent,
    platformFeeAmount: clientPlatformFeeAmount,
    totalPaidByClient: clientTotalPayable,
  };
};
