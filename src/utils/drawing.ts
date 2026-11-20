import { Point, Stroke, ToolType, PaintFinish, MirrorMode } from '../types';
import { floodFill } from './floodFill';
import { hexToHsl, hslToHex } from './color';
import { renderShapeToContext, shapeToSvgPathData } from './shapes';

export interface PaintColorPalette {
  baseColor: string;
  shadowColor: string;
  bristleDark: string;
  bristleLight: string;
  glossCrest: string;
  specularHighlight: string;
}

/**
 * Derives authentic physical paint color layers:
 * - shadowColor: 3D impasto contact shadow
 * - bristleDark / bristleLight: longitudinal brush-hair striations
 * - glossCrest / specularHighlight: wet paint surface specular reflections
 */
export function getPaintColorPalette(hex: string): PaintColorPalette {
  const { h, s, l } = hexToHsl(hex);
  return {
    baseColor: hex,
    shadowColor: hslToHex(h, Math.min(100, Math.round(s * 0.9)), Math.max(5, Math.round(l * 0.45))),
    bristleDark: hslToHex(h, Math.min(100, Math.round(s * 1.05)), Math.max(5, l - 9)),
    bristleLight: hslToHex(h, Math.max(10, Math.round(s * 0.95)), Math.min(95, l + 11)),
    glossCrest: hslToHex(h, Math.max(5, Math.round(s * 0.5)), Math.min(98, Math.round(l + (100 - l) * 0.5))),
    specularHighlight: hslToHex(h, Math.max(0, Math.round(s * 0.2)), Math.min(99, Math.round(l + (100 - l) * 0.85))),
  };
}

/**
 * Converts screen/pointer coordinates into canvas internal pixel coordinates
 */
export function getCanvasCoordinates(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number
): Point {
  if (rect.width === 0 || rect.height === 0) {
    return { x: 0, y: 0 };
  }
  const scaleX = canvasWidth / rect.width;
  const scaleY = canvasHeight / rect.height;

  const rawX = (clientX - rect.left) * scaleX;
  const rawY = (clientY - rect.top) * scaleY;

  return {
    x: Math.max(0, Math.min(canvasWidth, Math.round(rawX * 10) / 10)),
    y: Math.max(0, Math.min(canvasHeight, Math.round(rawY * 10) / 10)),
  };
}

/**
 * Calculates mid point between two points for smooth quadratic bezier curves
 */
export function getMidPoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Calculates centered aspect-ratio-preserving ("object-contain") draw rectangle
 * for placing a template image inside a full-screen canvas without stretching.
 */
export function getContainDrawRect(
  imgWidth: number,
  imgHeight: number,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number; width: number; height: number } {
  if (imgWidth <= 0 || imgHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, width: Math.max(0, containerWidth), height: Math.max(0, containerHeight) };
  }
  const scale = Math.min(containerWidth / imgWidth, containerHeight / imgHeight);
  const width = Math.round(imgWidth * scale);
  const height = Math.round(imgHeight * scale);
  const x = Math.round((containerWidth - width) / 2);
  const y = Math.round((containerHeight - height) / 2);
  return { x, y, width, height };
}

/**
 * Real-time pointer stabilizer using distance-adaptive Exponential Moving Average (EMA)
 * to eliminate hand/mouse jitter while keeping fast curves responsive.
 */
export function stabilizePointerPoint(
  previous: Point,
  raw: Point,
  smoothingStrength: number = 0.48,
  minDistance: number = 1.2
): Point | null {
  const dx = raw.x - previous.x;
  const dy = raw.y - previous.y;
  const dist = Math.hypot(dx, dy);

  if (dist < minDistance) {
    return null;
  }

  // Adaptive alpha: fast movements track closely (less lag), slow strokes stabilize heavily
  const speedBoost = Math.min(0.42, dist / 45);
  const alpha = Math.max(0.22, Math.min(0.92, (1 - smoothingStrength) + speedBoost));

  const prevPressure = typeof previous.pressure === 'number' ? previous.pressure : 0.5;
  const rawPressure = typeof raw.pressure === 'number' ? raw.pressure : 0.5;

  return {
    x: Math.round((previous.x + dx * alpha) * 10) / 10,
    y: Math.round((previous.y + dy * alpha) * 10) / 10,
    pressure: Math.round((prevPressure + (rawPressure - prevPressure) * alpha) * 100) / 100,
  };
}

/**
 * Smooths raw stroke points using weighted 3-point moving average
 * to filter sensor jitter while preserving shape trajectory, endpoints, and pressure.
 */
export function smoothPoints(points: Point[]): Point[] {
  if (points.length <= 2) return [...points];

  const smoothed: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    smoothed.push({
      x: Math.round((0.25 * prev.x + 0.5 * curr.x + 0.25 * next.x) * 10) / 10,
      y: Math.round((0.25 * prev.y + 0.5 * curr.y + 0.25 * next.y) * 10) / 10,
      ...(typeof curr.pressure === 'number' ? { pressure: curr.pressure } : {}),
    });
  }
  smoothed.push(points[points.length - 1]);
  return smoothed;
}

