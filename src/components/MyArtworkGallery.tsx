/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Search,
  Download,
  Trash2,
  Edit2,
  FolderHeart,
  Loader2,
  ArrowUpDown,
  RefreshCw,
  Brush,
  AlertTriangle,
  HardDrive,
  Cloud,
  CheckCircle2,
  Clock,
  CloudOff,
  Info,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  LocalArtworkRecord,
  getUserLocalArtworks,
  deleteLocalArtwork,
  updateLocalArtworkMetadata,
  getArtworkPreview,
  saveArtworkPreview,
  saveLocalArtwork,
} from '../utils/indexedDB';
import {
  getUserCloudArtworks,
  getArtworkFromFirestore,
  deleteArtworkFromFirestore,
  updateCloudArtworkMetadata,
  extractReadableFirestoreError,
  CloudArtworkMetadata,
} from '../firebase/firestore';
import { renderStrokesToPreviewDataUrl } from '../utils/previewGenerator';

export interface MergedArtworkView {
  id: string;
  userId: string;
  title: string;
  description?: string;
  canvasWidth: number;
  canvasHeight: number;
  strokesCount: number;
  templateId?: string;
  templateName?: string;
  difficulty?: string;
  isCustomTemplate?: boolean;
  syncStatus: 'synced' | 'local_only' | 'waiting_to_sync' | 'syncing' | 'sync_failed' | 'cloud_only';
  syncError?: string;
  previewDataUrl?: string;
  createdAt: string;
  updatedAt: string;
  isCloudBacked: boolean;
  hasLocalData: boolean;
  localRecord?: LocalArtworkRecord;
}

interface MyArtworkGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  isAuthReady?: boolean;
  hasUnsavedChanges: boolean;
  onOpenArtwork: (artwork: LocalArtworkRecord) => void;
  onRequestSignIn: () => void;
  onOpenNewCanvas?: () => void;
  onArtworkRenamed?: (id: string, newTitle: string) => void;
  onArtworkDeleted?: (id: string) => void;
}

