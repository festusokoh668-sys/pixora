/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layers } from 'lucide-react';
import { PaintRibbon } from './components/PaintRibbon';
import { PaintStatusBar } from './components/PaintStatusBar';
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
import { loadLocalArtworks, saveLocalArtwork, deleteLocalArtwork } from './utils/artworkPersistence';

export default function App() {
  // Navigation / View State: Welcome Page as front page
  const [currentView, setCurrentView] = useState<'welcome' | 'studio'>('welcome');

  // Drawing Tools & Windows Paint Ribbon State
  const [ribbonTab, setRibbonTab] = useState<'file' | 'home' | 'view'>('home');
  const [isRibbonOpen, setIsRibbonOpen] = useState<boolean>(true);
  const [isRibbonPinned, setIsRibbonPinned] = useState<boolean>(true);
  const [mirrorMode, setMirrorMode] = useState<MirrorMode>('none');
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
  const [savedArtworks, setSavedArtworks] = useState<SavedArtwork[]>([]);\n  const [isArtworkLibraryReady, setIsArtworkLibraryReady] = useState(false);\n

  useEffect(() => {
    let cancelled = false;\n    loadLocalArtworks().then((items) => {
      if (!cancelled) setSavedArtworks(items);
    }).catch((error) => {
      console.error('Could not restore local Pixora artwork:', error);
      if (!cancelled) showToast('Could not load local artwork. Your browser storage may be unavailable.');
    }).finally(() => {
      if (!cancelled) setIsArtworkLibraryReady(true);\n    });
    return () => { cancelled = true; };
  }, [showToast]);

  // Modals
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState<boolean>(false);
  const [isSparkModalOpen, setIsSparkModalOpen] = useState<boolean>(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);
  const [isResizeModalOpen, setIsResizeModalOpen] = useState<boolean>(false);
  const [isColorsModalOpen, setIsColorsModalOpen] = useState<boolean>(false);
  const [isQuickSaving, setIsQuickSaving] = useState<boolean>(false);
  const [lastQuickSaveFile, setLastQuickSaveFile] = useState<string>('');

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
  };

  const handleUndo = () => {
    const previous = historyRef.current.undo(strokes);
    if (previous !== null) {
      setStrokes(previous);
      updateHistoryFlags();
    }
  };

  const handleRedo = () => {
    const next = historyRef.current.redo(strokes);
    if (next !== null) {
      setStrokes(next);
      updateHistoryFlags();
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
    updateHistoryFlags();
    showToast('Page cleared');
  };

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
    const url = URL.createObjectURL(file);
    const customTemplate: DrawingTemplate = {
      id: `custom_${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, '').slice(0, 24) || 'Uploaded Image',
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
          setIsSaveModalOpen(true);
          break;
        case 'quick-save':
          void handleQuickSave();
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
        case 'rotate-cw':
          canvasStudioRef.current?.rotateOrFlip('cw90');
          showToast('Rotated right 90° (Ctrl+R)');
          break;
        case 'rotate-ccw':
          canvasStudioRef.current?.rotateOrFlip('ccw90');
          showToast('Rotated left 90° (Ctrl+Shift+R)');
          break;
        case 'rotate-180':
          canvasStudioRef.current?.rotateOrFlip('180');
          showToast('Rotated 180°');
          break;
        case 'flip-horizontal':
          canvasStudioRef.current?.rotateOrFlip('flipH');
          showToast('Flipped horizontal (Ctrl+F)');
          break;
        case 'flip-vertical':
          canvasStudioRef.current?.rotateOrFlip('flipV');
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
    const durableArtwork: SavedArtwork = {
      ...artwork,
      savedAt: Date.now(),
      storageScope: 'device',
      project: artwork.project ?? {
        strokes,
        layers,
        canvasDimensions,
        activeLayerId,
        templateId: activeTemplate?.id,
        templateOpacity,
      },
    };
    try {
      await saveLocalArtwork(durableArtwork);
      setSavedArtworks((prev) => [durableArtwork, ...prev.filter((item) => item.id !== durableArtwork.id)]);
      showToast(`Saved "${durableArtwork.title}" on this device`);
    } catch (error) {
      console.error('Pixora local artwork save failed:', error);
      showToast('Save failed. Your artwork was not stored permanently.');
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

      setLastQuickSaveFile(filename);
      showToast(`Downloaded ${filename}`);
    } catch (err) {
      console.error('Quick Save failed:', err);
      showToast('Quick Save failed writing to downloads folder');
    } finally {
      setIsQuickSaving(false);
    }
  };

  const handleDeleteFromGallery = (id: string) => {
    deleteLocalArtwork(id).then(() => {
      setSavedArtworks((prev) => prev.filter((a) => a.id !== id));
      showToast('Artwork deleted from this device');
    }).catch((error) => {
      console.error('Could not delete Pixora artwork:', error);
      showToast('Could not delete artwork. Please try again.');
    });
  };

  const handleOpenSavedArtwork = (artwork: SavedArtwork) => {
    if (!artwork.project) {
      showToast('This older gallery item has no editable project data.');
      return;
    }
    setStrokes(artwork.project.strokes ?? []);
    setLayers(artwork.project.layers?.length ? artwork.project.layers : createInitialLayers());
    setCanvasDimensions(artwork.project.canvasDimensions ?? { width: 819, height: 460 });
    setActiveLayerId(artwork.project.activeLayerId ?? DEFAULT_LAYER_ID);
    const template = artwork.project.templateId
      ? TEMPLATES.find((item) => item.id === artwork.project?.templateId) ?? null
      : null;
    setActiveTemplate(template);
    setTemplateOpacity(artwork.project.templateOpacity ?? 0.35);
    historyRef.current = new HistoryManager(35);
    updateHistoryFlags();
    setCurrentView('studio');
    setIsGalleryModalOpen(false);
    showToast(`Opened "${artwork.title}"`);
  };

  return (
    <div
      className={`${
        currentView === 'studio'
          ? 'h-[100dvh] overflow-hidden bg-[#C9D2E3]'
          : 'min-h-screen bg-gradient-to-br from-white via-blue-50/70 to-blue-200/40'
      } text-[#1E1E1E] flex flex-col font-sans selection:bg-blue-200 selection:text-blue-900 overflow-x-hidden`}
    >
      <GlitterTrailOverlay
        enabled={showGlitter}
        accentColor={color}
        secondaryColor={secondaryColor}
      />
      {/* Subtle Non-Obstructive Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-9 left-3 z-50 pointer-events-none px-3 py-1 bg-[#F5F6F7] border border-[#9AA4B2] shadow-md flex items-center gap-2 text-[11px] font-medium text-[#1E1E1E]">
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
        <WelcomeScreen onStartCreating={handleStartFreshCanvas} />
      ) : (
        <>
          <div
            data-testid="paint-studio-window"
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
              onSave={() => setIsSaveModalOpen(true)}
              onQuickSave={() => void handleQuickSave()}
              isQuickSaving={isQuickSaving}
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
            onRotateCanvas={(action) => canvasStudioRef.current?.rotateOrFlip(action)}
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
            onMirrorHorizontal={() => canvasStudioRef.current?.toggleMirrorHorizontal()}
            onMirrorVertical={() => canvasStudioRef.current?.toggleMirrorVertical()}
            onApplyFilter={(filter, options) => canvasStudioRef.current?.applyFilter(filter, options)}
            onApplyGrayscale={() => canvasStudioRef.current?.applyGrayscaleFilter()}
            onApplySepia={() => canvasStudioRef.current?.applySepiaFilter()}
            onApplyBrightness={(delta) => canvasStudioRef.current?.applyBrightnessFilter(delta)}
          />

          {/* Main Pale Blue-Grey Workspace & Layers Sidebar */}
          <main className="flex-1 min-h-0 w-full flex flex-row items-stretch relative overflow-hidden bg-[#C9D2E3]">
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
            onAddCustomColor={(hex) => {
              setCustomColors((prev) =>
                prev.includes(hex) ? prev : [hex, ...prev].slice(0, 10)
              );
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
            canvasDimensions={canvasDimensions}
          />

          {/* Session Gallery Modal */}
          <SessionGalleryModal
            isOpen={isGalleryModalOpen}
            onClose={() => setIsGalleryModalOpen(false)}
            artworks={savedArtworks}
            onDeleteArtwork={handleDeleteFromGallery}
            onOpenCanvas={() => setIsGalleryModalOpen(false)}
            onOpenArtwork={handleOpenSavedArtwork}
            isLoading={!isArtworkLibraryReady}
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
          </div>
        </>
      )}
    </div>
  );
}
