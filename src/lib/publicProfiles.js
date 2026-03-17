export const getPublicProfileRoute = (userId = '') => (userId ? `/profile/${userId}` : '');

export const buildPublicProfilePreviewState = ({ userId = '', name = '', photoURL = '', subtitle = '', location = '' } = {}) => ({
  publicProfilePreview: {
    userId,
    name,
    photoURL,
    subtitle,
    location,
  },
});

export const getProfileInitial = (name = '', fallback = 'U') => {
  const safeValue = `${name || fallback}`.trim();
  return (safeValue.slice(0, 1) || 'U').toUpperCase();
};

export const normalizeProfileList = (value) => {
  if (Array.isArray(value)) return value.map((item) => `${item || ''}`.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

export const uniqueProfileStrings = (items = []) => Array.from(new Set(
  items
    .map((item) => `${item || ''}`.trim())
    .filter(Boolean),
));

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value?.seconds === 'number') {
    const parsed = new Date(value.seconds * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatJoinedDate = (value) => {
  const date = toDate(value);
  if (!date) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
};

export const formatReviewDate = (value) => {
  const date = toDate(value);
  if (!date) return '';

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks <= 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const normalizeRating = (value, fallback = null) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.min(5, Math.max(0, numeric));
  return fallback;
};

export const getProfessionalTitle = ({
  professionalTitle = '',
  categories = [],
  assignedCount = 0,
  postedCount = 0,
} = {}) => {
  if (`${professionalTitle || ''}`.trim()) return `${professionalTitle}`.trim();
  if (categories[0]) return categories[0];
  if (assignedCount > 0 && postedCount > 0) return 'Client & Freelancer';
  if (assignedCount > 0) return 'Freelancer';
  if (postedCount > 0) return 'Client';
  return 'TaskMarket member';
};
