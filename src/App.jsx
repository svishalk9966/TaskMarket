import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { RoleProvider } from './contexts/RoleContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';

import Home from './pages/Home';
import BrowseTasks from './pages/BrowseTasks';
import Dashboard from './pages/Dashboard';
import PostTask from './pages/PostTask';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Profile from './pages/Profile';
import Earnings from './pages/Earnings';
import PublicProfile from './pages/PublicProfile';
import OwnerLogin from './pages/owner/OwnerLogin';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import OwnerUsers from './pages/owner/OwnerUsers';
import OwnerTasks from './pages/owner/OwnerTasks';
import OwnerPayments from './pages/owner/OwnerPayments';
import OwnerDisputes from './pages/owner/OwnerDisputes';
import OwnerDeliveryCleanup from './pages/owner/OwnerDeliveryCleanup';
import OwnerRefunds from './pages/owner/OwnerRefunds';
import OwnerExpiredTasks from './pages/owner/OwnerExpiredTasks';
import OwnerRoute from './components/owner/OwnerRoute';
import OwnerLayout from './components/owner/OwnerLayout';
import InfoPage from './pages/info/InfoPage';
import RoleSelectPage from './pages/RoleSelectPage';

// Redirects unauthenticated visitors to /role-select instead of showing the page
const GuestRoleGuard = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/role-select" state={{ next: '/browse' }} replace />;
  }
  return children;
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AppContent = () => {
  const { user, isOwner } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-base-100">
      <Navbar />
      <main className="flex-1 pb-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<GuestRoleGuard><BrowseTasks /></GuestRoleGuard>} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <Signup />} />
          <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" /> : <ForgotPassword />} />
          <Route path="/owner-login" element={isOwner ? <Navigate to="/owner-dashboard" /> : <OwnerLogin />} />

          <Route path="/about-us" element={<InfoPage slug="about-us" />} />
          <Route path="/contacts" element={<InfoPage slug="contacts" />} />
          <Route path="/faq" element={<InfoPage slug="faq" />} />
          <Route path="/blog" element={<InfoPage slug="blog" />} />
          <Route path="/privacy-policy" element={<InfoPage slug="privacy-policy" />} />
          <Route path="/cookie-policy" element={<InfoPage slug="cookie-policy" />} />
          <Route path="/disclaimer" element={<InfoPage slug="disclaimer" />} />
          <Route path="/refund-policy" element={<InfoPage slug="refund-policy" />} />
          <Route path="/terms-and-conditions" element={<InfoPage slug="terms-and-conditions" />} />
          <Route path="/how-it-works" element={<InfoPage slug="how-it-works" />} />
          <Route path="/feature-listing" element={<InfoPage slug="feature-listing" />} />
          <Route path="/employer-registration" element={<InfoPage slug="employer-registration" />} />

          <Route path="/role-select" element={<RoleSelectPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/earnings" element={<ProtectedRoute><Earnings /></ProtectedRoute>} />
          <Route path="/profile/:userId" element={<PublicProfile />} />
          <Route path="/users/:userId" element={<PublicProfile />} />
          <Route path="/post" element={<ProtectedRoute><PostTask /></ProtectedRoute>} />

          <Route path="/owner-dashboard" element={<OwnerRoute><OwnerLayout /></OwnerRoute>}>
            <Route index element={<OwnerDashboard />} />
          </Route>
          <Route path="/owner" element={<OwnerRoute><OwnerLayout /></OwnerRoute>}>
            <Route path="users" element={<OwnerUsers />} />
            <Route path="tasks" element={<OwnerTasks />} />
            <Route path="payments" element={<OwnerPayments />} />
            <Route path="disputes" element={<OwnerDisputes />} />
            <Route path="delivery-cleanup" element={<OwnerDeliveryCleanup />} />
            <Route path="refunds" element={<OwnerRefunds />} />
            <Route path="expired-tasks" element={<OwnerExpiredTasks />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <RoleProvider>
        <AuthProvider>
          <Router>
            <AppContent />
          </Router>
        </AuthProvider>
      </RoleProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