/**
 * High-quality multi-pass stroke smoothing pipeline combining iterative corner-aware
 * Gaussian smoothing with optional Chaikin curve refinement for silky freehand strokes.
 */
export function smoothStrokePoints(
  points: Point[],
  options?: { passes?: number; subdivide?: boolean; cornerThresholdDeg?: number }
): Point[] {
  if (points.length <= 2) return [...points];

  const passes = Math.max(1, options?.passes ?? 2);
  const subdivide = options?.subdivide ?? false;
  const cornerThresholdDeg = options?.cornerThresholdDeg ?? 75;
  const minCosForSmooth = Math.cos(((180 - cornerThresholdDeg) * Math.PI) / 180);

  let current: Point[] = points.map((p) => ({ ...p }));

  for (let pass = 0; pass < passes; pass++) {
    const nextPass: Point[] = [current[0]];
    for (let i = 1; i < current.length - 1; i++) {
      const prev = current[i - 1];
      const curr = current[i];
      const next = current[i + 1];

      // Corner preservation check: keep crisp isolated corners sharp,
      // but always smooth alternating high-frequency zigzag tremor.
      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;
      const len1 = Math.hypot(v1x, v1y);
      const len2 = Math.hypot(v2x, v2y);

      let isSharpCorner = false;
      if (len1 > 12 && len2 > 12) {
        const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
        if (dot < minCosForSmooth) {
          // Check if adjacent segment reverses winding (oscillating jitter)
          const crossCurr = v1x * v2y - v1y * v2x;
          let isAlternatingJitter = false;
          if (i + 2 < current.length) {
            const next2 = current[i + 2];
            const v3x = next2.x - next.x;
            const v3y = next2.y - next.y;
            const crossNext = v2x * v3y - v2y * v3x;
            if (crossCurr * crossNext < 0) {
              isAlternatingJitter = true;
            }
          }
          if (i - 2 >= 0) {
            const prev2 = current[i - 2];
            const v0x = prev.x - prev2.x;
            const v0y = prev.y - prev2.y;
            const crossPrev = v0x * v1y - v0y * v1x;
            if (crossPrev * crossCurr < 0) {
              isAlternatingJitter = true;
            }
          }
          isSharpCorner = !isAlternatingJitter;
        }
      }

      if (isSharpCorner) {
        nextPass.push(curr);
      } else {
        const pressure =
          typeof curr.pressure === 'number' ? curr.pressure : 0.5;
        nextPass.push({
          x: Math.round((0.25 * prev.x + 0.5 * curr.x + 0.25 * next.x) * 10) / 10,
          y: Math.round((0.25 * prev.y + 0.5 * curr.y + 0.25 * next.y) * 10) / 10,
          pressure,
        });
      }
    }
    nextPass.push(current[current.length - 1]);
    current = nextPass;
  }

  // Optional Chaikin corner-cutting subdivision for ultra-smooth freehand contours
  if (subdivide && current.length >= 3 && current.length < 400) {
    const refined: Point[] = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const p0 = current[i];
      const p1 = current[i + 1];
      const pr0 = typeof p0.pressure === 'number' ? p0.pressure : 0.5;
      const pr1 = typeof p1.pressure === 'number' ? p1.pressure : 0.5;

      if (i > 0) {
        refined.push({
          x: Math.round((0.75 * p0.x + 0.25 * p1.x) * 10) / 10,
          y: Math.round((0.75 * p0.y + 0.25 * p1.y) * 10) / 10,
          pressure: Math.round((0.75 * pr0 + 0.25 * pr1) * 100) / 100,
        });
      }
      if (i < current.length - 2) {
        refined.push({
          x: Math.round((0.25 * p0.x + 0.75 * p1.x) * 10) / 10,
          y: Math.round((0.25 * p0.y + 0.75 * p1.y) * 10) / 10,
          pressure: Math.round((0.25 * pr0 + 0.75 * pr1) * 100) / 100,
        });
      }
    }
    refined.push(current[current.length - 1]);
    return refined;
  }

  return current;
}

/**
 * Draws a smooth stroke path using quadratic curve approximation between consecutive midpoints,
 * dynamically scaling stroke width and opacity based on PointerEvent pressure.
 */
