import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Eye,
  EyeOff,
  Sliders,
  Play,
  Pause,
  Wand2,
  Loader2,
  FlipHorizontal,
  FlipVertical,
  GripVertical,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  CanvasLayer,
  DrawingTemplate,
  LayerFilterType,
  MirrorMode,
  PaintFinish,
  Point,
  RectBounds,
  ShapeFillStyle,
  ShapeOutlineStyle,
  ShapeType,
  StampShape,
  Stroke,
  SymmetryGuideMode,
  ToolType,
} from '../types';
import {
  getCanvasCoordinates,
  getContainDrawRect,
  createStroke,
  createMirroredStrokes,
  toggleMirrorAxis,
  getMirrorModeStatusMessage,
  clampSymmetryAxisRatio,
  getStabilizerConfig,
  stabilizeCursorStream,
  smoothStrokePoints,
  flipCanvasStrokes,
  resolvePointerEventPressure,
  doesPointerEventProvidePressure,
  resolveStrokeGradientEnd,
  renderStrokeToContext,
  preloadStrokeRasterImage,
} from '../utils/drawing';
import { getBlurBrushStrokeWidth } from '../utils/blur';
import { clampBucketTolerance, DEFAULT_BUCKET_TOLERANCE } from '../utils/floodFill';
import {
  createInitialLayers,
  groupStrokesByLayer,
  resolveStrokeLayerId,
} from '../utils/layers';
import { rgbToHex } from '../utils/color';
import {
  clampZoom,
  getPointerPairMetrics,
  calculatePinchZoomAndPan,
  calculateWheelZoomAndPan,
  calculateFullScreenCanvasDimensions,
} from '../utils/viewport';
import { generateOutlineTraceDataUrl, generateFallbackSvgDataUrl } from '../utils/edgeDetection';
import { generateRulerTicks, clientCoordToRulerCanvasPx } from '../utils/rulers';
import {
  applyLayerFilterToContext,
  clampBrightnessDelta,
  getLayerFilterSpec,
  LayerFilterOptions,
} from '../utils/filters';
import {
  hasHorizontalSymmetryGuide,
  hasVerticalSymmetryGuide,
} from '../utils/symmetryGuides';

export interface CanvasStudioHandle {
  cutSelection: () => void;
  copySelection: () => Promise<void>;
  pasteClipboard: () => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelection: () => void;
  cropToSelection: () => void;
  flipHorizontal: () => void;
  flipVertical: () => void;
  toggleMirrorAxis: (axis: 'horizontal' | 'vertical') => void;
  toggleMirrorHorizontal: () => void;
  toggleMirrorVertical: () => void;
  applyFilter: (filter: LayerFilterType, options?: LayerFilterOptions) => void;
  applyGrayscaleFilter: () => void;
  applySepiaFilter: () => void;
  applyBrightnessFilter: (delta?: number) => void;
  applyInvertFilter: () => void;
  exportRaster: (format: 'png' | 'jpg', quality?: number) => string | null;
  clearCanvas: () => void;
  getCanPaste: () => boolean;
}

interface CanvasStudioProps {
  tool: ToolType;
  stampShape?: StampShape;
  shapeType?: ShapeType;
  outlineStyle?: ShapeOutlineStyle;
  fillStyle?: ShapeFillStyle;
  color: string;
  secondaryColor?: string;
  size: number;
  stabilization?: number;
  bucketTolerance?: number;
  pressureSensitive?: boolean;
  opacity: number;
  isGradientBrush?: boolean;
  colorEnd?: string | null;
  paintFinish?: PaintFinish;
  strokes: Stroke[];
  onStrokesChange: (newStrokes: Stroke[]) => void;
  layers?: CanvasLayer[];
  activeLayerId?: string;
  onColorChange?: (hex: string) => void;
  onSecondaryColorChange?: (hex: string) => void;
  onPickedColorComplete?: () => void;
  activeTemplate: DrawingTemplate | null;
  lastClosedTemplate?: DrawingTemplate | null;
  templateOpacity: number;
  onTemplateOpacityChange: (opacity: number) => void;
  onClearTemplate: () => void;
  zoomLevel?: number;
  onZoomChange?: (zoom: number) => void;
  resetViewSignal?: number;
  showGrid?: boolean;
  showRulers?: boolean;
  mirrorMode?: MirrorMode;
  onMirrorModeChange?: (mode: MirrorMode) => void;
  symmetryGuides?: SymmetryGuideMode;
  onCanvasStrokeStart?: () => void;
  canvasDimensions: { width: number; height: number };
  onCanvasDimensionsChange: (dims: { width: number; height: number }) => void;
  isAutoFillScreen?: boolean;
  onManualCanvasResize?: () => void;
  onCursorPositionChange?: (pos: { x: number; y: number } | null) => void;
  onSelectionSizeChange?: (dims: { width: number; height: number } | null) => void;
  onHasSelectionChange?: (hasSelection: boolean) => void;
  onClipboardChange?: (canPaste: boolean) => void;
  onNotify?: (msg: string) => void;
}

