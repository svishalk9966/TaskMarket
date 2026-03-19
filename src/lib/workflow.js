import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getAcceptedBidFromTask, getTaskFeeBreakdown } from './feeModel';
import { createDisputeForTask, updatePaymentsByTaskId } from './marketplace';

export const DELIVERIES_COLLECTION = 'deliveries';
export const NOTIFICATIONS_COLLECTION = 'notifications';
export const WORKSPACE_COLLECTION = 'workspaceEntries';

export const PREVIEW_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const PREVIEW_VIDEO_MAX_SECONDS = 180;
export const ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024;
export const ALLOWED_PREVIEW_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/ogg'];
export const ALLOWED_PREVIEW_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.mkv', '.ogv'];
export const ALLOWED_ATTACHMENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-7z-compressed',
  'application/vnd.rar',
  'application/octet-stream',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
];
export const ALLOWED_ATTACHMENT_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.pdf', '.doc', '.docx', '.zip', '.7z', '.rar', '.mp4', '.webm', '.mov', '.mkv'];

const CONTACT_PATTERNS = [
  /\b(?:\+?\d[\d\s-]{7,}\d)\b/i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b(?:whatsapp|telegram|discord|instagram|skype)\b/i,
  /\b(?:wa\.me|t\.me)\b/i,
];

export const CONTACT_BLOCK_MESSAGE = 'Sharing personal contact information is not allowed.';

const roundCurrency = (value) => Math.max(0, Math.round(Number(value || 0)));

export const normalizeWorkflowPaymentStatus = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['paid', 'success', 'captured', 'released', 'escrow_held'].includes(normalized)) return normalized === 'released' ? 'released' : 'paid';
  if (['failed', 'refunded', 'refund_pending', 'unpaid'].includes(normalized)) return normalized;
  return 'unpaid';
};

export const getAcceptedBid = (task = {}) => getAcceptedBidFromTask(task);

export const getSelectedBidId = (bid) => (bid ? `${bid.freelancerId}_${bid.createdAt}` : '');

export const getTaskBaseAmount = (task = {}) => getTaskFeeBreakdown(task).acceptedAmount;

export const getTaskPlatformFeePercent = (task = {}) => getTaskFeeBreakdown(task).clientPlatformFeePercent;

export const getTaskPlatformFeeAmount = (task = {}) => getTaskFeeBreakdown(task).clientPlatformFeeAmount;

export const getTaskTotalPaidByClient = (task = {}) => getTaskFeeBreakdown(task).clientTotalPayable;

const getLiveTaskOrThrow = async (taskId) => {
  const taskRef = doc(db, 'tasks', taskId);
  const taskSnap = await getDoc(taskRef);
  if (!taskSnap.exists()) throw new Error('This task no longer exists.');
  return { ref: taskRef, data: { id: taskSnap.id, ...taskSnap.data() } };
};

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const getLowercaseExtension = (fileName = '') => {
  const normalized = String(fileName || '').toLowerCase();
  const dotIndex = normalized.lastIndexOf('.');
  return dotIndex >= 0 ? normalized.slice(dotIndex) : '';
};

const matchesAllowedFile = (file, allowedMimeTypes = [], allowedExtensions = []) => {
  if (!file) return true;
  const fileType = String(file.type || '').toLowerCase();
  const extension = getLowercaseExtension(file.name);
  return allowedMimeTypes.includes(fileType) || allowedExtensions.includes(extension);
};

const getUploadErrorMessage = (response, fallbackMessage) => {
  const message = response?.error?.message || response?.message || '';
  if (/unsigned/i.test(message)) return 'Cloudinary unsigned upload preset is invalid or disabled.';
  if (/preset/i.test(message)) return 'Cloudinary upload preset is missing or incorrect.';
  if (/cloud name/i.test(message)) return 'Cloudinary cloud name is incorrect.';
  if (/file size/i.test(message) || /too large/i.test(message)) return 'File upload was rejected because the file is too large.';
  return message || fallbackMessage;
};

