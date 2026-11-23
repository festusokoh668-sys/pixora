import { Point, Stroke } from '../types';

function computeMidPoint(p1: Point, p2: Point): Point {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function computePressureBrushWidth(baseLineWidth: number, pressure?: number): number {
  const p =
    typeof pressure === 'number' && Number.isFinite(pressure)
      ? Math.max(0, Math.min(1, pressure))
      : 0.5;
  return Math.max(0.6, baseLineWidth * (0.2 + p * 1.6));
}

export interface BlurRegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes a normalized 1D symmetric Gaussian convolution kernel for a given integer pixel radius.
 */
export function computeGaussianKernel(radius: number): Float32Array {
  const r = Math.max(1, Math.min(24, Math.round(radius)));
  const sigma = Math.max(0.8, r / 2);
  const twoSigmaSq = 2 * sigma * sigma;
  const size = r * 2 + 1;
  const kernel = new Float32Array(size);
  let sum = 0;

  for (let i = -r; i <= r; i++) {
    const w = Math.exp(-(i * i) / twoSigmaSq);
    kernel[i + r] = w;
    sum += w;
  }

  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

/**
 * Computes the effective Gaussian blur radius (in pixels) from brush size.
 */
export function getBlurBrushRadius(brushSize: number): number {
  const safeSize = Number.isFinite(brushSize) ? Math.max(1, brushSize) : 5;
  return Math.max(2, Math.min(18, Math.round(safeSize * 0.45 + 2)));
}

/**
 * Computes the active brush stroke diameter (in canvas pixels) for the Blur tool.
 */
export function getBlurBrushStrokeWidth(brushSize: number): number {
  const safeSize = Number.isFinite(brushSize) ? Math.max(1, brushSize) : 5;
  return Math.max(6, Math.round(safeSize * 2.2 * 10) / 10);
}

/**
 * Computes a padded pixel-aligned bounding box enclosing all stroke points,
 * brush thickness (including max pressure taper), feathering, and Gaussian kernel reach.
 */
export function getBlurStrokeBounds(
  points: Point[],
  brushWidth: number,
  blurRadius: number,
  canvasWidth: number,
  canvasHeight: number
): BlurRegionBounds | null {
  if (points.length === 0 || canvasWidth < 1 || canvasHeight < 1) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const pressureW = computePressureBrushWidth(brushWidth, p.pressure);
    const r = pressureW / 2;
    if (p.x - r < minX) minX = p.x - r;
    if (p.y - r < minY) minY = p.y - r;
    if (p.x + r > maxX) maxX = p.x + r;
    if (p.y + r > maxY) maxY = p.y + r;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;

  const pad = Math.ceil(blurRadius * 2 + brushWidth * 0.4 + 4);
  const x0 = Math.max(0, Math.floor(minX) - pad);
  const y0 = Math.max(0, Math.floor(minY) - pad);
  const x1 = Math.min(canvasWidth, Math.ceil(maxX) + pad);
  const y1 = Math.min(canvasHeight, Math.ceil(maxY) + pad);

  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Separable 2-pass premultiplied-alpha Gaussian blur on an RGBA pixel buffer.
 * When `activeMaskAlpha` (length width * height, 0..255) is provided, skips convolution work
 * outside active stroke pixels while preserving identical output inside the active mask.
 */
export function gaussianBlurImageData(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  activeMaskAlpha?: Uint8Array | Uint8ClampedArray
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  if (width <= 0 || height <= 0 || src.length < width * height * 4) {
    return out;
  }

  const r = Math.max(1, Math.min(24, Math.round(radius)));
  const kernel = computeGaussianKernel(r);

  // Track active column ranges per row so long diagonal strokes don't blur empty bbox corners
  const rowMinCol = new Int32Array(height);
  const rowMaxCol = new Int32Array(height);
  rowMinCol.fill(width);
  rowMaxCol.fill(-1);

  if (activeMaskAlpha && activeMaskAlpha.length >= width * height) {
    for (let y = 0; y < height; y++) {
      let minC = width;
      let maxC = -1;
      const rowOff = y * width;
      for (let x = 0; x < width; x++) {
        if (activeMaskAlpha[rowOff + x] > 0) {
          if (x < minC) minC = x;
          if (x > maxC) maxC = x;
        }
      }
      if (maxC >= minC) {
        const yStart = Math.max(0, y - r);
        const yEnd = Math.min(height - 1, y + r);
        for (let ny = yStart; ny <= yEnd; ny++) {
          if (minC < rowMinCol[ny]) rowMinCol[ny] = minC;
          if (maxC > rowMaxCol[ny]) rowMaxCol[ny] = maxC;
        }
      }
    }
  } else {
    rowMinCol.fill(0);
    rowMaxCol.fill(width - 1);
  }

  // Horizontal pass into premultiplied float buffer
  const horiz = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const startX = rowMinCol[y];
    const endX = rowMaxCol[y];
    if (endX < startX) continue;

    const rowOffset = y * width;
    for (let x = startX; x <= endX; x++) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;

      for (let k = -r; k <= r; k++) {
        const sx = Math.max(0, Math.min(width - 1, x + k));
        const idx = (rowOffset + sx) * 4;
        const w = kernel[k + r];
        const a = src[idx + 3];
        const pa = (a / 255) * w;
        sumR += src[idx] * pa;
        sumG += src[idx + 1] * pa;
        sumB += src[idx + 2] * pa;
        sumA += a * w;
      }

      const dstIdx = (rowOffset + x) * 4;
      horiz[dstIdx] = sumR;
      horiz[dstIdx + 1] = sumG;
      horiz[dstIdx + 2] = sumB;
      horiz[dstIdx + 3] = sumA;
    }
  }

  // Vertical pass + unpremultiply back to straight RGBA
  out.set(src);
  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      const pIdx = rowOff + x;
      if (activeMaskAlpha && activeMaskAlpha[pIdx] === 0) continue;

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;

      for (let k = -r; k <= r; k++) {
        const sy = Math.max(0, Math.min(height - 1, y + k));
        const idx = (sy * width + x) * 4;
        const w = kernel[k + r];
        sumR += horiz[idx] * w;
        sumG += horiz[idx + 1] * w;
        sumB += horiz[idx + 2] * w;
        sumA += horiz[idx + 3] * w;
      }

      const outIdx = pIdx * 4;
      const clampedA = Math.max(0, Math.min(255, Math.round(sumA)));
      out[outIdx + 3] = clampedA;

      if (clampedA > 0) {
        const alphaNorm = sumA / 255;
        out[outIdx] = Math.max(0, Math.min(255, Math.round(sumR / alphaNorm)));
        out[outIdx + 1] = Math.max(0, Math.min(255, Math.round(sumG / alphaNorm)));
        out[outIdx + 2] = Math.max(0, Math.min(255, Math.round(sumB / alphaNorm)));
      } else {
        out[outIdx] = 0;
        out[outIdx + 1] = 0;
        out[outIdx + 2] = 0;
      }
    }
  }

  return out;
}

