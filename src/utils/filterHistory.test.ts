import test from 'node:test';
import assert from 'node:assert/strict';
import { CanvasLayer, Stroke } from '../types';
import {
  buildSvgFilterDef,
  createLayerFilterStroke,
  extractFilterHistory,
  formatFilterHistoryLabel,
  hasDrawableContentOnLayer,
  removeFilterFromStrokes,
  renderLayerStrokesToContext,
  toggleFilterInStrokes,
} from './filterHistory';
import { exportStrokesToSvgString } from './drawing';

const makeStroke = (id: string, layerId = 'layer_1'): Stroke => ({
  id,
  layerId,
  tool: 'brush',
  color: '#FF0000',
  size: 5,
  opacity: 1,
  points: [
    { x: 10, y: 10 },
    { x: 30, y: 30 },
  ],
});

const SAMPLE_LAYERS: CanvasLayer[] = [
  { id: 'layer_1', name: 'Layer 1', visible: true, opacity: 1 },
  { id: 'layer_2', name: 'Sketch', visible: true, opacity: 0.8 },
];

test('formatFilterHistoryLabel formats filter names and signed brightness percentages', () => {
  assert.equal(formatFilterHistoryLabel('grayscale'), 'Grayscale');
  assert.equal(formatFilterHistoryLabel('sepia'), 'Sepia');
  assert.equal(formatFilterHistoryLabel('invert'), 'Invert');
  assert.equal(formatFilterHistoryLabel('brightness', 20), 'Brightness (+20%)');
  assert.equal(formatFilterHistoryLabel('brightness', -20), 'Brightness (-20%)');
  assert.equal(formatFilterHistoryLabel('brightness', 0), 'Brightness (0%)');
});

test('extractFilterHistory lists applied filters most-recent-first with resolved layer names', () => {
  const s1 = makeStroke('s1', 'layer_1');
  const f1 = createLayerFilterStroke({
    id: 'f1',
    layerId: 'layer_1',
    layerName: 'Layer 1',
    filter: 'grayscale',
    appliedAt: 1000,
  });
  const f2 = createLayerFilterStroke({
    id: 'f2',
    layerId: 'layer_2',
    layerName: 'Old Layer Name',
    filter: 'brightness',
    brightnessDelta: -20,
    appliedAt: 2000,
  });

  const history = extractFilterHistory([s1, f1, f2], SAMPLE_LAYERS);
  assert.equal(history.length, 2);
  assert.equal(history[0].id, 'f2');
  assert.equal(history[0].label, 'Brightness (-20%)');
  assert.equal(history[0].layerName, 'Sketch');
  assert.equal(history[0].enabled, true);

  assert.equal(history[1].id, 'f1');
  assert.equal(history[1].label, 'Grayscale');
  assert.equal(history[1].layerName, 'Layer 1');
});

test('toggleFilterInStrokes flips enabled state on a single filter without touching other strokes or filters', () => {
  const s1 = makeStroke('s1', 'layer_1');
  const f1 = createLayerFilterStroke({
    id: 'f1',
    layerId: 'layer_1',
    layerName: 'Layer 1',
    filter: 'sepia',
    appliedAt: 1000,
  });
  const f2 = createLayerFilterStroke({
    id: 'f2',
    layerId: 'layer_1',
    layerName: 'Layer 1',
    filter: 'invert',
    appliedAt: 2000,
  });

  const step1 = toggleFilterInStrokes([s1, f1, f2], 'f1');
  assert.equal(step1.nextEnabled, false);
  assert.equal(step1.strokes.length, 3);
  assert.equal(step1.strokes[1].filterEnabled, false);
  assert.equal(step1.strokes[2].filterEnabled, true);

  const step2 = toggleFilterInStrokes(step1.strokes, 'f1');
  assert.equal(step2.nextEnabled, true);
  assert.equal(step2.strokes[1].filterEnabled, true);
});

test('removeFilterFromStrokes undoes an individual filter operation cleanly without dropping strokes or later filters', () => {
  const s1 = makeStroke('s1', 'layer_1');
  const f1 = createLayerFilterStroke({
    id: 'f1',
    layerId: 'layer_1',
    layerName: 'Layer 1',
    filter: 'grayscale',
    appliedAt: 1000,
  });
  const s2 = makeStroke('s2', 'layer_1');
  const f2 = createLayerFilterStroke({
    id: 'f2',
    layerId: 'layer_1',
    layerName: 'Layer 1',
    filter: 'brightness',
    brightnessDelta: 25,
    appliedAt: 2000,
  });

  const { strokes: remaining, removed } = removeFilterFromStrokes([s1, f1, s2, f2], 'f1');
  assert.equal(removed?.id, 'f1');
  assert.deepEqual(
    remaining.map((s) => s.id),
    ['s1', 's2', 'f2']
  );
  assert.equal(hasDrawableContentOnLayer(remaining, SAMPLE_LAYERS, 'layer_1'), true);
  assert.equal(hasDrawableContentOnLayer([f2], SAMPLE_LAYERS, 'layer_1'), false);
});

