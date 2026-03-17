import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const OwnerLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, logout, user, isOwner, ownerEmail } = useAuth();
  const navigate = useNavigate();

  if (user && isOwner) return <Navigate to="/owner-dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLoading(true);

    try {
      const loggedInUser = await login(email, password);
      if ((loggedInUser.email || '').toLowerCase() !== ownerEmail) {
        await logout();
        setLocalError('This account is not authorized for the owner panel.');
        return;
      }
      navigate('/owner-dashboard');
    } catch (error) {
      setLocalError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 px-4 py-8 sm:px-6 sm:py-10">
      <div className="card mx-auto w-full max-w-lg bg-base-100 shadow-2xl animate-slide-in">
        <div className="card-body p-5 sm:p-8">
          <div className="text-center mb-8">
            <p className="text-sm font-semibold tracking-[0.3em] text-primary uppercase">Owner Access</p>
            <h1 className="text-3xl font-bold mt-2">Secure Admin Login</h1>
            <p className="text-base-content/60 mt-2">Only the configured owner account can access this panel.</p>
          </div>

          {localError && <div className="alert alert-error mb-4"><span>{localError}</span></div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label"><span className="label-text">Owner Email</span></label>
              <input type="email" className="input input-bordered" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Password</span></label>
              <input type="password" className="input input-bordered" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <button type="submit" className={`btn btn-primary w-full ${loading ? 'loading' : ''}`} disabled={loading}>
              {loading ? 'Checking access...' : 'Login to Owner Panel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OwnerLogin;
