import { Point, Stroke, ToolType, PaintFinish, MirrorMode, StampShape } from '../types';
import { DEFAULT_BUCKET_TOLERANCE, floodFill } from './floodFill';
import {
  buildMultiStopGradientColors,
  hexToHsl,
  hslToHex,
  interpolateHexColors,
  normalizeHexColor,
} from './color';
import { renderShapeToContext, shapeToSvgPathData } from './shapes';
import { applyGaussianBlurStrokeToContext, getBlurBrushStrokeWidth } from './blur';

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

export interface StabilizerConfig {
  intensity: number;
  windowSize: number;
  smoothingStrength: number;
  minDistance: number;
  previewPasses: number;
  finalPasses: number;
  subdivide: boolean;
}

/**
 * Derives cursor-averaging window, EMA damping, and stroke refinement settings
 * from a user-facing Stabilization intensity percentage (0 = raw/off, 100 = max smoothing).
 */
export function getStabilizerConfig(intensity: number): StabilizerConfig {
  const clamped = Number.isFinite(intensity)
    ? Math.max(0, Math.min(100, Math.round(intensity)))
    : 45;

  if (clamped <= 0) {
    return {
      intensity: 0,
      windowSize: 1,
      smoothingStrength: 0,
      minDistance: 0.5,
      previewPasses: 0,
      finalPasses: 0,
      subdivide: false,
    };
  }

  const t = clamped / 100;
  return {
    intensity: clamped,
    windowSize: 1 + Math.round(t * 10), // 2..11 cursor positions averaged
    smoothingStrength: Math.round(t * 0.72 * 1000) / 1000,
    minDistance: Math.round((0.5 + t * 1.4) * 100) / 100,
    previewPasses: 1,
    finalPasses: Math.max(1, Math.round(t * 4)),
    subdivide: clamped >= 35,
  };
}

/**
 * Averages recent raw cursor positions using a recency-weighted sliding window
 * sized by stabilization intensity so hand/mouse jitter cancels into smooth curves.
 */
export function averageCursorPositions(samples: Point[], intensity: number): Point {
  if (samples.length === 0) {
    return { x: 0, y: 0, pressure: 0.5 };
  }

  const latest = samples[samples.length - 1];
  const { windowSize, intensity: clamped } = getStabilizerConfig(intensity);
  if (clamped <= 0 || samples.length === 1 || windowSize <= 1) {
    return {
      x: Math.round(latest.x * 10) / 10,
      y: Math.round(latest.y * 10) / 10,
      pressure: typeof latest.pressure === 'number' ? latest.pressure : 0.5,
    };
  }

  const windowSlice = samples.slice(-windowSize);
  let sumX = 0;
  let sumY = 0;
  let sumPressure = 0;
  let totalWeight = 0;

  for (let i = 0; i < windowSlice.length; i++) {
    const pt = windowSlice[i];
    const weight = i + 1; // linear recency weighting across cursor window
    sumX += pt.x * weight;
    sumY += pt.y * weight;
    sumPressure += (typeof pt.pressure === 'number' ? pt.pressure : 0.5) * weight;
    totalWeight += weight;
  }

  return {
    x: Math.round((sumX / totalWeight) * 10) / 10,
    y: Math.round((sumY / totalWeight) * 10) / 10,
    pressure: Math.round((sumPressure / totalWeight) * 100) / 100,
  };
}

/**
 * Stabilizes an incoming cursor stream by averaging recent cursor positions
 * and blending smoothly with the previous committed point according to intensity (0..100).
 */
export function stabilizeCursorStream(
  rawBuffer: Point[],
  previousOutput: Point | null,
  intensity: number
): Point | null {
  if (rawBuffer.length === 0) return null;

  const averaged = averageCursorPositions(rawBuffer, intensity);
  if (!previousOutput) {
    return averaged;
  }

  const config = getStabilizerConfig(intensity);
  if (config.intensity <= 0) {
    const dist = Math.hypot(averaged.x - previousOutput.x, averaged.y - previousOutput.y);
    return dist < config.minDistance ? null : averaged;
  }

  return stabilizePointerPoint(
    previousOutput,
    averaged,
    config.smoothingStrength,
    config.minDistance
  );
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

const MIN_STYLUS_PRESSURE = 0.05;

/**
 * Normalizes PointerEvent pressure across stylus/pen, touch, Force Touch trackpads,
 * and standard mouse devices:
 * - Pen/touch with 0 contact pressure maps to a fine hairline taper floor (0.05).
 * - Standard mouse defaults (0 / undefined) map to neutral 0.5 (1.0x brush width),
 *   while preserving non-zero custom pressure values when supplied by hardware or tests.
 */
export function resolvePointerEventPressure(
  ev: {
    pressure?: number;
    pointerType?: string;
    buttons?: number;
  },
  options?: { enabled?: boolean }
): number {
  if (options?.enabled === false) {
    return 0.5;
  }

  const raw = ev.pressure;
  const pointerType = ev.pointerType || 'mouse';

  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 0.5;
  }

  if (pointerType === 'pen') {
    if (raw <= 0) return MIN_STYLUS_PRESSURE;
    return Math.max(MIN_STYLUS_PRESSURE, Math.min(1, Math.round(raw * 1000) / 1000));
  }

  // Touch devices without force-touch sensors report pressure === 0; treat as neutral 0.5
  if (raw <= 0) return 0.5;
  return Math.max(MIN_STYLUS_PRESSURE, Math.min(1, Math.round(raw * 1000) / 1000));
}

