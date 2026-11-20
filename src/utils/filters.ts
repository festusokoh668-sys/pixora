import { LayerFilterType } from '../types';

export interface LayerFilterSpec {
  id: LayerFilterType;
  label: string;
  cssFilter: string;
  compositeMode: GlobalCompositeOperation;
  tintColor?: string;
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
 * Applies grayscale, sepia, or invert effects onto a destination 2D context
 * using Canvas2D `filter` properties and/or `globalCompositeOperation`.
 */
export function applyLayerFilterToContext(
  targetCtx: CanvasRenderingContext2D,
  sourceCanvas: CanvasImageSource,
  width: number,
  height: number,
  filter: LayerFilterType,
  options?: {
    opaquePaperBackground?: boolean;
  }
): void {
  const spec = getLayerFilterSpec(filter);
  const opaquePaper = options?.opaquePaperBackground ?? false;

  targetCtx.save();
  targetCtx.clearRect(0, 0, width, height);

  const supportsFilter = typeof targetCtx.filter === 'string';

  if (opaquePaper && filter === 'invert') {
    // Classic Paint invert: invert the drawing layer composited over white paper
    if (supportsFilter) {
      targetCtx.fillStyle = '#FFFFFF';
      targetCtx.fillRect(0, 0, width, height);
      targetCtx.drawImage(sourceCanvas, 0, 0, width, height);

      targetCtx.globalCompositeOperation = 'difference';
      targetCtx.fillStyle = '#FFFFFF';
      targetCtx.fillRect(0, 0, width, height);
    } else {
      targetCtx.fillStyle = '#FFFFFF';
      targetCtx.fillRect(0, 0, width, height);
      targetCtx.drawImage(sourceCanvas, 0, 0, width, height);
      targetCtx.globalCompositeOperation = 'difference';
      targetCtx.fillStyle = '#FFFFFF';
      targetCtx.fillRect(0, 0, width, height);
    }
    targetCtx.restore();
    return;
  }

  if (supportsFilter) {
    targetCtx.filter = spec.cssFilter;
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
