import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCJbJkcEbJOfiugVmFLnhZ6KrMRTHYryUk",
  authDomain: "intrepid-envoy-wtxfk.firebaseapp.com",
  projectId: "intrepid-envoy-wtxfk",
  storageBucket: "intrepid-envoy-wtxfk.firebasestorage.app",
  messagingSenderId: "533237225947",
  appId: "1:533237225947:web:9be8b6d9dccba5872caffe"
};

// Ensure Firebase app is initialized only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Database ID — where all production data lives
const DB_ID = "ai-studio-22086102-239d-4a2c-94c5-673769b61fd8";

function initDb() {
  try {
    // Use singleTabManager (stable on Cloudflare/browsers) + long-polling (bypasses WebSocket restrictions)
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager({}),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
      }),
      // Critical: long-polling ensures real-time works behind proxies, Cloudflare, and restricted browsers
      experimentalForceLongPolling: true,
    }, DB_ID);
  } catch (e1) {
    // Already initialized — get the existing instance
    try {
      return getFirestore(app, DB_ID);
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

// Helper to sanitize objects before sending to Firestore (removes undefined fields which crash setDoc)
export function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      clean[key] = obj[key];
    }
  }
  return clean;
}

// IMPORTANT: Never throw here — throwing kills the onSnapshot listener permanently
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.warn(`[Firestore ${operationType}] ${path || ''}:`, error instanceof Error ? error.message : String(error));
}
