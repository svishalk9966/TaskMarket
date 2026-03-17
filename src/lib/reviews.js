import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

const REVIEWS_COLLECTION = 'users';

/**
 * Submit a review from reviewer → target user's profile
 * Stores in target user's `reviews` array + updates averageRating + reviewCount
 */
export const submitReview = async ({
  targetUserId,   // who is being reviewed
  reviewerId,     // who is writing the review
  reviewerName,
  reviewerPhoto,
  rating,         // 1–5
  comment,
  taskId,
  taskTitle,
}) => {
  if (!targetUserId || !reviewerId) throw new Error('Missing user IDs.');
  if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5.');
  if (!comment?.trim()) throw new Error('Please write a comment.');

  const targetRef = doc(db, REVIEWS_COLLECTION, targetUserId);
  const targetSnap = await getDoc(targetRef);
  const existing = targetSnap.exists() ? targetSnap.data() : {};

  // Check already reviewed for this task
  const existingReviews = Array.isArray(existing.reviews) ? existing.reviews : [];
  const alreadyReviewed = existingReviews.some(
    (r) => r.taskId === taskId && r.reviewerId === reviewerId
  );
  if (alreadyReviewed) throw new Error('You have already reviewed this person for this task.');

  const newReview = {
    id: `${reviewerId}_${taskId}_${Date.now()}`,
    reviewerId,
    reviewerName: reviewerName || 'TaskMarket User',
    reviewerPhoto: reviewerPhoto || '',
    rating: Number(rating),
    comment: comment.trim(),
    taskId,
    taskTitle: taskTitle || '',
    createdAt: new Date().toISOString(),
  };

  // Recalculate average rating
  const allRatings = [...existingReviews.map((r) => Number(r.rating)), Number(rating)];
  const avgRating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;

  await updateDoc(targetRef, {
    reviews: arrayUnion(newReview),
    averageRating: Math.round(avgRating * 10) / 10,
    reviewCount: allRatings.length,
    updatedAt: serverTimestamp(),
  });

  return newReview;
};

/**
 * Check if reviewer has already reviewed target for a specific task
 */
export const hasReviewed = async (targetUserId, reviewerId, taskId) => {
  try {
    const snap = await getDoc(doc(db, REVIEWS_COLLECTION, targetUserId));
    if (!snap.exists()) return false;
    const reviews = Array.isArray(snap.data().reviews) ? snap.data().reviews : [];
    return reviews.some((r) => r.taskId === taskId && r.reviewerId === reviewerId);
  } catch {
    return false;
  }
};
