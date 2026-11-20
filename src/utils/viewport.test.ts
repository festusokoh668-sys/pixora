import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampZoom,
  clampPanOffset,
  getPointerPairMetrics,
  calculatePinchZoomAndPan,
  calculateWheelZoomAndPan,
} from './viewport';

test('clampZoom bounds values between 0.5 and 3.5', () => {
  assert.equal(clampZoom(0.1), 0.5);
  assert.equal(clampZoom(1.234), 1.23);
  assert.equal(clampZoom(5.0), 3.5);
  assert.equal(clampZoom(Number.NaN), 1.0);
});

test('getPointerPairMetrics calculates distance and midpoint accurately', () => {
  const { distance, center } = getPointerPairMetrics(
    { clientX: 100, clientY: 200 },
    { clientX: 160, clientY: 280 }
  );
  assert.equal(distance, 100);
  assert.deepEqual(center, { x: 130, y: 240 });
});

test('calculatePinchZoomAndPan supports pure two-finger panning without zoom change', () => {
  const result = calculatePinchZoomAndPan({
    startDistance: 100,
    currentDistance: 100,
    startZoom: 1.0,
    startPan: { x: 0, y: 0 },
    startCenter: { x: 200, y: 300 },
    currentCenter: { x: 245, y: 260 },
    viewportCenter: { x: 195, y: 400 },
    containerWidth: 390,
    containerHeight: 650,
  });

  assert.equal(result.zoomLevel, 1.0);
  assert.deepEqual(result.panOffset, { x: 45, y: -40 });
});

test('calculatePinchZoomAndPan keeps off-center pinch focal point anchored under fingers', () => {
  // Viewport center at (500, 400); fingers pinch at (200, 200) -> offset (-300, -200) from center
  // Doubling distance zooms 1.0 -> 2.0; local point (-300, -200) now sits at 2*(-300, -200) = (-600, -400)
  // To keep it at screen offset (-300, -200), panOffset must become (+300, +200).
  const result = calculatePinchZoomAndPan({
    startDistance: 100,
    currentDistance: 200,
    startZoom: 1.0,
    startPan: { x: 0, y: 0 },
    startCenter: { x: 200, y: 200 },
    currentCenter: { x: 200, y: 200 },
    viewportCenter: { x: 500, y: 400 },
    containerWidth: 1000,
    containerHeight: 800,
  });

  assert.equal(result.zoomLevel, 2.0);
  assert.deepEqual(result.panOffset, { x: 300, y: 200 });
});

test('clampPanOffset prevents panning the canvas completely out of view', () => {
  const clamped = clampPanOffset({ x: 5000, y: -5000 }, 1.0, 400, 600);
  assert.equal(clamped.x, 300);
  assert.equal(clamped.y, -450);
});

test('calculateWheelZoomAndPan anchors zoom around pointer cursor', () => {
  const result = calculateWheelZoomAndPan({
    currentZoom: 1.0,
    currentPan: { x: 0, y: 0 },
    zoomDelta: 0.5,
    cursor: { x: 700, y: 500 },
    viewportCenter: { x: 500, y: 400 },
    containerWidth: 1000,
    containerHeight: 800,
  });

  assert.equal(result.zoomLevel, 1.5);
  assert.deepEqual(result.panOffset, { x: -100, y: -50 });
});