/**
 * Returns true if the PointerEvent device/sample supplies active pressure input
 * (e.g., stylus/pen or hardware force-touch/mouse reporting custom pressure).
 */
export function doesPointerEventProvidePressure(ev: {
  pressure?: number;
  pointerType?: string;
}): boolean {
  if (ev.pointerType === 'pen') return true;
  return (
    typeof ev.pressure === 'number' &&
    Number.isFinite(ev.pressure) &&
    ev.pressure > 0 &&
    Math.abs(ev.pressure - 0.5) > 0.001
  );
}

/**
 * Maps normalized pointer pressure (0..1) dynamically onto brush width:
 * - p = 0.05 (light taper) -> ~0.28x base width
 * - p = 0.50 (neutral mouse) -> 1.00x base width
 * - p = 1.00 (heavy press) -> 1.80x base width
 */
export function calculatePressureWidth(baseLineWidth: number, pressure?: number): number {
  const p =
    typeof pressure === 'number' && Number.isFinite(pressure)
      ? Math.max(0, Math.min(1, pressure))
      : 0.5;
  const scale = 0.2 + p * 1.6;
  return Math.max(0.6, baseLineWidth * scale);
}

/**
 * Maps normalized pointer pressure (0..1) onto stroke opacity when enabled.
 * Neutral p = 0.50 evaluates to exact 1.00x baseAlpha.
 */
export function calculatePressureOpacity(
  baseAlpha: number,
  pressure?: number,
  scaleAlpha: boolean = true
): number {
  if (!scaleAlpha) return baseAlpha;
  const p =
    typeof pressure === 'number' && Number.isFinite(pressure)
      ? Math.max(0, Math.min(1, pressure))
      : 0.5;
  return Math.min(1.0, Math.max(0.05, baseAlpha * (0.55 + p * 0.9)));
}

function getPointPressure(p: Point): number {
  return typeof p.pressure === 'number' && Number.isFinite(p.pressure) ? p.pressure : 0.5;
}

export interface PressureSpineSample {
  x: number;
  y: number;
  pressure: number;
  radius: number;
}

/**
 * Samples points and interpolated pressure radii along a smoothed quadratic spline
 * for rendering knot-free variable-width brush contours.
 */
export function samplePressureSpline(
  points: Point[],
  baseLineWidth: number
): PressureSpineSample[] {
  if (points.length === 0) return [];

  // Deduplicate near-coincident points so tangent normals stay well-defined
  const clean: Array<{ x: number; y: number; pressure: number }> = [
    { x: points[0].x, y: points[0].y, pressure: getPointPressure(points[0]) },
  ];
  for (let i = 1; i < points.length; i++) {
    const prev = clean[clean.length - 1];
    const p = points[i];
    const pr = getPointPressure(p);
    if (Math.hypot(p.x - prev.x, p.y - prev.y) >= 0.6) {
      clean.push({ x: p.x, y: p.y, pressure: pr });
    } else {
      prev.pressure = pr;
    }
  }

  if (clean.length === 1) {
    const p = clean[0];
    return [
      {
        x: p.x,
        y: p.y,
        pressure: p.pressure,
        radius: calculatePressureWidth(baseLineWidth, p.pressure) / 2,
      },
    ];
  }

  const samples: PressureSpineSample[] = [];
  const pushSample = (x: number, y: number, pressure: number) => {
    const last = samples[samples.length - 1];
    if (!last || Math.hypot(x - last.x, y - last.y) >= 1.2) {
      samples.push({
        x,
        y,
        pressure,
        radius: calculatePressureWidth(baseLineWidth, pressure) / 2,
      });
    }
  };

  if (clean.length === 2) {
    const [a, b] = clean;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.min(48, Math.max(2, Math.ceil(dist / 3)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      pushSample(
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t,
        a.pressure + (b.pressure - a.pressure) * t
      );
    }
    return samples;
  }

  let prevMid = clean[0];
  pushSample(prevMid.x, prevMid.y, prevMid.pressure);

  for (let i = 0; i < clean.length - 1; i++) {
    const pCurr = clean[i];
    const pNext = clean[i + 1];
    const isLast = i === clean.length - 2;
    const nextMid = isLast
      ? pNext
      : {
          x: (pCurr.x + pNext.x) / 2,
          y: (pCurr.y + pNext.y) / 2,
          pressure: (pCurr.pressure + pNext.pressure) / 2,
        };
    const pStart = i === 0 ? clean[0].pressure : (clean[i - 1].pressure + pCurr.pressure) / 2;
    const pEnd = nextMid.pressure;

    const segDist = Math.hypot(nextMid.x - prevMid.x, nextMid.y - prevMid.y);
    const steps = Math.min(32, Math.max(2, Math.ceil(segDist / 3)));

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (i === 0 || isLast) {
        pushSample(
          prevMid.x + (nextMid.x - prevMid.x) * t,
          prevMid.y + (nextMid.y - prevMid.y) * t,
          pStart + (pEnd - pStart) * t
        );
      } else {
        const omt = 1 - t;
        pushSample(
          omt * omt * prevMid.x + 2 * omt * t * pCurr.x + t * t * nextMid.x,
          omt * omt * prevMid.y + 2 * omt * t * pCurr.y + t * t * nextMid.y,
          pStart + (pEnd - pStart) * t
        );
      }
    }

    prevMid = nextMid;
  }

  return samples;
}

