import { initializeApp } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, setLogLevel } from 'firebase/firestore';

// Suppress Firestore connection warning/error console logs as we handle offline gracefully
setLogLevel('silent');

const firebaseConfig = {
  apiKey: "AIzaSyCJbJkcEbJOfiugVmFLnhZ6KrMRTHYryUk",
  authDomain: "intrepid-envoy-wtxfk.firebaseapp.com",
  projectId: "intrepid-envoy-wtxfk",
  storageBucket: "intrepid-envoy-wtxfk.firebasestorage.app",
  messagingSenderId: "533237225947",
  appId: "1:533237225947:web:9be8b6d9dccba5872caffe"
};

const app = initializeApp(firebaseConfig);

// Failsafe Firestore DB initialization to prevent white screen on IndexedDB/storage restrictions
function initDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      }),
      experimentalForceLongPolling: true
    }, "ai-studio-22086102-239d-4a2c-94c5-673769b61fd8");
  } catch (err) {
    console.warn("Firestore persistent cache bypassed, using standard instance:", err);
    try {
      return initializeFirestore(app, { experimentalForceLongPolling: true }, "ai-studio-22086102-239d-4a2c-94c5-673769b61fd8");
    } catch (e2) {
      return getFirestore(app);
    }
  }
}

export const db = initDb();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: localStorage.getItem('kaldas_logged_user') || 'anonymous',
      email: null,
      emailVerified: null,
      isAnonymous: true,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
