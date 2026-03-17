import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  verifyBeforeUpdateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reload,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const requiredFirebaseEnv = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const missingFirebaseEnv = requiredFirebaseEnv.filter((key) => !import.meta.env[key]);

if (missingFirebaseEnv.length > 0) {
  console.warn(`Missing Firebase environment variables: ${missingFirebaseEnv.join(', ')}`);
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
export const facebookProvider = new FacebookAuthProvider();

googleProvider.setCustomParameters({ prompt: 'select_account' });
githubProvider.setCustomParameters({ allow_signup: 'true' });
facebookProvider.setCustomParameters({ display: 'popup' });

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInWithGithub = () => signInWithPopup(auth, githubProvider);
export const signInWithFacebook = () => signInWithPopup(auth, facebookProvider);

export const loginWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signupWithEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const updateUserProfile = (user, data) => updateProfile(user, data);
export const logoutUser = () => signOut(auth);
export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);
export const resetPasswordForEmail = (email) => sendPasswordResetEmail(auth, email);

// Change email with verification — sends link to NEW email before applying change
// currentPassword is null for OAuth providers (Google/GitHub) — skip re-auth for them
export const requestEmailChange = async (currentPassword, newEmail) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('No authenticated user found.');
  // Re-authenticate only for email/password accounts
  if (currentPassword) {
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
  }
  // Send verification link to new email — change only applies after user clicks the link
  await verifyBeforeUpdateEmail(currentUser, newEmail);
  // Pre-update Firestore with new email so it stays in sync after verification
  try {
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, { pendingEmail: newEmail.toLowerCase() });
  } catch (_) { /* non-critical — Firestore update can fail silently */ }
  // Sign out — user must log in fresh with new email after clicking verification link
  await signOut(auth);
};

// Reload current user from Firebase to get latest email/profile data
export const reloadCurrentUser = async () => {
  const currentUser = auth.currentUser;
  if (currentUser) await reload(currentUser);
  return auth.currentUser;
};

export const usersCollection = collection(db, 'users');
export const tasksCollection = collection(db, 'tasks');
export const bidsCollection = collection(db, 'bids');
export const paymentsCollection = collection(db, 'payments');

export const ensureUserDocument = async (user, extra = {}) => {
  if (!user?.uid) return;

  const userRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userRef);
  const basePayload = {
    uid: user.uid,
    name: extra.displayName || user.displayName || user.email?.split('@')[0] || 'User',
    email: (user.email || '').toLowerCase(),
    photoURL: user.photoURL || '',
    providerId: user.providerData?.[0]?.providerId || 'password',
    lastLoginAt: serverTimestamp(),
    status: extra.status || 'active',
  };

  if (!existing.exists()) {
    await setDoc(userRef, {
      ...basePayload,
      role: extra.role || 'user',
      createdAt: serverTimestamp(),
      disabled: false,
    });
    return;
  }

  await setDoc(userRef, basePayload, { merge: true });
};

export const formatFirestoreDate = (value) => {
  if (!value) return '—';
  if (value instanceof Timestamp) return value.toDate().toLocaleString();
  if (value?.seconds) return new Date(value.seconds * 1000).toLocaleString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
  }
  if (value instanceof Date) return value.toLocaleString();
  return '—';
};

export {
  collection,
  addDoc,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
};
