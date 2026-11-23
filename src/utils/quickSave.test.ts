import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTimestampedPngFilename,
  sanitizeQuickSaveFilename,
  parsePngDataUrl,
} from './quickSave';

test('generateTimestampedPngFilename generates timestamped PNG filename with sanitized prefix', () => {
  const fixedDate = new Date('2026-11-23T08:40:12.095Z');
  assert.equal(
    generateTimestampedPngFilename('Sunset Lion!', fixedDate),
    'Sunset_Lion_2026-11-23_08-40-12-095.png'
  );
  assert.equal(
    generateTimestampedPngFilename('   ', fixedDate),
    'Pixora_2026-11-23_08-40-12-095.png'
  );
});

test('sanitizeQuickSaveFilename blocks traversal segments and enforces .png extension', () => {
  const fixedDate = new Date('2026-11-23T08:40:12.095Z');
  assert.equal(
    sanitizeQuickSaveFilename('../../etc/passwd.png', fixedDate),
    'passwd.png'
  );
  assert.equal(
    sanitizeQuickSaveFilename('my artwork 01', fixedDate),
    'my_artwork_01.png'
  );
  assert.equal(
    sanitizeQuickSaveFilename('...', fixedDate),
    'Pixora_2026-11-23_08-40-12-095.png'
  );
});

test('parsePngDataUrl validates PNG header bytes and rejects non-PNG payloads', () => {
  // Minimal valid 1x1 transparent PNG
  const valid1x1Png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const decoded = parsePngDataUrl(valid1x1Png);
  assert.ok(decoded instanceof Uint8Array);
  assert.equal(decoded[0], 0x89);
  assert.equal(decoded[1], 0x50);
  assert.equal(decoded[2], 0x4e);
  assert.equal(decoded[3], 0x47);

  assert.equal(parsePngDataUrl('data:image/jpeg;base64,/9j/4AAQ'), null);
  assert.equal(parsePngDataUrl('data:image/png;base64,not_a_real_png_header'), null);
  assert.equal(parsePngDataUrl(null), null);
});
