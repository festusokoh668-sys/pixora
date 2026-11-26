/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  HardDrive,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  AlertTriangle,
  Copy,
  FolderHeart,
} from 'lucide-react';
import { User } from 'firebase/auth';
import confetti from 'canvas-confetti';
import { CanvasLayer, DrawingTemplate, Stroke } from '../types';
import {
  LocalArtworkRecord,
  saveLocalArtwork,
  updateLocalArtworkMetadata,
} from '../utils/indexedDB';
import {
  saveArtworkToFirestore,
  extractReadableFirestoreError,
} from '../firebase/firestore';
import { createThumbnailDataUrl } from '../utils/previewGenerator';
import { ProjectSyncStatus } from './PaintStatusBar';

interface CloudSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  isAuthReady?: boolean;
  currentArtworkId: string | null;
  currentArtworkTitle: string;
  currentArtworkCreatedAt?: string | null;
  currentArtworkUpdatedAt?: string | null;
  strokes: Stroke[];
  layers?: CanvasLayer[];
  activeLayerId?: string;
  activeTemplate: DrawingTemplate | null;
  templateOpacity?: number;
  zoomLevel?: number;
  canvasDimensions: { width: number; height: number };
  getCanvasDataUrl: () => string | null;
  onSavedSuccess: (artwork: LocalArtworkRecord) => void;
  onRequestSignIn: () => void;
  onSyncStatusChange?: (status: ProjectSyncStatus) => void;
}

