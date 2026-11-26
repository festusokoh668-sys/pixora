import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BUCKET_TOLERANCE,
  MAX_BUCKET_TOLERANCE,
  MIN_BUCKET_TOLERANCE,
  clampBucketTolerance,
  getBucketToleranceLabel,
  hexToUint32,
  colorsMatch,
  floodFill,
} from './floodFill';

test('hexToUint32 correctly packs hex string into 32-bit integer', () => {
  // Pure Red: #FF0000 -> R=255, G=0, B=0, A=255
  const red = hexToUint32('#FF0000', 1.0);
  assert.equal(red & 0xff, 255);
  assert.equal((red >> 8) & 0xff, 0);
  assert.equal((red >> 16) & 0xff, 0);
  assert.equal((red >> 24) & 0xff, 255);

  // Pure White: #FFFFFF
  const white = hexToUint32('#FFFFFF', 1.0);
  assert.equal(white, 0xffffffff);
});

test('clampBucketTolerance and getBucketToleranceLabel handle range boundaries', () => {
  assert.equal(MIN_BUCKET_TOLERANCE, 0);
  assert.equal(MAX_BUCKET_TOLERANCE, 255);
  assert.equal(DEFAULT_BUCKET_TOLERANCE, 38);

  assert.equal(clampBucketTolerance(-12), 0);
  assert.equal(clampBucketTolerance(300), 255);
  assert.equal(clampBucketTolerance(42.6), 43);
  assert.equal(clampBucketTolerance(Number.NaN), DEFAULT_BUCKET_TOLERANCE);

  assert.equal(getBucketToleranceLabel(0), 'Exact');
  assert.equal(getBucketToleranceLabel(12), 'Tight');
  assert.equal(getBucketToleranceLabel(38), 'Balanced');
  assert.equal(getBucketToleranceLabel(110), 'Wide');
  assert.equal(getBucketToleranceLabel(220), 'Maximum');
});

test('colorsMatch respects tolerance thresholds', () => {
  const white = hexToUint32('#FFFFFF', 1.0);
  const nearWhite = hexToUint32('#F5F5F5', 1.0);
  const black = hexToUint32('#000000', 1.0);

  // Exact match only at tolerance 0
  assert.equal(colorsMatch(white, nearWhite, 0), false);
  assert.equal(colorsMatch(white, white, 0), true);
  // Near-white matches white with tolerance 25
  assert.equal(colorsMatch(white, nearWhite, 25), true);
  // Black does NOT match white
  assert.equal(colorsMatch(white, black, 25), false);
});

test('floodFill fills enclosed region and stops at boundary', () => {
  const width = 10;
  const height = 10;
  const buffer = new Uint32Array(width * height);

  // Initialize with white background
  const white = 0xffffffff;
  const black = 0xff000000;
  const blue = hexToUint32('#164BCE', 1.0);

  buffer.fill(white);

  // Draw a 6x6 square boundary of black pixels
  // from x=2..7, y=2..7
  for (let x = 2; x <= 7; x++) {
    buffer[2 * width + x] = black; // top border
    buffer[7 * width + x] = black; // bottom border
  }
  for (let y = 2; y <= 7; y++) {
    buffer[y * width + 2] = black; // left border
    buffer[y * width + 7] = black; // right border
  }

  // Mock canvas context
  const mockCtx = {
    canvas: { width, height },
    getImageData: () => ({
      data: new Uint8ClampedArray(buffer.buffer),
    }),
    putImageData: (imgData: any) => {
      buffer.set(new Uint32Array(imgData.data.buffer));
    },
  } as unknown as CanvasRenderingContext2D;

  // Run flood fill inside the square at (4, 4)
  const filled = floodFill(mockCtx, 4, 4, '#164BCE', 1.0);
  assert.equal(filled, true);

  // Center (4, 4) should now be blue!
  assert.equal(buffer[4 * width + 4], blue);
  assert.equal(buffer[3 * width + 3], blue);

  // Borders should STILL be black!
  assert.equal(buffer[2 * width + 4], black);
  assert.equal(buffer[7 * width + 4], black);

  // Outside (0, 0) should STILL be white!
  assert.equal(buffer[0], white);
});

test('floodFill tolerance controls spread across multi-tone textured strips', () => {
  // 5x1 horizontal gradient-like texture:
  // x=0: #C8C8C8 (200), x=1: #BEBEBE (190), x=2: #AA9E9E (approx 170/158/158), x=3: #6E6E6E (110), x=4: #141414 (20)
  const makeBuffer = () =>
    new Uint32Array([
      hexToUint32('#C8C8C8', 1.0),
      hexToUint32('#BEBEBE', 1.0),
      hexToUint32('#9C9C9C', 1.0),
      hexToUint32('#646464', 1.0),
      hexToUint32('#141414', 1.0),
    ]);

  const fillRed = hexToUint32('#ED1C24', 1.0);

  const runFillWithTolerance = (tolerance: number) => {
    const buf = makeBuffer();
    const mockCtx = {
      canvas: { width: 5, height: 1 },
      getImageData: () => ({ data: new Uint8ClampedArray(buf.buffer) }),
      putImageData: (imgData: any) => {
        buf.set(new Uint32Array(imgData.data.buffer));
      },
    } as unknown as CanvasRenderingContext2D;
    const filled = floodFill(mockCtx, 0, 0, '#ED1C24', 1.0, tolerance);
    assert.equal(filled, true);
    return Array.from(buf).map((px) => px === fillRed);
  };

  // Tolerance 0: exact pixel only (fills x=0 only)
  assert.deepEqual(runFillWithTolerance(0), [true, false, false, false, false]);

  // Tolerance 12: covers x=0 (200) and x=1 (190), stops before x=2 (156)
  assert.deepEqual(runFillWithTolerance(12), [true, true, false, false, false]);

  // Tolerance 40: spreads across x=0, x=1, x=2 (200 -> 156 = 44 per channel, RMS*sqrt(4)=38.1 <= 40), stops before x=3 (100)
  assert.deepEqual(runFillWithTolerance(40), [true, true, true, false, false]);

  // Tolerance 100: spreads across x=0..x=3 (200 -> 100 = 86.6 <= 100), stops at dark x=4 (20)
  assert.deepEqual(runFillWithTolerance(100), [true, true, true, true, false]);
});

test('floodFill with tolerance 0 replaces near-identical color rather than skipping', () => {
  const buf = new Uint32Array([hexToUint32('#FDFDFD', 1.0)]);
  const white = hexToUint32('#FFFFFF', 1.0);
  const mockCtx = {
    canvas: { width: 1, height: 1 },
    getImageData: () => ({ data: new Uint8ClampedArray(buf.buffer) }),
    putImageData: (imgData: any) => {
      buf.set(new Uint32Array(imgData.data.buffer));
    },
  } as unknown as CanvasRenderingContext2D;

  const filled = floodFill(mockCtx, 0, 0, '#FFFFFF', 1.0, 0);
  assert.equal(filled, true);
  assert.equal(buf[0], white);
});
