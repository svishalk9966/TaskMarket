import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { db, formatFirestoreDate } from '../../firebase';
import LoadingSpinner from '../../components/LoadingSpinner';

const CLEANUP_AFTER_DAYS = 4;
const MS_PER_DAY = 86_400_000;

// ── Helpers ───────────────────────────────────────────────────────────────────
const daysAgo = (ts) => {
  if (!ts) return 0;
  const ms = typeof ts === 'object' && ts.seconds ? ts.seconds * 1000 : Number(ts);
  return Math.floor((Date.now() - ms) / MS_PER_DAY);
};

const bytesToMB = (b) => b ? `${(b / (1024 * 1024)).toFixed(1)} MB` : '—';

const FileChip = ({ file, onDelete, deleting }) => (
  <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all ${
    deleting ? 'border-error/30 bg-error/10 opacity-60' : 'border-base-300 bg-base-200/50 hover:border-error/30 hover:bg-error/5'
  }`}>
    <span className="text-base">{file.resourceType === 'video' ? '🎬' : '📎'}</span>
    <div className="min-w-0 flex-1">
      <div className="truncate font-medium text-base-content max-w-[160px]" title={file.name}>{file.name || file.publicId || 'File'}</div>
      <div className="text-base-content/45">{bytesToMB(file.size)}</div>
    </div>
    <button
      type="button"
      onClick={() => onDelete(file)}
      disabled={deleting}
      className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-error/15 text-error transition hover:bg-error/25 disabled:opacity-40"
      title="Delete from Cloudinary"
    >
      {deleting
        ? <span className="loading loading-spinner loading-xs" />
        : <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
      }
    </button>
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const OwnerDeliveryCleanup = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [tasks,      setTasks]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [deletingId, setDeletingId] = useState(null); // `${deliveryId}_${publicId}`
  const [toast,      setToast]      = useState(null); // { type, msg }
  const [filter,     setFilter]     = useState('all'); // all | ready | done

  useEffect(() => {
    const qDel  = query(collection(db, 'deliveries'), orderBy('submittedAt', 'desc'));
    const qTask = query(collection(db, 'tasks'), where('status', '==', 'completed'));

    const u1 = onSnapshot(qDel,  (s) => { setDeliveries(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); });
    const u2 = onSnapshot(qTask, (s) => setTasks(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  const completedIds = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);

  // Only show deliveries for completed tasks that are CLEANUP_AFTER_DAYS+ old
  const eligibleDeliveries = useMemo(() => deliveries
    .filter((d) => completedIds.has(d.taskId) && daysAgo(d.submittedAt) >= CLEANUP_AFTER_DAYS)
    .map((d) => {
      const allFiles = [
        ...(d.previewVideoPath || d.previewVideoPublicId
          ? [{ publicId: d.previewVideoPath || d.previewVideoPublicId, name: 'Preview Video', size: d.previewVideoSize, resourceType: 'video', deleted: d.previewVideoDeleted }]
          : []),
        ...(Array.isArray(d.attachments)
          ? d.attachments.map((a) => ({ publicId: a.publicId || a.path, name: a.name, size: a.size, resourceType: a.resourceType || 'raw', deleted: a.deleted }))
          : []),
      ].filter((f) => f.publicId);
      const activeFiles  = allFiles.filter((f) => !f.deleted);
      const deletedFiles = allFiles.filter((f) => f.deleted);
      return { ...d, allFiles, activeFiles, deletedFiles, age: daysAgo(d.submittedAt) };
    })
    .filter((d) => d.allFiles.length > 0),
  [deliveries, completedIds]);

  const filtered = useMemo(() => {
    if (filter === 'ready') return eligibleDeliveries.filter((d) => d.activeFiles.length > 0);
    if (filter === 'done')  return eligibleDeliveries.filter((d) => d.activeFiles.length === 0);
    return eligibleDeliveries;
  }, [eligibleDeliveries, filter]);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // Delete a single file from Cloudinary + mark in Firestore
  const deleteFile = async (delivery, file) => {
    const key = `${delivery.id}_${file.publicId}`;
    setDeletingId(key);
    try {
      const res = await fetch('/api/cloudinary/delete-resource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicIds: [file.publicId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');

      // Mark as deleted in Firestore
      const isPreview = file.publicId === (delivery.previewVideoPath || delivery.previewVideoPublicId);
      if (isPreview) {
        await updateDoc(doc(db, 'deliveries', delivery.id), { previewVideoDeleted: true, cloudinaryCleanedAt: Date.now() });
      } else {
        const updatedAttachments = (delivery.attachments || []).map((a) =>
          (a.publicId || a.path) === file.publicId ? { ...a, deleted: true } : a
        );
        await updateDoc(doc(db, 'deliveries', delivery.id), { attachments: updatedAttachments, cloudinaryCleanedAt: Date.now() });
      }
      showToast('success', `"${file.name || file.publicId}" deleted from Cloudinary.`);
    } catch (err) {
      showToast('error', err.message || 'Failed to delete file.');
    } finally {
      setDeletingId(null);
    }
  };

  // Delete ALL files for a delivery
  const deleteAllFiles = async (delivery) => {
    const publicIds = delivery.activeFiles.map((f) => f.publicId).filter(Boolean);
    if (!publicIds.length) return;
    setDeletingId(`${delivery.id}_all`);
    try {
      const res = await fetch('/api/cloudinary/delete-resource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');

      await updateDoc(doc(db, 'deliveries', delivery.id), {
        previewVideoDeleted: true,
        attachments: (delivery.attachments || []).map((a) => ({ ...a, deleted: true })),
        cloudinaryCleanedAt: Date.now(),
      });
      showToast('success', `All ${publicIds.length} file(s) deleted for "${delivery.taskId}".`);
    } catch (err) {
      showToast('error', err.message || 'Failed to delete files.');
    } finally {
      setDeletingId(null);
    }
  };

  const totalActiveFiles  = eligibleDeliveries.reduce((a, d) => a + d.activeFiles.length, 0);
  const totalDeletedFiles = eligibleDeliveries.reduce((a, d) => a + d.deletedFiles.length, 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[400] flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl text-sm font-medium transition-all ${
          toast.type === 'success' ? 'border-success/25 bg-success/15 text-success' : 'border-error/25 bg-error/15 text-error'
        }`}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-base-content sm:text-3xl">Delivery Cleanup</h1>
        <p className="mt-1 text-sm text-base-content/55">
          Remove Cloudinary delivery files from completed tasks that are {CLEANUP_AFTER_DAYS}+ days old to free up storage.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Eligible Tasks',   value: eligibleDeliveries.length,                                          color: 'text-primary',         icon: '📦' },
          { label: 'Files to Clean',   value: totalActiveFiles,                                                    color: 'text-warning',         icon: '🗂️' },
          { label: 'Already Cleaned',  value: totalDeletedFiles,                                                   color: 'text-success',         icon: '✅' },
          { label: 'Threshold',        value: `${CLEANUP_AFTER_DAYS}+ days`,                                       color: 'text-base-content/55', icon: '📅' },
        ].map((s) => (
          <div key={s.label} className="rounded-[1.5rem] border border-base-200 bg-base-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-base-content/45">{s.label}</span>
              <span className="text-lg">{s.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex rounded-2xl border border-base-300 bg-base-200/50 p-1 w-fit">
        {[
          { id: 'all',   label: 'All',          count: eligibleDeliveries.length },
          { id: 'ready', label: 'Needs Cleanup', count: eligibleDeliveries.filter((d) => d.activeFiles.length > 0).length },
          { id: 'done',  label: 'Cleaned',       count: eligibleDeliveries.filter((d) => d.activeFiles.length === 0).length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              filter === tab.id ? 'bg-base-100 shadow-sm text-base-content' : 'text-base-content/55 hover:text-base-content'
            }`}
          >
            {tab.label}
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${filter === tab.id ? 'bg-primary/15 text-primary' : 'bg-base-300 text-base-content/50'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Delivery cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-base-300 py-16 text-center">
          <div className="mb-3 text-4xl">🎉</div>
          <p className="font-semibold text-base-content/60">
            {filter === 'done' ? 'No cleaned deliveries yet.' : filter === 'ready' ? 'No files need cleanup right now.' : 'No eligible deliveries found.'}
          </p>
          <p className="mt-1 text-sm text-base-content/40">
            Files appear here once tasks are completed and {CLEANUP_AFTER_DAYS}+ days have passed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((delivery) => {
            const isAllDeleting = deletingId === `${delivery.id}_all`;
            const allCleaned    = delivery.activeFiles.length === 0;

            return (
              <div key={delivery.id} className={`overflow-hidden rounded-[1.5rem] border transition-all ${
                allCleaned ? 'border-success/20 bg-success/5' : 'border-base-200 bg-base-100 hover:border-primary/20 hover:shadow-[0_8px_24px_rgba(102,126,234,0.1)]'
              }`}>
                <div className="p-5">
                  {/* Row 1 — task info + age */}
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-base-content text-sm">Task ID: {delivery.taskId?.slice(0, 12)}…</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          allCleaned ? 'bg-success/12 text-success' : delivery.age >= 7 ? 'bg-error/12 text-error' : 'bg-warning/12 text-warning'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${allCleaned ? 'bg-success' : delivery.age >= 7 ? 'bg-error' : 'bg-warning'}`} />
                          {allCleaned ? 'Cleaned' : `${delivery.age} days old`}
                        </span>
                      </div>
                      <div className="text-xs text-base-content/45">
                        Submitted by {delivery.freelancerName || 'Freelancer'} · {formatFirestoreDate(delivery.submittedAt)}
                      </div>
                    </div>

                    {!allCleaned && (
                      <button
                        type="button"
                        onClick={() => deleteAllFiles(delivery)}
                        disabled={Boolean(deletingId)}
                        className="btn btn-xs btn-error btn-outline rounded-xl px-4 shrink-0"
                      >
                        {isAllDeleting
                          ? <span className="inline-flex items-center gap-1.5"><span className="loading loading-spinner loading-xs" />Deleting all…</span>
                          : `Delete all ${delivery.activeFiles.length} file(s)`}
                      </button>
                    )}
                  </div>

                  {/* Files */}
                  {delivery.activeFiles.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-base-content/40">Files to remove</p>
                      <div className="flex flex-wrap gap-2">
                        {delivery.activeFiles.map((file) => (
                          <FileChip
                            key={file.publicId}
                            file={file}
                            deleting={deletingId === `${delivery.id}_${file.publicId}`}
                            onDelete={(f) => deleteFile(delivery, f)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {delivery.deletedFiles.length > 0 && (
                    <div className={delivery.activeFiles.length > 0 ? 'mt-3' : ''}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-success/60">Already removed</p>
                      <div className="flex flex-wrap gap-2">
                        {delivery.deletedFiles.map((file) => (
                          <div key={file.publicId} className="flex items-center gap-1.5 rounded-xl border border-success/20 bg-success/8 px-3 py-2 text-xs text-success/70">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            {file.name || file.publicId}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OwnerDeliveryCleanup;
