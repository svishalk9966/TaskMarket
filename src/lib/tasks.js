export const TASKS_COLLECTION_NAME = 'tasks';
export const DEFAULT_TASK_STATUS = 'open';
export const DEFAULT_TASK_VISIBILITY = 'public';

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const normalizePaymentStatus = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['success', 'captured'].includes(normalized)) return 'paid';
  if (['pending', 'created'].includes(normalized)) return 'unpaid';
  if (['paid', 'unpaid', 'failed', 'released', 'refunded', 'escrow_held', 'pending'].includes(normalized)) return normalized;
  return 'unpaid';
};

const normalizeTaskStatus = (task = {}) => {
  const raw = String(task.status || '').trim().toLowerCase();
  if (raw === 'submitted') return 'delivered';
  return raw || DEFAULT_TASK_STATUS;
};

export const normalizeTask = (task = {}) => {
  const normalizedSkills = Array.isArray(task.skills)
    ? task.skills.filter(Boolean)
    : typeof task.skills === 'string'
      ? task.skills.split(',').map((skill) => skill.trim()).filter(Boolean)
      : [];

  return {
    ...task,
    status: normalizeTaskStatus(task),
    visibility: task.visibility || DEFAULT_TASK_VISIBILITY,
    paymentStatus: normalizePaymentStatus(task.paymentStatus),
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
