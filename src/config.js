const readEnv = (key, fallback = '') => {
  const value = import.meta.env[key];
  return typeof value === 'string' ? value.trim() : fallback;
};

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const OWNER_EMAIL = readEnv('VITE_OWNER_EMAIL', 'owner@example.com').toLowerCase();
export const RAZORPAY_KEY_ID = readEnv('VITE_RAZORPAY_KEY_ID');
export const CLIENT_PLATFORM_FEE_PERCENT = Math.min(Math.max(toNumber(readEnv('VITE_CLIENT_PLATFORM_FEE_PERCENT', '5'), 5), 0), 100);
export const FREELANCER_SERVICE_FEE_PERCENT = Math.min(Math.max(toNumber(readEnv('VITE_FREELANCER_FEE_PERCENT', '5'), 5), 0), 100);
export const PLATFORM_FEE_PERCENT = CLIENT_PLATFORM_FEE_PERCENT;
export const APP_NAME = readEnv('VITE_APP_NAME', 'TaskMarket');
export const APP_CURRENCY = readEnv('VITE_APP_CURRENCY', 'INR').toUpperCase();
export const APP_LOCALE = readEnv('VITE_APP_LOCALE', 'en-IN');
export const MAX_TASK_TITLE_LENGTH = 120;
export const MAX_TASK_DESCRIPTION_LENGTH = 2000;
export const MAX_BID_MESSAGE_LENGTH = 1000;

export const formatCurrency = (value, currency = APP_CURRENCY) => {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat(APP_LOCALE, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${amount.toLocaleString(APP_LOCALE)}`;
  }
};

export const TASK_VISIBILITY_PUBLIC = 'public';
