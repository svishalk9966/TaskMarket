import React from 'react';
import { Link } from 'react-router-dom';
import Hero from '../components/Hero';

const Home = () => {
  return (
    <>
      <Hero />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-12">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="card bg-base-100 shadow-lg p-6 text-center">
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-xl font-bold mb-2">Post a Task</h3>
            <p className="text-base-content/60">Describe what you need done and set your budget</p>
          </div>
          <div className="card bg-base-100 shadow-lg p-6 text-center">
            <div className="text-4xl mb-4">🤝</div>
            <h3 className="text-xl font-bold mb-2">Review Bids</h3>
            <p className="text-base-content/60">Compare proposals and choose the best freelancer</p>
          </div>
          <div className="card bg-base-100 shadow-lg p-6 text-center sm:col-span-2 lg:col-span-1">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-xl font-bold mb-2">Get It Done</h3>
            <p className="text-base-content/60">Collaborate and pay only when satisfied</p>
          </div>
        </div>
      </div>

      <div className="bg-base-200 py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to Start?</h2>
          <p className="text-base-content/60 mb-8">Join thousands of freelancers and clients today</p>
          <Link to="/role-select" className="btn btn-primary btn-md sm:btn-lg w-full sm:w-auto">Get Started for Free</Link>
        </div>
      </div>
    </>
  );
};

export default Home;
