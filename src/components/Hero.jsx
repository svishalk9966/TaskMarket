import React from 'react';
import { Link } from 'react-router-dom';
import { useRole } from '../contexts/RoleContext';

const Hero = () => {
  const { canPost, canBid } = useRole();
  const stats = [
    { label: 'Active Tasks', value: '2,500+' },
    { label: 'Freelancers', value: '15,000+' },
    { label: 'Completed', value: '8,200+' },
    { label: 'Categories', value: '50+' }
  ];

  return (
    <div className="relative overflow-hidden bg-base-100">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10"></div>
      <div className="container mx-auto px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20 relative z-10">
        <div className="mx-auto max-w-5xl text-center animate-slide-in">
          <div className="badge badge-primary mb-4 badge-md sm:badge-lg">🚀 Launch Your Career</div>
          <h1 className="mx-auto mb-5 max-w-4xl text-balance text-3xl font-bold leading-tight sm:text-5xl sm:leading-tight lg:text-6xl xl:text-7xl">
            Find Top Freelancers for{' '}
            <span className="gradient-text inline-block">Any Task, Anytime</span>
          </h1>
          <p className="mx-auto mb-8 max-w-3xl px-1 text-sm leading-6 text-base-content/70 sm:text-lg sm:leading-8 lg:text-xl">
            Connect with skilled professionals worldwide. Post tasks, place bids, and get work done efficiently on the most intuitive freelance platform.
          </p>
          <div className="mb-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:gap-4 sm:mb-12">
            {canBid !== false && (
              <Link to="/browse" className="btn btn-primary w-full gap-2 sm:w-auto sm:btn-lg">
                Find Work
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            )}
            {canPost && (
              <Link to="/post" className="btn btn-outline w-full sm:w-auto sm:btn-lg">
                Post a Task
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 max-w-4xl mx-auto">
            {stats.map((stat, idx) => (
              <div key={idx} className="rounded-2xl border border-base-200 bg-base-100/70 p-3 backdrop-blur sm:p-4">
                <div className="text-lg font-bold text-primary sm:text-2xl">{stat.value}</div>
                <div className="text-xs leading-5 text-base-content/60 sm:text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-base-100 to-transparent sm:h-32"></div>
    </div>
  );
};

export default Hero;
