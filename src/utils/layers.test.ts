import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialLayers,
  addTransparentLayer,
  toggleLayerVisibility,
  moveLayer,
  reorderLayersFromDisplayOrder,
  deleteLayer,
  renameLayer,
  getLayersDisplayOrder,
  canMoveLayerUp,
  canMoveLayerDown,
  getVisibleOrderedStrokes,
  resolveStrokeLayerId,
  setLayerOpacity,
} from './layers';
import { Stroke } from '../types';

test('createInitialLayers creates Layer 1 visible and opaque by default', () => {
  const layers = createInitialLayers();
  assert.equal(layers.length, 1);
  assert.equal(layers[0].id, 'layer_1');
  assert.equal(layers[0].name, 'Layer 1');
  assert.equal(layers[0].visible, true);
  assert.equal(layers[0].opacity, 1);
});

test('addTransparentLayer inserts Layer 2 above Layer 1 or active layer with unique naming', () => {
  const l1 = createInitialLayers();
  const res2 = addTransparentLayer(l1, { afterLayerId: 'layer_1', id: 'layer_2' });
  assert.equal(res2.layers.length, 2);
  assert.equal(res2.newLayer.name, 'Layer 2');
  assert.equal(res2.layers[1].id, 'layer_2');

  const res3 = addTransparentLayer(res2.layers, { afterLayerId: 'layer_1', id: 'layer_3' });
  assert.deepEqual(
    res3.layers.map((l) => l.id),
    ['layer_1', 'layer_3', 'layer_2']
  );
  assert.equal(res3.newLayer.name, 'Layer 3');
});

test('toggleLayerVisibility toggles visibility independently per layer', () => {
  let layers = createInitialLayers();
  layers = addTransparentLayer(layers, { id: 'layer_2' }).layers;

  layers = toggleLayerVisibility(layers, 'layer_2');
  assert.equal(layers[0].visible, true);
  assert.equal(layers[1].visible, false);

  layers = toggleLayerVisibility(layers, 'layer_2');
  assert.equal(layers[1].visible, true);
});

test('moveLayer and getLayersDisplayOrder enforce top-to-bottom UI order and boundary guards', () => {
  let layers = createInitialLayers();
  layers = addTransparentLayer(layers, { id: 'layer_2' }).layers;
  layers = addTransparentLayer(layers, { id: 'layer_3' }).layers;

  // Display order places highest z-index first
  assert.deepEqual(
    getLayersDisplayOrder(layers).map((l) => l.id),
    ['layer_3', 'layer_2', 'layer_1']
  );
  assert.equal(canMoveLayerUp(layers, 'layer_3'), false);
  assert.equal(canMoveLayerDown(layers, 'layer_1'), false);
  assert.equal(canMoveLayerUp(layers, 'layer_1'), true);
  assert.equal(canMoveLayerDown(layers, 'layer_3'), true);

  // Move Layer 1 up once -> swaps with Layer 2
  layers = moveLayer(layers, 'layer_1', 'up');
  assert.deepEqual(
    layers.map((l) => l.id),
    ['layer_2', 'layer_1', 'layer_3']
  );

  // Drag reorder Layer 3 down to Layer 2 slot
  layers = reorderLayersFromDisplayOrder(layers, 'layer_3', 'layer_2');
  assert.deepEqual(
    layers.map((l) => l.id),
    ['layer_3', 'layer_2', 'layer_1']
  );
});

test('deleteLayer prevents deleting the last remaining layer and updates active layer safely', () => {
  const single = createInitialLayers();
  const denied = deleteLayer(single, 'layer_1', 'layer_1');
  assert.equal(denied.deleted, false);
  assert.equal(denied.layers.length, 1);

  let two = addTransparentLayer(single, { id: 'layer_2' }).layers;
  two = addTransparentLayer(two, { id: 'layer_3' }).layers;
  const afterDelete = deleteLayer(two, 'layer_2', 'layer_2');
  assert.equal(afterDelete.deleted, true);
  assert.deepEqual(
    afterDelete.layers.map((l) => l.id),
    ['layer_1', 'layer_3']
  );
  assert.equal(afterDelete.activeLayerId, 'layer_3');
});

test('renameLayer and setLayerOpacity sanitize inputs cleanly', () => {
  let layers = createInitialLayers();
  layers = renameLayer(layers, 'layer_1', '  Sketch Outline  ');
  assert.equal(layers[0].name, 'Sketch Outline');
  layers = renameLayer(layers, 'layer_1', '   ');
  assert.equal(layers[0].name, 'Sketch Outline');

  layers = setLayerOpacity(layers, 'layer_1', 0.55);
  assert.equal(layers[0].opacity, 0.55);
  layers = setLayerOpacity(layers, 'layer_1', -1);
  assert.equal(layers[0].opacity, 0.05);
});

test('getVisibleOrderedStrokes respects layer z-order, visibility, and legacy untagged fallback', () => {
  let layers = createInitialLayers();
  layers = addTransparentLayer(layers, { id: 'layer_2' }).layers;

  const strokes: Stroke[] = [
    {
      id: 's_legacy',
      tool: 'brush',
      color: '#111111',
      size: 4,
      opacity: 1,
      points: [{ x: 10, y: 10 }],
    },
    {
      id: 's_top',
      layerId: 'layer_2',
      tool: 'brush',
      color: '#0000FF',
      size: 4,
      opacity: 1,
      points: [{ x: 20, y: 20 }],
    },
    {
      id: 's_bottom',
      layerId: 'layer_1',
      tool: 'brush',
      color: '#FF0000',
      size: 4,
      opacity: 1,
      points: [{ x: 20, y: 20 }],
    },
  ];

  assert.equal(resolveStrokeLayerId(strokes[0], layers), 'layer_1');
  // Layer 1 is bottom, Layer 2 is top -> s_legacy, s_bottom, then s_top
  assert.deepEqual(
    getVisibleOrderedStrokes(strokes, layers).map((s) => s.id),
    ['s_legacy', 's_bottom', 's_top']
  );

  // Reorder Layer 1 above Layer 2 -> s_top renders BEFORE s_legacy/s_bottom
  const reordered = moveLayer(layers, 'layer_1', 'up');
  assert.deepEqual(
    getVisibleOrderedStrokes(strokes, reordered).map((s) => s.id),
    ['s_top', 's_legacy', 's_bottom']
  );

  // Hide Layer 2 -> s_top omitted
  const hiddenTop = toggleLayerVisibility(reordered, 'layer_2');
  assert.deepEqual(
    getVisibleOrderedStrokes(strokes, hiddenTop).map((s) => s.id),
    ['s_legacy', 's_bottom']
  );
});