/**
 * Blends original RGBA pixels with blurred RGBA pixels according to a per-pixel mask alpha (0..255),
 * using premultiplied alpha interpolation so semi-transparent boundaries soften smoothly without dark halos.
 */
export function blendBlurredPixelsWithMask(
  src: Uint8ClampedArray,
  blurred: Uint8ClampedArray,
  maskAlpha: Uint8Array | Uint8ClampedArray,
  strength: number = 1
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  const clampedStrength = Number.isFinite(strength) ? Math.max(0.05, Math.min(1, strength)) : 1;
  const pixelCount = Math.min(maskAlpha.length, Math.floor(src.length / 4));

  for (let p = 0; p < pixelCount; p++) {
    const m = maskAlpha[p];
    if (m === 0) continue;

    const w = (m / 255) * clampedStrength;
    const invW = 1 - w;
    const idx = p * 4;

    const srcA = src[idx + 3] / 255;
    const blurA = blurred[idx + 3] / 255;
    const outA = srcA * invW + blurA * w;

    out[idx + 3] = Math.max(0, Math.min(255, Math.round(outA * 255)));
    if (outA > 1e-4) {
      const rPremul = src[idx] * srcA * invW + blurred[idx] * blurA * w;
      const gPremul = src[idx + 1] * srcA * invW + blurred[idx + 1] * blurA * w;
      const bPremul = src[idx + 2] * srcA * invW + blurred[idx + 2] * blurA * w;
      out[idx] = Math.max(0, Math.min(255, Math.round(rPremul / outA)));
      out[idx + 1] = Math.max(0, Math.min(255, Math.round(gPremul / outA)));
      out[idx + 2] = Math.max(0, Math.min(255, Math.round(bPremul / outA)));
    } else {
      out[idx] = 0;
      out[idx + 1] = 0;
      out[idx + 2] = 0;
    }
  }

  return out;
}

let blurMaskCanvas: HTMLCanvasElement | null = null;
let blurScratchCanvas: HTMLCanvasElement | null = null;