test('renderLayerStrokesToContext applies enabled filters via scratch buffer and skips disabled filters', () => {
  const s1 = makeStroke('s1', 'layer_1');
  const fDisabled = {
    ...createLayerFilterStroke({
      id: 'f_off',
      layerId: 'layer_1',
      layerName: 'Layer 1',
      filter: 'sepia',
    }),
    filterEnabled: false,
  };
  const fEnabled = createLayerFilterStroke({
    id: 'f_on',
    layerId: 'layer_1',
    layerName: 'Layer 1',
    filter: 'invert',
  });
  const s2 = makeStroke('s2', 'layer_1');

  const events: string[] = [];
  const pixelBuf = new Uint8ClampedArray([10, 20, 30, 255]);

  const makeMockCtx = (tag: string) =>
    ({
      filter: 'none',
      fillStyle: '',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      save: () => events.push(`${tag}:save`),
      restore: () => events.push(`${tag}:restore`),
      setTransform: () => {},
      clearRect: () => events.push(`${tag}:clearRect`),
      fillRect: () => {},
      drawImage: () => events.push(`${tag}:drawImage`),
      getImageData: () => ({ data: pixelBuf, width: 1, height: 1 }),
      putImageData: () => events.push(`${tag}:putImageData`),
    }) as unknown as CanvasRenderingContext2D;

  const targetCtx = makeMockCtx('target');
  let canvasSeq = 0;
  const createCanvas = () => {
    const tag = canvasSeq++ === 0 ? 'layer' : 'scratch';
    const ctx = makeMockCtx(tag);
    return {
      width: 100,
      height: 100,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;
  };

  renderLayerStrokesToContext(
    targetCtx,
    [s1, fDisabled, fEnabled, s2],
    100,
    100,
    (_ctx, stroke) => {
      events.push(`drawStroke:${stroke.id}`);
    },
    { layerOpacity: 1, createCanvas }
  );

  // s1 drawn, f_off skipped, scratch copied & invert applied via putImageData, then s2 drawn, then composited to target
  assert.deepEqual(events.filter((e) => e.startsWith('drawStroke:') || e.endsWith(':putImageData')), [
    'drawStroke:s1',
    'layer:putImageData',
    'drawStroke:s2',
  ]);
  assert.deepEqual(Array.from(pixelBuf), [245, 235, 225, 255]);
  assert.ok(events.includes('target:drawImage'));
});

test('buildSvgFilterDef generates valid sRGB SVG filter definitions', () => {
  assert.ok(buildSvgFilterDef('flt1', 'grayscale').includes('saturate" values="0"'));
  assert.ok(buildSvgFilterDef('flt2', 'sepia').includes('0.393 0.769 0.189'));
  assert.ok(buildSvgFilterDef('flt3', 'brightness', 20).includes('intercept="0.2000"'));
  assert.ok(buildSvgFilterDef('flt4', 'invert').includes('tableValues="1 0"'));
});

test('exportStrokesToSvgString wraps preceding layer strokes with enabled SVG filters and skips bypassed filters', () => {
  const s1 = makeStroke('s1', 'layer_1');
  const fSepia = createLayerFilterStroke({
    id: 'f_sepia',
    layerId: 'layer_1',
    layerName: 'Layer 1',
    filter: 'sepia',
  });
  const fDisabledGray = {
    ...createLayerFilterStroke({
      id: 'f_gray_off',
      layerId: 'layer_1',
      layerName: 'Layer 1',
      filter: 'grayscale',
    }),
    filterEnabled: false,
  };

  const svg = exportStrokesToSvgString([s1, fSepia, fDisabledGray], {
    width: 800,
    height: 460,
    includeWatermark: false,
  });

  assert.ok(svg.includes('<filter id="pixora_filter_1"'));
  assert.ok(svg.includes('<g filter="url(#pixora_filter_1)">'));
  assert.equal(svg.includes('type="saturate"'), false);
});

