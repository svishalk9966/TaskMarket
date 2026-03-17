import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc,
} from 'firebase/firestore';
import { db, formatFirestoreDate } from '../../firebase';
import LoadingSpinner from '../../components/LoadingSpinner';

// ─────────────────────────────────────────────────────────────────────────────
// Confirmation Modal
// ─────────────────────────────────────────────────────────────────────────────
const ConfirmModal = ({ message, subtext, onConfirm, onCancel, danger }) => (
  <div
    className="fixed inset-0 z-[300] flex items-center justify-center p-4"
    style={{ background: 'rgba(2,8,23,0.82)', backdropFilter: 'blur(12px)' }}
  >
    <div className="w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/10 bg-base-100 shadow-[0_40px_100px_rgba(2,8,23,0.55)]">
      <div className={`h-1 w-full ${danger ? 'bg-gradient-to-r from-error to-warning' : 'bg-gradient-to-r from-primary to-secondary'}`} />
      <div className="p-7">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${danger ? 'bg-error/12' : 'bg-primary/12'}`}>
          {danger ? '⚠️' : '✓'}
        </div>
        <h3 className="mb-1.5 text-center text-base font-bold text-base-content">{message}</h3>
        {subtext && <p className="mb-5 text-center text-sm leading-6 text-base-content/55">{subtext}</p>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="btn btn-outline rounded-2xl">Cancel</button>
          <button type="button" onClick={onConfirm} className={`btn rounded-2xl ${danger ? 'btn-error' : 'btn-primary'}`}>Confirm</button>
        </div>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────────────────────
const StatusBadge = ({ user }) => {
  if (user.deleted || user.status === 'deleted')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-base-300 bg-base-200 px-2.5 py-1 text-[11px] font-semibold text-base-content/45">
        <span className="h-1.5 w-1.5 rounded-full bg-base-content/30" />Removed
      </span>
    );
  if (user.disabled)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-error/20 bg-error/10 px-2.5 py-1 text-[11px] font-semibold text-error">
        <span className="h-1.5 w-1.5 rounded-full bg-error" />Blocked
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />Active
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider Badge
// ─────────────────────────────────────────────────────────────────────────────
const ProviderBadge = ({ providerId }) => {
  const map = {
    'google.com': { label: 'Google',   bg: 'bg-red-50 text-red-500 border-red-200',   icon: '🌐' },
    'github.com': { label: 'GitHub',   bg: 'bg-gray-100 text-gray-600 border-gray-200', icon: '⚡' },
    'password':   { label: 'Email',    bg: 'bg-blue-50 text-blue-500 border-blue-200',  icon: '✉️' },
  };
  const p = map[providerId] || { label: providerId || 'Unknown', bg: 'bg-base-200 text-base-content/50 border-base-300', icon: '👤' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${p.bg}`}>
      <span>{p.icon}</span>{p.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────
const Avatar = ({ name, photo, blocked }) => {
  const initial = (name || 'U').slice(0, 1).toUpperCase();
  return photo ? (
    <img src={photo} alt={name} className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-base-300" />
  ) : (
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 ${
      blocked
        ? 'bg-error/15 text-error ring-error/20'
        : 'bg-gradient-to-br from-primary/25 to-secondary/25 text-primary ring-primary/15'
    }`}>
      {initial}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// User Card — premium card for each user
// ─────────────────────────────────────────────────────────────────────────────
const UserCard = ({ user, isPrev, onBlock, onUnblock, onDelete }) => (
  <div className={`group relative overflow-hidden rounded-[1.5rem] border transition-all duration-200 ${
    isPrev
      ? 'border-base-300/50 bg-base-200/20 opacity-55'
      : user.disabled
      ? 'border-error/20 bg-error/5 hover:border-error/35 hover:shadow-[0_8px_24px_rgba(239,68,68,0.08)]'
      : 'border-base-200/80 bg-base-100 hover:border-primary/20 hover:shadow-[0_12px_32px_rgba(102,126,234,0.10)]'
  }`}>
    {/* Left accent strip */}
    {!isPrev && (
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full transition-opacity ${
        user.disabled ? 'bg-error opacity-60' : 'bg-primary opacity-0 group-hover:opacity-40'
      }`} />
    )}

    <div className="flex items-center gap-4 px-5 py-4">
      {/* Avatar */}
      <Avatar name={user.name} photo={user.photoURL} blocked={user.disabled} />

      {/* Info block */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="max-w-[160px] truncate text-sm font-semibold text-base-content sm:max-w-xs" title={user.name || 'User'}>
            {user.name || 'User'}
          </span>
          <StatusBadge user={user} />
          <ProviderBadge providerId={user.providerId} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="max-w-[220px] truncate text-xs text-base-content/55 sm:max-w-sm" title={user.email || '—'}>
            {user.email || '—'}
          </span>
        </div>
        <div className="text-[11px] text-base-content/35">
          Joined {formatFirestoreDate(user.createdAt)}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0">
        {isPrev ? (
          <button
            type="button"
            onClick={() => onDelete(user)}
            className="btn btn-xs gap-1.5 rounded-xl border border-error/30 bg-error/10 text-error hover:bg-error/20"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        ) : user.disabled ? (
          <button
            type="button"
            onClick={() => onUnblock(user)}
            className="btn btn-xs gap-1.5 rounded-xl border border-success/30 bg-success/10 text-success hover:bg-success/20"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Unblock
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onBlock(user)}
            className="btn btn-xs gap-1.5 rounded-xl border border-warning/30 bg-warning/10 text-warning hover:bg-warning/20"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM10 7a4 4 0 118 0v3H6V7z" />
            </svg>
            Block
          </button>
        )}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color, icon, sub }) => (
  <div className="relative overflow-hidden rounded-[1.5rem] border border-base-200 bg-base-100 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">{label}</p>
        <p className={`mt-3 text-4xl font-bold ${color}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-base-content/40">{sub}</p>}
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-base-200/80 text-xl">{icon}</div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Section Header
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = ({ title, count, color = 'text-primary', note }) => (
  <div className="mb-4 flex flex-wrap items-center gap-3">
    <h2 className="text-lg font-bold text-base-content">{title}</h2>
    <span className={`rounded-full bg-base-200 px-2.5 py-0.5 text-xs font-bold ${color}`}>{count}</span>
    {note && <span className="text-xs text-base-content/40">{note}</span>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const OwnerUsers = () => {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [tab,     setTab]     = useState('active');
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const activeUsers = useMemo(() => users.filter((u) => !u.deleted && u.status !== 'deleted'), [users]);
  const prevUsers   = useMemo(() => users.filter((u) => u.deleted  || u.status === 'deleted'),  [users]);

  const filterList = (list) => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) =>
      (u.name  || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  };

  const ask = (message, subtext, onConfirm, danger = false) =>
    setConfirm({ message, subtext, onConfirm, danger });

  const handleBlock = (user) => ask(
    `Block "${user.name || user.email}"?`,
    'They will be immediately signed out and cannot log in via any method until unblocked.',
    async () => {
      await updateDoc(doc(db, 'users', user.id), { disabled: true, status: 'disabled', updatedAt: Date.now() });
      setConfirm(null);
    }, true
  );

  const handleUnblock = (user) => ask(
    `Unblock "${user.name || user.email}"?`,
    'They will be able to log in again using any of their connected sign-in methods.',
    async () => {
      await updateDoc(doc(db, 'users', user.id), { disabled: false, status: 'active', updatedAt: Date.now() });
      setConfirm(null);
    }
  );

  const handleDelete = (user) => ask(
    `Permanently delete "${user.name || user.email}"?`,
    'All Firestore records for this account will be permanently erased. This cannot be undone.',
    async () => {
      await deleteDoc(doc(db, 'users', user.id));
      setConfirm(null);
    }, true
  );

  if (loading) return <LoadingSpinner />;

  const filtered     = filterList(activeUsers);
  const filteredPrev = filterList(prevUsers);
  const currentList  = tab === 'active' ? filtered : filteredPrev;

  return (
    <div className="space-y-6">
      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}

      {/* ── Page header ── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-base-content sm:text-3xl">User Management</h1>
        <p className="text-sm text-base-content/50">Monitor, block, and manage all registered platform users in real time.</p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard
          label="Total Users"  value={activeUsers.length}
          color="text-primary" icon="👥"
          sub={`${activeUsers.filter(u => !u.disabled).length} active`}
        />
        <StatCard
          label="Active"  value={activeUsers.filter(u => !u.disabled).length}
          color="text-success" icon="✅"
          sub="Can log in"
        />
        <StatCard
          label="Blocked"  value={activeUsers.filter(u => u.disabled).length}
          color="text-warning" icon="🚫"
          sub="Login disabled"
        />
        <StatCard
          label="Prev Registered"  value={prevUsers.length}
          color="text-base-content/40" icon="🗂️"
          sub="Records only"
        />
      </div>

      {/* ── Search + Tab switcher ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/35" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-bordered w-full rounded-2xl pl-10 text-sm"
          />
        </div>

        <div className="flex rounded-2xl border border-base-300 bg-base-200/50 p-1">
          {[
            { id: 'active', label: 'Current Users',         count: filtered.length,     activeColor: 'bg-primary/15 text-primary' },
            { id: 'prev',   label: 'Previously Registered', count: filteredPrev.length, activeColor: 'bg-base-300 text-base-content/50' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all sm:px-4 sm:text-sm ${
                tab === t.id
                  ? 'bg-base-100 text-base-content shadow-sm'
                  : 'text-base-content/50 hover:text-base-content'
              }`}
            >
              {t.label}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tab === t.id ? t.activeColor : 'bg-base-300 text-base-content/40'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Previously registered info banner ── */}
      {tab === 'prev' && (
        <div className="flex items-start gap-3 rounded-2xl border border-base-300/60 bg-base-200/40 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-base-content/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs leading-5 text-base-content/55">
            These accounts exist in Firestore records but were removed from the platform. Permanently delete them to clean up database records.
          </p>
        </div>
      )}

      {/* ── Section header ── */}
      <SectionHeader
        title={tab === 'active' ? 'Current Users' : 'Previously Registered'}
        count={currentList.length}
        color={tab === 'active' ? 'text-primary' : 'text-base-content/40'}
        note={tab === 'prev' && currentList.length > 0 ? '— Firestore records only' : undefined}
      />

      {/* ── User list ── */}
      {currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-base-300 py-16 text-center">
          <div className="mb-3 text-4xl opacity-40">{tab === 'prev' ? '🗂️' : '👥'}</div>
          <p className="text-sm font-medium text-base-content/50">
            {search.trim()
              ? 'No users match your search.'
              : tab === 'prev'
              ? 'No previously registered users.'
              : 'No users found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {currentList.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              isPrev={tab === 'prev'}
              onBlock={handleBlock}
              onUnblock={handleUnblock}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default OwnerUsers;