export const MyArtworkGallery: React.FC<MyArtworkGalleryProps> = ({
  isOpen,
  onClose,
  user,
  isAuthReady = true,
  hasUnsavedChanges,
  onOpenArtwork,
  onRequestSignIn,
  onOpenNewCanvas,
  onArtworkRenamed,
  onArtworkDeleted,
}) => {
  const [artworks, setArtworks] = useState<MergedArtworkView[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cloudWarning, setCloudWarning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'cloud' | 'local' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');

  // Modal / Confirmations
  const [pendingOpenArtwork, setPendingOpenArtwork] = useState<MergedArtworkView | null>(null);
  const [deletingArtwork, setDeletingArtwork] = useState<MergedArtworkView | null>(null);
  const [renamingArtwork, setRenamingArtwork] = useState<MergedArtworkView | null>(null);
  const [newTitleInput, setNewTitleInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [customPhotoNotice, setCustomPhotoNotice] = useState<string | null>(null);

  const fetchArtworks = useCallback(async () => {
    if (!isAuthReady) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);
    setCloudWarning(null);
    setActionError(null);

    try {
      const currentUserId = user ? user.uid : 'guest';

      // 1. Fetch Local Artworks from IndexedDB
      const localList = await getUserLocalArtworks(currentUserId);

      // Preload previews from IndexedDB
      const previewMap = new Map<string, string>();
      for (const item of localList) {
        const preview = await getArtworkPreview(item.id);
        if (preview) {
          previewMap.set(item.id, preview);
        }
      }

      // 2. Fetch Cloud Artworks if signed in
      let cloudList: CloudArtworkMetadata[] = [];
      if (user) {
        try {
          cloudList = await getUserCloudArtworks(user.uid);
        } catch (cloudErr) {
          const readable = extractReadableFirestoreError(cloudErr);
          console.error('Could not fetch cloud artworks from Firestore:', cloudErr);
          setCloudWarning(`Could not load artworks from Cloud Firestore: ${readable}`);
        }
      }

      // 3. Merge Local and Cloud datasets (never let empty local hide cloud records)
      const mergedMap = new Map<string, MergedArtworkView>();

      // Put local records first
      for (const local of localList) {
        const preview = previewMap.get(local.id);
        mergedMap.set(local.id, {
          id: local.id,
          userId: local.userId,
          title: local.title,
          description: local.description,
          canvasWidth: local.canvasWidth,
          canvasHeight: local.canvasHeight,
          strokesCount: local.strokesCount,
          templateId: local.templateId,
          templateName: local.templateName,
          difficulty: local.difficulty,
          isCustomTemplate: local.isCustomTemplate,
          syncStatus: local.syncStatus,
          syncError: local.syncError,
          previewDataUrl: preview,
          createdAt: local.createdAt,
          updatedAt: local.updatedAt,
          isCloudBacked: local.syncStatus === 'synced',
          hasLocalData: true,
          localRecord: local,
        });
      }

      // Merge Cloud records
      for (const cloud of cloudList) {
        const existing = mergedMap.get(cloud.id);
        if (existing) {
          existing.isCloudBacked = true;
          const cloudTime = new Date(cloud.updatedAt || cloud.createdAt || 0).getTime();
          const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          if (cloudTime >= localTime) {
            existing.title = cloud.title;
            existing.description = cloud.description;
            existing.updatedAt = cloud.updatedAt;
            existing.createdAt = cloud.createdAt || existing.createdAt;
            existing.strokesCount = cloud.strokesCount ?? existing.strokesCount;
            existing.syncStatus = 'synced';
            delete existing.syncError;
          }
        } else {
          // Cloud-only (e.g. after browser refresh/cache clear, sign out/in, or another device/tab)
          mergedMap.set(cloud.id, {
            id: cloud.id,
            userId: cloud.userId,
            title: cloud.title,
            description: cloud.description,
            canvasWidth: cloud.canvasWidth,
            canvasHeight: cloud.canvasHeight,
            strokesCount: cloud.strokesCount,
            templateId: cloud.templateId,
            templateName: cloud.templateName,
            difficulty: cloud.difficulty,
            isCustomTemplate: cloud.isCustomTemplate,
            syncStatus: 'cloud_only',
            createdAt: cloud.createdAt,
            updatedAt: cloud.updatedAt,
            isCloudBacked: true,
            hasLocalData: false,
          });
        }
      }

      const mergedList = Array.from(mergedMap.values());
      setArtworks(mergedList);
    } catch (err) {
      console.error('Failed to load artwork list:', err);
      setError('Unable to load artwork records. Please check your browser IndexedDB storage.');
    } finally {
      setLoading(false);
    }
  }, [user, isAuthReady]);

  useEffect(() => {
    if (isOpen) {
      fetchArtworks();
      setSearchQuery('');
      setPendingOpenArtwork(null);
      setDeletingArtwork(null);
      setRenamingArtwork(null);
      setCustomPhotoNotice(null);
    }
  }, [isOpen, fetchArtworks]);

  const filteredAndSortedArtworks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    let result = artworks.filter((item) => {
      // Filter tab check
      if (activeFilter === 'cloud' && !item.isCloudBacked) return false;
      if (activeFilter === 'local' && item.syncStatus !== 'local_only') return false;
      if (
        activeFilter === 'pending' &&
        item.syncStatus !== 'waiting_to_sync' &&
        item.syncStatus !== 'sync_failed'
      ) {
        return false;
      }

      // Search query check
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.templateName && item.templateName.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    });

    result = [...result].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return sortBy === 'oldest' ? timeA - timeB : timeB - timeA;
    });

    return result;
  }, [artworks, searchQuery, activeFilter, sortBy]);

  if (!isOpen) return null;

  const loadAndOpenArtworkRecord = async (artwork: MergedArtworkView) => {
    setActionLoading(true);
    setActionError(null);
    try {
      let finalRecord: LocalArtworkRecord | null = artwork.localRecord || null;

      // If record is cloud_only (or local data missing), download & reconstruct from Firestore chunks
      if (!finalRecord && user) {
        finalRecord = await getArtworkFromFirestore(user.uid, artwork.id);
        if (finalRecord) {
          // Cache locally in IndexedDB for fast offline re-access & preview display
          const preview = renderStrokesToPreviewDataUrl(
            finalRecord.editableData?.strokes || [],
            finalRecord.canvasWidth,
            finalRecord.canvasHeight,
            finalRecord.editableData?.layers
          );
          await saveLocalArtwork(finalRecord, preview || undefined);
        }
      }

      if (!finalRecord) {
        setActionError('Could not retrieve artwork reconstruction data from Cloud Firestore or IndexedDB.');
        return;
      }

      if (finalRecord.isCustomTemplate && finalRecord.editableData?.template?.id?.startsWith('custom_')) {
        setCustomPhotoNotice(
          `Notice: "${finalRecord.title}" references a custom uploaded photo stored locally in this browser when available.`
        );
      }

      onOpenArtwork(finalRecord);
      onClose();
    } catch (err) {
      console.error('Failed to open artwork project:', err);
      setActionError('Error loading artwork: ' + extractReadableFirestoreError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenClick = (artwork: MergedArtworkView) => {
    if (hasUnsavedChanges) {
      setPendingOpenArtwork(artwork);
    } else {
      loadAndOpenArtworkRecord(artwork);
    }
  };

  const handleConfirmDiscardAndOpen = () => {
    if (pendingOpenArtwork) {
      const target = pendingOpenArtwork;
      setPendingOpenArtwork(null);
      loadAndOpenArtworkRecord(target);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingArtwork) return;
    setActionLoading(true);
    setActionError(null);
    try {
      // 1. Delete from Cloud Firestore first if backed up so a failed cloud delete doesn't falsely look deleted
      if (user && deletingArtwork.isCloudBacked) {
        await deleteArtworkFromFirestore(user.uid, deletingArtwork.id);
      }

      // 2. Delete from IndexedDB
      await deleteLocalArtwork(deletingArtwork.id);

      setArtworks((prev) => prev.filter((a) => a.id !== deletingArtwork.id));
      onArtworkDeleted?.(deletingArtwork.id);
      setDeletingArtwork(null);
    } catch (err) {
      setActionError('Failed to delete artwork: ' + extractReadableFirestoreError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingArtwork || !newTitleInput.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const trimmed = newTitleInput.trim().slice(0, 200);
      let updatedAt = new Date().toISOString();

      // 1. Update Cloud Firestore if cloud backed
      if (user && renamingArtwork.isCloudBacked) {
        updatedAt = await updateCloudArtworkMetadata(user.uid, renamingArtwork.id, { title: trimmed });
      }

      // 2. Update IndexedDB
      await updateLocalArtworkMetadata(renamingArtwork.id, { title: trimmed, updatedAt });

      setArtworks((prev) =>
        prev.map((a) =>
          a.id === renamingArtwork.id
            ? {
                ...a,
                title: trimmed,
                updatedAt,
                localRecord: a.localRecord ? { ...a.localRecord, title: trimmed, updatedAt } : undefined,
              }
            : a
        )
      );
      onArtworkRenamed?.(renamingArtwork.id, trimmed);
      setRenamingArtwork(null);
    } catch (err) {
      setActionError('Failed to rename artwork: ' + extractReadableFirestoreError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = (artwork: MergedArtworkView) => {
    if (artwork.previewDataUrl) {
      const link = document.createElement('a');
      link.href = artwork.previewDataUrl;
      link.download = `${artwork.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // If preview missing, open artwork to download from main studio
      handleOpenClick(artwork);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const renderSyncBadge = (status: MergedArtworkView['syncStatus'], syncError?: string) => {
    switch (status) {
      case 'synced':
      case 'cloud_only':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium rounded">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Saved to Cloud</span>
          </span>
        );
      case 'syncing':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[10px] font-medium rounded">
            <Loader2 className="w-3 h-3 text-[#1979CA] animate-spin" />
            <span>Syncing</span>
          </span>
        );
      case 'waiting_to_sync':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-[10px] font-medium rounded">
            <Clock className="w-3 h-3 text-violet-600" />
            <span>Waiting to Sync</span>
          </span>
        );
      case 'sync_failed':
        return (
          <span
            title={syncError || 'Cloud synchronization failed'}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[10px] font-medium rounded"
          >
            <AlertTriangle className="w-3 h-3 text-red-600" />
            <span>Save Failed</span>
          </span>
        );
      case 'local_only':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[10px] font-medium rounded">
            <HardDrive className="w-3 h-3 text-amber-600" />
            <span>Local Only</span>
          </span>
        );
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gallery-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] bg-[#FBFBFB] dark:bg-[#1E232D] border border-[#A0A0A0] dark:border-[#3E485C] shadow-2xl rounded-lg flex flex-col overflow-hidden text-[#1E1E1E] dark:text-[#E2E8F0] font-sans"
      >
        {/* Header */}
        <div className="bg-white dark:bg-[#161B22] px-4 py-3 border-b border-[#D8D8D8] dark:border-[#2D333B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#1979CA] text-white flex items-center justify-center">
              <FolderHeart className="w-4 h-4" />
            </div>
            <div>
              <h2 id="gallery-modal-title" className="text-[14px] font-semibold tracking-tight">
                My Artwork
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {artworks.length} artwork{artworks.length === 1 ? '' : 's'} in library
                {user ? ` (${user.email})` : ' (Guest Session)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchArtworks}
              disabled={loading}
              className="p-1.5 rounded hover:bg-[#E5F1FB] dark:hover:bg-[#2D333B] text-[#555] dark:text-[#A0AEC0] cursor-pointer"
              title="Refresh artwork list"
              aria-label="Refresh artworks"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#E5F1FB] dark:hover:bg-[#2D333B] text-[#555] dark:text-[#A0AEC0] cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="bg-[#F1F5F9] dark:bg-[#1A1F29] px-4 py-2 border-b border-[#E2E8F0] dark:border-[#374151] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-xs cursor-pointer transition-colors ${
                activeFilter === 'all'
                  ? 'bg-white dark:bg-[#252C37] text-[#1979CA] shadow-2xs font-semibold'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:bg-white/50'
              }`}
            >
              All Artwork ({artworks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('cloud')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-xs cursor-pointer transition-colors ${
                activeFilter === 'cloud'
                  ? 'bg-white dark:bg-[#252C37] text-[#1979CA] shadow-2xs font-semibold'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:bg-white/50'
              }`}
            >
              Cloud Saved ({artworks.filter((a) => a.isCloudBacked).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('local')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-xs cursor-pointer transition-colors ${
                activeFilter === 'local'
                  ? 'bg-white dark:bg-[#252C37] text-[#1979CA] shadow-2xs font-semibold'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:bg-white/50'
              }`}
            >
              Local Drafts ({artworks.filter((a) => a.syncStatus === 'local_only').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('pending')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-xs cursor-pointer transition-colors ${
                activeFilter === 'pending'
                  ? 'bg-white dark:bg-[#252C37] text-[#1979CA] shadow-2xs font-semibold'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:bg-white/50'
              }`}
            >
              Pending Sync ({artworks.filter((a) => a.syncStatus === 'waiting_to_sync' || a.syncStatus === 'sync_failed').length})
            </button>
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-2 flex-1 justify-end min-w-[240px]">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#94A3B8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drawings..."
                className="w-full pl-8 pr-3 py-1 text-[11.5px] bg-white dark:bg-[#252C37] border border-[#CBD5E1] dark:border-[#475569] rounded focus:outline-hidden focus:border-[#1979CA]"
              />
            </div>

            <div className="flex items-center gap-1 text-[11px]">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'title')}
                className="px-2 py-1 bg-white dark:bg-[#252C37] border border-[#CBD5E1] dark:border-[#475569] rounded text-[11px] cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Alphabetical (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FAFAFA] dark:bg-[#181D24]">
          {!user && isAuthReady && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded flex flex-wrap items-center justify-between gap-2 text-[12px] text-blue-800 dark:text-blue-200">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 shrink-0 text-[#1979CA]" />
                <span>
                  Viewing local guest drafts. Sign in to access and sync your Cloud Firestore artworks across refreshes and devices.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestSignIn();
                }}
                className="px-3 py-1 bg-[#1979CA] hover:bg-[#1464A8] text-white text-[11px] font-medium rounded cursor-pointer shrink-0"
              >
                Sign In
              </button>
            </div>
          )}

          {cloudWarning && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded flex flex-wrap items-center justify-between gap-2 text-[12px] text-red-700 dark:text-red-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{cloudWarning}</span>
              </div>
              <button
                type="button"
                onClick={fetchArtworks}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-medium rounded cursor-pointer shrink-0"
              >
                Retry Cloud Load
              </button>
            </div>
          )}

          {actionError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded flex items-center justify-between gap-2 text-[12px] text-red-700 dark:text-red-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-red-600 hover:text-red-800 p-0.5 cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {customPhotoNotice && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded flex items-start justify-between gap-2 text-[12px] text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{customPhotoNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setCustomPhotoNotice(null)}
                className="p-0.5 cursor-pointer"
                aria-label="Dismiss notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-[#64748B] dark:text-[#94A3B8]">
              <Loader2 className="w-8 h-8 animate-spin text-[#1979CA] mb-3" />
              <p className="text-[13px]">
                {!isAuthReady ? 'Restoring your account...' : 'Loading your artworks...'}
              </p>
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-3">
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded max-w-md mx-auto text-[12px] text-red-700 dark:text-red-300">
                {error}
              </div>
              <button
                type="button"
                onClick={fetchArtworks}
                className="px-3 py-1.5 bg-[#1979CA] text-white text-[12px] rounded cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : filteredAndSortedArtworks.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#252C37] border border-[#E2E8F0] dark:border-[#374151] shadow-xs flex items-center justify-center mb-3">
                <Brush className="w-8 h-8 text-[#1979CA]" />
              </div>
              <h3 className="text-[15px] font-semibold mb-1">
                {searchQuery ? 'No matching artwork found' : 'No artworks in this view'}
              </h3>
              <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] max-w-xs mb-5">
                {searchQuery
                  ? 'Try searching with a different keyword or clear the search field.'
                  : 'Start painting in the studio and click "Save Artwork" to keep it safe!'}
              </p>
              {onOpenNewCanvas && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenNewCanvas();
                  }}
                  className="px-4 py-2 bg-[#1979CA] hover:bg-[#1464A8] text-white text-[12px] font-medium rounded shadow-xs cursor-pointer"
                >
                  Start Drawing Now
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredAndSortedArtworks.map((artwork) => (
                <div
                  key={artwork.id}
                  data-testid={`artwork-card-${artwork.id}`}
                  className="bg-white dark:bg-[#202632] border border-[#CBD5E1] dark:border-[#334155] rounded-lg overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col group"
                >
                  {/* Thumbnail Container */}
                  <div
                    onClick={() => handleOpenClick(artwork)}
                    className="relative aspect-4/3 bg-[#F1F5F9] dark:bg-[#161B22] border-b border-[#E2E8F0] dark:border-[#2D3748] cursor-pointer flex items-center justify-center overflow-hidden"
                  >
                    {artwork.previewDataUrl ? (
                      <img
                        src={artwork.previewDataUrl}
                        alt={artwork.title}
                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                        <Cloud className="w-8 h-8 text-[#1979CA] mb-1" />
                        <span className="text-[10px] font-medium text-slate-500">Cloud Project</span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {artwork.canvasWidth} × {artwork.canvasHeight}px • {artwork.strokesCount} strokes
                        </span>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenClick(artwork);
                        }}
                        className="px-3 py-1.5 bg-[#1979CA] hover:bg-[#1464A8] text-white text-[12px] font-medium rounded shadow-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <Brush className="w-3.5 h-3.5" />
                        <span>Open & Edit</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Info */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className="font-semibold text-[13px] text-[#1E293B] dark:text-[#F1F5F9] truncate"
                          title={artwork.title}
                        >
                          {artwork.title}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingArtwork(artwork);
                            setNewTitleInput(artwork.title);
                          }}
                          className="text-[#94A3B8] hover:text-[#1979CA] p-1 cursor-pointer"
                          title="Rename artwork"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1.5">
                        {renderSyncBadge(artwork.syncStatus, artwork.syncError)}
                        {artwork.templateName && (
                          <span className="truncate px-1.5 py-0.5 bg-[#E0F2FE] dark:bg-[#0369A1]/30 text-[#0369A1] dark:text-[#7DD3FC] text-[9.5px] rounded font-medium max-w-[120px]">
                            {artwork.templateName}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-0.5 text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-2">
                        <div className="flex items-center gap-2">
                          <span>Modified {formatDate(artwork.updatedAt || artwork.createdAt)}</span>
                          <span>•</span>
                          <span>{artwork.strokesCount} stroke{artwork.strokesCount === 1 ? '' : 's'}</span>
                        </div>
                        {artwork.createdAt && (
                          <span className="text-[9.5px] text-[#94A3B8]">
                            Created {formatDate(artwork.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-3 pt-2.5 border-t border-[#F1F5F9] dark:border-[#2D3748] flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleOpenClick(artwork)}
                        className="text-[11px] font-medium text-[#1979CA] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Brush className="w-3 h-3" />
                        <span>Continue Drawing</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDownload(artwork)}
                          className="p-1.5 text-[#64748B] hover:text-[#1979CA] hover:bg-[#F1F5F9] dark:hover:bg-[#2D3748] rounded cursor-pointer"
                          title="Download PNG"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingArtwork(artwork)}
                          className="p-1.5 text-[#64748B] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded cursor-pointer"
                          title="Delete artwork"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MODAL: UNSAVED CHANGES WARNING */}
        {pendingOpenArtwork && (
          <div
            className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setPendingOpenArtwork(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#1E232D] max-w-sm w-full p-5 rounded-lg border border-[#A0A0A0] dark:border-[#3E485C] shadow-2xl space-y-3"
            >
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="font-semibold text-[14px]">Unsaved Changes</h4>
              </div>
              <p className="text-[12px] text-[#475569] dark:text-[#94A3B8]">
                You have unsaved changes on your current canvas. Opening "
                <strong>{pendingOpenArtwork.title}</strong>" will replace your current drawing.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingOpenArtwork(null)}
                  className="px-3 py-1.5 text-[12px] border border-[#CBD5E1] dark:border-[#475569] rounded hover:bg-[#F1F5F9] dark:hover:bg-[#2D3748] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDiscardAndOpen}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-medium rounded shadow-xs cursor-pointer"
                >
                  Discard & Open
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: DELETE CONFIRMATION */}
        {deletingArtwork && (
          <div
            className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => !actionLoading && setDeletingArtwork(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#1E232D] max-w-sm w-full p-5 rounded-lg border border-[#A0A0A0] dark:border-[#3E485C] shadow-2xl space-y-3"
            >
              <div className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5 shrink-0" />
                <h4 className="font-semibold text-[14px]">Delete Artwork</h4>
              </div>
              <p className="text-[12px] text-[#475569] dark:text-[#94A3B8]">
                Are you sure you want to delete "<strong>{deletingArtwork.title}</strong>"? This will remove it from both local IndexedDB and Cloud Firestore.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setDeletingArtwork(null)}
                  className="px-3 py-1.5 text-[12px] border border-[#CBD5E1] dark:border-[#475569] rounded hover:bg-[#F1F5F9] dark:hover:bg-[#2D3748] cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleDeleteConfirm}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Delete Artwork</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: RENAME ARTWORK */}
        {renamingArtwork && (
          <div
            className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => !actionLoading && setRenamingArtwork(null)}
          >
            <form
              onSubmit={handleRenameSubmit}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#1E232D] max-w-sm w-full p-5 rounded-lg border border-[#A0A0A0] dark:border-[#3E485C] shadow-2xl space-y-3"
            >
              <div className="flex items-center gap-2 text-[#1979CA]">
                <Edit2 className="w-4 h-4 shrink-0" />
                <h4 className="font-semibold text-[14px]">Rename Artwork</h4>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitleInput}
                  onChange={(e) => setNewTitleInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-[12px] bg-white dark:bg-[#252C37] border border-[#CBD5E1] dark:border-[#475569] rounded focus:outline-hidden focus:border-[#1979CA]"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setRenamingArtwork(null)}
                  className="px-3 py-1.5 text-[12px] border border-[#CBD5E1] dark:border-[#475569] rounded hover:bg-[#F1F5F9] dark:hover:bg-[#2D3748] cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newTitleInput.trim()}
                  className="px-3 py-1.5 bg-[#1979CA] hover:bg-[#1464A8] text-white text-[12px] font-medium rounded shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Title</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