export function drawQuadraticPath(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length === 0) return;

  const baseLineWidth = ctx.lineWidth;
  const baseAlpha = ctx.globalAlpha;

  if (points.length === 1) {
    const p = points[0];
    const pressure = typeof p.pressure === 'number' ? p.pressure : 0.5;
    const dynamicWidth = baseLineWidth * (0.4 + pressure * 1.2);
    ctx.save();
    ctx.lineWidth = dynamicWidth;
    ctx.globalAlpha = Math.min(1.0, baseAlpha * (0.5 + pressure * 0.8));
    ctx.beginPath();
    ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (points.length === 2) {
    const p0 = points[0];
    const p1 = points[1];
    const pAvg = { pressure: ((p0.pressure || 0.5) + (p1.pressure || 0.5)) / 2 };
    const pressure = pAvg.pressure;
    ctx.save();
    ctx.lineWidth = baseLineWidth * (0.4 + pressure * 1.2);
    ctx.globalAlpha = Math.min(1.0, baseAlpha * (0.5 + pressure * 0.8));
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Continuous segment-by-segment quadratic curves with per-segment pressure profiling
  let prevMid: Point = points[0];
  for (let i = 0; i < points.length - 1; i++) {
    const pCurr = points[i];
    const pNext = points[i + 1];
    const nextMid = i === points.length - 2 ? pNext : getMidPoint(pCurr, pNext);
    const pressure = ((pCurr.pressure || 0.5) + (pNext.pressure || 0.5)) / 2;

    ctx.save();
    ctx.lineWidth = baseLineWidth * (0.4 + pressure * 1.2);
    ctx.globalAlpha = Math.min(1.0, baseAlpha * (0.5 + pressure * 0.8));

    ctx.beginPath();
    ctx.moveTo(prevMid.x, prevMid.y);
    if (i === 0 || i === points.length - 2) {
      ctx.lineTo(nextMid.x, nextMid.y);
    } else {
      ctx.quadraticCurveTo(pCurr.x, pCurr.y, nextMid.x, nextMid.y);
    }
    ctx.stroke();
    ctx.restore();

    prevMid = nextMid;
  }
}

/**
 * Creates a new stroke object with optional paint finish and two-tone gradient
 */
export function createStroke(
  tool: ToolType,
  color: string,
  size: number,
  opacity: number,
  startPoint: Point,
  colorEnd?: string,
  paintFinish?: PaintFinish
): Stroke {
  return {
    id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    tool,
    color,
    size: Math.max(1, size),
    opacity: Math.max(0.05, Math.min(1, opacity)),
    points: [startPoint],
    ...(colorEnd ? { colorEnd } : {}),
    ...(paintFinish ? { paintFinish } : {}),
  };
}

/**
 * Toggles horizontal or vertical mirror symmetry axis independently.
 * Turning both axes on produces 'quad' (4-way mirror); turning both off produces 'none'.
 */
export function toggleMirrorAxis(
  currentMode: MirrorMode,
  axis: 'horizontal' | 'vertical'
): MirrorMode {
  const hasH = currentMode === 'horizontal' || currentMode === 'quad';
  const hasV = currentMode === 'vertical' || currentMode === 'quad';

  const nextH = axis === 'horizontal' ? !hasH : hasH;
  const nextV = axis === 'vertical' ? !hasV : hasV;

  if (nextH && nextV) return 'quad';
  if (nextH) return 'horizontal';
  if (nextV) return 'vertical';
  return 'none';
}

/**
 * Generates reflected strokes across the canvas center lines based on active MirrorMode:
 * - 'horizontal': reflects points horizontally across x = canvasWidth / 2
 * - 'vertical': reflects points vertically across y = canvasHeight / 2
 * - 'quad': reflects horizontally, vertically, and diagonally (4-way)
 */
export function createMirroredStrokes(
  baseStroke: Stroke,
  mirrorMode: MirrorMode,
  canvasWidth: number,
  canvasHeight: number
): Stroke[] {
  const result: Stroke[] = [baseStroke];
  if (mirrorMode === 'none' || baseStroke.points.length === 0) {
    return result;
  }

  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  if (mirrorMode === 'horizontal' || mirrorMode === 'quad') {
    result.push({
      ...baseStroke,
      id: `${baseStroke.id}_symH`,
      points: baseStroke.points.map((p) => ({
        ...p,
        x: Math.round((cx + (cx - p.x)) * 10) / 10,
      })),
    });
  }

  if (mirrorMode === 'vertical' || mirrorMode === 'quad') {
    result.push({
      ...baseStroke,
      id: `${baseStroke.id}_symV`,
      points: baseStroke.points.map((p) => ({
        ...p,
        y: Math.round((cy + (cy - p.y)) * 10) / 10,
      })),
    });
  }

  if (mirrorMode === 'quad') {
    result.push({
      ...baseStroke,
      id: `${baseStroke.id}_symQ`,
      points: baseStroke.points.map((p) => ({
        ...p,
        x: Math.round((cx + (cx - p.x)) * 10) / 10,
        y: Math.round((cy + (cy - p.y)) * 10) / 10,
      })),
    });
  }

  return result;
}

/**
 * Applies distinct tool physics and rendering characteristics to a Canvas context:
 * - Pen: Sharp, thin, crisp precision ink line (zero blur, fine needle stroke)
 * - Pencil: Blunt, rounded graphite lead with soft textured edge and graphite density
 * - Paint (Brush): Rich original drawing paint (full body, viscous wet paint edge)
 * - Marker / Highlighter: Translucent broad wash
 * - Eraser: Clean subtraction
 */
export function applyToolStyleToContext(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  mode: 'canvas' | 'export' = 'canvas'
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stroke.tool === 'eraser') {
    if (mode === 'export') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#FFFFFF';
      ctx.fillStyle = '#FFFFFF';
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    }
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = stroke.size * 1.6;
    ctx.shadowBlur = 0;
    return;
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;

  if (stroke.tool === 'calligraphy') {
    // 1. Sharp Pen / Calligraphy: Clean, crisp razor-sharp needle line
    ctx.lineWidth = Math.max(1.2, stroke.size * 0.65);
    ctx.globalAlpha = stroke.opacity;
    ctx.shadowBlur = 0;
  } else if (stroke.tool === 'pencil') {
    // 2. Blunt Pencil: Rounded blunted lead with soft graphite edge
    ctx.lineWidth = stroke.size * 1.15;
    ctx.globalAlpha = stroke.opacity * 0.82;
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = Math.max(1.2, stroke.size * 0.2);
  } else if (stroke.tool === 'brush') {
    // 3. Paint Brush: Rich viscous body, wet paint edge
    ctx.lineWidth = stroke.size * 1.4;
    ctx.globalAlpha = Math.min(1.0, stroke.opacity * 0.95);
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = Math.max(2.5, stroke.size * 0.35);
  } else if (stroke.tool === 'oil') {
    // Oil Brush: Thick heavy impasto body
    ctx.lineWidth = stroke.size * 1.7;
    ctx.globalAlpha = Math.min(1.0, stroke.opacity * 0.96);
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = Math.max(2, stroke.size * 0.3);
  } else if (stroke.tool === 'watercolor') {
    // Watercolor Brush: Soft bleeding wash
    ctx.lineWidth = stroke.size * 1.9;
    ctx.globalAlpha = Math.min(1.0, stroke.opacity * 0.45);
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = Math.max(4, stroke.size * 0.6);
  } else if (stroke.tool === 'crayon') {
    // Crayon: Wax tooth stroke
    ctx.lineWidth = stroke.size * 1.35;
    ctx.globalAlpha = stroke.opacity * 0.85;
    ctx.shadowBlur = 0;
  } else if (stroke.tool === 'airbrush') {
    // Airbrush: Soft spray halo
    ctx.lineWidth = stroke.size * 2.1;
    ctx.globalAlpha = stroke.opacity * 0.28;
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = Math.max(6, stroke.size * 1.1);
  } else if (stroke.tool === 'bucket') {
    // 4. Paint Bucket: Broad, ultra-thick, luscious opaque paint laydown
    ctx.lineWidth = stroke.size * 2.8;
    ctx.globalAlpha = Math.min(1.0, stroke.opacity * 1.0);
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = Math.max(4, stroke.size * 0.5);
  } else if (stroke.tool === 'highlighter') {
    // 5. Marker / Highlighter: Broad semi-transparent wash
    ctx.lineWidth = stroke.size * 2.2;
    ctx.globalAlpha = stroke.opacity * 0.35;
    ctx.shadowBlur = 0;
  } else {
    ctx.lineWidth = stroke.size;
    ctx.globalAlpha = stroke.opacity;
    ctx.shadowBlur = 0;
  }
}

