import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRole, ROLES } from '../contexts/RoleContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 300;
const OTP_RESEND_COOLDOWN = 60;
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

// ─── Password rules ───────────────────────────────────────────────────────────
const PASSWORD_RULES = [
  { id: 'length',    label: 'At least 8 characters',         test: (p) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter (A–Z)',     test: (p) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter (a–z)',     test: (p) => /[a-z]/.test(p) },
  { id: 'number',    label: 'One number (0–9)',               test: (p) => /[0-9]/.test(p) },
  { id: 'special',   label: 'One special character (!@#…)',   test: (p) => /[^A-Za-z0-9]/.test(p) },
];
const isPasswordStrong = (p) => PASSWORD_RULES.every((r) => r.test(p));

// ─── OTP helper ───────────────────────────────────────────────────────────────
const generateOtp = () =>
  Array.from({ length: OTP_LENGTH }, () => Math.floor(Math.random() * 10)).join('');

const sendOtpEmail = async (toEmail, otpCode, userName) => {
  const emailjs = await import('@emailjs/browser');
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    throw new Error('Email service is not configured. Check your .env file.');
  }
  await emailjs.send(
    EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID,
    { to_email: toEmail, otp_code: otpCode, user_name: userName || 'there', expiry_minutes: String(Math.floor(OTP_EXPIRY_SECONDS / 60)) },
    EMAILJS_PUBLIC_KEY,
  );
};

// ─── Tiny shared pieces ───────────────────────────────────────────────────────
const FieldError = ({ message }) =>
  message ? (
    <p className="mt-1.5 flex items-center gap-1 text-xs text-error">
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {message}
    </p>
  ) : null;

