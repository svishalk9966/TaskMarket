import React from 'react';

const LoadingSpinner = ({ label = 'Loading...' }) => (
  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite">
    <span className="loading loading-spinner loading-lg text-primary"></span>
    <p className="text-sm font-medium text-base-content/70">{label}</p>
  </div>
);

export default LoadingSpinner;
