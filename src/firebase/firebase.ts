import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import rawConfig from '../../firebase-applet-config.json';

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

const pickConfigValue = (envValue?: string, fileValue?: string): string => {
  const trimmedEnv = typeof envValue === 'string' ? envValue.trim() : '';
  if (trimmedEnv) return trimmedEnv;
  const trimmedFile = typeof fileValue === 'string' ? fileValue.trim() : '';
  return trimmedFile;
};

const resolveConfig = (): FirebaseClientConfig => {
  const fileConfig = (rawConfig || {}) as Record<string, string>;
  const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
  const firestoreDatabaseId = pickConfigValue(
    env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
    fileConfig.firestoreDatabaseId
  );

  return {
    apiKey: pickConfigValue(env.VITE_FIREBASE_API_KEY, fileConfig.apiKey),
    authDomain: pickConfigValue(env.VITE_FIREBASE_AUTH_DOMAIN, fileConfig.authDomain),
    projectId: pickConfigValue(env.VITE_FIREBASE_PROJECT_ID, fileConfig.projectId),
    storageBucket: pickConfigValue(env.VITE_FIREBASE_STORAGE_BUCKET, fileConfig.storageBucket),
    messagingSenderId: pickConfigValue(env.VITE_FIREBASE_MESSAGING_SENDER_ID, fileConfig.messagingSenderId),
    appId: pickConfigValue(env.VITE_FIREBASE_APP_ID, fileConfig.appId),
    firestoreDatabaseId: firestoreDatabaseId || undefined,
  };
};

export const firebaseConfig = resolveConfig();

export const isFirebaseConfigured = (): boolean => {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);

export const configuredFirestoreDatabaseId =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : '(default)';

export const db: Firestore =
  configuredFirestoreDatabaseId !== '(default)'
    ? getFirestore(app, configuredFirestoreDatabaseId)
    : getFirestore(app);

// Connectivity check per skill instructions
if (typeof window !== 'undefined' && isFirebaseConfigured()) {
  (async () => {
    try {
      await getDocFromServer(doc(db, '_connection_test', 'ping'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn('Firebase client is currently offline or unreachable.');
      }
    }
  })();
}

export default app;
