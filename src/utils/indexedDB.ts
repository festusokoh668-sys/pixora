/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CanvasLayer, DrawingTemplate, Stroke } from '../types';

export type SyncStatus =
  | 'local_only'
  | 'waiting_to_sync'
  | 'syncing'
  | 'synced'
  | 'sync_failed';

export interface LocalArtworkRecord {
  id: string;
  userId: string; // 'guest' or Firebase Auth UID
  title: string;
  description?: string;
  canvasWidth: number;
  canvasHeight: number;
  strokesCount: number;
  templateId?: string;
  templateName?: string;
  difficulty?: string;
  isCustomTemplate?: boolean;
  editableData: {
    canvasWidth: number;
    canvasHeight: number;
    strokes: Stroke[];
    layers?: CanvasLayer[];
    activeLayerId?: string;
    template?: DrawingTemplate | null;
    templateOpacity?: number;
    zoomLevel?: number;
  };
  syncStatus: SyncStatus;
  cloudVersion?: number;
  lastSyncedAt?: string;
  syncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredPreview {
  artworkId: string;
  previewDataUrl: string;
  updatedAt: string;
}

export interface StoredMedia {
  id: string;
  dataUrl: string;
  name?: string;
  mimeType?: string;
  createdAt: string;
}

const DB_NAME = 'pixora_artwork_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in browser environment'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Artworks Store
        if (!db.objectStoreNames.contains('artworks')) {
          const artworkStore = db.createObjectStore('artworks', { keyPath: 'id' });
          artworkStore.createIndex('userId', 'userId', { unique: false });
          artworkStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          artworkStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 2. Previews Store (Local canvas thumbnails/renders)
        if (!db.objectStoreNames.contains('previews')) {
          db.createObjectStore('previews', { keyPath: 'artworkId' });
        }

        // 3. User Uploaded Reference Media Store
        if (!db.objectStoreNames.contains('uploadedMedia')) {
          db.createObjectStore('uploadedMedia', { keyPath: 'id' });
        }
      };

      request.onblocked = () => {
        console.warn('IndexedDB upgrade blocked by another open tab');
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          dbPromise = null;
        };
        database.onclose = () => {
          dbPromise = null;
        };
        resolve(database);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error('Failed to open IndexedDB'));
      };
    });
  }

  return dbPromise;
}

/**
 * Save an artwork record and optional preview locally in IndexedDB.
 * Resolves only after the IndexedDB transaction fully commits.
 */
export async function saveLocalArtwork(
  artwork: LocalArtworkRecord,
  previewDataUrl?: string
): Promise<LocalArtworkRecord> {
  const db = await getDB();
  const tx = db.transaction(['artworks', 'previews'], 'readwrite');
  const artworkStore = tx.objectStore('artworks');
  const previewStore = tx.objectStore('previews');

  const now = new Date().toISOString();
  let finalRecord: LocalArtworkRecord | null = null;

  return new Promise((resolve, reject) => {
    const existingReq = artworkStore.get(artwork.id);

    existingReq.onsuccess = () => {
      const existing = existingReq.result as LocalArtworkRecord | undefined;
      const record: LocalArtworkRecord = {
        ...artwork,
        updatedAt: artwork.updatedAt || now,
        createdAt: artwork.createdAt || existing?.createdAt || now,
        strokesCount: artwork.editableData?.strokes?.length ?? artwork.strokesCount ?? 0,
      };
      finalRecord = record;
      artworkStore.put(record);

      if (previewDataUrl) {
        const previewRecord: StoredPreview = {
          artworkId: record.id,
          previewDataUrl,
          updatedAt: record.updatedAt,
        };
        previewStore.put(previewRecord);
      }
    };

    existingReq.onerror = () => {
      reject(existingReq.error || new Error('Failed to read existing artwork in IndexedDB'));
    };

    tx.oncomplete = () => {
      if (finalRecord) {
        resolve(finalRecord);
      } else {
        reject(new Error('IndexedDB save transaction completed without a record'));
      }
    };
    tx.onerror = () => reject(tx.error || new Error('Failed to save to IndexedDB'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB save transaction was aborted'));
  });
}

/**
 * Retrieve a single artwork record by ID
 */
export async function getLocalArtwork(id: string): Promise<LocalArtworkRecord | null> {
  const db = await getDB();
  const tx = db.transaction('artworks', 'readonly');
  const store = tx.objectStore('artworks');
  const request = store.get(id);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Failed to load artwork from IndexedDB'));
    tx.onerror = () => reject(tx.error || new Error('IndexedDB read transaction failed'));
  });
}

/**
 * Retrieve all local artwork for a specific user ID (or 'guest')
 */
export async function getUserLocalArtworks(userId: string): Promise<LocalArtworkRecord[]> {
  const db = await getDB();
  const tx = db.transaction('artworks', 'readonly');
  const store = tx.objectStore('artworks');
  const index = store.index('userId');
  const request = index.getAll(userId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const list: LocalArtworkRecord[] = request.result || [];
      // Sort newest updated first
      list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
      resolve(list);
    };
    request.onerror = () => reject(request.error || new Error('Failed to list local artworks'));
    tx.onerror = () => reject(tx.error || new Error('IndexedDB list transaction failed'));
  });
}

/**
 * Retrieve all artworks pending synchronization for an authenticated user
 */