function traceMaskedBlurStroke(
  maskCtx: CanvasRenderingContext2D,
  points: Point[],
  brushWidth: number,
  offsetX: number,
  offsetY: number
): void {
  if (points.length === 0) return;

  maskCtx.save();
  maskCtx.translate(-offsetX, -offsetY);
  maskCtx.lineCap = 'round';
  maskCtx.lineJoin = 'round';
  maskCtx.fillStyle = '#FFFFFF';
  maskCtx.strokeStyle = '#FFFFFF';
  maskCtx.shadowColor = '#FFFFFF';
  maskCtx.shadowBlur = Math.max(1.5, brushWidth * 0.24);

  if (points.length === 1) {
    const p = points[0];
    const w = computePressureBrushWidth(brushWidth, p.pressure);
    maskCtx.beginPath();
    maskCtx.arc(p.x, p.y, w / 2, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.restore();
    return;
  }

  // Stamp variable-pressure capsules if pressure varies significantly, otherwise one continuous quadratic path
  let minP = Infinity;
  let maxP = -Infinity;
  let avgP = 0;
  for (let i = 0; i < points.length; i++) {
    const pr = typeof points[i].pressure === 'number' ? points[i].pressure! : 0.5;
    if (pr < minP) minP = pr;
    if (pr > maxP) maxP = pr;
    avgP += pr;
  }
  avgP /= points.length;

  if (maxP - minP < 0.04) {
    maskCtx.lineWidth = computePressureBrushWidth(brushWidth, avgP);
    maskCtx.beginPath();
    maskCtx.moveTo(points[0].x, points[0].y);
    if (points.length === 2) {
      maskCtx.lineTo(points[1].x, points[1].y);
    } else {
      for (let i = 1; i < points.length - 1; i++) {
        const mid = computeMidPoint(points[i], points[i + 1]);
        maskCtx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
      }
      const last = points[points.length - 1];
      maskCtx.lineTo(last.x, last.y);
    }
    maskCtx.stroke();
    maskCtx.restore();
    return;
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const pa = typeof a.pressure === 'number' ? a.pressure : 0.5;
    const pb = typeof b.pressure === 'number' ? b.pressure : 0.5;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const minW = Math.min(
      computePressureBrushWidth(brushWidth, pa),
      computePressureBrushWidth(brushWidth, pb)
    );
    const steps = Math.max(1, Math.ceil(dist / Math.max(2, minW * 0.35)));
    for (let s = 0; s <= steps; s++) {
      if (s === 0 && i > 0) continue;
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const w = computePressureBrushWidth(brushWidth, pa + (pb - pa) * t);
      maskCtx.beginPath();
      maskCtx.arc(x, y, w / 2, 0, Math.PI * 2);
      maskCtx.fill();
    }
  }

  maskCtx.restore();
}

/**
 * Softens existing canvas pixels strictly within the stroke path using a Gaussian blur filter.
 * Supports pixel-exact ImageData separable Gaussian blur on real canvases, with a ctx.filter fallback.
 */
export function applyGaussianBlurStrokeToContext(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke
): void {
  if (stroke.points.length === 0) return;

  const brushWidth = getBlurBrushStrokeWidth(stroke.size);
  const blurRadius = getBlurBrushRadius(stroke.size);
  const canvasW = ctx.canvas?.width || 1200;
  const canvasH = ctx.canvas?.height || 730;
  const bounds = getBlurStrokeBounds(stroke.points, brushWidth, blurRadius, canvasW, canvasH);
  if (!bounds) return;

  const canProcessPixels =
    typeof ctx.getImageData === 'function' &&
    typeof ctx.putImageData === 'function' &&
    typeof document !== 'undefined';

  if (canProcessPixels) {
    const srcImageData = ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);

    if (!blurMaskCanvas) {
      blurMaskCanvas = document.createElement('canvas');
    }
    if (blurMaskCanvas.width !== bounds.width || blurMaskCanvas.height !== bounds.height) {
      blurMaskCanvas.width = bounds.width;
      blurMaskCanvas.height = bounds.height;
    }

    const maskCtx = blurMaskCanvas.getContext('2d', { willReadFrequently: true });
    if (maskCtx) {
      maskCtx.setTransform(1, 0, 0, 1, 0, 0);
      maskCtx.clearRect(0, 0, bounds.width, bounds.height);
      traceMaskedBlurStroke(maskCtx, stroke.points, brushWidth, bounds.x, bounds.y);

      const maskRgba = maskCtx.getImageData(0, 0, bounds.width, bounds.height).data;
      const maskAlpha = new Uint8Array(bounds.width * bounds.height);
      let hasMask = false;

      for (let i = 0; i < maskAlpha.length; i++) {
        const a = maskRgba[i * 4 + 3];
        maskAlpha[i] = a;
        if (a > 0) hasMask = true;
      }

      if (!hasMask) return;

      const blurredData = gaussianBlurImageData(
        srcImageData.data,
        bounds.width,
        bounds.height,
        blurRadius,
        maskAlpha
      );
      const blended = blendBlurredPixelsWithMask(
        srcImageData.data,
        blurredData,
        maskAlpha,
        stroke.opacity
      );
      srcImageData.data.set(blended);
      ctx.putImageData(srcImageData, bounds.x, bounds.y);
      return;
    }
  }

  // Fallback for mocked/non-DOM 2D contexts via CSS canvas blur filter inside clipped stroke area
  if (typeof ctx.filter === 'string' && typeof document !== 'undefined' && ctx.canvas) {
    if (!blurScratchCanvas) {
      blurScratchCanvas = document.createElement('canvas');
    }
    blurScratchCanvas.width = bounds.width;
    blurScratchCanvas.height = bounds.height;
    const sctx = blurScratchCanvas.getContext('2d');
    if (sctx) {
      sctx.clearRect(0, 0, bounds.width, bounds.height);
      sctx.filter = `blur(${blurRadius}px)`;
      sctx.drawImage(
        ctx.canvas,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        0,
        0,
        bounds.width,
        bounds.height
      );
      sctx.filter = 'none';

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = stroke.opacity;
      traceMaskedBlurStroke(ctx, stroke.points, brushWidth, 0, 0);
      ctx.clip();
      ctx.drawImage(blurScratchCanvas, bounds.x, bounds.y);
      ctx.restore();
    }
  }
}
