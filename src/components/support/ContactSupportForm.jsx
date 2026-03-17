import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import emailjs from '@emailjs/browser';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { TASKS_COLLECTION_NAME } from '../../lib/tasks';

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_SUPPORT   = import.meta.env.VITE_EMAILJS_SUPPORT_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

const EMPTY = { name: '', email: '', subject: '', message: '' };

/* ── Animated success screen ─────────────────────────────── */
const SuccessGreeting = ({ name, onReset }) => {
  const [visible, setVisible] = useState(false);
  const [showLines, setShowLines] = useState([false, false, false, false]);

  useEffect(() => {
    // Stagger: card fades in, then lines appear one by one
    const t0 = setTimeout(() => setVisible(true), 60);
    const timers = [180, 480, 780, 1080].map((delay, i) =>
      setTimeout(() => setShowLines((prev) => { const n = [...prev]; n[i] = true; return n; }), delay)
    );
    return () => { clearTimeout(t0); timers.forEach(clearTimeout); };
  }, []);

  const lines = [
    { emoji: '🎉', text: `Thank you, ${name || 'there'}!` },
    { emoji: '📬', text: 'Your message has been received by our support team.' },
    { emoji: '⏱️', text: 'We typically respond within 1 business day.' },
    { emoji: '💙', text: 'We appreciate you reaching out to TaskMarket.' },
  ];

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(18px)',
        transition: 'opacity 0.45s ease, transform 0.45s ease',
      }}
      className="flex flex-col items-center py-10 text-center"
    >
      {/* Animated checkmark circle */}
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.6)',
          transition: 'opacity 0.4s ease 0.1s, transform 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.1s',
        }}
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/15 ring-4 ring-success/25"
      >
        <svg className="h-10 w-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
            style={{
              strokeDasharray: 30,
              strokeDashoffset: visible ? 0 : 30,
              transition: 'stroke-dashoffset 0.5s ease 0.35s',
            }}
          />
        </svg>
      </div>

      {/* Greeting lines — staggered slide-up */}
      <div className="space-y-3 w-full max-w-md">
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              opacity: showLines[i] ? 1 : 0,
              transform: showLines[i] ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}
            className={`flex items-center justify-center gap-2.5 rounded-2xl px-4 py-3 ${
              i === 0
                ? 'bg-primary/10 ring-1 ring-primary/20'
                : 'bg-base-200/60'
            }`}
          >
            <span className="text-xl">{line.emoji}</span>
            <span
              className={`text-sm font-medium leading-6 sm:text-base ${
                i === 0 ? 'text-primary' : 'text-base-content/80'
              }`}
            >
              {line.text}
            </span>
          </div>
        ))}
      </div>

      {/* Send another message button */}
      <button
        type="button"
        onClick={onReset}
        style={{
          opacity: showLines[3] ? 1 : 0,
          transform: showLines[3] ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.4s ease 0.2s, transform 0.4s ease 0.2s',
        }}
        className="btn btn-ghost btn-sm mt-8 rounded-2xl text-base-content/55 hover:text-base-content"
      >
        ← Send another message
      </button>
    </div>
  );
};

