export const MIN_CANVAS_ZOOM = 0.5;
export const MAX_CANVAS_ZOOM = 3.5;

export interface Point2D {
  x: number;
  y: number;
}

export interface ScreenPointer {
  clientX: number;
  clientY: number;
}

/**
 * Clamps zoom level cleanly within supported bounds [0.5, 3.5] rounded to 2 decimals.
 */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1.0;
  const clamped = Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, zoom));
  return Math.round(clamped * 100) / 100;
}

/**
 * Clamps pan offset so the canvas always remains reachable within the workspace viewport.
 */
export function clampPanOffset(
  pan: Point2D,
  zoom: number,
  containerWidth: number,
  containerHeight: number
): Point2D {
  const safeZoom = Math.max(MIN_CANVAS_ZOOM, zoom);
  const maxX = Math.max(120, containerWidth * 0.75 * Math.max(1, safeZoom));
  const maxY = Math.max(120, containerHeight * 0.75 * Math.max(1, safeZoom));

  return {
    x: Math.round(Math.max(-maxX, Math.min(maxX, pan.x)) * 10) / 10,
    y: Math.round(Math.max(-maxY, Math.min(maxY, pan.y)) * 10) / 10,
  };
}

/**
 * Computes distance and screen midpoint between two active touch/pointer contacts.
 */
export function getPointerPairMetrics(
  p1: ScreenPointer,
  p2: ScreenPointer
): { distance: number; center: Point2D } {
  const dx = p2.clientX - p1.clientX;
  const dy = p2.clientY - p1.clientY;
  return {
    distance: Math.hypot(dx, dy),
    center: {
      x: (p1.clientX + p2.clientX) / 2,
      y: (p1.clientY + p2.clientY) / 2,
    },
  };
}

export interface PinchGestureInput {
  startDistance: number;
  currentDistance: number;
  startZoom: number;
  startPan: Point2D;
  startCenter: Point2D;
  currentCenter: Point2D;
  viewportCenter: Point2D;
  containerWidth: number;
  containerHeight: number;
}

/**
 * Computes focal-point-anchored zoom and two-finger pan offset for a CSS transform
 * (`translate3d(pan.x, pan.y, 0) scale(zoom)` with `transform-origin: center center`).
 * Keeps the exact canvas point that started under `startCenter` anchored under `currentCenter`.
 */
export function calculatePinchZoomAndPan(input: PinchGestureInput): {
  zoomLevel: number;
  panOffset: Point2D;
} {
  const {
    startDistance,
    currentDistance,
    startZoom,
    startPan,
    startCenter,
    currentCenter,
    viewportCenter,
    containerWidth,
    containerHeight,
  } = input;

  const safeStartZoom = Math.max(MIN_CANVAS_ZOOM, startZoom);
  const scale = startDistance > 0 ? currentDistance / startDistance : 1;
  const zoomLevel = clampZoom(safeStartZoom * scale);

  // Canvas-local coordinate (relative to center) that sat directly under startCenter
  const localX = (startCenter.x - viewportCenter.x - startPan.x) / safeStartZoom;
  const localY = (startCenter.y - viewportCenter.y - startPan.y) / safeStartZoom;

  // Position pan so the same local coordinate sits under currentCenter at the new zoom level
  const rawPan: Point2D = {
    x: currentCenter.x - viewportCenter.x - zoomLevel * localX,
    y: currentCenter.y - viewportCenter.y - zoomLevel * localY,
  };

  const panOffset = clampPanOffset(rawPan, zoomLevel, containerWidth, containerHeight);
  return { zoomLevel, panOffset };
}

export interface WheelZoomInput {
  currentZoom: number;
  currentPan: Point2D;
  zoomDelta: number;
  cursor: Point2D;
  viewportCenter: Point2D;
  containerWidth: number;
  containerHeight: number;
}

/**
 * Computes cursor-anchored zoom and pan adjustment for trackpad pinch / Ctrl+wheel zoom.
 */
export function calculateWheelZoomAndPan(input: WheelZoomInput): {
  zoomLevel: number;
  panOffset: Point2D;
} {
  return calculatePinchZoomAndPan({
    startDistance: 1,
    currentDistance: Math.max(MIN_CANVAS_ZOOM, input.currentZoom + input.zoomDelta) / Math.max(MIN_CANVAS_ZOOM, input.currentZoom),
    startZoom: input.currentZoom,
    startPan: input.currentPan,
    startCenter: input.cursor,
    currentCenter: input.cursor,
    viewportCenter: input.viewportCenter,
    containerWidth: input.containerWidth,
    containerHeight: input.containerHeight,
  });
}

/**
 * Computes canvas dimensions that expand cleanly throughout the entire available workspace viewport.
 * When strokes already exist on the canvas, only expands (never shrinks smaller than existing artwork)
 * so user strokes are never accidentally clipped on viewport shrink.
 */
export function calculateFullScreenCanvasDimensions(
  workspaceWidth: number,
  workspaceHeight: number,
  currentDimensions?: { width: number; height: number },
  hasStrokes: boolean = false
): { width: number; height: number } {
  const targetW = Math.max(320, Math.floor(Number.isFinite(workspaceWidth) ? workspaceWidth : 819));
  const targetH = Math.max(240, Math.floor(Number.isFinite(workspaceHeight) ? workspaceHeight : 460));

  if (hasStrokes && currentDimensions) {
    return {
      width: Math.max(currentDimensions.width, targetW),
      height: Math.max(currentDimensions.height, targetH),
    };
  }

  return { width: targetW, height: targetH };
}

