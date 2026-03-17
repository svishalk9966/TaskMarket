import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Navigate, useNavigate } from 'react-router-dom';
import { MAX_TASK_DESCRIPTION_LENGTH, MAX_TASK_TITLE_LENGTH } from '../config';
import { DEFAULT_TASK_STATUS, DEFAULT_TASK_VISIBILITY, TASKS_COLLECTION_NAME } from '../lib/tasks';

const PostTask = () => {
  const { user } = useAuth();
  const { canPost, hasRole } = useRole();

  // Block freelancer-only users from accessing post task
  if (hasRole && !canPost) return <Navigate to="/browse" replace />;
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Web Development',
    budget: '',
    deadline: '',
    skills: '',
    location: 'Remote',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const categories = useMemo(() => [
    'Web Development',
    'Mobile Development',
    'Design',
    'Writing',
    'Marketing',
    'Data Entry',
    'Customer Support',
    'Other',
  ], []);

  useEffect(() => {
    let redirectTimer;

    if (success) {
      redirectTimer = window.setTimeout(() => {
        navigate('/dashboard');
      }, 900);
    }

    return () => {
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [success, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;
    if (!user?.uid) {
      setError('Please sign in before posting a task.');
      return;
    }

    setSubmitting(true);
    setSuccess(false);
    setError('');
    setStatusMessage('Please wait, your task is being submitted.');

    const title = formData.title.trim();
    const description = formData.description.trim();
    const budget = Number(formData.budget);
    const skills = formData.skills.split(',').map((skill) => skill.trim()).filter(Boolean);
    const deadlineDate = new Date(formData.deadline);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (title.length < 5 || title.length > MAX_TASK_TITLE_LENGTH) {
      setError(`Task title must be between 5 and ${MAX_TASK_TITLE_LENGTH} characters.`);
      setStatusMessage('');
      setSubmitting(false);
      return;
    }

    if (description.length < 20 || description.length > MAX_TASK_DESCRIPTION_LENGTH) {
      setError(`Task description must be between 20 and ${MAX_TASK_DESCRIPTION_LENGTH} characters.`);
      setStatusMessage('');
      setSubmitting(false);
      return;
    }

    if (!Number.isFinite(budget) || budget < 1) {
      setError('Budget must be at least 1.');
      setStatusMessage('');
      setSubmitting(false);
      return;
    }

    if (skills.length === 0) {
      setError('Add at least one required skill.');
      setStatusMessage('');
      setSubmitting(false);
      return;
    }

    if (Number.isNaN(deadlineDate.getTime()) || deadlineDate < now) {
      setError('Deadline must be today or a future date.');
      setStatusMessage('');
      setSubmitting(false);
      return;
    }

    try {
      const clientNow = Date.now();

      await addDoc(collection(db, TASKS_COLLECTION_NAME), {
        title,
        description,
        category: formData.category,
        budget: Math.round(budget),
        deadline: formData.deadline,
        skills,
        location: formData.location,
        status: DEFAULT_TASK_STATUS,
        visibility: DEFAULT_TASK_VISIBILITY,
        paymentStatus: 'unpaid',
        postedById: user.uid,
        postedBy: user.email,
        postedByName: user.displayName || user.email,
        postedByPhoto: user.photoURL || '',
        bids: [],
        searchText: [title, description, formData.category, formData.location, ...skills].join(' ').toLowerCase(),
        clientCreatedAt: clientNow,
        clientUpdatedAt: clientNow,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccess(true);
      setStatusMessage('Task posted successfully. Redirecting to your dashboard...');
    } catch (submitError) {
      console.error('Error posting task:', submitError);
      setError(submitError.message || 'Error posting task. Please try again.');
      setStatusMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 animate-slide-in">
      <h2 className="text-2xl sm:text-3xl font-bold mb-2">Post a New Task</h2>
      <p className="text-base-content/60 mb-8">Describe your project and find the perfect freelancer</p>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-box border border-base-200 bg-base-100 p-4 shadow-lg sm:p-6 lg:p-8" aria-busy={submitting}>
        {error && <div className="alert alert-error"><span>{error}</span></div>}

        {statusMessage && (
          <div className={`alert ${success ? 'alert-success' : 'alert-info'} border shadow-sm`}>
            <span className="flex items-center gap-3 text-sm sm:text-base">
              {!success && <span className="loading loading-spinner loading-sm text-current"></span>}
              <span className="font-medium">{statusMessage}</span>
            </span>
          </div>
        )}

        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Task Title</span>
            <span className="label-text-alt">{formData.title.trim().length}/{MAX_TASK_TITLE_LENGTH}</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="e.g., Build a React E-commerce Site"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            maxLength={MAX_TASK_TITLE_LENGTH}
            disabled={submitting}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Description</span>
            <span className="label-text-alt">{formData.description.trim().length}/{MAX_TASK_DESCRIPTION_LENGTH}</span>
          </label>
          <textarea
            className="textarea textarea-bordered h-32 w-full"
            placeholder="Describe your task in detail..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            maxLength={MAX_TASK_DESCRIPTION_LENGTH}
            disabled={submitting}
          ></textarea>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Category</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              disabled={submitting}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Budget (INR)</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="5000"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              required
              min="1"
              step="1"
              inputMode="numeric"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Deadline</span>
            </label>
            <input
              type="date"
              className="input input-bordered w-full"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Location</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              disabled={submitting}
            >
              <option value="Remote">Remote</option>
              <option value="On-site">On-site</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Required Skills (comma separated)</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="React, Node.js, MongoDB, UI Design"
            value={formData.skills}
            onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
            required
            disabled={submitting}
          />
        </div>

        <div className="space-y-3">
          <button type="submit" className="btn btn-primary w-full sm:btn-lg" disabled={submitting}>
            {submitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="loading loading-spinner loading-sm text-current"></span>
                Posting Task...
              </span>
            ) : 'Post Task'}
          </button>

          {!success && (
            <p className="text-center text-xs sm:text-sm text-base-content/70">
              After submission, your task will be saved and you will be redirected automatically.
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default PostTask;
