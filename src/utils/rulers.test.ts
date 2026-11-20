import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRulerStepInterval,
  generateRulerTicks,
  clientCoordToRulerCanvasPx,
} from './rulers';

test('getRulerStepInterval adapts tick density cleanly for zoom levels', () => {
  assert.deepEqual(getRulerStepInterval(1.0), { minorStep: 10, midStep: 50, majorStep: 100 });
  assert.deepEqual(getRulerStepInterval(2.5), { minorStep: 5, midStep: 25, majorStep: 50 });
  assert.deepEqual(getRulerStepInterval(0.5), { minorStep: 25, midStep: 100, majorStep: 200 });
  assert.deepEqual(getRulerStepInterval(0.25), { minorStep: 50, midStep: 200, majorStep: 400 });
});

test('generateRulerTicks produces major, mid, and minor ticks with accurate display offsets', () => {
  const ticks = generateRulerTicks(200, 1.0);
  assert.equal(ticks[0].posPx, 0);
  assert.equal(ticks[0].level, 'major');
  assert.equal(ticks[0].label, '0');

  const tick50 = ticks.find((t) => t.posPx === 50);
  assert.equal(tick50?.level, 'mid');
  assert.equal(tick50?.label, undefined);

  const tick100 = ticks.find((t) => t.posPx === 100);
  assert.equal(tick100?.level, 'major');
  assert.equal(tick100?.label, '100');
  assert.equal(tick100?.displayOffsetPx, 100);

  const zoomedTicks = generateRulerTicks(100, 2.0);
  const zoomed50 = zoomedTicks.find((t) => t.posPx === 50);
  assert.equal(zoomed50?.level, 'major');
  assert.equal(zoomed50?.displayOffsetPx, 100);
});

test('clientCoordToRulerCanvasPx converts pointer coordinates with scroll, padding, and clamping', () => {
  // Ruler starts at 18px, padding=6px, scroll=0, zoom=1.0 -> clientCoord 124 maps to 100px
  assert.equal(clientCoordToRulerCanvasPx(124, 18, 0, 1.0, 819, 6), 100);

  // Scrolled by 50px at 200% zoom -> (124 - 18 + 50 - 6) / 2 = 75px
  assert.equal(clientCoordToRulerCanvasPx(124, 18, 50, 2.0, 819, 6), 75);

  // Out-of-bounds values clamp cleanly to [0..maxCanvasPx]
  assert.equal(clientCoordToRulerCanvasPx(0, 18, 0, 1.0, 819, 6), 0);
  assert.equal(clientCoordToRulerCanvasPx(5000, 18, 0, 1.0, 819, 6), 819);
});
