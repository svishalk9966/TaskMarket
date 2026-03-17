import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  auth,
  db,
  onAuthChange,
  logoutUser,
  loginWithEmail,
  signupWithEmail,
  updateUserProfile,
  signInWithGoogle,
  signInWithGithub,
  signInWithFacebook,
  ensureUserDocument,
  resetPasswordForEmail,
  getDoc,
  doc,
} from '../firebase';
import { OWNER_EMAIL } from '../config';

const AuthContext = createContext(null);
const normalizeEmail = (email = '') => email.trim().toLowerCase();

const getReadableAuthError = (error, mode = 'login') => {
  const code = error?.code || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return mode === 'signup'
        ? 'This email is already registered. Please sign in instead.'
        : 'This account already exists. Please sign in with your email and password.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/popup-closed-by-user':
      return 'Login popup was closed before completing sign-in.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with a different sign-in method.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/missing-email':
      return 'Please enter your email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a bit and try again.';
    default:
      return error?.message || 'Authentication failed. Please try again.';
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (nextUser) => {
      if (nextUser) {
        try {
          // Check if user is blocked in Firestore before allowing session
          const userSnap = await getDoc(doc(db, 'users', nextUser.uid));
          if (userSnap.exists() && userSnap.data().disabled === true) {
            // User is blocked — force logout immediately
            await logoutUser();
            setUser(null);
            setError('Your account has been blocked. Please contact support.');
            setLoading(false);
            return;
          }
          await ensureUserDocument(nextUser, {
            role: normalizeEmail(nextUser.email) === OWNER_EMAIL ? 'owner' : 'user',
          });
        } catch (syncError) {
          console.error('Failed to sync user profile:', syncError);
        }
      }
      setUser(nextUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    try {
      clearError();
      const result = await loginWithEmail(normalizeEmail(email), password);
      // Check blocked status before allowing login
      const userSnap = await getDoc(doc(db, 'users', result.user.uid));
      if (userSnap.exists() && userSnap.data().disabled === true) {
        await logoutUser();
        const blockedMsg = 'Your account has been blocked. Please contact support at supporttaskmarket@gmail.com';
        setError(blockedMsg);
        throw new Error(blockedMsg);
      }
      await ensureUserDocument(result.user, {
        role: normalizeEmail(result.user.email) === OWNER_EMAIL ? 'owner' : 'user',
      });
      return result.user;
    } catch (authError) {
      if (authError.message.includes('blocked')) {
        setError(authError.message);
        throw authError;
      }
      const readableError = getReadableAuthError(authError, 'login');
      setError(readableError);
      throw new Error(readableError);
    }
  };

  const signup = async (email, password, displayName) => {
    try {
      clearError();
      const normalizedEmail = normalizeEmail(email);
      const result = await signupWithEmail(normalizedEmail, password);
      const safeDisplayName = displayName.trim();
      await updateUserProfile(result.user, { displayName: safeDisplayName });
      await ensureUserDocument({ ...result.user, displayName: safeDisplayName }, {
        displayName: safeDisplayName,
        role: normalizeEmail(email) === OWNER_EMAIL ? 'owner' : 'user',
      });
      return result.user;
    } catch (authError) {
      const readableError = getReadableAuthError(authError, 'signup');
      setError(readableError);
      throw new Error(readableError);
    }
  };

  const handleSocialAuth = async (method) => {
    try {
      clearError();
      const result = await method();
      // Check blocked status for social login too
      const userSnap = await getDoc(doc(db, 'users', result.user.uid));
      if (userSnap.exists() && userSnap.data().disabled === true) {
        await logoutUser();
        const blockedMsg = 'Your account has been blocked. Please contact support at supporttaskmarket@gmail.com';
        setError(blockedMsg);
        throw new Error(blockedMsg);
      }
      await ensureUserDocument(result.user, {
        role: normalizeEmail(result.user.email) === OWNER_EMAIL ? 'owner' : 'user',
      });
      return result.user;
    } catch (authError) {
      if (authError.message.includes('blocked')) {
        setError(authError.message);
        throw authError;
      }
      const readableError = getReadableAuthError(authError, 'social');
      setError(readableError);
      throw new Error(readableError);
    }
  };

  const refreshUserContext = useCallback((overrides = {}) => {
    const fallbackUser = auth.currentUser;
    const nextUser = fallbackUser ? { ...fallbackUser, ...overrides } : null;
    setUser(nextUser);
  }, []);


  const forgotPassword = async (email) => {
    try {
      clearError();
      await resetPasswordForEmail(normalizeEmail(email));
      return true;
    } catch (authError) {
      const readableError = getReadableAuthError(authError, 'reset');
      setError(readableError);
      throw new Error(readableError);
    }
  };

  const logout = async () => {
    try {
      clearError();
      await logoutUser();
      setUser(null);
    } catch (authError) {
      const readableError = getReadableAuthError(authError, 'logout');
      setError(readableError);
      throw new Error(readableError);
    }
  };

  const isOwner = normalizeEmail(user?.email) === OWNER_EMAIL;

  const value = useMemo(() => ({
    user,
    loading,
    error,
    setError,
    clearError,
    login,
    signup,
    forgotPassword,
    logout,
    isOwner,
    ownerEmail: OWNER_EMAIL,
    loginWithGoogle: () => handleSocialAuth(signInWithGoogle),
    loginWithGithub: () => handleSocialAuth(signInWithGithub),
    loginWithFacebook: () => handleSocialAuth(signInWithFacebook),
    refreshUserContext,
  }), [user, loading, error, clearError, isOwner, refreshUserContext]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