export const CloudSaveModal: React.FC<CloudSaveModalProps> = ({
  isOpen,
  onClose,
  user,
  isAuthReady = true,
  currentArtworkId,
  currentArtworkTitle,
  currentArtworkCreatedAt,
  currentArtworkUpdatedAt,
  strokes,
  layers,
  activeLayerId,
  activeTemplate,
  templateOpacity,
  zoomLevel,
  canvasDimensions,
  getCanvasDataUrl,
  onSavedSuccess,
  onRequestSignIn,
  onSyncStatusChange,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saveMode, setSaveMode] = useState<'update' | 'new'>('update');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Conflict handling
  const [conflictDetected, setConflictDetected] = useState<{
    remoteUpdatedAt: string;
    pendingSaveRecord?: LocalArtworkRecord;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSavingStatus(null);
      setIsSaving(false);
      setConflictDetected(null);

      if (currentArtworkTitle && currentArtworkTitle !== 'Untitled') {
        setTitle(currentArtworkTitle);
      } else if (activeTemplate) {
        setTitle(`${activeTemplate.name} Sketch`);
      } else {
        setTitle('My First Drawing');
      }

      setSaveMode(currentArtworkId ? 'update' : 'new');

      const dataUrl = getCanvasDataUrl();
      if (dataUrl) {
        setPreviewUrl(dataUrl);
      }
    }
  }, [isOpen, currentArtworkId, currentArtworkTitle, activeTemplate, getCanvasDataUrl]);

  if (!isOpen) return null;

  const performSave = async (forceOverwrite = false, forceAsNew = false) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please provide a title for your artwork.');
      return;
    }

    if (!isAuthReady) {
      setError('Checking your sign-in session. Please wait a moment and try again.');
      return;
    }

    const dataUrl = previewUrl || getCanvasDataUrl();
    if (!dataUrl) {
      setError('Could not export canvas image.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setConflictDetected(null);
    onSyncStatusChange?.('Syncing');

    try {
      const isUpdatingExisting = Boolean(currentArtworkId && saveMode === 'update' && !forceAsNew);
      const artworkId = isUpdatingExisting
        ? (currentArtworkId as string)
        : `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const userId = user ? user.uid : 'guest';
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      // 1. Generate thumbnail for IndexedDB preview store
      setSavingStatus('Generating thumbnail preview...');
      const thumbUrl = await createThumbnailDataUrl(dataUrl, 360, 240);

      // Check if template is user-uploaded
      const isCustomTemplate = Boolean(activeTemplate?.id?.startsWith('custom_'));

      // 2. Build local record preserving original createdAt on updates
      const now = new Date().toISOString();
      const localRecord: LocalArtworkRecord = {
        id: artworkId,
        userId,
        title: trimmedTitle,
        description: description.trim(),
        canvasWidth: canvasDimensions.width,
        canvasHeight: canvasDimensions.height,
        strokesCount: strokes.length,
        templateId: activeTemplate?.id || '',
        templateName: activeTemplate?.name || '',
        difficulty: activeTemplate?.difficulty || '',
        isCustomTemplate,
        editableData: {
          canvasWidth: canvasDimensions.width,
          canvasHeight: canvasDimensions.height,
          strokes,
          layers,
          activeLayerId,
          template: activeTemplate,
          templateOpacity,
          zoomLevel,
        },
        syncStatus: user && isOnline ? 'syncing' : user ? 'waiting_to_sync' : 'local_only',
        createdAt: isUpdatingExisting && currentArtworkCreatedAt ? currentArtworkCreatedAt : now,
        updatedAt: now,
      };

      // 3. Save locally to IndexedDB first and wait for transaction commit
      setSavingStatus('Saving project locally to IndexedDB...');
      const savedLocal = await saveLocalArtwork(localRecord, thumbUrl);

      // 4. If signed in and online, synchronize project chunks to Cloud Firestore
      if (user && isOnline) {
        setSavingStatus('Saving editable project chunks to Cloud Firestore...');
        try {
          const cloudMeta = await saveArtworkToFirestore(
            user.uid,
            savedLocal,
            forceOverwrite || !isUpdatingExisting ? undefined : currentArtworkUpdatedAt || undefined
          );

          // Update local status to synced only AFTER Firestore commit succeeds
          await updateLocalArtworkMetadata(savedLocal.id, {
            syncStatus: 'synced',
            lastSyncedAt: cloudMeta.updatedAt,
            updatedAt: cloudMeta.updatedAt,
          });
          savedLocal.syncStatus = 'synced';
          savedLocal.createdAt = cloudMeta.createdAt;
          savedLocal.updatedAt = cloudMeta.updatedAt;
          savedLocal.lastSyncedAt = cloudMeta.updatedAt;
          delete savedLocal.syncError;
          onSyncStatusChange?.('Saved to Cloud');
        } catch (cloudErr: unknown) {
          const errObj = cloudErr as { isConflict?: boolean; remoteUpdatedAt?: string };
          if (errObj?.isConflict) {
            setConflictDetected({
              remoteUpdatedAt: errObj.remoteUpdatedAt || 'recently',
              pendingSaveRecord: savedLocal,
            });
            onSyncStatusChange?.('Save Failed');
            return;
          }

          // Firestore write failed: preserve local IndexedDB backup, surface real error, and DO NOT close or celebrate!
          const readableError = extractReadableFirestoreError(cloudErr);
          console.error('Firestore cloud save failed:', cloudErr);
          await updateLocalArtworkMetadata(savedLocal.id, {
            syncStatus: 'sync_failed',
            syncError: readableError,
          });
          savedLocal.syncStatus = 'sync_failed';
          savedLocal.syncError = readableError;
          onSyncStatusChange?.('Save Failed');
          onSavedSuccess(savedLocal);
          setError(
            `Saved locally in IndexedDB, but Cloud Firestore save failed: ${readableError}`
          );
          return;
        }
      } else if (user && !isOnline) {
        await updateLocalArtworkMetadata(savedLocal.id, {
          syncStatus: 'waiting_to_sync',
        });
        savedLocal.syncStatus = 'waiting_to_sync';
        onSyncStatusChange?.('Waiting to Sync');
      } else {
        onSyncStatusChange?.('Local Only');
      }

      // Celebrate only when the active save operation actually succeeded
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {
        // Non-critical
      }

      onSavedSuccess(savedLocal);
      onClose();
    } catch (err) {
      console.error('Failed to save artwork:', err);
      setError(extractReadableFirestoreError(err));
      onSyncStatusChange?.('Save Failed');
    } finally {
      setIsSaving(false);
      setSavingStatus(null);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSave(false, false);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-artwork-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#FBFBFB] dark:bg-[#1E232D] border border-[#A0A0A0] dark:border-[#3E485C] shadow-2xl rounded-lg overflow-hidden text-[#1E1E1E] dark:text-[#E2E8F0] font-sans"
      >
        {/* Header */}
        <div className="bg-white dark:bg-[#161B22] px-4 py-3 border-b border-[#D8D8D8] dark:border-[#2D333B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#1979CA] text-white flex items-center justify-center">
              {user ? <CloudUpload className="w-3.5 h-3.5" /> : <HardDrive className="w-3.5 h-3.5" />}
            </div>
            <h2 id="save-artwork-title" className="text-[14px] font-semibold tracking-tight">
              {user ? 'Save Artwork' : 'Save Artwork (Local Draft)'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#E5F1FB] dark:hover:bg-[#2D333B] text-[#555] dark:text-[#A0AEC0] cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conflict Resolution View */}
        {conflictDetected ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">
                  Version Conflict Detected
                </h4>
                <p className="text-[11.5px] text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                  This artwork was updated on another device at{' '}
                  <strong>{conflictDetected.remoteUpdatedAt}</strong>.
                  Overwriting will replace the cloud version with your current canvas.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConflictDetected(null)}
                className="w-full sm:w-auto px-3.5 py-1.5 text-[12px] border border-[#CBD5E1] dark:border-[#475569] rounded hover:bg-[#F1F5F9] dark:hover:bg-[#2D3748] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => performSave(false, true)}
                className="w-full sm:w-auto px-3.5 py-1.5 bg-[#475569] hover:bg-[#334155] text-white text-[12px] font-medium rounded flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Save as New Copy</span>
              </button>
              <button
                type="button"
                onClick={() => performSave(true, false)}
                className="w-full sm:w-auto px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CloudUpload className="w-3.5 h-3.5" />
                <span>Overwrite Cloud Version</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded text-[12px] text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Guest Banner Notice */}
            {!user && (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded text-[11.5px] text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    Saving as <strong>Guest</strong> locally in browser IndexedDB.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequestSignIn();
                  }}
                  className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-medium rounded cursor-pointer shrink-0"
                >
                  Sign In to Sync
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Canvas Preview Box */}
              <div className="sm:col-span-1">
                <div className="text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">
                  Preview
                </div>
                <div className="aspect-4/3 rounded border border-[#CBD5E1] dark:border-[#475569] bg-white overflow-hidden flex items-center justify-center p-1 shadow-inner">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Current Canvas Preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-[10px] text-[#94A3B8]">Canvas Preview</div>
                  )}
                </div>
                <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1 text-center font-mono">
                  {canvasDimensions.width} × {canvasDimensions.height}px
                </div>
              </div>

              {/* Artwork Details */}
              <div className="sm:col-span-2 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">
                    Artwork Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Crimson Rose, My Landscape"
                    className="w-full px-3 py-1.5 text-[12px] bg-white dark:bg-[#252C37] border border-[#CBD5E1] dark:border-[#475569] rounded focus:outline-hidden focus:border-[#1979CA] focus:ring-1 focus:ring-[#1979CA]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add notes about your painting, technique, or inspiration..."
                    className="w-full px-3 py-1.5 text-[12px] bg-white dark:bg-[#252C37] border border-[#CBD5E1] dark:border-[#475569] rounded focus:outline-hidden focus:border-[#1979CA] focus:ring-1 focus:ring-[#1979CA] resize-none"
                  />
                </div>

                {/* Save Mode Options */}
                {currentArtworkId && (
                  <div className="p-2.5 bg-[#F1F5F9] dark:bg-[#252C37] rounded border border-[#E2E8F0] dark:border-[#374151] space-y-1.5 text-[11px]">
                    <div className="font-semibold text-[#334155] dark:text-[#CBD5E1]">
                      Saving destination:
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="saveMode"
                        checked={saveMode === 'update'}
                        onChange={() => setSaveMode('update')}
                        className="text-[#1979CA]"
                      />
                      <span>Update existing artwork "{currentArtworkTitle}"</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="saveMode"
                        checked={saveMode === 'new'}
                        onChange={() => setSaveMode('new')}
                        className="text-[#1979CA]"
                      />
                      <span>Save as a new copy</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Editable Project Summary */}
            <div className="p-2.5 bg-[#F8FAFC] dark:bg-[#252C37]/60 rounded border border-[#E2E8F0] dark:border-[#374151] text-[11px] text-[#475569] dark:text-[#94A3B8] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#1979CA]" />
                <span>
                  Saves <strong>editable strokes, layers, and brushes</strong> for future editing.
                </span>
              </div>
              <span className="font-mono text-[10px] bg-white dark:bg-[#1E232D] px-1.5 py-0.5 rounded border border-[#E2E8F0] dark:border-[#475569]">
                {strokes.length} stroke{strokes.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Saving Progress Indicator */}
            {isSaving && (
              <div className="p-3 bg-[#EFF6FF] dark:bg-[#1E2A38] border border-[#BFDBFE] dark:border-[#2B3B4E] rounded text-[12px] text-[#1D4ED8] dark:text-[#93C5FD] flex items-center gap-2 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{savingStatus || 'Saving project...'}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0] dark:border-[#374151]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-3.5 py-1.5 text-[12px] border border-[#CBD5E1] dark:border-[#475569] rounded hover:bg-[#F1F5F9] dark:hover:bg-[#2D3748] cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                data-testid="cloud-save-submit-btn"
                className="px-4 py-1.5 bg-[#1979CA] hover:bg-[#1464A8] text-white text-[12px] font-medium rounded shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : user ? (
                  <>
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>Save Artwork</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Save Local Draft</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