/* ── Main form ───────────────────────────────────────────── */
const ContactSupportForm = () => {
  const { user } = useAuth();
  const [form, setForm]         = useState(EMPTY);
  const [errors, setErrors]     = useState({});
  const [status, setStatus]     = useState('idle'); // idle | sending | success | error
  const [senderName, setSenderName] = useState('');
  const [activityCheck, setActivityCheck] = useState('loading'); // loading | allowed | blocked

  // Check if user has any task or bid activity
  useEffect(() => {
    if (!user) { setActivityCheck('blocked'); return; }
    const check = async () => {
      try {
        // Check posted tasks
        const postedSnap = await getDocs(query(collection(db, TASKS_COLLECTION_NAME), where('postedById', '==', user.uid)));
        if (!postedSnap.empty) { setActivityCheck('allowed'); return; }
        // Check bids placed
        const allSnap = await getDocs(collection(db, TASKS_COLLECTION_NAME));
        const hasBid = allSnap.docs.some((d) => (d.data().bids || []).some((b) => b.freelancerId === user.uid));
        setActivityCheck(hasBid ? 'allowed' : 'blocked');
      } catch {
        setActivityCheck('blocked');
      }
    };
    check();
  }, [user]);

  const validate = () => {
    const e = {};
    if (!form.name.trim())                      e.name    = 'Name is required.';
    if (!form.email.trim())                     e.email   = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email   = 'Enter a valid email address.';
    if (!form.subject.trim())                   e.subject = 'Subject is required.';
    if (form.message.trim().length < 10)        e.message = 'Message must be at least 10 characters.';
    return e;
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setStatus('sending');
    setErrors({});

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_SUPPORT,
        {
          name:    form.name.trim(),
          email:   form.email.trim(),
          subject: form.subject.trim(),
          message: form.message.trim(),
        },
        EMAILJS_PUBLIC_KEY,
      );
      setSenderName(form.name.trim());
      setForm(EMPTY);
      setStatus('success');
    } catch (err) {
      console.error('[ContactSupportForm] EmailJS error:', err);
      setStatus('error');
    }
  };

  const handleReset = () => { setStatus('idle'); setErrors({}); };

  // ── Not logged in ──
  if (!user) {
    return (
      <section className="container mx-auto px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">Support</p>
            <h2 className="mt-1 text-2xl font-semibold text-base-content sm:text-3xl">Contact Support</h2>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 rounded-[12px] border border-dashed border-base-300 bg-base-200/35 px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-base-100 text-3xl ring-1 ring-base-300">🔒</div>
            <h3 className="text-lg font-semibold text-base-content">Sign in to contact support</h3>
            <p className="max-w-sm text-sm leading-6 text-base-content/60">
              You need to be logged in to send a support message. Please sign in or create an account first.
            </p>
            <div className="flex gap-3">
              <Link to="/role-select" className="btn btn-primary rounded-2xl px-6">Get Started</Link>
              <Link to="/login" className="btn btn-outline rounded-2xl px-6">Log In</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── Checking activity ──
  if (activityCheck === 'loading') {
    return (
      <section className="container mx-auto px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">Support</p>
            <h2 className="mt-1 text-2xl font-semibold text-base-content sm:text-3xl">Contact Support</h2>
          </div>
          <div className="flex items-center justify-center rounded-[12px] border border-base-300 bg-base-200/35 py-14">
            <span className="loading loading-spinner loading-md text-primary"></span>
          </div>
        </div>
      </section>
    );
  }

  // ── No task activity ──
  if (activityCheck === 'blocked') {
    return (
      <section className="container mx-auto px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">Support</p>
            <h2 className="mt-1 text-2xl font-semibold text-base-content sm:text-3xl">Contact Support</h2>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 rounded-[12px] border border-dashed border-base-300 bg-base-200/35 px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-base-100 text-3xl ring-1 ring-base-300">📋</div>
            <h3 className="text-lg font-semibold text-base-content">Platform activity required</h3>
            <p className="max-w-sm text-sm leading-6 text-base-content/60">
              The support form is available to users who have posted at least one task or placed at least one bid on the platform.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/post" className="btn btn-primary rounded-2xl px-6">Post a Task</Link>
              <Link to="/browse" className="btn btn-outline rounded-2xl px-6">Browse & Bid</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 pb-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">

        {/* Section header */}
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">Support</p>
          <h2 className="mt-1 text-2xl font-semibold text-base-content sm:text-3xl">Contact Support</h2>
          <p className="mt-2 text-base leading-7 text-base-content/70">
            Fill in the form below and our support team will get back to you as soon as possible.
          </p>
        </div>

        <div className="rounded-[12px] border border-base-300 bg-base-200/35 p-6 shadow-sm sm:p-8">

          {/* ── Success greeting ── */}
          {status === 'success' ? (
            <SuccessGreeting name={senderName} onReset={handleReset} />
          ) : (
            <>
              {/* Error alert */}
              {status === 'error' && (
                <div className="alert alert-error mb-6 rounded-2xl text-sm">
                  <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Unable to send message. Please try again later.</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-5">

                {/* Name + Email */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="form-control">
                    <label className="label pb-1">
                      <span className="label-text font-medium">Name</span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered w-full rounded-2xl bg-base-100/80 ${errors.name ? 'input-error' : ''}`}
                      placeholder="Your full name"
                      value={form.name}
                      onChange={handleChange('name')}
                    />
                    {errors.name && <FieldErr msg={errors.name} />}
                  </div>

                  <div className="form-control">
                    <label className="label pb-1">
                      <span className="label-text font-medium">Email</span>
                    </label>
                    <input
                      type="email"
                      className={`input input-bordered w-full rounded-2xl bg-base-100/80 ${errors.email ? 'input-error' : ''}`}
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={handleChange('email')}
                    />
                    {errors.email && <FieldErr msg={errors.email} />}
                  </div>
                </div>

                {/* Subject */}
                <div className="form-control">
                  <label className="label pb-1">
                    <span className="label-text font-medium">Subject</span>
                  </label>
                  <input
                    type="text"
                    className={`input input-bordered w-full rounded-2xl bg-base-100/80 ${errors.subject ? 'input-error' : ''}`}
                    placeholder="Brief summary of your issue"
                    value={form.subject}
                    onChange={handleChange('subject')}
                  />
                  {errors.subject && <FieldErr msg={errors.subject} />}
                </div>

                {/* Message */}
                <div className="form-control">
                  <label className="label pb-1">
                    <span className="label-text font-medium">Message</span>
                  </label>
                  <textarea
                    rows={5}
                    className={`textarea textarea-bordered w-full rounded-2xl bg-base-100/80 text-base leading-6 ${errors.message ? 'textarea-error' : ''}`}
                    placeholder="Describe your issue in detail (minimum 10 characters)"
                    value={form.message}
                    onChange={handleChange('message')}
                  />
                  <div className="mt-1 flex items-start justify-between gap-2">
                    {errors.message ? <FieldErr msg={errors.message} /> : <span />}
                    <span className={`shrink-0 text-xs ${form.message.length < 10 ? 'text-base-content/40' : 'text-success'}`}>
                      {form.message.length} chars
                    </span>
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-1">
                  <button
                    type="submit"
                    className="btn btn-primary rounded-2xl px-8"
                    disabled={status === 'sending'}
                  >
                    {status === 'sending' ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="loading loading-spinner loading-sm" />
                        Sending…
                      </span>
                    ) : 'Send Message'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

const FieldErr = ({ msg }) => (
  <p className="mt-1.5 flex items-center gap-1 text-xs text-error">
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    {msg}
  </p>
);

export default ContactSupportForm;
