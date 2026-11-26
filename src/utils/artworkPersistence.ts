import type { SavedArtwork } from '../types';

const DATABASE_NAME = 'pixora-artwork-library';
const DATABASE_VERSION = 1;
const STORE_NAME = 'artworks';

function openArtworkDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser does not support IndexedDB.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local artwork storage.'));
    request.onblocked = () => reject(new Error('Local artwork storage is busy in another tab. Close other Pixora tabs and try again.'));
  });
}

export async function loadLocalArtworks(): Promise<SavedArtwork[]> {
  const database = await openArtworkDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    let records: SavedArtwork[] = [];

    request.onsuccess = () => {
      records = Array.isArray(request.result) ? request.result as SavedArtwork[] : [];
    };

    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error('Could not read saved artwork.'));
    };

    transaction.oncomplete = () => {
      database.close();
      records.sort((a, b) => {
        const aTime = a.savedAt ?? Date.parse(a.date) ?? 0;
        const bTime = b.savedAt ?? Date.parse(b.date) ?? 0;
        return bTime - aTime;
      });
      resolve(records);
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not read saved artwork.'));
    };

    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Reading saved artwork was interrupted.'));
    };
  });
}

export async function saveLocalArtwork(artwork: SavedArtwork): Promise<void> {
  const database = await openArtworkDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const record: SavedArtwork = {
      ...artwork,
      savedAt: artwork.savedAt ?? Date.now(),
      storageScope: 'device',
    };

    transaction.objectStore(STORE_NAME).put(record);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not save artwork on this device.'));
    };

    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Saving artwork was interrupted.'));
    };
  });
}

export async function deleteLocalArtwork(artworkId: string): Promise<void> {
  const database = await openArtworkDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(artworkId);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not delete saved artwork.'));
    };

    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Deleting artwork was interrupted.'));
    };
  });
}
