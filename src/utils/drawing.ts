import { Point, Stroke, ToolType } from '../types';

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
 * Smooths raw stroke points using weighted 3-point moving average
 * to filter sensor jitter while preserving shape trajectory and corners.
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
    });
  }
  smoothed.push(points[points.length - 1]);
  return smoothed;
}

/**
 * Draws a smooth stroke path using quadratic curve approximation between consecutive midpoints
 */
export function drawQuadraticPath(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length === 0) return;

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (points.length === 2) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  // Connect through midpoints with quadratic bezier curves
  for (let i = 1; i < points.length - 1; i++) {
    const mid = getMidPoint(points[i], points[i + 1]);
    ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
  }

  // Draw final segment to the last recorded point
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

/**
 * Creates a new stroke object
 */
export function createStroke(
  tool: ToolType,
  color: string,
  size: number,
  opacity: number,
  startPoint: Point
): Stroke {
  return {
    id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    tool,
    color,
    size: Math.max(1, size),
    opacity: Math.max(0.05, Math.min(1, opacity)),
    points: [startPoint],
  };
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
    // 1. Sharp Pen: Clean, crisp, razor-sharp needle line
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
    // 3. Original Drawing Paint: Rich viscous body, wet paint edge
    ctx.lineWidth = stroke.size * 1.4;
    ctx.globalAlpha = Math.min(1.0, stroke.opacity * 0.95);
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = Math.max(2.5, stroke.size * 0.35);
  } else if (stroke.tool === 'highlighter') {
    // 4. Marker / Highlighter: Broad semi-transparent wash
    ctx.lineWidth = stroke.size * 2.2;
    ctx.globalAlpha = stroke.opacity * 0.35;
    ctx.shadowBlur = 0;
  } else {
    ctx.lineWidth = stroke.size;
    ctx.globalAlpha = stroke.opacity;
    ctx.shadowBlur = 0;
  }
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
 * Generates clean filename for exported PNG
 */
export function generateArtworkFilename(title: string): string {
  const cleanTitle = (title.trim() || 'Untitled Artwork')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 30);
  const dateStr = new Date().toISOString().slice(0, 10);
  return `Pixora_${cleanTitle}_${dateStr}.png`;
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
