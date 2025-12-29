import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const isTestEnv = import.meta.env.MODE === 'test' || import.meta.env.VITEST;

export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  );
};

let appInstance: FirebaseApp;
let authInstance: ReturnType<typeof getAuth>;
let dbInstance: ReturnType<typeof getFirestore>;
let storageInstance: ReturnType<typeof getStorage>;
let analyticsInstance: Analytics | null = null;

function createFirebaseAppAndServices() {
  if (appInstance) {
    return { app: appInstance, auth: authInstance, db: dbInstance, storage: storageInstance, analytics: analyticsInstance };
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    appInstance = existingApps[0];
  } else {
    const config = {
      apiKey: firebaseConfig.apiKey || (isTestEnv ? 'mock-api-key' : ''),
      authDomain: firebaseConfig.authDomain || (isTestEnv ? 'mock.firebaseapp.com' : ''),
      projectId: firebaseConfig.projectId || (isTestEnv ? 'mock-project' : ''),
      storageBucket: firebaseConfig.storageBucket || (isTestEnv ? 'mock.appspot.com' : ''),
      messagingSenderId: firebaseConfig.messagingSenderId || (isTestEnv ? '123456789' : ''),
      appId: firebaseConfig.appId || (isTestEnv ? '1:123456789:web:mock' : ''),
      measurementId: firebaseConfig.measurementId || undefined,
    };

    if (!config.apiKey || !config.authDomain || !config.projectId) {
      const missing = [];
      if (!config.apiKey) missing.push('VITE_FIREBASE_API_KEY');
      if (!config.authDomain) missing.push('VITE_FIREBASE_AUTH_DOMAIN');
      if (!config.projectId) missing.push('VITE_FIREBASE_PROJECT_ID');
      throw new Error(
        `Firebase configuration is incomplete. Missing environment variables: ${missing.join(', ')}. ` +
        `Please create a .env.local file with your Firebase configuration. ` +
        `See docs/firebase-migration/CHEF_FIREBASE_MIGRATION_GUIDE.md for details.`
      );
    }

    appInstance = initializeApp(config);
  }

  authInstance = getAuth(appInstance);
  dbInstance = getFirestore(appInstance);
  storageInstance = getStorage(appInstance);

  // Initialize Analytics only in browser environment and if supported
  if (typeof window !== 'undefined' && !isTestEnv) {
    isSupported()
      .then((supported) => {
        if (supported && !analyticsInstance) {
          analyticsInstance = getAnalytics(appInstance);
        }
      })
      .catch((error) => {
        console.warn('Firebase Analytics not available:', error);
      });
  }

  if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
    try {
      connectAuthEmulator(authInstance, 'http://localhost:9099', { disableWarnings: true });
      connectFirestoreEmulator(dbInstance, 'localhost', 8080);
      connectStorageEmulator(storageInstance, 'localhost', 9199);
    } catch (error) {
      console.warn('Firebase emulators not available:', error);
    }
  }

  return { app: appInstance, auth: authInstance, db: dbInstance, storage: storageInstance, analytics: analyticsInstance };
}

// Initialize Firebase services
let app: FirebaseApp;
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;
let storage: ReturnType<typeof getStorage>;
let analytics: Analytics | null = null;

const services = createFirebaseAppAndServices();
app = services.app;
auth = services.auth;
db = services.db;
storage = services.storage;
analytics = services.analytics;

// Initialize Analytics asynchronously
if (typeof window !== 'undefined' && !isTestEnv) {
  isSupported().then((supported) => {
    if (supported && !analytics) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, auth, db, storage, analytics };
export default app;

