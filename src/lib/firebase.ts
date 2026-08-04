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

// Initialize Firestore with offline persistence for real-time multi-tab sync
function initDb() {
  try {
    // Try with persistent cache for reliable offline + real-time support
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager({ forceOwnership: true }),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
      }),
      databaseId: "ai-studio-22086102-239d-4a2c-94c5-673769b61fd8"
    });
  } catch (e1) {
    // Already initialized or named DB not available — fall back to default
    try {
      return getFirestore(app, "ai-studio-22086102-239d-4a2c-94c5-673769b61fd8");
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // Log only — never throw, so listeners stay alive for real-time updates
  console.warn(`[Firestore ${operationType}] ${path || ''}:`, error instanceof Error ? error.message : String(error));
}