/**
 * Draws a smooth stroke path using quadratic curve approximation between consecutive midpoints,
 * dynamically scaling brush width and opacity from PointerEvent pressure without joint artifacts.
 */
export function drawQuadraticPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  options?: { scaleAlpha?: boolean }
): void {
  if (points.length === 0) return;

  const baseLineWidth = ctx.lineWidth;
  const baseAlpha = ctx.globalAlpha;
  const scaleAlpha = options?.scaleAlpha ?? true;

  if (points.length === 1) {
    const p = points[0];
    const pressure = getPointPressure(p);
    const dynamicWidth = calculatePressureWidth(baseLineWidth, pressure);
    ctx.save();
    ctx.lineWidth = dynamicWidth;
    ctx.globalAlpha = calculatePressureOpacity(baseAlpha, pressure, scaleAlpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, dynamicWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Check if stroke uses dashed grain (crayon / pencil texture pass) or has uniform pressure
  const isDashedPass = typeof ctx.getLineDash === 'function' && ctx.getLineDash().length > 0;
  let minP = Infinity;
  let maxP = -Infinity;
  let sumP = 0;
  for (let i = 0; i < points.length; i++) {
    const pr = getPointPressure(points[i]);
    if (pr < minP) minP = pr;
    if (pr > maxP) maxP = pr;
    sumP += pr;
  }
  const avgP = sumP / points.length;
  const hasVariablePressure = maxP - minP >= 0.025;

  // Uniform pressure OR dashed grain pass: stroke ONE continuous quadratic path (zero joints)
  if (!hasVariablePressure || isDashedPass) {
    ctx.save();
    ctx.lineWidth = calculatePressureWidth(baseLineWidth, avgP);
    ctx.globalAlpha = calculatePressureOpacity(baseAlpha, avgP, scaleAlpha);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      for (let i = 1; i < points.length - 1; i++) {
        const mid = getMidPoint(points[i], points[i + 1]);
        ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Variable-pressure solid stroke: build ONE closed tapered ribbon contour and fill once
  const spine = samplePressureSpline(points, baseLineWidth);
  if (spine.length === 0) return;
  if (spine.length === 1) {
    const s = spine[0];
    ctx.save();
    ctx.globalAlpha = calculatePressureOpacity(baseAlpha, s.pressure, scaleAlpha);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const leftEdge: Array<{ x: number; y: number }> = [];
  const rightEdge: Array<{ x: number; y: number }> = [];
  let startAngle = 0;
  let endAngle = 0;

  for (let i = 0; i < spine.length; i++) {
    const curr = spine[i];
    const prev = spine[Math.max(0, i - 1)];
    const next = spine[Math.min(spine.length - 1, i + 1)];
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;

    const nx = -ty;
    const ny = tx;
    const angle = Math.atan2(ny, nx);
    if (i === 0) startAngle = angle;
    if (i === spine.length - 1) endAngle = angle;

    leftEdge.push({ x: curr.x + nx * curr.radius, y: curr.y + ny * curr.radius });
    rightEdge.push({ x: curr.x - nx * curr.radius, y: curr.y - ny * curr.radius });
  }

  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.globalAlpha = calculatePressureOpacity(baseAlpha, avgP, scaleAlpha);
  ctx.beginPath();
  ctx.arc(
    spine[0].x,
    spine[0].y,
    spine[0].radius,
    startAngle + Math.PI,
    startAngle,
    true
  );
  for (let i = 1; i < leftEdge.length; i++) {
    ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
  }
  const lastSpine = spine[spine.length - 1];
  ctx.arc(
    lastSpine.x,
    lastSpine.y,
    lastSpine.radius,
    endAngle,
    endAngle - Math.PI,
    true
  );
  for (let i = rightEdge.length - 2; i >= 0; i--) {
    ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export interface GradientSpineSample extends PressureSpineSample {
  t: number;
  color: string;
}

/**
 * Resolves the optional gradient end color for a stroke based on Gradient Brush mode
 * or explicit gradient preset end color.
 */
export function resolveStrokeGradientEnd(
  strokeColor: string,
  secondaryColor: string,
  options?: { isGradientBrush?: boolean; explicitColorEnd?: string | null }
): string | undefined {
  if (options?.isGradientBrush) {
    return normalizeHexColor(secondaryColor) ?? secondaryColor;
  }
  if (options?.explicitColorEnd) {
    return normalizeHexColor(options.explicitColorEnd) ?? options.explicitColorEnd;
  }
  void strokeColor;
  return undefined;
}

/**
 * Samples a pressure-aware spline along the stroke and assigns cumulative arc-length progress `t`
 * plus the smoothly interpolated hex color between `startColor` and `endColor`.
 */
export function sampleGradientSpine(
  points: Point[],
  baseLineWidth: number,
  startColor: string,
  endColor: string
): GradientSpineSample[] {
  const spine = samplePressureSpline(points, baseLineWidth);
  if (spine.length === 0) return [];
  if (spine.length === 1) {
    return [
      {
        ...spine[0],
        t: 0,
        color: normalizeHexColor(startColor) ?? startColor,
      },
    ];
  }

  const cumulativeDist: number[] = [0];
  let totalDist = 0;
  for (let i = 1; i < spine.length; i++) {
    totalDist += Math.hypot(spine[i].x - spine[i - 1].x, spine[i].y - spine[i - 1].y);
    cumulativeDist.push(totalDist);
  }

  return spine.map((s, idx) => {
    const t = totalDist > 0 ? cumulativeDist[idx] / totalDist : idx / (spine.length - 1);
    return {
      ...s,
      t,
      color: interpolateHexColors(startColor, endColor, t),
    };
  });
}

let gradientScratchCanvas: HTMLCanvasElement | null = null;

/**
 * Draws a pressure-aware smooth stroke with continuous multi-color gradient transition
 * along the drawn path from `startColor` (primary) to `endColor` (secondary).
 */
export function drawGradientQuadraticPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  startColor: string,
  endColor: string,
  options?: { scaleAlpha?: boolean; dashEvery?: number }
): void {
  if (points.length === 0) return;

  const baseLineWidth = ctx.lineWidth;
  const baseAlpha = ctx.globalAlpha;
  const scaleAlpha = options?.scaleAlpha ?? true;

  if (points.length === 1) {
    const p = points[0];
    const pressure = getPointPressure(p);
    const radius = calculatePressureWidth(baseLineWidth, pressure) / 2;
    ctx.save();
    ctx.globalAlpha = calculatePressureOpacity(baseAlpha, pressure, scaleAlpha);
    if (typeof ctx.createRadialGradient === 'function') {
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(1, radius));
      grad.addColorStop(0, startColor);
      grad.addColorStop(1, endColor);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = startColor;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const gradientSpine = sampleGradientSpine(points, baseLineWidth, startColor, endColor);
  if (gradientSpine.length === 0) return;

  let avgPressure = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of gradientSpine) {
    avgPressure += s.pressure;
    if (s.x - s.radius < minX) minX = s.x - s.radius;
    if (s.y - s.radius < minY) minY = s.y - s.radius;
    if (s.x + s.radius > maxX) maxX = s.x + s.radius;
    if (s.y + s.radius > maxY) maxY = s.y + s.radius;
  }
  avgPressure /= gradientSpine.length;
  const effectiveAlpha = calculatePressureOpacity(baseAlpha, avgPressure, scaleAlpha);

  const stampSequence = (targetCtx: CanvasRenderingContext2D, offsetX: number, offsetY: number) => {
    const dashEvery = options?.dashEvery ?? 0;
    let stampIndex = 0;

    for (let i = 0; i < gradientSpine.length - 1; i++) {
      const a = gradientSpine[i];
      const b = gradientSpine[i + 1];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const minR = Math.max(0.8, Math.min(a.radius, b.radius));
      const stepSize = dashEvery > 0 ? Math.max(2, minR * 1.1) : Math.max(0.75, minR * 0.4);
      const subSteps = Math.max(1, Math.ceil(dist / stepSize));

      for (let step = 0; step <= subSteps; step++) {
        if (step === 0 && i > 0) continue;
        if (dashEvery > 0 && stampIndex % dashEvery === dashEvery - 1) {
          stampIndex++;
          continue;
        }
        const f = step / subSteps;
        const x = a.x + (b.x - a.x) * f - offsetX;
        const y = a.y + (b.y - a.y) * f - offsetY;
        const r = a.radius + (b.radius - a.radius) * f;
        const t = a.t + (b.t - a.t) * f;
        targetCtx.fillStyle = interpolateHexColors(startColor, endColor, t);
        targetCtx.beginPath();
        targetCtx.arc(x, y, r, 0, Math.PI * 2);
        targetCtx.fill();
        stampIndex++;
      }
    }
  };

  // For translucent strokes, composite opaque gradient stamps into an isolated scratch buffer
  // so overlapping stamps along the curve never create dark alpha seams.
  if (effectiveAlpha < 0.985 && typeof document !== 'undefined') {
    const pad = 4;
    const bx = Math.floor(minX) - pad;
    const by = Math.floor(minY) - pad;
    const bw = Math.max(2, Math.ceil(maxX - bx) + pad);
    const bh = Math.max(2, Math.ceil(maxY - by) + pad);

    if (!gradientScratchCanvas) {
      gradientScratchCanvas = document.createElement('canvas');
    }
    gradientScratchCanvas.width = bw;
    gradientScratchCanvas.height = bh;
    const sctx = gradientScratchCanvas.getContext('2d');
    if (sctx) {
      sctx.clearRect(0, 0, bw, bh);
      stampSequence(sctx, bx, by);
      ctx.save();
      ctx.globalAlpha = effectiveAlpha;
      ctx.drawImage(gradientScratchCanvas, bx, by);
      ctx.restore();
      return;
    }
  }

  ctx.save();
  ctx.globalAlpha = effectiveAlpha;
  stampSequence(ctx, 0, 0);
  ctx.restore();
}

export const STAMP_SHAPES: Array<{ id: StampShape; label: string }> = [
  { id: 'star', label: 'Star' },
  { id: 'heart', label: 'Heart' },
  { id: 'circle', label: 'Circle' },
];

/**
 * Computes rendered radius for a Stamp Brush mark based on brush size and pointer pressure.
 */
export function calculateStampRadius(baseSize: number, pressure?: number): number {
  const clampedSize = Math.max(1, Number.isFinite(baseSize) ? baseSize : 5);
  const p =
    typeof pressure === 'number' && Number.isFinite(pressure)
      ? Math.max(0.05, Math.min(1, pressure))
      : 0.5;
  const baseRadius = 7 + clampedSize * 1.8;
  const pressureScale = 0.5 + p * 1.0; // neutral p=0.5 -> 1.0x
  return Math.max(5, Math.round(baseRadius * pressureScale * 10) / 10);
}

/**
 * Samples evenly spaced stamp centers along pointer points so single taps drop one crisp
 * stamp and drags lay down a spaced trail without overlapping clutter.
 */
export function sampleStampPlacements(
  points: Point[],
  baseSize: number,
  spacingFactor: number = 2.15
): Array<{ x: number; y: number; pressure: number; radius: number }> {
  if (points.length === 0) return [];

  const first = points[0];
  const firstP = getPointPressure(first);
  const placements: Array<{ x: number; y: number; pressure: number; radius: number }> = [
    {
      x: first.x,
      y: first.y,
      pressure: firstP,
      radius: calculateStampRadius(baseSize, firstP),
    },
  ];

  let lastPlaced = placements[0];
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    const pr = getPointPressure(pt);
    const nextRadius = calculateStampRadius(baseSize, pr);
    const minSpacing = Math.max(10, Math.max(lastPlaced.radius, nextRadius) * spacingFactor);
    const dist = Math.hypot(pt.x - lastPlaced.x, pt.y - lastPlaced.y);

    if (dist >= minSpacing) {
      placements.push({
        x: pt.x,
        y: pt.y,
        pressure: pr,
        radius: nextRadius,
      });
      lastPlaced = placements[placements.length - 1];
    }
  }

  return placements;
}

/**
 * Traces a centered Star, Heart, or Circle path on a Canvas2D context for Stamp Brush marks.
 */
export function traceStampShapePath(
  ctx: CanvasRenderingContext2D,
  shape: StampShape,
  cx: number,
  cy: number,
  radius: number
): void {
  const r = Math.max(3, radius);
  ctx.beginPath();

  if (shape === 'circle') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }

  if (shape === 'star') {
    const pointsCount = 5;
    const innerR = r * 0.44;
    for (let i = 0; i < pointsCount * 2; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / pointsCount;
      const rad = i % 2 === 0 ? r : innerR;
      const px = cx + Math.cos(angle) * rad;
      const py = cy + Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    return;
  }

  // Heart centered visually at (cx, cy) within [-r, +r]
  const topY = cy - r * 0.34;
  const bottomY = cy + r * 0.92;
  ctx.moveTo(cx, bottomY);
  ctx.bezierCurveTo(
    cx - r * 1.18,
    cy + r * 0.24,
    cx - r * 0.98,
    cy - r * 0.98,
    cx,
    topY
  );
  ctx.bezierCurveTo(
    cx + r * 0.98,
    cy - r * 0.98,
    cx + r * 1.18,
    cy + r * 0.24,
    cx,
    bottomY
  );
  ctx.closePath();
}

/**
 * Converts a Stamp Brush shape at (cx, cy, radius) into an SVG path `d` string.
 */
export function stampShapeToSvgPathData(
  shape: StampShape,
  cx: number,
  cy: number,
  radius: number
): string {
  const r = Math.max(3, radius);
  const f = (n: number) => Math.round(n * 10) / 10;

  if (shape === 'circle') {
    return `M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
  }

  if (shape === 'star') {
    const pointsCount = 5;
    const innerR = r * 0.44;
    const cmds: string[] = [];
    for (let i = 0; i < pointsCount * 2; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / pointsCount;
      const rad = i % 2 === 0 ? r : innerR;
      const px = f(cx + Math.cos(angle) * rad);
      const py = f(cy + Math.sin(angle) * rad);
      cmds.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`);
    }
    cmds.push('Z');
    return cmds.join(' ');
  }

  const topY = f(cy - r * 0.34);
  const bottomY = f(cy + r * 0.92);
  return `M ${f(cx)} ${bottomY} C ${f(cx - r * 1.18)} ${f(cy + r * 0.24)}, ${f(cx - r * 0.98)} ${f(cy - r * 0.98)}, ${f(cx)} ${topY} C ${f(cx + r * 0.98)} ${f(cy - r * 0.98)}, ${f(cx + r * 1.18)} ${f(cy + r * 0.24)}, ${f(cx)} ${bottomY} Z`;
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
 * Clamps normalized symmetry axis position (0..1) inside safe canvas margins.
 */
export function clampSymmetryAxisRatio(ratio: number, min = 0.05, max = 0.95): number {
  if (!Number.isFinite(ratio)) return 0.5;
  return Math.max(min, Math.min(max, Math.round(ratio * 1000) / 1000));
}

/**
 * Toggles overall Symmetry mode on/off, remembering the last active axis
 * (defaults to 'horizontal' mirror across the vertical centerline).
 */
export function resolveSymmetryToggle(
  currentMode: MirrorMode,
  lastActiveAxis: Exclude<MirrorMode, 'none'> = 'horizontal'
): MirrorMode {
  return currentMode === 'none' ? lastActiveAxis : 'none';
}

/**
 * Returns a concise status message describing the active mirror symmetry mode.
 */
export function getMirrorModeStatusMessage(mode: MirrorMode): string {
  switch (mode) {
    case 'horizontal':
      return 'Mirror Horizontal active (left & right)';
    case 'vertical':
      return 'Mirror Vertical active (top & bottom)';
    case 'quad':
      return 'Quad Mirror active (Horizontal + Vertical)';
    default:
      return 'Mirror symmetry turned off';
  }
}

/**
 * Generates reflected strokes across the active vertical/horizontal axis guides
 * (defaulting to exact canvas center lines when axisCenter is omitted):
 * - 'horizontal': reflects points horizontally across x = cx (vertical axis guide)
 * - 'vertical': reflects points vertically across y = cy (horizontal axis guide)
 * - 'quad': reflects horizontally, vertically, and diagonally (4-way)
 */
export function createMirroredStrokes(
  baseStroke: Stroke,
  mirrorMode: MirrorMode,
  canvasWidth: number,
  canvasHeight: number,
  axisCenter?: { x?: number; y?: number }
): Stroke[] {
  const result: Stroke[] = [baseStroke];
  if (mirrorMode === 'none' || baseStroke.points.length === 0) {
    return result;
  }

  const cx = axisCenter?.x ?? canvasWidth / 2;
  const cy = axisCenter?.y ?? canvasHeight / 2;

  const needsShapeFlipFlag =
    baseStroke.tool === 'shape' &&
    baseStroke.shapeType !== 'line' &&
    baseStroke.shapeType !== 'curve' &&
    baseStroke.shapeType !== 'polygon';

  if (mirrorMode === 'horizontal' || mirrorMode === 'quad') {
    result.push({
      ...baseStroke,
      id: `${baseStroke.id}_symH`,
      ...(needsShapeFlipFlag ? { flipH: !baseStroke.flipH } : {}),
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
      ...(needsShapeFlipFlag ? { flipV: !baseStroke.flipV } : {}),
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
      ...(needsShapeFlipFlag
        ? { flipH: !baseStroke.flipH, flipV: !baseStroke.flipV }
        : {}),
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
  } else if (stroke.tool === 'blur') {
    ctx.lineWidth = getBlurBrushStrokeWidth(stroke.size);
    ctx.globalAlpha = stroke.opacity;
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
    if (stroke.flipH || stroke.flipV) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const bx = (minX + maxX) / 2;
      const by = (minY + maxY) / 2;
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(stroke.flipH ? -1 : 1, stroke.flipV ? -1 : 1);
      ctx.translate(-bx, -by);
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
      ctx.restore();
    } else {
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
    }
    return;
  }

  if (stroke.points.length === 0) return;

  if (stroke.tool === 'stamp') {
    const stampShape: StampShape = stroke.stampShape || 'star';
    const placements = sampleStampPlacements(stroke.points, stroke.size);
    const total = Math.max(1, placements.length - 1);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = stroke.opacity;

    placements.forEach((mark, idx) => {
      const fillHex =
        stroke.colorEnd && placements.length > 1
          ? interpolateHexColors(stroke.color, stroke.colorEnd, idx / total)
          : stroke.color;
      const markPalette = getPaintColorPalette(fillHex);

      // Subtle soft drop shadow for tactile stamp lift
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
      traceStampShapePath(ctx, stampShape, mark.x + 1, mark.y + 1.4, mark.radius);
      ctx.fill();
      ctx.restore();

      // Main crisp filled stamp (or two-tone linear fill when gradient mode is set on single stamp)
      ctx.save();
      if (stroke.colorEnd && placements.length === 1 && typeof ctx.createLinearGradient === 'function') {
        const grad = ctx.createLinearGradient(
          mark.x - mark.radius,
          mark.y - mark.radius,
          mark.x + mark.radius,
          mark.y + mark.radius
        );
        grad.addColorStop(0, stroke.color);
        grad.addColorStop(1, stroke.colorEnd);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = fillHex;
      }
      traceStampShapePath(ctx, stampShape, mark.x, mark.y, mark.radius);
      ctx.fill();
      ctx.lineWidth = Math.max(1, Math.min(2.2, mark.radius * 0.08));
      ctx.strokeStyle = markPalette.shadowColor;
      ctx.stroke();
      ctx.restore();
    });

    ctx.restore();
    return;
  }

  if (stroke.tool === 'bucket') {
    const pt = stroke.points[0];
    if (pt) {
      floodFill(
        ctx,
        pt.x,
        pt.y,
        stroke.color,
        stroke.opacity,
        stroke.tolerance ?? DEFAULT_BUCKET_TOLERANCE
      );
    }
    return;
  }

  if (stroke.tool === 'eraser') {
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    drawQuadraticPath(ctx, stroke.points, { scaleAlpha: false });
    ctx.restore();
    return;
  }

  if (stroke.tool === 'blur') {
    applyGaussianBlurStrokeToContext(ctx, stroke);
    return;
  }

  const palette = getPaintColorPalette(stroke.color);
  const gradientEnd = stroke.colorEnd;

  const renderPathWithOptionalGradient = (
    pathCtx: CanvasRenderingContext2D,
    options?: { scaleAlpha?: boolean; dashEvery?: number }
  ) => {
    if (gradientEnd) {
      drawGradientQuadraticPath(pathCtx, stroke.points, stroke.color, gradientEnd, options);
    } else {
      drawQuadraticPath(pathCtx, stroke.points, options);
    }
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

    // 2. Viscous Base Paint Body (solid or arc-length multi-color gradient)
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    if (gradientEnd) {
      ctx.shadowBlur = 0;
    }
    renderPathWithOptionalGradient(ctx);
    ctx.restore();

    // 3. Longitudinal Bristle Texture & Grooves
    if (stroke.points.length > 1 && stroke.size >= 3) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.translate(stroke.size * 0.08, stroke.size * 0.08);
      ctx.lineWidth = Math.max(1, stroke.size * 0.35 * sizeScale);
      ctx.strokeStyle = gradientEnd ? 'rgba(15, 23, 42, 0.22)' : palette.bristleDark;
      ctx.globalAlpha = Math.min(1.0, stroke.opacity * 0.32);
      drawQuadraticPath(ctx, stroke.points);
      ctx.restore();

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.translate(-stroke.size * 0.1, -stroke.size * 0.1);
      ctx.lineWidth = Math.max(1, stroke.size * 0.38 * sizeScale);
      ctx.strokeStyle = gradientEnd ? 'rgba(255, 255, 255, 0.35)' : palette.bristleLight;
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
      ctx.strokeStyle = gradientEnd ? 'rgba(255, 255, 255, 0.42)' : palette.glossCrest;
      ctx.globalAlpha = Math.min(1.0, stroke.opacity * 0.45);
      drawQuadraticPath(ctx, stroke.points);

      if (stroke.size >= 6) {
        ctx.lineWidth = Math.max(0.5, stroke.size * 0.12);
        ctx.strokeStyle = gradientEnd ? 'rgba(255, 255, 255, 0.6)' : palette.specularHighlight;
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
    if (gradientEnd) ctx.shadowBlur = 0;
    renderPathWithOptionalGradient(ctx);
    // Deterministic fine spray speckle dots scaled dynamically by point pressure & gradient progress
    const totalPts = Math.max(1, stroke.points.length - 1);
    for (let i = 0; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      const pressure = getPointPressure(p);
      const radius = calculatePressureWidth(stroke.size * 1.4, pressure);
      ctx.fillStyle = gradientEnd
        ? interpolateHexColors(stroke.color, gradientEnd, i / totalPts)
        : stroke.color;
      for (let d = 0; d < 6; d++) {
        const angle = ((i * 7 + d * 13) % 360) * (Math.PI / 180);
        const r = (((i * 19 + d * 31) % 100) / 100) * radius;
        ctx.globalAlpha = calculatePressureOpacity(stroke.opacity * 0.22, pressure, true);
        ctx.fillRect(p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r, 1.5, 1.5);
      }
    }
    ctx.restore();
    return;
  }

  if (stroke.tool === 'watercolor') {
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    if (gradientEnd) ctx.shadowBlur = 0;
    renderPathWithOptionalGradient(ctx);
    ctx.lineWidth = stroke.size * 1.25;
    ctx.globalAlpha = stroke.opacity * 0.3;
    renderPathWithOptionalGradient(ctx);
    ctx.restore();
    return;
  }

  if (stroke.tool === 'crayon') {
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    if (!gradientEnd) {
      ctx.setLineDash([Math.max(2, stroke.size * 0.5), 1.5]);
    }
    renderPathWithOptionalGradient(ctx, gradientEnd ? { dashEvery: 4 } : undefined);
    if (!gradientEnd) {
      ctx.setLineDash([1.5, 2.5]);
    }
    ctx.translate(1, -1);
    ctx.globalAlpha = stroke.opacity * 0.45;
    renderPathWithOptionalGradient(ctx, gradientEnd ? { dashEvery: 3 } : undefined);
    ctx.restore();
    return;
  }

  if (stroke.tool === 'calligraphy') {
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    renderPathWithOptionalGradient(ctx);

    if (stroke.size >= 4 && stroke.points.length > 1) {
      ctx.lineWidth = Math.max(0.8, stroke.size * 0.3);
      ctx.strokeStyle = gradientEnd ? 'rgba(15, 23, 42, 0.25)' : palette.bristleDark;
      ctx.globalAlpha = Math.min(1.0, stroke.opacity * 0.35);
      drawQuadraticPath(ctx, stroke.points);
    }
    ctx.restore();
    return;
  }

  if (stroke.tool === 'pencil') {
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    if (gradientEnd) ctx.shadowBlur = 0;
    renderPathWithOptionalGradient(ctx);

    if (stroke.size >= 2 && stroke.points.length > 1) {
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = Math.max(1, stroke.size * 0.65);
      ctx.strokeStyle = gradientEnd ? 'rgba(15, 23, 42, 0.2)' : palette.bristleDark;
      ctx.globalAlpha = stroke.opacity * 0.25;
      drawQuadraticPath(ctx, stroke.points);
    }
    ctx.restore();
    return;
  }

  if (stroke.tool === 'highlighter') {
    ctx.save();
    applyToolStyleToContext(ctx, stroke, mode);
    renderPathWithOptionalGradient(ctx);

    if (!gradientEnd && stroke.size >= 4 && stroke.points.length > 1) {
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
  renderPathWithOptionalGradient(ctx);
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
      let transformAttr = '';
      if (stroke.flipH || stroke.flipV) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const p of stroke.points) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        const bx = Math.round(((minX + maxX) / 2) * 10) / 10;
        const by = Math.round(((minY + maxY) / 2) * 10) / 10;
        transformAttr = ` transform="translate(${bx} ${by}) scale(${stroke.flipH ? -1 : 1} ${stroke.flipV ? -1 : 1}) translate(${-bx} ${-by})"`;
      }
      elements += `  <path d="${d}" ${fillAttr} ${strokeAttr} stroke-linecap="round" stroke-linejoin="round" opacity="${stroke.opacity}"${transformAttr} />\n`;
      continue;
    }

    // Stamp Brush shapes (star, heart, circle)
    if (stroke.tool === 'stamp') {
      const stampShape: StampShape = stroke.stampShape || 'star';
      const placements = sampleStampPlacements(stroke.points, stroke.size);
      const total = Math.max(1, placements.length - 1);
      placements.forEach((mark, idx) => {
        const fillHex =
          stroke.colorEnd && placements.length > 1
            ? interpolateHexColors(stroke.color, stroke.colorEnd, idx / total)
            : stroke.color;
        const d = stampShapeToSvgPathData(stampShape, mark.x, mark.y, mark.radius);
        elements += `  <path d="${d}" fill="${fillHex}" stroke="${getPaintColorPalette(fillHex).shadowColor}" stroke-width="${Math.max(1, Math.round(mark.radius * 0.08 * 10) / 10)}" opacity="${stroke.opacity}" />\n`;
      });
      continue;
    }

    // Blur brush only softens raster canvas pixels (skip opaque stroke vector generation)
    if (stroke.tool === 'blur') {
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
      const stops = buildMultiStopGradientColors(stroke.color, stroke.colorEnd, 5);
      const stopXml = stops
        .map((stopColor, stopIdx) => {
          const pct = Math.round((stopIdx / (stops.length - 1)) * 100);
          return `      <stop offset="${pct}%" stop-color="${stopColor}" />`;
        })
        .join('\n');
      defs += `    <linearGradient id="${gradId}" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" gradientUnits="userSpaceOnUse">\n${stopXml}\n    </linearGradient>\n`;
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

/**
 * Mirrors all vector/brush strokes across the full canvas horizontally or vertically
 * while preserving layer assignment. Flags raster/text strokes so CanvasStudio can apply
 * pixel-level flipping when raster bitmaps or text annotations are present.
 */
export function flipCanvasStrokes(
  strokes: Stroke[],
  axis: 'horizontal' | 'vertical',
  canvasWidth: number,
  canvasHeight: number
): { strokes: Stroke[]; requiresRasterFallback: boolean } {
  const requiresRasterFallback = strokes.some(
    (s) => Boolean(s.rasterDataUrl) || s.tool === 'text'
  );
  if (requiresRasterFallback) {
    return { strokes, requiresRasterFallback: true };
  }

  const transformed = strokes.map((stroke) => {
    const flippedPoints = stroke.points.map((p) => ({
      ...p,
      x: axis === 'horizontal' ? Math.round((canvasWidth - p.x) * 10) / 10 : p.x,
      y: axis === 'vertical' ? Math.round((canvasHeight - p.y) * 10) / 10 : p.y,
    }));

    const flippedRect = stroke.rect
      ? {
          ...stroke.rect,
          x:
            axis === 'horizontal'
              ? Math.round((canvasWidth - stroke.rect.x - stroke.rect.width) * 10) / 10
              : stroke.rect.x,
          y:
            axis === 'vertical'
              ? Math.round((canvasHeight - stroke.rect.y - stroke.rect.height) * 10) / 10
              : stroke.rect.y,
        }
      : undefined;

    const needsShapeFlipFlag =
      stroke.tool === 'shape' &&
      stroke.shapeType !== 'line' &&
      stroke.shapeType !== 'curve' &&
      stroke.shapeType !== 'polygon';

    return {
      ...stroke,
      points: flippedPoints,
      ...(flippedRect ? { rect: flippedRect } : {}),
      ...(needsShapeFlipFlag
        ? {
            flipH: axis === 'horizontal' ? !stroke.flipH : stroke.flipH,
            flipV: axis === 'vertical' ? !stroke.flipV : stroke.flipV,
          }
        : {}),
    };
  });

  return { strokes: transformed, requiresRasterFallback: false };
}
