/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layers } from 'lucide-react';
import { PaintRibbon } from './components/PaintRibbon';
import { PaintStatusBar, ProjectSyncStatus } from './components/PaintStatusBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CanvasStudio, CanvasStudioHandle } from './components/CanvasStudio';
import { TemplateModal } from './components/TemplateModal';
import { SaveArtworkModal } from './components/SaveArtworkModal';
import { SessionGalleryModal } from './components/SessionGalleryModal';
import { CreativeSparkModal } from './components/CreativeSparkModal';
import { ClearConfirmModal } from './components/ClearConfirmModal';
import { ResizeCanvasModal } from './components/ResizeCanvasModal';
import { ColorsModal } from './components/ColorsModal';
import { LayersSidebar } from './components/LayersSidebar';
import { User } from 'firebase/auth';
import { subscribeToAuthChanges } from './firebase/auth';
import {
  LocalArtworkRecord,
  migrateGuestArtworksToUser,
  getPendingSyncArtworks,
  updateLocalArtworkMetadata,
  saveUploadedMedia,
  getUploadedMedia,
  getUserLocalArtworks,
  getArtworkPreview,
  saveLocalArtwork,
  deleteLocalArtwork,
} from './utils/indexedDB';
import {
  saveArtworkToFirestore,
  extractReadableFirestoreError,
} from './firebase/firestore';
import { AuthModal } from './components/AuthModal';
import { CloudSaveModal } from './components/CloudSaveModal';
import { MyArtworkGallery } from './components/MyArtworkGallery';
import { GlitterTrailOverlay } from './components/GlitterTrailOverlay';
import {
  CanvasLayer,
  DrawingTemplate,
  MirrorMode,
  SavedArtwork,
  ShapeFillStyle,
  ShapeOutlineStyle,
  ShapeType,
  StampShape,
  Stroke,
  SymmetryGuideMode,
  ToolType,
} from './types';
import {
  HistoryManager,
  preloadStrokeRasterImage,
  renderStrokeToContext,
  generateArtworkFilename,
  exportStrokesToSvgString,
  getMirrorModeStatusMessage,
} from './utils/drawing';
import { mergePaletteIntoCustomColors } from './utils/paletteExtraction';
import {
  DEFAULT_LAYER_ID,
  addTransparentLayer,
  createInitialLayers,
  deleteLayer,
  getDefaultLayersSidebarOpen,
  getLayersToggleAccessibleLabel,
  getVisibleOrderedStrokes,
  moveLayer,
  renameLayer,
  reorderLayersFromDisplayOrder,
  resolveStrokeLayerId,
  setLayerOpacity,
  toggleLayerVisibility,
} from './utils/layers';
import { TEMPLATES } from './data/templates';
import { resolveKeyboardShortcut } from './utils/shortcuts';
import { recordRecentColor } from './utils/color';
import { generateTimestampedPngFilename } from './utils/quickSave';
import { DEFAULT_BUCKET_TOLERANCE } from './utils/floodFill';
import { getSymmetryGuidesStatusMessage } from './utils/symmetryGuides';
import {
  THEME_STORAGE_KEY,
  ThemeMode,
  resolveThemePreference,
  toggleThemeMode,
} from './utils/theme';
import {
  canShareFiles,
  createPngShareFile,
  dataUrlToBlob,
  getShareSessionUrl,
  getShareText,
  getShareTitle,
  isAbortError,
  isWebShareSupported,
} from './utils/share';

