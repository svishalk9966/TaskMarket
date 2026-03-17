import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import PayForTaskButton from './PayForTaskButton';
import PublicUserIdentity from './PublicUserIdentity';
import { getAcceptedBid, getTaskBaseAmount, getTaskPlatformFeeAmount, getTaskTotalPaidByClient } from '../lib/workflow';
import { formatCurrency, MAX_BID_MESSAGE_LENGTH } from '../config';

const deliveryTimeOptions = ['1 day', '3 days', '5 days', '7 days', 'Flexible'];

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const createTaskBrief = (description = '') => {
  const normalized = String(description || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'No detailed description provided.';
  return normalized;
};

const TaskDetailPanel = ({ task, onPlaceBid, className = '' }) => {
  const { canBid } = useRole();
  const { user } = useAuth();
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('3 days');
  const [showBidForm, setShowBidForm] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const hasUserBid = useMemo(() => Boolean(user && task?.bids?.some((bid) => bid.freelancerId === user.uid)), [task?.bids, user]);

  if (!task) {
    return (
      <section className={`sticky top-28 rounded-[12px] border border-dashed border-base-300 bg-base-100/90 p-8 text-center shadow-sm ${className}`.trim()}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-base-200 text-2xl">📌</div>
        <h3 className="mt-4 text-xl font-semibold">Select a task</h3>
        <p className="mt-2 text-sm leading-6 text-base-content/60">Choose a task from the list to review the full description, budget, skills, and bid actions.</p>
      </section>
    );
  }

  const acceptedBid = getAcceptedBid(task);
  const paymentBaseAmount = getTaskBaseAmount(task);
  const paymentPlatformFeeAmount = getTaskPlatformFeeAmount(task);
  const paymentTotalAmount = getTaskTotalPaidByClient(task);

  const handleBid = async (event) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const amount = Number(bidAmount);
    const message = bidMessage.trim();

    if (!user) {
      setFormError('Please log in to place a bid.');
      return;
    }

    if (!Number.isFinite(amount) || amount < 1) {
      setFormError('Enter a valid bid amount.');
      return;
    }

    if (message.length < 10 || message.length > MAX_BID_MESSAGE_LENGTH) {
      setFormError(`Cover letter must be between 10 and ${MAX_BID_MESSAGE_LENGTH} characters.`);
      return;
    }

    setSubmittingBid(true);

    try {
      await onPlaceBid(task.id, {
        amount: Math.round(amount),
        message,
        deliveryTime,
        status: 'pending',
        freelancerId: user.uid,
        freelancerEmail: user.email,
        freelancerName: user.displayName || user.email,
        freelancerPhoto: user.photoURL || '',
        createdAt: new Date().toISOString(),
      });

      setShowBidForm(false);
      setBidAmount('');
      setBidMessage('');
      setDeliveryTime('3 days');
      setSuccessMessage('Your bid has been submitted successfully.');
    } catch (bidError) {
      setFormError(bidError.message || 'Unable to place bid. Please try again.');
    } finally {
      setSubmittingBid(false);
    }
  };

  const isNew = task.createdAtMs > 0 && Date.now() - task.createdAtMs < 1000 * 60 * 60 * 48;
  const lowCompetition = Array.isArray(task.bids) && task.bids.length > 0 && task.bids.length <= 2;
  const isUrgent = task.deadline ? (new Date(task.deadline).getTime() - Date.now()) <= 1000 * 60 * 60 * 24 * 3 : false;
  const bidCount = task.bids?.length || 0;
  const taskBrief = createTaskBrief(task.description);

  return (
    <section className={`flex h-full min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-[12px] border border-base-300 bg-base-100/95 shadow-[0_24px_60px_rgba(15,23,42,0.1)] ${className}`.trim()}>
      <div className="border-b border-base-300 bg-base-100/95">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,14.5rem)] lg:gap-5 xl:gap-6">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {task.category ? <span className="rounded-full border border-primary/18 bg-primary/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{task.category}</span> : null}
                  <span className="rounded-full border border-base-300 bg-base-200/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-base-content/70">{(task.status || 'open').replace(/[-_]/g, ' ')}</span>
                  {isNew ? <span className="rounded-full bg-emerald-500/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">New</span> : null}
                  {isUrgent ? <span className="rounded-full bg-rose-500/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">Urgent</span> : null}
                  {lowCompetition ? <span className="rounded-full bg-secondary/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">Low competition</span> : null}
                </div>
                <h3 className="break-words text-2xl font-bold leading-tight text-base-content sm:text-[1.95rem]">{task.title}</h3>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-base-content/60">
                  <span className="rounded-full border border-base-300/70 bg-base-200/70 px-3 py-1.5">Posted {formatDate(task.createdAtMs)}</span>
                  <span className="rounded-full border border-base-300/70 bg-base-200/70 px-3 py-1.5">{bidCount} bids</span>
                  {task.location ? <span className="rounded-full border border-base-300/70 bg-base-200/70 px-3 py-1.5 break-words">{task.location}</span> : null}
                  {task.deadline ? <span className="rounded-full border border-base-300/70 bg-base-200/70 px-3 py-1.5">Deadline {formatDate(task.deadline)}</span> : null}
                </div>
              </div>

              <div className="w-full rounded-[1.45rem] border border-primary/16 bg-gradient-to-br from-primary/[0.09] to-transparent p-4 lg:justify-self-end lg:self-start">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/50">Project budget</div>
                <div className="mt-2 break-words text-[2rem] font-bold text-primary">{formatCurrency(task.budget)}</div>
                <div className="mt-2 text-xs leading-5 text-base-content/56">Use this as your pricing anchor while preparing a thoughtful proposal.</div>
              </div>
            </div>


          </div>
        </div>
      </div>

      <div className="task-scroll-shell min-h-0 flex-1 overflow-hidden rounded-b-[2rem] p-1 pt-0">
        <div className="task-detail-scroll h-full min-h-0 overflow-x-hidden overflow-y-auto rounded-[8px] px-4 py-4 sm:px-5 sm:py-5 xl:pr-4">
        <div className="space-y-5 pb-10">
          {formError ? <div className="alert alert-error rounded-2xl"><span>{formError}</span></div> : null}
          {successMessage ? <div className="alert alert-success rounded-2xl"><span>{successMessage}</span></div> : null}

          <div className="rounded-[9px] border border-base-300 bg-base-100 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] sm:p-6 lg:p-7">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h4 className="text-xl font-semibold text-base-content sm:text-[1.35rem]">Task brief</h4>
                  <div className="inline-flex rounded-full border border-base-300 bg-base-200/45 px-3 py-1.5 text-xs font-medium text-base-content/58">Primary detail section</div>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-base-content/60">Read the full project description below before preparing a proposal. This section now stays visually centered in the content flow so the actual scope gets more emphasis than the supporting cards around it.</p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.45rem] border border-base-300/80 bg-base-200/28 p-5 sm:p-6 lg:p-7 xl:p-8">
              <p className="whitespace-pre-wrap break-words text-[0.97rem] leading-8 text-base-content/78 sm:text-[1.02rem] lg:max-w-[76ch] lg:text-[1.04rem] lg:leading-9">{taskBrief}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.6rem] border border-base-300/80 bg-base-200/45">
            <div className="bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_32%)] px-4 py-4 sm:px-5 sm:py-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-5">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-base-content sm:text-lg">Ready to pitch for this task?</p>
                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-base-content/66">Review the scope, compare the budget, and submit a professional proposal when you are ready. The action area adapts cleanly across widths without crowding the layout.</p>
                </div>

                <div className="flex w-full min-w-0 flex-wrap items-stretch justify-start gap-3 lg:w-auto lg:max-w-[24rem] lg:justify-end">
                  {canBid && user && user.uid !== task.postedById && task.status === 'open' && !hasUserBid ? (
                    <button
                      className="btn btn-primary min-h-[3.5rem] w-full rounded-full px-6 text-white sm:w-auto sm:min-w-[11rem] lg:max-w-full"
                      onClick={() => setShowBidForm((current) => !current)}
                      type="button"
                    >
                      {showBidForm ? 'Cancel' : 'Place Bid'}
                    </button>
                  ) : null}
                  {hasUserBid ? <span className="inline-flex min-h-[3.5rem] w-full items-center justify-center rounded-full border border-info/25 bg-info/12 px-4 py-3 text-sm font-semibold text-info sm:w-auto sm:min-w-[11rem]">✓ Bid Submitted</span> : null}
                  {user && user.uid === task.postedById && acceptedBid && task.paymentStatus !== 'paid' && task.paymentStatus !== 'released' ? <div className="w-full sm:w-auto sm:min-w-[11rem]"><PayForTaskButton task={task} /></div> : null}
                  {!acceptedBid && user && user.uid === task.postedById ? <span className="inline-flex min-h-[3.5rem] w-full items-center justify-center rounded-full border border-base-300 bg-base-100 px-4 py-3 text-sm font-semibold text-base-content/65 sm:w-auto sm:min-w-[12rem]">Accept a bid to unlock payment</span> : null}
                  {task.paymentStatus === 'paid' || task.paymentStatus === 'released' ? <span className="inline-flex min-h-[3.5rem] w-full items-center justify-center rounded-full border border-success/25 bg-success/12 px-4 py-3 text-sm font-semibold text-success sm:w-auto sm:min-w-[11rem]">Payment Verified</span> : null}
                </div>
              </div>
            </div>
          </div>

          {acceptedBid ? (
            <div className="rounded-[1.6rem] border border-base-300 bg-base-100 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="text-lg font-semibold">Selected freelancer</h4>
                  <p className="mt-1 text-sm text-base-content/60">Work starts only after payment verification.</p>
                </div>
                <div className={"badge " + ((task.paymentStatus === 'paid' || task.paymentStatus === 'released') ? 'badge-success' : 'badge-warning')}>
                  {task.paymentStatus === 'paid' || task.paymentStatus === 'released' ? 'Payment verified' : 'Awaiting payment'}
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
                <div className="rounded-[1.35rem] border border-base-300 bg-base-200/35 p-4">
                  <PublicUserIdentity
                    userId={acceptedBid.freelancerId}
                    name={acceptedBid.freelancerName || 'Freelancer'}
                    photoURL={acceptedBid.freelancerPhoto || ''}
                    subtitle=""
                    showAction={Boolean(acceptedBid.freelancerId)}
                    actionLabel="View Profile"
                    containerClassName="min-w-0 flex-1"
                    avatarClassName="h-12 w-12"
                    nameClassName="truncate text-base font-semibold"
                    subtitleClassName="mt-1 text-sm text-base-content/58"
                  />
                </div>
                <div className="rounded-[1.35rem] border border-base-300 bg-base-200/35 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-base-content/60">Accepted amount</span><span className="font-semibold">{formatCurrency(paymentBaseAmount)}</span></div>
                  <div className="mt-2 flex items-center justify-between gap-3"><span className="text-base-content/60">Platform fee (5%)</span><span className="font-semibold">{formatCurrency(paymentPlatformFeeAmount)}</span></div>
                  <div className="mt-2 flex items-center justify-between gap-3 border-t border-base-300 pt-2"><span className="font-medium">Total payable</span><span className="font-bold text-primary">{formatCurrency(paymentTotalAmount)}</span></div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.45rem] border border-base-300 bg-base-200/40 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/48">Deadline</div>
              <div className="mt-2 text-base font-semibold text-base-content">{formatDate(task.deadline)}</div>
            </div>
            <div className="rounded-[1.45rem] border border-base-300 bg-base-200/40 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/48">Location</div>
              <div className="mt-2 break-words text-base font-semibold text-base-content">{task.location || 'Remote / flexible'}</div>
            </div>
            <div className="rounded-[1.45rem] border border-base-300 bg-base-200/40 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/48">Budget</div>
              <div className="mt-2 break-words text-base font-semibold text-primary">{formatCurrency(task.budget)}</div>
            </div>
            <div className="rounded-[1.45rem] border border-base-300 bg-base-200/40 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/48">Competition</div>
              <div className="mt-2 text-base font-semibold text-base-content">{bidCount} bid{bidCount === 1 ? '' : 's'}</div>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-base-300 bg-base-100 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h4 className="text-lg font-semibold">Required Skills</h4>
                <p className="mt-1 text-sm text-base-content/60">Key capabilities expected for this task.</p>
              </div>
              {task.skills?.length ? <div className="rounded-full border border-base-300 bg-base-200/50 px-3 py-1.5 text-xs font-medium text-base-content/60">{task.skills.length} skills</div> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {task.skills?.length ? task.skills.map((skill) => (
                <span key={skill} className="rounded-full border border-base-300 bg-base-200/55 px-3.5 py-2 text-xs font-medium text-base-content/78 shadow-sm">
                  {skill}
                </span>
              )) : <div className="w-full rounded-[1.2rem] border border-dashed border-base-300 bg-base-200/30 px-4 py-4 text-sm text-base-content/55">No required skills were added for this task.</div>}
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-base-300 bg-base-100 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h4 className="text-lg font-semibold">Posted by</h4>
                <p className="mt-1 text-sm text-base-content/60">Open the client profile for more context before you bid.</p>
              </div>
              <div className="rounded-full border border-base-300 bg-base-200/50 px-3 py-1.5 text-xs font-medium text-base-content/60">Public profile available</div>
            </div>
            <div className="rounded-[1.35rem] border border-base-300 bg-base-200/35 p-4">
              <PublicUserIdentity
                userId={task.postedById}
                name={task.postedByName || 'Unknown user'}
                photoURL={task.postedByPhoto || ''}
                subtitle={`Posted ${formatDate(task.createdAtMs)}${task.location ? ` • ${task.location}` : ''}`}
                showAction={Boolean(task.postedById)}
                actionLabel="View Profile"
                containerClassName="min-w-0 flex-1"
                avatarClassName="h-12 w-12"
                nameClassName="truncate text-base font-semibold"
                subtitleClassName="mt-1 text-sm text-base-content/58"
              />
            </div>
          </div>

          {showBidForm ? (
            <form onSubmit={handleBid} className="animate-slide-in rounded-[9px] border border-primary/12 bg-gradient-to-br from-primary/[0.06] via-base-100 to-base-100 p-5 shadow-[0_18px_42px_rgba(59,130,246,0.08)] sm:p-6">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="text-lg font-semibold">Submit Your Proposal</h4>
                  <p className="mt-1 text-sm text-base-content/60">Keep your proposal concise, relevant, and outcome-focused.</p>
                </div>
                <div className="rounded-full border border-primary/14 bg-primary/[0.08] px-3 py-1.5 text-xs font-medium text-primary">Professional bid form</div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="form-control">
                  <label className="label"><span className="label-text font-medium">Your Bid (INR)</span></label>
                  <input type="number" className="input input-bordered h-12 w-full rounded-2xl border-base-300 bg-base-100/90" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} placeholder="Enter amount" required min="1" step="1" />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text font-medium">Delivery time</span></label>
                  <select className="select select-bordered h-12 w-full rounded-2xl border-base-300 bg-base-100/90" value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)}>
                    {deliveryTimeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">Cover Letter</span>
                  <span className="label-text-alt">{bidMessage.trim().length}/{MAX_BID_MESSAGE_LENGTH}</span>
                </label>
                <textarea className="textarea textarea-bordered min-h-[8rem] w-full rounded-[1.35rem] border-base-300 bg-base-100/90" value={bidMessage} onChange={(event) => setBidMessage(event.target.value)} placeholder="Describe why you're a strong fit for this task..." required maxLength={MAX_BID_MESSAGE_LENGTH}></textarea>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-base-content/55">Your proposal is sent directly into the task bidding flow.</p>
                <button type="submit" className={`btn btn-primary min-h-[3.5rem] rounded-full px-6 text-white ${submittingBid ? 'loading' : ''}`} disabled={submittingBid}>
                  Submit Bid
                </button>
              </div>
            </form>
          ) : null}

          {task.bids?.length > 0 ? (
            <div className="rounded-[1.6rem] border border-base-300 bg-base-100 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] sm:p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="text-lg font-semibold">Current Bids</h4>
                  <p className="mt-1 text-sm text-base-content/60">Compare existing proposals before placing your own bid.</p>
                </div>
                <div className="rounded-full border border-base-300 bg-base-200/50 px-3 py-1.5 text-xs font-medium text-base-content/60">{task.bids.length} total</div>
              </div>

              <div className="space-y-3">
                {task.bids.map((bid, idx) => (
                  <div key={idx} className="flex flex-col gap-3 rounded-[1.35rem] border border-base-300 bg-base-200/35 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <PublicUserIdentity
                      userId={bid.freelancerId}
                      name={bid.freelancerName || 'Freelancer'}
                      photoURL={bid.freelancerPhoto || ''}
                      subtitle={`Delivery: ${bid.deliveryTime || 'Flexible'} • ${bid.status || 'pending'}`}
                      showAction={Boolean(bid.freelancerId)}
                      actionLabel="View Profile"
                      containerClassName="min-w-0 flex-1"
                      avatarClassName="h-10 w-10"
                      nameClassName="truncate font-medium"
                      subtitleClassName="mt-1 text-xs text-base-content/55"
                    />
                    <div className="sm:max-w-[13rem] sm:text-right">
                      <div className="text-base font-bold text-primary sm:text-lg">{formatCurrency(bid.amount)}</div>
                      <div className="mt-1 line-clamp-3 text-sm leading-6 text-base-content/62">{bid.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        </div>
      </div>
    </section>
  );
};

export default TaskDetailPanel;