const rasterCache = new Map<string, HTMLImageElement>();

export function preloadStrokeRasterImage(dataUrl: string, onLoad?: () => void): HTMLImageElement | null {
  if (typeof Image === 'undefined' || !dataUrl) return null;
  const existing = rasterCache.get(dataUrl);
  if (existing) {
    if (existing.complete) return existing;
    if (onLoad) existing.addEventListener('load', onLoad, { once: true });
    return null;
  }
  const img = new Image();
  if (onLoad) img.addEventListener('load', onLoad, { once: true });
  img.src = dataUrl;
  rasterCache.set(dataUrl, img);
  return img.complete ? img : null;
}

/**
 * Renders an authentic physical paint stroke, shape, text, or raster patch to a canvas context.
 */
export function renderStrokeToContext(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  mode: 'canvas' | 'export' = 'canvas'
): void {
  // Handle rectangular clear / cut operations
  if (stroke.operation === 'erase-rect' && stroke.rect) {
    const { x, y, width, height } = stroke.rect;
    ctx.save();
    if (mode === 'export') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = stroke.fillColor || '#FFFFFF';
      ctx.fillRect(x, y, width, height);
    } else {
      ctx.clearRect(x, y, width, height);
    }
    ctx.restore();
    return;
  }

  // Handle pasted / rotated / flipped raster patch operations
  if ((stroke.operation === 'paste-image' || stroke.operation === 'replace-bitmap') && stroke.rect && stroke.rasterDataUrl) {
    const img = preloadStrokeRasterImage(stroke.rasterDataUrl);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = stroke.opacity ?? 1;
      ctx.drawImage(img, stroke.rect.x, stroke.rect.y, stroke.rect.width, stroke.rect.height);
      ctx.restore();
    }
    return;
  }

  // Handle Text tool rendering
  if (stroke.tool === 'text' && stroke.text && stroke.points.length > 0) {
    const pt = stroke.points[0];
    const fontSize = Math.max(10, stroke.fontSize || Math.max(14, stroke.size * 2.5));
    const fontFamily = stroke.fontFamily || '"Segoe UI", Arial, sans-serif';
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = stroke.opacity;
    ctx.fillStyle = stroke.color;
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    const lines = stroke.text.split('\n');
    const lineHeight = fontSize * 1.25;
    lines.forEach((line, idx) => {
      ctx.fillText(line, pt.x, pt.y + idx * lineHeight);
    });
    ctx.restore();
    return;
  }

  // Handle geometric Shapes tool
  if (stroke.tool === 'shape' && stroke.shapeType && stroke.points.length > 0) {
    renderShapeToContext(
      ctx,
      stroke.shapeType,
      stroke.points,
      stroke.color,
      stroke.fillColor || '#FFFFFF',
      stroke.size,
      stroke.opacity,
      stroke.outlineStyle || 'solid',
      stroke.fillStyle || 'none'
    );
    return;
  }

  if (stroke.points.length === 0) return;

  if (stroke.tool === 'bucket') {
    const pt = stroke.points[0];
    if (pt) {
      floodFill(ctx, pt.x, pt.y, stroke.color, stroke.opacity);
    }
    return;
  }

  if (stroke.tool === 'eraser') {
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    drawQuadraticPath(ctx, stroke.points);
    ctx.restore();
    return;
  }

  const palette = getPaintColorPalette(stroke.color);

  // Resolves linear gradient between start and end point if colorEnd is present
  const getGradientOrColor = (fallback: string) => {
    if (stroke.colorEnd && stroke.colorEnd !== stroke.color && stroke.points.length > 1) {
      const p1 = stroke.points[0];
      const p2 = stroke.points[stroke.points.length - 1];
      const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      grad.addColorStop(0, stroke.color);
      grad.addColorStop(1, stroke.colorEnd);
      return grad;
    }
    return fallback;
  };

  if (stroke.tool === 'brush' || stroke.tool === 'oil') {
    const sizeScale = stroke.tool === 'oil' ? 1.2 : 1;
    // 1. Physical 3D Impasto Occlusion Shadow
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.translate(Math.max(0.6, stroke.size * 0.08), Math.max(0.9, stroke.size * 0.12));
    ctx.lineWidth = stroke.size * 1.4 * sizeScale;
    ctx.strokeStyle = `rgba(15, 23, 42, ${0.14 * stroke.opacity})`;
    ctx.shadowColor = `rgba(15, 23, 42, ${0.2 * stroke.opacity})`;
    ctx.shadowBlur = Math.max(1.8, stroke.size * 0.25);
    drawQuadraticPath(ctx, stroke.points);
    ctx.restore();

    // 2. Viscous Base Paint Body
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    ctx.strokeStyle = getGradientOrColor(stroke.color);
    ctx.fillStyle = stroke.color;
    drawQuadraticPath(ctx, stroke.points);
    ctx.restore();

    // 3. Longitudinal Bristle Texture & Grooves
    if (stroke.points.length > 1 && stroke.size >= 3) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.translate(stroke.size * 0.08, stroke.size * 0.08);
      ctx.lineWidth = Math.max(1, stroke.size * 0.35 * sizeScale);
      ctx.strokeStyle = palette.bristleDark;
      ctx.globalAlpha = Math.min(1.0, stroke.opacity * 0.32);
      drawQuadraticPath(ctx, stroke.points);
      ctx.restore();

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.translate(-stroke.size * 0.1, -stroke.size * 0.1);
      ctx.lineWidth = Math.max(1, stroke.size * 0.38 * sizeScale);
      ctx.strokeStyle = palette.bristleLight;
      ctx.globalAlpha = Math.min(1.0, stroke.opacity * 0.36);
      drawQuadraticPath(ctx, stroke.points);
      ctx.restore();
    }

    // 4. Wet Specular Gloss Crest
    if (stroke.size >= 2) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.translate(-Math.max(0.4, stroke.size * 0.08), -Math.max(0.5, stroke.size * 0.1));
      ctx.lineWidth = Math.max(0.8, stroke.size * 0.28);
      ctx.strokeStyle = palette.glossCrest;
      ctx.globalAlpha = Math.min(1.0, stroke.opacity * 0.45);
      drawQuadraticPath(ctx, stroke.points);

      if (stroke.size >= 6) {
        ctx.lineWidth = Math.max(0.5, stroke.size * 0.12);
        ctx.strokeStyle = palette.specularHighlight;
        ctx.globalAlpha = Math.min(1.0, stroke.opacity * 0.55);
        drawQuadraticPath(ctx, stroke.points);
      }
      ctx.restore();
    }
    return;
  }

  if (stroke.tool === 'airbrush') {
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    drawQuadraticPath(ctx, stroke.points);
    // Deterministic fine spray speckle dots along stroke
    const radius = stroke.size * 1.4;
    ctx.fillStyle = stroke.color;
    for (let i = 0; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      for (let d = 0; d < 6; d++) {
        const angle = ((i * 7 + d * 13) % 360) * (Math.PI / 180);
        const r = (((i * 19 + d * 31) % 100) / 100) * radius;
        ctx.globalAlpha = stroke.opacity * 0.22;
        ctx.fillRect(p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r, 1.5, 1.5);
      }
    }
    ctx.restore();
    return;
  }

  if (stroke.tool === 'watercolor') {
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    drawQuadraticPath(ctx, stroke.points);
    ctx.lineWidth = stroke.size * 1.25;
    ctx.globalAlpha = stroke.opacity * 0.3;
    drawQuadraticPath(ctx, stroke.points);
    ctx.restore();
    return;
  }

  if (stroke.tool === 'crayon') {
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    ctx.setLineDash([Math.max(2, stroke.size * 0.5), 1.5]);
    drawQuadraticPath(ctx, stroke.points);
    ctx.setLineDash([1.5, 2.5]);
    ctx.translate(1, -1);
    ctx.globalAlpha = stroke.opacity * 0.45;
    drawQuadraticPath(ctx, stroke.points);
    ctx.restore();
    return;
  }

  if (stroke.tool === 'calligraphy') {
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    ctx.strokeStyle = getGradientOrColor(stroke.color);
    ctx.fillStyle = stroke.color;
    drawQuadraticPath(ctx, stroke.points);

    if (stroke.size >= 4 && stroke.points.length > 1) {
      ctx.lineWidth = Math.max(0.8, stroke.size * 0.3);
      ctx.strokeStyle = palette.bristleDark;
      ctx.globalAlpha = Math.min(1.0, stroke.opacity * 0.35);
      drawQuadraticPath(ctx, stroke.points);
    }
    ctx.restore();
    return;
  }

  if (stroke.tool === 'pencil') {
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    drawQuadraticPath(ctx, stroke.points);

    if (stroke.size >= 2 && stroke.points.length > 1) {
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = Math.max(1, stroke.size * 0.65);
      ctx.strokeStyle = palette.bristleDark;
      ctx.globalAlpha = stroke.opacity * 0.25;
      drawQuadraticPath(ctx, stroke.points);
    }
    ctx.restore();
    return;
  }

  if (stroke.tool === 'highlighter') {
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    drawQuadraticPath(ctx, stroke.points);

    if (stroke.size >= 4 && stroke.points.length > 1) {
      ctx.lineWidth = Math.max(1, stroke.size * 2.1);
      ctx.strokeStyle = palette.bristleDark;
      ctx.globalAlpha = Math.min(1.0, stroke.opacity * 0.16);
      drawQuadraticPath(ctx, stroke.points);
    }
    ctx.restore();
    return;
  }

  ctx.save();
  applyToolStyleToContext(ctx, stroke, mode);
  drawQuadraticPath(ctx, stroke.points);
  ctx.restore();
}