export default function App() {
  // Navigation / View State: Welcome Page as front page
  const [currentView, setCurrentView] = useState<'welcome' | 'studio'>('welcome');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      return typeof window !== 'undefined'
        ? resolveThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
        : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('theme-dark', themeMode === 'dark');
    document.documentElement.setAttribute('data-theme', themeMode);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Ignore storage quota errors
    }
  }, [themeMode]);

  const handleToggleTheme = useCallback(() => {
    setThemeMode((prev) => toggleThemeMode(prev));
  }, []);

  // Drawing Tools & Windows Paint Ribbon State
  const [ribbonTab, setRibbonTab] = useState<'file' | 'home' | 'view'>('home');
  const [isRibbonOpen, setIsRibbonOpen] = useState<boolean>(true);
  const [isRibbonPinned, setIsRibbonPinned] = useState<boolean>(true);
  const [mirrorMode, setMirrorMode] = useState<MirrorMode>('none');
  const [symmetryGuides, setSymmetryGuides] = useState<SymmetryGuideMode>('none');
  const [tool, setTool] = useState<ToolType>('brush');
  const [stampShape, setStampShape] = useState<StampShape>('star');
  const [lastDrawingTool, setLastDrawingTool] = useState<ToolType>('brush');
  const [shapeType, setShapeType] = useState<ShapeType>('rectangle');
  const [outlineStyle, setOutlineStyle] = useState<ShapeOutlineStyle>('solid');
  const [fillStyle, setFillStyle] = useState<ShapeFillStyle>('none');

  // Default Colors matching classic Windows Paint (Color 1: Black, Color 2: White)
  const [color, setColor] = useState<string>('#000000');
  const [secondaryColor, setSecondaryColor] = useState<string>('#FFFFFF');
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [size, setSize] = useState<number>(5);
  const [stabilization, setStabilization] = useState<number>(45);
  const [bucketTolerance, setBucketTolerance] = useState<number>(DEFAULT_BUCKET_TOLERANCE);
  const [pressureSensitive, setPressureSensitive] = useState<boolean>(true);
  const [isGradientBrush, setIsGradientBrush] = useState<boolean>(false);
  const [opacity] = useState<number>(1.0);

  // Canvas & Viewport State matching reference proportion (819 × 460px at 100%)
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [resetViewSignal, setResetViewSignal] = useState<number>(0);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [showRulers, setShowRulers] = useState<boolean>(false);
  const [showStatusBar, setShowStatusBar] = useState<boolean>(true);
  const [showGlitter, setShowGlitter] = useState<boolean>(true);
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 819,
    height: 460,
  });
  const [isAutoFullScreenCanvas, setIsAutoFullScreenCanvas] = useState<boolean>(true);

  // Live telemetry for Paint Status Bar
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectionSize, setSelectionSize] = useState<{ width: number; height: number } | null>(null);
  const [hasSelection, setHasSelection] = useState<boolean>(false);
  const [canPaste, setCanPaste] = useState<boolean>(false);

  // Multi-layer management state (defaults hidden on phones <768px so canvas gets full width)
  const [layers, setLayers] = useState<CanvasLayer[]>(() => createInitialLayers());
  const [activeLayerId, setActiveLayerId] = useState<string>(DEFAULT_LAYER_ID);
  const [showLayersSidebar, setShowLayersSidebar] = useState<boolean>(() =>
    getDefaultLayersSidebarOpen(typeof window !== 'undefined' ? window.innerWidth : 1024)
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const handleViewportCross = (event: MediaQueryListEvent) => {
      setShowLayersSidebar(!event.matches);
    };
    mql.addEventListener('change', handleViewportCross);
    return () => mql.removeEventListener('change', handleViewportCross);
  }, []);

  // History
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const historyRef = useRef<HistoryManager>(new HistoryManager(35));
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  const canvasStudioRef = useRef<CanvasStudioHandle>(null);

  // Templates & Tracing (Paint Books)
  const [activeTemplate, setActiveTemplate] = useState<DrawingTemplate | null>(null);
  const [lastClosedTemplate, setLastClosedTemplate] = useState<DrawingTemplate | null>(null);
  const [templateOpacity, setTemplateOpacity] = useState<number>(0.35);

  // Saved Artworks (Session Gallery)
  const [savedArtworks, setSavedArtworks] = useState<SavedArtwork[]>([]);
  const [isGalleryLoading, setIsGalleryLoading] = useState<boolean>(true);

  // Modals & Cloud State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | 'forgot' | 'profile'>('signin');
  const [authPromptMessage, setAuthPromptMessage] = useState<string | undefined>(undefined);
  const [onAuthSuccessAction, setOnAuthSuccessAction] = useState<(() => void) | null>(null);

  const [isCloudSaveModalOpen, setIsCloudSaveModalOpen] = useState<boolean>(false);
  const [isCloudGalleryOpen, setIsCloudGalleryOpen] = useState<boolean>(false);
  const [currentCloudArtworkId, setCurrentCloudArtworkId] = useState<string | null>(null);
  const [currentCloudArtworkTitle, setCurrentCloudArtworkTitle] = useState<string>('');
  const [currentCloudArtworkCreatedAt, setCurrentCloudArtworkCreatedAt] = useState<string | null>(null);
  const [currentCloudArtworkUpdatedAt, setCurrentCloudArtworkUpdatedAt] = useState<string | null>(null);
  const [projectSyncStatus, setProjectSyncStatus] = useState<ProjectSyncStatus>('Local Only');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState<boolean>(false);
  const [isSparkModalOpen, setIsSparkModalOpen] = useState<boolean>(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);
  const [isResizeModalOpen, setIsResizeModalOpen] = useState<boolean>(false);
  const [isColorsModalOpen, setIsColorsModalOpen] = useState<boolean>(false);
  const [isQuickSaving, setIsQuickSaving] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [lastQuickSaveFile, setLastQuickSaveFile] = useState<string>('');

  // Subscribe to Firebase Auth state and track auth resolution before cloud queries
  const prevUserUidRef = useRef<string | null>(null);
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      const nextUid = user?.uid || null;
      if (prevUserUidRef.current && prevUserUidRef.current !== nextUid) {
        // User signed out or switched accounts: clear active cloud project bindings to preserve isolation
        setCurrentCloudArtworkId(null);
        setCurrentCloudArtworkTitle('');
        setCurrentCloudArtworkCreatedAt(null);
        setCurrentCloudArtworkUpdatedAt(null);
        setProjectSyncStatus('Local Only');
      }
      prevUserUidRef.current = nextUid;
      setCurrentUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Prevent accidental unload if there are unsaved canvas changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; hex?: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, hex?: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, hex });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  }, []);

  // Restore the device-local Studio Gallery from IndexedDB after every app load.
  useEffect(() => {
    let cancelled = false;

    const restoreGallery = async () => {
      try {
        const records = await getUserLocalArtworks('device-local');
        const restored = await Promise.all(
          records.map(async (record): Promise<SavedArtwork | null> => {
            const dataUrl = await getArtworkPreview(record.id);
            if (!dataUrl) return null;
            return {
              id: record.id,
              title: record.title,
              date: new Date(record.updatedAt || record.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              dataUrl,
              templateName: record.templateName || undefined,
              strokesCount: record.strokesCount,
            };
          })
        );

        if (!cancelled) {
          const available = restored.filter((item): item is SavedArtwork => item !== null);
          // Do not overwrite an artwork saved while the initial IndexedDB read was in progress.
          setSavedArtworks((current) => {
            const currentIds = new Set(current.map((item) => item.id));
            return [
              ...current,
              ...available.filter((item) => !currentIds.has(item.id)),
            ];
          });
        }
      } catch (error) {
        console.error('Could not restore Pixora Studio Gallery:', error);
        if (!cancelled) showToast('Could not load saved gallery artwork from this device.');
      } finally {
        if (!cancelled) setIsGalleryLoading(false);
      }
    };

    void restoreGallery();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const handleRecordRecentColor = useCallback((hex: string) => {
    setRecentColors((prev) => recordRecentColor(prev, hex));
  }, []);

  const handleSelectPrimaryColor = useCallback(
    (hex: string) => {
      setColor(hex);
      handleRecordRecentColor(hex);
    },
    [handleRecordRecentColor]
  );

  const handleSelectSecondaryColor = useCallback(
    (hex: string) => {
      setSecondaryColor(hex);
      handleRecordRecentColor(hex);
    },
    [handleRecordRecentColor]
  );

  // Safe link and URL parameter router
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;

      const params = new URLSearchParams(window.location.search);
      const templateParam = params.get('template') || params.get('paintbook');

      if (templateParam) {
        const found = TEMPLATES.find(
          (t) =>
            t.id.toLowerCase() === templateParam.toLowerCase() ||
            t.name.toLowerCase().includes(templateParam.toLowerCase())
        );
        if (found) {
          setActiveTemplate(found);
        }
        setCurrentView('studio');
        return;
      }

      if (
        params.get('autostart') === '1' ||
        params.get('studio') === '1' ||
        params.get('view') === 'studio' ||
        window.location.hash === '#studio'
      ) {
        setCurrentView('studio');
      }
    } catch (err) {
      console.warn('URL parsing skipped gracefully:', err);
    }
  }, []);

  const updateHistoryFlags = () => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  };

  const handleStrokesChange = (newStrokes: Stroke[]) => {
    historyRef.current.pushState(strokes);
    setStrokes(newStrokes);
    updateHistoryFlags();
    setHasUnsavedChanges(true);
    setProjectSyncStatus('Local Only');
  };

  const handleUndo = () => {
    const previous = historyRef.current.undo(strokes);
    if (previous !== null) {
      setStrokes(previous);
      updateHistoryFlags();
      setHasUnsavedChanges(true);
      setProjectSyncStatus('Local Only');
    }
  };

  const handleRedo = () => {
    const next = historyRef.current.redo(strokes);
    if (next !== null) {
      setStrokes(next);
      updateHistoryFlags();
      setHasUnsavedChanges(true);
      setProjectSyncStatus('Local Only');
    }
  };

  const handleAddLayer = () => {
    const { layers: nextLayers, newLayer } = addTransparentLayer(layers, {
      afterLayerId: activeLayerId,
    });
    setLayers(nextLayers);
    setActiveLayerId(newLayer.id);
    showToast(`Added ${newLayer.name}`);
  };

  const handleToggleLayerVisibility = (layerId: string) => {
    const target = layers.find((l) => l.id === layerId);
    setLayers((prev) => toggleLayerVisibility(prev, layerId));
    if (target) {
      showToast(target.visible ? `Hid ${target.name}` : `Shown ${target.name}`);
    }
  };

  const handleMoveLayer = (layerId: string, direction: 'up' | 'down') => {
    setLayers((prev) => moveLayer(prev, layerId, direction));
  };

  const handleReorderLayer = (draggedLayerId: string, targetLayerId: string) => {
    setLayers((prev) => reorderLayersFromDisplayOrder(prev, draggedLayerId, targetLayerId));
  };

  const handleDeleteLayer = (layerId: string) => {
    const target = layers.find((l) => l.id === layerId);
    const result = deleteLayer(layers, activeLayerId, layerId);
    if (!result.deleted) {
      showToast('At least one layer is required');
      return;
    }
    setLayers(result.layers);
    setActiveLayerId(result.activeLayerId);
    const hasStrokesInDeleted = strokes.some(
      (s) => resolveStrokeLayerId(s, layers) === layerId
    );
    if (hasStrokesInDeleted) {
      handleStrokesChange(
        strokes.filter((s) => resolveStrokeLayerId(s, layers) !== layerId)
      );
    }
    if (target) {
      showToast(`Deleted ${target.name}`);
    }
  };

  const handleRenameLayer = (layerId: string, nextName: string) => {
    setLayers((prev) => renameLayer(prev, layerId, nextName));
  };

  const handleLayerOpacityChange = (layerId: string, nextOpacity: number) => {
    setLayers((prev) => setLayerOpacity(prev, layerId, nextOpacity));
  };

  const handleConfirmClear = () => {
    if (strokes.length > 0) {
      historyRef.current.pushState(strokes);
    }
    setStrokes([]);
    setLayers(createInitialLayers());
    setActiveLayerId(DEFAULT_LAYER_ID);
    canvasStudioRef.current?.clearCanvas();
    setIsAutoFullScreenCanvas(true);
    setCurrentCloudArtworkId(null);
    setCurrentCloudArtworkTitle('');
    setCurrentCloudArtworkCreatedAt(null);
    setCurrentCloudArtworkUpdatedAt(null);
    setHasUnsavedChanges(false);
    setProjectSyncStatus('Local Only');
    updateHistoryFlags();
    showToast('New blank canvas ready');
  };

  const handleClearPage = () => {
    if (strokes.length > 0) {
      historyRef.current.pushState(strokes);
    }
    setStrokes([]);
    setLayers(createInitialLayers());
    setActiveLayerId(DEFAULT_LAYER_ID);
    canvasStudioRef.current?.clearCanvas();
    if (activeTemplate) {
      setLastClosedTemplate(activeTemplate);
      setActiveTemplate(null);
    }
    setZoomLevel(1.0);
    setResetViewSignal((n) => n + 1);
    setIsAutoFullScreenCanvas(true);
    setCurrentCloudArtworkId(null);
    setCurrentCloudArtworkTitle('');
    setCurrentCloudArtworkCreatedAt(null);
    setCurrentCloudArtworkUpdatedAt(null);
    setHasUnsavedChanges(false);
    setProjectSyncStatus('Local Only');
    updateHistoryFlags();
    showToast('Page cleared');
  };

  const getCanvasExportDataUrl = useCallback((): string | null => {
    let dataUrl = canvasStudioRef.current?.exportRaster('png', 1.0) ?? null;
    if (!dataUrl) {
      const visibleOrderedStrokes = getVisibleOrderedStrokes(strokes, layers);
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = Math.max(1, canvasDimensions.width);
      fallbackCanvas.height = Math.max(1, canvasDimensions.height);
      const fctx = fallbackCanvas.getContext('2d');
      if (fctx) {
        fctx.fillStyle = '#FFFFFF';
        fctx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
        for (const s of visibleOrderedStrokes) {
          renderStrokeToContext(fctx, s, 'export');
        }
        dataUrl = fallbackCanvas.toDataURL('image/png', 1.0);
      }
    }
    return dataUrl;
  }, [strokes, layers, canvasDimensions]);

  const handleOpenAuth = useCallback(
    (
      mode: 'signin' | 'signup' | 'forgot' | 'profile' = 'signin',
      prompt?: string,
      onSuccess?: () => void
    ) => {
      setAuthModalMode(mode);
      setAuthPromptMessage(prompt);
      setOnAuthSuccessAction(() => onSuccess || null);
      setIsAuthModalOpen(true);
    },
    []
  );

  const handleOpenCloudSave = useCallback(() => {
    setIsCloudSaveModalOpen(true);
  }, []);

  const handleOpenCloudGallery = useCallback(() => {
    setIsCloudGalleryOpen(true);
  }, []);

  // Sequential migration of guest drafts and sync of pending artworks once Auth is ready
  useEffect(() => {
    if (!isAuthReady || !currentUser) return;

    let cancelled = false;

    const migrateAndSyncPending = async () => {
      try {
        const count = await migrateGuestArtworksToUser(currentUser.uid);
        if (!cancelled && count > 0) {
          showToast(`Linked ${count} guest drawing${count === 1 ? '' : 's'} to your account`);
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) return;

        const pending = await getPendingSyncArtworks(currentUser.uid);
        for (const item of pending) {
          if (cancelled) return;
          try {
            const cloudMeta = await saveArtworkToFirestore(currentUser.uid, item);
            await updateLocalArtworkMetadata(item.id, {
              syncStatus: 'synced',
              lastSyncedAt: cloudMeta.updatedAt,
              updatedAt: cloudMeta.updatedAt,
            });
            if (!cancelled && item.id === currentCloudArtworkId) {
              setCurrentCloudArtworkUpdatedAt(cloudMeta.updatedAt);
              setProjectSyncStatus('Saved to Cloud');
            }
          } catch (e) {
            const readable = extractReadableFirestoreError(e);
            console.warn('Auto-sync failed for artwork:', item.id, readable);
            await updateLocalArtworkMetadata(item.id, {
              syncStatus: 'sync_failed',
              syncError: readable,
            });
            if (!cancelled && item.id === currentCloudArtworkId) {
              setProjectSyncStatus('Save Failed');
            }
          }
        }
      } catch (err) {
        console.warn('Migration/sync check notice:', err);
      }
    };

    void migrateAndSyncPending();

    const handleOnline = () => {
      void migrateAndSyncPending();
      showToast('Online — checking drawing sync');
    };
    window.addEventListener('online', handleOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
  }, [isAuthReady, currentUser, currentCloudArtworkId, showToast]);

  const handleCloudSavedSuccess = useCallback(
    (artwork: LocalArtworkRecord) => {
      setCurrentCloudArtworkId(artwork.id);
      setCurrentCloudArtworkTitle(artwork.title);
      setCurrentCloudArtworkCreatedAt(artwork.createdAt || null);
      setCurrentCloudArtworkUpdatedAt(artwork.updatedAt || null);

      if (artwork.syncStatus === 'synced') {
        setHasUnsavedChanges(false);
        setProjectSyncStatus('Saved to Cloud');
        showToast(`Saved "${artwork.title}" to Cloud!`);
      } else if (artwork.syncStatus === 'waiting_to_sync') {
        setHasUnsavedChanges(false);
        setProjectSyncStatus('Waiting to Sync');
        showToast(`Saved "${artwork.title}" locally (waiting to sync online)`);
      } else if (artwork.syncStatus === 'sync_failed') {
        setProjectSyncStatus('Save Failed');
        showToast(`Saved "${artwork.title}" locally, but Cloud save failed`);
      } else {
        setHasUnsavedChanges(false);
        setProjectSyncStatus('Local Only');
        showToast(`Saved "${artwork.title}" locally!`);
      }
    },
    [showToast]
  );

  const handleOpenCloudArtwork = useCallback(
    async (artwork: LocalArtworkRecord) => {
      try {
        const ed = artwork.editableData;
        if (ed?.strokes) {
          for (const s of ed.strokes) {
            if (s.rasterDataUrl) {
              preloadStrokeRasterImage(s.rasterDataUrl);
            }
          }
          setStrokes(ed.strokes);
          historyRef.current = new HistoryManager(35);
          historyRef.current.pushState(ed.strokes);
          updateHistoryFlags();
        }
        if (ed?.layers && ed.layers.length > 0) {
          setLayers(ed.layers);
          setActiveLayerId(ed.activeLayerId || ed.layers[0].id);
        } else {
          const initialLayers = createInitialLayers();
          setLayers(initialLayers);
          setActiveLayerId(DEFAULT_LAYER_ID);
        }
        if (typeof ed?.templateOpacity === 'number') {
          setTemplateOpacity(ed.templateOpacity);
        }
        if (ed?.template) {
          let restoredTemplate = ed.template;
          if (
            restoredTemplate.id?.startsWith('custom_') &&
            (!restoredTemplate.mediaUrl || restoredTemplate.mediaUrl.startsWith('blob:'))
          ) {
            try {
              const localMediaUrl = await getUploadedMedia(restoredTemplate.id);
              restoredTemplate = {
                ...restoredTemplate,
                mediaUrl: localMediaUrl || '',
              };
            } catch {
              restoredTemplate = { ...restoredTemplate, mediaUrl: '' };
            }
          }
          setActiveTemplate(restoredTemplate);
        } else {
          setActiveTemplate(null);
        }
        if (artwork.canvasWidth && artwork.canvasHeight) {
          setCanvasDimensions({
            width: artwork.canvasWidth,
            height: artwork.canvasHeight,
          });
          setIsAutoFullScreenCanvas(false);
        }
        setCurrentCloudArtworkId(artwork.id);
        setCurrentCloudArtworkTitle(artwork.title);
        setCurrentCloudArtworkCreatedAt(artwork.createdAt || null);
        setCurrentCloudArtworkUpdatedAt(artwork.updatedAt || null);
        setHasUnsavedChanges(false);
        setProjectSyncStatus(
          artwork.syncStatus === 'synced'
            ? 'Saved to Cloud'
            : artwork.syncStatus === 'waiting_to_sync'
            ? 'Waiting to Sync'
            : artwork.syncStatus === 'sync_failed'
            ? 'Save Failed'
            : 'Local Only'
        );
        showToast(`Loaded "${artwork.title}"`);
      } catch (err) {
        console.error('Failed to open artwork project data:', err);
        showToast('Error opening artwork project data');
      }
    },
    [showToast]
  );

  const handleToolSelect = (nextTool: ToolType) => {
    if (nextTool !== 'picker' && nextTool !== 'magnifier') {
      setLastDrawingTool(nextTool);
    }
    setTool(nextTool);
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(4.0, Math.round((prev + 0.25) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(0.25, Math.round((prev - 0.25) * 100) / 100));
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
    setResetViewSignal((n) => n + 1);
  };

  const handleFitToWindow = () => {
    const availW = Math.max(240, window.innerWidth - 48);
    const availH = Math.max(200, window.innerHeight - 200);
    const fitScale = Math.min(availW / canvasDimensions.width, availH / canvasDimensions.height);
    const clamped = Math.max(0.25, Math.min(4.0, Math.round(fitScale * 100) / 100));
    setZoomLevel(clamped);
    setResetViewSignal((n) => n + 1);
  };

  const handleToggleFullScreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {
          setIsRibbonOpen((prev) => !prev);
        });
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    } catch {
      setIsRibbonOpen((prev) => !prev);
    }
  };

  // Tracing Paint Book selection, close, upload, and undo-close / restore handlers
  const handleCloseTemplate = () => {
    if (activeTemplate) {
      setLastClosedTemplate(activeTemplate);
      setActiveTemplate(null);
    }
  };

  const handleRestoreTemplate = () => {
    if (lastClosedTemplate) {
      const templateToRestore = lastClosedTemplate;
      setActiveTemplate(templateToRestore);
      setLastClosedTemplate(null);
      showToast(`Restored: ${templateToRestore.name}`);
    }
  };

  const handleSelectTemplate = (template: DrawingTemplate) => {
    setActiveTemplate(template);
    setLastClosedTemplate(null);
    showToast(`Tracing: ${template.name}`);
  };

  const handleUploadImage = (file: File) => {
    const isVideo = file.type.startsWith('video/');
    const customId = `custom_${Date.now()}`;
    const baseName = file.name.replace(/\.[^/.]+$/, '').slice(0, 24) || 'Uploaded Image';

    if (!isVideo && file.size <= 8 * 1024 * 1024 && typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (dataUrl) {
          void saveUploadedMedia(customId, dataUrl, file.name).catch((err) => {
            console.warn('Could not cache uploaded image in IndexedDB:', err);
          });
        }
        handleSelectTemplate({
          id: customId,
          name: baseName,
          category: 'nature',
          difficulty: 'Easy',
          type: 'photo',
          mediaUrl: dataUrl || URL.createObjectURL(file),
          description: 'Uploaded photo tracing sheet',
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    const url = URL.createObjectURL(file);
    const customTemplate: DrawingTemplate = {
      id: customId,
      name: baseName,
      category: 'nature',
      difficulty: 'Easy',
      type: isVideo ? 'video' : 'photo',
      mediaUrl: url,
      description: `Uploaded ${isVideo ? 'video' : 'photo'} tracing sheet`,
    };
    handleSelectTemplate(customTemplate);
  };

  const handleApplyResize = (newWidth: number, newHeight: number, scaleContent: boolean) => {
    if (scaleContent && strokes.length > 0) {
      const src = document.createElement('canvas');
      src.width = canvasDimensions.width;
      src.height = canvasDimensions.height;
      const sctx = src.getContext('2d');
      if (sctx) {
        sctx.fillStyle = '#FFFFFF';
        sctx.fillRect(0, 0, src.width, src.height);
        for (const s of strokes) {
          renderStrokeToContext(sctx, s, 'canvas');
        }
        const dst = document.createElement('canvas');
        dst.width = newWidth;
        dst.height = newHeight;
        const dctx = dst.getContext('2d');
        if (dctx) {
          dctx.fillStyle = '#FFFFFF';
          dctx.fillRect(0, 0, newWidth, newHeight);
          dctx.drawImage(src, 0, 0, newWidth, newHeight);
          const scaledDataUrl = dst.toDataURL('image/png');
          preloadStrokeRasterImage(scaledDataUrl);
          const replaceOp: Stroke = {
            id: `op_resize_${Date.now()}`,
            tool: 'select',
            color: '#000000',
            size: 1,
            opacity: 1,
            points: [],
            operation: 'replace-bitmap',
            rect: { x: 0, y: 0, width: newWidth, height: newHeight },
            rasterDataUrl: scaledDataUrl,
          };
          handleStrokesChange([replaceOp]);
        }
      }
    }
    setIsAutoFullScreenCanvas(false);
    setCanvasDimensions({ width: newWidth, height: newHeight });
    showToast(`Canvas resized to ${newWidth} × ${newHeight}px`);
  };

  // Start fresh from Welcome Screen
  const handleStartFreshCanvas = () => {
    if (activeTemplate) {
      setLastClosedTemplate(activeTemplate);
      setActiveTemplate(null);
    }
    setCurrentView('studio');
  };

  // Desktop Windows Paint keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentView !== 'studio') {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target.isContentEditable)
      ) {
        return;
      }

      const hasOpenModal =
        isTemplateModalOpen ||
        isSaveModalOpen ||
        isCloudSaveModalOpen ||
        isCloudGalleryOpen ||
        isAuthModalOpen ||
        isGalleryModalOpen ||
        isSparkModalOpen ||
        isClearConfirmOpen ||
        isResizeModalOpen ||
        isColorsModalOpen;

      if (hasOpenModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsTemplateModalOpen(false);
          setIsSaveModalOpen(false);
          setIsCloudSaveModalOpen(false);
          setIsCloudGalleryOpen(false);
          setIsAuthModalOpen(false);
          setIsGalleryModalOpen(false);
          setIsSparkModalOpen(false);
          setIsClearConfirmOpen(false);
          setIsResizeModalOpen(false);
          setIsColorsModalOpen(false);
        }
        return;
      }

      const action = resolveKeyboardShortcut(e, { hasSelection });
      if (!action) return;

      e.preventDefault();

      switch (action) {
        case 'undo':
          handleUndo();
          break;
        case 'redo':
          handleRedo();
          break;
        case 'save':
          setIsCloudSaveModalOpen(true);
          break;
        case 'quick-save':
          void handleQuickSave();
          break;
        case 'share':
          void handleShare();
          break;
        case 'open-templates':
          setIsTemplateModalOpen(true);
          break;
        case 'print':
          window.print();
          break;
        case 'new-canvas':
          if (strokes.length > 0) setIsClearConfirmOpen(true);
          else handleConfirmClear();
          break;
        case 'copy':
          canvasStudioRef.current?.copySelection();
          break;
        case 'cut':
          canvasStudioRef.current?.cutSelection();
          break;
        case 'paste':
          canvasStudioRef.current?.pasteClipboard();
          break;
        case 'select-all':
          canvasStudioRef.current?.selectAll();
          break;
        case 'delete-selection':
          canvasStudioRef.current?.deleteSelection();
          break;
        case 'clear-selection':
          canvasStudioRef.current?.clearSelection();
          break;
        case 'crop':
          if (hasSelection) {
            canvasStudioRef.current?.cropToSelection();
          } else {
            showToast('Select a region first to crop (Ctrl+Shift+X)');
          }
          break;
        case 'resize':
          setIsResizeModalOpen(true);
          break;
        case 'flip-horizontal':
          canvasStudioRef.current?.flipHorizontal();
          showToast('Flipped horizontal (Ctrl+F)');
          break;
        case 'flip-vertical':
          canvasStudioRef.current?.flipVertical();
          showToast('Flipped vertical (Ctrl+Shift+F)');
          break;
        case 'filter-invert':
          canvasStudioRef.current?.applyFilter('invert');
          break;
        case 'toggle-grid':
          setShowGrid((prev) => {
            const next = !prev;
            showToast(next ? 'Gridlines shown (Ctrl+G)' : 'Gridlines hidden (Ctrl+G)');
            return next;
          });
          break;
        case 'toggle-rulers':
          setShowRulers((prev) => {
            const next = !prev;
            showToast(next ? 'Rulers shown (Alt+R)' : 'Rulers hidden (Alt+R)');
            return next;
          });
          break;
        case 'toggle-ribbon':
          setIsRibbonOpen((prev) => !prev);
          break;
        case 'toggle-fullscreen':
          handleToggleFullScreen();
          break;
        case 'zoom-in':
          handleZoomIn();
          break;
        case 'zoom-out':
          handleZoomOut();
          break;
        case 'zoom-reset':
          handleResetZoom();
          break;
        case 'size-decrease':
          setSize((prev) => {
            const next = Math.max(1, prev - 2);
            showToast(`Size: ${next}px ([)`);
            return next;
          });
          break;
        case 'size-increase':
          setSize((prev) => {
            const next = Math.min(40, prev + 2);
            showToast(`Size: ${next}px (])`);
            return next;
          });
          break;
        case 'tool-brush':
          handleToolSelect('brush');
          break;
        case 'tool-pencil':
          handleToolSelect('pencil');
          break;
        case 'tool-bucket':
          handleToolSelect('bucket');
          break;
        case 'tool-eraser':
          handleToolSelect('eraser');
          break;
        case 'tool-text':
          handleToolSelect('text');
          break;
        case 'tool-picker':
          handleToolSelect('picker');
          break;
        case 'tool-magnifier':
          handleToolSelect('magnifier');
          break;
        case 'tool-select':
          handleToolSelect('select');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleSaveToGallery = async (artwork: SavedArtwork) => {
    const now = new Date().toISOString();
    const localRecord: LocalArtworkRecord = {
      id: artwork.id,
      userId: 'device-local',
      title: artwork.title,
      description: '',
      canvasWidth: canvasDimensions.width,
      canvasHeight: canvasDimensions.height,
      strokesCount: strokes.length,
      templateId: activeTemplate && !activeTemplate.id.startsWith('custom_') ? activeTemplate.id : '',
      templateName: activeTemplate?.name || '',
      difficulty: activeTemplate?.difficulty || '',
      isCustomTemplate: Boolean(activeTemplate?.id.startsWith('custom_')),
      editableData: {
        canvasWidth: canvasDimensions.width,
        canvasHeight: canvasDimensions.height,
        strokes,
        layers,
        activeLayerId,
        template: activeTemplate && !activeTemplate.id.startsWith('custom_') ? activeTemplate : null,
        templateOpacity,
        zoomLevel,
      },
      syncStatus: 'local_only',
      createdAt: now,
      updatedAt: now,
    };

    try {
      // Save the project and its preview before showing success in the gallery.
      await saveLocalArtwork(localRecord, artwork.dataUrl);
      setSavedArtworks((prev) => [artwork, ...prev.filter((item) => item.id !== artwork.id)]);
      showToast(`Saved "${artwork.title}" on this device`);
    } catch (error) {
      console.error('Pixora Studio Gallery save failed:', error);
      showToast('Could not save artwork permanently. Please try again.');
      throw error;
    }
  };

  const handleExportFormat = (format: 'jpg' | 'png' | 'svg') => {
    const baseTitle = activeTemplate ? `Pixora ${activeTemplate.name}` : 'Untitled';
    const filename = generateArtworkFilename(baseTitle, format);

    const visibleOrderedStrokes = getVisibleOrderedStrokes(strokes, layers);

    if (format === 'svg') {
      const svgString = exportStrokesToSvgString(visibleOrderedStrokes, {
        width: canvasDimensions.width,
        height: canvasDimensions.height,
        title: baseTitle,
        includeWatermark: false,
      });
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Exported canvas as SVG`);
      return;
    }

    let dataUrl = canvasStudioRef.current?.exportRaster(format, 0.92) ?? null;
    if (!dataUrl) {
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = Math.max(1, canvasDimensions.width);
      fallbackCanvas.height = Math.max(1, canvasDimensions.height);
      const fctx = fallbackCanvas.getContext('2d');
      if (fctx) {
        fctx.fillStyle = '#FFFFFF';
        fctx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
        for (const s of visibleOrderedStrokes) {
          renderStrokeToContext(fctx, s, 'export');
        }
        dataUrl = fallbackCanvas.toDataURL(
          format === 'jpg' ? 'image/jpeg' : 'image/png',
          0.92
        );
      }
    }

    if (dataUrl) {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Exported canvas as ${format.toUpperCase()}`);
    }
  };

  const handleQuickSave = async () => {
    if (isQuickSaving) return;
    setIsQuickSaving(true);
    try {
      const baseTitle = activeTemplate ? `Pixora ${activeTemplate.name}` : 'Pixora';
      const filename = generateTimestampedPngFilename(baseTitle);
      const visibleOrderedStrokes = getVisibleOrderedStrokes(strokes, layers);

      let pngDataUrl = canvasStudioRef.current?.exportRaster('png', 1.0) ?? null;
      if (!pngDataUrl) {
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = Math.max(1, canvasDimensions.width);
        fallbackCanvas.height = Math.max(1, canvasDimensions.height);
        const fctx = fallbackCanvas.getContext('2d');
        if (fctx) {
          fctx.fillStyle = '#FFFFFF';
          fctx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
          for (const s of visibleOrderedStrokes) {
            renderStrokeToContext(fctx, s, 'export');
          }
          pngDataUrl = fallbackCanvas.toDataURL('image/png', 1.0);
        }
      }

      if (!pngDataUrl) {
        showToast('Could not capture canvas PNG for Quick Save');
        return;
      }

      // Immediate browser download (bypasses Save dialog)
      const link = document.createElement('a');
      link.download = filename;
      link.href = pngDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Persist PNG directly into local downloads/ folder via backend endpoint
      const response = await fetch('/api/quick-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: pngDataUrl, filename }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = (await response.json()) as { filename?: string; relativePath?: string };
      const savedName = result.filename || filename;
      setLastQuickSaveFile(savedName);
      showToast(`Quick Saved: ${result.relativePath || `downloads/${savedName}`}`);
    } catch (err) {
      console.error('Quick Save failed:', err);
      showToast('Quick Save failed writing to downloads folder');
    } finally {
      setIsQuickSaving(false);
    }
  };

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const baseTitle = activeTemplate ? activeTemplate.name : 'Pixora';
      const shareTitle = getShareTitle(activeTemplate?.name);
      const shareText = getShareText(activeTemplate?.name);
      const sessionUrl = getShareSessionUrl(
        typeof window !== 'undefined' ? window.location.origin : '',
        activeTemplate?.id
      );

      // Export canvas as PNG
      let pngDataUrl = canvasStudioRef.current?.exportRaster('png', 1.0) ?? null;
      if (!pngDataUrl) {
        const visibleOrderedStrokes = getVisibleOrderedStrokes(strokes, layers);
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = Math.max(1, canvasDimensions.width);
        fallbackCanvas.height = Math.max(1, canvasDimensions.height);
        const fctx = fallbackCanvas.getContext('2d');
        if (fctx) {
          fctx.fillStyle = '#FFFFFF';
          fctx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
          for (const s of visibleOrderedStrokes) {
            renderStrokeToContext(fctx, s, 'export');
          }
          pngDataUrl = fallbackCanvas.toDataURL('image/png', 1.0);
        }
      }

      let shareFile: File | null = null;
      if (pngDataUrl) {
        try {
          const blob = dataUrlToBlob(pngDataUrl);
          shareFile = createPngShareFile(blob, baseTitle);
        } catch (e) {
          console.warn('Could not construct image File for Web Share:', e);
        }
      }

      const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
      const webShareSupported = isWebShareSupported(nav);

      if (webShareSupported) {
        // If file sharing is supported by navigator.canShare, share image file
        if (shareFile && canShareFiles(nav, shareFile)) {
          try {
            await nav.share({
              title: shareTitle,
              text: shareText,
              files: [shareFile],
            });
            showToast('Artwork shared successfully!');
            return;
          } catch (fileShareErr: any) {
            if (isAbortError(fileShareErr)) {
              return; // User dismissed share dialog
            }
            console.warn('File share threw error, attempting link share fallback:', fileShareErr);
          }
        }

        // Web Share URL & text sharing
        try {
          await nav.share({
            title: shareTitle,
            text: shareText,
            url: sessionUrl,
          });
          showToast('Canvas session link shared!');
          return;
        } catch (urlShareErr: any) {
          if (isAbortError(urlShareErr)) {
            return; // User dismissed share dialog
          }
          console.warn('URL share threw error, falling back to clipboard copy:', urlShareErr);
        }
      }

      // Fallback if Web Share API is not supported or not allowed (e.g. desktop iframe without permissions)
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sessionUrl);
        showToast('Canvas link copied to clipboard!');
      } else {
        showToast(`Share URL: ${sessionUrl}`);
      }
    } catch (err: any) {
      if (isAbortError(err)) return;
      console.error('Share action failed:', err);
      showToast('Could not share canvas');
    } finally {
      setIsSharing(false);
    }
  };

  const handleDeleteFromGallery = async (id: string) => {
    try {
      await deleteLocalArtwork(id);
      setSavedArtworks((prev) => prev.filter((a) => a.id !== id));
      showToast('Artwork deleted from this device');
    } catch (error) {
      console.error('Could not delete Pixora gallery artwork:', error);
      showToast('Could not delete artwork. Please try again.');
    }
  };

  return (
    <div
      data-testid="app-root"
      data-theme={themeMode}
      className={`${themeMode === 'dark' ? 'theme-dark ' : ''}${
        currentView === 'studio'
          ? themeMode === 'dark'
            ? 'h-[100dvh] overflow-hidden bg-[#12151C] text-[#E6EDF7]'
            : 'h-[100dvh] overflow-hidden bg-[#C9D2E3] text-[#1E1E1E]'
          : themeMode === 'dark'
          ? 'min-h-screen bg-[#0B0F17] text-[#E6EDF7]'
          : 'min-h-screen bg-gradient-to-br from-white via-blue-50/70 to-blue-200/40 text-[#1E1E1E]'
      } flex flex-col font-sans selection:bg-blue-200 selection:text-blue-900 overflow-x-hidden`}
    >
      <GlitterTrailOverlay
        enabled={showGlitter}
        accentColor={color}
        secondaryColor={secondaryColor}
      />
      {/* Subtle Non-Obstructive Feedback Toast */}
      {toastMessage && (
        <div
          className={`fixed bottom-9 left-3 z-50 pointer-events-none px-3 py-1 border shadow-md flex items-center gap-2 text-[11px] font-medium ${
            themeMode === 'dark'
              ? 'bg-[#202530] border-[#3B4457] text-[#E6EDF7]'
              : 'bg-[#F5F6F7] border-[#9AA4B2] text-[#1E1E1E]'
          }`}
        >
          {toastMessage.hex && (
            <span
              className="w-3 h-3 border border-[#666] inline-block"
              style={{ backgroundColor: toastMessage.hex }}
            />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {currentView === 'welcome' ? (
        <WelcomeScreen
          onStartCreating={handleStartFreshCanvas}
          themeMode={themeMode}
          onToggleTheme={handleToggleTheme}
        />
      ) : (
        <>
          <div
            data-testid="paint-studio-window"
            data-theme={themeMode}
            data-last-quicksave={lastQuickSaveFile}
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            {/* Traditional Windows Paint Title Bar, Tabs & Ribbon */}
            <PaintRibbon
              activeTab={ribbonTab}
              onTabChange={setRibbonTab}
              currentTool={tool}
              onToolSelect={handleToolSelect}
              stampShape={stampShape}
              onStampShapeChange={(nextShape) => {
                setStampShape(nextShape);
                setTool('stamp');
                showToast(`Stamp Brush: ${nextShape.charAt(0).toUpperCase() + nextShape.slice(1)}`);
              }}
              currentShape={shapeType}
              onShapeSelect={setShapeType}
              outlineStyle={outlineStyle}
              onOutlineStyleChange={setOutlineStyle}
              fillStyle={fillStyle}
              onFillStyleChange={setFillStyle}
              currentColor={color}
              onColorChange={handleSelectPrimaryColor}
              secondaryColor={secondaryColor}
              onSecondaryColorChange={handleSelectSecondaryColor}
              customColors={customColors}
              onEditColors={() => setIsColorsModalOpen(true)}
              currentSize={size}
              onSizeChange={setSize}
              stabilization={stabilization}
              onStabilizationChange={setStabilization}
              bucketTolerance={bucketTolerance}
              onBucketToleranceChange={setBucketTolerance}
              pressureSensitive={pressureSensitive}
              onPressureSensitiveChange={(enabled) => {
                setPressureSensitive(enabled);
                showToast(
                  enabled
                    ? 'Pressure sensitivity enabled (variable stroke width)'
                    : 'Pressure sensitivity disabled (uniform stroke width)'
                );
              }}
              isGradientBrush={isGradientBrush}
              onGradientBrushChange={(enabled) => {
                setIsGradientBrush(enabled);
                showToast(
                  enabled
                    ? 'Gradient Brush mode enabled (Color 1 → Color 2)'
                    : 'Gradient Brush mode disabled'
                );
              }}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onNew={() => {
                if (strokes.length > 0) {
                  setIsClearConfirmOpen(true);
                } else {
                  handleConfirmClear();
                }
              }}
              onOpen={() => setIsTemplateModalOpen(true)}
              onUploadImage={handleUploadImage}
              onSave={handleOpenCloudSave}
              onOpenExport={() => setIsSaveModalOpen(true)}
              onQuickSave={() => void handleQuickSave()}
              isQuickSaving={isQuickSaving}
              onShare={() => void handleShare()}
              isSharing={isSharing}
              onExportFormat={handleExportFormat}
              onPrint={() => window.print()}
              onClearPage={handleClearPage}
              onExitStudio={() => setCurrentView('welcome')}
            onCut={() => canvasStudioRef.current?.cutSelection()}
            onCopy={() => canvasStudioRef.current?.copySelection()}
            onPaste={() => canvasStudioRef.current?.pasteClipboard()}
            canPaste={canPaste}
            hasSelection={hasSelection}
            onCropToSelection={() => canvasStudioRef.current?.cropToSelection()}
            onSelectAll={() => canvasStudioRef.current?.selectAll()}
            onClearSelection={() => canvasStudioRef.current?.clearSelection()}
            onDeleteSelection={() => canvasStudioRef.current?.deleteSelection()}
            onOpenResize={() => setIsResizeModalOpen(true)}
            onFlipHorizontal={() => canvasStudioRef.current?.flipHorizontal()}
            onFlipVertical={() => canvasStudioRef.current?.flipVertical()}
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
            onFitToWindow={handleFitToWindow}
            showGrid={showGrid}
            onToggleGrid={() =>
              setShowGrid((prev) => {
                const next = !prev;
                showToast(next ? 'Grid overlay shown (Ctrl+G)' : 'Grid overlay hidden (Ctrl+G)');
                return next;
              })
            }
            showRulers={showRulers}
            onToggleRulers={() => setShowRulers((prev) => !prev)}
            showStatusBar={showStatusBar}
            onToggleStatusBar={() => setShowStatusBar((prev) => !prev)}
            showLayersSidebar={showLayersSidebar}
            onToggleLayersSidebar={() => setShowLayersSidebar((prev) => !prev)}
            showGlitter={showGlitter}
            onToggleGlitter={() =>
              setShowGlitter((prev) => {
                const next = !prev;
                showToast(next ? 'Mouse sparkle turned on' : 'Mouse sparkle turned off');
                return next;
              })
            }
            layersCount={layers.length}
            onToggleFullScreen={handleToggleFullScreen}
            activeTemplate={activeTemplate}
            lastClosedTemplate={lastClosedTemplate}
            onRestoreTemplate={handleRestoreTemplate}
            onOpenTemplates={() => setIsTemplateModalOpen(true)}
            onOpenHelp={() => setIsSparkModalOpen(true)}
            isRibbonOpen={isRibbonOpen}
            onToggleRibbon={() => setIsRibbonOpen((prev) => !prev)}
            isRibbonPinned={isRibbonPinned}
            onToggleRibbonPin={() => {
              setIsRibbonPinned((prev) => {
                const next = !prev;
                if (next && !isRibbonOpen) {
                  setIsRibbonOpen(true);
                }
                showToast(
                  next ? 'Ribbon pinned open' : 'Ribbon unpinned (auto-hides while drawing)'
                );
                return next;
              });
            }}
            mirrorMode={mirrorMode}
            onMirrorModeChange={(mode) => {
              setMirrorMode(mode);
              showToast(getMirrorModeStatusMessage(mode));
            }}
            symmetryGuides={symmetryGuides}
            onSymmetryGuidesChange={(nextGuides) => {
              setSymmetryGuides(nextGuides);
              showToast(getSymmetryGuidesStatusMessage(nextGuides));
            }}
            onMirrorHorizontal={() => canvasStudioRef.current?.toggleMirrorHorizontal()}
            onMirrorVertical={() => canvasStudioRef.current?.toggleMirrorVertical()}
            onApplyFilter={(filter, options) => canvasStudioRef.current?.applyFilter(filter, options)}
            onApplyGrayscale={() => canvasStudioRef.current?.applyGrayscaleFilter()}
            onApplySepia={() => canvasStudioRef.current?.applySepiaFilter()}
            onApplyBrightness={(delta) => canvasStudioRef.current?.applyBrightnessFilter(delta)}
            themeMode={themeMode}
            onToggleTheme={handleToggleTheme}
            user={currentUser}
            onOpenAuth={handleOpenAuth}
            onSaveToCloud={handleOpenCloudSave}
            onOpenStudioGallery={() => setIsGalleryModalOpen(true)}
            onOpenCloudGallery={handleOpenCloudGallery}
            hasUnsavedChanges={hasUnsavedChanges}
            currentArtworkTitle={currentCloudArtworkTitle}
          />

          {/* Main Pale Blue-Grey Workspace & Layers Sidebar */}
          <main
            className={`flex-1 min-h-0 w-full flex flex-row items-stretch relative overflow-hidden ${
              themeMode === 'dark' ? 'bg-[#12151C]' : 'bg-[#C9D2E3]'
            }`}
          >
            <div className="flex-1 min-w-0 min-h-0 flex flex-col relative overflow-hidden">
              <CanvasStudio
                ref={canvasStudioRef}
                tool={tool}
                stampShape={stampShape}
                shapeType={shapeType}
                outlineStyle={outlineStyle}
                fillStyle={fillStyle}
                color={color}
                secondaryColor={secondaryColor}
                size={size}
                stabilization={stabilization}
                bucketTolerance={bucketTolerance}
                pressureSensitive={pressureSensitive}
                isGradientBrush={isGradientBrush}
                opacity={opacity}
                strokes={strokes}
                onStrokesChange={handleStrokesChange}
                layers={layers}
                activeLayerId={activeLayerId}
                onColorChange={handleSelectPrimaryColor}
                onSecondaryColorChange={handleSelectSecondaryColor}
                onPickedColorComplete={() => setTool(lastDrawingTool)}
                activeTemplate={activeTemplate}
                lastClosedTemplate={lastClosedTemplate}
                templateOpacity={templateOpacity}
                onTemplateOpacityChange={setTemplateOpacity}
                onClearTemplate={handleCloseTemplate}
                zoomLevel={zoomLevel}
                onZoomChange={setZoomLevel}
                resetViewSignal={resetViewSignal}
                showGrid={showGrid}
                showRulers={showRulers}
                mirrorMode={mirrorMode}
                onMirrorModeChange={setMirrorMode}
                symmetryGuides={symmetryGuides}
                onCanvasStrokeStart={() => {
                  if (!isRibbonPinned && isRibbonOpen) {
                    setIsRibbonOpen(false);
                  }
                }}
                canvasDimensions={canvasDimensions}
                onCanvasDimensionsChange={setCanvasDimensions}
                isAutoFillScreen={isAutoFullScreenCanvas}
                onManualCanvasResize={() => setIsAutoFullScreenCanvas(false)}
                onCursorPositionChange={setCursorPosition}
                onSelectionSizeChange={setSelectionSize}
                onHasSelectionChange={setHasSelection}
                onClipboardChange={setCanPaste}
                onNotify={(msg) => showToast(msg)}
              />
            </div>

            {showLayersSidebar ? (
              <>
                <button
                  type="button"
                  data-testid="layers-mobile-backdrop"
                  aria-label="Hide Layers panel"
                  onClick={() => setShowLayersSidebar(false)}
                  className="md:hidden absolute inset-0 bg-slate-900/25 z-30 cursor-default"
                />
                <LayersSidebar
                  layers={layers}
                  activeLayerId={activeLayerId}
                  strokes={strokes}
                  canvasDimensions={canvasDimensions}
                  onSelectLayer={setActiveLayerId}
                  onAddLayer={handleAddLayer}
                  onToggleVisibility={handleToggleLayerVisibility}
                  onMoveLayer={handleMoveLayer}
                  onReorderLayer={handleReorderLayer}
                  onDeleteLayer={handleDeleteLayer}
                  onRenameLayer={handleRenameLayer}
                  onLayerOpacityChange={handleLayerOpacityChange}
                  onCloseSidebar={() => setShowLayersSidebar(false)}
                />
              </>
            ) : (
              <button
                type="button"
                data-testid="reveal-layers-btn"
                aria-expanded={false}
                aria-label={getLayersToggleAccessibleLabel(false, layers.length)}
                onClick={() => setShowLayersSidebar(true)}
                className="absolute top-2 right-2 z-20 h-7 px-2.5 bg-[#F5F6F7]/95 hover:bg-[#E5F1FB] border border-[#9AA4B2] hover:border-[#7DA2CE] shadow-sm flex items-center gap-1.5 text-[11px] font-medium text-[#1E1E1E] cursor-pointer"
                title="Reveal Layers panel"
              >
                <Layers className="w-3.5 h-3.5 text-[#1979CA]" />
                <span>Layers</span>
                <span className="px-1 py-0.2 text-[10px] bg-white border border-[#DADBDC] text-[#555555] leading-none tabular-nums">
                  {layers.length}
                </span>
              </button>
            )}
          </main>

          {/* Bottom Windows Paint Status Bar */}
          {showStatusBar && (
            <PaintStatusBar
              canvasDimensions={canvasDimensions}
              cursorPosition={cursorPosition}
              selectionSize={selectionSize}
              zoomLevel={zoomLevel}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onZoomChange={setZoomLevel}
              onResetZoom={handleResetZoom}
              syncStatus={projectSyncStatus}
              onSyncClick={handleOpenCloudSave}
            />
          )}

          {/* Preserved Paint Books Gallery Modal */}
          <TemplateModal
            isOpen={isTemplateModalOpen}
            onClose={() => setIsTemplateModalOpen(false)}
            activeTemplate={activeTemplate}
            onSelectTemplate={handleSelectTemplate}
            onClearTemplate={() => {
              handleCloseTemplate();
              showToast('Blank canvas enabled');
            }}
            templateOpacity={templateOpacity}
            onOpacityChange={setTemplateOpacity}
          />

          {/* Edit Colors Modal */}
          <ColorsModal
            isOpen={isColorsModalOpen}
            onClose={() => setIsColorsModalOpen(false)}
            currentColor={color}
            onColorChange={setColor}
            secondaryColor={secondaryColor}
            onSecondaryColorChange={setSecondaryColor}
            recentColors={recentColors}
            onCommitRecentColor={handleRecordRecentColor}
            customColors={customColors}
            onAddCustomColor={(hex) => {
              setCustomColors((prev) => mergePaletteIntoCustomColors(prev, [hex]));
            }}
            onAddCustomColors={(hexes) => {
              setCustomColors((prev) => mergePaletteIntoCustomColors(prev, hexes));
              if (hexes.length > 0) {
                showToast(
                  `Added ${hexes.length} color${hexes.length === 1 ? '' : 's'} to Custom Colors`,
                  hexes[0]
                );
              }
            }}
            onClearCustomColors={() => {
              setCustomColors([]);
              showToast('Cleared Custom Colors');
            }}
          />

          {/* Resize & Skew Modal */}
          <ResizeCanvasModal
            isOpen={isResizeModalOpen}
            onClose={() => setIsResizeModalOpen(false)}
            currentWidth={canvasDimensions.width}
            currentHeight={canvasDimensions.height}
            onApplyResize={handleApplyResize}
          />

          {/* Save Artwork Modal */}
          <SaveArtworkModal
            isOpen={isSaveModalOpen}
            onClose={() => setIsSaveModalOpen(false)}
            strokes={strokes}
            layers={layers}
            activeTemplate={activeTemplate}
            onSaveToGallery={handleSaveToGallery}
            onOpenGallery={() => setIsGalleryModalOpen(true)}
            canvasDimensions={canvasDimensions}
          />

          {/* Session Gallery Modal */}
          <SessionGalleryModal
            isOpen={isGalleryModalOpen}
            onClose={() => setIsGalleryModalOpen(false)}
            artworks={savedArtworks}
            onDeleteArtwork={handleDeleteFromGallery}
            onOpenCanvas={() => setIsGalleryModalOpen(false)}
            isLoading={isGalleryLoading}
          />

          {/* Creative Spark / Tips Modal */}
          <CreativeSparkModal
            isOpen={isSparkModalOpen}
            onClose={() => setIsSparkModalOpen(false)}
            onSelectColor={(hex) => {
              handleSelectPrimaryColor(hex);
              showToast('Color applied to brush', hex);
            }}
          />

            {/* Clear Canvas Confirmation */}
            <ClearConfirmModal
              isOpen={isClearConfirmOpen}
              onClose={() => setIsClearConfirmOpen(false)}
              onConfirmClear={handleConfirmClear}
              strokesCount={strokes.length}
            />

            {/* Firebase Auth Modal */}
            <AuthModal
              isOpen={isAuthModalOpen}
              onClose={() => setIsAuthModalOpen(false)}
              user={currentUser}
              initialMode={authModalMode}
              promptMessage={authPromptMessage}
              onSuccess={() => {
                onAuthSuccessAction?.();
                setOnAuthSuccessAction(null);
              }}
              onOpenCloudGallery={() => setIsCloudGalleryOpen(true)}
            />

            {/* Cloud / Local Save Modal */}
            <CloudSaveModal
              isOpen={isCloudSaveModalOpen}
              onClose={() => setIsCloudSaveModalOpen(false)}
              user={currentUser}
              isAuthReady={isAuthReady}
              currentArtworkId={currentCloudArtworkId}
              currentArtworkTitle={currentCloudArtworkTitle}
              currentArtworkCreatedAt={currentCloudArtworkCreatedAt}
              currentArtworkUpdatedAt={currentCloudArtworkUpdatedAt}
              strokes={strokes}
              layers={layers}
              activeLayerId={activeLayerId}
              activeTemplate={activeTemplate}
              templateOpacity={templateOpacity}
              zoomLevel={zoomLevel}
              canvasDimensions={canvasDimensions}
              getCanvasDataUrl={getCanvasExportDataUrl}
              onSavedSuccess={handleCloudSavedSuccess}
              onSyncStatusChange={setProjectSyncStatus}
              onRequestSignIn={() => {
                handleOpenAuth('signin', 'Sign in to save your artwork to Google Firebase Cloud.', () => {
                  setIsCloudSaveModalOpen(true);
                });
              }}
            />

            {/* Cloud Artwork Gallery Modal */}
            <MyArtworkGallery
              isOpen={isCloudGalleryOpen}
              onClose={() => setIsCloudGalleryOpen(false)}
              user={currentUser}
              isAuthReady={isAuthReady}
              hasUnsavedChanges={hasUnsavedChanges}
              onOpenArtwork={(artwork) => void handleOpenCloudArtwork(artwork)}
              onRequestSignIn={() => {
                handleOpenAuth('signin', 'Sign in to access your cloud drawings.');
              }}
              onOpenNewCanvas={() => {
                handleConfirmClear();
                setCurrentView('studio');
              }}
              onArtworkRenamed={(id, newTitle) => {
                if (id === currentCloudArtworkId) {
                  setCurrentCloudArtworkTitle(newTitle);
                }
              }}
              onArtworkDeleted={(id) => {
                if (id === currentCloudArtworkId) {
                  setCurrentCloudArtworkId(null);
                  setCurrentCloudArtworkTitle('');
                  setCurrentCloudArtworkCreatedAt(null);
                  setCurrentCloudArtworkUpdatedAt(null);
                  setProjectSyncStatus('Local Only');
                }
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
