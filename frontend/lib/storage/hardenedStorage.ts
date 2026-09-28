import type { StateStorage } from "zustand/middleware";

const STORAGE_PREFIX = "flowbre_app_";
const DB_NAME = "flowbre_offline_db";
const STORE_NAME = "app_state";
const DB_VERSION = 1;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface StoragePayload {
  timestamp: number;
  state: unknown;
}

// In-memory fallback storage when IndexedDB is unavailable (SSR, private mode, quotas)
const memoryFallback = new Map<string, string>();

let lastSavedTimestamp: number | null = null;
const saveListeners = new Set<(timestamp: number) => void>();

export function subscribeToAutoSave(listener: (timestamp: number) => void): () => void {
  saveListeners.add(listener);
  return () => {
    saveListeners.delete(listener);
  };
}

export function getLastSavedTimestamp(): number | null {
  return lastSavedTimestamp;
}

/**
 * Opens and initializes the IndexedDB database.
 */
function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn("[HardenedStorage] IndexedDB open error, using memory fallback:", request.error);
        resolve(null);
      };
    } catch (err) {
      console.warn("[HardenedStorage] IndexedDB initialization failed:", err);
      resolve(null);
    }
  });
}

/**
 * Hardened non-blocking IndexedDB persistence adapter.
 * Includes automated 7-day TTL cleanup, quota safeguards, and memory fallback.
 */
export const hardenedIndexedDbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const key = `${STORAGE_PREFIX}${name}`;
    const db = await openDatabase();

    if (!db) {
      const memVal = memoryFallback.get(key);
      if (!memVal) return null;
      try {
        const parsed: StoragePayload = JSON.parse(memVal);
        if (Date.now() - parsed.timestamp > SEVEN_DAYS_MS) {
          memoryFallback.delete(key);
          return null;
        }
        return JSON.stringify(parsed.state);
      } catch {
        return null;
      }
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          const raw = req.result;
          if (!raw) {
            resolve(null);
            return;
          }

          try {
            const parsed: StoragePayload = typeof raw === "string" ? JSON.parse(raw) : raw;
            // Check 7-day TTL expiration
            if (Date.now() - parsed.timestamp > SEVEN_DAYS_MS) {
              void Promise.resolve(hardenedIndexedDbStorage.removeItem(name));
              resolve(null);
              return;
            }

            if (parsed.timestamp) {
              lastSavedTimestamp = parsed.timestamp;
            }
            resolve(JSON.stringify(parsed.state));
          } catch (err) {
            console.warn("[HardenedStorage] Parse error on read:", err);
            resolve(null);
          }
        };

        req.onerror = () => {
          console.warn("[HardenedStorage] Read error:", req.error);
          resolve(null);
        };
      } catch (err) {
        console.warn("[HardenedStorage] Transaction error on read:", err);
        resolve(null);
      }
    });
  },

  setItem: async (name: string, value: string): Promise<void> => {
    const key = `${STORAGE_PREFIX}${name}`;
    const now = Date.now();
    lastSavedTimestamp = now;

    let parsedState: unknown;
    try {
      parsedState = JSON.parse(value);
    } catch {
      parsedState = value;
    }

    const payload: StoragePayload = {
      timestamp: now,
      state: parsedState,
    };

    const serialized = JSON.stringify(payload);
    memoryFallback.set(key, serialized);

    // Notify save listeners for UI auto-save indicator
    saveListeners.forEach((fn) => fn(now));

    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(serialized, key);

        req.onsuccess = () => resolve();
        req.onerror = () => {
          console.warn("[HardenedStorage] Write failed (quota exceeded or storage blocked):", req.error);
          resolve(); // Non-blocking: fail soft to memory
        };
      } catch (err) {
        console.warn("[HardenedStorage] Write transaction failed:", err);
        resolve();
      }
    });
  },

  removeItem: async (name: string): Promise<void> => {
    const key = `${STORAGE_PREFIX}${name}`;
    memoryFallback.delete(key);
    lastSavedTimestamp = null;

    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },
};

/**
 * Completely purges persisted application state from storage.
 */
export async function clearApplicationStorage(name = "onboarding-storage"): Promise<void> {
  await hardenedIndexedDbStorage.removeItem(name);
}
