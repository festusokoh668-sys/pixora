import { CanvasLayer, FilterHistoryEntry, LayerFilterType, Stroke } from '../types';
import { applyLayerFilterToContext, clampBrightnessDelta, getLayerFilterSpec } from './filters';
import { createInitialLayers, DEFAULT_LAYER_ID, groupStrokesByLayer, resolveStrokeLayerId } from './layers';

/**
 * Formats a concise human-readable label for an applied image filter operation.
 */
export function formatFilterHistoryLabel(
  filter: LayerFilterType,
  brightnessDelta?: number
): string {
  const spec = getLayerFilterSpec(filter);
  if (filter === 'brightness') {
    const delta = clampBrightnessDelta(brightnessDelta ?? 25);
    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    return `${spec.label} (${sign}%)`;
  }
  return spec.label;
}

/**
 * Creates a non-destructive, undoable layer-filter stroke entry stored on the timeline.
 */
export function createLayerFilterStroke(params: {
  id?: string;
  layerId: string;
  layerName: string;
  filter: LayerFilterType;
  brightnessDelta?: number;
  opaquePaperBackground?: boolean;
  appliedAt?: number;
}): Stroke {
  const appliedAt = params.appliedAt ?? Date.now();
  const brightnessDelta =
    params.filter === 'brightness'
      ? clampBrightnessDelta(params.brightnessDelta ?? 25)
      : undefined;

  return {
    id:
      params.id ||
      `op_filter_${params.filter}_${appliedAt}_${Math.random().toString(36).slice(2, 6)}`,
    layerId: params.layerId,
    tool: 'select',
    color: '#000000',
    size: 1,
    opacity: 1,
    points: [],
    operation: 'layer-filter',
    filterType: params.filter,
    ...(brightnessDelta !== undefined ? { filterBrightnessDelta: brightnessDelta } : {}),
    ...(params.opaquePaperBackground ? { filterOpaquePaperBackground: true } : {}),
    filterEnabled: true,
    filterAppliedAt: appliedAt,
    filterLayerName: params.layerName,
  };
}

/**
 * Extracts filter history entries from the stroke timeline, ordered most-recent-first.
 */
export function extractFilterHistory(
  strokes: Stroke[],
  layers: CanvasLayer[]
): FilterHistoryEntry[] {
  const safeLayers = layers.length > 0 ? layers : createInitialLayers();
  const layerNameMap = new Map<string, string>();
  for (const l of safeLayers) {
    layerNameMap.set(l.id, l.name);
  }

  const entries: FilterHistoryEntry[] = [];
  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i];
    if (stroke.operation !== 'layer-filter' || !stroke.filterType) continue;

    const resolvedLayerId = resolveStrokeLayerId(stroke, safeLayers);
    const layerName =
      layerNameMap.get(resolvedLayerId) || stroke.filterLayerName || 'Layer 1';

    entries.push({
      id: stroke.id,
      layerId: resolvedLayerId,
      layerName,
      filter: stroke.filterType,
      label: formatFilterHistoryLabel(stroke.filterType, stroke.filterBrightnessDelta),
      brightnessDelta: stroke.filterBrightnessDelta,
      opaquePaperBackground: Boolean(stroke.filterOpaquePaperBackground),
      enabled: stroke.filterEnabled !== false,
      appliedAt: stroke.filterAppliedAt ?? 0,
      orderIndex: i,
    });
  }

  return entries.reverse();
}

/**
 * Toggles a specific filter history entry on/off without removing it from the timeline.
 */
export function toggleFilterInStrokes(
  strokes: Stroke[],
  filterId: string
): { strokes: Stroke[]; toggled: Stroke | null; nextEnabled: boolean } {
  let toggled: Stroke | null = null;
  let nextEnabled = true;

  const updated = strokes.map((stroke) => {
    if (stroke.id !== filterId || stroke.operation !== 'layer-filter') {
      return stroke;
    }
    const currentlyEnabled = stroke.filterEnabled !== false;
    nextEnabled = !currentlyEnabled;
    toggled = {
      ...stroke,
      filterEnabled: nextEnabled,
    };
    return toggled;
  });

  return { strokes: updated, toggled, nextEnabled };
}

/**
 * Undoes/removes an individual filter operation from the stroke timeline while preserving
 * all surrounding strokes and other filters intact.
 */
export function removeFilterFromStrokes(
  strokes: Stroke[],
  filterId: string
): { strokes: Stroke[]; removed: Stroke | null } {
  let removed: Stroke | null = null;
  const updated = strokes.filter((stroke) => {
    if (stroke.id === filterId && stroke.operation === 'layer-filter') {
      removed = stroke;
      return false;
    }
    return true;
  });
  return { strokes: updated, removed };
}

/**
 * Checks whether a layer currently has drawable content (strokes, shapes, text, or raster patches).
 */
export function hasDrawableContentOnLayer(
  strokes: Stroke[],
  layers: CanvasLayer[],
  layerId: string
): boolean {
  const safeLayers = layers.length > 0 ? layers : createInitialLayers();
  return strokes.some(
    (s) =>
      resolveStrokeLayerId(s, safeLayers) === layerId && s.operation !== 'layer-filter'
  );
}

/**
 * Renders a single layer's strokes and enabled non-destructive layer filters onto `targetCtx`.
 */
