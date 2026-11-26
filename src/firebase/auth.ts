import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      void setDoc(
        userRef,
        {
          id: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'Pixora Artist',
          photoURL: user.photoURL || '',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch((err) => {
        console.warn('Failed to sync user profile document:', err);
      });
    }
  });
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const signUpWithEmail = async (
  email: string,
  pass: string,
  displayName?: string
): Promise<User> => {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (displayName?.trim()) {
    try {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    } catch {
      // Non-fatal
    }
  }
  try {
    const userRef = doc(db, 'users', cred.user.uid);
    await setDoc(userRef, {
      id: cred.user.uid,
      email: cred.user.email || email.trim(),
      displayName: displayName?.trim() || cred.user.email?.split('@')[0] || 'Pixora Artist',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to create initial user profile document:', err);
  }
  return cred.user;
};

export const signInWithEmail = async (email: string, pass: string): Promise<User> => {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return cred.user;
};

export const signInWithGoogle = async (): Promise<User> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
};

export const sendPasswordReset = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email.trim());
};

export const signOutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const formatAuthError = (err: unknown): string => {
  if (!err) return 'An unknown error occurred.';
  const code = (err as { code?: string })?.code || '';
  const message = (err as Error)?.message || String(err);

  switch (code) {
    case 'auth/invalid-email':
      return 'The email address is invalid. Please check and try again.';
    case 'auth/user-disabled':
      return 'This user account has been disabled.';
    case 'auth/user-not-found':
      return 'No account was found with this email address.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please verify your credentials.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please choose at least 6 characters.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completion.';
    case 'auth/popup-blocked':
      return 'Popup was blocked by your browser. Please allow popups for this site.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connection.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few moments and try again.';
    default:
      return message || 'Authentication failed. Please try again.';
  }
};
