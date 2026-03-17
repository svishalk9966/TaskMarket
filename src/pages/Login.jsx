import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRole, ROLES } from '../contexts/RoleContext';
import { Link, useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle, loginWithGithub, error, clearError } = useAuth();
  const { role } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setLoading(true);
    setLocalError('');
    clearError();

    try {
      switch(provider) {
        case 'google':
          await loginWithGoogle();
          break;
        case 'github':
          await loginWithGithub();
          break;
        default:
          break;
      }
      navigate('/dashboard');
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (localError) setLocalError('');
    if (error) clearError();
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (localError) setLocalError('');
    if (error) clearError();
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 px-5 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-stretch">
        <div className="hidden w-full rounded-[2rem] border border-base-200 bg-base-100/70 p-8 shadow-xl backdrop-blur lg:flex lg:flex-col lg:justify-between">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-primary">TaskMarket</p>
          <h1 className="mb-4 text-4xl font-bold leading-tight">Sign in and manage tasks from any device.</h1>
          <p className="max-w-xl text-base-content/60">This layout now keeps the auth card readable on mobile, tablet, and desktop without clipping buttons, fields, or social login actions.</p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-base-200 p-4">
              <div className="text-2xl font-bold text-primary">24/7</div>
              <div className="text-sm text-base-content/60">Access your dashboard anytime</div>
            </div>
            <div className="rounded-2xl bg-base-200 p-4">
              <div className="text-2xl font-bold text-secondary">Secure</div>
              <div className="text-sm text-base-content/60">Firebase-backed authentication flow</div>
            </div>
          </div>
        </div>

        <div className="card w-full shrink-0 bg-base-100 shadow-2xl animate-slide-in lg:w-[28rem]">
          <div className="card-body p-5 sm:p-8">
            <div className="mb-8 text-center">
              <h2 className="mb-2 text-2xl font-bold gradient-text sm:text-3xl">Welcome Back</h2>
              <p className="text-sm text-base-content/60 sm:text-base">
                {role === ROLES.CLIENT ? 'Sign in to post tasks and manage your projects'
                  : role === ROLES.FREELANCER ? 'Sign in to browse tasks and place bids'
                  : role === ROLES.BOTH ? 'Sign in to access all TaskMarket features'
                  : 'Sign in to continue to TaskMarket'}
              </p>
            </div>

            {displayError && (
              <div className="alert alert-error mb-4 text-sm sm:text-base">
                <svg className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="break-words">{displayError}</span>
              </div>
            )}

            <div className="mb-6 space-y-3">
              <button onClick={() => handleSocialLogin('google')} className="btn social-btn social-btn-google" disabled={loading} type="button">
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                <span className="truncate">Continue with Google</span>
              </button>

              <button onClick={() => handleSocialLogin('github')} className="btn social-btn social-btn-github" disabled={loading} type="button">
                <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                <span className="truncate">Continue with GitHub</span>
              </button>

            </div>

            <div className="divider text-xs text-base-content/40">OR CONTINUE WITH EMAIL</div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Email</span></label>
                <input type="email" className="input input-bordered w-full" placeholder="you@example.com" value={email} onChange={handleEmailChange} required />
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">Password</span></label>
                <input type="password" className="input input-bordered w-full" placeholder="••••••••" value={password} onChange={handlePasswordChange} required />
              </div>

              <div className="flex items-center justify-end">
              <Link to="/forgot-password" className="link link-primary text-sm">Forgot Password?</Link>
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="loading loading-spinner loading-sm"></span>
                    Signing In...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm">
              Don't have an account?{' '}
              <Link to="/signup" className="link link-primary font-semibold">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
