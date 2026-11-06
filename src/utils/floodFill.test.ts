import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToUint32, colorsMatch, floodFill } from './floodFill';

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

test('colorsMatch respects tolerance thresholds', () => {
  const white = hexToUint32('#FFFFFF', 1.0);
  const nearWhite = hexToUint32('#F5F5F5', 1.0);
  const black = hexToUint32('#000000', 1.0);

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
