/**
 * Minimal Promise wrapper around browser IndexedDB to persist dirty CSV drafts
 * and resumable chunk checkpoints when connectivity drops mid-upload (`localStorage`
 * caps out around 5MB and blocks the main thread synchronously).
 */

const DB_NAME = "offline_sheet_guard_db";
const STORE_NAME = "draft_batches";
const DB_VERSION = 1;

export interface SavedDraft {
  id: string;
  rawCsv: string;
  uploadedChunkIndex: number;
  savedAtIso: string;
}

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraftSnapshot(draft: SavedDraft): Promise<void> {
  const db = await openDraftDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(draft);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function loadDraftSnapshot(id: string = "current"): Promise<SavedDraft | null> {
  const db = await openDraftDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as SavedDraft | undefined) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}
