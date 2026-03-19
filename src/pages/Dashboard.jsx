{visibleTasks.length === 0 ? (
  <section className="rounded-[1.75rem] border border-dashed border-base-300 bg-[linear-gradient(180deg,rgba(102,126,234,0.06),transparent)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-10">
    <div className="flex min-h-[16rem] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/12 text-3xl">{ec.icon}</div>
      <h2 className="text-2xl font-semibold">{ec.title}</h2>
      <p className="mt-3 max-w-md text-sm leading-7 text-base-content/65 sm:text-base">{ec.desc}</p>
      <Link to={ec.to} className="btn btn-primary mt-6 rounded-full px-6 text-white shadow-[0_14px_30px_rgba(102,126,234,0.3)]">
        {ec.cta}
      </Link>
    </div>
  </section>
) : (
  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(24rem,0.95fr)_minmax(0,1.05fr)] xl:items-stretch">
    <section className="rounded-[12px] border border-base-300 bg-base-100/95 shadow-[0_22px_56px_rgba(15,23,42,0.09)] xl:flex xl:min-h-[calc(100vh-10.75rem)] xl:max-h-[calc(100vh-10.75rem)] xl:flex-col xl:overflow-hidden">
      <div className="border-b border-base-300 bg-base-100/90 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Task List</h2>
            <p className="mt-1 text-sm text-base-content/58">Select any task to inspect workflow details.</p>
          </div>
          <div className="rounded-full bg-base-200/70 px-3 py-1.5 text-xs font-medium text-base-content/60">{visibleTasks.length} items</div>
        </div>
      </div>
      <div className="task-scroll-shell rounded-b-[2rem] bg-base-100/55 p-1 pt-0 xl:min-h-0 xl:flex-1 xl:overflow-hidden">
        <div className="task-list-scroll space-y-3 rounded-[8px] px-4 py-4 sm:px-5 sm:py-5 xl:h-full xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto xl:bg-base-100/60">
          {visibleTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => setExpandedTaskId(task.id)}
              className={`w-full rounded-[1.5rem] border p-4 text-left transition ${expandedTaskId === task.id ? 'border-primary/30 bg-primary/8 shadow-[0_16px_35px_rgba(102,126,234,0.18)]' : 'border-base-200 bg-base-200/45 hover:border-primary/20 hover:bg-base-200/72'}`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="break-words text-base font-semibold">{task.title}</div>
                    <div className="mt-1 break-words text-sm text-base-content/60">{task.category} • {formatCurrency(task.budget)}</div>
                  </div>
                  {activeTab === 'bids' ? (
                    <div className="max-w-full rounded-full bg-base-100 px-3 py-1 text-xs font-medium text-base-content/70">
                      {(task.selectedFreelancerId || task.assignedTo) === user?.uid
                        ? (task.paymentStatus === 'paid' || task.paymentStatus === 'released' ? 'Order Active' : 'Awaiting Payment')
                        : 'Pending'}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-base-content/60">
                  <span className="rounded-full border border-base-300 bg-base-100 px-3 py-1 capitalize">{task.status || 'open'}</span>
                  <span className="rounded-full border border-base-300 bg-base-100 px-3 py-1">{task.bids?.length || 0} bids</span>
                  {getAssignedFreelancerName(task) ? (
                    <span className="max-w-full rounded-full border border-base-300 bg-base-100 px-3 py-1 [overflow-wrap:anywhere]">
                      Assigned: {getAssignedFreelancerName(task)}
                    </span>
                  ) : null}
                </div>

                {(() => {
                  const hasPaid = ['escrow_held', 'paid', 'released', 'refunded'].includes(task.paymentStatus);
                  const isRefunded = String(task.refundStatus || '').toLowerCase() === 'refunded';
                  const isThisFreelancer = isTaskAssignedToUser(task);
                  const isThisClient = isTaskClientOwnedByUser(task);
                  const showForClient = isThisClient && hasPaid;
                  const showForFreelancer = isThisFreelancer && (hasPaid || isRefunded);
                  if (!showForClient && !showForFreelancer) return null;

                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReceiptModal({
                          task,
                          userRole: showForClient ? 'client' : 'freelancer',
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/15"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View Receipt
                    </button>
                  );
                })()}

                {task.status === 'completed' && (() => {
                  const isClientReviewing = isTaskClientOwnedByUser(task);
                  const targetId = isClientReviewing ? getAssignedFreelancerId(task) : task.postedById;
                  const targetName = isClientReviewing ? (getAssignedFreelancerName(task) || 'Freelancer') : (task.postedByName || task.clientName || 'Client');
                  const targetRole = isClientReviewing ? 'freelancer' : 'client';
                  if (!targetId) return null;

                  if (reviewedTasks[task.id]) {
                    return (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-success">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Review submitted
                      </div>
                    );
                  }

                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReviewModal({
                          task,
                          targetUser: { uid: targetId, displayName: targetName },
                          targetRole,
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-500 transition hover:bg-amber-400/20"
                    >
                      ⭐ Leave a Review
                    </button>
                  );
                })()}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>

    <div className="min-w-0 xl:min-h-[calc(100vh-10.75rem)] xl:max-h-[calc(100vh-10.75rem)]">
      {selectedTask ? (
        <div className="task-scroll-shell flex h-full min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-[12px] border border-base-300 bg-base-100/95 shadow-[0_22px_56px_rgba(15,23,42,0.09)]">
          <div className="shrink-0 border-b border-base-300 bg-base-100/90 px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Task Workflow</h2>
                <p className="mt-1 text-sm text-base-content/58">Manage bids, payment gating, delivery, revisions, and workspace updates.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-outline capitalize">{selectedTask.status || 'open'}</span>
                {selectedTask.blocked && <span className="badge badge-warning">Blocked by Admin</span>}
              </div>
            </div>
          </div>

          <div className="task-detail-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-b-[12px] bg-base-100/60">
            {selectedTask.blocked ? (
              <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/15 text-3xl">🚫</div>
                <h3 className="text-lg font-semibold text-base-content">Task Blocked by Admin</h3>
                <p className="max-w-sm text-sm leading-6 text-base-content/60">
                  This task has been blocked by the platform admin. No further actions can be taken. Contact support if you believe this is an error.
                </p>
              </div>
            ) : (
              <TaskWorkflowPanel
                task={selectedTask}
                mode={isTaskClientOwnedByUser(selectedTask) ? 'client' : isTaskAssignedToUser(selectedTask) ? 'assigned' : 'readonly'}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  </div>
)}

{canBid && (
  <section className="rounded-[1.75rem] border border-white/10 bg-base-100/80 p-6 shadow-[0_18px_50px_rgba(2,8,23,0.08)]">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="badge badge-outline mb-3">Freelancer earnings</div>
        <h2 className="text-2xl font-bold tracking-tight">Transaction History</h2>
        <p className="mt-2 max-w-2xl text-sm text-base-content/65">
          Review your paid payouts, pending transfers, and task-by-task earnings using the existing payout records already stored in TaskMarket.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowTransactionHistory((prev) => !prev)}
        className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
      >
        <span>{showTransactionHistory ? 'Close history' : 'Open history'}</span>
        <svg
          className={`h-4 w-4 transition-transform ${showTransactionHistory ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>

    {showTransactionHistory ? (
      <>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-success/20 bg-success/5 p-5">
            <div className="text-sm text-base-content/60">Total paid earnings</div>
            <div className="mt-2 text-3xl font-bold text-success">{formatCurrency(payoutSummary.totalPaid)}</div>
            <div className="mt-1 text-xs text-base-content/55">{payoutSummary.paidCount} completed payout{payoutSummary.paidCount === 1 ? '' : 's'}</div>
          </div>

          <div className="rounded-3xl border border-warning/20 bg-warning/5 p-5">
            <div className="text-sm text-base-content/60">Pending payouts</div>
            <div className="mt-2 text-3xl font-bold text-warning">{formatCurrency(payoutSummary.pendingAmount)}</div>
            <div className="mt-1 text-xs text-base-content/55">{payoutSummary.pendingCount} request{payoutSummary.pendingCount === 1 ? '' : 's'} under review</div>
          </div>

          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
            <div className="text-sm text-base-content/60">Total payout records</div>
            <div className="mt-2 text-3xl font-bold text-primary">{payoutSummary.count}</div>
            <div className="mt-1 text-xs text-base-content/55">History from manual payout records</div>
          </div>
        </div>

        {payoutLoading ? (
          <div className="mt-6 rounded-3xl border border-base-300 bg-base-200/25 p-6 text-center text-sm text-base-content/65">
            Loading payout history...
          </div>
        ) : payoutRequests.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-base-300 bg-base-200/25 p-10 text-center">
            <div className="text-4xl">🧾</div>
            <h3 className="mt-4 text-xl font-semibold">No payout history yet</h3>
            <p className="mt-2 text-sm text-base-content/65">
              When your completed tasks move into payout review, the transaction details will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {payoutRequests.map((request) => {
              const status = normalizeStatus(request.status);
              const destination = getMaskedPayoutDestinationSummary(request);
              const paidAt = request.paidAt || request.processedAt || request.approvedAt;
              const badgeClass = status === 'paid'
                ? 'badge-success'
                : ['rejected', 'failed'].includes(status)
                  ? 'badge-error'
                  : 'badge-warning';

              return (
                <div key={request.id} className="rounded-3xl border border-white/10 bg-base-100/70 p-5 shadow-[0_18px_50px_rgba(2,8,23,0.08)]">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-xl font-semibold">{request.taskTitle || 'Untitled task'}</h3>
                        <span className={`badge ${badgeClass}`}>{status || 'pending'}</span>
                        {request.payoutMethod ? <span className="badge badge-outline">Method: {request.payoutMethod}</span> : null}
                      </div>
                      <div className="mt-2 text-sm text-base-content/65">
                        Client: <span className="font-medium text-base-content">{request.clientName || '—'}</span>
                      </div>
                      <div className="mt-1 text-xs text-base-content/50">Task ID: {request.taskId || '—'}</div>
                    </div>

                    <div className="grid min-w-0 gap-2 rounded-2xl border border-base-300 bg-base-200/30 p-4 sm:grid-cols-2 xl:min-w-[340px]">
                      <div>
                        <div className="text-xs text-base-content/55">Accepted amount</div>
                        <div className="font-semibold">{formatCurrency(request.acceptedAmount || 0)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-base-content/55">Freelancer fee</div>
                        <div className="font-semibold">{formatCurrency(request.freelancerFeeAmount || 0)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-base-content/55">Final payout</div>
                        <div className="font-bold text-success">{formatCurrency(request.amount || 0)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-base-content/55">Destination</div>
                        <div className="font-medium">{destination || '—'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-base-300 bg-base-200/20 p-4">
                      <div className="font-semibold">Timeline</div>
                      <div className="mt-3 space-y-2 text-sm text-base-content/70">
                        <div>Submitted: <span className="font-medium text-base-content">{formatFirestoreDate(request.submittedAt || request.createdAt)}</span></div>
                        <div>Approved: <span className="font-medium text-base-content">{formatFirestoreDate(request.approvedAt)}</span></div>
                        <div>Processed: <span className="font-medium text-base-content">{formatFirestoreDate(request.processedAt)}</span></div>
                        <div>Paid: <span className="font-medium text-base-content">{formatFirestoreDate(paidAt)}</span></div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-base-300 bg-base-200/20 p-4">
                      <div className="font-semibold">Transfer summary</div>
                      <div className="mt-3 space-y-2 text-sm text-base-content/70">
                        <div>Status: <span className="font-medium text-base-content">{status || 'pending'}</span></div>
                        <div>Method: <span className="font-medium text-base-content">{request.payoutMethod || '—'}</span></div>
                        <div>Sent to: <span className="font-medium text-base-content">{destination || '—'}</span></div>
                        {request.rejectionReason ? <div className="text-error">Rejection reason: {request.rejectionReason}</div> : null}
                        {request.failureReason ? <div className="text-error">Failure reason: {request.failureReason}</div> : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    ) : (
      <div className="mt-6 rounded-3xl border border-dashed border-base-300 bg-base-200/25 px-5 py-6 text-sm text-base-content/65">
        Transaction history is hidden. Click <span className="font-semibold text-base-content">Open history</span> to view your payout records.
      </div>
    )}
  </section>
)}