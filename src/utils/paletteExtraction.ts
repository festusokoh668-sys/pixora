import { RGB, normalizeHexColor, rgbToHex, rgbToHsv } from './color';

export const MAX_CUSTOM_COLORS = 10;
export const DEFAULT_EXTRACTED_PALETTE_SIZE = 8;

export interface ExtractedPaletteSwatch {
  hex: string;
  rgb: RGB;
  percentage: number;
}

export interface PaletteExtractionOptions {
  maxColors?: number;
  minColorDistance?: number;
  alphaThreshold?: number;
}

interface ColorEntry {
  rSum: number;
  gSum: number;
  bSum: number;
  r: number;
  g: number;
  b: number;
  count: number;
}

interface ColorBucket {
  entries: ColorEntry[];
  totalCount: number;
  rMin: number;
  rMax: number;
  gMin: number;
  gMax: number;
  bMin: number;
  bMax: number;
}

function buildBucket(entries: ColorEntry[]): ColorBucket {
  let rMin = 255;
  let rMax = 0;
  let gMin = 255;
  let gMax = 0;
  let bMin = 255;
  let bMax = 0;
  let totalCount = 0;

  for (let i = 0; i < entries.length; i++) {
    const s = entries[i];
    totalCount += s.count;
    if (s.r < rMin) rMin = s.r;
    if (s.r > rMax) rMax = s.r;
    if (s.g < gMin) gMin = s.g;
    if (s.g > gMax) gMax = s.g;
    if (s.b < bMin) bMin = s.b;
    if (s.b > bMax) bMax = s.b;
  }

  return { entries, totalCount, rMin, rMax, gMin, gMax, bMin, bMax };
}

function getBucketMaxRange(b: ColorBucket): { axis: 'r' | 'g' | 'b'; range: number } {
  const rRange = b.rMax - b.rMin;
  const gRange = b.gMax - b.gMin;
  const bRange = b.bMax - b.bMin;

  if (rRange >= gRange && rRange >= bRange) {
    return { axis: 'r', range: rRange };
  }
  if (gRange >= rRange && gRange >= bRange) {
    return { axis: 'g', range: gRange };
  }
  return { axis: 'b', range: bRange };
}

