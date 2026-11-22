import test from 'node:test';
import assert from 'node:assert';
import {
  hexToHsl,
  hslToHex,
  hexToRgb,
  getSafeShareUrl,
  MAX_RECENT_COLORS,
  POPULAR_COLOR_PALETTE,
  normalizeHexColor,
  recordRecentColor,
  resolveTargetColor,
  interpolateHexColors,
  buildMultiStopGradientColors,
} from './color.ts';

test('hexToHsl converts royal blue accurately', () => {
  const hsl = hexToHsl('#164BCE');
  assert.strictEqual(hsl.h >= 220 && hsl.h <= 230, true);
  assert.strictEqual(hsl.s > 70, true);
  assert.strictEqual(hsl.l > 35 && hsl.l < 55, true);
});

test('hslToHex converts back to hex', () => {
  const hex = hslToHex(0, 100, 50); // Pure Red
  assert.strictEqual(hex.toUpperCase(), '#FF0000');

  const hexWhite = hslToHex(0, 0, 100); // Pure White
  assert.strictEqual(hexWhite.toUpperCase(), '#FFFFFF');

  const hexBlack = hslToHex(0, 0, 0); // Pure Black
  assert.strictEqual(hexBlack.toUpperCase(), '#000000');
});

test('getSafeShareUrl produces valid unbroken URLs with query parameters', () => {
  // In Node environment (mock window or fallback)
  const urlWithTemplate = getSafeShareUrl('real-lion');
  assert.strictEqual(typeof urlWithTemplate, 'string');
  assert.strictEqual(urlWithTemplate.includes('template=real-lion'), true);
  assert.strictEqual(urlWithTemplate.includes('null'), false);

  const urlWithStudio = getSafeShareUrl();
  assert.strictEqual(typeof urlWithStudio, 'string');
  assert.strictEqual(urlWithStudio.includes('studio=1'), true);
});

test('normalizeHexColor validates and normalizes #RGB and #RRGGBB strings', () => {
  assert.strictEqual(normalizeHexColor('#f0a'), '#FF00AA');
  assert.strictEqual(normalizeHexColor('  164bce '), '#164BCE');
  assert.strictEqual(normalizeHexColor('#INVALID'), null);
  assert.strictEqual(normalizeHexColor('#12'), null);
});

test('recordRecentColor maintains up to 10 unique colors in most-recent-first order', () => {
  assert.strictEqual(MAX_RECENT_COLORS, 10);

  let history: string[] = [];
  const samplePalette = [
    '#111111', '#222222', '#333333', '#444444', '#555555',
    '#666666', '#777777', '#888888', '#999999', '#AAAAAA',
    '#BBBBBB', '#CCCCCC',
  ];

  for (const hex of samplePalette) {
    history = recordRecentColor(history, hex);
  }

  assert.strictEqual(history.length, 10);
  // Most recent is last inserted (#CCCCCC); oldest two (#111111, #222222) evicted
  assert.strictEqual(history[0], '#CCCCCC');
  assert.strictEqual(history[9], '#333333');
  assert.strictEqual(history.includes('#111111'), false);
  assert.strictEqual(history.includes('#222222'), false);

  // Re-selecting an existing color moves it to index 0 without creating duplicates
  history = recordRecentColor(history, '#555555');
  assert.strictEqual(history.length, 10);
  assert.strictEqual(history[0], '#555555');
  assert.strictEqual(history.filter((c) => c === '#555555').length, 1);

  // Case-insensitive / shorthand deduplication (#fff === #FFFFFF)
  history = recordRecentColor(history, '#fff');
  history = recordRecentColor(history, '#22B14C');
  history = recordRecentColor(history, '#ffffff');
  assert.strictEqual(history[0], '#FFFFFF');
  assert.strictEqual(history.filter((c) => c === '#FFFFFF').length, 1);

  // Invalid colors leave history untouched
  const beforeInvalid = [...history];
  assert.deepStrictEqual(recordRecentColor(history, 'not-a-color'), beforeInvalid);
});

test('POPULAR_COLOR_PALETTE contains 12 unique valid uppercase presets', () => {
  assert.strictEqual(POPULAR_COLOR_PALETTE.length, 12);

  const normalizedSet = new Set<string>();
  for (const preset of POPULAR_COLOR_PALETTE) {
    assert.strictEqual(typeof preset.name, 'string');
    assert.strictEqual(preset.name.trim().length > 0, true);
    const normalized = normalizeHexColor(preset.hex);
    assert.notStrictEqual(normalized, null);
    assert.strictEqual(preset.hex, normalized);
    assert.strictEqual(normalizedSet.has(preset.hex), false);
    normalizedSet.add(preset.hex);
  }
});

test('resolveTargetColor returns primary or secondary slot color appropriately', () => {
  assert.strictEqual(resolveTargetColor('primary', '#164BCE', '#FFFFFF'), '#164BCE');
  assert.strictEqual(resolveTargetColor('secondary', '#164BCE', '#EF4444'), '#EF4444');
  assert.strictEqual(resolveTargetColor('secondary', '#164BCE', undefined), '#164BCE');
});

test('interpolateHexColors and buildMultiStopGradientColors produce vivid chromatic and clean grayscale transitions', () => {
  assert.strictEqual(interpolateHexColors('#2563EB', '#EF4444', 0), '#2563EB');
  assert.strictEqual(interpolateHexColors('#2563EB', '#EF4444', 1), '#EF4444');

  // Blue -> Red midpoint traverses vivid violet/magenta rather than muddy gray
  const midBlueRed = interpolateHexColors('#2563EB', '#EF4444', 0.5);
  const midHsl = hexToHsl(midBlueRed);
  assert.strictEqual(midHsl.s > 60, true, `Expected saturated midpoint, got ${midBlueRed}`);
  assert.strictEqual(midHsl.h >= 260 && midHsl.h <= 325, true, `Expected violet/magenta hue, got ${midHsl.h}`);

  // Black -> White midpoint uses clean RGB neutral gray
  const midGray = interpolateHexColors('#000000', '#FFFFFF', 0.5);
  const grayRgb = hexToRgb(midGray);
  assert.strictEqual(Math.abs(grayRgb.r - 128) <= 1, true);
  assert.strictEqual(grayRgb.r, grayRgb.g);
  assert.strictEqual(grayRgb.g, grayRgb.b);

  // 5-stop gradient array starts at primary and ends at secondary
  const stops = buildMultiStopGradientColors('#EF4444', '#FACC15', 5);
  assert.strictEqual(stops.length, 5);
  assert.strictEqual(stops[0], '#EF4444');
  assert.strictEqual(stops[4], '#FACC15');
  assert.strictEqual(new Set(stops).size, 5);
});


