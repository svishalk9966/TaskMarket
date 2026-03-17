import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import PayForTaskButton from './PayForTaskButton';
import PublicUserIdentity from './PublicUserIdentity';
import { getAcceptedBid, getTaskBaseAmount, getTaskPlatformFeeAmount, getTaskTotalPaidByClient } from '../lib/workflow';
import { formatCurrency, MAX_BID_MESSAGE_LENGTH } from '../config';

const deliveryTimeOptions = ['1 day', '3 days', '5 days', '7 days', 'Flexible'];

const TaskDetailModal = ({ task, onClose, onPlaceBid }) => {
  const { user } = useAuth();
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('3 days');
  const [showBidForm, setShowBidForm] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const hasUserBid = useMemo(() => Boolean(user && task?.bids?.some((bid) => bid.freelancerId === user.uid)), [task?.bids, user]);

  if (!task) return null;

  const acceptedBid = getAcceptedBid(task);
  const paymentBaseAmount = getTaskBaseAmount(task);
  const paymentPlatformFeeAmount = getTaskPlatformFeeAmount(task);
  const paymentTotalAmount = getTaskTotalPaidByClient(task);

  const handleBid = async (e) => {
    e.preventDefault();
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

  return (
    <dialog className="modal modal-open px-2 sm:px-4">
      <div className="modal-box max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[12px] border border-base-300 bg-base-100 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:p-6">
        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={onClose} type="button">✕</button>

        <div className="mb-5 flex flex-col gap-4 pr-8 sm:flex-row sm:items-start sm:justify-between sm:pr-10">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-primary/18 bg-primary/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{task.category}</span>
          </div>
            <h3 className="text-xl font-bold break-words sm:text-2xl">{task.title}</h3>
          </div>
          <div className="w-full max-w-full rounded-[1.4rem] border border-primary/16 bg-gradient-to-br from-primary/[0.08] to-transparent p-4 sm:w-auto sm:min-w-[12rem] sm:text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/45">Budget</div>
            <div className="mt-2 text-2xl font-bold text-primary sm:text-3xl">{formatCurrency(task.budget)}</div>
          </div>
        </div>

        <div className="divider my-4"></div>

        <div className="space-y-4">
          {formError && <div className="alert alert-error"><span>{formError}</span></div>}
          {successMessage && <div className="alert alert-success"><span>{successMessage}</span></div>}

          <div>
            <h4 className="mb-2 font-semibold">Description</h4>
            <p className="whitespace-pre-wrap break-words text-sm text-base-content/80 sm:text-base">{task.description}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-base-200 p-3">
              <div className="text-sm text-base-content/60">Deadline</div>
              <div className="font-semibold">{task.deadline ? new Date(task.deadline).toLocaleDateString() : '-'}</div>
            </div>
            <div className="rounded-lg bg-base-200 p-3">
              <div className="text-sm text-base-content/60">Location</div>
              <div className="font-semibold break-words">{task.location || '-'}</div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 font-semibold">Required Skills</h4>
            <div className="flex flex-wrap gap-2">
              {task.skills?.map((skill, idx) => (
                <span key={idx} className="badge badge-primary badge-outline">{skill}</span>
              ))}
            </div>
          </div>

          {acceptedBid ? (
            <div className="rounded-[1.35rem] border border-base-300 bg-base-200/35 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-semibold">Selected freelancer</div>
                  <div className="mt-1 text-sm text-base-content/60">Work starts only after payment verification.</div>
                </div>
                <div className={`badge ${task.paymentStatus === 'paid' || task.paymentStatus === 'released' ? 'badge-success' : 'badge-warning'}`}>
                  {task.paymentStatus === 'paid' || task.paymentStatus === 'released' ? 'Payment verified' : 'Awaiting payment'}
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]">
                <PublicUserIdentity
                  userId={acceptedBid.freelancerId}
                  name={acceptedBid.freelancerName || 'Freelancer'}
                  photoURL={acceptedBid.freelancerPhoto || ''}
                  subtitle=""
                  showAction={Boolean(acceptedBid.freelancerId)}
                  actionLabel="View Profile"
                  avatarClassName="h-10 w-10"
                  nameClassName="truncate font-semibold"
                  subtitleClassName="text-xs text-base-content/55"
                />
                <div className="rounded-xl border border-base-300 bg-base-100/80 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-base-content/60">Accepted amount</span><span className="font-semibold">{formatCurrency(paymentBaseAmount)}</span></div>
                  <div className="mt-2 flex items-center justify-between gap-3"><span className="text-base-content/60">Platform fee (5%)</span><span className="font-semibold">{formatCurrency(paymentPlatformFeeAmount)}</span></div>
                  <div className="mt-2 flex items-center justify-between gap-3 border-t border-base-300 pt-2"><span className="font-medium">Total payable</span><span className="font-bold text-primary">{formatCurrency(paymentTotalAmount)}</span></div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="divider"></div>

          <div className="overflow-hidden rounded-[1.6rem] border border-base-300 bg-base-200/35">
            <div className="bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_32%)] p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold">Ready to pitch for this task?</p>
                  <p className="mt-1 text-sm leading-6 text-base-content/60">Review the brief, inspect the client, and send a proposal without crowding the layout on smaller screens.</p>
                  <div className="mt-4">
                    <PublicUserIdentity
                      userId={task.postedById}
                      name={task.postedByName || 'Unknown user'}
                      photoURL={task.postedByPhoto || ''}
                      subtitle={`Posted ${task.createdAt ? new Date(task.createdAt.seconds ? task.createdAt.seconds * 1000 : task.createdAt).toLocaleDateString() : '-'}`}
                      showAction={Boolean(task.postedById)}
                      actionLabel="View Profile"
                      avatarClassName="h-12 w-12"
                      nameClassName="truncate font-semibold"
                      subtitleClassName="text-sm text-base-content/60"
                    />
                  </div>
                </div>

                <div className="flex w-full flex-wrap gap-3 lg:w-auto lg:justify-end">
                  {user && user.uid !== task.postedById && task.status === 'open' && !hasUserBid && (
                    <button className="btn btn-primary min-h-[3.25rem] w-full rounded-full sm:w-auto sm:min-w-[10.5rem]" onClick={() => setShowBidForm((current) => !current)} type="button">
                      {showBidForm ? 'Cancel' : 'Place Bid'}
                    </button>
                  )}
                  {hasUserBid && <span className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-full border border-info/25 bg-info/12 px-4 py-2 text-sm font-semibold text-info sm:w-auto sm:min-w-[10.5rem]">Bid Submitted</span>}
                  {user && user.uid === task.postedById && acceptedBid && task.paymentStatus !== 'paid' && task.paymentStatus !== 'released' && (
                    <div className="w-full sm:w-auto sm:min-w-[10.5rem]"><PayForTaskButton task={task} /></div>
                  )}
                  {!acceptedBid && user && user.uid === task.postedById && <span className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-full border border-base-300 bg-base-100 px-4 py-2 text-sm font-semibold text-base-content/65 sm:w-auto sm:min-w-[10.5rem]">Accept a bid to unlock payment</span>}
                  {(task.paymentStatus === 'paid' || task.paymentStatus === 'released') && <span className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-full border border-success/25 bg-success/12 px-4 py-2 text-sm font-semibold text-success sm:w-auto sm:min-w-[10.5rem]">Payment Verified</span>}
                </div>
              </div>
            </div>
          </div>

          {showBidForm && (
            <form onSubmit={handleBid} className="mt-4 animate-slide-in rounded-[1.5rem] border border-primary/12 bg-gradient-to-br from-primary/[0.06] via-base-100 to-base-100 p-4 shadow-[0_18px_40px_rgba(59,130,246,0.08)] sm:p-5">
              <h4 className="mb-3 font-semibold">Submit Your Proposal</h4>
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="form-control">
                  <label className="label"><span className="label-text">Your Bid (INR)</span></label>
                  <input type="number" className="input input-bordered w-full" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} placeholder="Enter amount" required min="1" step="1" />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Delivery time</span></label>
                  <select className="select select-bordered w-full" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)}>
                    {deliveryTimeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Cover Letter</span>
                  <span className="label-text-alt">{bidMessage.trim().length}/{MAX_BID_MESSAGE_LENGTH}</span>
                </label>
                <textarea className="textarea textarea-bordered h-24 w-full" value={bidMessage} onChange={(e) => setBidMessage(e.target.value)} placeholder="Describe why you're perfect for this task..." required maxLength={MAX_BID_MESSAGE_LENGTH}></textarea>
              </div>
              <button type="submit" className={`btn btn-primary min-h-[3.25rem] w-full rounded-full text-white ${submittingBid ? 'loading' : ''}`} disabled={submittingBid}>Submit Bid</button>
            </form>
          )}

          {task.bids?.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-3 font-semibold">Current Bids ({task.bids.length})</h4>
              <div className="space-y-3">
                {task.bids.map((bid, idx) => (
                  <div key={idx} className="flex flex-col justify-between gap-3 rounded-lg bg-base-200 p-3 sm:flex-row sm:items-start sm:justify-between">
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
                      subtitleClassName="mt-1 text-xs text-base-content/50"
                    />
                    <div className="sm:max-w-[12rem] sm:text-right">
                      <div className="text-base font-bold text-primary sm:text-lg">{formatCurrency(bid.amount)}</div>
                      <div className="mt-1 line-clamp-2 text-sm text-base-content/60">{bid.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </dialog>
  );
};

export default TaskDetailModal;
