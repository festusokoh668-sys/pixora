import { CanvasLayer, Stroke } from '../types';

export const DEFAULT_LAYER_ID = 'layer_1';

/**
 * Creates the initial single-layer stack (bottom-to-top z-order).
 */
export function createInitialLayers(): CanvasLayer[] {
  return [
    {
      id: DEFAULT_LAYER_ID,
      name: 'Layer 1',
      visible: true,
      opacity: 1,
    },
  ];
}

/**
 * Generates a unique, predictable name like "Layer 2", "Layer 3", etc.
 */
export function getNextLayerName(layers: CanvasLayer[]): string {
  const existingNames = new Set(layers.map((l) => l.name.trim().toLowerCase()));
  let num = layers.length + 1;
  while (existingNames.has(`layer ${num}`)) {
    num += 1;
  }
  return `Layer ${num}`;
}

/**
 * Creates and inserts a new transparent layer directly above `afterLayerId` (or at top of stack).
 */
export function addTransparentLayer(
  layers: CanvasLayer[],
  options?: { afterLayerId?: string; id?: string; name?: string }
): { layers: CanvasLayer[]; newLayer: CanvasLayer } {
  const safeLayers = layers.length > 0 ? layers : createInitialLayers();
  const newLayer: CanvasLayer = {
    id: options?.id || `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: options?.name?.trim() || getNextLayerName(safeLayers),
    visible: true,
    opacity: 1,
  };

  if (options?.afterLayerId) {
    const idx = safeLayers.findIndex((l) => l.id === options.afterLayerId);
    if (idx !== -1) {
      const next = [...safeLayers];
      next.splice(idx + 1, 0, newLayer);
      return { layers: next, newLayer };
    }
  }

  return {
    layers: [...safeLayers, newLayer],
    newLayer,
  };
}

/**
 * Toggles visibility on a specific layer ID.
 */
export function toggleLayerVisibility(
  layers: CanvasLayer[],
  layerId: string
): CanvasLayer[] {
  return layers.map((layer) =>
    layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
  );
}

/**
 * Updates layer opacity clamped cleanly between 0.05 and 1.0.
 */
export function setLayerOpacity(
  layers: CanvasLayer[],
  layerId: string,
  opacity: number
): CanvasLayer[] {
  const clamped = Math.max(0.05, Math.min(1, Math.round(opacity * 100) / 100));
  return layers.map((layer) =>
    layer.id === layerId ? { ...layer, opacity: clamped } : layer
  );
}

/**
 * Renames a layer cleanly (ignores empty/whitespace-only names).
 */
export function renameLayer(
  layers: CanvasLayer[],
  layerId: string,
  nextName: string
): CanvasLayer[] {
  const trimmed = nextName.trim().slice(0, 32);
  if (!trimmed) return layers;
  return layers.map((layer) =>
    layer.id === layerId ? { ...layer, name: trimmed } : layer
  );
}

/**
 * Moves a layer up (higher z-order, towards end of array) or down (lower z-order, towards index 0).
 */
export function moveLayer(
  layers: CanvasLayer[],
  layerId: string,
  direction: 'up' | 'down'
): CanvasLayer[] {
  const idx = layers.findIndex((l) => l.id === layerId);
  if (idx === -1) return layers;

  const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
  if (targetIdx < 0 || targetIdx >= layers.length) return layers;

  const next = [...layers];
  const [moved] = next.splice(idx, 1);
  next.splice(targetIdx, 0, moved);
  return next;
}

/**
 * Reorders layers directly by source and destination indices in bottom-to-top z-order.
 */
export function reorderLayersByIndex(
  layers: CanvasLayer[],
  fromIndex: number,
  toIndex: number
): CanvasLayer[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= layers.length ||
    toIndex >= layers.length ||
    fromIndex === toIndex
  ) {
    return layers;
  }
  const next = [...layers];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Reorders layers using visual sidebar positions (where display index 0 is top-most foreground layer).
 */
export function reorderLayersFromDisplayOrder(
  layers: CanvasLayer[],
  draggedLayerId: string,
  targetLayerId: string
): CanvasLayer[] {
  if (draggedLayerId === targetLayerId) return layers;
  const fromIdx = layers.findIndex((l) => l.id === draggedLayerId);
  const toIdx = layers.findIndex((l) => l.id === targetLayerId);
  return reorderLayersByIndex(layers, fromIdx, toIdx);
}

/**
 * Deletes a layer (preventing deletion of the last remaining layer) and returns updated layers + active selection.
 */
export function deleteLayer(
  layers: CanvasLayer[],
  activeLayerId: string,
  layerIdToDelete: string
): { layers: CanvasLayer[]; activeLayerId: string; deleted: boolean } {
  if (layers.length <= 1) {
    return { layers, activeLayerId, deleted: false };
  }
  const idx = layers.findIndex((l) => l.id === layerIdToDelete);
  if (idx === -1) {
    return { layers, activeLayerId, deleted: false };
  }

  const nextLayers = layers.filter((l) => l.id !== layerIdToDelete);
  let nextActiveId = activeLayerId;
  if (activeLayerId === layerIdToDelete || !nextLayers.some((l) => l.id === activeLayerId)) {
    const fallbackIdx = Math.min(idx, nextLayers.length - 1);
    nextActiveId = nextLayers[fallbackIdx].id;
  }

  return {
    layers: nextLayers,
    activeLayerId: nextActiveId,
    deleted: true,
  };
}

/**
 * Returns layers in visual sidebar order (top-most layer first).
 */
export function getLayersDisplayOrder(layers: CanvasLayer[]): CanvasLayer[] {
  return [...layers].reverse();
}

export function canMoveLayerUp(layers: CanvasLayer[], layerId: string): boolean {
  const idx = layers.findIndex((l) => l.id === layerId);
  return idx !== -1 && idx < layers.length - 1;
}

export function canMoveLayerDown(layers: CanvasLayer[], layerId: string): boolean {
  const idx = layers.findIndex((l) => l.id === layerId);
  return idx > 0;
}

/**
 * Resolves which layer ID a stroke belongs to (falling back to DEFAULT_LAYER_ID / bottom layer for legacy/untagged strokes).
 */
export function resolveStrokeLayerId(stroke: Stroke, layers: CanvasLayer[]): string {
  if (stroke.layerId && layers.some((l) => l.id === stroke.layerId)) {
    return stroke.layerId;
  }
  if (layers.some((l) => l.id === DEFAULT_LAYER_ID)) {
    return DEFAULT_LAYER_ID;
  }
  return layers[0]?.id ?? DEFAULT_LAYER_ID;
}

/**
 * Partitions strokes by layer ID in O(N), falling back untagged strokes to DEFAULT_LAYER_ID or bottom layer.
 */
export function groupStrokesByLayer(
  strokes: Stroke[],
  layers: CanvasLayer[]
): Map<string, Stroke[]> {
  const map = new Map<string, Stroke[]>();
  for (const layer of layers) {
    map.set(layer.id, []);
  }
  const fallbackId = map.has(DEFAULT_LAYER_ID)
    ? DEFAULT_LAYER_ID
    : (layers[0]?.id ?? DEFAULT_LAYER_ID);
  if (!map.has(fallbackId)) {
    map.set(fallbackId, []);
  }

  for (const stroke of strokes) {
    const targetId =
      stroke.layerId && map.has(stroke.layerId) ? stroke.layerId : fallbackId;
    map.get(targetId)!.push(stroke);
  }
  return map;
}

/**
 * Returns visible strokes flattened in exact bottom-to-top layer composite order
 * (used for SVG export, raster fallback export, etc.).
 */
export function getVisibleOrderedStrokes(
  strokes: Stroke[],
  layers: CanvasLayer[]
): Stroke[] {
  const safeLayers = layers.length > 0 ? layers : createInitialLayers();
  const grouped = groupStrokesByLayer(strokes, safeLayers);
  const result: Stroke[] = [];

  for (const layer of safeLayers) {
    if (!layer.visible) continue;
    const layerStrokes = grouped.get(layer.id) || [];
    for (const s of layerStrokes) {
      result.push(layer.opacity < 1 ? { ...s, opacity: s.opacity * layer.opacity } : s);
    }
  }
  return result;
}

export const MOBILE_LAYERS_BREAKPOINT_PX = 768;

/**
 * Defaults the Layers panel to hidden on phone-sized viewports (< 768px)
 * so the drawing canvas uses the full screen width until revealed.
 */
export function getDefaultLayersSidebarOpen(viewportWidth: number): boolean {
  if (!Number.isFinite(viewportWidth)) return true;
  return viewportWidth >= MOBILE_LAYERS_BREAKPOINT_PX;
}

/**
 * Formats an unambiguous accessible label for hiding or revealing the Layers panel.
 */
export function getLayersToggleAccessibleLabel(
  isOpen: boolean,
  layerCount?: number
): string {
  if (isOpen) return 'Hide Layers panel';
  if (typeof layerCount === 'number' && layerCount > 0) {
    return `Reveal Layers panel (${layerCount})`;
  }
  return 'Reveal Layers panel';
}