function computeColorDistance(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Extracts a representative custom color palette from an RGBA pixel buffer
 * using weighted Median-Cut quantization + perceptual minimum-distance deduplication.
 * Transparent pixels below `alphaThreshold` (default 64) are ignored.
 */
export function extractColorPaletteFromPixels(
  rgbaData: Uint8ClampedArray,
  width: number,
  height: number,
  options?: PaletteExtractionOptions
): ExtractedPaletteSwatch[] {
  if (!rgbaData || width <= 0 || height <= 0) return [];

  const maxColors = Math.max(
    1,
    Math.min(MAX_CUSTOM_COLORS, Math.round(options?.maxColors ?? DEFAULT_EXTRACTED_PALETTE_SIZE))
  );
  const minColorDistance = Math.max(0, options?.minColorDistance ?? 34);
  const alphaThreshold = Math.max(1, Math.min(255, Math.round(options?.alphaThreshold ?? 64)));

  const totalPixels = Math.min(width * height, Math.floor(rgbaData.length / 4));
  if (totalPixels === 0) return [];

  const stride = Math.max(1, Math.floor(totalPixels / 12000));
  const entryMap = new Map<number, ColorEntry>();
  let totalValidSamples = 0;

  for (let p = 0; p < totalPixels; p += stride) {
    const idx = p * 4;
    if (rgbaData[idx + 3] < alphaThreshold) continue;
    const r = rgbaData[idx];
    const g = rgbaData[idx + 1];
    const b = rgbaData[idx + 2];
    const key = (r << 16) | (g << 8) | b;
    const existing = entryMap.get(key);
    if (existing) {
      existing.rSum += r;
      existing.gSum += g;
      existing.bSum += b;
      existing.count += 1;
    } else {
      entryMap.set(key, { rSum: r, gSum: g, bSum: b, r, g, b, count: 1 });
    }
    totalValidSamples++;
  }

  if (totalValidSamples === 0) return [];

  const entries = Array.from(entryMap.values());
  const targetBuckets = Math.min(entries.length, Math.max(maxColors * 3, 18));
  const buckets: ColorBucket[] = [buildBucket(entries)];

  while (buckets.length < targetBuckets) {
    let bestIdx = -1;
    let bestScore = -1;
    let bestAxis: 'r' | 'g' | 'b' = 'r';

    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      if (bucket.entries.length < 2) continue;
      const { axis, range } = getBucketMaxRange(bucket);
      if (range <= 1) continue;
      const score = range * Math.sqrt(bucket.totalCount);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
        bestAxis = axis;
      }
    }

    if (bestIdx === -1) break;

    const chosen = buckets.splice(bestIdx, 1)[0];
    const sorted = [...chosen.entries].sort((a, b) => a[bestAxis] - b[bestAxis]);

    // Split near weighted population median while guaranteeing both children stay non-empty
    const halfWeight = chosen.totalCount / 2;
    let runningWeight = 0;
    let splitIdx = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      runningWeight += sorted[i].count;
      splitIdx = i + 1;
      if (runningWeight >= halfWeight) break;
    }

    const left = sorted.slice(0, splitIdx);
    const right = sorted.slice(splitIdx);

    if (left.length > 0) buckets.push(buildBucket(left));
    if (right.length > 0) buckets.push(buildBucket(right));
  }

  // Compute centroid RGB, saturation weight, and dominance for each bucket
  const rawClusters = buckets.map((bucket) => {
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;
    for (let i = 0; i < bucket.entries.length; i++) {
      const e = bucket.entries[i];
      rSum += e.rSum;
      gSum += e.gSum;
      bSum += e.bSum;
      count += e.count;
    }
    const rgb: RGB = {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count),
    };
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    const ratio = count / totalValidSamples;
    const { s } = rgbToHsv(rgb.r, rgb.g, rgb.b);
    const rankScore = ratio * (1 + (s / 100) * 0.35);

    return {
      hex,
      rgb,
      ratio,
      rankScore,
    };
  });

  rawClusters.sort((a, b) => b.rankScore - a.rankScore);

  const pickDistinct = (threshold: number): ExtractedPaletteSwatch[] => {
    const selected: ExtractedPaletteSwatch[] = [];
    const seenHex = new Set<string>();

    for (const cluster of rawClusters) {
      if (seenHex.has(cluster.hex)) continue;
      const tooClose = selected.some(
        (existing) => computeColorDistance(existing.rgb, cluster.rgb) < threshold
      );
      if (tooClose) continue;

      seenHex.add(cluster.hex);
      selected.push({
        hex: cluster.hex,
        rgb: cluster.rgb,
        percentage: Math.max(1, Math.round(cluster.ratio * 100)),
      });

      if (selected.length >= maxColors) break;
    }
    return selected;
  };

  let palette = pickDistinct(minColorDistance);
  if (palette.length < Math.min(maxColors, 4) && minColorDistance > 16) {
    const extra = pickDistinct(Math.round(minColorDistance * 0.5));
    if (extra.length > palette.length) {
      palette = extra;
    }
  }

  return palette;
}

/**
 * Merges one or more newly generated/chosen hex colors into the Custom Colors list,
 * preserving order, deduplicating case-insensitively, and capping to `maxSlots` (default 10).
 */
export function mergePaletteIntoCustomColors(
  existing: string[],
  incomingHexes: string[],
  maxSlots: number = MAX_CUSTOM_COLORS
): string[] {
  const limit = Math.max(1, Math.round(maxSlots));
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of incomingHexes) {
    const normalized = normalizeHexColor(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) return result;
  }

  for (const raw of existing) {
    const normalized = normalizeHexColor(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) return result;
  }

  return result;
}

export interface SampledImagePixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Draws a loaded HTMLImageElement or HTMLCanvasElement onto a bounded offscreen canvas
 * and reads its sampled RGBA ImageData for fast browser-side palette extraction.
 */
export function samplePixelsFromImageElement(
  source: HTMLImageElement | HTMLCanvasElement,
  maxDimension: number = 160
): SampledImagePixels | null {
  if (typeof document === 'undefined') return null;

  const srcW =
    source instanceof HTMLCanvasElement
      ? source.width
      : source.naturalWidth || source.width;
  const srcH =
    source instanceof HTMLCanvasElement
      ? source.height
      : source.naturalHeight || source.height;

  if (!srcW || !srcH || srcW < 1 || srcH < 1) return null;

  const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
  const targetW = Math.max(1, Math.round(srcW * scale));
  const targetH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, targetW, targetH);
  ctx.drawImage(source, 0, 0, targetW, targetH);
  const imageData = ctx.getImageData(0, 0, targetW, targetH);

  return {
    data: imageData.data,
    width: targetW,
    height: targetH,
  };
}
