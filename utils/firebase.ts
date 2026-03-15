
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getEnv } from './env';
import firebaseConfigData from '../firebase-applet-config.json';

// ---------------------------------------------------------------------------
// FIREBASE CONFIGURATION
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: getEnv('FIREBASE_API_KEY') || firebaseConfigData.apiKey,
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN') || firebaseConfigData.authDomain,
  projectId: getEnv('FIREBASE_PROJECT_ID') || firebaseConfigData.projectId,
  storageBucket: getEnv('FIREBASE_STORAGE_BUCKET') || firebaseConfigData.storageBucket,
  messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID') || firebaseConfigData.messagingSenderId,
  appId: getEnv('FIREBASE_APP_ID') || firebaseConfigData.appId
};

// Check if configuration is present (not default placeholders)
export const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY" && 
                            !firebaseConfig.apiKey.includes("YOUR_API_KEY");

// Initialize Firebase
// We check getApps() to ensure we don't initialize twice during hot-reloads
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// App ID used for database paths
export const appId = 'smash-academy-v1';