export const CanvasStudio = forwardRef<CanvasStudioHandle, CanvasStudioProps>(
  (
    {
      tool,
      stampShape = 'star',
      shapeType = 'rectangle',
      outlineStyle = 'solid',
      fillStyle = 'none',
      color,
      secondaryColor = '#FFFFFF',
      size,
      stabilization = 45,
      bucketTolerance = DEFAULT_BUCKET_TOLERANCE,
      pressureSensitive = true,
      opacity,
      isGradientBrush = false,
      colorEnd,
      paintFinish,
      strokes,
      onStrokesChange,
      layers: layersProp,
      activeLayerId: activeLayerIdProp,
      onColorChange,
      onSecondaryColorChange,
      onPickedColorComplete,
      activeTemplate,
      templateOpacity,
      onTemplateOpacityChange,
      onClearTemplate,
      zoomLevel: zoomLevelProp,
      onZoomChange,
      resetViewSignal,
      showGrid = false,
      showRulers = false,
      mirrorMode: mirrorModeProp,
      onMirrorModeChange,
      symmetryGuides = 'none',
      onCanvasStrokeStart,
      canvasDimensions,
      onCanvasDimensionsChange,
      isAutoFillScreen = true,
      onManualCanvasResize,
      onCursorPositionChange,
      onSelectionSizeChange,
      onHasSelectionChange,
      onClipboardChange,
      onNotify,
    },
    ref
  ) => {
    const workspaceRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const isDrawingRef = useRef<boolean>(false);
    const currentStrokeRef = useRef<Stroke | null>(null);
    const rawPointerBufferRef = useRef<Point[]>([]);
    const canvasRectRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
    const activeRafIdRef = useRef<number | null>(null);

    // Selection & clipboard state
    const [selectionRect, setSelectionRect] = useState<RectBounds | null>(null);
    const selectionDragStartRef = useRef<Point | null>(null);
    const isMovingSelectionRef = useRef<boolean>(false);
    const moveOriginRectRef = useRef<RectBounds | null>(null);
    const moveStartPointRef = useRef<Point | null>(null);
    const floatingSelectionImgRef = useRef<{
      dataUrl: string;
      img: HTMLImageElement | null;
      origRect: RectBounds;
      offsetX: number;
      offsetY: number;
    } | null>(null);
    const clipboardRasterRef = useRef<{ dataUrl: string; width: number; height: number } | null>(null);

    // Inline Text Tool state
    const [activeTextBox, setActiveTextBox] = useState<{
      x: number;
      y: number;
      text: string;
    } | null>(null);
    const textInputRef = useRef<HTMLTextAreaElement>(null);

    // Curve multi-step & Polygon multi-vertex state
    const curveStageRef = useRef<{
      stroke: Stroke;
      clicksLeft: number;
    } | null>(null);
    const polygonDraftRef = useRef<Stroke | null>(null);

    // Canvas Edge Handle Resize preview state
    const [resizingPreview, setResizingPreview] = useState<{ width: number; height: number } | null>(null);

    // Interactive Pixel Rulers state (live tracking, scroll alignment & click/drag guides)
    const [hoverCursor, setHoverCursor] = useState<{ x: number; y: number } | null>(null);
    const [rulerHoverPreview, setRulerHoverPreview] = useState<{ axis: 'x' | 'y'; px: number } | null>(null);
    const [scrollOffset, setScrollOffset] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
    const [rulerGuides, setRulerGuides] = useState<{ vertical: number[]; horizontal: number[] }>({
      vertical: [],
      horizontal: [],
    });
    const topRulerRef = useRef<HTMLDivElement>(null);
    const leftRulerRef = useRef<HTMLDivElement>(null);
    const draggingGuideRef = useRef<{ axis: 'vertical' | 'horizontal'; index: number } | null>(null);

    // Template Tracing HUD state
    const [showTemplateGuide, setShowTemplateGuide] = useState<boolean>(true);
    const [showOpacitySlider, setShowOpacitySlider] = useState<boolean>(false);
    const [traceMode, setTraceMode] = useState<'outline' | 'grayscale' | 'color'>('outline');
    const [outlineDetailThreshold, setOutlineDetailThreshold] = useState<number>(38);
    const [processedTraceUrl, setProcessedTraceUrl] = useState<string | null>(null);
    const [isProcessingOutline, setIsProcessingOutline] = useState<boolean>(false);
    const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
    const [loadedTemplateImage, setLoadedTemplateImage] = useState<HTMLImageElement | null>(null);

    // Internal Zoom fallback & Symmetry state
    const [internalZoomLevel, setInternalZoomLevel] = useState<number>(1.0);
    const zoomLevel = zoomLevelProp ?? internalZoomLevel;
    const latestZoomRef = useRef<number>(zoomLevel);
    latestZoomRef.current = zoomLevel;

    const [internalSymmetryMode, setInternalSymmetryMode] = useState<MirrorMode>('none');
    const symmetryMode: MirrorMode = mirrorModeProp ?? internalSymmetryMode;
    const [symmetryAxisRatio, setSymmetryAxisRatio] = useState<{ x: number; y: number }>({
      x: 0.5,
      y: 0.5,
    });
    const [draggingSymmetryAxis, setDraggingSymmetryAxis] = useState<
      'vertical' | 'horizontal' | null
    >(null);
    const [isSymmetryLocked, setIsSymmetryLocked] = useState<boolean>(false);
    const symmetryAxisCenter = {
      x: Math.round(symmetryAxisRatio.x * canvasDimensions.width * 10) / 10,
      y: Math.round(symmetryAxisRatio.y * canvasDimensions.height * 10) / 10,
    };

    // Draggable Template HUD offset
    const [hudOffset, setHudOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDraggingHud, setIsDraggingHud] = useState<boolean>(false);
    const isDraggingHudRef = useRef<boolean>(false);
    const dragStartPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const opacityPopoverRef = useRef<HTMLDivElement>(null);
    const opacityButtonRef = useRef<HTMLButtonElement>(null);

    // Multi-touch Pinch-to-Zoom & 2-Finger Scroll Panning
    const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
    const suppressDrawingUntilAllUpRef = useRef<boolean>(false);
    const pinchStartDistRef = useRef<number>(0);
    const pinchStartZoomRef = useRef<number>(1.0);
    const pinchStartCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const pinchStartScrollRef = useRef<{ left: number; top: number }>({ left: 0, top: 0 });
    const isPinchingRef = useRef<boolean>(false);

    // Multi-layer normalized state
    const effectiveLayers = React.useMemo(
      () => (layersProp && layersProp.length > 0 ? layersProp : createInitialLayers()),
      [layersProp]
    );
    const effectiveActiveLayer = React.useMemo(
      () =>
        effectiveLayers.find((l) => l.id === activeLayerIdProp) ??
        effectiveLayers[effectiveLayers.length - 1],
      [effectiveLayers, activeLayerIdProp]
    );
    const effectiveActiveLayerId = effectiveActiveLayer.id;

    // Offscreen layers
    const strokesCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const baseCompositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const layerTempCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const belowLayersCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const activeLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const aboveLayersCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const setZoomLevel = useCallback(
      (nextOrUpdater: number | ((prev: number) => number)) => {
        const prevVal = latestZoomRef.current;
        const nextVal = typeof nextOrUpdater === 'function' ? nextOrUpdater(prevVal) : nextOrUpdater;
        const clamped = clampZoom(nextVal);
        latestZoomRef.current = clamped;
        if (onZoomChange) {
          onZoomChange(clamped);
        } else {
          setInternalZoomLevel(clamped);
        }
      },
      [onZoomChange]
    );

    const updateSymmetryMode = useCallback(
      (nextOrUpdater: MirrorMode | ((prev: MirrorMode) => MirrorMode)) => {
        const nextMode =
          typeof nextOrUpdater === 'function' ? nextOrUpdater(symmetryMode) : nextOrUpdater;
        if (onMirrorModeChange) {
          onMirrorModeChange(nextMode);
        } else {
          setInternalSymmetryMode(nextMode);
        }
      },
      [symmetryMode, onMirrorModeChange]
    );

    const handleToggleMirrorAxis = useCallback(
      (axis: 'horizontal' | 'vertical') => {
        const nextMode = toggleMirrorAxis(symmetryMode, axis);
        updateSymmetryMode(nextMode);
        onNotify?.(getMirrorModeStatusMessage(nextMode));
      },
      [symmetryMode, updateSymmetryMode, onNotify]
    );

    const handleSymmetryGuidePointerDown = useCallback(
      (axis: 'vertical' | 'horizontal', e: React.PointerEvent<HTMLDivElement>) => {
        if (isSymmetryLocked) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        setDraggingSymmetryAxis(axis);
      },
      [isSymmetryLocked]
    );

    const handleSymmetryGuidePointerMove = useCallback(
      (axis: 'vertical' | 'horizontal', e: React.PointerEvent<HTMLDivElement>) => {
        if (isSymmetryLocked || draggingSymmetryAxis !== axis || !canvasRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = canvasRef.current.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        if (axis === 'vertical') {
          const nextX = clampSymmetryAxisRatio((e.clientX - rect.left) / rect.width);
          setSymmetryAxisRatio((prev) => ({ ...prev, x: nextX }));
        } else {
          const nextY = clampSymmetryAxisRatio((e.clientY - rect.top) / rect.height);
          setSymmetryAxisRatio((prev) => ({ ...prev, y: nextY }));
        }
      },
      [draggingSymmetryAxis, isSymmetryLocked]
    );

    const handleSymmetryGuidePointerUp = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingSymmetryAxis) return;
        e.stopPropagation();
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {}
        setDraggingSymmetryAxis(null);
      },
      [draggingSymmetryAxis]
    );

    // Sync selection flags to parent Ribbon
    useEffect(() => {
      onHasSelectionChange?.(Boolean(selectionRect && selectionRect.width >= 2 && selectionRect.height >= 2));
      if (selectionRect && selectionRect.width >= 2 && selectionRect.height >= 2) {
        onSelectionSizeChange?.({ width: selectionRect.width, height: selectionRect.height });
      } else {
        onSelectionSizeChange?.(null);
      }
    }, [selectionRect, onHasSelectionChange, onSelectionSizeChange]);

    // Keep refs synced for ResizeObserver without tearing down observer on every stroke
    const canvasDimensionsRef = useRef(canvasDimensions);
    canvasDimensionsRef.current = canvasDimensions;
    const strokesCountRef = useRef(strokes.length);
    strokesCountRef.current = strokes.length;
    const onCanvasDimensionsChangeRef = useRef(onCanvasDimensionsChange);
    onCanvasDimensionsChangeRef.current = onCanvasDimensionsChange;

    // Expand canvas automatically to fill the entire workspace screen
    useEffect(() => {
      if (!isAutoFillScreen) return;
      const ws = workspaceRef.current;
      if (!ws) return;

      const syncToWorkspace = () => {
        const w = ws.clientWidth;
        const h = ws.clientHeight;
        if (w <= 0 || h <= 0) return;
        const current = canvasDimensionsRef.current;
        const next = calculateFullScreenCanvasDimensions(
          w,
          h,
          current,
          strokesCountRef.current > 0
        );
        if (next.width !== current.width || next.height !== current.height) {
          onCanvasDimensionsChangeRef.current(next);
        }
      };

      syncToWorkspace();

      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          syncToWorkspace();
        });
        observer.observe(ws);
        return () => observer.disconnect();
      }

      window.addEventListener('resize', syncToWorkspace);
      return () => window.removeEventListener('resize', syncToWorkspace);
    }, [isAutoFillScreen]);

    // Scroll back to top-left on resetViewSignal
    const prevResetSignalRef = useRef<number | undefined>(resetViewSignal);
    useEffect(() => {
      if (resetViewSignal !== undefined && resetViewSignal !== prevResetSignalRef.current) {
        prevResetSignalRef.current = resetViewSignal;
        if (workspaceRef.current) {
          workspaceRef.current.scrollTo({ left: 0, top: 0 });
        }
      }
    }, [resetViewSignal]);

    // Close opacity popover outside click
    useEffect(() => {
      if (!showOpacitySlider) return;
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          opacityPopoverRef.current &&
          !opacityPopoverRef.current.contains(target) &&
          opacityButtonRef.current &&
          !opacityButtonRef.current.contains(target)
        ) {
          setShowOpacitySlider(false);
        }
      };
      document.addEventListener('pointerdown', handleOutsideClick);
      return () => document.removeEventListener('pointerdown', handleOutsideClick);
    }, [showOpacitySlider]);

    // Sobel Edge Detection for uploaded photo stencils
    useEffect(() => {
      const isPredefinedOutline =
        activeTemplate?.mediaUrl?.includes('/assets/aistudio/') ||
        Boolean(activeTemplate?.collectionId);

      if (!activeTemplate || !activeTemplate.mediaUrl || activeTemplate.type === 'vector' || isPredefinedOutline) {
        setProcessedTraceUrl(null);
        setIsProcessingOutline(false);
        return;
      }

      let isSubscribed = true;
      setIsProcessingOutline(true);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        if (!isSubscribed) return;
        try {
          const traceUrl = generateOutlineTraceDataUrl(img, { threshold: outlineDetailThreshold });
          if (traceUrl && isSubscribed) setProcessedTraceUrl(traceUrl);
        } catch (err) {
          console.warn('Trace outline fallback:', err);
        } finally {
          if (isSubscribed) setIsProcessingOutline(false);
        }
      };
      img.onerror = () => {
        if (isSubscribed) {
          setProcessedTraceUrl(null);
          setIsProcessingOutline(false);
        }
      };
      img.src = activeTemplate.mediaUrl.startsWith('data:')
        ? activeTemplate.mediaUrl
        : encodeURI(decodeURI(activeTemplate.mediaUrl));

      return () => {
        isSubscribed = false;
      };
    }, [activeTemplate, outlineDetailThreshold]);

    // Preload active template image
    useEffect(() => {
      if (!activeTemplate || !activeTemplate.mediaUrl) {
        setLoadedTemplateImage(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => setLoadedTemplateImage(img);
      img.onerror = () => setLoadedTemplateImage(null);
      img.src = activeTemplate.mediaUrl.startsWith('data:')
        ? activeTemplate.mediaUrl
        : encodeURI(decodeURI(activeTemplate.mediaUrl));
    }, [activeTemplate]);

    const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      renderStrokeToContext(ctx, stroke, 'canvas');
    }, []);

    // Rebuild multi-layer composite whenever committed strokes, layers, or dimensions change
    const rebuildBaseComposite = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ensureBuffer = (refObj: React.MutableRefObject<HTMLCanvasElement | null>) => {
        if (!refObj.current) {
          refObj.current = document.createElement('canvas');
        }
        const buf = refObj.current;
        if (buf.width !== canvas.width || buf.height !== canvas.height) {
          buf.width = canvas.width;
          buf.height = canvas.height;
        }
        return buf;
      };

      const strokesCanvas = ensureBuffer(strokesCanvasRef);
      const strokesCtx = strokesCanvas.getContext('2d', { willReadFrequently: true });
      if (!strokesCtx) return;

      const layerTempCanvas = ensureBuffer(layerTempCanvasRef);
      const layerTempCtx = layerTempCanvas.getContext('2d', { willReadFrequently: true });
      const belowCanvas = ensureBuffer(belowLayersCanvasRef);
      const belowCtx = belowCanvas.getContext('2d', { willReadFrequently: true });
      const activeCanvas = ensureBuffer(activeLayerCanvasRef);
      const activeCtx = activeCanvas.getContext('2d', { willReadFrequently: true });
      const aboveCanvas = ensureBuffer(aboveLayersCanvasRef);
      const aboveCtx = aboveCanvas.getContext('2d', { willReadFrequently: true });

      // Ensure any raster patch images trigger a clean repaint once decoded
      for (const stroke of strokes) {
        if ((stroke.operation === 'paste-image' || stroke.operation === 'replace-bitmap') && stroke.rasterDataUrl) {
          preloadStrokeRasterImage(stroke.rasterDataUrl, () => {
            requestAnimationFrame(() => rebuildBaseComposite());
          });
        }
      }

      const resetBuf = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, w, h);
      };

      resetBuf(strokesCtx, canvas.width, canvas.height);
      if (belowCtx) resetBuf(belowCtx, canvas.width, canvas.height);
      if (activeCtx) resetBuf(activeCtx, canvas.width, canvas.height);
      if (aboveCtx) resetBuf(aboveCtx, canvas.width, canvas.height);

      const strokesByLayer = groupStrokesByLayer(strokes, effectiveLayers);
      const activeIdx = effectiveLayers.findIndex((l) => l.id === effectiveActiveLayerId);
      let anyVisibleInk = false;

      for (let i = 0; i < effectiveLayers.length; i++) {
        const layer = effectiveLayers[i];
        if (!layer.visible) continue;
        const layerStrokes = strokesByLayer.get(layer.id) || [];

        if (layerTempCtx) {
          resetBuf(layerTempCtx, canvas.width, canvas.height);
          for (const stroke of layerStrokes) {
            drawStroke(layerTempCtx, stroke);
          }

          if (layerStrokes.length > 0) {
            anyVisibleInk = true;
            strokesCtx.save();
            strokesCtx.globalAlpha = layer.opacity;
            strokesCtx.globalCompositeOperation = 'source-over';
            strokesCtx.drawImage(layerTempCanvas, 0, 0);
            strokesCtx.restore();
          }

          if (i === activeIdx && activeCtx) {
            activeCtx.drawImage(layerTempCanvas, 0, 0);
          } else if (i < activeIdx && belowCtx && layerStrokes.length > 0) {
            belowCtx.save();
            belowCtx.globalAlpha = layer.opacity;
            belowCtx.globalCompositeOperation = 'source-over';
            belowCtx.drawImage(layerTempCanvas, 0, 0);
            belowCtx.restore();
          } else if (i > activeIdx && aboveCtx && layerStrokes.length > 0) {
            aboveCtx.save();
            aboveCtx.globalAlpha = layer.opacity;
            aboveCtx.globalCompositeOperation = 'source-over';
            aboveCtx.drawImage(layerTempCanvas, 0, 0);
            aboveCtx.restore();
          }
        }
      }

      const baseCanvas = ensureBuffer(baseCompositeCanvasRef);
      const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
      if (!baseCtx) return;

      baseCtx.setTransform(1, 0, 0, 1, 0, 0);
      baseCtx.globalAlpha = 1;
      baseCtx.globalCompositeOperation = 'source-over';
      baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
      baseCtx.fillStyle = '#FFFFFF';
      baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);

      if (activeTemplate && showTemplateGuide && loadedTemplateImage) {
        const imgW = loadedTemplateImage.naturalWidth || loadedTemplateImage.width || baseCanvas.width;
        const imgH = loadedTemplateImage.naturalHeight || loadedTemplateImage.height || baseCanvas.height;
        const drawRect = getContainDrawRect(imgW, imgH, baseCanvas.width, baseCanvas.height);
        baseCtx.save();
        baseCtx.globalAlpha = Math.max(0.35, templateOpacity);
        baseCtx.drawImage(loadedTemplateImage, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
        baseCtx.restore();
      }

      if (anyVisibleInk) {
        baseCtx.save();
        baseCtx.globalCompositeOperation = 'source-over';
        baseCtx.drawImage(strokesCanvas, 0, 0);
        baseCtx.restore();
      }

      if (activeTemplate && showTemplateGuide && loadedTemplateImage) {
        const imgW = loadedTemplateImage.naturalWidth || loadedTemplateImage.width || baseCanvas.width;
        const imgH = loadedTemplateImage.naturalHeight || loadedTemplateImage.height || baseCanvas.height;
        const drawRect = getContainDrawRect(imgW, imgH, baseCanvas.width, baseCanvas.height);
        baseCtx.save();
        baseCtx.globalCompositeOperation = 'multiply';
        baseCtx.globalAlpha = Math.min(1.0, templateOpacity * 1.25);
        baseCtx.drawImage(loadedTemplateImage, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
        baseCtx.restore();
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        if (!anyVisibleInk && !(activeTemplate && showTemplateGuide && loadedTemplateImage)) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(baseCanvas, 0, 0);
        }
        ctx.restore();
      }
    }, [
      strokes,
      effectiveLayers,
      effectiveActiveLayerId,
      activeTemplate,
      showTemplateGuide,
      loadedTemplateImage,
      templateOpacity,
      canvasDimensions,
      drawStroke,
    ]);

    useEffect(() => {
      rebuildBaseComposite();
    }, [strokes, effectiveLayers, effectiveActiveLayerId, canvasDimensions, rebuildBaseComposite]);

    // Real-time active stroke preview (with live jitter smoothing, live Symmetry, and accurate Layer z-order!)
    const renderActiveStroke = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const baseCanvas = baseCompositeCanvasRef.current;
      const currentStroke = currentStrokeRef.current;
      const floating = floatingSelectionImgRef.current;

      if (!currentStroke && !floating) {
        if (baseCanvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(baseCanvas, 0, 0);
        }
        return;
      }

      if (floating && baseCanvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(baseCanvas, 0, 0);
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(floating.origRect.x, floating.origRect.y, floating.origRect.width, floating.origRect.height);
        if (floating.img && floating.img.complete) {
          ctx.drawImage(
            floating.img,
            floating.origRect.x + floating.offsetX,
            floating.origRect.y + floating.offsetY,
            floating.origRect.width,
            floating.origRect.height
          );
        }
        ctx.restore();
        return;
      }

      if (!currentStroke) return;

      // Apply live smoothing scaled by Stabilization intensity on freehand strokes
      const stabilizerCfg = getStabilizerConfig(stabilization);
      const previewStroke: Stroke =
        currentStroke.tool !== 'shape' &&
        currentStroke.tool !== 'stamp' &&
        currentStroke.tool !== 'text' &&
        currentStroke.tool !== 'select' &&
        stabilizerCfg.previewPasses > 0 &&
        currentStroke.points.length >= 4
          ? {
              ...currentStroke,
              points: smoothStrokePoints(currentStroke.points, {
                passes: stabilizerCfg.previewPasses,
                subdivide: false,
              }),
            }
          : currentStroke;

      const activeStrokes = createMirroredStrokes(
        previewStroke,
        symmetryMode,
        canvas.width,
        canvas.height,
        {
          x: Math.round(symmetryAxisRatio.x * canvas.width * 10) / 10,
          y: Math.round(symmetryAxisRatio.y * canvas.height * 10) / 10,
        }
      );

      // Composite active layer isolated in its temp buffer so Eraser never cuts layers beneath or above
      const layerTemp = layerTempCanvasRef.current;
      const activeBuf = activeLayerCanvasRef.current;
      const belowBuf = belowLayersCanvasRef.current;
      const aboveBuf = aboveLayersCanvasRef.current;

      if (layerTemp && activeBuf && belowBuf && aboveBuf) {
        const ltCtx = layerTemp.getContext('2d', { willReadFrequently: true });
        if (ltCtx) {
          ltCtx.setTransform(1, 0, 0, 1, 0, 0);
          ltCtx.globalAlpha = 1;
          ltCtx.globalCompositeOperation = 'source-over';
          ltCtx.clearRect(0, 0, layerTemp.width, layerTemp.height);
          ltCtx.drawImage(activeBuf, 0, 0);
          for (const strokeVariant of activeStrokes) {
            drawStroke(ltCtx, strokeVariant);
          }
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (activeTemplate && showTemplateGuide && loadedTemplateImage) {
          const imgW = loadedTemplateImage.naturalWidth || loadedTemplateImage.width || canvas.width;
          const imgH = loadedTemplateImage.naturalHeight || loadedTemplateImage.height || canvas.height;
          const drawRect = getContainDrawRect(imgW, imgH, canvas.width, canvas.height);
          ctx.save();
          ctx.globalAlpha = Math.max(0.35, templateOpacity);
          ctx.drawImage(loadedTemplateImage, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
          ctx.restore();
        }

        ctx.drawImage(belowBuf, 0, 0);
        if (effectiveActiveLayer.visible) {
          ctx.save();
          ctx.globalAlpha = effectiveActiveLayer.opacity;
          ctx.drawImage(layerTemp, 0, 0);
          ctx.restore();
        }
        ctx.drawImage(aboveBuf, 0, 0);

        if (activeTemplate && showTemplateGuide && loadedTemplateImage) {
          const imgW = loadedTemplateImage.naturalWidth || loadedTemplateImage.width || canvas.width;
          const imgH = loadedTemplateImage.naturalHeight || loadedTemplateImage.height || canvas.height;
          const drawRect = getContainDrawRect(imgW, imgH, canvas.width, canvas.height);
          ctx.save();
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = Math.min(1.0, templateOpacity * 1.25);
          ctx.drawImage(loadedTemplateImage, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
          ctx.restore();
        }
        return;
      }

      if (baseCanvas) {
        ctx.drawImage(baseCanvas, 0, 0);
      }
      for (const strokeVariant of activeStrokes) {
        drawStroke(ctx, strokeVariant);
      }
    }, [
      activeTemplate,
      showTemplateGuide,
      loadedTemplateImage,
      templateOpacity,
      symmetryMode,
      symmetryAxisRatio,
      stabilization,
      effectiveActiveLayer,
      drawStroke,
    ]);

    // Capture a raster dataUrl of the user canvas + white paper for selection/crop/rotate ops
    const captureCompositeRegion = useCallback(
      (rect?: RectBounds): string | null => {
        const strokesCanvas = strokesCanvasRef.current;
        const w = canvasDimensions.width;
        const h = canvasDimensions.height;
        const targetRect = rect || { x: 0, y: 0, width: w, height: h };

        if (targetRect.width < 1 || targetRect.height < 1) return null;

        const out = document.createElement('canvas');
        out.width = Math.round(targetRect.width);
        out.height = Math.round(targetRect.height);
        const octx = out.getContext('2d');
        if (!octx) return null;

        octx.fillStyle = '#FFFFFF';
        octx.fillRect(0, 0, out.width, out.height);
        if (strokesCanvas) {
          octx.drawImage(
            strokesCanvas,
            targetRect.x,
            targetRect.y,
            targetRect.width,
            targetRect.height,
            0,
            0,
            out.width,
            out.height
          );
        }
        return out.toDataURL('image/png');
      },
      [canvasDimensions]
    );

    const applyLayerPixelFilter = useCallback(
      (filter: LayerFilterType, options?: LayerFilterOptions) => {
        const width = canvasDimensions.width;
        const height = canvasDimensions.height;
        const activeLayerStrokes = strokes.filter(
          (s) => resolveStrokeLayerId(s, effectiveLayers) === effectiveActiveLayerId
        );

        if (activeLayerStrokes.length === 0 && (filter !== 'invert' || Boolean(activeTemplate))) {
          onNotify?.(`Draw something on ${effectiveActiveLayer.name} before applying a filter`);
          return;
        }

        const brightnessDelta =
          filter === 'brightness'
            ? clampBrightnessDelta(options?.brightnessDelta ?? 25)
            : undefined;
        if (filter === 'brightness' && brightnessDelta === 0) {
          onNotify?.('Move Brightness away from 0% before applying');
          return;
        }

        let sourceLayerCanvas = activeLayerCanvasRef.current;
        if (
          !sourceLayerCanvas ||
          !effectiveActiveLayer.visible ||
          sourceLayerCanvas.width !== width ||
          sourceLayerCanvas.height !== height
        ) {
          sourceLayerCanvas = document.createElement('canvas');
          sourceLayerCanvas.width = width;
          sourceLayerCanvas.height = height;
          const sctx = sourceLayerCanvas.getContext('2d', { willReadFrequently: true });
          if (sctx) {
            for (const s of activeLayerStrokes) {
              renderStrokeToContext(sctx, s, 'canvas');
            }
          }
        }

        const filteredCanvas = document.createElement('canvas');
        filteredCanvas.width = width;
        filteredCanvas.height = height;
        const fctx = filteredCanvas.getContext('2d', { willReadFrequently: true });
        if (!fctx) return;

        applyLayerFilterToContext(fctx, sourceLayerCanvas, width, height, filter, {
          opaquePaperBackground:
            filter === 'invert' && !activeTemplate && effectiveLayers[0]?.id === effectiveActiveLayerId,
          brightnessDelta,
        });

        const filteredDataUrl = filteredCanvas.toDataURL('image/png');
        const spec = getLayerFilterSpec(filter);
        const filterOp: Stroke = {
          id: `op_filter_${filter}_${Date.now()}`,
          layerId: effectiveActiveLayerId,
          tool: 'select',
          color: '#000000',
          size: 1,
          opacity: 1,
          points: [],
          operation: 'replace-bitmap',
          rect: { x: 0, y: 0, width, height },
          rasterDataUrl: filteredDataUrl,
        };

        const commitFiltered = () => {
          const otherLayerStrokes = strokes.filter(
            (s) => resolveStrokeLayerId(s, effectiveLayers) !== effectiveActiveLayerId
          );
          onStrokesChange([...otherLayerStrokes, filterOp]);
          const detail =
            filter === 'brightness' && brightnessDelta !== undefined
              ? ` (${brightnessDelta > 0 ? `+${brightnessDelta}` : brightnessDelta}%)`
              : '';
          onNotify?.(`Applied ${spec.label}${detail} filter to ${effectiveActiveLayer.name}`);
        };

        const preloaded = preloadStrokeRasterImage(filteredDataUrl, commitFiltered);
        if (preloaded && preloaded.complete && preloaded.naturalWidth > 0) {
          commitFiltered();
        }
      },
      [
        activeTemplate,
        canvasDimensions,
        effectiveActiveLayer,
        effectiveActiveLayerId,
        effectiveLayers,
        onNotify,
        onStrokesChange,
        strokes,
      ]
    );

    // Imperative Clipboard, Selection, Crop, and Flip actions called by PaintRibbon
    useImperativeHandle(
      ref,
      () => ({
        getCanPaste: () => Boolean(clipboardRasterRef.current),
        selectAll: () => {
          setSelectionRect({ x: 0, y: 0, width: canvasDimensions.width, height: canvasDimensions.height });
        },
        clearSelection: () => {
          setSelectionRect(null);
        },
        clearCanvas: () => {
          if (activeRafIdRef.current) {
            cancelAnimationFrame(activeRafIdRef.current);
            activeRafIdRef.current = null;
          }
          isDrawingRef.current = false;
          currentStrokeRef.current = null;
          rawPointerBufferRef.current = [];
          polygonDraftRef.current = null;
          curveStageRef.current = null;
          selectionDragStartRef.current = null;
          isMovingSelectionRef.current = false;
          floatingSelectionImgRef.current = null;
          setSelectionRect(null);
          setActiveTextBox(null);

          const canvas = canvasRef.current;
          const width = canvas?.width || canvasDimensions.width;
          const height = canvas?.height || canvasDimensions.height;

          if (strokesCanvasRef.current) {
            const sctx = strokesCanvasRef.current.getContext('2d', { willReadFrequently: true });
            if (sctx) {
              sctx.save();
              sctx.setTransform(1, 0, 0, 1, 0, 0);
              sctx.globalAlpha = 1;
              sctx.globalCompositeOperation = 'source-over';
              sctx.clearRect(0, 0, strokesCanvasRef.current.width, strokesCanvasRef.current.height);
              sctx.restore();
            }
          }
          if (baseCompositeCanvasRef.current) {
            const bctx = baseCompositeCanvasRef.current.getContext('2d', { willReadFrequently: true });
            if (bctx) {
              bctx.save();
              bctx.setTransform(1, 0, 0, 1, 0, 0);
              bctx.globalAlpha = 1;
              bctx.globalCompositeOperation = 'source-over';
              bctx.fillStyle = '#FFFFFF';
              bctx.fillRect(0, 0, baseCompositeCanvasRef.current.width, baseCompositeCanvasRef.current.height);
              bctx.restore();
            }
          }
          if (canvas) {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.save();
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.globalAlpha = 1;
              ctx.globalCompositeOperation = 'source-over';
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);
              ctx.restore();
            }
          }
        },
        deleteSelection: () => {
          if (!selectionRect) return;
          const eraseOp: Stroke = {
            id: `op_del_${Date.now()}`,
            tool: 'eraser',
            color: secondaryColor,
            fillColor: secondaryColor,
            size: 1,
            opacity: 1,
            points: [],
            operation: 'erase-rect',
            rect: { ...selectionRect },
          };
          onStrokesChange([...strokes, eraseOp]);
          setSelectionRect(null);
        },
        copySelection: async () => {
          const target =
            selectionRect && selectionRect.width >= 2 && selectionRect.height >= 2
              ? selectionRect
              : { x: 0, y: 0, width: canvasDimensions.width, height: canvasDimensions.height };
          const dataUrl = captureCompositeRegion(target);
          if (!dataUrl) return;
          clipboardRasterRef.current = {
            dataUrl,
            width: Math.round(target.width),
            height: Math.round(target.height),
          };
          preloadStrokeRasterImage(dataUrl);
          onClipboardChange?.(true);
          onNotify?.(
            selectionRect
              ? `Copied ${Math.round(target.width)}×${Math.round(target.height)}px selection`
              : 'Copied canvas image'
          );
        },
        cutSelection: () => {
          if (!selectionRect || selectionRect.width < 2 || selectionRect.height < 2) return;
          const dataUrl = captureCompositeRegion(selectionRect);
          if (!dataUrl) return;
          clipboardRasterRef.current = {
            dataUrl,
            width: Math.round(selectionRect.width),
            height: Math.round(selectionRect.height),
          };
          preloadStrokeRasterImage(dataUrl);
          onClipboardChange?.(true);
          const eraseOp: Stroke = {
            id: `op_cut_${Date.now()}`,
            tool: 'eraser',
            color: secondaryColor,
            fillColor: secondaryColor,
            size: 1,
            opacity: 1,
            points: [],
            operation: 'erase-rect',
            rect: { ...selectionRect },
          };
          onStrokesChange([...strokes, eraseOp]);
          setSelectionRect(null);
          onNotify?.('Cut selection to clipboard');
        },
        pasteClipboard: () => {
          const clip = clipboardRasterRef.current;
          if (!clip) {
            onNotify?.('Clipboard is empty — Copy a selection first');
            return;
          }
          const pasteRect: RectBounds = { x: 12, y: 12, width: clip.width, height: clip.height };
          preloadStrokeRasterImage(clip.dataUrl, () => rebuildBaseComposite());
          const pasteOp: Stroke = {
            id: `op_paste_${Date.now()}`,
            tool: 'select',
            color: '#000000',
            size: 1,
            opacity: 1,
            points: [],
            operation: 'paste-image',
            rect: pasteRect,
            rasterDataUrl: clip.dataUrl,
          };
          onStrokesChange([...strokes, pasteOp]);
          setSelectionRect(pasteRect);
          onNotify?.('Pasted from clipboard');
        },
        cropToSelection: () => {
          if (!selectionRect || selectionRect.width < 4 || selectionRect.height < 4) return;
          const dataUrl = captureCompositeRegion(selectionRect);
          if (!dataUrl) return;
          const nextW = Math.max(20, Math.round(selectionRect.width));
          const nextH = Math.max(20, Math.round(selectionRect.height));
          preloadStrokeRasterImage(dataUrl, () => rebuildBaseComposite());
          const cropOp: Stroke = {
            id: `op_crop_${Date.now()}`,
            tool: 'select',
            color: '#000000',
            size: 1,
            opacity: 1,
            points: [],
            operation: 'replace-bitmap',
            rect: { x: 0, y: 0, width: nextW, height: nextH },
            rasterDataUrl: dataUrl,
          };
          onManualCanvasResize?.();
          onCanvasDimensionsChange({ width: nextW, height: nextH });
          onStrokesChange([cropOp]);
          setSelectionRect(null);
          onNotify?.(`Cropped canvas to ${nextW}×${nextH}px`);
        },
        flipHorizontal: () => {
          const { strokes: flipped, requiresRasterFallback } = flipCanvasStrokes(
            strokes,
            'horizontal',
            canvasDimensions.width,
            canvasDimensions.height
          );
          if (!requiresRasterFallback) {
            onStrokesChange(flipped);
            onNotify?.('Flipped canvas horizontally');
            return;
          }
          const fullRect = { x: 0, y: 0, width: canvasDimensions.width, height: canvasDimensions.height };
          const srcUrl = captureCompositeRegion(fullRect);
          if (!srcUrl) return;
          const img = new Image();
          img.onload = () => {
            const tmp = document.createElement('canvas');
            tmp.width = img.width;
            tmp.height = img.height;
            const tctx = tmp.getContext('2d');
            if (!tctx) return;
            tctx.save();
            tctx.translate(img.width / 2, img.height / 2);
            tctx.scale(-1, 1);
            tctx.drawImage(img, -img.width / 2, -img.height / 2);
            tctx.restore();
            const flippedUrl = tmp.toDataURL('image/png');
            preloadStrokeRasterImage(flippedUrl, () => rebuildBaseComposite());
            const replaceWhole: Stroke = {
              id: `op_flip_h_${Date.now()}`,
              layerId: effectiveActiveLayerId,
              tool: 'select',
              color: '#000000',
              size: 1,
              opacity: 1,
              points: [],
              operation: 'replace-bitmap',
              rect: fullRect,
              rasterDataUrl: flippedUrl,
            };
            onStrokesChange([replaceWhole]);
            onNotify?.('Flipped canvas horizontally');
          };
          img.src = srcUrl;
        },
        flipVertical: () => {
          const { strokes: flipped, requiresRasterFallback } = flipCanvasStrokes(
            strokes,
            'vertical',
            canvasDimensions.width,
            canvasDimensions.height
          );
          if (!requiresRasterFallback) {
            onStrokesChange(flipped);
            onNotify?.('Flipped canvas vertically');
            return;
          }
          const fullRect = { x: 0, y: 0, width: canvasDimensions.width, height: canvasDimensions.height };
          const srcUrl = captureCompositeRegion(fullRect);
          if (!srcUrl) return;
          const img = new Image();
          img.onload = () => {
            const tmp = document.createElement('canvas');
            tmp.width = img.width;
            tmp.height = img.height;
            const tctx = tmp.getContext('2d');
            if (!tctx) return;
            tctx.save();
            tctx.translate(img.width / 2, img.height / 2);
            tctx.scale(1, -1);
            tctx.drawImage(img, -img.width / 2, -img.height / 2);
            tctx.restore();
            const flippedUrl = tmp.toDataURL('image/png');
            preloadStrokeRasterImage(flippedUrl, () => rebuildBaseComposite());
            const replaceWhole: Stroke = {
              id: `op_flip_v_${Date.now()}`,
              layerId: effectiveActiveLayerId,
              tool: 'select',
              color: '#000000',
              size: 1,
              opacity: 1,
              points: [],
              operation: 'replace-bitmap',
              rect: fullRect,
              rasterDataUrl: flippedUrl,
            };
            onStrokesChange([replaceWhole]);
            onNotify?.('Flipped canvas vertically');
          };
          img.src = srcUrl;
        },
        toggleMirrorAxis: (axis) => {
          handleToggleMirrorAxis(axis);
        },
        toggleMirrorHorizontal: () => {
          handleToggleMirrorAxis('horizontal');
        },
        toggleMirrorVertical: () => {
          handleToggleMirrorAxis('vertical');
        },
        applyFilter: (filter, options) => {
          applyLayerPixelFilter(filter, options);
        },
        applyGrayscaleFilter: () => {
          applyLayerPixelFilter('grayscale');
        },
        applySepiaFilter: () => {
          applyLayerPixelFilter('sepia');
        },
        applyBrightnessFilter: (delta = 25) => {
          applyLayerPixelFilter('brightness', { brightnessDelta: delta });
        },
        applyInvertFilter: () => {
          applyLayerPixelFilter('invert');
        },
        exportRaster: (format, quality = 0.92) => {
          const width = Math.max(1, canvasDimensions.width);
          const height = Math.max(1, canvasDimensions.height);
          const out = document.createElement('canvas');
          out.width = width;
          out.height = height;
          const octx = out.getContext('2d');
          if (!octx) return null;

          // Pure white paper base (essential for opaque JPG and crisp PNG)
          octx.fillStyle = '#FFFFFF';
          octx.fillRect(0, 0, width, height);
          if (strokesCanvasRef.current) {
            octx.drawImage(strokesCanvasRef.current, 0, 0);
          }

          return out.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', quality);
        },
      }),
      [
        activeTemplate,
        applyLayerPixelFilter,
        canvasDimensions,
        handleToggleMirrorAxis,
        selectionRect,
        strokes,
        effectiveLayers,
        effectiveActiveLayerId,
        secondaryColor,
        captureCompositeRegion,
        onStrokesChange,
        onCanvasDimensionsChange,
        onClipboardChange,
        onNotify,
        rebuildBaseComposite,
      ]
    );

    // Commit active inline Text annotation
    const commitTextAnnotation = useCallback(() => {
      if (!activeTextBox) return;
      const trimmed = activeTextBox.text.trimEnd();
      if (trimmed.length > 0) {
        const fontSize = Math.max(14, Math.round(size * 2.4));
        const textStroke: Stroke = {
          id: `stroke_txt_${Date.now()}`,
          layerId: effectiveActiveLayerId,
          tool: 'text',
          color,
          size,
          opacity,
          points: [{ x: activeTextBox.x, y: activeTextBox.y }],
          text: trimmed,
          fontSize,
          fontFamily: '"Segoe UI", Arial, sans-serif',
        };
        onStrokesChange([...strokes, textStroke]);
      }
      setActiveTextBox(null);
    }, [activeTextBox, color, size, opacity, strokes, effectiveActiveLayerId, onStrokesChange]);

    // Auto-commit pending text or polygon when switching tools
    useEffect(() => {
      if (tool !== 'text' && activeTextBox) {
        commitTextAnnotation();
      }
      if ((tool !== 'shape' || shapeType !== 'polygon') && polygonDraftRef.current) {
        if (polygonDraftRef.current.points.length >= 2) {
          onStrokesChange([...strokes, polygonDraftRef.current]);
        }
        polygonDraftRef.current = null;
        currentStrokeRef.current = null;
        rebuildBaseComposite();
      }
      if ((tool !== 'shape' || shapeType !== 'curve') && curveStageRef.current) {
        onStrokesChange([...strokes, curveStageRef.current.stroke]);
        curveStageRef.current = null;
        currentStrokeRef.current = null;
      }
      if (tool !== 'select' && selectionRect) {
        // Keep selectionRect until cleared or switched only if desired; Windows Paint clears selection on drawing tool pick
        setSelectionRect(null);
      }
    }, [tool, shapeType]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cancel active stroke when 2nd touch enters for pinch/pan
    const cancelActiveStrokeForGesture = useCallback(() => {
      if (isDrawingRef.current) {
        if (activeRafIdRef.current) {
          cancelAnimationFrame(activeRafIdRef.current);
          activeRafIdRef.current = null;
        }
        isDrawingRef.current = false;
        currentStrokeRef.current = null;
        rawPointerBufferRef.current = [];
        canvasRectRef.current = null;
        const canvas = canvasRef.current;
        const base = baseCompositeCanvasRef.current;
        if (canvas && base) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(base, 0, 0);
          }
        }
      }
    }, []);

    // Multi-touch Pinch-to-Zoom & 2-Finger Scroll Panning on workspace
    const beginPinchAnchor = useCallback(
      (p1: { clientX: number; clientY: number }, p2: { clientX: number; clientY: number }) => {
        const { distance, center } = getPointerPairMetrics(p1, p2);
        isPinchingRef.current = true;
        suppressDrawingUntilAllUpRef.current = true;
        pinchStartDistRef.current = distance > 0 ? distance : 1;
        pinchStartZoomRef.current = latestZoomRef.current;
        pinchStartCenterRef.current = center;
        pinchStartScrollRef.current = {
          left: workspaceRef.current?.scrollLeft ?? 0,
          top: workspaceRef.current?.scrollTop ?? 0,
        };
      },
      []
    );

    const applyPinchPair = useCallback(
      (p1: { clientX: number; clientY: number }, p2: { clientX: number; clientY: number }) => {
        const ws = workspaceRef.current;
        if (!ws) return;
        const rect = ws.getBoundingClientRect();
        const { distance, center } = getPointerPairMetrics(p1, p2);
        const { zoomLevel: nextZoom } = calculatePinchZoomAndPan({
          startDistance: pinchStartDistRef.current,
          currentDistance: distance,
          startZoom: pinchStartZoomRef.current,
          startPan: { x: 0, y: 0 },
          startCenter: pinchStartCenterRef.current,
          currentCenter: center,
          viewportCenter: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          containerWidth: rect.width,
          containerHeight: rect.height,
        });
        setZoomLevel(nextZoom);
        const dx = center.x - pinchStartCenterRef.current.x;
        const dy = center.y - pinchStartCenterRef.current.y;
        ws.scrollLeft = Math.max(0, pinchStartScrollRef.current.left - dx);
        ws.scrollTop = Math.max(0, pinchStartScrollRef.current.top - dy);
      },
      [setZoomLevel]
    );

    const handleWorkspacePointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-canvas-hud="true"]')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      if (activePointersRef.current.size >= 2) {
        cancelActiveStrokeForGesture();
        const [p1, p2] = Array.from(activePointersRef.current.values());
        beginPinchAnchor(p1, p2);
      }
    };

    const handleWorkspacePointerMoveCapture = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!activePointersRef.current.has(e.pointerId)) return;
      activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      if (isPinchingRef.current && activePointersRef.current.size >= 2) {
        const [p1, p2] = Array.from(activePointersRef.current.values());
        applyPinchPair(p1, p2);
      }
    };

    const handleWorkspacePointerEndCapture = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!activePointersRef.current.has(e.pointerId)) return;
      activePointersRef.current.delete(e.pointerId);
      if (activePointersRef.current.size >= 2) {
        const [p1, p2] = Array.from(activePointersRef.current.values());
        beginPinchAnchor(p1, p2);
      } else if (activePointersRef.current.size === 1) {
        if (isPinchingRef.current) isPinchingRef.current = false;
      } else {
        isPinchingRef.current = false;
        suppressDrawingUntilAllUpRef.current = false;
      }
    };

    // Wheel Ctrl+Scroll zoom support
    useEffect(() => {
      const ws = workspaceRef.current;
      if (!ws) return;

      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const rect = ws.getBoundingClientRect();
          const delta = e.deltaY < 0 ? 0.12 : -0.12;
          const { zoomLevel: nextZoom } = calculateWheelZoomAndPan({
            currentZoom: latestZoomRef.current,
            currentPan: { x: 0, y: 0 },
            zoomDelta: delta,
            cursor: { x: e.clientX, y: e.clientY },
            viewportCenter: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
            containerWidth: rect.width,
            containerHeight: rect.height,
          });
          setZoomLevel(nextZoom);
        }
      };

      const handleNativeTouchStart = (e: TouchEvent) => {
        if ((e.target as HTMLElement)?.closest('[data-canvas-hud="true"]')) return;
        if (e.touches.length >= 2) {
          e.preventDefault();
          cancelActiveStrokeForGesture();
          if (!isPinchingRef.current) beginPinchAnchor(e.touches[0], e.touches[1]);
        }
      };

      const handleNativeTouchMove = (e: TouchEvent) => {
        if (e.touches.length >= 2) {
          e.preventDefault();
          if (!isPinchingRef.current) {
            cancelActiveStrokeForGesture();
            beginPinchAnchor(e.touches[0], e.touches[1]);
          } else if (activePointersRef.current.size < 2) {
            applyPinchPair(e.touches[0], e.touches[1]);
          }
        }
      };

      const handleNativeTouchEnd = (e: TouchEvent) => {
        if (e.touches.length === 0) {
          isPinchingRef.current = false;
          suppressDrawingUntilAllUpRef.current = false;
          activePointersRef.current.clear();
        }
      };

      ws.addEventListener('wheel', handleWheel, { passive: false });
      ws.addEventListener('touchstart', handleNativeTouchStart, { passive: false });
      ws.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
      ws.addEventListener('touchend', handleNativeTouchEnd, { passive: true });
      ws.addEventListener('touchcancel', handleNativeTouchEnd, { passive: true });

      return () => {
        ws.removeEventListener('wheel', handleWheel);
        ws.removeEventListener('touchstart', handleNativeTouchStart);
        ws.removeEventListener('touchmove', handleNativeTouchMove);
        ws.removeEventListener('touchend', handleNativeTouchEnd);
        ws.removeEventListener('touchcancel', handleNativeTouchEnd);
      };
    }, [applyPinchPair, beginPinchAnchor, cancelActiveStrokeForGesture, setZoomLevel]);

    // Interactive Canvas Edge Resize Handles (Right edge, Bottom edge, Corner)
    const startSheetResize = (
      mode: 'right' | 'bottom' | 'corner',
      e: React.PointerEvent<HTMLDivElement>
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = canvasDimensions.width;
      const startH = canvasDimensions.height;
      const z = Math.max(0.25, zoomLevel);

      let latestW = startW;
      let latestH = startH;

      const onMove = (ev: PointerEvent) => {
        const dx = Math.round((ev.clientX - startX) / z);
        const dy = Math.round((ev.clientY - startY) / z);
        latestW = mode === 'right' || mode === 'corner' ? Math.max(100, Math.min(4096, startW + dx)) : startW;
        latestH = mode === 'bottom' || mode === 'corner' ? Math.max(100, Math.min(4096, startH + dy)) : startH;
        setResizingPreview({ width: latestW, height: latestH });
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setResizingPreview(null);
        if (latestW !== startW || latestH !== startH) {
          onManualCanvasResize?.();
          onCanvasDimensionsChange({ width: latestW, height: latestH });
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    // Main Canvas Pointer Handlers
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isPinchingRef.current || suppressDrawingUntilAllUpRef.current || activePointersRef.current.size > 1) return;
      if (!e.isPrimary && e.pointerType === 'touch') return;
      e.preventDefault();

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvasRectRef.current = rect;

      const pt = getCanvasCoordinates(
        e.clientX,
        e.clientY,
        rect,
        canvasDimensions.width,
        canvasDimensions.height
      );
      const isRightClick = e.button === 2;
      const activeStrokeColor = isRightClick ? secondaryColor : color;
      const activeShapeFillColor = isRightClick ? color : secondaryColor;

      // Notify parent App (auto-hides unpinned Ribbon cleanly)
      onCanvasStrokeStart?.();

      // 1. MAGNIFIER TOOL
      if (tool === 'magnifier') {
        if (isRightClick || e.altKey) {
          setZoomLevel((z) => Math.max(0.25, Math.round((z - 0.25) * 100) / 100));
        } else {
          setZoomLevel((z) => Math.min(4.0, Math.round((z + 0.25) * 100) / 100));
        }
        return;
      }

      // 2. COLOR PICKER (EYEDROPPER) TOOL
      if (tool === 'picker') {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(pt.x)));
          const py = Math.max(0, Math.min(canvas.height - 1, Math.floor(pt.y)));
          const data = ctx.getImageData(px, py, 1, 1).data;
          const sampledHex = rgbToHex(data[0], data[1], data[2]);
          if (isRightClick) {
            onSecondaryColorChange?.(sampledHex);
            onNotify?.(`Color 2 set to ${sampledHex}`);
          } else {
            onColorChange?.(sampledHex);
            onNotify?.(`Color 1 set to ${sampledHex}`);
          }
          onPickedColorComplete?.();
        }
        return;
      }

      // Guard against drawing directly onto a hidden layer (picker/magnifier already returned above; allow select)
      if (!effectiveActiveLayer.visible && tool !== 'select') {
        onNotify?.(`"${effectiveActiveLayer.name}" is hidden — toggle its eye icon to draw`);
        return;
      }

      // 3. TEXT TOOL
      if (tool === 'text') {
        if (activeTextBox) {
          commitTextAnnotation();
        }
        setActiveTextBox({
          x: Math.round(pt.x),
          y: Math.round(pt.y),
          text: '',
        });
        setTimeout(() => textInputRef.current?.focus(), 20);
        return;
      }

      // 4. SELECTION TOOL
      if (tool === 'select') {
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {}

        // If user clicked INSIDE an existing selection box -> lift & drag-move selection!
        if (
          selectionRect &&
          selectionRect.width >= 4 &&
          selectionRect.height >= 4 &&
          pt.x >= selectionRect.x &&
          pt.x <= selectionRect.x + selectionRect.width &&
          pt.y >= selectionRect.y &&
          pt.y <= selectionRect.y + selectionRect.height
        ) {
          const captured = captureCompositeRegion(selectionRect);
          if (captured) {
            const img = new Image();
            img.src = captured;
            floatingSelectionImgRef.current = {
              dataUrl: captured,
              img,
              origRect: { ...selectionRect },
              offsetX: 0,
              offsetY: 0,
            };
            isMovingSelectionRef.current = true;
            moveOriginRectRef.current = { ...selectionRect };
            moveStartPointRef.current = pt;
            isDrawingRef.current = true;
            return;
          }
        }

        // Start drawing a fresh selection rectangle
        setSelectionRect({ x: pt.x, y: pt.y, width: 0, height: 0 });
        selectionDragStartRef.current = pt;
        isMovingSelectionRef.current = false;
        isDrawingRef.current = true;
        return;
      }

      // 5. PAINT BUCKET FLOOD FILL
      if (tool === 'bucket') {
        const fillStroke: Stroke = {
          ...createStroke(
            'bucket',
            activeStrokeColor,
            size,
            opacity,
            pt,
            colorEnd || undefined,
            paintFinish
          ),
          tolerance: clampBucketTolerance(bucketTolerance),
          layerId: effectiveActiveLayerId,
        };
        const fillStrokes = createMirroredStrokes(
          fillStroke,
          symmetryMode,
          canvasDimensions.width,
          canvasDimensions.height,
          symmetryAxisCenter
        );
        onStrokesChange([...strokes, ...fillStrokes]);
        return;
      }

      // 6. SHAPE TOOL (Curve, Polygon, and standard click-and-drag Shapes)
      if (tool === 'shape') {
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {}

        // 6a. Multi-stage Curve tool
        if (shapeType === 'curve' && curveStageRef.current) {
          const stage = curveStageRef.current;
          if (stage.clicksLeft === 2) {
            stage.stroke.points[2] = pt;
            stage.stroke.points[3] = pt;
          } else {
            stage.stroke.points[3] = pt;
          }
          currentStrokeRef.current = stage.stroke;
          isDrawingRef.current = true;
          renderActiveStroke();
          return;
        }

        // 6b. Multi-vertex Polygon tool
        if (shapeType === 'polygon') {
          if (!polygonDraftRef.current) {
            polygonDraftRef.current = {
              id: `stroke_poly_${Date.now()}`,
              layerId: effectiveActiveLayerId,
              tool: 'shape',
              shapeType: 'polygon',
              outlineStyle,
              fillStyle,
              color: activeStrokeColor,
              fillColor: activeShapeFillColor,
              size,
              opacity,
              points: [pt, pt],
            };
          } else {
            const firstPt = polygonDraftRef.current.points[0];
            if (polygonDraftRef.current.points.length >= 3 && Math.hypot(pt.x - firstPt.x, pt.y - firstPt.y) <= 12) {
              // Snap closed polygon and commit!
              const finalized = {
                ...polygonDraftRef.current,
                points: polygonDraftRef.current.points.slice(0, -1),
              };
              const finalStrokes = createMirroredStrokes(
                finalized,
                symmetryMode,
                canvasDimensions.width,
                canvasDimensions.height,
                symmetryAxisCenter
              );
              polygonDraftRef.current = null;
              currentStrokeRef.current = null;
              onStrokesChange([...strokes, ...finalStrokes]);
              return;
            }
            polygonDraftRef.current.points.push(pt);
          }
          currentStrokeRef.current = polygonDraftRef.current;
          isDrawingRef.current = true;
          renderActiveStroke();
          return;
        }

        // 6c. Standard click-and-drag shape
        const newShapeStroke: Stroke = {
          id: `stroke_shp_${Date.now()}`,
          layerId: effectiveActiveLayerId,
          tool: 'shape',
          shapeType,
          outlineStyle,
          fillStyle,
          color: activeStrokeColor,
          fillColor: activeShapeFillColor,
          size,
          opacity,
          points: [pt, pt],
        };
        currentStrokeRef.current = newShapeStroke;
        isDrawingRef.current = true;
        renderActiveStroke();
        return;
      }

      // 7. FREEHAND BRUSH / PENCIL / PEN / ERASER with Real-Time Stroke Stabilization!
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}

      const pressure = resolvePointerEventPressure(e.nativeEvent, {
        enabled: pressureSensitive,
      });
      const firstPt: Point = { ...pt, pressure };
      rawPointerBufferRef.current = [firstPt];
      const strokeGradientEnd =
        tool !== 'eraser' && tool !== 'blur'
          ? resolveStrokeGradientEnd(activeStrokeColor, activeShapeFillColor, {
              isGradientBrush,
              explicitColorEnd: colorEnd,
            })
          : undefined;
      const newStroke: Stroke = {
        ...createStroke(
          tool,
          activeStrokeColor,
          size,
          opacity,
          firstPt,
          strokeGradientEnd,
          paintFinish
        ),
        ...(tool === 'stamp' ? { stampShape } : {}),
        layerId: effectiveActiveLayerId,
      };
      currentStrokeRef.current = newStroke;
      isDrawingRef.current = true;
      renderActiveStroke();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvasRectRef.current || canvas.getBoundingClientRect();
      const hoverPt = getCanvasCoordinates(
        e.clientX,
        e.clientY,
        rect,
        canvasDimensions.width,
        canvasDimensions.height
      );
      onCursorPositionChange?.({ x: hoverPt.x, y: hoverPt.y });
      setHoverCursor({ x: hoverPt.x, y: hoverPt.y });

      if (isPinchingRef.current || suppressDrawingUntilAllUpRef.current || activePointersRef.current.size > 1) return;
      if (!isDrawingRef.current) return;
      e.preventDefault();

      // Dragging or creating Selection
      if (tool === 'select') {
        if (isMovingSelectionRef.current && floatingSelectionImgRef.current && moveStartPointRef.current && moveOriginRectRef.current) {
          const dx = Math.round(hoverPt.x - moveStartPointRef.current.x);
          const dy = Math.round(hoverPt.y - moveStartPointRef.current.y);
          floatingSelectionImgRef.current.offsetX = dx;
          floatingSelectionImgRef.current.offsetY = dy;
          setSelectionRect({
            x: moveOriginRectRef.current.x + dx,
            y: moveOriginRectRef.current.y + dy,
            width: moveOriginRectRef.current.width,
            height: moveOriginRectRef.current.height,
          });
          renderActiveStroke();
        } else if (selectionDragStartRef.current) {
          const sx = selectionDragStartRef.current.x;
          const sy = selectionDragStartRef.current.y;
          setSelectionRect({
            x: Math.round(Math.min(sx, hoverPt.x)),
            y: Math.round(Math.min(sy, hoverPt.y)),
            width: Math.round(Math.abs(hoverPt.x - sx)),
            height: Math.round(Math.abs(hoverPt.y - sy)),
          });
        }
        return;
      }

      if (!currentStrokeRef.current) return;

      // Dragging Shape
      if (tool === 'shape') {
        const st = currentStrokeRef.current;
        if (curveStageRef.current && st.shapeType === 'curve') {
          if (curveStageRef.current.clicksLeft === 2) {
            st.points[2] = hoverPt;
            st.points[3] = hoverPt;
          } else {
            st.points[3] = hoverPt;
          }
        } else {
          st.points[st.points.length - 1] = hoverPt;
          const p0 = st.points[0];
          onSelectionSizeChange?.({
            width: Math.round(Math.abs(hoverPt.x - p0.x)),
            height: Math.round(Math.abs(hoverPt.y - p0.y)),
          });
        }

        if (!activeRafIdRef.current) {
          activeRafIdRef.current = requestAnimationFrame(() => {
            activeRafIdRef.current = null;
            renderActiveStroke();
          });
        }
        return;
      }

      // Freehand tools: High-precision coalesced points fed through live EMA Jitter Stabilizer
      canvasRectRef.current = rect;
      const coalesced = (e.nativeEvent as PointerEvent).getCoalescedEvents?.();
      const rawEvents = coalesced && coalesced.length > 0 ? coalesced : [e.nativeEvent];
      const points = currentStrokeRef.current.points;

      for (const ev of rawEvents) {
        const pt = getCanvasCoordinates(
          ev.clientX,
          ev.clientY,
          rect,
          canvasDimensions.width,
          canvasDimensions.height
        );
        const pressure = resolvePointerEventPressure(ev, {
          enabled: pressureSensitive,
        });
        const rawSample: Point = { ...pt, pressure };
        if (currentStrokeRef.current.tool === 'stamp') {
          const last = points[points.length - 1];
          if (!last || Math.hypot(rawSample.x - last.x, rawSample.y - last.y) >= 2) {
            points.push(rawSample);
          }
          continue;
        }
        rawPointerBufferRef.current.push(rawSample);
        if (rawPointerBufferRef.current.length > 24) {
          rawPointerBufferRef.current.shift();
        }
        const last = points[points.length - 1] ?? null;
        const stabilized = stabilizeCursorStream(
          rawPointerBufferRef.current,
          last,
          stabilization
        );
        if (stabilized) {
          points.push(stabilized);
        } else if (
          pressureSensitive &&
          last &&
          Math.abs((last.pressure ?? 0.5) - pressure) >= 0.06
        ) {
          // Stationary stylus press change: smoothly update pressure on active tip
          const prevP = last.pressure ?? 0.5;
          last.pressure = Math.round((prevP + (pressure - prevP) * 0.5) * 1000) / 1000;
        }
      }

      if (!activeRafIdRef.current) {
        activeRafIdRef.current = requestAnimationFrame(() => {
          activeRafIdRef.current = null;
          renderActiveStroke();
        });
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();

      if (activeRafIdRef.current) {
        cancelAnimationFrame(activeRafIdRef.current);
        activeRafIdRef.current = null;
      }

      try {
        const canvas = canvasRef.current;
        if (canvas && canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {}

      isDrawingRef.current = false;
      canvasRectRef.current = null;

      // Finish Selection draw or drag-move
      if (tool === 'select') {
        selectionDragStartRef.current = null;
        if (isMovingSelectionRef.current && floatingSelectionImgRef.current) {
          const fl = floatingSelectionImgRef.current;
          floatingSelectionImgRef.current = null;
          isMovingSelectionRef.current = false;
          if (fl.offsetX !== 0 || fl.offsetY !== 0) {
            const destRect: RectBounds = {
              x: fl.origRect.x + fl.offsetX,
              y: fl.origRect.y + fl.offsetY,
              width: fl.origRect.width,
              height: fl.origRect.height,
            };
            preloadStrokeRasterImage(fl.dataUrl, () => rebuildBaseComposite());
            const clearOrig: Stroke = {
              id: `op_mv_clr_${Date.now()}`,
              tool: 'eraser',
              color: secondaryColor,
              fillColor: secondaryColor,
              size: 1,
              opacity: 1,
              points: [],
              operation: 'erase-rect',
              rect: { ...fl.origRect },
            };
            const pasteDest: Stroke = {
              id: `op_mv_pst_${Date.now()}`,
              tool: 'select',
              color: '#000000',
              size: 1,
              opacity: 1,
              points: [],
              operation: 'paste-image',
              rect: destRect,
              rasterDataUrl: fl.dataUrl,
            };
            onStrokesChange([...strokes, clearOrig, pasteDest]);
          } else {
            rebuildBaseComposite();
          }
        } else if (selectionRect && (selectionRect.width < 3 || selectionRect.height < 3)) {
          setSelectionRect(null);
        }
        return;
      }

      const completedStroke = currentStrokeRef.current;
      if (!completedStroke || completedStroke.points.length === 0) {
        currentStrokeRef.current = null;
        rebuildBaseComposite();
        return;
      }

      // Curve 2-bend stage handling
      if (completedStroke.tool === 'shape' && completedStroke.shapeType === 'curve') {
        if (!curveStageRef.current) {
          curveStageRef.current = { stroke: completedStroke, clicksLeft: 2 };
          return;
        } else if (curveStageRef.current.clicksLeft === 2) {
          curveStageRef.current.clicksLeft = 1;
          return;
        } else {
          curveStageRef.current = null;
        }
      }

      // Polygon stays active across clicks until double-click or snapped closed
      if (completedStroke.tool === 'shape' && completedStroke.shapeType === 'polygon' && polygonDraftRef.current) {
        return;
      }

      // Append final pointer-up location when moved beyond last point so fast pen sweeps finish crisply
      if (completedStroke.tool !== 'shape' && completedStroke.tool !== 'text') {
        const canvas = canvasRef.current;
        if (canvas) {
          const upRect = canvas.getBoundingClientRect();
          const endPt = getCanvasCoordinates(
            e.clientX,
            e.clientY,
            upRect,
            canvasDimensions.width,
            canvasDimensions.height
          );
          const lastCommitted = completedStroke.points[completedStroke.points.length - 1];
          const releasePressure =
            pressureSensitive && doesPointerEventProvidePressure(e.nativeEvent)
              ? resolvePointerEventPressure(e.nativeEvent, { enabled: true })
              : lastCommitted?.pressure ?? 0.5;
          if (
            lastCommitted &&
            Math.hypot(endPt.x - lastCommitted.x, endPt.y - lastCommitted.y) >= 1.5
          ) {
            completedStroke.points.push({ ...endPt, pressure: releasePressure });
          }
        }
      }

      currentStrokeRef.current = null;
      rawPointerBufferRef.current = [];
      onSelectionSizeChange?.(null);

      // Final Multi-Pass Chaikin + Corner-Aware Stroke Smoothing scaled by Stabilization intensity
      const stabilizerCfg = getStabilizerConfig(stabilization);
      const finalPoints =
        completedStroke.tool === 'shape' ||
        completedStroke.tool === 'stamp' ||
        stabilizerCfg.finalPasses <= 0
          ? completedStroke.points
          : smoothStrokePoints(completedStroke.points, {
              passes: stabilizerCfg.finalPasses,
              subdivide: stabilizerCfg.subdivide,
            });

      const finalizedStroke: Stroke = {
        ...completedStroke,
        points: finalPoints,
      };

      const strokesToCommit = createMirroredStrokes(
        finalizedStroke,
        symmetryMode,
        canvasDimensions.width,
        canvasDimensions.height,
        symmetryAxisCenter
      );

      onStrokesChange([...strokes, ...strokesToCommit]);
    };

    const handleDoubleClick = () => {
      if (tool === 'shape' && shapeType === 'polygon' && polygonDraftRef.current) {
        const finalized = { ...polygonDraftRef.current };
        polygonDraftRef.current = null;
        currentStrokeRef.current = null;
        isDrawingRef.current = false;
        const commits = createMirroredStrokes(
          finalized,
          symmetryMode,
          canvasDimensions.width,
          canvasDimensions.height,
          symmetryAxisCenter
        );
        onStrokesChange([...strokes, ...commits]);
      }
    };

    // Draggable active template bar handlers
    const handleHudPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('button, input, [role="button"]')) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      isDraggingHudRef.current = true;
      setIsDraggingHud(true);
      dragStartPointerRef.current = { x: e.clientX, y: e.clientY };
      dragStartOffsetRef.current = { ...hudOffset };
    };

    const handleHudPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingHudRef.current) return;
      const dx = e.clientX - dragStartPointerRef.current.x;
      const dy = e.clientY - dragStartPointerRef.current.y;
      setHudOffset({ x: dragStartOffsetRef.current.x + dx, y: dragStartOffsetRef.current.y + dy });
    };

    const handleHudPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingHudRef.current) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      isDraggingHudRef.current = false;
      setIsDraggingHud(false);
    };

    const displayW = (resizingPreview?.width ?? canvasDimensions.width) * zoomLevel;
    const displayH = (resizingPreview?.height ?? canvasDimensions.height) * zoomLevel;

    // Interactive Ruler Tick Marks & Handlers
    const effectiveWidth = resizingPreview?.width ?? canvasDimensions.width;
    const effectiveHeight = resizingPreview?.height ?? canvasDimensions.height;
    const xTicks = showRulers ? generateRulerTicks(effectiveWidth, zoomLevel) : [];
    const yTicks = showRulers ? generateRulerTicks(effectiveHeight, zoomLevel) : [];

    const mapTopRulerX = (clientX: number) => {
      const el = topRulerRef.current;
      if (!el) return 0;
      return clientCoordToRulerCanvasPx(
        clientX,
        el.getBoundingClientRect().left,
        scrollOffset.left,
        zoomLevel,
        effectiveWidth,
        0
      );
    };

    const mapLeftRulerY = (clientY: number) => {
      const el = leftRulerRef.current;
      if (!el) return 0;
      return clientCoordToRulerCanvasPx(
        clientY,
        el.getBoundingClientRect().top,
        scrollOffset.top,
        zoomLevel,
        effectiveHeight,
        0
      );
    };

    const handleTopRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-ruler-guide-pin="true"]')) return;
      e.preventDefault();
      const px = mapTopRulerX(e.clientX);
      let guideIdx = -1;
      setRulerGuides((prev) => {
        const next = [...prev.vertical, px];
        guideIdx = next.length - 1;
        return { ...prev, vertical: next };
      });
      draggingGuideRef.current = { axis: 'vertical', index: guideIdx };
      setRulerHoverPreview({ axis: 'x', px });

      const onMove = (ev: PointerEvent) => {
        const nextPx = mapTopRulerX(ev.clientX);
        setRulerHoverPreview({ axis: 'x', px: nextPx });
        if (draggingGuideRef.current?.axis === 'vertical') {
          const idx = draggingGuideRef.current.index;
          setRulerGuides((prev) => {
            if (idx < 0 || idx >= prev.vertical.length) return prev;
            const copy = [...prev.vertical];
            copy[idx] = nextPx;
            return { ...prev, vertical: copy };
          });
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        draggingGuideRef.current = null;
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    const handleLeftRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-ruler-guide-pin="true"]')) return;
      e.preventDefault();
      const px = mapLeftRulerY(e.clientY);
      let guideIdx = -1;
      setRulerGuides((prev) => {
        const next = [...prev.horizontal, px];
        guideIdx = next.length - 1;
        return { ...prev, horizontal: next };
      });
      draggingGuideRef.current = { axis: 'horizontal', index: guideIdx };
      setRulerHoverPreview({ axis: 'y', px });

      const onMove = (ev: PointerEvent) => {
        const nextPx = mapLeftRulerY(ev.clientY);
        setRulerHoverPreview({ axis: 'y', px: nextPx });
        if (draggingGuideRef.current?.axis === 'horizontal') {
          const idx = draggingGuideRef.current.index;
          setRulerGuides((prev) => {
            if (idx < 0 || idx >= prev.horizontal.length) return prev;
            const copy = [...prev.horizontal];
            copy[idx] = nextPx;
            return { ...prev, horizontal: copy };
          });
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        draggingGuideRef.current = null;
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    const getCanvasCursor = () => {
      if (tool === 'text') return 'text';
      if (tool === 'picker') return 'crosshair';
      if (tool === 'magnifier') return 'zoom-in';
      if (tool === 'select' || tool === 'shape') return 'crosshair';
      return 'crosshair';
    };

    return (
      <div className="flex-1 min-h-0 flex flex-col bg-[#C9D2E3] relative overflow-hidden">
        {/* Floating Tracing HUD (Visible ONLY when a Paint Book template is active) */}
        {activeTemplate && (
          <div data-canvas-hud="true" className="absolute top-2.5 right-6 z-30 flex items-center pointer-events-none">
            <div
              style={{ transform: `translate3d(${hudOffset.x}px, ${hudOffset.y}px, 0)`, touchAction: 'none' }}
              onPointerDown={handleHudPointerDown}
              onPointerMove={handleHudPointerMove}
              onPointerUp={handleHudPointerUp}
              onPointerCancel={handleHudPointerUp}
              onDoubleClick={() => setHudOffset({ x: 0, y: 0 })}
              className={`relative flex items-center gap-1.5 px-2.5 py-1 bg-white border text-xs text-[#1E1E1E] pointer-events-auto cursor-grab active:cursor-grabbing ${
                isDraggingHud ? 'border-[#1979CA]' : 'border-[#9AA4B2]'
              }`}
              title="Drag to move stencil controls"
            >
              <GripVertical className="w-3.5 h-3.5 text-[#777]" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTemplateGuide(!showTemplateGuide);
                }}
                className="p-0.5 hover:bg-[#E5F1FB] cursor-pointer"
                title={showTemplateGuide ? 'Hide stencil' : 'Show stencil'}
              >
                {showTemplateGuide ? <Eye className="w-3.5 h-3.5 text-[#1979CA]" /> : <EyeOff className="w-3.5 h-3.5 text-[#888]" />}
              </button>
              <span className="font-semibold truncate max-w-[110px]">{activeTemplate.name}</span>
              <button
                ref={opacityButtonRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOpacitySlider(!showOpacitySlider);
                }}
                className="flex items-center gap-0.5 px-1 hover:bg-[#E5F1FB] text-[#1979CA] font-semibold cursor-pointer"
                title="Adjust stencil opacity"
              >
                <Sliders className="w-3 h-3" />
                <span>{Math.round(templateOpacity * 100)}%</span>
              </button>

              <div className="h-3 w-[1px] bg-[#DADBDC]" />
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  data-testid="mirror-h-btn"
                  aria-pressed={symmetryMode === 'horizontal' || symmetryMode === 'quad'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleMirrorAxis('horizontal');
                  }}
                  className={`px-1 py-0.5 text-[10px] border cursor-pointer flex items-center gap-0.5 ${
                    symmetryMode === 'horizontal' || symmetryMode === 'quad'
                      ? 'bg-[#D8E8FA] border-[#7DA2CE] font-bold'
                      : 'border-transparent hover:bg-[#E5F1FB]'
                  }`}
                >
                  <FlipHorizontal className="w-3 h-3" /> H
                </button>
                <button
                  type="button"
                  data-testid="mirror-v-btn"
                  aria-pressed={symmetryMode === 'vertical' || symmetryMode === 'quad'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleMirrorAxis('vertical');
                  }}
                  className={`px-1 py-0.5 text-[10px] border cursor-pointer flex items-center gap-0.5 ${
                    symmetryMode === 'vertical' || symmetryMode === 'quad'
                      ? 'bg-[#D8E8FA] border-[#7DA2CE] font-bold'
                      : 'border-transparent hover:bg-[#E5F1FB]'
                  }`}
                >
                  <FlipVertical className="w-3 h-3" /> V
                </button>
              </div>

              {(activeTemplate.type === 'photo' || activeTemplate.mediaUrl) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTraceMode((m) => (m === 'outline' ? 'grayscale' : m === 'grayscale' ? 'color' : 'outline'));
                  }}
                  className="px-1.5 py-0.5 bg-[#E5F1FB] border border-[#A0C5E8] text-[10px] font-semibold text-[#1979CA] flex items-center gap-1 cursor-pointer"
                >
                  {isProcessingOutline ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  <span>{traceMode === 'outline' ? 'Outline' : traceMode === 'grayscale' ? 'Gray' : 'Color'}</span>
                </button>
              )}

              {activeTemplate.type === 'video' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!videoRef.current) return;
                    if (videoRef.current.paused) {
                      videoRef.current.play();
                      setIsVideoPlaying(true);
                    } else {
                      videoRef.current.pause();
                      setIsVideoPlaying(false);
                    }
                  }}
                  className="p-0.5 hover:bg-[#E5F1FB] cursor-pointer"
                >
                  {isVideoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearTemplate();
                }}
                className="px-1 hover:bg-[#E81123] hover:text-white cursor-pointer"
                title="Close Paint Book Stencil"
              >
                ✕
              </button>

              {showOpacitySlider && (
                <div
                  ref={opacityPopoverRef}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute top-full mt-1 left-0 z-40 p-2.5 bg-[#F5F6F7] border border-[#9AA4B2] shadow-md w-56 text-[11px] flex flex-col gap-2 cursor-default"
                >
                  <div className="flex justify-between">
                    <span>Guide Opacity</span>
                    <span className="font-bold text-[#1979CA]">{Math.round(templateOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={templateOpacity}
                    onChange={(e) => onTemplateOpacityChange(parseFloat(e.target.value))}
                    className="w-full accent-[#1979CA]"
                  />
                  {traceMode === 'outline' && (
                    <>
                      <div className="flex justify-between">
                        <span>Outline Sensitivity</span>
                        <span className="font-bold text-[#1979CA]">{outlineDetailThreshold}</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="80"
                        step="5"
                        value={outlineDetailThreshold}
                        onChange={(e) => setOutlineDetailThreshold(parseInt(e.target.value, 10))}
                        className="w-full accent-[#1979CA]"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top Horizontal Interactive Pixel Ruler (View -> Rulers / Tools -> Ruler) */}
        {showRulers && (
          <div className="h-[22px] bg-[#F5F6F7] border-b border-[#C6C7C8] flex items-stretch shrink-0 select-none text-[9px] text-[#333] relative z-20">
            {/* Top-left Ruler Corner Box (Click to clear guides) */}
            <button
              type="button"
              data-testid="ruler-corner"
              onClick={() => {
                if (rulerGuides.vertical.length > 0 || rulerGuides.horizontal.length > 0) {
                  setRulerGuides({ vertical: [], horizontal: [] });
                  onNotify?.('Cleared ruler guides');
                }
              }}
              className="w-[22px] h-full bg-[#EFEFEF] border-r border-[#C6C7C8] flex items-center justify-center text-[8px] font-semibold text-[#555] shrink-0 hover:bg-[#E5F1FB] cursor-pointer"
              title={
                rulerGuides.vertical.length > 0 || rulerGuides.horizontal.length > 0
                  ? 'Clear all ruler guides'
                  : 'Pixel ruler origin (0, 0)'
              }
            >
              {rulerGuides.vertical.length > 0 || rulerGuides.horizontal.length > 0 ? '✕' : 'px'}
            </button>

            <div
              ref={topRulerRef}
              data-testid="ruler-top"
              onPointerDown={handleTopRulerPointerDown}
              onPointerMove={(e) => {
                const px = mapTopRulerX(e.clientX);
                setRulerHoverPreview({ axis: 'x', px });
              }}
              onPointerLeave={() => setRulerHoverPreview(null)}
              className="flex-1 h-full relative overflow-hidden cursor-col-resize"
              title="Click or drag along top ruler to place/move a vertical pixel guide"
            >
              <div
                className="relative h-full pointer-events-none"
                style={{
                  transform: `translateX(${-scrollOffset.left}px)`,
                }}
              >
                {xTicks.map((tick) => (
                  <div
                    key={tick.posPx}
                    className="absolute bottom-0 border-l border-[#7A7A7A]"
                    style={{
                      left: `${tick.displayOffsetPx}px`,
                      height:
                        tick.level === 'major' ? '100%' : tick.level === 'mid' ? '10px' : '5px',
                      borderColor: tick.level === 'major' ? '#666666' : '#9AA4B2',
                    }}
                  >
                    {tick.label !== undefined && (
                      <span className="pl-0.5 pt-0.5 block leading-none tabular-nums text-[9px] text-[#333]">
                        {tick.label}
                      </span>
                    )}
                  </div>
                ))}

                {/* Placed Vertical Guide Markers */}
                {rulerGuides.vertical.map((gx, idx) => (
                  <button
                    key={`vg_${idx}_${gx}`}
                    type="button"
                    data-ruler-guide-pin="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRulerGuides((prev) => ({
                        ...prev,
                        vertical: prev.vertical.filter((_, i) => i !== idx),
                      }));
                    }}
                    className="pointer-events-auto absolute bottom-0 -translate-x-1/2 px-1 bg-[#1979CA] text-white text-[8px] leading-[12px] cursor-pointer hover:bg-[#E81123]"
                    style={{ left: `${gx * zoomLevel}px` }}
                    title={`Vertical guide at ${gx}px (Click to remove)`}
                  >
                    {gx}
                  </button>
                ))}

                {/* Live Cursor X Indicator */}
                {(hoverCursor || (rulerHoverPreview?.axis === 'x' ? { x: rulerHoverPreview.px } : null)) && (
                  <div
                    data-testid="ruler-top-cursor"
                    className="absolute top-0 bottom-0 w-[1px] bg-[#0078D7]"
                    style={{
                      left: `${
                        (rulerHoverPreview?.axis === 'x'
                          ? rulerHoverPreview.px
                          : hoverCursor?.x ?? 0) * zoomLevel
                      }px`,
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Vertical Interactive Pixel Ruler (View -> Rulers / Tools -> Ruler) */}
          {showRulers && (
            <div
              ref={leftRulerRef}
              data-testid="ruler-left"
              onPointerDown={handleLeftRulerPointerDown}
              onPointerMove={(e) => {
                const px = mapLeftRulerY(e.clientY);
                setRulerHoverPreview({ axis: 'y', px });
              }}
              onPointerLeave={() => setRulerHoverPreview(null)}
              className="w-[22px] bg-[#F5F6F7] border-r border-[#C6C7C8] shrink-0 overflow-hidden select-none text-[9px] text-[#333] relative cursor-row-resize z-20"
              title="Click or drag along left ruler to place/move a horizontal pixel guide"
            >
              <div
                className="relative w-full pointer-events-none"
                style={{
                  transform: `translateY(${-scrollOffset.top}px)`,
                }}
              >
                {yTicks.map((tick) => (
                  <div
                    key={tick.posPx}
                    className="absolute right-0 border-t border-[#7A7A7A]"
                    style={{
                      top: `${tick.displayOffsetPx}px`,
                      width:
                        tick.level === 'major' ? '100%' : tick.level === 'mid' ? '10px' : '5px',
                      borderColor: tick.level === 'major' ? '#666666' : '#9AA4B2',
                    }}
                  >
                    {tick.label !== undefined && (
                      <span
                        className="block leading-none tabular-nums text-[8.5px] text-[#333] pl-0.5 pt-0.5"
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                      >
                        {tick.label}
                      </span>
                    )}
                  </div>
                ))}

                {/* Placed Horizontal Guide Markers */}
                {rulerGuides.horizontal.map((gy, idx) => (
                  <button
                    key={`hg_${idx}_${gy}`}
                    type="button"
                    data-ruler-guide-pin="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRulerGuides((prev) => ({
                        ...prev,
                        horizontal: prev.horizontal.filter((_, i) => i !== idx),
                      }));
                    }}
                    className="pointer-events-auto absolute right-0 -translate-y-1/2 px-0.5 bg-[#1979CA] text-white text-[8px] leading-[11px] cursor-pointer hover:bg-[#E81123]"
                    style={{ top: `${gy * zoomLevel}px` }}
                    title={`Horizontal guide at ${gy}px (Click to remove)`}
                  >
                    {gy}
                  </button>
                ))}

                {/* Live Cursor Y Indicator */}
                {(hoverCursor || (rulerHoverPreview?.axis === 'y' ? { y: rulerHoverPreview.px } : null)) && (
                  <div
                    data-testid="ruler-left-cursor"
                    className="absolute left-0 right-0 h-[1px] bg-[#0078D7]"
                    style={{
                      top: `${
                        (rulerHoverPreview?.axis === 'y'
                          ? rulerHoverPreview.px
                          : hoverCursor?.y ?? 0) * zoomLevel
                      }px`,
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Full-Screen Scrollable Workspace */}
          <div
            ref={workspaceRef}
            data-testid="paint-workspace"
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollOffset({ left: target.scrollLeft, top: target.scrollTop });
            }}
            onPointerDownCapture={handleWorkspacePointerDownCapture}
            onPointerMoveCapture={handleWorkspacePointerMoveCapture}
            onPointerUpCapture={handleWorkspacePointerEndCapture}
            onPointerCancel={handleWorkspacePointerEndCapture}
            onContextMenu={(e) => e.preventDefault()}
            className="flex-1 min-h-0 overflow-auto paint-workspace-scroll bg-[#C9D2E3] p-0"
          >
            <div className="min-h-full w-fit">
              {/* Crisp White Rectangular Drawing Sheet Expanding Across Full Screen */}
              <div
                data-testid="canvas-sheet-frame"
                className={`relative bg-white select-none shrink-0 ${
                  isAutoFillScreen ? '' : 'border border-[#9AA4B2]'
                }`}
                style={{
                  width: `${displayW}px`,
                  height: `${displayH}px`,
                }}
              >
              {/* Underlying Tracing Template Layer (inside white sheet) */}
              {activeTemplate && showTemplateGuide && (
                <div
                  className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0"
                  style={{ opacity: templateOpacity }}
                >
                  {activeTemplate.mediaUrl && activeTemplate.type !== 'video' && (
                    <img
                      src={
                        activeTemplate.mediaUrl.startsWith('data:')
                          ? activeTemplate.mediaUrl
                          : encodeURI(decodeURI(activeTemplate.mediaUrl))
                      }
                      alt={activeTemplate.name}
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      className={`w-full h-full object-contain select-none ${
                        activeTemplate.mediaUrl?.includes('/assets/aistudio/') || activeTemplate.collectionId
                          ? 'opacity-100 contrast-125'
                          : traceMode === 'outline'
                          ? 'opacity-40 contrast-110'
                          : traceMode === 'grayscale'
                          ? 'opacity-100 grayscale'
                          : 'opacity-100'
                      }`}
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.onerror = null;
                        target.src = generateFallbackSvgDataUrl(activeTemplate.name);
                      }}
                    />
                  )}

                  {activeTemplate.type === 'video' && activeTemplate.mediaUrl && (
                    <video
                      ref={videoRef}
                      src={activeTemplate.mediaUrl}
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-contain select-none"
                    />
                  )}

                  {traceMode === 'outline' &&
                    !activeTemplate.mediaUrl?.includes('/assets/aistudio/') &&
                    !activeTemplate.collectionId &&
                    processedTraceUrl && (
                      <img
                        src={processedTraceUrl}
                        alt={`${activeTemplate.name} Outline`}
                        className="absolute inset-0 w-full h-full object-contain mix-blend-multiply select-none"
                      />
                    )}

                  {!activeTemplate.mediaUrl && activeTemplate.svgPath && (
                    <svg
                      viewBox={activeTemplate.viewBox || '0 0 200 200'}
                      className="w-full h-full p-4 stroke-slate-900 fill-none"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={activeTemplate.svgPath} />
                    </svg>
                  )}
                </div>
              )}

              {/* Main Drawing Canvas Surface */}
              <canvas
                ref={canvasRef}
                data-testid="paint-canvas"
                data-active-tool={tool}
                data-stamp-shape={stampShape}
                data-grid-visible={showGrid ? 'true' : 'false'}
                data-gradient-brush={isGradientBrush ? 'true' : 'false'}
                data-pressure-sensitive={pressureSensitive ? 'true' : 'false'}
                data-mirror-mode={symmetryMode}
                data-symmetry-guides={symmetryGuides}
                width={canvasDimensions.width}
                height={canvasDimensions.height}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={() => {
                  onCursorPositionChange?.(null);
                  setHoverCursor(null);
                }}
                onDoubleClick={handleDoubleClick}
                className="drawing-surface block w-full h-full relative z-10"
                style={{
                  cursor: getCanvasCursor(),
                  background: 'transparent',
                  touchAction: 'none',
                }}
              />

              {/* Blur Brush Diameter Guide Ring */}
              {tool === 'blur' && hoverCursor && (
                <div
                  data-testid="blur-brush-cursor"
                  aria-hidden="true"
                  className="absolute pointer-events-none z-30 rounded-full border border-[#1979CA]/80 bg-[#1979CA]/5 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_0_1px_rgba(255,255,255,0.75)]"
                  style={{
                    left: `${hoverCursor.x * zoomLevel}px`,
                    top: `${hoverCursor.y * zoomLevel}px`,
                    width: `${getBlurBrushStrokeWidth(size) * zoomLevel}px`,
                    height: `${getBlurBrushStrokeWidth(size) * zoomLevel}px`,
                  }}
                />
              )}

              {/* Gridlines Overlay (View -> Grid) */}
              {showGrid && (
                <div
                  data-testid="canvas-grid-overlay"
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none z-20"
                  style={{
                    backgroundImage: [
                      'linear-gradient(to right, rgba(25, 121, 202, 0.24) 1px, transparent 1px)',
                      'linear-gradient(to bottom, rgba(25, 121, 202, 0.24) 1px, transparent 1px)',
                      'linear-gradient(to right, rgba(100, 116, 139, 0.22) 1px, transparent 1px)',
                      'linear-gradient(to bottom, rgba(100, 116, 139, 0.22) 1px, transparent 1px)',
                    ].join(', '),
                    backgroundSize: `${96 * zoomLevel}px ${96 * zoomLevel}px, ${96 * zoomLevel}px ${96 * zoomLevel}px, ${24 * zoomLevel}px ${24 * zoomLevel}px, ${24 * zoomLevel}px ${24 * zoomLevel}px`,
                  }}
                />
              )}

              {/* Interactive Ruler Guide Lines across Canvas */}
              {showRulers && (rulerGuides.vertical.length > 0 || rulerGuides.horizontal.length > 0) && (
                <div data-testid="ruler-guides-overlay" className="absolute inset-0 pointer-events-none z-20">
                  {rulerGuides.vertical.map((gx, idx) => (
                    <div
                      key={`vguide_${idx}_${gx}`}
                      className="absolute inset-y-0 w-0 border-l border-dashed border-[#0078D7]/80"
                      style={{ left: `${gx * zoomLevel}px` }}
                    />
                  ))}
                  {rulerGuides.horizontal.map((gy, idx) => (
                    <div
                      key={`hguide_${idx}_${gy}`}
                      className="absolute inset-x-0 h-0 border-t border-dashed border-[#0078D7]/80"
                      style={{ top: `${gy * zoomLevel}px` }}
                    />
                  ))}
                </div>
              )}

              {/* Center Symmetry Alignment Guides Overlay (non-mirroring) */}
              {symmetryGuides !== 'none' && (
                <div
                  data-testid="symmetry-guides-overlay"
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none z-20"
                >
                  {hasVerticalSymmetryGuide(symmetryGuides) && (
                    <div
                      data-testid="symmetry-guide-vertical-line"
                      className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0 border-l-2 border-dashed border-[#0D9488]/75 shadow-[0_0_0_1px_rgba(255,255,255,0.55)]"
                    />
                  )}
                  {hasHorizontalSymmetryGuide(symmetryGuides) && (
                    <div
                      data-testid="symmetry-guide-horizontal-line"
                      className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0 border-t-2 border-dashed border-[#0D9488]/75 shadow-[0_0_0_1px_rgba(255,255,255,0.55)]"
                    />
                  )}
                  {symmetryGuides === 'both' && (
                    <div
                      data-testid="symmetry-guide-center-mark"
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white/90 border-2 border-[#0D9488]"
                    />
                  )}
                </div>
              )}

              {/* Interactive Symmetry Axis Guide Overlay */}
              {symmetryMode !== 'none' && (
                <div
                  data-testid="mirror-guide-overlay"
                  className="absolute inset-0 pointer-events-none z-20"
                >
                  {(symmetryMode === 'horizontal' || symmetryMode === 'quad') && (
                    <div
                      data-testid="symmetry-vertical-axis"
                      className="absolute inset-y-0 -translate-x-1/2 pointer-events-none"
                      style={{ left: `${symmetryAxisRatio.x * 100}%` }}
                    >
                      <div
                        className={`h-full w-0 border-l-2 border-dashed ${
                          draggingSymmetryAxis === 'vertical'
                            ? 'border-[#0B5CAD]'
                            : 'border-[#1979CA]/75'
                        }`}
                      />
                      <div
                        role="slider"
                        tabIndex={0}
                        aria-label="Vertical symmetry axis position"
                        aria-valuemin={5}
                        aria-valuemax={95}
                        aria-valuenow={Math.round(symmetryAxisRatio.x * 100)}
                        data-testid="symmetry-vertical-handle"
                        onPointerDown={(e) => handleSymmetryGuidePointerDown('vertical', e)}
                        onPointerMove={(e) => handleSymmetryGuidePointerMove('vertical', e)}
                        onPointerUp={handleSymmetryGuidePointerUp}
                        onPointerCancel={handleSymmetryGuidePointerUp}
                        onKeyDown={(e) => {
                          if (isSymmetryLocked) return;
                          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                            e.preventDefault();
                            e.stopPropagation();
                            const delta = e.key === 'ArrowLeft' ? -0.02 : 0.02;
                            setSymmetryAxisRatio((prev) => ({
                              ...prev,
                              x: clampSymmetryAxisRatio(prev.x + delta),
                            }));
                          }
                        }}
                        onDoubleClick={(e) => {
                          if (isSymmetryLocked) return;
                          e.stopPropagation();
                          setSymmetryAxisRatio((prev) => ({ ...prev, x: 0.5 }));
                          onNotify?.('Vertical symmetry axis centered');
                        }}
                        title={
                          isSymmetryLocked
                            ? 'Vertical symmetry axis locked'
                            : 'Drag left or right to move vertical symmetry axis · Double-click to center'
                        }
                        className={`${
                          isSymmetryLocked ? 'pointer-events-none opacity-85' : 'pointer-events-auto cursor-ew-resize'
                        } absolute top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 flex items-center gap-1 text-[10px] font-medium border shadow-sm select-none whitespace-nowrap ${
                          draggingSymmetryAxis === 'vertical'
                            ? 'bg-[#1979CA] text-white border-[#0F548F]'
                            : 'bg-[#F5F6F7]/95 text-[#1E304B] border-[#7DA2CE] hover:bg-[#E5F1FB]'
                        }`}
                      >
                        <span aria-hidden="true">↔</span>
                        <span className="tabular-nums">
                          X:{Math.round(symmetryAxisRatio.x * canvasDimensions.width)}
                        </span>
                      </div>
                    </div>
                  )}

                  {(symmetryMode === 'vertical' || symmetryMode === 'quad') && (
                    <div
                      data-testid="symmetry-horizontal-axis"
                      className="absolute inset-x-0 -translate-y-1/2 pointer-events-none"
                      style={{ top: `${symmetryAxisRatio.y * 100}%` }}
                    >
                      <div
                        className={`w-full h-0 border-t-2 border-dashed ${
                          draggingSymmetryAxis === 'horizontal'
                            ? 'border-[#0B5CAD]'
                            : 'border-[#1979CA]/75'
                        }`}
                      />
                      <div
                        role="slider"
                        tabIndex={0}
                        aria-label="Horizontal symmetry axis position"
                        aria-valuemin={5}
                        aria-valuemax={95}
                        aria-valuenow={Math.round(symmetryAxisRatio.y * 100)}
                        data-testid="symmetry-horizontal-handle"
                        onPointerDown={(e) => handleSymmetryGuidePointerDown('horizontal', e)}
                        onPointerMove={(e) => handleSymmetryGuidePointerMove('horizontal', e)}
                        onPointerUp={handleSymmetryGuidePointerUp}
                        onPointerCancel={handleSymmetryGuidePointerUp}
                        onKeyDown={(e) => {
                          if (isSymmetryLocked) return;
                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                            e.preventDefault();
                            e.stopPropagation();
                            const delta = e.key === 'ArrowUp' ? -0.02 : 0.02;
                            setSymmetryAxisRatio((prev) => ({
                              ...prev,
                              y: clampSymmetryAxisRatio(prev.y + delta),
                            }));
                          }
                        }}
                        onDoubleClick={(e) => {
                          if (isSymmetryLocked) return;
                          e.stopPropagation();
                          setSymmetryAxisRatio((prev) => ({ ...prev, y: 0.5 }));
                          onNotify?.('Horizontal symmetry axis centered');
                        }}
                        title={
                          isSymmetryLocked
                            ? 'Horizontal symmetry axis locked'
                            : 'Drag up or down to move horizontal symmetry axis · Double-click to center'
                        }
                        className={`${
                          isSymmetryLocked ? 'pointer-events-none opacity-85' : 'pointer-events-auto cursor-ns-resize'
                        } absolute left-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 flex items-center gap-1 text-[10px] font-medium border shadow-sm select-none whitespace-nowrap ${
                          draggingSymmetryAxis === 'horizontal'
                            ? 'bg-[#1979CA] text-white border-[#0F548F]'
                            : 'bg-[#F5F6F7]/95 text-[#1E304B] border-[#7DA2CE] hover:bg-[#E5F1FB]'
                        }`}
                      >
                        <span aria-hidden="true">↕</span>
                        <span className="tabular-nums">
                          Y:{Math.round(symmetryAxisRatio.y * canvasDimensions.height)}
                        </span>
                      </div>
                    </div>
                  )}

                  {symmetryMode === 'quad' && (
                    <div
                      data-testid="symmetry-quad-origin"
                      className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-[#1979CA] pointer-events-none"
                      style={{
                        left: `${symmetryAxisRatio.x * 100}%`,
                        top: `${symmetryAxisRatio.y * 100}%`,
                      }}
                    />
                  )}

                  {/* Quick On-Canvas Axis Mode & Center Controls */}
                  <div
                    data-testid="symmetry-guide-toolbar"
                    data-canvas-hud="true"
                    onPointerDown={(e) => e.stopPropagation()}
                    className="pointer-events-auto absolute bottom-2 right-2 bg-[#F5F6F7]/95 border border-[#A0A0A0] shadow-sm px-1.5 py-1 flex items-center gap-1 text-[10.5px] text-[#1E1E1E] select-none"
                  >
                    <span className="font-semibold text-[#1979CA] px-1">Symmetry:</span>
                    <button
                      type="button"
                      onClick={() => updateSymmetryMode('horizontal')}
                      className={`px-1.5 py-0.5 border cursor-pointer ${
                        symmetryMode === 'horizontal'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE] font-semibold'
                          : 'border-transparent hover:bg-[#E5F1FB]'
                      }`}
                      title="Vertical axis guide (mirror left & right)"
                    >
                      Vertical
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSymmetryMode('vertical')}
                      className={`px-1.5 py-0.5 border cursor-pointer ${
                        symmetryMode === 'vertical'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE] font-semibold'
                          : 'border-transparent hover:bg-[#E5F1FB]'
                      }`}
                      title="Horizontal axis guide (mirror top & bottom)"
                    >
                      Horizontal
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSymmetryMode('quad')}
                      className={`px-1.5 py-0.5 border cursor-pointer ${
                        symmetryMode === 'quad'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE] font-semibold'
                          : 'border-transparent hover:bg-[#E5F1FB]'
                      }`}
                      title="4-Way Quad symmetry"
                    >
                      Quad
                    </button>
                    <span className="w-[1px] h-3 bg-[#DADBDC]" />
                    <button
                      type="button"
                      data-testid="symmetry-center-btn"
                      onClick={() => {
                        setSymmetryAxisRatio({ x: 0.5, y: 0.5 });
                        onNotify?.('Symmetry axis reset to canvas center');
                      }}
                      className="px-1.5 py-0.5 border border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] cursor-pointer"
                      title="Reset symmetry axis to exact canvas center"
                    >
                      Center
                    </button>
                    <button
                      type="button"
                      data-testid="symmetry-lock-btn"
                      aria-pressed={isSymmetryLocked}
                      onClick={() => {
                        const next = !isSymmetryLocked;
                        setIsSymmetryLocked(next);
                        onNotify?.(next ? 'Symmetry axis locked' : 'Symmetry axis unlocked');
                      }}
                      className={`px-1.5 py-0.5 border flex items-center gap-1 cursor-pointer ${
                        isSymmetryLocked
                          ? 'bg-[#D8E8FA] border-[#7DA2CE] font-semibold'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title="Lock axis position so strokes near the guide do not move it"
                    >
                      {isSymmetryLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      <span>{isSymmetryLocked ? 'Locked' : 'Lock'}</span>
                    </button>
                    <button
                      type="button"
                      data-testid="symmetry-close-btn"
                      onClick={() => updateSymmetryMode('none')}
                      className="px-1 py-0.5 border border-transparent hover:bg-[#FCE8E8] hover:border-[#E5A0A0] text-[#555] cursor-pointer"
                      aria-label="Close Symmetry guide"
                      title="Turn off Symmetry"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Active Selection Box Overlay */}
              {selectionRect && selectionRect.width >= 2 && selectionRect.height >= 2 && (
                <div
                  data-testid="selection-box-overlay"
                  className="absolute pointer-events-none z-30 border border-dashed border-[#1979CA] bg-[#1979CA]/5"
                  style={{
                    left: `${selectionRect.x * zoomLevel}px`,
                    top: `${selectionRect.y * zoomLevel}px`,
                    width: `${selectionRect.width * zoomLevel}px`,
                    height: `${selectionRect.height * zoomLevel}px`,
                  }}
                />
              )}

              {/* Inline Text Input Box */}
              {activeTextBox && (
                <div
                  data-canvas-hud="true"
                  className="absolute z-40"
                  style={{
                    left: `${activeTextBox.x * zoomLevel}px`,
                    top: `${activeTextBox.y * zoomLevel}px`,
                  }}
                >
                  <textarea
                    ref={textInputRef}
                    value={activeTextBox.text}
                    onChange={(e) =>
                      setActiveTextBox((prev) => (prev ? { ...prev, text: e.target.value } : null))
                    }
                    onBlur={commitTextAnnotation}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setActiveTextBox(null);
                      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        commitTextAnnotation();
                      }
                    }}
                    placeholder="Type text..."
                    rows={2}
                    className="min-w-[140px] bg-white/80 border border-dashed border-[#1979CA] px-1 py-0.5 focus:outline-none resize both"
                    style={{
                      color,
                      fontSize: `${Math.max(14, Math.round(size * 2.4)) * zoomLevel}px`,
                      lineHeight: 1.25,
                      fontFamily: '"Segoe UI", Arial, sans-serif',
                    }}
                  />
                </div>
              )}

              {/* Live Dashed Resize Preview Outline */}
              {resizingPreview && (
                <div
                  className="absolute top-0 left-0 border border-dashed border-[#1E1E1E] pointer-events-none z-40"
                  style={{
                    width: `${resizingPreview.width * zoomLevel}px`,
                    height: `${resizingPreview.height * zoomLevel}px`,
                  }}
                />
              )}

              {/* Classic Windows Paint Resize Handles (Right, Bottom, Corner) */}
              <div
                onPointerDown={(e) => startSheetResize('right', e)}
                data-testid="resize-handle-right"
                className="absolute top-1/2 right-0 -translate-y-1/2 w-[5px] h-[5px] bg-white border border-[#1E1E1E] cursor-ew-resize z-30"
                title="Drag to resize canvas width"
              />
              <div
                onPointerDown={(e) => startSheetResize('bottom', e)}
                data-testid="resize-handle-bottom"
                className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[5px] h-[5px] bg-white border border-[#1E1E1E] cursor-ns-resize z-30"
                title="Drag to resize canvas height"
              />
              <div
                onPointerDown={(e) => startSheetResize('corner', e)}
                data-testid="resize-handle-corner"
                className="absolute right-0 bottom-0 w-[5px] h-[5px] bg-white border border-[#1E1E1E] cursor-nwse-resize z-30"
                title="Drag to resize canvas width & height"
              />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

CanvasStudio.displayName = 'CanvasStudio';
