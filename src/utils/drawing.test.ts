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
  exportStrokesToSvgString,
  strokePointsToSvgPath,
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

  const svgFilename = generateArtworkFilename('Mountain Vista', 'svg');
  assert.ok(svgFilename.startsWith('Pixora_Mountain_Vista_'));
  assert.ok(svgFilename.endsWith('.svg'));

  const emptyTitleFilename = generateArtworkFilename('   ');
  assert.ok(emptyTitleFilename.startsWith('Pixora_Untitled_Artwork_'));
});

test('exportStrokesToSvgString generates valid SVG document with stroke paths', () => {
  const stroke1 = createStroke('brush', '#164BCE', 12, 1, { x: 10, y: 10 });
  stroke1.points.push({ x: 50, y: 80 });
  stroke1.points.push({ x: 100, y: 150 });

  const stroke2 = createStroke('calligraphy', '#000000', 8, 0.9, { x: 200, y: 300 });

  const svg = exportStrokesToSvgString([stroke1, stroke2], {
    title: 'Test Masterpiece',
    includeWatermark: true,
  });

  assert.ok(svg.includes('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('viewBox="0 0 1200 1200"'));
  assert.ok(svg.includes('<title>Test Masterpiece</title>'));
  assert.ok(svg.includes('<rect width="1200" height="1200" fill="#FFFFFF"'));
  assert.ok(svg.includes('<path d="M 10 10'));
  assert.ok(svg.includes('stroke="#164BCE"'));
  assert.ok(svg.includes('<circle cx="200" cy="300"'));
  assert.ok(svg.includes('PIXORA Studio'));
  assert.ok(svg.endsWith('</svg>'));
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

  // 3. Paint Brush
  const paintStroke = createStroke('brush', baseColor, baseSize, 1.0, { x: 0, y: 0 });
  const paintCtx = createMockCtx() as any;
  applyToolStyleToContext(paintCtx, paintStroke);
  assert.equal(paintCtx.lineWidth, 14.0); // size * 1.4 -> rich viscous paint body
  assert.ok(paintCtx.shadowBlur >= 2.5); // wet paint edge

  // 4. Paint Bucket (Broad, thick, rich opaque paint)
  const bucketStroke = createStroke('bucket', baseColor, baseSize, 1.0, { x: 0, y: 0 });
  const bucketCtx = createMockCtx() as any;
  applyToolStyleToContext(bucketCtx, bucketStroke);
  assert.equal(bucketCtx.lineWidth, 28.0); // size * 2.8 -> twice as thick as Paint Brush (28 vs 14)
  assert.equal(bucketCtx.globalAlpha, 1.0); // full opaque coverage
  assert.ok(bucketCtx.lineWidth > paintCtx.lineWidth); // strictly thicker than paint brush
  assert.ok(bucketCtx.shadowBlur >= 4); // rich wet paint laydown
});

test('getPaintColorPalette produces full physical paint layer tints and highlights', async () => {
  const { getPaintColorPalette } = await import('./drawing');
  const palette = getPaintColorPalette('#164BCE');

  assert.equal(palette.baseColor, '#164BCE');
  assert.ok(palette.shadowColor.startsWith('#'));
  assert.ok(palette.bristleDark.startsWith('#'));
  assert.ok(palette.bristleLight.startsWith('#'));
  assert.ok(palette.glossCrest.startsWith('#'));
  assert.ok(palette.specularHighlight.startsWith('#'));
});

test('createStroke preserves colorEnd gradient and paintFinish', () => {
  const gradientStroke = createStroke(
    'brush',
    '#ED1C24',
    16,
    0.9,
    { x: 50, y: 50 },
    '#FFF200',
    'oil'
  );

  assert.equal(gradientStroke.color, '#ED1C24');
  assert.equal(gradientStroke.colorEnd, '#FFF200');
  assert.equal(gradientStroke.paintFinish, 'oil');
});

test('exportStrokesToSvgString generates linearGradient defs for gradient strokes', () => {
  const stroke = createStroke(
    'brush',
    '#164BCE',
    20,
    1.0,
    { x: 100, y: 100 },
    '#00F0FF',
    'acrylic'
  );
  stroke.points.push({ x: 300, y: 400 });

  const svg = exportStrokesToSvgString([stroke]);
  assert.ok(svg.includes('<defs>'));
  assert.ok(svg.includes('<linearGradient id="paint_grad_0"'));
  assert.ok(svg.includes('stop-color="#164BCE"'));
  assert.ok(svg.includes('stop-color="#00F0FF"'));
  assert.ok(svg.includes('stroke="url(#paint_grad_0)"'));
});

test('getContainDrawRect centers square and portrait images without distortion on wide full-screen canvases', async () => {
  const { getContainDrawRect } = await import('./drawing');

  // Square image in widescreen 1440x720 container -> should fit height (720x720) centered at x=360
  const wideFit = getContainDrawRect(1000, 1000, 1440, 720);
  assert.deepEqual(wideFit, { x: 360, y: 0, width: 720, height: 720 });

  // Landscape 16:9 image in mobile portrait 390x650 container -> should fit width (390x219) centered vertically
  const portraitFit = getContainDrawRect(1600, 900, 390, 650);
  assert.equal(portraitFit.x, 0);
  assert.equal(portraitFit.width, 390);
  assert.equal(portraitFit.height, 219);
  assert.equal(portraitFit.y, 216);
});

test('toggleMirrorAxis toggles horizontal and vertical axes cleanly and supports quad combination', async () => {
  const { toggleMirrorAxis } = await import('./drawing');

  assert.equal(toggleMirrorAxis('none', 'horizontal'), 'horizontal');
  assert.equal(toggleMirrorAxis('horizontal', 'horizontal'), 'none');
  assert.equal(toggleMirrorAxis('horizontal', 'vertical'), 'quad');
  assert.equal(toggleMirrorAxis('quad', 'horizontal'), 'vertical');
  assert.equal(toggleMirrorAxis('vertical', 'vertical'), 'none');
});

test('createMirroredStrokes reflects stroke points across canvas center for horizontal, vertical, and quad modes', async () => {
  const { createMirroredStrokes } = await import('./drawing');
  const stroke = createStroke('brush', '#164BCE', 10, 1.0, { x: 200, y: 150, pressure: 0.7 });
  stroke.points.push({ x: 300, y: 250, pressure: 0.8 });

  // Horizontal reflection across x = 500
  const horiz = createMirroredStrokes(stroke, 'horizontal', 1000, 800);
  assert.equal(horiz.length, 2);
  assert.deepEqual(horiz[1].points.map((p) => [p.x, p.y, p.pressure]), [
    [800, 150, 0.7],
    [700, 250, 0.8],
  ]);

  // Vertical reflection across y = 400
  const vert = createMirroredStrokes(stroke, 'vertical', 1000, 800);
  assert.equal(vert.length, 2);
  assert.deepEqual(vert[1].points.map((p) => [p.x, p.y]), [
    [200, 650],
    [300, 550],
  ]);

  // Quad reflection produces 4 strokes (original + H + V + diagonal)
  const quad = createMirroredStrokes(stroke, 'quad', 1000, 800);
  assert.equal(quad.length, 4);
  assert.deepEqual(quad[3].points.map((p) => [p.x, p.y]), [
    [800, 650],
    [700, 550],
  ]);
});

test('createMirroredStrokes supports custom interactive axis positions and Symmetry toggle helper', async () => {
  const { createMirroredStrokes, clampSymmetryAxisRatio, resolveSymmetryToggle } = await import('./drawing');
  const stroke = createStroke('brush', '#1979CA', 6, 1.0, { x: 150, y: 120, pressure: 0.5 });

  // Custom vertical axis at x = 300 -> reflects x=150 to x=450
  const customH = createMirroredStrokes(stroke, 'horizontal', 1000, 800, { x: 300, y: 400 });
  assert.equal(customH[1].points[0].x, 450);
  assert.equal(customH[1].points[0].y, 120);

  // Custom horizontal axis at y = 200 -> reflects y=120 to y=280
  const customV = createMirroredStrokes(stroke, 'vertical', 1000, 800, { x: 300, y: 200 });
  assert.equal(customV[1].points[0].x, 150);
  assert.equal(customV[1].points[0].y, 280);

  assert.equal(clampSymmetryAxisRatio(-0.5), 0.05);
  assert.equal(clampSymmetryAxisRatio(1.4), 0.95);
  assert.equal(clampSymmetryAxisRatio(Number.NaN), 0.5);
  assert.equal(clampSymmetryAxisRatio(0.325), 0.325);

  assert.equal(resolveSymmetryToggle('none', 'vertical'), 'vertical');
  assert.equal(resolveSymmetryToggle('horizontal', 'vertical'), 'none');
});

test('createMirroredStrokes flips shape orientation flags and exports mirrored SVG transforms', async () => {
  const { createMirroredStrokes } = await import('./drawing');
  const arrowStroke = {
    id: 'shp_arrow_1',
    tool: 'shape' as const,
    shapeType: 'arrow-right' as const,
    outlineStyle: 'solid' as const,
    fillStyle: 'none' as const,
    color: '#1979CA',
    size: 3,
    opacity: 1,
    points: [
      { x: 100, y: 100 },
      { x: 220, y: 180 },
    ],
  };

  const quad = createMirroredStrokes(arrowStroke, 'quad', 1000, 800, { x: 500, y: 400 });
  assert.equal(quad.length, 4);
  assert.equal(quad[0].flipH, undefined);
  assert.equal(quad[0].flipV, undefined);
  assert.equal(quad[1].flipH, true);
  assert.equal(quad[1].flipV, undefined);
  assert.equal(quad[2].flipH, undefined);
  assert.equal(quad[2].flipV, true);
  assert.equal(quad[3].flipH, true);
  assert.equal(quad[3].flipV, true);

  const svg = exportStrokesToSvgString(quad, { width: 1000, height: 800 });
  assert.ok(svg.includes('scale(-1 1)'));
  assert.ok(svg.includes('scale(1 -1)'));
  assert.ok(svg.includes('scale(-1 -1)'));
});

test('stabilizePointerPoint filters micro-jitter and applies adaptive EMA smoothing', async () => {
  const { stabilizePointerPoint } = await import('./drawing');
  const prev = { x: 100, y: 100, pressure: 0.5 };

  // Sub-threshold tremor is ignored
  assert.equal(stabilizePointerPoint(prev, { x: 100.4, y: 100.3, pressure: 0.5 }), null);

  // Valid point is smoothly interpolated between prev and raw target
  const stabilized = stabilizePointerPoint(prev, { x: 110, y: 120, pressure: 0.9 }, 0.5, 1.2);
  assert.ok(stabilized !== null);
  assert.ok(stabilized.x > 100 && stabilized.x < 110);
  assert.ok(stabilized.y > 100 && stabilized.y < 120);
  assert.ok((stabilized.pressure ?? 0) > 0.5 && (stabilized.pressure ?? 0) < 0.9);
});

test('smoothStrokePoints attenuates zigzag jitter while preserving exact start/end endpoints', async () => {
  const { smoothStrokePoints } = await import('./drawing');
  const jitteryLine = [
    { x: 0, y: 50, pressure: 0.5 },
    { x: 10, y: 65, pressure: 0.5 },
    { x: 20, y: 35, pressure: 0.5 },
    { x: 30, y: 65, pressure: 0.5 },
    { x: 40, y: 35, pressure: 0.5 },
    { x: 50, y: 50, pressure: 0.5 },
  ];

  const smoothed = smoothStrokePoints(jitteryLine, { passes: 3, subdivide: true });
  assert.equal(smoothed[0].x, 0);
  assert.equal(smoothed[0].y, 50);
  assert.equal(smoothed[smoothed.length - 1].x, 50);
  assert.equal(smoothed[smoothed.length - 1].y, 50);

  // Peak deviation around y=50 should be significantly damped compared to +-15
  const maxDeviation = Math.max(...smoothed.map((p) => Math.abs(p.y - 50)));
  assert.ok(maxDeviation < 8, `Expected jitter damped below 8px, got ${maxDeviation}`);
});

test('getShapeVertices generates accurate triangle, diamond, and 5-point star coordinates', async () => {
  const { getShapeVertices } = await import('./shapes');

  const tri = getShapeVertices('triangle', { x: 10, y: 20 }, { x: 110, y: 120 });
  assert.equal(tri.length, 3);
  assert.deepEqual(tri[0], { x: 60, y: 20 });
  assert.deepEqual(tri[1], { x: 110, y: 120 });
  assert.deepEqual(tri[2], { x: 10, y: 120 });

  const diamond = getShapeVertices('diamond', { x: 0, y: 0 }, { x: 100, y: 80 });
  assert.equal(diamond.length, 4);
  assert.deepEqual(diamond[0], { x: 50, y: 0 });
  assert.deepEqual(diamond[1], { x: 100, y: 40 });

  const star = getShapeVertices('star-5', { x: 0, y: 0 }, { x: 100, y: 100 });
  assert.equal(star.length, 10);

  const lightning = getShapeVertices('lightning', { x: 0, y: 0 }, { x: 100, y: 100 });
  assert.equal(lightning.length, 6);
});

test('QUICK_SHAPES provides curated hearts, stars, and speech bubble with closed Canvas2D paths', async () => {
  const { QUICK_SHAPES, traceShapePath } = await import('./shapes');

  const ids = QUICK_SHAPES.map((s) => s.id);
  assert.ok(ids.includes('heart'), 'QUICK_SHAPES should include heart');
  assert.ok(ids.includes('star-5'), 'QUICK_SHAPES should include star-5');
  assert.ok(ids.includes('callout'), 'QUICK_SHAPES should include callout speech bubble');
  assert.ok(ids.includes('cloud'), 'QUICK_SHAPES should include cloud');
  assert.ok(ids.includes('lightning'), 'QUICK_SHAPES should include lightning');

  const mockCtx = {
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    bezierCurveTo: () => {},
    quadraticCurveTo: () => {},
    closePath: () => {},
    rect: () => {},
    roundRect: () => {},
    ellipse: () => {},
  } as unknown as CanvasRenderingContext2D;

  for (const sh of QUICK_SHAPES) {
    const res = traceShapePath(mockCtx, sh.id, [
      { x: 20, y: 20 },
      { x: 160, y: 140 },
    ]);
    assert.equal(res.isClosed, true, `Quick shape ${sh.id} should trace a closed fillable path`);
  }
});

test('generateArtworkFilename supports jpg, png, and svg extensions', () => {
  const jpgName = generateArtworkFilename('Sunset Sketch', 'jpg');
  const pngName = generateArtworkFilename('Sunset Sketch', 'png');
  const svgName = generateArtworkFilename('Sunset Sketch', 'svg');

  assert.ok(jpgName.startsWith('Pixora_Sunset_Sketch_') && jpgName.endsWith('.jpg'));
  assert.ok(pngName.startsWith('Pixora_Sunset_Sketch_') && pngName.endsWith('.png'));
  assert.ok(svgName.startsWith('Pixora_Sunset_Sketch_') && svgName.endsWith('.svg'));
});

test('exportStrokesToSvgString serializes geometric shapes, text annotations, and raster bitmap patches', () => {
  const shapeStroke = {
    id: 'shape_1',
    tool: 'shape' as const,
    shapeType: 'heart' as const,
    outlineStyle: 'solid' as const,
    fillStyle: 'solid' as const,
    color: '#ED1C24',
    fillColor: '#FFAEC9',
    size: 4,
    opacity: 1,
    points: [
      { x: 100, y: 100 },
      { x: 220, y: 220 },
    ],
  };

  const textStroke = {
    id: 'text_1',
    tool: 'text' as const,
    color: '#1979CA',
    size: 6,
    opacity: 1,
    points: [{ x: 40, y: 60 }],
    text: 'Hello <Pixora>',
    fontSize: 18,
  };

  const bitmapStroke = {
    id: 'bitmap_1',
    tool: 'select' as const,
    color: '#000000',
    size: 1,
    opacity: 1,
    points: [],
    operation: 'replace-bitmap' as const,
    rect: { x: 0, y: 0, width: 800, height: 600 },
    rasterDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  };

  const svg = exportStrokesToSvgString([bitmapStroke, shapeStroke, textStroke], {
    width: 800,
    height: 600,
    title: 'Export Test',
    includeWatermark: false,
  });

  assert.ok(svg.includes('<image href="data:image/png;base64,iVBORw0KGgo=" x="0" y="0" width="800" height="600"'));
  assert.ok(svg.includes('fill="#FFAEC9" stroke="#ED1C24" stroke-width="4"'));
  assert.ok(svg.includes('<text x="40" y="78" fill="#1979CA"'));
  assert.ok(svg.includes('Hello &lt;Pixora&gt;</text>'));
  assert.ok(!svg.includes('PIXORA Studio'));
});



