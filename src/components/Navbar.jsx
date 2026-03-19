import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRole, ROLES } from '../contexts/RoleContext';
import { useTheme } from '../contexts/ThemeContext';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { deleteNotification, markNotificationRead, subscribeToNotifications } from '../lib/workflow';
import { formatFirestoreDate, requestEmailChange } from '../firebase';

// ── Role label helper ─────────────────────────────────────────────────────────
const ROLE_LABELS = {
  [ROLES.CLIENT]:     { label: 'Client',              emoji: '💼' },
  [ROLES.FREELANCER]: { label: 'Freelancer',          emoji: '🛠️' },
  [ROLES.BOTH]:       { label: 'Client & Freelancer', emoji: '⚡' },
};

// ── Change Role Confirmation Modal ────────────────────────────────────────────
const ChangeRoleModal = ({ role, onConfirm, onCancel }) => {
  const current = ROLE_LABELS[role] || { label: 'your current role', emoji: '👤' };
  const [showGreeting, setShowGreeting] = useState(false);
  const [greetingVisible, setGreetingVisible] = useState(false);

  const handleConfirm = () => {
    setShowGreeting(true);
    setTimeout(() => setGreetingVisible(true), 60);
    setTimeout(() => onConfirm(), 2200);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(2,8,23,0.75)', backdropFilter: 'blur(10px)' }}>
      <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-base-100 shadow-[0_40px_100px_rgba(2,8,23,0.5)] overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent" style={{ position: 'relative' }} />

        {!showGreeting ? (
          <div className="p-6 sm:p-7">
            {/* Icon */}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/15 text-3xl">
              {current.emoji}
            </div>
            <h3 className="mb-2 text-center text-xl font-bold text-base-content">Change Your Role?</h3>
            <p className="mb-1 text-center text-sm text-base-content/60">Your current role is</p>
            <p className="mb-5 text-center text-base font-semibold text-primary">{current.label}</p>
            <p className="mb-6 text-center text-sm leading-6 text-base-content/60">
              Confirming will clear your current role and take you to the role selection screen where you can choose a new one.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={onCancel} className="btn btn-outline rounded-2xl">
                Cancel
              </button>
              <button type="button" onClick={handleConfirm} className="btn btn-primary rounded-2xl">
                Yes, Change
              </button>
            </div>
          </div>
        ) : (
          /* Greeting animation after confirmation */
          <div
            className="flex flex-col items-center justify-center px-6 py-10 text-center"
            style={{ opacity: greetingVisible ? 1 : 0, transform: greetingVisible ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 0.4s ease, transform 0.4s ease' }}
          >
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15 ring-4 ring-success/25"
              style={{ transform: greetingVisible ? 'scale(1)' : 'scale(0.6)', transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.1s' }}
            >
              <svg className="h-8 w-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"
                  style={{ strokeDasharray: 30, strokeDashoffset: greetingVisible ? 0 : 30, transition: 'stroke-dashoffset 0.5s ease 0.3s' }} />
              </svg>
            </div>
            <h3 className="text-xl font-bold gradient-text mb-2">Role Cleared!</h3>
            <p className="text-sm text-base-content/60 leading-6">Taking you to role selection now…</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Change Email Modal ────────────────────────────────────────────────────────
const ChangeEmailModal = ({ user, isOwner, onClose, onSuccessClose }) => {
  const [newEmail,       setNewEmail]       = useState('');
  const [password,       setPassword]       = useState('');
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [adminNotifSent, setAdminNotifSent] = useState(false);

  const isGoogleOrGithub = user?.providerData?.[0]?.providerId !== 'password';
  const SUPPORT_EMAIL = 'supporttaskmarket@gmail.com';

  // Send admin email change request notification to support team
  const sendAdminNotification = async (requestedEmail) => {
    try {
      const emailjsMod = await import('@emailjs/browser');
      const serviceId  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = import.meta.env.VITE_EMAILJS_SUPPORT_TEMPLATE_ID;
      const publicKey  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
      if (!serviceId || !templateId || !publicKey) return;
      await emailjsMod.send(serviceId, templateId, {
        name:    'System Alert',
        email:   SUPPORT_EMAIL,
        subject: 'Admin Email Change Request',
        message: `Admin account (${user?.email}) has requested an email change to: ${requestedEmail}. Please review and action this manually if approved.`,
      }, publicKey);
    } catch (_) { /* non-critical */ }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!newEmail.trim()) { setError('Please enter a new email address.'); return; }
    if (newEmail.toLowerCase() === user.email.toLowerCase()) { setError('New email must be different from your current email.'); return; }

    // ── Admin block ──────────────────────────────────────────
    if (isOwner) {
      setLoading(true);
      await sendAdminNotification(newEmail.trim().toLowerCase());
      setAdminNotifSent(true);
      setLoading(false);
      return;
    }
    // ────────────────────────────────────────────────────────

    if (!isGoogleOrGithub && !password) { setError('Please enter your current password to confirm.'); return; }
    setLoading(true);
    try {
      await requestEmailChange(isGoogleOrGithub ? null : password, newEmail.trim().toLowerCase());
      setSuccess(true);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') setError('Incorrect password. Please try again.');
      else if (code === 'auth/email-already-in-use') setError('This email is already in use by another account.');
      else if (code === 'auth/invalid-email') setError('Please enter a valid email address.');
      else if (code === 'auth/requires-recent-login') setError('For security, please log out and log back in before changing your email.');
      else if (code === 'auth/operation-not-allowed') setError('Email/password sign-in is required to change email. Try logging out and signing in with email first.');
      else setError(err?.message || 'Failed to send verification email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(2,8,23,0.75)', backdropFilter: 'blur(10px)' }}>
      <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-base-100 shadow-[0_40px_100px_rgba(2,8,23,0.5)]">
        <div className="p-6 sm:p-7">
          {/* Close */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-base-content">Change Email</h3>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-base-200 text-base-content/50 hover:bg-base-300 hover:text-base-content transition">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {adminNotifSent ? (
            /* ── Admin blocked — notification sent to support ── */
            <div className="flex flex-col items-center py-4 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 ring-4 ring-warning/25 text-3xl">
                🔐
              </div>
              <h4 className="mb-2 text-base font-bold text-base-content">Request Sent to Support</h4>
              <p className="text-sm leading-6 text-base-content/60">
                Admin accounts cannot change email directly for security reasons.
              </p>
              <div className="mt-4 w-full rounded-2xl border border-warning/25 bg-warning/10 px-4 py-3 text-xs text-warning text-left leading-6">
                Your email change request has been forwarded to the support team at{' '}
                <span className="font-semibold">{SUPPORT_EMAIL}</span>.
                They will review and process it manually.
              </div>
              <button type="button" onClick={onClose} className="btn btn-primary mt-5 w-full rounded-2xl">Close</button>
            </div>
          ) : success ? (
            /* Success state */
            <div className="flex flex-col items-center py-4 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/15 ring-4 ring-success/25">
                <svg className="h-7 w-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="mb-2 text-base font-bold text-base-content">Verification Email Sent!</h4>
              <p className="text-sm leading-6 text-base-content/60">
                A verification link has been sent to{' '}
                <span className="font-semibold text-base-content">{newEmail}</span>.
              </p>

              {/* Step by step instructions */}
              <div className="mt-4 w-full space-y-2 text-left">
                {[
                  { step: '1', text: 'Open the verification email in your new inbox' },
                  { step: '2', text: 'Click the verification link in that email' },
                  { step: '3', text: 'Come back and log in with your new email address' },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3 rounded-xl bg-base-200/60 px-3 py-2.5 text-xs text-base-content/70">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">{item.step}</span>
                    {item.text}
                  </div>
                ))}
              </div>

              <div className="mt-4 w-full rounded-2xl border border-warning/25 bg-warning/10 px-3 py-2.5 text-xs text-warning">
                ⚠️ You have been signed out. Please verify your new email and then log in again.
              </div>

              <button type="button" onClick={onSuccessClose || onClose} className="btn btn-primary mt-5 w-full rounded-2xl">
                Go to Login
              </button>
            </div>
          ) : (
            <>
              {/* Current email info */}
              <div className="mb-5 rounded-2xl border border-base-300 bg-base-200/50 px-4 py-3 text-sm">
                <span className="text-base-content/55">Current email: </span>
                <span className="font-medium text-base-content break-all">{user?.email}</span>
              </div>

              {isGoogleOrGithub && (
                <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning leading-5">
                  You signed in with Google/GitHub. Password verification is not required, but a verification link will still be sent to confirm the new email.
                </div>
              )}

              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-2xl border border-error/25 bg-error/10 px-4 py-3 text-xs text-error">
                  <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="break-words">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text font-medium">New Email Address</span></label>
                  <input type="email" className="input input-bordered w-full rounded-2xl" placeholder="new@example.com"
                    value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setError(''); }} required />
                </div>

                {!isGoogleOrGithub && (
                  <div className="form-control">
                    <label className="label pb-1"><span className="label-text font-medium">Current Password</span></label>
                    <input type="password" className="input input-bordered w-full rounded-2xl" placeholder="Enter your password to confirm"
                      value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} required />
                    <p className="mt-1 text-xs text-base-content/45">Required for security verification</p>
                  </div>
                )}

                <button type="submit" className="btn btn-primary w-full rounded-2xl shadow-[0_12px_30px_rgba(102,126,234,0.3)]" disabled={loading}>
                  {loading ? <span className="inline-flex items-center gap-2"><span className="loading loading-spinner loading-sm" />Sending verification…</span> : 'Send Verification Link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Navbar ───────────────────────────────────────────────────────────────
const Navbar = () => {
  const { user, logout, isOwner } = useAuth();
  const { role, canPost, clearRole } = useRole();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const location = useLocation();

  // Modal states
  const [showChangeRole,  setShowChangeRole]  = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 1024) setIsOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { setIsOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!user?.uid) { setNotifications([]); return undefined; }
    const unsubscribe = subscribeToNotifications(user.uid, setNotifications, (e) => console.error('Notification error:', e));
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    document.body.style.overflow = (isOpen || showChangeRole || showChangeEmail) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, showChangeRole, showChangeEmail]);

  const closeMenu = () => setIsOpen(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationOpen = async (id) => {
    try { await markNotificationRead(id); } catch (e) { console.error(e); }
  };

  const handleDeleteNotification = async (event, id) => {
    event.preventDefault(); event.stopPropagation();
    const prev = notifications;
    setNotifications((curr) => curr.filter((n) => n.id !== id));
    try { await deleteNotification(id); } catch (e) { console.error(e); setNotifications(prev); }
  };

  // Change Role: confirm → clear role → navigate
  const handleRoleConfirmed = () => {
    clearRole();
    setShowChangeRole(false);
    navigate('/role-select');
  };

  const linkClass = ({ isActive }) => [
    'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold leading-none transition-all duration-200 whitespace-nowrap',
    isActive
      ? 'bg-base-100 text-base-content shadow-[0_10px_28px_rgba(15,23,42,0.16)] ring-1 ring-white/10'
      : 'text-base-content/72 hover:bg-base-100/70 hover:text-base-content',
  ].join(' ');

  const navLinks = (
    <>
      <li><NavLink to="/" end className={linkClass}>Home</NavLink></li>
      <li><NavLink to="/browse" className={linkClass}>Browse Tasks</NavLink></li>
      {user && (
        <>
          <li><NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink></li>
          {canPost && <li><NavLink to="/post" className={linkClass}>Post Task</NavLink></li>}
          {canBid && <li><NavLink to="/earnings" className={linkClass}>Earnings</NavLink></li>}
          {isOwner && <li><NavLink to="/owner-dashboard" className={linkClass}>Owner Panel</NavLink></li>}
        </>
      )}
    </>
  );

  return (
    <>
      {/* ── Change Role Modal ── */}
      {showChangeRole && (
        <ChangeRoleModal
          role={role}
          onConfirm={handleRoleConfirmed}
          onCancel={() => setShowChangeRole(false)}
        />
      )}

      {/* ── Change Email Modal ── */}
      {showChangeEmail && (
        <ChangeEmailModal
          user={user}
          isOwner={isOwner}
          onClose={() => setShowChangeEmail(false)}
          onSuccessClose={() => { setShowChangeEmail(false); navigate('/login'); }}
        />
      )}

      <header className="sticky top-0 z-50 border-b border-white/8 bg-base-100/88 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-5 lg:px-8">
          <div className="flex min-h-[68px] items-center gap-4 rounded-[26px] border border-white/8 bg-base-100/72 px-3.5 shadow-[0_18px_60px_rgba(2,8,23,0.16)] sm:px-5 lg:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3.5 lg:flex-none">
              <button type="button" className="btn btn-ghost btn-circle h-11 w-11 border border-white/8 bg-base-200/55 text-base-content/80 transition hover:border-white/14 hover:bg-base-200/80 hover:text-base-content lg:hidden" onClick={() => setIsOpen(true)} aria-label="Open navigation menu">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>
              <Link to="/" className="group flex min-w-0 items-center gap-3 rounded-2xl pr-2 transition hover:bg-base-200/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-[#6f7bf7] to-secondary text-base font-bold text-white shadow-[0_10px_28px_rgba(102,126,234,0.35)]">T</div>
                <div className="min-w-0"><p className="truncate text-lg font-bold tracking-tight text-base-content">TaskMarket</p></div>
              </Link>
            </div>

            <nav className="hidden flex-1 justify-center px-6 lg:flex">
              <ul className="flex items-center gap-2 rounded-full border border-white/8 bg-base-200/55 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                {navLinks}
              </ul>
            </nav>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-3 lg:flex-none">
              <button type="button" className="btn btn-ghost btn-circle hidden h-11 w-11 border border-white/8 bg-base-200/55 text-base-content/80 transition hover:border-white/14 hover:bg-base-200/80 hover:text-base-content sm:inline-flex" onClick={toggleTheme} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
                {theme === 'light' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v2.25M12 18.75V21m9-9h-2.25M5.25 12H3m15.114 6.364l-1.591-1.591M7.477 7.477 5.886 5.886m12.228 0l-1.591 1.591M7.477 16.523l-1.591 1.591M15.75 12A3.75 3.75 0 1112 8.25 3.75 3.75 0 0115.75 12z" /></svg>
                )}
              </button>

              {user ? (
                <>
                  {/* Notifications */}
                  <div className="dropdown dropdown-end shrink-0">
                    <div tabIndex={0} role="button" className="btn btn-ghost btn-circle h-11 w-11 border border-white/8 bg-base-200/55 text-base-content/80 transition hover:border-white/14 hover:bg-base-200/80 hover:text-base-content" title="Notifications">
                      <div className="indicator">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        {unreadCount > 0 ? <span className="badge badge-primary badge-xs indicator-item border-0">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
                      </div>
                    </div>
                    <ul tabIndex={0} className="dropdown-content z-[60] mt-3 w-[22rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-3xl border border-white/8 bg-base-100 shadow-2xl">
                      <li className="border-b border-base-300/70 px-4 py-3 text-sm font-semibold text-base-content">Notifications</li>
                      <li>
                        <div className="notification-scroll max-h-[24rem] overflow-x-hidden overflow-y-auto px-3 py-3">
                          {notifications.length === 0
                            ? <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 px-3 py-4 text-sm text-base-content/60">No notifications yet</div>
                            : (
                              <div className="flex flex-col gap-2">
                                {notifications.slice(0, 8).map((n) => (
                                  <div key={n.id} className={`rounded-2xl border px-3 py-3 ${n.read ? 'border-base-300 bg-base-100' : 'border-primary/20 bg-primary/10'}`}>
                                    <div className="flex items-start gap-3">
                                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => handleNotificationOpen(n.id)}>
                                        <div className="break-words text-sm font-semibold leading-6">{n.title}</div>
                                        <div className="mt-1 whitespace-normal break-words text-xs leading-6 text-base-content/70">{n.message}</div>
                                        <div className="mt-2 text-[11px] text-base-content/50">{formatFirestoreDate(n.createdAt)}</div>
                                      </button>
                                      <button type="button" className="btn btn-ghost btn-xs mt-0.5 shrink-0 rounded-full text-base-content/45 hover:bg-error/10 hover:text-error" onClick={(e) => handleDeleteNotification(e, n.id)} aria-label="Delete notification">✕</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* User menu */}
                  <div className="dropdown dropdown-end shrink-0">
                    <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar h-12 w-12 border border-primary/35 bg-base-200/60 shadow-[0_12px_30px_rgba(102,126,234,0.18)] transition hover:border-primary/55 hover:bg-base-200/80" title={user.displayName || 'User menu'}>
                      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full text-base font-semibold text-primary">
                        {user.photoURL ? <img src={user.photoURL} alt={user.displayName || 'User'} className="h-full w-full object-cover object-center" /> : <span className="flex items-center justify-center leading-none" style={{ lineHeight: 1 }}>{(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}</span>}
                      </div>
                    </div>
                    <ul tabIndex={0} className="menu menu-sm dropdown-content z-[60] mt-3 w-64 rounded-3xl border border-white/8 bg-base-100 p-3 shadow-2xl">
                      <li className="menu-title px-2"><span className="truncate">{user.displayName || 'User'}</span></li>
                      <li><Link to="/dashboard" className="rounded-2xl">Dashboard</Link></li>
                      <li><Link to="/profile" className="rounded-2xl">Profile</Link></li>
                      {canBid && <li><Link to="/earnings" className="rounded-2xl">Earnings</Link></li>}
                      {isOwner && <li><Link to="/owner-dashboard" className="rounded-2xl">Owner Panel</Link></li>}
                      <div className="divider my-1"></div>
                      <li>
                        <button onClick={() => setShowChangeRole(true)} className="rounded-2xl text-base-content/70">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                          Change Role
                        </button>
                      </li>
                      <li>
                        <button onClick={() => setShowChangeEmail(true)} className="rounded-2xl text-base-content/70">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          Change Email
                        </button>
                      </li>
                      <div className="divider my-1"></div>
                      <li><button onClick={logout} className="rounded-2xl text-error">Logout</button></li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="flex min-w-0 items-center gap-2">
                  <Link to="/login" className="btn btn-ghost rounded-full border border-white/8 bg-base-200/45 px-4">Login</Link>
                  <Link to="/role-select" className="btn btn-primary rounded-full px-5 text-white shadow-[0_12px_30px_rgba(102,126,234,0.35)]">Sign Up</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-[70] lg:hidden ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div className={`absolute inset-0 bg-slate-950/60 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={closeMenu}></div>
        <aside className={`absolute left-0 top-0 flex h-full w-[min(24rem,88vw)] flex-col border-r border-white/10 bg-base-100 p-4 shadow-2xl transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0"><p className="text-sm font-semibold text-primary">TaskMarket</p></div>
            <button type="button" className="btn btn-ghost btn-circle border border-white/8 bg-base-200/55" onClick={closeMenu} aria-label="Close navigation menu">✕</button>
          </div>
          <ul className="menu rounded-3xl border border-white/8 bg-base-200/45 p-3 text-base [&_a]:my-1 [&_a]:min-h-11 [&_a]:px-4 [&_a]:py-3">{navLinks}</ul>
          <div className="mt-4 grid grid-cols-1 gap-2">
            <button className="btn btn-outline w-full justify-center rounded-2xl" onClick={toggleTheme}>
              {theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            </button>
            {user ? (
              <>
                <button className="btn btn-outline w-full rounded-2xl" onClick={() => { closeMenu(); setShowChangeRole(true); }}>Change Role</button>
                <button className="btn btn-outline w-full rounded-2xl" onClick={() => { closeMenu(); setShowChangeEmail(true); }}>Change Email</button>
                <button className="btn btn-outline btn-error w-full rounded-2xl" onClick={logout}>Logout</button>
              </>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link to="/login" className="btn btn-outline rounded-2xl" onClick={closeMenu}>Login</Link>
                <Link to="/role-select" className="btn btn-primary rounded-2xl" onClick={closeMenu}>Sign Up</Link>
              </div>
            )}
          </div>
          {user ? (
            <div className="mt-auto rounded-3xl border border-white/8 bg-base-200/35 p-4">
              <div className="flex items-center gap-3">
                <div className="avatar">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-primary/35 bg-base-100 text-sm font-semibold text-primary">
                    {user.photoURL ? <img src={user.photoURL} alt={user.displayName || 'User'} className="h-full w-full object-cover object-center" /> : <span className="flex items-center justify-center leading-none" style={{ lineHeight: 1 }}>{(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}</span>}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{user.displayName || 'User'}</p>
                  <p className="truncate text-xs text-base-content/60">{user.email}</p>
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
};

export default Navbar;
