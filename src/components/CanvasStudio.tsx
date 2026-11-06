import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Eye, EyeOff, Sliders, Play, Pause, Wand2, Loader2, Sparkles, GripVertical } from 'lucide-react';
import { DrawingTemplate, Point, Stroke, ToolType } from '../types';
import {
  getCanvasCoordinates,
  getMidPoint,
  createStroke,
  smoothPoints,
  drawQuadraticPath,
  applyToolStyleToContext,
} from '../utils/drawing';
import { generateOutlineTraceDataUrl, generateFallbackSvgDataUrl } from '../utils/edgeDetection';

interface CanvasStudioProps {
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  strokes: Stroke[];
  onStrokesChange: (newStrokes: Stroke[]) => void;
  activeTemplate: DrawingTemplate | null;
  lastClosedTemplate?: DrawingTemplate | null;
  templateOpacity: number;
  onTemplateOpacityChange: (opacity: number) => void;
  onOpenTemplates: () => void;
  onClearTemplate: () => void;
  onRestoreTemplate?: () => void;
}

export const CanvasStudio: React.FC<CanvasStudioProps> = ({
  tool,
  color,
  size,
  opacity,
  strokes,
  onStrokesChange,
  activeTemplate,
  lastClosedTemplate,
  templateOpacity,
  onTemplateOpacityChange,
  onOpenTemplates,
  onClearTemplate,
  onRestoreTemplate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isDrawingRef = useRef<boolean>(false);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const prevMidPointRef = useRef<Point | null>(null);

  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 1200,
  });

  const [showTemplateGuide, setShowTemplateGuide] = useState<boolean>(true);
  const [showOpacitySlider, setShowOpacitySlider] = useState<boolean>(false);

  // Default to Trace Outline Mode so pictures appear as clean line art outline stencils
  const [traceMode, setTraceMode] = useState<'outline' | 'grayscale' | 'color'>('outline');
  const [outlineDetailThreshold, setOutlineDetailThreshold] = useState<number>(38);
  const [processedTraceUrl, setProcessedTraceUrl] = useState<string | null>(null);
  const [isProcessingOutline, setIsProcessingOutline] = useState<boolean>(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);

  // Draggable Title Block HUD State
  const [hudOffset, setHudOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingHud, setIsDraggingHud] = useState<boolean>(false);
  const isDraggingHudRef = useRef<boolean>(false);
  const dragStartPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleHudPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, [role="button"]')) {
      return;
    }
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
    e.preventDefault();
    e.stopPropagation();
    const dx = e.clientX - dragStartPointerRef.current.x;
    const dy = e.clientY - dragStartPointerRef.current.y;
    setHudOffset({
      x: dragStartOffsetRef.current.x + dx,
      y: dragStartOffsetRef.current.y + dy,
    });
  };

  const handleHudPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingHudRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    isDraggingHudRef.current = false;
    setIsDraggingHud(false);
  };

  // Resize canvas based on container dimensions
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const padding = 20;
      const availableWidth = Math.max(300, rect.width - padding);
      const availableHeight = Math.max(350, rect.height - padding);

      const sizeToUse = Math.min(availableWidth, availableHeight, 1400);
      setCanvasDimensions({
        width: Math.floor(sizeToUse * 1.5),
        height: Math.floor(sizeToUse * 1.5),
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Process template image with Sobel edge detection to generate crisp outline trace
  useEffect(() => {
    if (!activeTemplate || !activeTemplate.mediaUrl || activeTemplate.type === 'vector') {
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
        const traceUrl = generateOutlineTraceDataUrl(img, {
          threshold: outlineDetailThreshold,
        });
        if (traceUrl && isSubscribed) {
          setProcessedTraceUrl(traceUrl);
        }
      } catch (err) {
        console.warn('Trace outline generation fallback:', err);
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

    const safeUrl = activeTemplate.mediaUrl.startsWith('data:')
      ? activeTemplate.mediaUrl
      : encodeURI(decodeURI(activeTemplate.mediaUrl));
    img.src = safeUrl;

    return () => {
      isSubscribed = false;
    };
  }, [activeTemplate, outlineDetailThreshold]);

  const applyToolStyle = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    applyToolStyleToContext(ctx, stroke, 'canvas');
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length === 0) return;
    ctx.save();
    applyToolStyle(ctx, stroke);
    drawQuadraticPath(ctx, stroke.points);
    ctx.restore();
  };

  // Render all strokes onto the canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill crisp white sheet
    if (!activeTemplate || !showTemplateGuide) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw all completed strokes using smooth quadratic curves
    for (const stroke of strokes) {
      drawStroke(ctx, stroke);
    }

    // Draw active stroke if drawing
    if (currentStrokeRef.current) {
      drawStroke(ctx, currentStrokeRef.current);
    }
  }, [strokes, activeTemplate, showTemplateGuide]);

  useEffect(() => {
    redrawCanvas();
  }, [strokes, canvasDimensions, redrawCanvas]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const point = getCanvasCoordinates(
      e.clientX,
      e.clientY,
      rect,
      canvasDimensions.width,
      canvasDimensions.height
    );

    const newStroke = createStroke(tool, color, size, opacity, point);
    currentStrokeRef.current = newStroke;
    prevMidPointRef.current = point;
    isDrawingRef.current = true;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      applyToolStyle(ctx, newStroke);
      ctx.beginPath();
      ctx.arc(point.x, point.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const point = getCanvasCoordinates(
      e.clientX,
      e.clientY,
      rect,
      canvasDimensions.width,
      canvasDimensions.height
    );

    const points = currentStrokeRef.current.points;
    points.push(point);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const len = points.length;
      if (len === 2) {
        const p0 = points[0];
        const p1 = points[1];
        const mid = getMidPoint(p0, p1);

        ctx.save();
        applyToolStyle(ctx, currentStrokeRef.current);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(mid.x, mid.y);
        ctx.stroke();
        ctx.restore();

        prevMidPointRef.current = mid;
      } else if (len >= 3 && prevMidPointRef.current) {
        const pPrev = points[len - 2];
        const currentMid = getMidPoint(pPrev, point);

        ctx.save();
        applyToolStyle(ctx, currentStrokeRef.current);
        ctx.beginPath();
        ctx.moveTo(prevMidPointRef.current.x, prevMidPointRef.current.y);
        ctx.quadraticCurveTo(pPrev.x, pPrev.y, currentMid.x, currentMid.y);
        ctx.stroke();
        ctx.restore();

        prevMidPointRef.current = currentMid;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    e.preventDefault();

    try {
      const canvas = canvasRef.current;
      if (canvas && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    const canvas = canvasRef.current;
    if (canvas && currentStrokeRef.current && prevMidPointRef.current) {
      const ctx = canvas.getContext('2d');
      const points = currentStrokeRef.current.points;
      if (ctx && points.length > 1) {
        const last = points[points.length - 1];
        ctx.save();
        applyToolStyle(ctx, currentStrokeRef.current);
        ctx.beginPath();
        ctx.moveTo(prevMidPointRef.current.x, prevMidPointRef.current.y);
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    isDrawingRef.current = false;
    const completedStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    prevMidPointRef.current = null;

    if (completedStroke && completedStroke.points.length > 0) {
      const smoothed = {
        ...completedStroke,
        points: smoothPoints(completedStroke.points),
      };
      onStrokesChange([...strokes, smoothed]);
    }
  };

  const handleToggleVideoPlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsVideoPlaying(true);
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  // Determine CSS filter for fallback trace vs color vs grayscale
  const getGuideFilterStyle = () => {
    if (traceMode === 'outline' && !processedTraceUrl) {
      return 'grayscale(100%) contrast(500%) brightness(135%)';
    }
    if (traceMode === 'grayscale') {
      return 'grayscale(100%) contrast(120%)';
    }
    return 'none';
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col items-center justify-center p-2 sm:p-4 pb-20 sm:pb-24 overflow-hidden"
    >
      {/* Background Studio Image */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <img
          src="/src/assets/images/royal_blue_white_bg_1793729884932.jpg"
          alt=""
          className="w-full h-full object-cover object-center opacity-45 scale-105 filter blur-[0.5px]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/75 via-blue-50/60 to-blue-900/25" />
        <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-blue-600/20 blur-[100px]" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-[#164BCE]/25 blur-[120px]" />
      </div>

      {/* Canvas Frame Wrapper: Floating White Drawing Board */}
      <div className="relative z-10 max-w-full max-h-full flex items-center justify-center shadow-[0_20px_60px_rgba(22,75,206,0.22),0_0_35px_rgba(37,99,235,0.18)] rounded-2xl sm:rounded-3xl p-2 bg-gradient-to-b from-white via-blue-50/80 to-blue-100/60 border-2 border-blue-400/50">
        {/* Floating Tracing Control HUD */}
        {activeTemplate && (
          <div className="absolute top-3 left-3 right-3 z-20 flex items-start justify-between gap-2 pointer-events-none">
            {/* Movable Template Title Block & Controls */}
            <div
              style={{
                transform: `translate3d(${hudOffset.x}px, ${hudOffset.y}px, 0)`,
                touchAction: 'none',
              }}
              onPointerDown={handleHudPointerDown}
              onPointerMove={handleHudPointerMove}
              onPointerUp={handleHudPointerUp}
              onPointerCancel={handleHudPointerUp}
              onDoubleClick={() => setHudOffset({ x: 0, y: 0 })}
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border shadow-md transition-shadow select-none cursor-grab active:cursor-grabbing text-xs text-slate-800 pointer-events-auto ${
                isDraggingHud
                  ? 'border-blue-500 shadow-xl ring-2 ring-blue-400/40'
                  : 'border-slate-200/90 hover:border-blue-300 hover:shadow-lg'
              }`}
              title="Click and drag to move this title block anywhere (Double-click to reset)"
            >
              {/* Drag Handle Grip Icon */}
              <div
                className="cursor-grab active:cursor-grabbing p-0.5 text-slate-400 hover:text-blue-600 flex items-center shrink-0"
                title="Drag to move title block anywhere"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>

              {/* Guide Visibility Toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTemplateGuide(!showTemplateGuide);
                }}
                className="p-1 rounded-full text-slate-700 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
                title={showTemplateGuide ? 'Hide tracing guide' : 'Show tracing guide'}
              >
                {showTemplateGuide ? (
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              {/* Title Text */}
              <span className="font-bold truncate max-w-[95px] sm:max-w-[150px] text-slate-800 cursor-grab">
                {activeTemplate.name}
              </span>

              <div className="h-3 w-[1px] bg-slate-200" />

              {/* Opacity Adjustment */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOpacitySlider(!showOpacitySlider);
                }}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 px-1 font-bold cursor-pointer hover:bg-blue-50 rounded-md py-0.5 transition-colors"
                title="Adjust guide opacity and outline details"
              >
                <Sliders className="w-3 h-3" />
                <span>{Math.round(templateOpacity * 100)}%</span>
              </button>

              {/* Outline Trace Mode Toggle Button */}
              {(activeTemplate.type === 'photo' || activeTemplate.mediaUrl) && (
                <>
                  <div className="h-3 w-[1px] bg-slate-200" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (traceMode === 'outline') setTraceMode('grayscale');
                      else if (traceMode === 'grayscale') setTraceMode('color');
                      else setTraceMode('outline');
                    }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                      traceMode === 'outline'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : traceMode === 'grayscale'
                        ? 'bg-slate-200 text-slate-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                    title="Toggle between Outline Trace, Grayscale, and Full Color modes"
                  >
                    {isProcessingOutline ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3" />
                    )}
                    <span>{traceMode === 'outline' ? 'Outline Trace' : traceMode === 'grayscale' ? 'B&W' : 'Color'}</span>
                  </button>
                </>
              )}

              {/* Video Play/Pause toggle if template is video */}
              {activeTemplate.type === 'video' && (
                <>
                  <div className="h-3 w-[1px] bg-slate-200" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVideoPlayback();
                    }}
                    className="p-1 rounded text-slate-700 hover:text-blue-600 cursor-pointer"
                    title={isVideoPlaying ? 'Pause Frame' : 'Play Video'}
                  >
                    {isVideoPlaying ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                  </button>
                </>
              )}

              <div className="h-3 w-[1px] bg-slate-200" />

              {/* Close template button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearTemplate();
                }}
                className="text-slate-400 hover:text-red-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full hover:bg-red-50 cursor-pointer transition-colors"
                title="Remove template from canvas"
              >
                ✕
              </button>

              {/* Attached Opacity Popover (Moves together with the title block!) */}
              {showOpacitySlider && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute top-full mt-2 left-0 z-40 p-3.5 rounded-2xl bg-white/98 backdrop-blur-md border border-slate-200 shadow-2xl flex flex-col gap-3 w-64 text-xs text-slate-800 cursor-default animate-in fade-in slide-in-from-top-1 duration-150"
                >
                  <div>
                    <div className="flex justify-between items-center text-slate-700 mb-1">
                      <span className="font-semibold">Guide Opacity</span>
                      <span className="font-bold text-blue-600">{Math.round(templateOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={templateOpacity}
                      onChange={(e) => onTemplateOpacityChange(parseFloat(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  {traceMode === 'outline' && (
                    <div>
                      <div className="flex justify-between items-center text-slate-700 mb-1">
                        <span className="font-semibold">Outline Detail Sensitivity</span>
                        <span className="font-bold text-blue-600">{outlineDetailThreshold}</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="80"
                        step="5"
                        value={outlineDetailThreshold}
                        onChange={(e) => setOutlineDetailThreshold(parseInt(e.target.value, 10))}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                        <span>More lines (15)</span>
                        <span>Fewer lines (80)</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                    <span>Mode: <strong className="uppercase text-blue-600 font-bold">{traceMode}</strong></span>
                    <button
                      type="button"
                      onClick={() => setShowOpacitySlider(false)}
                      className="text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Switch Template Button */}
            <button
              onClick={onOpenTemplates}
              className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 hover:border-blue-400 shadow-md text-[11px] font-bold text-slate-700 hover:text-blue-600 transition-colors cursor-pointer pointer-events-auto shrink-0"
            >
              Paint Books
            </button>
          </div>
        )}

        {/* Undo Close – Restore Paint Book Button when template was closed */}
        {!activeTemplate && lastClosedTemplate && onRestoreTemplate && (
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-auto animate-in fade-in slide-in-from-top-1 duration-150">
            <button
              onClick={onRestoreTemplate}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full bg-white/95 hover:bg-white text-blue-700 hover:text-blue-800 border-2 border-blue-400/90 shadow-[0_4px_16px_rgba(22,75,206,0.18)] hover:shadow-[0_6px_20px_rgba(22,75,206,0.25)] text-xs font-bold transition-all active:scale-95 cursor-pointer backdrop-blur-md"
              title={`Restore ${lastClosedTemplate.name} (${lastClosedTemplate.difficulty})`}
            >
              <span className="text-sm font-black text-blue-600 leading-none">↶</span>
              <span className="whitespace-nowrap">Undo Close – Restore Paint Book</span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 ml-1 border border-blue-200 truncate max-w-[140px]">
                {lastClosedTemplate.name}
              </span>
            </button>

            {/* Quick Switch Template Button */}
            <button
              onClick={onOpenTemplates}
              className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 hover:border-blue-400 shadow-md text-[11px] font-bold text-slate-700 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Paint Books
            </button>
          </div>
        )}

        {/* Canvas & Tracing Layer Container */}
        <div className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200/80 flex items-center justify-center">
          {/* Main User Drawing Canvas */}
          <canvas
            ref={canvasRef}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="drawing-surface block max-w-[88vw] max-h-[64vh] sm:max-h-[70vh] aspect-square object-contain cursor-crosshair relative z-10"
            style={{
              touchAction: 'none',
              background: 'transparent',
            }}
          />

          {/* Real Photo / Video / Vector Tracing Overlay */}
          {activeTemplate && showTemplateGuide && (
            <div
              className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden transition-opacity duration-150 z-0"
              style={{
                opacity: templateOpacity,
              }}
            >
              {/* 1. Underlying Real Picture Base (Ensures picture NEVER disappears) */}
              {activeTemplate.mediaUrl && activeTemplate.type !== 'video' && (
                <img
                  src={activeTemplate.mediaUrl.startsWith('data:') ? activeTemplate.mediaUrl : encodeURI(decodeURI(activeTemplate.mediaUrl))}
                  alt={activeTemplate.name}
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  className={`absolute inset-0 w-full h-full object-contain select-none transition-all duration-200 ${
                    traceMode === 'outline'
                      ? 'opacity-40 filter contrast(110%)'
                      : traceMode === 'grayscale'
                      ? 'opacity-100 filter grayscale(100%)'
                      : 'opacity-100'
                  }`}
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.onerror = null;
                    target.src = generateFallbackSvgDataUrl(activeTemplate.name);
                  }}
                />
              )}

              {/* 2. Video if video template */}
              {activeTemplate.type === 'video' && activeTemplate.mediaUrl && (
                <video
                  ref={videoRef}
                  src={activeTemplate.mediaUrl}
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-contain select-none"
                />
              )}

              {/* 3. High-Contrast Line Art Trace Layer (Active in Outline Mode) */}
              {traceMode === 'outline' && (
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                  {processedTraceUrl ? (
                    <img
                      src={processedTraceUrl}
                      alt={`${activeTemplate.name} Outline Trace`}
                      className="w-full h-full object-contain select-none mix-blend-multiply"
                    />
                  ) : activeTemplate.svgPath ? (
                    <div className="w-full h-full p-6 flex items-center justify-center">
                      <svg
                        viewBox={activeTemplate.viewBox || '0 0 200 200'}
                        className="w-full h-full stroke-slate-950 fill-none"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={activeTemplate.svgPath} />
                      </svg>
                    </div>
                  ) : null}
                </div>
              )}

              {/* 4. Standalone Vector SVG Template without mediaUrl */}
              {!activeTemplate.mediaUrl && activeTemplate.svgPath && (
                <div className="w-full h-full p-6 flex items-center justify-center bg-white">
                  <svg
                    viewBox={activeTemplate.viewBox || '0 0 200 200'}
                    className="w-full h-full stroke-slate-900 fill-none"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={activeTemplate.svgPath} />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
