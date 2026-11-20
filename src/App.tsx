/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import {
  DrawingTemplate,
  MirrorMode,
  SavedArtwork,
  ShapeFillStyle,
  ShapeOutlineStyle,
  ShapeType,
  Stroke,
  ToolType,
} from './types';
import {
  HistoryManager,
  preloadStrokeRasterImage,
  renderStrokeToContext,
  generateArtworkFilename,
  exportStrokesToSvgString,
} from './utils/drawing';
import { TEMPLATES } from './data/templates';

export default function App() {
  // Navigation / View State: Welcome Page as front page
  const [currentView, setCurrentView] = useState<'welcome' | 'studio'>('welcome');

  // Drawing Tools & Windows Paint Ribbon State
  const [ribbonTab, setRibbonTab] = useState<'file' | 'home' | 'view'>('home');
  const [isRibbonOpen, setIsRibbonOpen] = useState<boolean>(true);
  const [isRibbonPinned, setIsRibbonPinned] = useState<boolean>(true);
  const [isWindowMinimized, setIsWindowMinimized] = useState<boolean>(false);
  const [mirrorMode, setMirrorMode] = useState<MirrorMode>('none');
  const [tool, setTool] = useState<ToolType>('brush');
  const [lastDrawingTool, setLastDrawingTool] = useState<ToolType>('brush');
  const [shapeType, setShapeType] = useState<ShapeType>('rectangle');
  const [outlineStyle, setOutlineStyle] = useState<ShapeOutlineStyle>('solid');
  const [fillStyle, setFillStyle] = useState<ShapeFillStyle>('none');

  // Default Colors matching classic Windows Paint (Color 1: Black, Color 2: White)
  const [color, setColor] = useState<string>('#000000');
  const [secondaryColor, setSecondaryColor] = useState<string>('#FFFFFF');
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [size, setSize] = useState<number>(5);
  const [opacity] = useState<number>(1.0);

  // Canvas & Viewport State matching reference proportion (819 × 460px at 100%)
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [resetViewSignal, setResetViewSignal] = useState<number>(0);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [showRulers, setShowRulers] = useState<boolean>(false);
  const [showStatusBar, setShowStatusBar] = useState<boolean>(true);
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

  // Modals
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState<boolean>(false);
  const [isSparkModalOpen, setIsSparkModalOpen] = useState<boolean>(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);
  const [isResizeModalOpen, setIsResizeModalOpen] = useState<boolean>(false);
  const [isColorsModalOpen, setIsColorsModalOpen] = useState<boolean>(false);

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

  const handleConfirmClear = () => {
    historyRef.current.pushState(strokes);
    setStrokes([]);
    setIsAutoFullScreenCanvas(true);
    updateHistoryFlags();
    showToast('New blank canvas ready');
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (mod && key === 's') {
        e.preventDefault();
        setIsSaveModalOpen(true);
      } else if (mod && key === 'c') {
        e.preventDefault();
        canvasStudioRef.current?.copySelection();
      } else if (mod && key === 'x') {
        e.preventDefault();
        canvasStudioRef.current?.cutSelection();
      } else if (mod && key === 'v') {
        e.preventDefault();
        canvasStudioRef.current?.pasteClipboard();
      } else if (mod && key === 'a') {
        e.preventDefault();
        canvasStudioRef.current?.selectAll();
      } else if (e.ctrlKey && e.key === 'F1') {
        e.preventDefault();
        setIsRibbonOpen((prev) => !prev);
      } else if (e.key === 'Delete' && hasSelection) {
        e.preventDefault();
        canvasStudioRef.current?.deleteSelection();
      } else if (e.key === 'Escape') {
        canvasStudioRef.current?.clearSelection();
      } else if (!mod && key === 'b') {
        handleToolSelect('brush');
      } else if (!mod && key === 'k') {
        handleToolSelect('bucket');
      } else if (!mod && key === 'p') {
        handleToolSelect('pencil');
      } else if (!mod && key === 'e') {
        handleToolSelect('eraser');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleSaveToGallery = (artwork: SavedArtwork) => {
    setSavedArtworks((prev) => [artwork, ...prev]);
    showToast(`Saved "${artwork.title}"!`);
  };

  const handleExportFormat = (format: 'jpg' | 'png' | 'svg') => {
    const baseTitle = activeTemplate ? `Pixora ${activeTemplate.name}` : 'Untitled';
    const filename = generateArtworkFilename(baseTitle, format);

    if (format === 'svg') {
      const svgString = exportStrokesToSvgString(strokes, {
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
        for (const s of strokes) {
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

  const handleDeleteFromGallery = (id: string) => {
    setSavedArtworks((prev) => prev.filter((a) => a.id !== id));
    showToast('Artwork removed from session');
  };

  return (
    <div
      className={`${
        currentView === 'studio'
          ? 'h-[100dvh] overflow-hidden bg-[#C9D2E3]'
          : 'min-h-screen bg-gradient-to-br from-white via-blue-50/70 to-blue-200/40'
      } text-[#1E1E1E] flex flex-col font-sans selection:bg-blue-200 selection:text-blue-900 overflow-x-hidden`}
    >
      {/* Subtle Non-Obstructive Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-3 py-1 bg-[#F5F6F7] border border-[#9AA4B2] shadow-md flex items-center gap-2 text-[11px] font-medium text-[#1E1E1E]">
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
          {isWindowMinimized && (
            <div
              data-testid="minimized-desktop-view"
              className="flex-1 min-h-0 flex flex-col justify-between bg-gradient-to-br from-[#1C4D82] via-[#1B5EA4] to-[#0E325C] text-white select-none"
            >
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="bg-[#F5F6F7] text-[#1E1E1E] border border-[#A0A0A0] shadow-xl px-5 py-4 flex items-center gap-4 max-w-md w-full">
                  <svg className="w-9 h-9 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 3C6.5 3 2 7 2 11.8C2 15.2 4.8 17.5 8 17.5C9.4 17.5 10.2 18.2 10.2 19.3C10.2 20.5 11.1 21 12.5 21C18 21 22 17 22 12C22 7 17.5 3 12 3Z"
                      fill="#F6D57E"
                      stroke="#8B6F29"
                      strokeWidth="1.4"
                    />
                    <circle cx="7.5" cy="9.5" r="1.6" fill="#ED1C24" />
                    <circle cx="12" cy="7.2" r="1.6" fill="#22B14C" />
                    <circle cx="16.5" cy="9.5" r="1.6" fill="#00A2E8" />
                    <circle cx="16.5" cy="14" r="1.6" fill="#FFF200" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate">
                      {activeTemplate ? `${activeTemplate.name} - Pixora` : 'Untitled - Pixora'}
                    </div>
                    <div className="text-[11px] text-[#555555]">
                      Window minimized ({strokes.length} stroke{strokes.length === 1 ? '' : 's'} preserved)
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="desktop-restore-btn"
                    onClick={() => setIsWindowMinimized(false)}
                    className="px-3 py-1.5 bg-[#1979CA] hover:bg-[#1464A8] text-white text-[12px] font-medium cursor-pointer shrink-0"
                  >
                    Restore
                  </button>
                </div>
              </div>

              {/* Traditional Windows Taskbar */}
              <div
                data-testid="windows-taskbar"
                className="h-[40px] bg-[#1F242D] border-t border-[#343C4A] px-2 flex items-center justify-between text-[12px]"
              >
                <div className="flex items-center gap-1 h-full">
                  <div className="w-9 h-full flex items-center justify-center text-[#93C5FD]">
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="1" y="1" width="6" height="6" />
                      <rect x="9" y="1" width="6" height="6" />
                      <rect x="1" y="9" width="6" height="6" />
                      <rect x="9" y="9" width="6" height="6" />
                    </svg>
                  </div>
                  <button
                    type="button"
                    data-testid="taskbar-restore-btn"
                    onClick={() => setIsWindowMinimized(false)}
                    className="h-full px-3 bg-[#2E3644] hover:bg-[#3A4556] border-b-2 border-[#60A5FA] flex items-center gap-2 text-white cursor-pointer"
                    title="Click to restore Pixora window"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 3C6.5 3 2 7 2 11.8C2 15.2 4.8 17.5 8 17.5C9.4 17.5 10.2 18.2 10.2 19.3C10.2 20.5 11.1 21 12.5 21C18 21 22 17 22 12C22 7 17.5 3 12 3Z"
                        fill="#F6D57E"
                        stroke="#8B6F29"
                        strokeWidth="1.4"
                      />
                      <circle cx="7.5" cy="9.5" r="1.6" fill="#ED1C24" />
                      <circle cx="12" cy="7.2" r="1.6" fill="#22B14C" />
                      <circle cx="16.5" cy="9.5" r="1.6" fill="#00A2E8" />
                    </svg>
                    <span className="truncate max-w-[200px]">
                      {activeTemplate ? `${activeTemplate.name} - Pixora` : 'Untitled - Pixora'}
                    </span>
                  </button>
                </div>
                <div className="text-[11px] text-[#CBD5E1] px-2">
                  Click taskbar item to restore
                </div>
              </div>
            </div>
          )}

          <div
            data-testid="paint-studio-window"
            className={
              isWindowMinimized
                ? 'hidden'
                : 'flex-1 min-h-0 flex flex-col overflow-hidden'
            }
          >
            {/* Traditional Windows Paint Title Bar, Tabs & Ribbon */}
            <PaintRibbon
              activeTab={ribbonTab}
              onTabChange={setRibbonTab}
              currentTool={tool}
              onToolSelect={handleToolSelect}
              currentShape={shapeType}
              onShapeSelect={setShapeType}
              outlineStyle={outlineStyle}
              onOutlineStyleChange={setOutlineStyle}
              fillStyle={fillStyle}
              onFillStyleChange={setFillStyle}
              currentColor={color}
              onColorChange={setColor}
              secondaryColor={secondaryColor}
              onSecondaryColorChange={setSecondaryColor}
              customColors={customColors}
              onEditColors={() => setIsColorsModalOpen(true)}
              currentSize={size}
              onSizeChange={setSize}
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
              onExportFormat={handleExportFormat}
              onPrint={() => window.print()}
              onMinimizeWindow={() => setIsWindowMinimized(true)}
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
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
            onFitToWindow={handleFitToWindow}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid((prev) => !prev)}
            showRulers={showRulers}
            onToggleRulers={() => setShowRulers((prev) => !prev)}
            showStatusBar={showStatusBar}
            onToggleStatusBar={() => setShowStatusBar((prev) => !prev)}
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
            onMirrorModeChange={setMirrorMode}
            onApplyFilter={(filter) => canvasStudioRef.current?.applyFilter(filter)}
          />

          {/* Main Pale Blue-Grey Workspace & Upper-Left White Canvas */}
          <main className="flex-1 min-h-0 w-full flex flex-col items-stretch justify-stretch relative overflow-hidden bg-[#C9D2E3]">
            <CanvasStudio
              ref={canvasStudioRef}
              tool={tool}
              shapeType={shapeType}
              outlineStyle={outlineStyle}
              fillStyle={fillStyle}
              color={color}
              secondaryColor={secondaryColor}
              size={size}
              opacity={opacity}
              strokes={strokes}
              onStrokesChange={handleStrokesChange}
              onColorChange={setColor}
              onSecondaryColorChange={setSecondaryColor}
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
          />

          {/* Creative Spark / Tips Modal */}
          <CreativeSparkModal
            isOpen={isSparkModalOpen}
            onClose={() => setIsSparkModalOpen(false)}
            onSelectColor={(hex) => {
              setColor(hex);
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
