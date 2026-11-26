/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { LocalArtworkRecord } from '../utils/indexedDB';

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
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function extractReadableFirestoreError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || 'Unknown Firestore error');
  try {
    const parsed = JSON.parse(raw) as Partial<FirestoreErrorInfo>;
    if (parsed && typeof parsed.error === 'string') {
      const inner = parsed.error;
      if (inner.toLowerCase().includes('missing or insufficient permissions')) {
        return 'Permission denied by Firestore security rules. Please verify you are signed in and rules allow owner access.';
      }
      if (inner.toLowerCase().includes('client is offline') || inner.toLowerCase().includes('unavailable')) {
        return 'Cannot reach Cloud Firestore right now. Check your internet connection and retry.';
      }
      if (inner.toLowerCase().includes('quota exceeded')) {
        return 'Firestore daily free quota exceeded. Your artwork is safely saved locally in IndexedDB.';
      }
      return inner;
    }
  } catch {
    // Raw message is not JSON
  }
  return raw;
}

// Maximum chunk size in characters for Firestore subdocuments (~250 KiB, safely under 1 MiB & rule limits)
export const FIRESTORE_CHUNK_SIZE = 250 * 1024;
const MAX_BATCH_OPERATIONS = 400;

export interface CloudArtworkMetadata {
  id: string;
  userId: string;
  title: string;
  description: string;
  canvasWidth: number;
  canvasHeight: number;
  strokesCount: number;
  templateId: string;
  templateName: string;
  difficulty: string;
  isCustomTemplate: boolean;
  syncStatus: 'synced';
  formatVersion: number;
  totalChunks: number;
  totalBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectChunkDocument {
  chunkIndex: number;
  totalChunks: number;
  data: string;
  updatedAt: string;
}

/**
 * Remove undefined values recursively from objects and arrays so Firestore doesn't reject them
 */
export function cleanFirestoreObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanFirestoreObject(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreObject(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Strip local-only blob:/data: custom template URLs so large images are never stored in Firestore.
 * Built-in SVG/template metadata is preserved cleanly.
 */
export function sanitizeEditableDataForFirestore(
  editableData: LocalArtworkRecord['editableData']
): LocalArtworkRecord['editableData'] {
  const cleaned = cleanFirestoreObject(editableData);
  if (cleaned?.template) {
    const tpl = { ...cleaned.template };
    if (
      tpl.id?.startsWith('custom_') ||
      tpl.mediaUrl?.startsWith('blob:') ||
      (tpl.mediaUrl?.startsWith('data:') && tpl.mediaUrl.length > 8192)
    ) {
      tpl.mediaUrl = '';
    }
    cleaned.template = tpl;
  }
  return cleaned;
}

/**
 * Split serialized JSON string into safe chunks of <= 250 KiB
 */
export function chunkSerializedProject(serialized: string, chunkSize = FIRESTORE_CHUNK_SIZE): string[] {
  if (!serialized || serialized.length === 0) return ['{}'];
  const chunks: string[] = [];
  for (let i = 0; i < serialized.length; i += chunkSize) {
    chunks.push(serialized.substring(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Save an editable artwork to Cloud Firestore using users/{userId}/artworks/{artworkId}
 * and subcollection projectChunks/{chunkId}.
 */
export async function saveArtworkToFirestore(
  userId: string,
  artwork: LocalArtworkRecord,
  expectedPreviousUpdatedAt?: string
): Promise<CloudArtworkMetadata> {
  if (!userId || userId === 'guest') {
    throw new Error('Cannot save artwork to Firestore without an authenticated user.');
  }

  const artworkPath = `users/${userId}/artworks/${artwork.id}`;
  const now = new Date().toISOString();

  try {
    // 1. Check existing doc for conflict detection and createdAt preservation
    const docRef = doc(db, 'users', userId, 'artworks', artwork.id);
    const existingSnap = await getDoc(docRef);
    let preservedCreatedAt = artwork.createdAt || now;

    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as CloudArtworkMetadata;
      if (existingData.createdAt) {
        preservedCreatedAt = existingData.createdAt;
      }
      if (
        expectedPreviousUpdatedAt &&
        existingData.updatedAt &&
        new Date(existingData.updatedAt).getTime() > new Date(expectedPreviousUpdatedAt).getTime()
      ) {
        const conflictErr = new Error(
          `CONFLICT: Artwork was modified on another device at ${existingData.updatedAt}. Please review before overwriting.`
        );
        (conflictErr as unknown as { isConflict: boolean; remoteUpdatedAt: string }).isConflict = true;
        (conflictErr as unknown as { isConflict: boolean; remoteUpdatedAt: string }).remoteUpdatedAt = existingData.updatedAt;
        throw conflictErr;
      }
    }

    // 2. Serialize and clean editable project data (strip local-only custom template blobs/data URLs)
    const sanitizedEditable = sanitizeEditableDataForFirestore(artwork.editableData);
    const serialized = JSON.stringify(sanitizedEditable);
    const chunks = chunkSerializedProject(serialized);

    // 3. Queue chunk writes + excess chunk deletes + root metadata write across safe batch slices
    type PendingOp =
      | { kind: 'set'; ref: ReturnType<typeof doc>; data: ProjectChunkDocument | CloudArtworkMetadata }
      | { kind: 'delete'; ref: ReturnType<typeof doc> };

    const ops: PendingOp[] = [];

    for (let index = 0; index < chunks.length; index++) {
      const chunkDocRef = doc(
        db,
        'users',
        userId,
        'artworks',
        artwork.id,
        'projectChunks',
        `chunk_${index}`
      );
      const chunkPayload: ProjectChunkDocument = {
        chunkIndex: index,
        totalChunks: chunks.length,
        data: chunks[index],
        updatedAt: now,
      };
      ops.push({ kind: 'set', ref: chunkDocRef, data: chunkPayload });
    }

    // If previously there were more chunks, clean up old excess chunks
    if (existingSnap.exists()) {
      const oldMeta = existingSnap.data() as CloudArtworkMetadata;
      if (oldMeta.totalChunks > chunks.length) {
        for (let oldIdx = chunks.length; oldIdx < oldMeta.totalChunks; oldIdx++) {
          const obsoleteDocRef = doc(
            db,
            'users',
            userId,
            'artworks',
            artwork.id,
            'projectChunks',
            `chunk_${oldIdx}`
          );
          ops.push({ kind: 'delete', ref: obsoleteDocRef });
        }
      }
    }

    // 4. Write Root Artwork Metadata (always committed in the final batch)
    const safeTitle = (artwork.title || 'Untitled').trim().slice(0, 200) || 'Untitled';
    const safeDescription = (artwork.description || '').trim().slice(0, 1000);
    const metadata: CloudArtworkMetadata = {
      id: artwork.id,
      userId,
      title: safeTitle,
      description: safeDescription,
      canvasWidth: Math.max(1, Number(artwork.canvasWidth) || 819),
      canvasHeight: Math.max(1, Number(artwork.canvasHeight) || 460),
      strokesCount: artwork.editableData?.strokes?.length ?? artwork.strokesCount ?? 0,
      templateId: (artwork.templateId || '').slice(0, 128),
      templateName: (artwork.templateName || '').slice(0, 200),
      difficulty: (artwork.difficulty || '').slice(0, 64),
      isCustomTemplate: Boolean(artwork.isCustomTemplate),
      syncStatus: 'synced',
      formatVersion: 2,
      totalChunks: chunks.length,
      totalBytes: serialized.length,
      createdAt: preservedCreatedAt,
      updatedAt: now,
    };

    ops.push({ kind: 'set', ref: docRef, data: metadata });

    for (let i = 0; i < ops.length; i += MAX_BATCH_OPERATIONS) {
      const batch = writeBatch(db);
      const slice = ops.slice(i, i + MAX_BATCH_OPERATIONS);
      for (const op of slice) {
        if (op.kind === 'set') {
          batch.set(op.ref, op.data);
        } else {
          batch.delete(op.ref);
        }
      }
      await batch.commit();
    }

    return metadata;
  } catch (error) {
    if ((error as unknown as { isConflict?: boolean })?.isConflict) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, artworkPath);
  }
}

/**
 * Reconstruct full editable artwork from Firestore metadata and chunk documents
 */
export async function getArtworkFromFirestore(
  userId: string,
  artworkId: string
): Promise<LocalArtworkRecord | null> {
  const artworkPath = `users/${userId}/artworks/${artworkId}`;

  try {
    const docRef = doc(db, 'users', userId, 'artworks', artworkId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const metadata = docSnap.data() as CloudArtworkMetadata;

    // Fetch all chunks
    const chunksColRef = collection(db, 'users', userId, 'artworks', artworkId, 'projectChunks');
    const chunksSnap = await getDocs(chunksColRef);

    const chunkDocs: ProjectChunkDocument[] = [];
    chunksSnap.forEach((c) => {
      chunkDocs.push(c.data() as ProjectChunkDocument);
    });

    // Sort in ascending order
    chunkDocs.sort((a, b) => a.chunkIndex - b.chunkIndex);

    if (metadata.totalChunks > 0 && chunkDocs.length < metadata.totalChunks) {
      throw new Error(
        `Incomplete project data in Cloud Firestore for "${metadata.title}" (expected ${metadata.totalChunks} chunks, found ${chunkDocs.length}).`
      );
    }

    // Reconstruct serialized payload
    const reconstructedSerialized = chunkDocs.map((c) => c.data).join('');
    const editableData = reconstructedSerialized ? JSON.parse(reconstructedSerialized) : {
      canvasWidth: metadata.canvasWidth,
      canvasHeight: metadata.canvasHeight,
      strokes: [],
    };

    const record: LocalArtworkRecord = {
      id: metadata.id,
      userId: metadata.userId,
      title: metadata.title,
      description: metadata.description,
      canvasWidth: metadata.canvasWidth,
      canvasHeight: metadata.canvasHeight,
      strokesCount: metadata.strokesCount,
      templateId: metadata.templateId,
      templateName: metadata.templateName,
      difficulty: metadata.difficulty,
      isCustomTemplate: metadata.isCustomTemplate,
      editableData,
      syncStatus: 'synced',
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      lastSyncedAt: metadata.updatedAt,
    };

    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, artworkPath);
  }
}

/**
 * Fetch list of all artworks owned by user in Cloud Firestore
 */
export async function getUserCloudArtworks(userId: string): Promise<CloudArtworkMetadata[]> {
  const path = `users/${userId}/artworks`;
  try {
    const colRef = collection(db, 'users', userId, 'artworks');
    const snap = await getDocs(colRef);
    const results: CloudArtworkMetadata[] = [];
    snap.forEach((d) => {
      results.push(d.data() as CloudArtworkMetadata);
    });

    // Sort newest updated first
    results.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Rename an artwork's title in Cloud Firestore
 */
export async function updateCloudArtworkMetadata(
  userId: string,
  artworkId: string,
  updates: Partial<Pick<CloudArtworkMetadata, 'title' | 'description'>>
): Promise<string> {
  const path = `users/${userId}/artworks/${artworkId}`;
  const updatedAt = new Date().toISOString();
  try {
    const docRef = doc(db, 'users', userId, 'artworks', artworkId);
    const sanitizedUpdates: Record<string, string> = { updatedAt };
    if (typeof updates.title === 'string') {
      sanitizedUpdates.title = updates.title.trim().slice(0, 200);
    }
    if (typeof updates.description === 'string') {
      sanitizedUpdates.description = updates.description.trim().slice(0, 1000);
    }
    await updateDoc(docRef, sanitizedUpdates);
    return updatedAt;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Delete an artwork and its project chunks from Cloud Firestore
 */
export async function deleteArtworkFromFirestore(
  userId: string,
  artworkId: string
): Promise<void> {
  const path = `users/${userId}/artworks/${artworkId}`;
  try {
    const chunksColRef = collection(db, 'users', userId, 'artworks', artworkId, 'projectChunks');
    const chunksSnap = await getDocs(chunksColRef);

    const refsToDelete = [...chunksSnap.docs.map((c) => c.ref), doc(db, 'users', userId, 'artworks', artworkId)];
    for (let i = 0; i < refsToDelete.length; i += MAX_BATCH_OPERATIONS) {
      const batch = writeBatch(db);
      for (const ref of refsToDelete.slice(i, i + MAX_BATCH_OPERATIONS)) {
        batch.delete(ref);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
