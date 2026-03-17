import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState('');
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const { forgotPassword, error, clearError } = useAuth();

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setLocalError('');
    setSuccess('');
    clearError();

    try {
      await forgotPassword(email);
      setSuccess('Password reset email sent. Check your inbox and spam folder.');
    } catch (err) {
      setLocalError(err.message || 'Unable to send reset email right now.');
    } finally {
      setLoading(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-primary/5 via-base-100 to-secondary/10 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.1),transparent_28%)]"></div>
      <div className="mx-auto flex min-h-[calc(100vh-7.5rem)] max-w-6xl items-center justify-center py-6 sm:py-8 lg:min-h-[calc(100vh-8.5rem)]">
        <div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(24rem,0.8fr)] lg:gap-10">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Account recovery</p>
              <h1 className="mt-3 text-4xl font-bold leading-tight">Reset your TaskMarket password without leaving the current flow.</h1>
              <p className="mt-4 text-base text-base-content/65">Use your account email to receive a reset link. The page is intentionally aligned as part of the main auth experience so the form feels connected to the rest of the product.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-base-300 bg-base-100/80 p-4 shadow-sm">
                  <div className="text-sm font-semibold">Secure reset flow</div>
                  <div className="mt-1 text-sm text-base-content/60">No logic changes. Only a cleaner, more polished presentation.</div>
                </div>
                <div className="rounded-[1.5rem] border border-base-300 bg-base-100/80 p-4 shadow-sm">
                  <div className="text-sm font-semibold">Fast return to login</div>
                  <div className="mt-1 text-sm text-base-content/60">The back-to-login action remains accessible and better positioned.</div>
                </div>
              </div>
            </div>
          </section>

          <div className="w-full">
            <div className="rounded-[2rem] border border-base-300 bg-base-100/95 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur-sm">
              <div className="card-body p-5 sm:p-8 lg:p-9">
                <div className="mb-6 text-center sm:mb-8">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-2xl text-primary shadow-sm">✉️</div>
                  <h1 className="text-3xl font-bold gradient-text sm:text-4xl">Forgot Password</h1>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-base-content/60 sm:text-base">Enter your account email and we will send you a secure reset link so you can get back into TaskMarket quickly.</p>
                </div>

                {displayError ? <div className="alert alert-error mb-5 rounded-2xl text-sm"><span>{displayError}</span></div> : null}
                {success ? <div className="alert alert-success mb-5 rounded-2xl text-sm"><span>{success}</span></div> : null}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="form-control">
                    <label className="label px-1 pb-2"><span className="label-text text-sm font-medium">Email</span></label>
                    <input
                      type="email"
                      className="input input-bordered h-14 w-full rounded-2xl px-4 text-base"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (localError) setLocalError('');
                        if (success) setSuccess('');
                      }}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary h-14 w-full rounded-2xl text-base font-semibold" disabled={loading}>
                    {loading ? <span className="inline-flex items-center gap-2"><span className="loading loading-spinner loading-sm"></span>Sending...</span> : 'Send Reset Link'}
                  </button>
                </form>

                <div className="mt-6 border-t border-base-300/80 pt-5 text-center">
                  <p className="text-sm text-base-content/65">
                    Remembered your password?{' '}
                    <Link to="/login" className="link link-primary font-semibold no-underline transition hover:opacity-80">Back to Login</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
