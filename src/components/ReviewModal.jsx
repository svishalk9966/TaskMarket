import React, { useState } from 'react';
import { submitReview } from '../lib/reviews';

const StarInput = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        onClick={() => onChange(star)}
        className={`text-3xl transition-all duration-100 hover:scale-110 focus:outline-none ${
          star <= value ? 'text-amber-400' : 'text-base-content/20 hover:text-amber-300'
        }`}
        aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
      >
        ★
      </button>
    ))}
  </div>
);

const STAR_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent' };

const ReviewModal = ({
  task,
  reviewer,       // { uid, displayName, photoURL }
  targetUser,     // { uid, displayName } — the person being reviewed
  targetRole,     // 'client' | 'freelancer' — label for UI
  onClose,
  onSuccess,
}) => {
  const [rating,  setRating]  = useState(0);
  const [comment, setComment] = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (rating === 0) { setError('Please select a star rating.'); return; }
    if (comment.trim().length < 10) { setError('Please write at least 10 characters.'); return; }

    setLoading(true);
    try {
      await submitReview({
        targetUserId:  targetUser.uid,
        reviewerId:    reviewer.uid,
        reviewerName:  reviewer.displayName || 'User',
        reviewerPhoto: reviewer.photoURL || '',
        rating,
        comment,
        taskId:    task.id,
        taskTitle: task.title || '',
      });
      setDone(true);
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(2,8,23,0.78)', backdropFilter: 'blur(10px)' }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-base-100 shadow-[0_40px_100px_rgba(2,8,23,0.5)]">
        {/* Top gradient strip */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-accent" />

        <div className="p-6 sm:p-7">
          {done ? (
            /* ── Success ── */
            <div className="flex flex-col items-center py-4 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15 ring-4 ring-success/25 text-3xl">
                ⭐
              </div>
              <h3 className="text-xl font-bold gradient-text mb-2">Review Submitted!</h3>
              <p className="text-sm leading-6 text-base-content/60">
                Your review for <span className="font-semibold text-base-content">{targetUser.displayName}</span> has been published on their public profile.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-primary mt-6 w-full rounded-2xl"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-base-content">Leave a Review</h3>
                  <p className="text-sm text-base-content/55">
                    Reviewing <span className="font-medium text-base-content">{targetUser.displayName}</span>
                    {' '}as a <span className="text-primary font-medium capitalize">{targetRole}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-base-200 text-base-content/50 hover:bg-base-300 hover:text-base-content transition"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Task info */}
              <div className="mb-5 rounded-2xl border border-base-300 bg-base-200/50 px-4 py-3 text-sm">
                <span className="text-base-content/50">Task: </span>
                <span className="font-medium text-base-content">{task.title}</span>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-2xl border border-error/25 bg-error/10 px-4 py-3 text-xs text-error">
                  <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Star rating */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-base-content">
                    Your Rating
                  </label>
                  <StarInput value={rating} onChange={setRating} />
                  {rating > 0 && (
                    <p className="mt-1 text-xs font-medium text-amber-500">{STAR_LABELS[rating]}</p>
                  )}
                </div>

                {/* Comment */}
                <div className="form-control">
                  <label className="label pb-1">
                    <span className="label-text font-medium">Your Review</span>
                  </label>
                  <textarea
                    rows={4}
                    className="textarea textarea-bordered w-full rounded-2xl bg-base-100/80 text-base leading-6"
                    placeholder="Share your experience working with this person..."
                    value={comment}
                    onChange={(e) => { setComment(e.target.value); setError(''); }}
                  />
                  <div className="mt-1 flex justify-end">
                    <span className={`text-xs ${comment.length < 10 ? 'text-base-content/40' : 'text-success'}`}>
                      {comment.length} chars
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full rounded-2xl shadow-[0_12px_30px_rgba(102,126,234,0.3)]"
                >
                  {loading
                    ? <span className="inline-flex items-center gap-2"><span className="loading loading-spinner loading-sm" />Submitting…</span>
                    : 'Submit Review'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