export function renderLayerStrokesToContext(
  targetCtx: CanvasRenderingContext2D,
  layerStrokes: Stroke[],
  width: number,
  height: number,
  drawStroke: (ctx: CanvasRenderingContext2D, stroke: Stroke) => void,
  options?: {
    layerOpacity?: number;
    createCanvas?: (w: number, h: number) => HTMLCanvasElement;
  }
): void {
  const layerOpacity = options?.layerOpacity ?? 1;
  const hasEnabledFilter = layerStrokes.some(
    (s) => s.operation === 'layer-filter' && s.filterEnabled !== false && Boolean(s.filterType)
  );
  const canAllocateCanvas =
    typeof options?.createCanvas === 'function' || typeof document !== 'undefined';

  if (!hasEnabledFilter && layerOpacity >= 1) {
    for (const stroke of layerStrokes) {
      if (stroke.operation === 'layer-filter') continue;
      drawStroke(targetCtx, stroke);
    }
    return;
  }

  if (!canAllocateCanvas) {
    for (const stroke of layerStrokes) {
      if (stroke.operation === 'layer-filter') continue;
      drawStroke(targetCtx, stroke);
    }
    return;
  }

  const makeCanvas =
    options?.createCanvas ||
    ((w: number, h: number) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    });

  const safeW = Math.max(1, Math.round(width));
  const safeH = Math.max(1, Math.round(height));
  const layerCanvas = makeCanvas(safeW, safeH);
  const layerCtx = layerCanvas.getContext('2d', { willReadFrequently: true });
  if (!layerCtx) return;

  layerCtx.setTransform?.(1, 0, 0, 1, 0, 0);
  layerCtx.clearRect(0, 0, safeW, safeH);

  let scratchCanvas: HTMLCanvasElement | null = null;

  for (const stroke of layerStrokes) {
    if (stroke.operation === 'layer-filter') {
      if (stroke.filterEnabled === false || !stroke.filterType) continue;
      if (!scratchCanvas) {
        scratchCanvas = makeCanvas(safeW, safeH);
      }
      const scratchCtx = scratchCanvas.getContext('2d', { willReadFrequently: true });
      if (!scratchCtx) continue;

      scratchCtx.setTransform?.(1, 0, 0, 1, 0, 0);
      scratchCtx.globalAlpha = 1;
      scratchCtx.globalCompositeOperation = 'source-over';
      scratchCtx.clearRect(0, 0, safeW, safeH);
      scratchCtx.drawImage(layerCanvas, 0, 0, safeW, safeH);

      applyLayerFilterToContext(layerCtx, scratchCanvas, safeW, safeH, stroke.filterType, {
        brightnessDelta: stroke.filterBrightnessDelta,
        opaquePaperBackground: stroke.filterOpaquePaperBackground,
      });
      continue;
    }

    drawStroke(layerCtx, stroke);
  }

  targetCtx.save();
  targetCtx.globalAlpha = layerOpacity;
  targetCtx.globalCompositeOperation = 'source-over';
  targetCtx.drawImage(layerCanvas, 0, 0, safeW, safeH);
  targetCtx.restore();
}

/**
 * Renders all visible layers in bottom-to-top z-order with per-layer opacity and filters applied.
 */
export function renderLayeredArtworkToContext(
  targetCtx: CanvasRenderingContext2D,
  strokes: Stroke[],
  layers: CanvasLayer[],
  width: number,
  height: number,
  drawStroke: (ctx: CanvasRenderingContext2D, stroke: Stroke) => void,
  options?: {
    createCanvas?: (w: number, h: number) => HTMLCanvasElement;
  }
): void {
  const safeLayers = layers.length > 0 ? layers : createInitialLayers();
  const grouped = groupStrokesByLayer(strokes, safeLayers);

  for (const layer of safeLayers) {
    if (!layer.visible) continue;
    const layerStrokes = grouped.get(layer.id) || [];
    if (layerStrokes.length === 0) continue;

    renderLayerStrokesToContext(targetCtx, layerStrokes, width, height, drawStroke, {
      layerOpacity: layer.opacity,
      createCanvas: options?.createCanvas,
    });
  }
}

/**
 * Generates an SVG `<filter>` definition in sRGB color space for exported vector artwork.
 */
export function buildSvgFilterDef(
  filterId: string,
  filter: LayerFilterType,
  brightnessDelta?: number
): string {
  switch (filter) {
    case 'grayscale':
      return `    <filter id="${filterId}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0" /></filter>\n`;
    case 'sepia':
      return `    <filter id="${filterId}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.393 0.769 0.189 0 0 0.349 0.686 0.168 0 0 0.272 0.534 0.131 0 0 0 0 0 1 0" /></filter>\n`;
    case 'brightness': {
      const intercept = (clampBrightnessDelta(brightnessDelta ?? 25) / 100).toFixed(4);
      return `    <filter id="${filterId}" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="1" intercept="${intercept}" /><feFuncG type="linear" slope="1" intercept="${intercept}" /><feFuncB type="linear" slope="1" intercept="${intercept}" /></feComponentTransfer></filter>\n`;
    }
    case 'invert':
      return `    <filter id="${filterId}" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="table" tableValues="1 0" /><feFuncG type="table" tableValues="1 0" /><feFuncB type="table" tableValues="1 0" /></feComponentTransfer></filter>\n`;
  }
}

export function resolveDefaultLayerId(): string {
  return DEFAULT_LAYER_ID;
}
