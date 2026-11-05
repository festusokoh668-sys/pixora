import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCanvasCoordinates,
  getMidPoint,
  smoothPoints,
  createStroke,
  HistoryManager,
  generateArtworkFilename,
  calculateStrokeBounds,
} from './drawing';

test('getCanvasCoordinates properly scales coordinates and clamps within bounds', () => {
  const rect = { left: 100, top: 50, width: 500, height: 500 };
  const canvasWidth = 1000;
  const canvasHeight = 1000;

  // Center point
  const ptCenter = getCanvasCoordinates(350, 300, rect, canvasWidth, canvasHeight);
  assert.equal(ptCenter.x, 500);
  assert.equal(ptCenter.y, 500);

  // Top-left point
  const ptTopLeft = getCanvasCoordinates(100, 50, rect, canvasWidth, canvasHeight);
  assert.equal(ptTopLeft.x, 0);
  assert.equal(ptTopLeft.y, 0);

  // Outside bounds (clamped)
  const ptClamped = getCanvasCoordinates(50, 600, rect, canvasWidth, canvasHeight);
  assert.equal(ptClamped.x, 0);
  assert.equal(ptClamped.y, 1000);
});

test('getMidPoint returns midpoint between two points', () => {
  const p1 = { x: 10, y: 20 };
  const p2 = { x: 30, y: 60 };
  const mid = getMidPoint(p1, p2);
  assert.equal(mid.x, 20);
  assert.equal(mid.y, 40);
});

test('smoothPoints reduces noise with moving average and preserves endpoints', () => {
  const rawPoints = [
    { x: 0, y: 0 },
    { x: 10, y: 50 }, // spike
    { x: 20, y: 0 },
  ];
  const smoothed = smoothPoints(rawPoints);
  assert.equal(smoothed.length, 3);
  assert.equal(smoothed[0].x, 0);
  assert.equal(smoothed[0].y, 0);
  // Endpoint preserved
  assert.equal(smoothed[2].x, 20);
  assert.equal(smoothed[2].y, 0);
  // Center point smoothed: 0.25*0 + 0.5*50 + 0.25*0 = 25
  assert.equal(smoothed[1].y, 25);
});

test('createStroke initializes stroke with correct attributes and sanitized values', () => {
  const stroke = createStroke('brush', '#164BCE', 12, 0.8, { x: 15, y: 25 });
  assert.equal(stroke.tool, 'brush');
  assert.equal(stroke.color, '#164BCE');
  assert.equal(stroke.size, 12);
  assert.equal(stroke.opacity, 0.8);
  assert.equal(stroke.points.length, 1);
  assert.equal(stroke.points[0].x, 15);
  assert.equal(stroke.points[0].y, 25);
  assert.ok(stroke.id.startsWith('stroke_'));
});

test('HistoryManager handles push, undo and redo transitions', () => {
  const history = new HistoryManager(10);
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);

  const strokeA = createStroke('pencil', '#000000', 4, 1, { x: 1, y: 1 });
  const strokeB = createStroke('brush', '#D6A928', 8, 1, { x: 2, y: 2 });

  // State 0 -> push empty
  history.pushState([]);
  // Now we have state with strokeA
  assert.equal(history.canUndo(), true);

  // Undo back to empty
  const undone = history.undo([strokeA]);
  assert.deepEqual(undone, []);
  assert.equal(history.canRedo(), true);

  // Redo back to strokeA
  const redone = history.redo([]);
  assert.deepEqual(redone, [strokeA]);

  // Push new state with strokeB, should clear redo
  history.pushState([strokeA]);
  assert.equal(history.canRedo(), false);
});

test('generateArtworkFilename sanitizes title and formats correctly', () => {
  const filename = generateArtworkFilename('Golden Lion @ Sunset!!!');
  assert.ok(filename.startsWith('Pixora_Golden_Lion_Sunset_'));
  assert.ok(filename.endsWith('.png'));

  const emptyTitleFilename = generateArtworkFilename('   ');
  assert.ok(emptyTitleFilename.startsWith('Pixora_Untitled_Artwork_'));
});

test('calculateStrokeBounds returns correct bounding box with padding', () => {
  const stroke = createStroke('pencil', '#164BCE', 10, 1, { x: 50, y: 50 });
  stroke.points.push({ x: 150, y: 250 });
  const bounds = calculateStrokeBounds(stroke);
  assert.ok(bounds !== null);
  assert.equal(bounds.minX, 45); // 50 - 5
  assert.equal(bounds.minY, 45); // 50 - 5
  assert.equal(bounds.maxX, 155); // 150 + 5
  assert.equal(bounds.maxY, 255); // 250 + 5
});

test('applyToolStyleToContext configures sharp pen, blunt pencil, and original drawing paint with distinct properties', async () => {
  const { applyToolStyleToContext } = await import('./drawing');

  // Mock Canvas context
  const createMockCtx = () => ({
    lineCap: '',
    lineJoin: '',
    globalCompositeOperation: '',
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    globalAlpha: 0,
    shadowBlur: 0,
    shadowColor: '',
  });

  const baseSize = 10;
  const baseColor = '#164BCE';

  // 1. Sharp Pen
  const penStroke = createStroke('calligraphy', baseColor, baseSize, 1.0, { x: 0, y: 0 });
  const penCtx = createMockCtx() as any;
  applyToolStyleToContext(penCtx, penStroke);
  assert.equal(penCtx.lineWidth, 6.5); // size * 0.65 -> sharp and fine
  assert.equal(penCtx.shadowBlur, 0); // zero blur for needle sharpness
  assert.equal(penCtx.globalAlpha, 1.0); // full ink saturation

  // 2. Blunt Pencil
  const pencilStroke = createStroke('pencil', baseColor, baseSize, 1.0, { x: 0, y: 0 });
  const pencilCtx = createMockCtx() as any;
  applyToolStyleToContext(pencilCtx, pencilStroke);
  assert.equal(pencilCtx.lineWidth, 11.5); // size * 1.15 -> blunt lead
  assert.ok(pencilCtx.shadowBlur > 0); // soft graphite edge
  assert.ok(pencilCtx.globalAlpha < 1.0); // graphite density

  // 3. Original Drawing Paint
  const paintStroke = createStroke('brush', baseColor, baseSize, 1.0, { x: 0, y: 0 });
  const paintCtx = createMockCtx() as any;
  applyToolStyleToContext(paintCtx, paintStroke);
  assert.equal(paintCtx.lineWidth, 14.0); // size * 1.4 -> rich viscous paint body
  assert.ok(paintCtx.shadowBlur >= 2.5); // wet paint edge
});
