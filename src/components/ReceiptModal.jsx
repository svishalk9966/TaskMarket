import React, { useRef } from 'react';
import { formatCurrency, APP_NAME } from '../config';
import { formatFirestoreDate } from '../firebase';

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatTs = (ts) => {
  if (!ts) return '—';
  return formatFirestoreDate(ts);
};

const ReceiptRow = ({ label, value, bold = false, tone = '' }) => (
  <div className={`flex items-center justify-between gap-4 py-2 ${bold ? 'border-t border-base-300 mt-1 pt-3' : ''}`}>
    <span className={`text-sm ${bold ? 'font-semibold text-base-content' : 'text-base-content/60'}`}>{label}</span>
    <span className={`text-sm font-medium text-right ${bold ? 'text-base-content font-bold text-base' : ''} ${tone}`}>{value}</span>
  </div>
);

const Divider = () => <div className="my-3 border-t border-dashed border-base-300" />;

// ── Payment Receipt (Client) ───────────────────────────────────────────────────
const PaymentReceipt = ({ task }) => {
  const acceptedAmt = task.acceptedAmount || task.acceptedBidAmount || task.amount || 0;
  const platformFee = task.clientPlatformFeeAmount || task.platformFeeAmount || task.platformFee || 0;
  const totalPaid   = task.clientTotalPayable || task.totalPaidByClient || (acceptedAmt + platformFee);
  const txnId       = task.paymentId || task.transactionId || '—';
  const paidOn      = task.lastPaymentAt || task.paymentDate || task.updatedAt;

  return (
    <div className="space-y-1">
      <div className="rounded-2xl border border-success/25 bg-success/6 px-4 py-3 mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15">
          <svg className="h-5 w-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-success">Payment successful</p>
          <p className="text-xs text-base-content/55">Funds are held in escrow until task completion</p>
        </div>
      </div>

      <ReceiptRow label="Task title"         value={task.title || '—'} />
      <ReceiptRow label="Task ID"            value={<span className="font-mono text-xs">{task.id?.slice(0, 16)}…</span>} />
      <ReceiptRow label="Transaction ID"     value={<span className="font-mono text-xs">{txnId !== '—' ? txnId.slice(0, 20) : '—'}</span>} />
      <ReceiptRow label="Payment date"       value={formatTs(paidOn)} />
      <ReceiptRow label="Freelancer"         value={task.selectedFreelancerName || task.assignedFreelancerName || '—'} />

      <Divider />

      <ReceiptRow label="Accepted bid amount"     value={formatCurrency(acceptedAmt)} />
      <ReceiptRow label={`Platform fee (${task.clientPlatformFeePercent || task.platformFeePercent || 0}%)`} value={formatCurrency(platformFee)} />
      <ReceiptRow label="Total paid"              value={formatCurrency(totalPaid)} bold tone="text-success" />
    </div>
  );
};

// ── Refund Receipt (Client) ────────────────────────────────────────────────────
const RefundReceipt = ({ task }) => {
  const gross       = task.clientTotalPayable || task.totalPaidByClient || task.acceptedAmount || task.amount || 0;
  const feePercent  = task.refundFeePercent || 10;
  const feeAmt      = task.refundFeeAmount || Math.round(gross * feePercent / 100);
  const refundAmt   = task.refundNetAmount || (gross - feeAmt);
  const approvedOn  = task.refundApprovedAt || task.updatedAt;

  return (
    <div className="space-y-1">
      <div className="rounded-2xl border border-primary/25 bg-primary/6 px-4 py-3 mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">Refund approved</p>
          <p className="text-xs text-base-content/55">Amount will be credited to your original payment method</p>
        </div>
      </div>

      <ReceiptRow label="Task title"       value={task.title || '—'} />
      <ReceiptRow label="Task ID"          value={<span className="font-mono text-xs">{task.id?.slice(0, 16)}…</span>} />
      <ReceiptRow label="Refund approved"  value={formatTs(approvedOn)} />
      <ReceiptRow label="Refund reason"    value={task.refundReason || '—'} />

      <Divider />

      <ReceiptRow label="Original amount paid"    value={formatCurrency(gross)} />
      <ReceiptRow label={`Refund processing fee (${feePercent}%)`} value={`− ${formatCurrency(feeAmt)}`} tone="text-error" />
      <ReceiptRow label="You will receive"         value={formatCurrency(refundAmt)} bold tone="text-primary" />

      <div className="mt-3 rounded-xl border border-base-200 bg-base-200/40 px-3 py-2">
        <p className="text-xs text-base-content/50">
          Fee slab applied: {gross <= 5000 ? '≤ ₹5,000 → 10%' : gross <= 10000 ? '₹5,001–₹10,000 → 8%' : '> ₹10,000 → 4%'}
        </p>
      </div>
    </div>
  );
};