export const containsRestrictedContactInfo = (value = '') => CONTACT_PATTERNS.some((pattern) => pattern.test(value));

export const getVideoDuration = (file) => new Promise((resolve, reject) => {
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.onloadedmetadata = () => {
    URL.revokeObjectURL(video.src);
    resolve(video.duration || 0);
  };
  video.onerror = () => {
    URL.revokeObjectURL(video.src);
    reject(new Error('Unable to read video metadata.'));
  };
  video.src = URL.createObjectURL(file);
});

export const validatePreviewVideo = async (file) => {
  if (!file) return;
  if (!matchesAllowedFile(file, ALLOWED_PREVIEW_VIDEO_TYPES, ALLOWED_PREVIEW_VIDEO_EXTENSIONS)) {
    throw new Error('Preview video must be MP4, WebM, MOV, MKV, or OGV.');
  }
  if (file.size > PREVIEW_VIDEO_MAX_BYTES) {
    throw new Error('Preview video must be 100 MB or less.');
  }
  const duration = await getVideoDuration(file);
  if (duration > PREVIEW_VIDEO_MAX_SECONDS) {
    throw new Error('Preview video must be 3 minutes or shorter.');
  }
};

export const validateAttachment = (file) => {
  if (!file) return;
  if (!matchesAllowedFile(file, ALLOWED_ATTACHMENT_TYPES, ALLOWED_ATTACHMENT_EXTENSIONS)) {
    throw new Error('Only images, PDF, DOC/DOCX, ZIP, 7Z, RAR, and common video files are allowed.');
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    throw new Error('Attachments must be 100 MB or less.');
  }
};

export const isAllowedExternalUrl = (value = '') => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

export const uploadFileWithProgress = (_path, file, onProgress) => new Promise((resolve, reject) => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    reject(new Error('Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your environment variables.'));
    return;
  }

  const xhr = new XMLHttpRequest();
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  xhr.open('POST', endpoint, true);

  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable && typeof onProgress === 'function') {
      onProgress(Math.round((event.loaded / event.total) * 100));
    }
  };

  xhr.onerror = () => reject(new Error('Upload failed because the network request could not be completed.'));
  xhr.onabort = () => reject(new Error('Upload was canceled before completion.'));

  xhr.onreadystatechange = () => {
    if (xhr.readyState !== XMLHttpRequest.DONE) return;

    let response = null;
    try {
      response = xhr.responseText ? JSON.parse(xhr.responseText) : null;
    } catch {
      response = null;
    }

    if (xhr.status >= 200 && xhr.status < 300 && response?.secure_url) {
      resolve({
        downloadURL: response.secure_url,
        path: response.public_id || '',
        name: file.name,
        contentType: file.type,
        size: file.size,
        assetId: response.asset_id || '',
        publicId: response.public_id || '',
        resourceType: response.resource_type || 'raw',
        format: response.format || '',
      });
      return;
    }

    reject(new Error(getUploadErrorMessage(response, 'Upload failed. Check Cloudinary settings and try again.')));
  };

  xhr.send(formData);
});


const getOwnerNotificationUserIds = async () => {
  const ownerIds = new Set();

  try {
    const ownerUsersQuery = query(collection(db, 'users'), where('role', '==', 'owner'));
    const ownerUsersSnap = await getDocs(ownerUsersQuery);
    ownerUsersSnap.forEach((userDoc) => ownerIds.add(userDoc.id));
  } catch {
    // Fall through to email-based lookup.
  }

  const ownerEmail = String(import.meta.env.VITE_OWNER_EMAIL || '').trim().toLowerCase();
  if (ownerEmail) {
    try {
      const ownerEmailQuery = query(collection(db, 'users'), where('email', '==', ownerEmail), limit(5));
      const ownerEmailSnap = await getDocs(ownerEmailQuery);
      ownerEmailSnap.forEach((userDoc) => ownerIds.add(userDoc.id));
    } catch {
      // Ignore lookup errors and use any owner ids already found.
    }
  }

  return Array.from(ownerIds);
};

