import React from 'react';

const StatCard = ({ label, value, accent = 'text-primary' }) => (
  <div className="flex min-h-[8.75rem] min-w-0 flex-col justify-between rounded-[1.75rem] border border-base-300 bg-base-100/95 px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-0.5 sm:px-5 sm:py-5">
    <div className="min-w-0 text-[0.68rem] font-semibold uppercase leading-5 tracking-[0.2em] text-base-content/50 [overflow-wrap:anywhere] sm:text-[0.72rem]">{label}</div>
    <div className={`mt-3 break-words text-[1.8rem] font-bold leading-tight sm:text-[2rem] ${accent}`}>{value}</div>
  </div>
);

export default StatCard;
