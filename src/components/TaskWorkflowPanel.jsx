import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../config';
import {
  acceptBidForTask,
  addWorkspaceEntry,
  CONTACT_BLOCK_MESSAGE,
  getAcceptedBid,
  getTaskBaseAmount,
  getTaskPlatformFeeAmount,
  getTaskPlatformFeePercent,
  getTaskTotalPaidByClient,
  submitTaskDelivery,
  subscribeToTaskDeliveries,
  subscribeToTaskWorkspace,
  updateTaskReviewState,
  submitRefundRequest,
  deleteTaskByClient,
  repostExpiredTask,
  calculateRefundBreakdown,
  REFUND_FEE_PERCENT,
} from '../lib/workflow';
import { formatFirestoreDate } from '../firebase';
import { getMaskedPayoutDestinationSummary, subscribeToTaskPayoutRequest, submitTaskPayoutDetails } from '../lib/payouts';
import PublicUserIdentity from './PublicUserIdentity';
import PayForTaskButton from './PayForTaskButton';

const emptyProgress = { preview: 0, attachment: 0 };

const buildDownloadUrl = (url = '') => url || '';

const TaskWorkflowPanel = ({ task, mode = 'client' }) => {
  const { user } = useAuth();
  const [workspaceEntries, setWorkspaceEntries] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [workspaceMessage, setWorkspaceMessage] = useState('');
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [previewVideo, setPreviewVideo] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [deliveryProgress, setDeliveryProgress] = useState(emptyProgress);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [payoutRequest, setPayoutRequest] = useState(null);
  const [payoutMethod, setPayoutMethod] = useState('upi');
  const [payoutAccountHolderName, setPayoutAccountHolderName] = useState('');
  const [payoutUpiId, setPayoutUpiId] = useState('');
  const [payoutAccountNumber, setPayoutAccountNumber] = useState('');
  const [payoutIfsc, setPayoutIfsc] = useState('');
  const [payoutBankName, setPayoutBankName] = useState('');

  useEffect(() => {
    const unsubWorkspace = subscribeToTaskWorkspace(task.id, setWorkspaceEntries, (snapshotError) => {
      console.error('Failed to load workspace:', snapshotError);
    });
    const unsubDeliveries = subscribeToTaskDeliveries(task.id, setDeliveries, (snapshotError) => {
      console.error('Failed to load deliveries:', snapshotError);
    });
    const unsubPayoutRequest = subscribeToTaskPayoutRequest(task.id, (nextRequest) => {
      setPayoutRequest(nextRequest);
      if (nextRequest?.payoutMethod) setPayoutMethod(nextRequest.payoutMethod);
      if (nextRequest?.payoutDetails?.accountHolderName) setPayoutAccountHolderName(nextRequest.payoutDetails.accountHolderName);
      if (nextRequest?.payoutDetails?.upiId) setPayoutUpiId(nextRequest.payoutDetails.upiId);
      if (nextRequest?.payoutDetails?.accountNumber) setPayoutAccountNumber(nextRequest.payoutDetails.accountNumber);
      if (nextRequest?.payoutDetails?.ifsc) setPayoutIfsc(nextRequest.payoutDetails.ifsc);
      if (nextRequest?.payoutDetails?.bankName) setPayoutBankName(nextRequest.payoutDetails.bankName);
    }, (snapshotError) => {
      console.error('Failed to load payout request:', snapshotError);
    });
    return () => {
      unsubWorkspace();
      unsubDeliveries();
      unsubPayoutRequest();
    };
  }, [task.id]);

  const latestDelivery = deliveries[0] || null;
  const acceptedBid = useMemo(() => getAcceptedBid(task), [task]);
  const isClient = task.postedById === user?.uid;
  const isSelectedFreelancer = (task.selectedFreelancerId || task.assignedTo) === user?.uid;
  const isPaymentPaid = ['paid', 'escrow_held', 'released'].includes(task.paymentStatus);
  const canSubmitDelivery = mode === 'assigned' && isSelectedFreelancer && isPaymentPaid && ['in_progress', 'revision_requested'].includes(task.status);
  const canReviewDelivery = mode === 'client' && isClient && ['delivered', 'revision_requested'].includes(task.status);
  const canAddWorkspaceUpdate = mode !== 'readonly' && (isClient || isSelectedFreelancer);
  const baseAmount = getTaskBaseAmount(task);
  const platformFeeAmount = getTaskPlatformFeeAmount(task);
  const platformFeePercent = getTaskPlatformFeePercent(task);
  const totalPaidByClient = getTaskTotalPaidByClient(task);
  const freelancerFeeAmount = Math.max(0, Math.round(Number(task.freelancerFeeAmount ?? (baseAmount * (platformFeePercent / 100))) || 0));
  const netAmountToFreelancer = Math.max(0, Math.round(Number(task.netAmountToFreelancer ?? (baseAmount - freelancerFeeAmount)) || 0));
  const showFreelancerNetSummary = isSelectedFreelancer && !isClient;
  const canRequestRefund = isClient && ['escrow_held', 'paid'].includes(task.paymentStatus) && !['refund_pending', 'refunded'].includes(String(task.refundStatus || '').toLowerCase()) && ['in_progress', 'awaiting_payment', 'delivered', 'revision_requested'].includes(task.status);
  const refundIsPending = String(task.refundStatus || '').toLowerCase() === 'refund_pending';
  const refundIsDone = String(task.refundStatus || '').toLowerCase() === 'refunded';
  const canDeleteTask = isClient && ['open', 'expired'].includes(task.status);
  const canRepostTask = isClient && task.status === 'expired';
  const payoutStatus = String(payoutRequest?.status || task.payoutStatus || '').toLowerCase();
  const isPayoutPaid = payoutStatus === 'paid';
  const payoutPaidAt = payoutRequest?.paidAt || payoutRequest?.processedAt || task.payoutProcessedAt || payoutRequest?.approvedAt;
  const payoutDestinationSummary = getMaskedPayoutDestinationSummary(payoutRequest);
  const hasSubmittedPayoutDetails = Boolean(payoutRequest?.payoutDetails || payoutRequest?.payoutDetailsMasked || payoutRequest?.submittedAt || payoutRequest?.createdAt || task.payoutRequestId);
  const canSubmitPayoutDetails = isSelectedFreelancer && task.status === 'completed' && isPaymentPaid && !['refund_pending', 'refunded', 'partial_refund'].includes(String(task.refundStatus || '').toLowerCase()) && payoutStatus !== 'paid' && !hasSubmittedPayoutDetails;

  const setActionState = (action, stateError = '', stateSuccess = '') => {
    setBusyAction(action);
    setError(stateError);
    setSuccess(stateSuccess);
  };

  const finalizeAction = (message = '') => {
    setBusyAction('');
    if (message) setSuccess(message);
  };

  const handleRefundRequest = async (event) => {
    event.preventDefault();
    if (!refundReason.trim()) return;
    try {
      setActionState('refund');
      await submitRefundRequest({ task, actor: user, reason: refundReason });
      setRefundReason('');
      setShowRefundForm(false);
      finalizeAction('Refund request submitted. Admin will review shortly.');
    } catch (actionError) {
      setBusyAction('');
      setError(actionError.message || 'Unable to submit refund request right now.');
    }
  };

  const handleDeleteTask = async () => {
    try {
      setActionState('delete');
      await deleteTaskByClient({ task, actor: user });
      finalizeAction('Task deleted successfully.');
      setShowDeleteConfirm(false);
    } catch (actionError) {
      setBusyAction('');
      setError(actionError.message || 'Unable to delete task right now.');
    }
  };

  const handleRepostTask = async () => {
    try {
      setActionState('repost');
      await repostExpiredTask({ task, actor: user });
      finalizeAction('Task reposted! It is now open for new bids.');
    } catch (actionError) {
      setBusyAction('');
      setError(actionError.message || 'Unable to repost task right now.');
    }
  };

  const handleAcceptBid = async (bid) => {
    try {
      setActionState(`accept-${bid.freelancerId}`);
      await acceptBidForTask({ task, bid, actor: user });
      finalizeAction('Bid accepted. Task is now awaiting client payment.');
    } catch (actionError) {
      setBusyAction('');
      setError(actionError.message || 'Unable to accept bid right now.');
    }
  };

  const handleWorkspaceSubmit = async (event) => {
    event.preventDefault();
    if (!workspaceMessage.trim()) return;
    try {
      setActionState('workspace');
      await addWorkspaceEntry({ task, actor: user, entryType: 'task_update', message: workspaceMessage });
      setWorkspaceMessage('');
      finalizeAction('Workspace update added.');
    } catch (actionError) {
      setBusyAction('');
      setError(actionError.message || CONTACT_BLOCK_MESSAGE);
    }
  };

  const handleDeliverySubmit = async (event) => {
    event.preventDefault();
    try {
      setActionState('delivery');
      setDeliveryProgress(emptyProgress);
      await submitTaskDelivery({
        task,
        actor: user,
        deliveryMessage,
        externalDeliveryLink: externalLink,
        previewVideo,
        attachment,
        onProgress: (key, value) => setDeliveryProgress((current) => ({ ...current, [key]: value })),
      });
      setDeliveryMessage('');
      setExternalLink('');
      setPreviewVideo(null);
      setAttachment(null);
      setDeliveryProgress(emptyProgress);
      finalizeAction('Delivery submitted successfully.');
    } catch (actionError) {
      setBusyAction('');
      setError(actionError.message || 'Unable to submit delivery right now.');
    }
  };

  const handleReviewAction = async (status) => {
    try {
      setActionState(status);
      await updateTaskReviewState({ task, actor: user, status, note: revisionNote });
      if (status !== 'revision_requested') setRevisionNote('');
      finalizeAction(status === 'completed' ? 'Work accepted.' : status === 'revision_requested' ? 'Revision requested.' : 'Dispute raised.');
    } catch (actionError) {
      setBusyAction('');
      setError(actionError.message || 'Unable to update task status right now.');
    }
  };


  const handlePayoutDetailsSubmit = async (event) => {
    event.preventDefault();
    try {
      setActionState('payout-details');
      await submitTaskPayoutDetails({
        task,
        actor: user,
        existingRequest: payoutRequest,
        details: payoutMethod === 'bank_account'
          ? {
              method: 'bank_account',
              accountHolderName: payoutAccountHolderName,
              accountNumber: payoutAccountNumber,
              ifsc: payoutIfsc,
              bankName: payoutBankName,
            }
          : {
              method: 'upi',
              accountHolderName: payoutAccountHolderName,
              upiId: payoutUpiId,
            },
      });
      finalizeAction('Payout details submitted for admin review.');
    } catch (actionError) {
      setBusyAction('');
      setError(actionError.message || 'Unable to submit payout details right now.');
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h4 className="text-lg font-semibold">Task workflow</h4>
          <p className="text-sm text-base-content/60">Manage bids, payment gating, delivery, revisions, and workspace updates without leaving the platform.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <span className="badge badge-outline">{task.status || 'open'}</span>
          <span className={`badge ${isPaymentPaid ? 'badge-success' : task.status === 'awaiting_payment' ? 'badge-warning' : 'badge-outline'}`}>
            Payment: {task.paymentStatus || 'unpaid'}
          </span>
          {task.status === 'completed' ? <span className="badge badge-outline">Payout: {payoutStatus || task.payoutStatus || 'details_pending'}</span> : null}
        </div>
      </div>

      {error ? <div className="alert alert-error"><span>{error}</span></div> : null}
      {success ? <div className="alert alert-success"><span>{success}</span></div> : null}

      {mode === 'client' && task.status === 'open' && (task.bids || []).length > 0 ? (
        <div className="space-y-3">
          <h5 className="font-semibold">Bids received</h5>
          {(task.bids || []).map((bid) => (
            <div key={`${bid.freelancerId}-${bid.createdAt}`} className="rounded-xl border border-base-200 bg-base-200/60 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <PublicUserIdentity
                    userId={bid.freelancerId}
                    name={bid.freelancerName || bid.freelancerEmail || 'Freelancer'}
                    photoURL={bid.freelancerPhoto || ''}
                    subtitle={`Delivery: ${bid.deliveryTime || 'Flexible'} • ${formatFirestoreDate(bid.createdAt)}`}
                    showAction={Boolean(bid.freelancerId)}
                    actionLabel="View Profile"
                    containerClassName="min-w-0"
                    avatarClassName="h-10 w-10"
                    nameClassName="break-words font-semibold"
                    subtitleClassName="text-xs text-base-content/55"
                  />
                  <div className="whitespace-pre-wrap text-sm text-base-content/80">{bid.message}</div>
                </div>
                <div className="flex flex-col gap-2 lg:items-end">
                  <div className="text-lg font-bold text-primary">{formatCurrency(bid.amount)}</div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm w-full sm:w-auto"
                    disabled={Boolean(task.selectedFreelancerId || task.assignedTo) || busyAction === `accept-${bid.freelancerId}`}
                    onClick={() => handleAcceptBid(bid)}
                  >
                    {busyAction === `accept-${bid.freelancerId}` ? 'Accepting...' : 'Accept Bid'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {acceptedBid ? (
        <div className="space-y-4 rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Accepted freelancer</div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <PublicUserIdentity
                  userId={acceptedBid.freelancerId}
                  name={acceptedBid.freelancerName || 'Freelancer'}
                  photoURL={acceptedBid.freelancerPhoto || ''}
                  subtitle=""
                  showAction={Boolean(acceptedBid.freelancerId)}
                  actionLabel="View Profile"
                  containerClassName="min-w-0 flex-1"
                  avatarClassName="h-10 w-10"
                  nameClassName="font-semibold"
                  subtitleClassName="break-all text-xs text-base-content/55"
                />
                <div className="font-semibold text-base-content/80">{formatCurrency(baseAmount)}</div>
              </div>
            </div>
            <div className="grid min-w-0 gap-2 rounded-2xl border border-base-300 bg-base-100/80 p-3 sm:min-w-[280px]">
              <div className="flex items-center justify-between gap-3"><span className="text-base-content/60">Accepted amount</span><span className="font-semibold">{formatCurrency(baseAmount)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-base-content/60">{showFreelancerNetSummary ? `Service fee (${platformFeePercent}%)` : `Platform fee (${platformFeePercent}%)`}</span><span className="font-semibold">{formatCurrency(showFreelancerNetSummary ? freelancerFeeAmount : platformFeeAmount)}</span></div>
              <div className="flex items-center justify-between gap-3 border-t border-base-300 pt-2"><span className="font-medium">{showFreelancerNetSummary ? 'You receive' : 'Total payable'}</span><span className="font-bold text-primary">{formatCurrency(showFreelancerNetSummary ? netAmountToFreelancer : totalPaidByClient)}</span></div>
            </div>
          </div>

          {task.status === 'awaiting_payment' && isClient ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
              <p className="text-sm text-base-content/80">Payment is pending. The order will become active only after verified client payment. After payment, funds remain protected in escrow until completion or owner action.</p>
              <div className="mt-3 w-full sm:w-auto sm:max-w-xs"><PayForTaskButton task={task} /></div>
            </div>
          ) : null}

          {task.status === 'awaiting_payment' && isSelectedFreelancer ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-base-content/80">
              <div className="font-semibold">You have been selected</div>
              <p className="mt-1">Waiting for client payment. Work can begin only after payment confirmation and escrow funding.</p>
            </div>
          ) : null}

          {isPaymentPaid ? (
            <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-base-content/80">
              <div className="font-semibold">{isPayoutPaid ? 'Payment completed' : 'Order active'}</div>
              <p className="mt-1">
                {isPayoutPaid
                  ? `Your payment is done through TaskMarket${payoutPaidAt ? ` on ${formatFirestoreDate(payoutPaidAt)}` : ''}.${payoutDestinationSummary ? ` Transfer destination: ${payoutDestinationSummary}.` : ''}`
                  : 'Payment has been verified and funds are now held in escrow. Delivery tools are unlocked for the selected freelancer.'}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {latestDelivery ? (
        <div className="space-y-3 rounded-xl border border-base-200 bg-base-200/40 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h5 className="font-semibold">Latest delivery</h5>
              <div className="mt-3">
                <PublicUserIdentity
                  userId={latestDelivery.freelancerId}
                  name={latestDelivery.freelancerName || 'Freelancer'}
                  photoURL={latestDelivery.freelancerPhoto || ''}
                  subtitle={`Submitted on ${formatFirestoreDate(latestDelivery.submittedAt)}`}
                  showAction={Boolean(latestDelivery.freelancerId)}
                  actionLabel="View Profile"
                  avatarClassName="h-10 w-10"
                  nameClassName="font-semibold"
                  subtitleClassName="text-xs text-base-content/55"
                />
              </div>
            </div>
            <span className="badge badge-outline">{latestDelivery.status || task.status}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-base-content/80">{latestDelivery.deliveryMessage}</p>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] xl:items-start">
            {latestDelivery.previewVideoUrl ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Preview video</div>
                <div className="overflow-hidden rounded-2xl border border-base-300 bg-black/70">
                  <video controls className="aspect-video w-full">
                    <source src={latestDelivery.previewVideoUrl} />
                  </video>
                </div>
              </div>
            ) : null}
            <div className="flex h-full flex-col justify-start gap-3 rounded-2xl border border-base-300 bg-base-100/70 p-3 sm:p-4">
              {latestDelivery.externalDeliveryLink ? (
                <a className="btn btn-outline btn-sm w-full justify-center" href={latestDelivery.externalDeliveryLink} target="_blank" rel="noreferrer">Open final delivery link</a>
              ) : null}
              {(latestDelivery.attachments || []).map((item, index) => (
                <div key={item.path || item.publicId || `${item.name}-${index}`} className="space-y-1">
                  <div className="text-sm font-medium">Attachment</div>
                  <a
                    className="btn btn-ghost btn-sm h-auto min-h-0 w-full justify-start whitespace-normal break-all px-3 py-2 text-left normal-case"
                    href={buildDownloadUrl(item.downloadURL)}
                    target="_blank"
                    rel="noreferrer"
                    title={item.name || 'Open attachment'}
                  >
                    {item.name || 'Open attachment'}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {mode === 'assigned' && isSelectedFreelancer && !isPaymentPaid ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-base-content/80">
          <h5 className="font-semibold">Delivery locked</h5>
          <p className="mt-1">Client payment is pending. Work can begin only after payment confirmation.</p>
        </div>
      ) : null}

      {canSubmitDelivery ? (
        <form className="space-y-4 rounded-xl border border-base-200 bg-base-200/40 p-4" onSubmit={handleDeliverySubmit}>
          <div>
            <h5 className="font-semibold">Submit delivery</h5>
            <p className="text-sm text-base-content/60">Upload a preview or demo video, optional support files, and your final external delivery link. Delivery is enabled only after verified payment.</p>
          </div>
          <textarea
            className="textarea textarea-bordered h-28 w-full"
            placeholder="Summarise what you completed, what the client should review, and any instructions."
            value={deliveryMessage}
            onChange={(event) => setDeliveryMessage(event.target.value)}
            disabled={busyAction === 'delivery'}
            required
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="label"><span className="label-text font-medium">Preview video (MP4/WebM/MOV/MKV, max 100 MB, 3 min)</span></label>
              <input className="file-input file-input-bordered w-full" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/ogg,.mov,.mkv,.ogv" onChange={(event) => setPreviewVideo(event.target.files?.[0] || null)} disabled={busyAction === 'delivery'} />
              {deliveryProgress.preview > 0 ? <progress className="progress progress-primary w-full" value={deliveryProgress.preview} max="100"></progress> : null}
            </div>
            <div className="space-y-2">
              <label className="label"><span className="label-text font-medium">Attachment (image/PDF/DOC/ZIP/7Z/RAR/video, max 100 MB)</span></label>
              <input className="file-input file-input-bordered w-full" type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.doc,.docx,.zip,.7z,.rar,video/mp4,video/webm,video/quicktime,video/x-matroska,.mov,.mkv" onChange={(event) => setAttachment(event.target.files?.[0] || null)} disabled={busyAction === 'delivery'} />
              {deliveryProgress.attachment > 0 ? <progress className="progress progress-secondary w-full" value={deliveryProgress.attachment} max="100"></progress> : null}
            </div>
          </div>
          <input
            type="url"
            className="input input-bordered w-full"
            placeholder="Final delivery link (Drive, Dropbox, GitHub, Figma, etc.)"
            value={externalLink}
            onChange={(event) => setExternalLink(event.target.value)}
            disabled={busyAction === 'delivery'}
          />
          <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={busyAction === 'delivery'}>
            {busyAction === 'delivery' ? 'Submitting delivery...' : 'Submit delivery'}
          </button>
        </form>
      ) : null}

      {canReviewDelivery ? (
        <div className="space-y-3 rounded-xl border border-base-200 bg-base-200/40 p-4">
          <div>
            <h5 className="font-semibold">Review delivery</h5>
            <p className="text-sm text-base-content/60">Accept the work, request a revision, or flag the task for dispute review.</p>
          </div>
          <textarea
            className="textarea textarea-bordered h-24 w-full"
            placeholder="Add revision details or review notes for the freelancer."
            value={revisionNote}
            onChange={(event) => setRevisionNote(event.target.value)}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="button" className="btn btn-success" onClick={() => handleReviewAction('completed')} disabled={busyAction === 'completed'}>
              {busyAction === 'completed' ? 'Accepting...' : 'Accept Work'}
            </button>
            <button type="button" className="btn btn-warning" onClick={() => handleReviewAction('revision_requested')} disabled={busyAction === 'revision_requested'}>
              {busyAction === 'revision_requested' ? 'Requesting...' : 'Request Revision'}
            </button>
            <button type="button" className="btn btn-outline btn-error" onClick={() => handleReviewAction('disputed')} disabled={busyAction === 'disputed'}>
              {busyAction === 'disputed' ? 'Opening...' : 'Raise Dispute'}
            </button>
          </div>
        </div>
      ) : null}

      {task.status === 'completed' && (isSelectedFreelancer || isClient) ? (
        <div className="space-y-3 rounded-xl border border-base-200 bg-base-200/30 p-4">
          <div>
            <h5 className="font-semibold">Payout status</h5>
            <p className="text-sm text-base-content/60">
              {isSelectedFreelancer
                ? hasSubmittedPayoutDetails
                  ? 'Your payout details are already saved for this task and are locked from further changes.'
                  : 'Submit payout details so the owner can review and process your transfer.'
                : 'Freelancer payout is reviewed separately after client approval and detail submission.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="badge badge-outline">Status: {payoutStatus || task.payoutStatus || 'details_pending'}</span>
            {payoutRequest?.amount ? <span className="badge badge-outline">Net payout: {formatCurrency(payoutRequest.amount)}</span> : task.netAmountToFreelancer ? <span className="badge badge-outline">Net payout: {formatCurrency(task.netAmountToFreelancer)}</span> : null}
            {payoutRequest?.payoutMethod ? <span className="badge badge-outline">Method: {payoutRequest.payoutMethod}</span> : null}
          </div>
          {payoutRequest?.failureReason ? <div className="text-sm text-error">Failure reason: {payoutRequest.failureReason}</div> : null}
          {payoutRequest?.rejectionReason ? <div className="text-sm text-error">Rejection reason: {payoutRequest.rejectionReason}</div> : null}

          {isSelectedFreelancer && isPayoutPaid ? (
            <div className="grid gap-3 rounded-2xl border border-success/20 bg-success/5 p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="font-semibold">Payment details</div>
                <div className="text-sm text-base-content/70">Task: <span className="font-medium text-base-content">{payoutRequest?.taskTitle || task.title || '—'}</span></div>
                <div className="text-sm text-base-content/70">Amount: <span className="font-semibold text-success">{formatCurrency(payoutRequest?.amount || task.netAmountToFreelancer || 0)}</span></div>
                <div className="text-sm text-base-content/70">Method: <span className="font-medium text-base-content">{payoutRequest?.payoutMethod || task.payoutMethod || '—'}</span></div>
                {payoutDestinationSummary ? <div className="text-sm text-base-content/70">Sent to: <span className="font-medium text-base-content">{payoutDestinationSummary}</span></div> : null}
              </div>
              <div className="space-y-2">
                <div className="font-semibold">Timeline</div>
                <div className="text-sm text-base-content/70">Submitted: <span className="font-medium text-base-content">{formatFirestoreDate(payoutRequest?.submittedAt || payoutRequest?.createdAt)}</span></div>
                <div className="text-sm text-base-content/70">Approved: <span className="font-medium text-base-content">{formatFirestoreDate(payoutRequest?.approvedAt)}</span></div>
                <div className="text-sm text-base-content/70">Paid: <span className="font-medium text-base-content">{formatFirestoreDate(payoutPaidAt)}</span></div>
                <div className="text-sm text-base-content/70">Status: <span className="font-medium text-success">Paid</span></div>
              </div>
            </div>
          ) : null}

          {isSelectedFreelancer && hasSubmittedPayoutDetails ? (
            <div className="rounded-2xl border border-base-300 bg-base-100/70 p-4 space-y-3">
              <div className="font-semibold">Saved payout details</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 text-sm text-base-content/70">
                  <div>Account holder: <span className="font-medium text-base-content">{payoutRequest?.payoutDetails?.accountHolderName || payoutRequest?.payoutDetailsMasked?.accountHolderName || '—'}</span></div>
                  <div>Method: <span className="font-medium text-base-content">{payoutRequest?.payoutMethod || task.payoutMethod || '—'}</span></div>
                  {payoutDestinationSummary ? <div>Destination: <span className="font-medium text-base-content">{payoutDestinationSummary}</span></div> : null}
                </div>
                <div className="space-y-2 text-sm text-base-content/70">
                  <div>Status: <span className="font-medium text-base-content">{payoutStatus || task.payoutStatus || 'details_submitted'}</span></div>
                  <div>Submitted: <span className="font-medium text-base-content">{formatFirestoreDate(payoutRequest?.submittedAt || payoutRequest?.createdAt)}</span></div>
                  <div className="text-warning">Payout details are locked after the first submission.</div>
                </div>
              </div>
            </div>
          ) : canSubmitPayoutDetails ? (
            <form className="space-y-3" onSubmit={handlePayoutDetailsSubmit}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="form-control">
                  <span className="label-text font-medium">Payout method</span>
                  <select className="select select-bordered w-full" value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value)} disabled={busyAction === 'payout-details'}>
                    <option value="upi">UPI</option>
                    <option value="bank_account">Bank account</option>
                  </select>
                </label>
                <label className="form-control">
                  <span className="label-text font-medium">Account holder name</span>
                  <input className="input input-bordered w-full" value={payoutAccountHolderName} onChange={(event) => setPayoutAccountHolderName(event.target.value)} disabled={busyAction === 'payout-details'} />
                </label>
              </div>
              {payoutMethod === 'bank_account' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="form-control">
                    <span className="label-text font-medium">Account number</span>
                    <input className="input input-bordered w-full" value={payoutAccountNumber} onChange={(event) => setPayoutAccountNumber(event.target.value)} disabled={busyAction === 'payout-details'} />
                  </label>
                  <label className="form-control">
                    <span className="label-text font-medium">IFSC</span>
                    <input className="input input-bordered w-full" value={payoutIfsc} onChange={(event) => setPayoutIfsc(event.target.value.toUpperCase())} disabled={busyAction === 'payout-details'} />
                  </label>
                  <label className="form-control">
                    <span className="label-text font-medium">Bank name</span>
                    <input className="input input-bordered w-full" value={payoutBankName} onChange={(event) => setPayoutBankName(event.target.value)} disabled={busyAction === 'payout-details'} />
                  </label>
                </div>
              ) : (
                <label className="form-control">
                  <span className="label-text font-medium">UPI ID</span>
                  <input className="input input-bordered w-full" value={payoutUpiId} onChange={(event) => setPayoutUpiId(event.target.value)} disabled={busyAction === 'payout-details'} />
                </label>
              )}
              <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={busyAction === 'payout-details'}>
                {busyAction === 'payout-details' ? 'Submitting...' : 'Submit payout details'}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {/* ── Expired Task: Repost or Delete ── */}
      {canRepostTask ? (
        <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/8 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⏰</span>
            <div className="min-w-0 flex-1">
              <h5 className="font-semibold text-warning">Task expired</h5>
              <p className="mt-1 text-sm text-base-content/70">No freelancer was selected before this task expired. You can repost it to accept new bids, or delete it.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn btn-warning btn-sm"
              disabled={busyAction === 'repost'}
              onClick={handleRepostTask}
            >
              {busyAction === 'repost' ? 'Reposting...' : '🔄 Repost task'}
            </button>
            {canDeleteTask && (
              <button
                type="button"
                className="btn btn-outline btn-error btn-sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                🗑️ Delete task
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Delete Task (open tasks) ── */}
      {canDeleteTask && !canRepostTask ? (
        <div className="rounded-xl border border-base-200 bg-base-200/30 p-4">
          <button
            type="button"
            className="btn btn-outline btn-error btn-sm"
            onClick={() => setShowDeleteConfirm(true)}
          >
            🗑️ Delete this task
          </button>
        </div>
      ) : null}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-base-200 bg-base-100 p-6 shadow-2xl">
            <h3 className="text-lg font-bold">Delete task?</h3>
            <p className="mt-2 text-sm text-base-content/70">This action cannot be undone. The task and all its data will be permanently removed.</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="btn btn-error flex-1"
                disabled={busyAction === 'delete'}
                onClick={handleDeleteTask}
              >
                {busyAction === 'delete' ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button
                type="button"
                className="btn btn-outline flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Refund Section ── */}
      {refundIsDone ? (
        <div className="rounded-xl border border-success/30 bg-success/8 p-4">
          <div className="flex items-center gap-2 text-success">
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="font-semibold">Refund processed</span>
          </div>
          <p className="mt-1 text-sm text-base-content/70">Your refund has been approved and will be credited to your account.</p>
        </div>
      ) : null}

      {refundIsPending && isClient ? (
        <div className="rounded-xl border border-warning/30 bg-warning/8 p-4">
          <div className="flex items-center gap-2 text-warning">
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="font-semibold">Refund request pending</span>
          </div>
          <p className="mt-1 text-sm text-base-content/70">Your refund request is under review. Admin will process it shortly.</p>
        </div>
      ) : null}

      {refundIsPending && isSelectedFreelancer ? (
        <div className="rounded-xl border border-warning/30 bg-warning/8 p-4">
          <div className="flex items-center gap-2 text-warning">
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="font-semibold">Client refund in progress</span>
          </div>
          <p className="mt-1 text-sm text-base-content/70">The client has requested a refund for this task. Task status will update once admin reviews the request.</p>
        </div>
      ) : null}

      {canRequestRefund ? (
        <div className="rounded-xl border border-base-200 bg-base-200/30 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h5 className="font-semibold">Request refund</h5>
              <p className="text-sm text-base-content/60">If you are not satisfied, you can request a refund. Admin will review your request.</p>
            </div>
            {!showRefundForm && (
              <button
                type="button"
                className="btn btn-outline btn-warning btn-sm shrink-0"
                onClick={() => setShowRefundForm(true)}
              >
                Request refund
              </button>
            )}
          </div>
          {showRefundForm ? (
            <form className="space-y-3" onSubmit={handleRefundRequest}>
              {/* Refund breakdown preview */}
              {(() => {
                const gross = task.clientTotalPayable || task.totalPaidByClient || task.acceptedAmount || task.amount || 0;
                const { feeAmount, refundAmount } = calculateRefundBreakdown(gross);
                return gross > 0 ? (
                  <div className="rounded-xl border border-warning/25 bg-warning/8 p-3 space-y-1.5 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-base-content/45 mb-2">Refund breakdown</p>
                    <div className="flex justify-between"><span className="text-base-content/65">Amount paid</span><span className="font-medium">{formatCurrency(gross)}</span></div>
                    <div className="flex justify-between text-error">
                      <span className="text-base-content/65">
                        Processing fee ({getRefundFeePercent(gross)}%
                        {gross <= 5000 ? ' · up to ₹5,000' : gross <= 10000 ? ' · ₹5,001–₹10,000' : ' · above ₹10,000'})
                      </span>
                      <span className="font-medium">− {formatCurrency(feeAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-base-200 pt-1.5 font-semibold"><span>You will receive</span><span className="text-success">{formatCurrency(refundAmount)}</span></div>
                    <p className="text-[11px] text-base-content/40 pt-0.5">Fee slabs: ≤₹5k → 10% · ₹5k–₹10k → 8% · above ₹10k → 4%</p>
                  </div>
                ) : null;
              })()}
              <div>
                <label className="label"><span className="label-text font-medium">Why are you requesting a refund?</span></label>
                <textarea
                  className="textarea textarea-bordered h-24 w-full"
                  placeholder="Please describe why you would like a refund (e.g. work not delivered, quality issues, etc.)"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  disabled={busyAction === 'refund'}
                  maxLength={500}
                />
                <p className="mt-1 text-xs text-base-content/45">{refundReason.length}/500 characters</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="btn btn-warning btn-sm"
                  disabled={busyAction === 'refund' || !refundReason.trim()}
                >
                  {busyAction === 'refund' ? 'Submitting...' : 'Submit refund request'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setShowRefundForm(false); setRefundReason(''); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border border-base-200 bg-base-200/30 p-4">
        <div>
          <h5 className="font-semibold">Structured workspace</h5>
          <p className="text-sm text-base-content/60">Use updates, delivery notes, and revision requests here. Personal contact sharing is blocked. Only paid orders are covered by platform workflow.</p>
        </div>
        {canAddWorkspaceUpdate ? (
          <form className="space-y-3" onSubmit={handleWorkspaceSubmit}>
            <textarea
              className="textarea textarea-bordered h-24 w-full"
              placeholder="Add a task update, delivery note, or revision instruction."
              value={workspaceMessage}
              onChange={(event) => setWorkspaceMessage(event.target.value)}
              disabled={busyAction === 'workspace'}
            />
            <button type="submit" className="btn btn-outline btn-primary w-full sm:w-auto" disabled={busyAction === 'workspace'}>
              {busyAction === 'workspace' ? 'Posting update...' : 'Add workspace update'}
            </button>
          </form>
        ) : null}
        <div className="space-y-2">
          {workspaceEntries.length === 0 ? (
            <p className="text-sm text-base-content/60">No workspace activity yet.</p>
          ) : workspaceEntries.slice(-6).reverse().map((entry) => (
            <div key={entry.id} className="rounded-lg border border-base-200 bg-base-100 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-medium">{entry.entryType.replace('_', ' ')}</div>
                  <div className="mt-2">
                    <PublicUserIdentity
                      userId={entry.createdById}
                      name={entry.createdByName || 'User'}
                      photoURL={entry.createdByPhoto || ''}
                      subtitle={formatFirestoreDate(entry.createdAt)}
                      showAction={Boolean(entry.createdById)}
                      actionLabel="View Profile"
                      avatarClassName="h-8 w-8"
                      nameClassName="text-sm font-medium"
                      subtitleClassName="text-xs text-base-content/55"
                    />
                  </div>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-base-content/80">{entry.message}</p>
              {(entry.attachments || []).map((file) => (
                <a key={file.path} className="mt-2 block text-sm text-primary underline" href={file.downloadURL} target="_blank" rel="noreferrer">{file.name}</a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TaskWorkflowPanel;
