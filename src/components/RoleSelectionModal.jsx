import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole, ROLES } from '../contexts/RoleContext';

// ── Role card data ─────────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  {
    id: ROLES.CLIENT,
    emoji: '💼',
    label: 'Client',
    tagline: 'Post tasks & hire talent',
    description: 'Post tasks, review bids, and hire skilled freelancers for your projects.',
    accent: 'from-primary/20 to-primary/5',
    ring: 'ring-primary/40',
    badge: 'bg-primary/15 text-primary',
  },
  {
    id: ROLES.FREELANCER,
    emoji: '🛠️',
    label: 'Freelancer',
    tagline: 'Browse tasks & place bids',
    description: 'Find work, submit proposals, and get hired for projects that match your skills.',
    accent: 'from-secondary/20 to-secondary/5',
    ring: 'ring-secondary/40',
    badge: 'bg-secondary/15 text-secondary',
  },
  {
    id: ROLES.BOTH,
    emoji: '⚡',
    label: 'Both',
    tagline: 'Full platform access',
    description: 'Post tasks and bid on work — get complete access to everything TaskMarket offers.',
    accent: 'from-accent/20 to-accent/5',
    ring: 'ring-accent/40',
    badge: 'bg-accent/15 text-accent',
  },
];

// ── Main modal ─────────────────────────────────────────────────────────────────
const RoleSelectionModal = () => {
  const { hasRole, setRole } = useRole();
  const navigate = useNavigate();

  // Staggered entrance animation state
  const [show, setShow]             = useState(false);
  const [showHeader, setShowHeader] = useState(false);
  const [showCards, setShowCards]   = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [selected, setSelected]     = useState(null);
  const [leaving, setLeaving]       = useState(false);

  useEffect(() => {
    if (hasRole) return;
    const t0 = setTimeout(() => setShow(true), 60);
    const t1 = setTimeout(() => setShowHeader(true), 280);
    const t2 = setTimeout(() => setShowCards(true), 540);
    const t3 = setTimeout(() => setShowActions(true), 820);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [hasRole]);

  if (hasRole) return null;

  // Save role then navigate — short exit animation first
  const proceed = (path) => {
    if (!selected) return;
    setLeaving(true);
    setTimeout(() => {
      setRole(selected);
      navigate(path, { state: { role: selected } });
    }, 300);
  };

  const selectedOpt = ROLE_OPTIONS.find((o) => o.id === selected);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      style={{
        background: 'rgba(2, 8, 23, 0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        opacity: show ? 1 : 0,
        transition: 'opacity 0.45s ease',
      }}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/10 bg-base-100 shadow-[0_40px_100px_rgba(2,8,23,0.55)]"
        style={{
          transform: show && !leaving
            ? 'scale(1) translateY(0)'
            : leaving
            ? 'scale(0.96) translateY(8px)'
            : 'scale(0.92) translateY(16px)',
          opacity: show && !leaving ? 1 : 0,
          transition: 'transform 0.45s cubic-bezier(0.34,1.26,0.64,1), opacity 0.35s ease',
        }}
      >
        {/* Gradient top strip */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent" />

        <div className="px-6 pb-7 pt-8 sm:px-8 sm:pb-8 sm:pt-9">

          {/* ── Header ── */}
          <div
            className="mb-7 text-center"
            style={{
              opacity: showHeader ? 1 : 0,
              transform: showHeader ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-[#6f7bf7] to-secondary shadow-[0_10px_28px_rgba(102,126,234,0.35)]">
              <span className="text-xl font-bold text-white">T</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-base-content sm:text-2xl">
              How would you like to use{' '}
              <span className="gradient-text">TaskMarket?</span>
            </h2>
            <p className="mt-2 text-sm leading-6 text-base-content/60">
              Select your role to get started with the right experience.
            </p>
          </div>

          {/* ── Role cards ── */}
          <div className="mb-6 grid gap-3">
            {ROLE_OPTIONS.map((opt, i) => {
              const isSelected = selected === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelected(opt.id)}
                  style={{
                    opacity: showCards ? 1 : 0,
                    transform: showCards ? 'translateY(0)' : 'translateY(14px)',
                    transition: `opacity 0.38s ease ${i * 90}ms, transform 0.38s ease ${i * 90}ms`,
                  }}
                  className={[
                    'group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200',
                    isSelected
                      ? `border-transparent bg-gradient-to-r ${opt.accent} ring-2 ${opt.ring} shadow-lg`
                      : 'border-base-300 bg-base-200/40 hover:border-base-300/80 hover:bg-base-200/70 hover:shadow-md',
                  ].join(' ')}
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl transition-colors ${isSelected ? 'bg-base-100/60' : 'bg-base-100/80'}`}>
                    {opt.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-base-content">{opt.label}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${opt.badge}`}>
                        {opt.tagline}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-base-content/55">{opt.description}</p>
                  </div>
                  {/* Radio circle */}
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${isSelected ? 'border-primary bg-primary' : 'border-base-300 bg-transparent'}`}>
                    {isSelected && (
                      <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Action buttons — Sign Up / Log In ── */}
          <div
            style={{
              opacity: showActions ? 1 : 0,
              transform: showActions ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}
          >
            {/* Prompt text changes based on selection */}
            <p className="mb-3 text-center text-xs text-base-content/50">
              {selected
                ? `You selected: ${selectedOpt?.label} — now choose how to continue`
                : 'Select a role above, then choose how to continue'}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!selected}
                onClick={() => proceed('/signup')}
                className={[
                  'btn btn-primary rounded-2xl text-white transition-all duration-200',
                  selected
                    ? 'shadow-[0_12px_30px_rgba(102,126,234,0.32)] hover:shadow-[0_16px_36px_rgba(102,126,234,0.42)]'
                    : 'opacity-40 cursor-not-allowed',
                ].join(' ')}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Create Account
              </button>

              <button
                type="button"
                disabled={!selected}
                onClick={() => proceed('/login')}
                className={[
                  'btn btn-outline rounded-2xl transition-all duration-200',
                  !selected && 'opacity-40 cursor-not-allowed',
                ].join(' ')}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Log In
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-base-content/35">
              You can change your role at any time from your account menu.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default RoleSelectionModal;