const PasswordRuleList = ({ password, visible }) => {
  if (!visible) return null;
  return (
    <ul className="mt-2 space-y-1 rounded-xl border border-base-300 bg-base-200/60 px-3 py-2.5 text-xs">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.id} className={`flex items-center gap-1.5 transition-colors ${ok ? 'text-success' : 'text-base-content/50'}`}>
            {ok
              ? <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              : <svg className="h-3.5 w-3.5 shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={2} /></svg>
            }
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const Signup = () => {
  const { signup, loginWithGoogle, loginWithGithub, error, clearError } = useAuth();
  const { role } = useRole();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ displayName: '', email: '', password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors]   = useState({});
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [globalError, setGlobalError]   = useState('');

  // OTP
  const [otpStep, setOtpStep]           = useState(false);
  const [otpDigits, setOtpDigits]       = useState(Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError]         = useState('');
  const [otpSuccess, setOtpSuccess]     = useState('');
  const [otpSending, setOtpSending]     = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpiryLeft, setOtpExpiryLeft]   = useState(0);

  const storedOtp      = useRef('');
  const otpIssuedAt    = useRef(0);
  const pendingData    = useRef(null);
  const otpRefs        = useRef(Array.from({ length: OTP_LENGTH }, () => React.createRef()));
  const resendTimerRef = useRef(null);
  const expiryTimerRef = useRef(null);

  useEffect(() => {
    clearError();
    return () => { clearInterval(resendTimerRef.current); clearInterval(expiryTimerRef.current); };
  }, [clearError]);

  const startResendCooldown = useCallback(() => {
    setResendCooldown(OTP_RESEND_COOLDOWN);
    clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((p) => { if (p <= 1) { clearInterval(resendTimerRef.current); return 0; } return p - 1; });
    }, 1000);
  }, []);

  const startExpiryCountdown = useCallback(() => {
    setOtpExpiryLeft(OTP_EXPIRY_SECONDS);
    clearInterval(expiryTimerRef.current);
    expiryTimerRef.current = setInterval(() => {
      setOtpExpiryLeft((p) => {
        if (p <= 1) { clearInterval(expiryTimerRef.current); setOtpError('OTP expired. Please request a new one.'); storedOtp.current = ''; return 0; }
        return p - 1;
      });
    }, 1000);
  }, []);

  const formatSecs = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const validateForm = () => {
    const e = {};
    if (!formData.displayName.trim()) e.displayName = 'Full name is required.';
    if (!formData.email.trim())       e.email       = 'Email is required.';
    if (!isPasswordStrong(formData.password)) e.password = 'Password does not meet all requirements below.';
    if (!formData.confirmPassword)    e.confirmPassword = 'Please confirm your password.';
    else if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    return e;
  };

  const dispatchOtp = async (email, displayName) => {
    const code = generateOtp();
    storedOtp.current = code;
    otpIssuedAt.current = Date.now();
    await sendOtpEmail(email, code, displayName);
    startResendCooldown();
    startExpiryCountdown();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError(''); clearError();
    const errs = validateForm();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true); setOtpSending(true);
    try {
      await dispatchOtp(formData.email.trim(), formData.displayName.trim());
      pendingData.current = { email: formData.email.trim(), password: formData.password, displayName: formData.displayName.trim() };
      setOtpDigits(Array(OTP_LENGTH).fill('')); setOtpError(''); setOtpSuccess('');
      setOtpStep(true);
      setTimeout(() => otpRefs.current[0]?.current?.focus(), 120);
    } catch (err) {
      setGlobalError(err?.message || 'Failed to send verification email. Please try again.');
    } finally { setLoading(false); setOtpSending(false); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !pendingData.current) return;
    setOtpError(''); setOtpSuccess(''); setOtpSending(true);
    try {
      await dispatchOtp(pendingData.current.email, pendingData.current.displayName);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setOtpSuccess('A new OTP has been sent to your email.');
      otpRefs.current[0]?.current?.focus();
    } catch { setOtpError('Failed to resend OTP. Please try again.'); }
    finally { setOtpSending(false); }
  };

  const handleOtpChange = (e, i) => {
    const val = e.target.value.replace(/\D/, '').slice(-1);
    const next = [...otpDigits]; next[i] = val; setOtpDigits(next); setOtpError('');
    if (val && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.current?.focus();
  };
  const handleOtpKeyDown = (e, i) => {
    if (e.key === 'Backspace') { if (otpDigits[i]) { const n = [...otpDigits]; n[i] = ''; setOtpDigits(n); } else if (i > 0) otpRefs.current[i - 1]?.current?.focus(); }
    else if (e.key === 'ArrowLeft' && i > 0) otpRefs.current[i - 1]?.current?.focus();
    else if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.current?.focus();
  };
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!p) return;
    const next = Array(OTP_LENGTH).fill('');
    p.split('').forEach((ch, i) => { next[i] = ch; });
    setOtpDigits(next);
    otpRefs.current[Math.min(p.length, OTP_LENGTH - 1)]?.current?.focus();
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const entered = otpDigits.join('');
    if (entered.length < OTP_LENGTH) { setOtpError('Please enter the complete 6-digit code.'); return; }
    if (!storedOtp.current) { setOtpError('OTP expired. Please request a new one.'); return; }
    if ((Date.now() - otpIssuedAt.current) / 1000 > OTP_EXPIRY_SECONDS) { storedOtp.current = ''; setOtpError('OTP expired. Please request a new one.'); return; }
    if (entered !== storedOtp.current) { setOtpError('Incorrect OTP. Please check your email and try again.'); return; }
    setOtpVerifying(true); setOtpError('');
    try {
      const { email, password, displayName } = pendingData.current;
      await signup(email, password, displayName);
      storedOtp.current = '';
      clearInterval(resendTimerRef.current); clearInterval(expiryTimerRef.current);
      navigate('/profile', { state: { newUser: true } });
    } catch (err) { setOtpError(err.message || 'Account creation failed. Please try again.'); }
    finally { setOtpVerifying(false); }
  };

  const handleSocialLogin = async (provider) => {
    setLoading(true); setGlobalError(''); clearError();
    try {
      if (provider === 'google') await loginWithGoogle();
      else if (provider === 'github') await loginWithGithub();
      navigate('/dashboard');
    } catch (err) { setGlobalError(err.message); }
    finally { setLoading(false); }
  };

  const handleInputChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    if (globalError) setGlobalError('');
    if (error) clearError();
  };

  const displayError = globalError || error;
  const passwordRulesVisible = passwordFocused || formData.password.length > 0;
  const isOtpComplete = otpDigits.join('').length === OTP_LENGTH;

  // Role label for left panel
  const roleLabel = role === ROLES.CLIENT ? 'Client Account'
    : role === ROLES.FREELANCER ? 'Freelancer Account'
    : role === ROLES.BOTH ? 'Full Access Account'
    : 'TaskMarket Account';

  const roleDesc = role === ROLES.CLIENT
    ? 'Post tasks, review proposals, and hire talented freelancers for any project.'
    : role === ROLES.FREELANCER
    ? 'Browse open tasks, place competitive bids, and grow your freelance career.'
    : role === ROLES.BOTH
    ? 'Post tasks as a client and bid on work as a freelancer — full platform access.'
    : 'Post tasks, place bids, and manage your work from one powerful dashboard.';

  // ══ OTP Screen ══════════════════════════════════════════════════════════════
  if (otpStep) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center">
          <div className="card w-full bg-base-100 shadow-2xl animate-slide-in">
            <div className="card-body p-6 sm:p-8">
              {/* Icon */}
              <div className="mb-5 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold gradient-text">Verify Your Email</h2>
                <p className="mt-1 text-sm text-base-content/60">We sent a {OTP_LENGTH}-digit code to</p>
                <p className="mt-0.5 break-all font-semibold text-base-content text-sm">{pendingData.current?.email}</p>
              </div>

              {/* Expiry */}
              {otpExpiryLeft > 0 && (
                <div className={`mb-4 flex items-center justify-center gap-1.5 text-xs font-medium ${otpExpiryLeft <= 60 ? 'text-warning' : 'text-base-content/50'}`}>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Expires in {formatSecs(otpExpiryLeft)}
                </div>
              )}

              {/* Alerts */}
              {otpSuccess && <div className="alert alert-success mb-4 py-2 text-sm"><svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span>{otpSuccess}</span></div>}
              {otpError   && <div className="alert alert-error mb-4 py-2 text-sm"><svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span className="break-words">{otpError}</span></div>}

              <form onSubmit={handleVerifyOtp}>
                {/* OTP boxes */}
                <div className="flex justify-center gap-2 mb-6 sm:gap-3">
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i} ref={otpRefs.current[i]} type="text" inputMode="numeric" maxLength={1} value={digit}
                      onChange={(e) => handleOtpChange(e, i)} onKeyDown={(e) => handleOtpKeyDown(e, i)} onPaste={handleOtpPaste}
                      className={`h-12 w-10 rounded-xl border text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all sm:h-14 sm:w-12 sm:text-xl ${digit ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-200/60'}`}
                      aria-label={`OTP digit ${i + 1}`}
                    />
                  ))}
                </div>
                <button type="submit" className="btn btn-primary w-full rounded-2xl" disabled={!isOtpComplete || otpVerifying || otpExpiryLeft === 0}>
                  {otpVerifying ? <span className="inline-flex items-center gap-2"><span className="loading loading-spinner loading-sm" />Creating Account…</span> : 'Verify & Create Account'}
                </button>
              </form>

              {/* Resend + back */}
              <div className="mt-5 flex flex-col items-center gap-2 text-sm">
                <span className="text-base-content/55">Didn't receive the code?</span>
                {resendCooldown > 0
                  ? <span className="text-xs text-base-content/60">Resend available in <span className="font-medium text-base-content">{resendCooldown}s</span></span>
                  : <button type="button" onClick={handleResend} disabled={otpSending} className="link link-primary font-semibold">{otpSending ? <span className="inline-flex items-center gap-1.5"><span className="loading loading-spinner loading-xs" />Sending…</span> : 'Resend OTP'}</button>
                }
                <button type="button" className="mt-1 text-xs text-base-content/40 hover:text-base-content/70 transition-colors"
                  onClick={() => { setOtpStep(false); setGlobalError(''); clearError(); clearInterval(resendTimerRef.current); clearInterval(expiryTimerRef.current); }}>
                  ← Back to sign up
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══ Signup Form ══════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 px-5 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-stretch">

        {/* ── Left panel — only visible on lg+ ── */}
        <div className="hidden w-full rounded-[2rem] border border-base-200 bg-base-100/70 p-8 shadow-xl backdrop-blur lg:flex lg:flex-col lg:justify-between">
          {/* Role badge */}
          {role && (
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
              {roleLabel}
            </div>
          )}
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-primary">TaskMarket</p>
          <h1 className="mb-4 text-4xl font-bold leading-tight">
            Start your journey on TaskMarket today.
          </h1>
          <p className="max-w-xl text-base-content/60">{roleDesc}</p>

          {/* Feature highlights */}
          <div className="mt-8 space-y-3">
            {[
              { icon: '✓', text: 'Verified accounts with OTP email confirmation' },
              { icon: '✓', text: 'Post tasks or place bids based on your role' },
              { icon: '✓', text: 'Secure payment flow with escrow protection' },
              { icon: '✓', text: 'Real-time task tracking from your dashboard' },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-3 text-sm text-base-content/70">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-base-200 p-4">
              <div className="text-2xl font-bold text-primary">15k+</div>
              <div className="text-sm text-base-content/60">Active freelancers</div>
            </div>
            <div className="rounded-2xl bg-base-200 p-4">
              <div className="text-2xl font-bold text-secondary">2.5k+</div>
              <div className="text-sm text-base-content/60">Tasks posted monthly</div>
            </div>
          </div>
        </div>

        {/* ── Right panel — signup card ── */}
        <div className="card w-full shrink-0 bg-base-100 shadow-2xl animate-slide-in lg:w-[28rem]">
          <div className="card-body p-5 sm:p-8">

            {/* Header */}
            <div className="mb-6 text-center">
              <h2 className="mb-1.5 text-2xl font-bold gradient-text sm:text-3xl">Create Account</h2>
              <p className="text-sm text-base-content/60">
                {role === ROLES.CLIENT     ? 'Create your client account to post tasks'
                  : role === ROLES.FREELANCER ? 'Create your freelancer account to start bidding'
                  : role === ROLES.BOTH       ? 'Create your account for full platform access'
                  : 'Join thousands of freelancers and clients'}
              </p>
            </div>

            {/* Global error */}
            {displayError && (
              <div className="alert alert-error mb-4 text-sm">
                <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="break-words">{displayError}</span>
              </div>
            )}

            {/* Social — Google + GitHub only */}
            <div className="mb-5 grid grid-cols-2 gap-3">
              <button onClick={() => handleSocialLogin('google')} disabled={loading} type="button"
                className="btn btn-outline w-full gap-2 rounded-2xl hover:border-red-300 hover:bg-red-50 hover:text-red-600">
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm">Google</span>
              </button>

              <button onClick={() => handleSocialLogin('github')} disabled={loading} type="button"
                className="btn btn-outline w-full gap-2 rounded-2xl hover:border-gray-400 hover:bg-gray-100 hover:text-gray-900">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span className="text-sm">GitHub</span>
              </button>
            </div>

            <div className="divider text-xs text-base-content/40">OR CONTINUE WITH EMAIL</div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">Full Name</span></label>
                <input type="text" className={`input input-bordered w-full rounded-2xl ${fieldErrors.displayName ? 'input-error' : ''}`}
                  placeholder="John Doe" value={formData.displayName} onChange={handleInputChange('displayName')} required />
                <FieldError message={fieldErrors.displayName} />
              </div>

              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">Email Address</span></label>
                <input type="email" className={`input input-bordered w-full rounded-2xl ${fieldErrors.email ? 'input-error' : ''}`}
                  placeholder="you@example.com" value={formData.email} onChange={handleInputChange('email')} required />
                <FieldError message={fieldErrors.email} />
              </div>

              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">Password</span></label>
                <input type="password" className={`input input-bordered w-full rounded-2xl ${fieldErrors.password ? 'input-error' : ''}`}
                  placeholder="Create a strong password" value={formData.password} onChange={handleInputChange('password')}
                  onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)} required />
                <FieldError message={fieldErrors.password} />
                <PasswordRuleList password={formData.password} visible={passwordRulesVisible} />
              </div>

              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">Confirm Password</span></label>
                <input type="password" className={`input input-bordered w-full rounded-2xl ${fieldErrors.confirmPassword ? 'input-error' : ''}`}
                  placeholder="Repeat your password" value={formData.confirmPassword} onChange={handleInputChange('confirmPassword')} required />
                <FieldError message={fieldErrors.confirmPassword} />
                {formData.password && formData.confirmPassword && !fieldErrors.confirmPassword && (
                  formData.password === formData.confirmPassword
                    ? <p className="mt-1.5 flex items-center gap-1 text-xs text-success"><svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Passwords match</p>
                    : <p className="mt-1.5 flex items-center gap-1 text-xs text-error"><svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Passwords do not match</p>
                )}
              </div>

              <button type="submit" className="btn btn-primary w-full rounded-2xl shadow-[0_12px_30px_rgba(102,126,234,0.3)]" disabled={loading}>
                {loading
                  ? <span className="inline-flex items-center gap-2"><span className="loading loading-spinner loading-sm" />{otpSending ? 'Sending verification email…' : 'Please wait…'}</span>
                  : 'Create Account'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-base-content/60">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-primary hover:text-primary/80">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
