import test from 'node:test';
import assert from 'node:assert';
import { hexToHsl, hslToHex, getSafeShareUrl } from './color.ts';

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
