import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CUSTOM_COLORS,
  extractColorPaletteFromPixels,
  mergePaletteIntoCustomColors,
} from './paletteExtraction';

function buildSolidBlocksImage(
  blocks: Array<{ r: number; g: number; b: number; a?: number; pixels: number }>
): { data: Uint8ClampedArray; width: number; height: number } {
  const total = blocks.reduce((acc, b) => acc + b.pixels, 0);
  const data = new Uint8ClampedArray(total * 4);
  let offset = 0;

  for (const block of blocks) {
    const alpha = block.a ?? 255;
    for (let i = 0; i < block.pixels; i++) {
      data[offset] = block.r;
      data[offset + 1] = block.g;
      data[offset + 2] = block.b;
      data[offset + 3] = alpha;
      offset += 4;
    }
  }

  return { data, width: total, height: 1 };
}

test('extractColorPaletteFromPixels extracts exact dominant distinct colors from multi-region pixels', () => {
  const img = buildSolidBlocksImage([
    { r: 237, g: 28, b: 36, pixels: 400 },   // #ED1C24 Red
    { r: 0, g: 162, b: 232, pixels: 350 },   // #00A2E8 Sky Blue
    { r: 255, g: 201, b: 14, pixels: 250 },  // #FFC90E Gold
    { r: 34, g: 177, b: 76, pixels: 180 },   // #22B14C Green
  ]);

  const palette = extractColorPaletteFromPixels(img.data, img.width, img.height, { maxColors: 6 });
  const hexes = palette.map((s) => s.hex);

  assert.equal(hexes.length, 4);
  assert.ok(hexes.includes('#ED1C24'), `Expected #ED1C24 in ${hexes.join(', ')}`);
  assert.ok(hexes.includes('#00A2E8'), `Expected #00A2E8 in ${hexes.join(', ')}`);
  assert.ok(hexes.includes('#FFC90E'), `Expected #FFC90E in ${hexes.join(', ')}`);
  assert.ok(hexes.includes('#22B14C'), `Expected #22B14C in ${hexes.join(', ')}`);
  assert.ok(palette.every((s) => s.percentage >= 1 && s.percentage <= 100));
});

test('extractColorPaletteFromPixels ignores transparent background pixels and avoids black pollution', () => {
  const img = buildSolidBlocksImage([
    { r: 0, g: 0, b: 0, a: 0, pixels: 800 },     // transparent black background
    { r: 255, g: 127, b: 39, a: 255, pixels: 200 }, // #FF7F27 Orange
    { r: 163, g: 73, b: 164, a: 255, pixels: 150 }, // #A349A4 Purple
  ]);

  const palette = extractColorPaletteFromPixels(img.data, img.width, img.height, { maxColors: 5 });
  const hexes = palette.map((s) => s.hex);

  assert.equal(hexes.includes('#000000'), false);
  assert.deepEqual(new Set(hexes), new Set(['#FF7F27', '#A349A4']));
});

test('extractColorPaletteFromPixels handles empty, transparent-only, and single-color inputs safely', () => {
  assert.deepEqual(extractColorPaletteFromPixels(new Uint8ClampedArray(0), 0, 0), []);

  const allTransparent = buildSolidBlocksImage([{ r: 10, g: 20, b: 30, a: 0, pixels: 64 }]);
  assert.deepEqual(
    extractColorPaletteFromPixels(allTransparent.data, allTransparent.width, allTransparent.height),
    []
  );

  const solid = buildSolidBlocksImage([{ r: 25, g: 121, b: 202, a: 255, pixels: 100 }]);
  const result = extractColorPaletteFromPixels(solid.data, solid.width, solid.height);
  assert.equal(result.length, 1);
  assert.equal(result[0].hex, '#1979CA');
  assert.equal(result[0].percentage, 100);
});

test('extractColorPaletteFromPixels deduplicates nearly identical shades when distinct accent colors exist', () => {
  const img = buildSolidBlocksImage([
    { r: 20, g: 100, b: 200, pixels: 400 },
    { r: 24, g: 103, b: 204, pixels: 350 }, // almost identical blue
    { r: 240, g: 80, b: 40, pixels: 200 },  // distinct coral orange
  ]);

  const palette = extractColorPaletteFromPixels(img.data, img.width, img.height, { maxColors: 5 });
  assert.equal(palette.length, 2);
});

test('mergePaletteIntoCustomColors normalizes, deduplicates, preserves order, and caps at MAX_CUSTOM_COLORS', () => {
  const existing = ['#111111', '#222222', '#333333'];
  const incoming = ['#ff00aa', '#222222', 'bad-hex', '#00ccff', '#ffaa00', '#336699', '#993366', '#44bb55', '#aa5522', '#778899', '#556677', '#123456'];

  const merged = mergePaletteIntoCustomColors(existing, incoming);
  assert.equal(merged.length, MAX_CUSTOM_COLORS);
  assert.equal(merged[0], '#FF00AA');
  assert.equal(merged[1], '#222222');
  assert.equal(merged.filter((c) => c === '#222222').length, 1);
  assert.equal(merged.includes('#123456'), false);
});
