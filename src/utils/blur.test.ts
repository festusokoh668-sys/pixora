import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blendBlurredPixelsWithMask,
  computeGaussianKernel,
  gaussianBlurImageData,
  getBlurBrushRadius,
  getBlurBrushStrokeWidth,
  getBlurStrokeBounds,
} from './blur';

test('computeGaussianKernel produces symmetric normalized odd-length weights', () => {
  const kernel = computeGaussianKernel(4);
  assert.equal(kernel.length, 9);

  let sum = 0;
  for (let i = 0; i < kernel.length; i++) {
    sum += kernel[i];
  }
  assert.ok(Math.abs(sum - 1) < 1e-5, `expected kernel sum ~1, got ${sum}`);
  assert.ok(kernel[4] > kernel[3] && kernel[3] > kernel[0]);
  assert.ok(Math.abs(kernel[0] - kernel[8]) < 1e-6);
  assert.ok(Math.abs(kernel[2] - kernel[6]) < 1e-6);
});

test('getBlurBrushRadius and getBlurBrushStrokeWidth scale monotonically with size', () => {
  assert.ok(getBlurBrushRadius(24) > getBlurBrushRadius(5));
  assert.ok(getBlurBrushStrokeWidth(24) > getBlurBrushStrokeWidth(5));
  assert.ok(getBlurBrushRadius(1) >= 2);
  assert.ok(getBlurBrushStrokeWidth(1) >= 6);
});

test('gaussianBlurImageData softens sharp black-to-white edge into monotonic gray gradient', () => {
  const w = 16;
  const h = 8;
  const src = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const val = x < 8 ? 0 : 255;
      src[idx] = val;
      src[idx + 1] = val;
      src[idx + 2] = val;
      src[idx + 3] = 255;
    }
  }

  const blurred = gaussianBlurImageData(src, w, h, 3);
  const row = 4;
  const leftEdgeIdx = (row * w + 7) * 4;
  const rightEdgeIdx = (row * w + 8) * 4;
  const farLeftIdx = (row * w + 0) * 4;
  const farRightIdx = (row * w + 15) * 4;

  // Before blur, difference between x=7 (0) and x=8 (255) is 255; after blur it must soften significantly
  assert.ok(blurred[leftEdgeIdx] > 40 && blurred[leftEdgeIdx] < 130);
  assert.ok(blurred[rightEdgeIdx] > 125 && blurred[rightEdgeIdx] < 215);
  assert.ok(blurred[rightEdgeIdx] - blurred[leftEdgeIdx] < 140);
  assert.ok(blurred[farLeftIdx] < blurred[leftEdgeIdx]);
  assert.ok(blurred[farRightIdx] > blurred[rightEdgeIdx]);
});

test('gaussianBlurImageData premultiplies alpha to avoid dark halos near transparent background', () => {
  const w = 9;
  const h = 9;
  const src = new Uint8ClampedArray(w * h * 4);

  // Bright pure red stripe down center on fully transparent black (0,0,0,0) background
  for (let y = 0; y < h; y++) {
    for (let x = 3; x <= 5; x++) {
      const idx = (y * w + x) * 4;
      src[idx] = 255;
      src[idx + 1] = 0;
      src[idx + 2] = 0;
      src[idx + 3] = 255;
    }
  }

  const blurred = gaussianBlurImageData(src, w, h, 2);
  // Neighboring previously-transparent pixel (x=2, y=4) must receive bright red RGB (no dark fringe), with partial alpha
  const neighborIdx = (4 * w + 2) * 4;
  assert.ok(blurred[neighborIdx + 3] > 0 && blurred[neighborIdx + 3] < 255);
  assert.ok(blurred[neighborIdx] >= 245, `expected pure red channel >= 245, got ${blurred[neighborIdx]}`);
  assert.equal(blurred[neighborIdx + 1], 0);
  assert.equal(blurred[neighborIdx + 2], 0);
});

test('activeMask restricts blur exclusively to masked stroke pixels and preserves unmasked areas', () => {
  const w = 12;
  const h = 6;
  const src = new Uint8ClampedArray(w * h * 4);
  const mask = new Uint8Array(w * h);

  // Two identical sharp vertical edges at x=2|3 and x=8|9
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const c = x >= 3 && x <= 8 ? 255 : 0;
      src[idx] = c;
      src[idx + 1] = c;
      src[idx + 2] = c;
      src[idx + 3] = 255;
    }
  }

  // Mask covers ONLY the right edge around x=8..9
  for (let y = 1; y <= 4; y++) {
    for (let x = 7; x <= 10; x++) {
      mask[y * w + x] = 255;
    }
  }

  const blurred = gaussianBlurImageData(src, w, h, 2, mask);
  const final = blendBlurredPixelsWithMask(src, blurred, mask, 1);

  // Unmasked left edge must remain 100% untouched (0 and 255)
  assert.equal(final[(3 * w + 2) * 4], 0);
  assert.equal(final[(3 * w + 3) * 4], 255);

  // Masked right edge must soften smoothly into intermediate grays
  assert.ok(final[(3 * w + 8) * 4] < 245);
  assert.ok(final[(3 * w + 9) * 4] > 10);
});

test('getBlurStrokeBounds returns clamped canvas bounding box padded by brush and kernel radius', () => {
  const bounds = getBlurStrokeBounds(
    [{ x: 10, y: 12, pressure: 0.5 }, { x: 100, y: 80, pressure: 1.0 }],
    20,
    6,
    1200,
    730
  );
  assert.ok(bounds !== null);
  assert.equal(bounds.x, 0);
  assert.equal(bounds.y, 0);
  assert.ok(bounds.width > 100);
  assert.ok(bounds.height > 80);
});