export const createNotification = async ({ userId, title, message, type = 'info', taskId = '', metadata = {} }) => {
  if (!userId) return;
  await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    userId,
    title,
    message,
    type,
    taskId,
    metadata,
    read: false,
    createdAt: serverTimestamp(),
  });
};

export const markNotificationRead = async (id) => {
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), {
    read: true,
    readAt: serverTimestamp(),
  });
};

export const deleteNotification = async (id) => {
  if (!id) return;
  await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, id));
};

export const subscribeToNotifications = (userId, callback, onError) => {
  if (!userId) return () => {};
  const notificationsQuery = query(collection(db, NOTIFICATIONS_COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(notificationsQuery, (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).filter((item) => item.userId === userId));
  }, onError);
};

export const addWorkspaceEntry = async ({ task, actor, entryType, message = '', attachments = [] }) => {
  const text = message.trim();
  if (text && containsRestrictedContactInfo(text)) {
    throw new Error(CONTACT_BLOCK_MESSAGE);
  }

  await addDoc(collection(db, WORKSPACE_COLLECTION), {
    taskId: task.id,
    clientId: task.postedById,
    freelancerId: task.assignedTo || '',
    createdById: actor.uid,
    createdByName: actor.displayName || actor.email || 'User',
    createdByEmail: actor.email || '',
    entryType,
    message: text,
    attachments,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'tasks', task.id), {
    clientUpdatedAt: Date.now(),
    latestWorkspaceEntryType: entryType,
    latestWorkspaceMessage: text,
  });
};

export const subscribeToTaskWorkspace = (taskId, callback, onError) => {
  const workspaceQuery = query(collection(db, WORKSPACE_COLLECTION), orderBy('createdAt', 'asc'));
  return onSnapshot(workspaceQuery, (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).filter((item) => item.taskId === taskId));
  }, onError);
};

export const subscribeToTaskDeliveries = (taskId, callback, onError) => {
  const deliveriesQuery = query(collection(db, DELIVERIES_COLLECTION), orderBy('submittedAt', 'desc'));
  return onSnapshot(deliveriesQuery, (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).filter((item) => item.taskId === taskId));
  }, onError);
};

