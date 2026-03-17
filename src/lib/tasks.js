export const TASKS_COLLECTION_NAME = 'tasks';
export const DEFAULT_TASK_STATUS = 'open';
export const DEFAULT_TASK_VISIBILITY = 'public';
export const MARKETPLACE_VISIBLE_TASK_STATUSES = ['open'];
export const PAID_OR_HELD_PAYMENT_STATUSES = ['paid', 'escrow_held', 'released'];
export const REFUND_TERMINAL_STATUSES = ['refunded', 'partial_refund'];

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const normalizePaymentStatus = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'released') return 'released';
  if (['escrow_held', 'held', 'funded'].includes(normalized)) return 'escrow_held';
  if (['paid', 'success', 'captured'].includes(normalized)) return 'paid';
  if (['pending', 'created', 'authorized', 'initiated'].includes(normalized)) return 'pending';
  if (['unpaid', 'failed', 'refunded', 'refund_pending', 'partial_refund', 'disputed'].includes(normalized)) return normalized;
  return 'unpaid';
};

export const normalizeRefundStatus = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['none', 'refund_pending', 'refunded', 'partial_refund', 'rejected'].includes(normalized)) return normalized;
  return 'none';
};

export const isPaymentFunded = (value = '') => PAID_OR_HELD_PAYMENT_STATUSES.includes(normalizePaymentStatus(value));

export const isPaymentReleased = (value = '') => normalizePaymentStatus(value) === 'released';

export const isPaymentPending = (value = '') => ['pending', 'unpaid'].includes(normalizePaymentStatus(value));

export const normalizeTaskStatus = (task = {}) => {
  const raw = String(task.status || '').trim().toLowerCase();
  if (raw === 'submitted') return 'delivered';
  if (raw === 'paid') return 'in_progress';
  if (raw) return raw;
  if (normalizePaymentStatus(task.paymentStatus) === 'refunded') return 'refunded';
  return DEFAULT_TASK_STATUS;
};

export const isRefundedTask = (task = {}) => {
  const refundStatus = normalizeRefundStatus(task.refundStatus);
  return REFUND_TERMINAL_STATUSES.includes(refundStatus) || normalizePaymentStatus(task.paymentStatus) === 'refunded';
};

export const isMarketplaceVisibleTask = (task = {}) => {
  const normalizedTask = {
    status: normalizeTaskStatus(task),
    visibility: String(task.visibility || DEFAULT_TASK_VISIBILITY).toLowerCase(),
    blocked: Boolean(task.blocked),
    paymentStatus: normalizePaymentStatus(task.paymentStatus),
    refundStatus: normalizeRefundStatus(task.refundStatus),
    assignedTo: task.assignedTo || task.selectedFreelancerId || '',
  };

  if (normalizedTask.visibility === 'private' || normalizedTask.blocked) return false;
  if (!MARKETPLACE_VISIBLE_TASK_STATUSES.includes(normalizedTask.status)) return false;
  if (normalizedTask.assignedTo) return false;
  if (normalizedTask.paymentStatus !== 'unpaid' && normalizedTask.paymentStatus !== 'pending') return false;
  if (normalizedTask.refundStatus !== 'none') return false;
  return true;
};

export const canViewSensitiveTaskData = (task = {}, user = null, options = {}) => {
  const isOwner = Boolean(options?.isOwner);
  const userId = user?.uid || '';
  if (isOwner || !task) return true;
  return [task.postedById, task.assignedTo, task.selectedFreelancerId].filter(Boolean).includes(userId);
};

export const normalizeTask = (task = {}) => {
  const normalizedSkills = Array.isArray(task.skills)
    ? task.skills.filter(Boolean)
    : typeof task.skills === 'string'
      ? task.skills.split(',').map((skill) => skill.trim()).filter(Boolean)
      : [];

  const normalizedPaymentStatus = normalizePaymentStatus(task.paymentStatus || task.status);
  const normalizedRefundStatus = normalizeRefundStatus(task.refundStatus);

  return {
    ...task,
    status: normalizeTaskStatus(task),
    visibility: task.visibility || DEFAULT_TASK_VISIBILITY,
    paymentStatus: normalizedPaymentStatus,
    refundStatus: normalizedRefundStatus,
    skills: normalizedSkills,
    bids: Array.isArray(task.bids) ? task.bids : [],
    postedByName: task.postedByName || task.postedBy || 'Unknown user',
    selectedFreelancerId: task.selectedFreelancerId || task.assignedTo || '',
    selectedFreelancerName: task.selectedFreelancerName || task.assignedFreelancerName || '',
    selectedFreelancerEmail: task.selectedFreelancerEmail || task.assignedFreelancerEmail || '',
    searchText: [
      task.title,
      task.description,
      task.category,
      task.location,
      ...(normalizedSkills || []),
      task.postedByName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    createdAtMs: Math.max(toMillis(task.createdAt), toMillis(task.clientCreatedAt)),
    updatedAtMs: Math.max(toMillis(task.updatedAt), toMillis(task.clientUpdatedAt)),
  };
};

export const sortTasksNewestFirst = (tasks = []) => [...tasks].sort((a, b) => {
  const aMs = normalizeTask(a).createdAtMs;
  const bMs = normalizeTask(b).createdAtMs;
  return bMs - aMs;
});
