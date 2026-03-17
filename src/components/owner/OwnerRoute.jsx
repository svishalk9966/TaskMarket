import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const OwnerRoute = ({ children }) => {
  const { user, loading, isOwner } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (!user) return <Navigate to="/owner-login" replace />;
  if (!isOwner) return <Navigate to="/dashboard" replace />;

  return children;
};

export default OwnerRoute;