/**
 * Manages Undo / Redo history state
 */
export class HistoryManager {
  private undoStack: Stroke[][] = [];
  private redoStack: Stroke[][] = [];
  private maxDepth: number;

  constructor(maxDepth: number = 30) {
    this.maxDepth = maxDepth;
  }

  pushState(strokes: Stroke[]): void {
    // Clone strokes list
    this.undoStack.push([...strokes]);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    // Clear redo on new action
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(currentStrokes: Stroke[]): Stroke[] | null {
    if (!this.canUndo()) return null;
    const previous = this.undoStack.pop()!;
    this.redoStack.push([...currentStrokes]);
    return previous;
  }

  redo(currentStrokes: Stroke[]): Stroke[] | null {
    if (!this.canRedo()) return null;
    const next = this.redoStack.pop()!;
    this.undoStack.push([...currentStrokes]);
    return next;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

/**
 * Generates clean filename for exported JPG, PNG, or SVG
 */
export function generateArtworkFilename(
  title: string,
  extension: 'png' | 'jpg' | 'svg' = 'png'
): string {
  const cleanTitle = (title.trim() || 'Untitled Artwork')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 30);
  const dateStr = new Date().toISOString().slice(0, 10);
  return `Pixora_${cleanTitle}_${dateStr}.${extension}`;
}

function escapeXmlText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts stroke quadratic path points to an SVG path d attribute string
 */
export function strokePointsToSvgPath(points: Point[]): string {
  if (points.length <= 1) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mid = getMidPoint(points[i], points[i + 1]);
    d += ` Q ${points[i].x} ${points[i].y} ${mid.x} ${mid.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Exports strokes to a clean, valid, standalone SVG document string
 */
export function exportStrokesToSvgString(
  strokes: Stroke[],
  options?: {
    width?: number;
    height?: number;
    title?: string;
    includeWatermark?: boolean;
    includeTemplateGuide?: boolean;
    templateSvgPath?: string;
    templateMediaUrl?: string;
  }
): string {
  const width = options?.width || 1200;
  const height = options?.height || 1200;
  const title = escapeXmlText(options?.title || 'PIXORA Artwork');
  const includeWatermark = options?.includeWatermark ?? true;

  let elements = '';
  let defs = '';

  // Background rect
  elements += `  <!-- White Paper Background -->\n  <rect width="${width}" height="${height}" fill="#FFFFFF" />\n`;

  // Template guide if requested
  if (options?.includeTemplateGuide) {
    if (options.templateSvgPath) {
      const scale = width / 200;
      elements += `  <!-- Template Vector Guide -->\n  <path d="${options.templateSvgPath}" fill="none" stroke="#94A3B8" stroke-width="4" stroke-dasharray="8 6" stroke-linecap="round" stroke-linejoin="round" transform="scale(${scale})" opacity="0.5" />\n`;
    } else if (options.templateMediaUrl) {
      elements += `  <!-- Template Media Guide -->\n  <image href="${options.templateMediaUrl}" x="0" y="0" width="${width}" height="${height}" opacity="0.45" />\n`;
    }
  }

  elements += `  <!-- User Artwork Strokes -->\n`;

  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i];

    // Rectangular cut/erase patches
    if (stroke.operation === 'erase-rect' && stroke.rect) {
      const { x, y, width: rw, height: rh } = stroke.rect;
      elements += `  <rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${stroke.fillColor || '#FFFFFF'}" />\n`;
      continue;
    }

    // Embedded raster layers (clipboard paste, rotate, crop, layer filters)
    if (
      (stroke.operation === 'paste-image' || stroke.operation === 'replace-bitmap') &&
      stroke.rect &&
      stroke.rasterDataUrl
    ) {
      const { x, y, width: rw, height: rh } = stroke.rect;
      const op = stroke.opacity ?? 1;
      elements += `  <image href="${stroke.rasterDataUrl}" x="${x}" y="${y}" width="${rw}" height="${rh}" preserveAspectRatio="none" opacity="${op}" />\n`;
      continue;
    }

    if (stroke.points.length === 0) continue;

    // Text annotations
    if (stroke.tool === 'text' && stroke.text) {
      const pt = stroke.points[0];
      const fontSize = Math.max(10, stroke.fontSize || Math.max(14, stroke.size * 2.5));
      const fontFamily = escapeXmlText(stroke.fontFamily || 'Segoe UI, Arial, sans-serif');
      const lines = stroke.text.split('\n');
      const lineHeight = fontSize * 1.25;
      if (lines.length === 1) {
        elements += `  <text x="${pt.x}" y="${pt.y + fontSize}" fill="${stroke.color}" font-family="${fontFamily}" font-size="${fontSize}" opacity="${stroke.opacity}">${escapeXmlText(lines[0])}</text>\n`;
      } else {
        elements += `  <text x="${pt.x}" y="${pt.y + fontSize}" fill="${stroke.color}" font-family="${fontFamily}" font-size="${fontSize}" opacity="${stroke.opacity}">`;
        lines.forEach((line, idx) => {
          const dy = idx === 0 ? 0 : lineHeight;
          elements += `<tspan x="${pt.x}" dy="${dy}">${escapeXmlText(line)}</tspan>`;
        });
        elements += `</text>\n`;
      }
      continue;
    }

    // Geometric & Quick Shapes
    if (stroke.tool === 'shape' && stroke.shapeType) {
      const { d, isClosed } = shapeToSvgPathData(stroke.shapeType, stroke.points);
      if (!d) continue;
      const fillAttr =
        isClosed && stroke.fillStyle && stroke.fillStyle !== 'none'
          ? `fill="${stroke.fillColor || '#FFFFFF'}"`
          : 'fill="none"';
      const strokeAttr =
        stroke.outlineStyle === 'none'
          ? 'stroke="none"'
          : `stroke="${stroke.color}" stroke-width="${Math.max(1, stroke.size)}"`;
      elements += `  <path d="${d}" ${fillAttr} ${strokeAttr} stroke-linecap="round" stroke-linejoin="round" opacity="${stroke.opacity}" />\n`;
      continue;
    }

    // Determine stroke width and opacity based on freehand tool
    let strokeWidth = stroke.size;
    let opacity = stroke.opacity;
    let strokeColor = stroke.color;

    if (stroke.tool === 'calligraphy') {
      strokeWidth = Math.max(1.2, stroke.size * 0.65);
    } else if (stroke.tool === 'pencil') {
      strokeWidth = stroke.size * 1.15;
      opacity = stroke.opacity * 0.82;
    } else if (stroke.tool === 'brush') {
      strokeWidth = stroke.size * 1.4;
      opacity = Math.min(1.0, stroke.opacity * 0.95);
    } else if (stroke.tool === 'oil') {
      strokeWidth = stroke.size * 1.7;
      opacity = Math.min(1.0, stroke.opacity * 0.96);
    } else if (stroke.tool === 'watercolor') {
      strokeWidth = stroke.size * 1.9;
      opacity = Math.min(1.0, stroke.opacity * 0.45);
    } else if (stroke.tool === 'crayon') {
      strokeWidth = stroke.size * 1.35;
      opacity = stroke.opacity * 0.85;
    } else if (stroke.tool === 'airbrush') {
      strokeWidth = stroke.size * 2.1;
      opacity = stroke.opacity * 0.28;
    } else if (stroke.tool === 'bucket') {
      strokeWidth = stroke.size * 2.8;
      opacity = Math.min(1.0, stroke.opacity * 1.0);
    } else if (stroke.tool === 'highlighter') {
      strokeWidth = stroke.size * 2.2;
      opacity = stroke.opacity * 0.35;
    } else if (stroke.tool === 'eraser') {
      strokeWidth = stroke.size * 1.6;
      strokeColor = '#FFFFFF';
      opacity = 1.0;
    }

    const palette = getPaintColorPalette(stroke.color);
    let bodyStrokeAttr = `stroke="${strokeColor}"`;

    if (stroke.colorEnd && stroke.colorEnd !== stroke.color && stroke.points.length > 1) {
      const gradId = `paint_grad_${i}`;
      const p1 = stroke.points[0];
      const p2 = stroke.points[stroke.points.length - 1];
      defs += `    <linearGradient id="${gradId}" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" gradientUnits="userSpaceOnUse">\n      <stop offset="0%" stop-color="${stroke.color}" />\n      <stop offset="100%" stop-color="${stroke.colorEnd}" />\n    </linearGradient>\n`;
      bodyStrokeAttr = `stroke="url(#${gradId})"`;
    }

    if (stroke.points.length === 1) {
      const pt = stroke.points[0];
      const radius = strokeWidth / 2;
      if (stroke.tool === 'brush') {
        // Physical paint dollop
        elements += `  <!-- Impasto Shadow Drop -->\n  <circle cx="${pt.x + 1}" cy="${pt.y + 1.2}" r="${radius}" fill="rgba(15,23,42,0.18)" opacity="${opacity * 0.5}" />\n`;
        elements += `  <circle cx="${pt.x}" cy="${pt.y}" r="${radius}" fill="${strokeColor}" opacity="${opacity}" />\n`;
        elements += `  <!-- Specular Reflection -->\n  <circle cx="${pt.x - radius * 0.3}" cy="${pt.y - radius * 0.3}" r="${radius * 0.4}" fill="${palette.glossCrest}" opacity="${opacity * 0.6}" />\n`;
      } else {
        elements += `  <circle cx="${pt.x}" cy="${pt.y}" r="${radius}" fill="${strokeColor}" opacity="${opacity}" />\n`;
      }
    } else {
      const d = strokePointsToSvgPath(stroke.points);

      if (stroke.tool === 'brush') {
        // 1. Impasto Shadow Path
        elements += `  <!-- 3D Impasto Shadow -->\n  <path d="${d}" fill="none" stroke="rgba(15,23,42,0.18)" stroke-width="${strokeWidth * 1.05}" transform="translate(1, 1.2)" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity * 0.35}" />\n`;
        // 2. Viscous Base Paint Body Path
        elements += `  <path d="${d}" fill="none" ${bodyStrokeAttr} stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />\n`;
        // 3. Longitudinal Bristle Striations
        if (stroke.size >= 3) {
          elements += `  <path d="${d}" fill="none" stroke="${palette.bristleDark}" stroke-width="${strokeWidth * 0.35}" transform="translate(0.5, 0.5)" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity * 0.3}" />\n`;
          elements += `  <path d="${d}" fill="none" stroke="${palette.bristleLight}" stroke-width="${strokeWidth * 0.38}" transform="translate(-0.5, -0.5)" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity * 0.32}" />\n`;
        }
        // 4. Wet Specular Gloss Crest
        if (stroke.size >= 2) {
          elements += `  <path d="${d}" fill="none" stroke="${palette.glossCrest}" stroke-width="${strokeWidth * 0.28}" transform="translate(-0.4, -0.6)" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity * 0.42}" />\n`;
        }
      } else {
        elements += `  <path d="${d}" fill="none" ${bodyStrokeAttr} stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />\n`;
      }
    }
  }

  // Watermark
  if (includeWatermark) {
    elements += `  <!-- Watermark -->\n  <text x="32" y="${height - 32}" fill="#64748B" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-weight="bold" font-size="22">PIXORA Studio</text>\n`;
  }

  const defsSection = defs ? `  <defs>\n${defs}  </defs>\n` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <title>${title}</title>
  <desc>Exported from PIXORA Creative Drawing &amp; Tracing Studio</desc>
${defsSection}${elements}</svg>`;
}

/**
 * Calculates stroke bounding box
 */
export function calculateStrokeBounds(stroke: Stroke): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  if (stroke.points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of stroke.points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  const padding = stroke.size / 2;
  return {
    minX: Math.max(0, minX - padding),
    minY: Math.max(0, minY - padding),
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}