export const acceptBidForTask = async ({ task, bid, actor }) => {
  if (!task?.id) throw new Error('Task information is missing.');
  if (!actor?.uid || task.postedById !== actor.uid) throw new Error('Only the client can accept a bid.');
  if (!bid?.freelancerId) throw new Error('Bid information is missing.');

  const acceptedBidId = getSelectedBidId(bid);
  const nextBids = (task.bids || []).map((item) => ({
    ...item,
    status: item.freelancerId === bid.freelancerId && item.createdAt === bid.createdAt ? 'accepted' : (item.status === 'accepted' ? 'inactive' : 'rejected'),
  }));

  const acceptedAmount = roundCurrency(bid.amount ?? task.acceptedAmount ?? task.acceptedBidAmount ?? task.amount ?? task.budget ?? 0);
  const {
    clientPlatformFeePercent,
    clientPlatformFeeAmount,
    clientTotalPayable,
    freelancerFeePercent,
    freelancerFeeAmount,
    netAmountToFreelancer,
    totalPlatformRevenue,
  } = getTaskFeeBreakdown({
    ...task,
    acceptedAmount,
    acceptedBidAmount: acceptedAmount,
    amount: acceptedAmount,
  });

  await updateDoc(doc(db, 'tasks', task.id), {
    status: 'awaiting_payment',
    paymentStatus: 'unpaid',
    payoutStatus: 'pending',
    refundStatus: 'none',
    disputeStatus: 'closed',
    escrowStatus: 'not_funded',
    assignedTo: bid.freelancerId,
    assignedBidId: acceptedBidId,
    selectedBidId: acceptedBidId,
    selectedFreelancerId: bid.freelancerId,
    selectedFreelancerName: bid.freelancerName || '',
    selectedFreelancerEmail: bid.freelancerEmail || '',
    assignedFreelancerName: bid.freelancerName || '',
    assignedFreelancerEmail: bid.freelancerEmail || '',
    amount: acceptedAmount,
    acceptedAmount,
    acceptedBidAmount: acceptedAmount,
    clientPlatformFeePercent,
    clientPlatformFeeAmount,
    clientTotalPayable,
    freelancerFeePercent,
    freelancerFeeAmount,
    netAmountToFreelancer,
    totalPlatformRevenue,
    platformFeePercent: clientPlatformFeePercent,
    platformFeeAmount: clientPlatformFeeAmount,
    platformFee: clientPlatformFeeAmount,
    totalPaidByClient: clientTotalPayable,
    bids: nextBids,
    clientUpdatedAt: Date.now(),
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await createNotification({
    userId: bid.freelancerId,
    taskId: task.id,
    type: 'assignment',
    title: 'Bid accepted · awaiting payment',
    message: `Your bid for "${task.title}" was accepted. Work starts after client payment confirmation.`,
  });

  await addWorkspaceEntry({
    task: { ...task, assignedTo: bid.freelancerId },
    actor,
    entryType: 'task_update',
    message: `Accepted ${bid.freelancerName || 'a freelancer'} for this task. Client payment is now pending.`,
  });
};

export const submitTaskDelivery = async ({ task, actor, deliveryMessage, externalDeliveryLink, previewVideo, attachment, onProgress }) => {
  const cleanMessage = deliveryMessage.trim();
  if (!cleanMessage) throw new Error('Add a delivery message before submitting work.');
  if (containsRestrictedContactInfo(cleanMessage)) throw new Error(CONTACT_BLOCK_MESSAGE);
  if (externalDeliveryLink && !isAllowedExternalUrl(externalDeliveryLink)) {
    throw new Error('Please provide a valid external delivery link.');
  }

  const { ref: taskRef, data: liveTask } = await getLiveTaskOrThrow(task.id);
  if (!actor?.uid) throw new Error('Please sign in to submit delivery.');
  if ((liveTask.selectedFreelancerId || liveTask.assignedTo) !== actor.uid) throw new Error('Only the selected freelancer can submit delivery.');
  if (normalizeWorkflowPaymentStatus(liveTask.paymentStatus) !== 'paid') throw new Error('Client payment is pending. Work can begin only after payment confirmation.');
  if (!['in_progress', 'revision_requested'].includes(liveTask.status || '')) throw new Error('This order is not active for delivery submission right now.');

  await validatePreviewVideo(previewVideo);
  validateAttachment(attachment);

  const uploads = [];
  let previewVideoMeta = null;
  let attachmentMeta = null;

  if (previewVideo) {
    previewVideoMeta = await uploadFileWithProgress(`deliveries/${task.id}/${actor.uid}/preview-${Date.now()}-${previewVideo.name}`, previewVideo, (progress) => onProgress?.('preview', progress));
    uploads.push(previewVideoMeta);
  }
  if (attachment) {
    attachmentMeta = await uploadFileWithProgress(`deliveries/${task.id}/${actor.uid}/attachment-${Date.now()}-${attachment.name}`, attachment, (progress) => onProgress?.('attachment', progress));
    uploads.push(attachmentMeta);
  }

  const deliveryPayload = {
    taskId: liveTask.id,
    freelancerId: actor.uid,
    clientId: liveTask.postedById,
    deliveryMessage: cleanMessage,
    previewVideoUrl: previewVideoMeta?.downloadURL || '',
    previewVideoPath: previewVideoMeta?.path || '',
    attachments: attachmentMeta ? [attachmentMeta] : [],
    externalDeliveryLink: externalDeliveryLink.trim(),
    submittedAt: serverTimestamp(),
    status: 'delivered',
    freelancerName: actor.displayName || actor.email || 'Freelancer',
    freelancerEmail: actor.email || '',
  };

  await addDoc(collection(db, DELIVERIES_COLLECTION), deliveryPayload);

  await updateDoc(taskRef, {
    status: 'delivered',
    latestDeliveryAt: serverTimestamp(),
    latestDeliveryMessage: cleanMessage,
    clientUpdatedAt: Date.now(),
    updatedAt: serverTimestamp(),
  });

  await createNotification({
    userId: liveTask.postedById,
    taskId: liveTask.id,
    type: 'delivery',
    title: 'Delivery submitted',
    message: `${actor.displayName || actor.email || 'Your freelancer'} submitted work for "${liveTask.title}".`,
  });

  await addWorkspaceEntry({
    task: liveTask,
    actor,
    entryType: 'delivery_note',
    message: cleanMessage,
    attachments: uploads,
  });
};

export const updateTaskReviewState = async ({ task, actor, status, note = '' }) => {
  const cleanNote = note.trim();
  if (cleanNote && containsRestrictedContactInfo(cleanNote)) throw new Error(CONTACT_BLOCK_MESSAGE);

  const { ref: taskRef, data: liveTask } = await getLiveTaskOrThrow(task.id);
  if (!actor?.uid || liveTask.postedById !== actor.uid) throw new Error('Only the client can review this delivery.');

  const patch = {
    status,
    clientUpdatedAt: Date.now(),
    updatedAt: serverTimestamp(),
  };

  if (status === 'revision_requested') {
    patch.revisionNote = cleanNote;
    patch.revisionRequestedAt = serverTimestamp();
  }

  if (status === 'completed') {
    patch.completedAt = serverTimestamp();
    patch.paymentStatus = 'escrow_held';
    patch.escrowStatus = 'held';
    patch.payoutStatus = 'details_pending';
    patch.disputeStatus = 'closed';
  }

  if (status === 'disputed') {
    patch.disputeNote = cleanNote;
    patch.disputedAt = serverTimestamp();
    patch.paymentStatus = 'escrow_held';
    patch.escrowStatus = 'dispute_hold';
    patch.payoutStatus = 'on_hold';
    patch.disputeStatus = 'open';
  }

  await updateDoc(taskRef, patch);

  if (status === 'completed') {
    await updatePaymentsByTaskId(liveTask.id, {
      paymentStatus: 'escrow_held',
      escrowStatus: 'held',
      payoutStatus: 'details_pending',
      disputeStatus: 'closed',
    });
  }

  if (status === 'disputed') {
    const paymentIds = await updatePaymentsByTaskId(liveTask.id, {
      paymentStatus: 'escrow_held',
      escrowStatus: 'dispute_hold',
      payoutStatus: 'on_hold',
      disputeStatus: 'open',
    });
    await createDisputeForTask({ task: liveTask, actor, reason: cleanNote, paymentId: paymentIds[0] || '' });
  }

  await createNotification({
    userId: liveTask.selectedFreelancerId || liveTask.assignedTo,
    taskId: liveTask.id,
    type: status,
    title: status === 'completed' ? 'Work accepted' : status === 'revision_requested' ? 'Revision requested' : 'Task disputed',
    message: status === 'completed'
      ? `Your work on "${liveTask.title}" was accepted. Submit payout details to start admin payout review.`
      : status === 'revision_requested'
        ? `A revision was requested for "${liveTask.title}".`
        : `A dispute was opened for "${liveTask.title}".`,
  });

  await addWorkspaceEntry({
    task: liveTask,
    actor,
    entryType: status === 'completed' ? 'task_update' : status === 'revision_requested' ? 'revision_request' : 'task_update',
    message: cleanNote || (status === 'completed' ? 'Work accepted.' : status === 'revision_requested' ? 'Revision requested.' : 'Dispute raised.'),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// REFUND SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
export const REFUND_REQUESTS_COLLECTION = 'refundRequests';
// Refund fee slabs:
//   ₹0     – ₹5,000   → 10%
//   ₹5,001 – ₹10,000  →  8%
//   ₹10,001+           →  4%
export const REFUND_FEE_PERCENT = 10;

export const REFUND_FEE_SLABS = [
  { upTo: 5000,       feePercent: 10 },
  { upTo: 10000,      feePercent: 8  },
  { upTo: Infinity,   feePercent: 4  },
];

export const getRefundFeePercent = (amount = 0) => {
  const slab = REFUND_FEE_SLABS.find((s) => amount <= s.upTo);
  return slab ? slab.feePercent : 10;
};

export const calculateRefundBreakdown = (totalPaid = 0) => {
  const gross = Math.max(0, Number(totalPaid) || 0);
  const feePercent = getRefundFeePercent(gross);
  const feeAmount = Math.round(gross * feePercent / 100);
  const refundAmount = gross - feeAmount;
  return { gross, feeAmount, refundAmount, feePercent };
};

export const submitRefundRequest = async ({ task, actor, reason }) => {
  const cleanReason = (reason || '').trim();
  if (!cleanReason) throw new Error('Please provide a reason for the refund request.');
  if (!task?.id) throw new Error('Task information is missing.');
  if (!actor?.uid || task.postedById !== actor.uid) throw new Error('Only the task client can request a refund.');

  const paymentStatus = String(task.paymentStatus || '').toLowerCase();
  if (!['escrow_held', 'paid'].includes(paymentStatus)) {
    throw new Error('Refund can only be requested after payment is confirmed.');
  }
  if (['refund_pending', 'refunded'].includes(String(task.refundStatus || '').toLowerCase())) {
    throw new Error('A refund request is already pending or has already been processed.');
  }

  const grossPaid = task.clientTotalPayable || task.totalPaidByClient || task.acceptedAmount || task.amount || 0;
  const refundBreakdown = calculateRefundBreakdown(grossPaid);

  await addDoc(collection(db, REFUND_REQUESTS_COLLECTION), {
    taskId: task.id,
    taskTitle: task.title || '',
    clientId: actor.uid,
    clientEmail: actor.email || '',
    clientName: actor.displayName || actor.email || 'Client',
    freelancerId: task.selectedFreelancerId || task.assignedTo || '',
    freelancerName: task.selectedFreelancerName || task.assignedFreelancerName || '',
    reason: cleanReason,
    status: 'pending',
    amount: refundBreakdown.gross,
    refundFeePercent: refundBreakdown.feePercent,
    refundFeeAmount: refundBreakdown.feeAmount,
    refundAmount: refundBreakdown.refundAmount,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'tasks', task.id), {
    refundStatus: 'refund_pending',
    refundRequestedAt: serverTimestamp(),
    refundReason: cleanReason,
    updatedAt: serverTimestamp(),
    clientUpdatedAt: Date.now(),
  });

  const ownerNotificationUserIds = await getOwnerNotificationUserIds();
  await Promise.all(ownerNotificationUserIds.map((ownerUserId) => createNotification({
    userId: ownerUserId,
    taskId: task.id,
    type: 'refund_request',
    title: 'New refund request',
    message: `Client "${actor.displayName || actor.email}" requested a refund for task "${task.title}". Reason: ${cleanReason}`,
  })));

  await addWorkspaceEntry({
    task,
    actor,
    entryType: 'task_update',
    message: `Refund requested. Reason: ${cleanReason}`,
  });
};

export const approveRefundRequest = async ({ refundRequest, adminUser, task }) => {
  if (!refundRequest?.id) throw new Error('Refund request information is missing.');

  await updateDoc(doc(db, REFUND_REQUESTS_COLLECTION, refundRequest.id), {
    status: 'approved',
    approvedById: adminUser?.uid || 'admin',
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'tasks', refundRequest.taskId), {
    refundStatus: 'refunded',
    paymentStatus: 'refunded',
    status: 'refunded',
    refundApprovedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    clientUpdatedAt: Date.now(),
  });

  // Notify client with actual refund amount
  const refundAmt = refundRequest.refundAmount || refundRequest.amount || 0;
  const feeAmt = refundRequest.refundFeeAmount || 0;
  const feePercent = refundRequest.refundFeePercent || REFUND_FEE_PERCENT;

  await createNotification({
    userId: refundRequest.clientId,
    taskId: refundRequest.taskId,
    type: 'refund_approved',
    title: 'Refund approved ✅',
    message: `Your refund for task "${refundRequest.taskTitle}" has been approved. Refund amount: ₹${refundAmt} (after ${feePercent}% processing fee of ₹${feeAmt}).`,
  });

  // Notify freelancer — reset to awaiting_payment
  if (refundRequest.freelancerId) {
    await createNotification({
      userId: refundRequest.freelancerId,
      taskId: refundRequest.taskId,
      type: 'refund_approved',
      title: 'Client refunded — task reset',
      message: `The client has received a refund for task "${refundRequest.taskTitle}". The task is now waiting for a new client payment.`,
    });
  }
};

export const rejectRefundRequest = async ({ refundRequest, adminUser, rejectReason = '' }) => {
  if (!refundRequest?.id) throw new Error('Refund request information is missing.');

  await updateDoc(doc(db, REFUND_REQUESTS_COLLECTION, refundRequest.id), {
    status: 'rejected',
    rejectedById: adminUser?.uid || 'admin',
    rejectReason: rejectReason.trim(),
    rejectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'tasks', refundRequest.taskId), {
    refundStatus: 'none',
    updatedAt: serverTimestamp(),
    clientUpdatedAt: Date.now(),
  });

  // Notify client of rejection
  await createNotification({
    userId: refundRequest.clientId,
    taskId: refundRequest.taskId,
    type: 'refund_rejected',
    title: 'Refund request not approved',
    message: `Your refund request for "${refundRequest.taskTitle}" was not approved.${rejectReason ? ' Reason: ' + rejectReason : ''}`,
  });
};

export const subscribeToRefundRequests = (callback, onError) => {
  const q = query(collection(db, REFUND_REQUESTS_COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, onError);
};

// ─────────────────────────────────────────────────────────────────────────────
// TASK DELETE (by client)
// ─────────────────────────────────────────────────────────────────────────────
export const deleteTaskByClient = async ({ task, actor }) => {
  if (!task?.id) throw new Error('Task information is missing.');
  if (!actor?.uid || task.postedById !== actor.uid) throw new Error('Only the task owner can delete this task.');

  const deletableStatuses = ['open', 'expired'];
  if (!deletableStatuses.includes(task.status)) {
    throw new Error('Only open or expired tasks can be deleted. Tasks in progress or with accepted bids cannot be deleted.');
  }

  await deleteDoc(doc(db, 'tasks', task.id));
};

// ─────────────────────────────────────────────────────────────────────────────
// TASK EXPIRE + REPOST
// ─────────────────────────────────────────────────────────────────────────────
export const repostExpiredTask = async ({ task, actor }) => {
  if (!task?.id) throw new Error('Task information is missing.');
  if (!actor?.uid || task.postedById !== actor.uid) throw new Error('Only the task owner can repost this task.');
  if (task.status !== 'expired') throw new Error('Only expired tasks can be reposted.');

  await updateDoc(doc(db, 'tasks', task.id), {
    status: 'open',
    bids: [],
    selectedFreelancerId: deleteField(),
    selectedFreelancerName: deleteField(),
    selectedFreelancerEmail: deleteField(),
    assignedTo: deleteField(),
    assignedBidId: deleteField(),
    selectedBidId: deleteField(),
    expiredAt: deleteField(),
    repostedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    clientUpdatedAt: Date.now(),
  });

  await createNotification({
    userId: actor.uid,
    taskId: task.id,
    type: 'info',
    title: 'Task reposted',
    message: `Your task "${task.title}" has been reposted and is now open for bids.`,
  });
};

export const markTaskAsExpired = async (taskId) => {
  await updateDoc(doc(db, 'tasks', taskId), {
    status: 'expired',
    expiredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    clientUpdatedAt: Date.now(),
  });
};