export async function getPendingSyncArtworks(userId: string): Promise<LocalArtworkRecord[]> {
  const allUserArtworks = await getUserLocalArtworks(userId);
  return allUserArtworks.filter(
    (a) => a.syncStatus === 'waiting_to_sync' || a.syncStatus === 'sync_failed' || a.syncStatus === 'local_only'
  );
}

/**
 * Update partial metadata of an artwork (e.g. title, sync status, sync error).
 * Preserves createdAt and waits for transaction commit.
 */
export async function updateLocalArtworkMetadata(
  id: string,
  updates: Partial<LocalArtworkRecord>
): Promise<LocalArtworkRecord | null> {
  const db = await getDB();
  const tx = db.transaction('artworks', 'readwrite');
  const store = tx.objectStore('artworks');
  const request = store.get(id);

  let updatedRecord: LocalArtworkRecord | null = null;

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const existing = request.result as LocalArtworkRecord | undefined;
      if (!existing) {
        return;
      }
      const next: LocalArtworkRecord = {
        ...existing,
        ...updates,
        createdAt: existing.createdAt,
        updatedAt: updates.updatedAt || new Date().toISOString(),
      };
      if (updates.syncStatus === 'synced' && !('syncError' in updates)) {
        delete next.syncError;
      }
      updatedRecord = next;
      store.put(next);
    };
    request.onerror = () => reject(request.error || new Error('Failed to read artwork metadata in IndexedDB'));
    tx.oncomplete = () => resolve(updatedRecord);
    tx.onerror = () => reject(tx.error || new Error('Failed to update artwork metadata in IndexedDB'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB metadata update transaction aborted'));
  });
}

/**
 * Delete an artwork and its preview from IndexedDB
 */
export async function deleteLocalArtwork(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['artworks', 'previews'], 'readwrite');
  tx.objectStore('artworks').delete(id);
  tx.objectStore('previews').delete(id);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete artwork from IndexedDB'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB delete transaction aborted'));
  });
}

/**
 * Save preview dataURL for an artwork
 */
export async function saveArtworkPreview(
  artworkId: string,
  previewDataUrl: string
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('previews', 'readwrite');
  const store = tx.objectStore('previews');
  const record: StoredPreview = {
    artworkId,
    previewDataUrl,
    updatedAt: new Date().toISOString(),
  };
  store.put(record);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save artwork preview'));
    tx.onabort = () => reject(tx.error || new Error('Preview save transaction aborted'));
  });
}

/**
 * Retrieve preview dataURL for an artwork
 */
export async function getArtworkPreview(artworkId: string): Promise<string | null> {
  const db = await getDB();
  const tx = db.transaction('previews', 'readonly');
  const store = tx.objectStore('previews');
  const request = store.get(artworkId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const result = request.result as StoredPreview | undefined;
      resolve(result ? result.previewDataUrl : null);
    };
    request.onerror = () => reject(request.error || new Error('Failed to load preview'));
    tx.onerror = () => reject(tx.error || new Error('Preview read transaction failed'));
  });
}

/**
 * Store a custom uploaded reference image
 */
export async function saveUploadedMedia(
  id: string,
  dataUrl: string,
  name?: string
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('uploadedMedia', 'readwrite');
  const store = tx.objectStore('uploadedMedia');
  const record: StoredMedia = {
    id,
    dataUrl,
    name,
    createdAt: new Date().toISOString(),
  };
  store.put(record);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save uploaded media'));
    tx.onabort = () => reject(tx.error || new Error('Uploaded media save transaction aborted'));
  });
}

/**
 * Retrieve a custom uploaded reference image by ID
 */
export async function getUploadedMedia(id: string): Promise<string | null> {
  const db = await getDB();
  const tx = db.transaction('uploadedMedia', 'readonly');
  const store = tx.objectStore('uploadedMedia');
  const request = store.get(id);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const result = request.result as StoredMedia | undefined;
      resolve(result ? result.dataUrl : null);
    };
    request.onerror = () => reject(request.error || new Error('Failed to load uploaded media'));
    tx.onerror = () => reject(tx.error || new Error('Uploaded media read transaction failed'));
  });
}

/**
 * Transfer all 'guest' drafts to an authenticated user upon sign-in.
 * Resolves only after the transaction fully commits.
 */
export async function migrateGuestArtworksToUser(newUserId: string): Promise<number> {
  if (!newUserId || newUserId === 'guest') return 0;
  const db = await getDB();
  const tx = db.transaction('artworks', 'readwrite');
  const store = tx.objectStore('artworks');
  const index = store.index('userId');
  const request = index.getAll('guest');

  let migratedCount = 0;

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const guestArtworks: LocalArtworkRecord[] = request.result || [];
      migratedCount = guestArtworks.length;
      for (const item of guestArtworks) {
        const migrated: LocalArtworkRecord = {
          ...item,
          userId: newUserId,
          syncStatus: 'waiting_to_sync', // Queue for cloud sync now that user has an account
          updatedAt: new Date().toISOString(),
        };
        store.put(migrated);
      }
    };
    request.onerror = () => reject(request.error || new Error('Failed to query guest artworks'));
    tx.oncomplete = () => resolve(migratedCount);
    tx.onerror = () => reject(tx.error || new Error('Failed to migrate guest artworks'));
    tx.onabort = () => reject(tx.error || new Error('Guest migration transaction aborted'));
  });
}
