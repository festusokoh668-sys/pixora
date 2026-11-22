import { LayerFilterType } from '../types';

export interface LayerFilterSpec {
  id: LayerFilterType;
  label: string;
  cssFilter: string;
  compositeMode: GlobalCompositeOperation;
  tintColor?: string;
}

export interface LayerFilterOptions {
  opaquePaperBackground?: boolean;
  brightnessDelta?: number;
}

export const LAYER_FILTERS: Record<LayerFilterType, LayerFilterSpec> = {
  grayscale: {
    id: 'grayscale',
    label: 'Grayscale',
    cssFilter: 'grayscale(100%)',
    compositeMode: 'saturation',
    tintColor: '#808080',
  },
  sepia: {
    id: 'sepia',
    label: 'Sepia',
    cssFilter: 'sepia(100%)',
    compositeMode: 'color',
    tintColor: '#704214',
  },
  brightness: {
    id: 'brightness',
    label: 'Brightness',
    cssFilter: 'brightness(125%)',
    compositeMode: 'lighter',
    tintColor: '#404040',
  },
  invert: {
    id: 'invert',
    label: 'Invert',
    cssFilter: 'invert(100%)',
    compositeMode: 'difference',
    tintColor: '#FFFFFF',
  },
};

export function getLayerFilterSpec(filter: LayerFilterType): LayerFilterSpec {
  return LAYER_FILTERS[filter];
}

/**
 * Clamps brightness adjustment percentage into [-100, 100].
 */
export function clampBrightnessDelta(delta: number): number {
  if (!Number.isFinite(delta)) return 0;
  return Math.max(-100, Math.min(100, Math.round(delta)));
}

/**
 * Processes an RGBA ImageData pixel buffer in-place for the given filter.
 * Transparent pixels (alpha === 0) are preserved untouched.
 */
export function processImageDataPixels(
  data: Uint8ClampedArray,
  filter: LayerFilterType,
  options?: LayerFilterOptions
): Uint8ClampedArray {
  const brightnessDelta = clampBrightnessDelta(options?.brightnessDelta ?? 25);
  const brightnessOffset = Math.round((brightnessDelta / 100) * 255);

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    switch (filter) {
      case 'grayscale': {
        const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        data[i] = lum;
        data[i + 1] = lum;
        data[i + 2] = lum;
        break;
      }
      case 'sepia': {
        data[i] = Math.min(255, Math.round(0.393 * r + 0.769 * g + 0.189 * b));
        data[i + 1] = Math.min(255, Math.round(0.349 * r + 0.686 * g + 0.168 * b));
        data[i + 2] = Math.min(255, Math.round(0.272 * r + 0.534 * g + 0.131 * b));
        break;
      }
      case 'brightness': {
        data[i] = Math.max(0, Math.min(255, r + brightnessOffset));
        data[i + 1] = Math.max(0, Math.min(255, g + brightnessOffset));
        data[i + 2] = Math.max(0, Math.min(255, b + brightnessOffset));
        break;
      }
      case 'invert': {
        data[i] = 255 - r;
        data[i + 1] = 255 - g;
        data[i + 2] = 255 - b;
        break;
      }
    }
  }

  return data;
}

/**
 * Applies grayscale, sepia, brightness, or invert effects onto a destination 2D context
 * by directly processing the layer's RGBA ImageData pixels (with composite fallback
 * for headless/mocked contexts lacking getImageData/putImageData).
 */
export function applyLayerFilterToContext(
  targetCtx: CanvasRenderingContext2D,
  sourceCanvas: CanvasImageSource,
  width: number,
  height: number,
  filter: LayerFilterType,
  options?: LayerFilterOptions
): void {
  const spec = getLayerFilterSpec(filter);
  const opaquePaper = options?.opaquePaperBackground ?? false;

  targetCtx.save();
  targetCtx.clearRect(0, 0, width, height);

  if (opaquePaper && filter === 'invert') {
    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.fillRect(0, 0, width, height);
  }

  const canProcessPixels =
    typeof targetCtx.getImageData === 'function' && typeof targetCtx.putImageData === 'function';

  if (canProcessPixels) {
    targetCtx.globalCompositeOperation = 'source-over';
    targetCtx.drawImage(sourceCanvas, 0, 0, width, height);
    const imageData = targetCtx.getImageData(0, 0, width, height);
    processImageDataPixels(imageData.data, filter, options);
    targetCtx.putImageData(imageData, 0, 0);
    targetCtx.restore();
    return;
  }

  if (opaquePaper && filter === 'invert') {
    targetCtx.drawImage(sourceCanvas, 0, 0, width, height);
    targetCtx.globalCompositeOperation = 'difference';
    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.fillRect(0, 0, width, height);
    targetCtx.restore();
    return;
  }

  const supportsFilter = typeof targetCtx.filter === 'string';

  if (supportsFilter) {
    const cssFilter =
      filter === 'brightness'
        ? `brightness(${Math.max(0, 100 + clampBrightnessDelta(options?.brightnessDelta ?? 25))}%)`
        : spec.cssFilter;
    targetCtx.filter = cssFilter;
    targetCtx.globalCompositeOperation = 'source-over';
    targetCtx.drawImage(sourceCanvas, 0, 0, width, height);
    targetCtx.filter = 'none';
    targetCtx.restore();
    return;
  }

  // Fallback using globalCompositeOperation masked to existing alpha
  targetCtx.globalCompositeOperation = 'source-over';
  targetCtx.drawImage(sourceCanvas, 0, 0, width, height);

  targetCtx.globalCompositeOperation = spec.compositeMode;
  targetCtx.fillStyle = spec.tintColor || '#808080';
  targetCtx.fillRect(0, 0, width, height);

  targetCtx.globalCompositeOperation = 'destination-in';
  targetCtx.drawImage(sourceCanvas, 0, 0, width, height);
  targetCtx.restore();
}