// ── Assignment Receipt (Freelancer) ───────────────────────────────────────────
const AssignmentReceipt = ({ task, userId }) => {
  const baseAmt        = task.acceptedAmount || task.acceptedBidAmount || task.amount || 0;
  const freelancerFee  = task.freelancerFeeAmount || 0;
  const feePercent     = task.freelancerFeePercent || task.platformFeePercent || 0;
  const netEarnings    = task.netAmountToFreelancer || (baseAmt - freelancerFee);
  const assignedOn     = task.acceptedAt || task.updatedAt;
  const paymentPaid    = ['escrow_held', 'paid', 'released'].includes(task.paymentStatus);

  return (
    <div className="space-y-1">
      <div className={`rounded-2xl border px-4 py-3 mb-4 flex items-center gap-3 ${paymentPaid ? 'border-success/25 bg-success/6' : 'border-warning/25 bg-warning/6'}`}>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${paymentPaid ? 'bg-success/15' : 'bg-warning/15'}`}>
          <svg className={`h-5 w-5 ${paymentPaid ? 'text-success' : 'text-warning'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <p className={`text-sm font-semibold ${paymentPaid ? 'text-success' : 'text-warning'}`}>
            {paymentPaid ? 'Assignment active — payment received' : 'Bid accepted — awaiting client payment'}
          </p>
          <p className="text-xs text-base-content/55">
            {paymentPaid ? 'Funds are in escrow. You can start work.' : 'Task will begin once client confirms payment.'}
          </p>
        </div>
      </div>

      <ReceiptRow label="Task title"        value={task.title || '—'} />
      <ReceiptRow label="Task ID"           value={<span className="font-mono text-xs">{task.id?.slice(0, 16)}…</span>} />
      <ReceiptRow label="Client"            value={task.postedByName || task.postedBy || '—'} />
      <ReceiptRow label="Assigned on"       value={formatTs(assignedOn)} />
      <ReceiptRow label="Payment status"    value={
        <span className={`badge badge-sm ${paymentPaid ? 'badge-success' : 'badge-warning'}`}>
          {paymentPaid ? 'Paid & active' : 'Awaiting payment'}
        </span>
      } />

      <Divider />

      <ReceiptRow label="Accepted bid amount"     value={formatCurrency(baseAmt)} />
      <ReceiptRow label={`Service fee (${feePercent}%)`} value={`− ${formatCurrency(freelancerFee)}`} tone="text-error" />
      <ReceiptRow label="Your net earnings"        value={formatCurrency(netEarnings)} bold tone="text-success" />

      <div className="mt-3 rounded-xl border border-base-200 bg-base-200/40 px-3 py-2">
        <p className="text-xs text-base-content/50">
          Net earnings are released to you after client accepts delivery.
        </p>
      </div>
    </div>
  );
};

// ── Refund Notice (Freelancer) ─────────────────────────────────────────────────
const FreelancerRefundNotice = ({ task }) => {
  const approvedOn = task.refundApprovedAt || task.updatedAt;
  return (
    <div className="space-y-1">
      <div className="rounded-2xl border border-warning/25 bg-warning/6 px-4 py-3 mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15">
          <svg className="h-5 w-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-warning">Client refund processed</p>
          <p className="text-xs text-base-content/55">This task has been reset — awaiting client payment again</p>
        </div>
      </div>

      <ReceiptRow label="Task title"        value={task.title || '—'} />
      <ReceiptRow label="Task ID"           value={<span className="font-mono text-xs">{task.id?.slice(0, 16)}…</span>} />
      <ReceiptRow label="Refund approved on" value={formatTs(approvedOn)} />
      <ReceiptRow label="Refund reason"     value={task.refundReason || '—'} />
      <ReceiptRow label="Task status"       value={<span className="badge badge-warning badge-sm">Waiting for payment</span>} />

      <Divider />

      <div className="rounded-xl border border-base-200 bg-base-200/40 px-3 py-2.5 space-y-1">
        <p className="text-xs font-semibold text-base-content/60">What happens next?</p>
        <p className="text-xs text-base-content/50">The client's payment has been refunded. The task may be reassigned or closed. No payout will be made for this task cycle.</p>
      </div>
    </div>
  );
};

// ── Main Modal ─────────────────────────────────────────────────────────────────
const ReceiptModal = ({ task, userRole, onClose }) => {
  const printRef = useRef(null);

  // Determine which receipts to show
  const isRefunded = String(task.refundStatus || '').toLowerCase() === 'refunded';
  const isPaymentPaid = ['escrow_held', 'paid', 'released', 'refunded'].includes(String(task.paymentStatus || '').toLowerCase());
  const isAssigned = Boolean(task.selectedFreelancerId || task.assignedTo);

  // Tabs
  const tabs = [];
  if (userRole === 'client') {
    if (isPaymentPaid) tabs.push({ id: 'payment', label: '💳 Payment Receipt' });
    if (isRefunded)    tabs.push({ id: 'refund',  label: '↩️ Refund Receipt' });
  }
  if (userRole === 'freelancer') {
    if (isAssigned)  tabs.push({ id: 'assignment', label: '📋 Assignment Receipt' });
    if (isRefunded)  tabs.push({ id: 'refund_notice', label: '⚠️ Refund Notice' });
  }

  const [activeTab, setActiveTab] = React.useState(tabs[0]?.id || '');

  if (tabs.length === 0) return null;

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'width=700,height=800');
    win.document.write(`
      <html><head><title>Receipt — ${APP_NAME}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 32px; color: #111; max-width: 560px; margin: 0 auto; }
        .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
        .bold { font-weight: 700; font-size: 15px; border-top: 2px solid #e5e7eb; padding-top: 10px; margin-top: 4px; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { font-size: 20px; margin: 0; }
        .header p  { color: #666; font-size: 12px; margin: 4px 0 0; }
        .badge { background: #f0fdf4; color: #15803d; padding: 2px 8px; border-radius: 99px; font-size: 11px; }
        hr { border: none; border-top: 1px dashed #d1d5db; margin: 12px 0; }
      </style></head><body>
      <div class="header">
        <h1>${APP_NAME}</h1>
        <p>Receipt · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      ${el.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-base-200 bg-base-100 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-base-200 bg-base-100/90 px-5 py-4">
          <div>
            <h3 className="text-base font-bold">{APP_NAME} Receipt</h3>
            <p className="text-xs text-base-content/50 mt-0.5 break-words max-w-[280px]">{task.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-ghost btn-sm gap-1.5 text-xs"
              title="Print receipt"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm btn-circle text-base-content/50 hover:text-base-content">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs (if multiple receipts) */}
        {tabs.length > 1 && (
          <div className="flex border-b border-base-200 bg-base-200/30 px-3 pt-2 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary bg-base-100'
                    : 'border-transparent text-base-content/50 hover:text-base-content'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Receipt Body */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4" ref={printRef}>
          {activeTab === 'payment'       && <PaymentReceipt task={task} />}
          {activeTab === 'refund'        && <RefundReceipt task={task} />}
          {activeTab === 'assignment'    && <AssignmentReceipt task={task} />}
          {activeTab === 'refund_notice' && <FreelancerRefundNotice task={task} />}
        </div>

        {/* Footer */}
        <div className="border-t border-base-200 bg-base-200/30 px-5 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-base-content/40">Generated by {APP_NAME} · {new Date().getFullYear()}</p>
          <button type="button" onClick={onClose} className="btn btn-outline btn-sm rounded-xl">Close</button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
