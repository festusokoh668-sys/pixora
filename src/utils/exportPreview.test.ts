import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeExportDimensions,
  estimateDataUrlBytes,
  estimateSvgBytes,
  formatByteSize,
  svgStringToDataUrl,
} from './exportPreview';

test('computeExportDimensions scales raster dimensions cleanly and preserves vector dimensions', () => {
  assert.deepEqual(
    computeExportDimensions({ width: 819, height: 460 }, 'png', 1),
    { width: 819, height: 460 }
  );
  assert.deepEqual(
    computeExportDimensions({ width: 819, height: 460 }, 'png', 2),
    { width: 1638, height: 920 }
  );
  assert.deepEqual(
    computeExportDimensions({ width: 819, height: 460 }, 'jpg', 4),
    { width: 3276, height: 1840 }
  );
  assert.deepEqual(
    computeExportDimensions({ width: 819, height: 460 }, 'svg', 4),
    { width: 819, height: 460 }
  );
});

test('estimateDataUrlBytes accurately computes binary byte size from base64 data URLs', () => {
  // "Hello!" in base64 is "SGVsbG8h" (8 chars, 0 padding -> 6 bytes)
  assert.equal(estimateDataUrlBytes('data:text/plain;base64,SGVsbG8h'), 6);
  // "Hi" in base64 is "SGk=" (4 chars, 1 padding -> 2 bytes)
  assert.equal(estimateDataUrlBytes('data:text/plain;base64,SGk='), 2);
  // Empty returns 0
  assert.equal(estimateDataUrlBytes(''), 0);
});

test('estimateSvgBytes and svgStringToDataUrl produce accurate byte counts and valid UTF-8 data URLs', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>';
  assert.equal(estimateSvgBytes(svg), svg.length);
  const url = svgStringToDataUrl(svg);
  assert.ok(url.startsWith('data:image/svg+xml;charset=utf-8,'));
  assert.ok(url.includes('%3Csvg'));
});

test('formatByteSize formats bytes, kilobytes, and megabytes cleanly', () => {
  assert.equal(formatByteSize(0), '0 B');
  assert.equal(formatByteSize(512), '512 B');
  assert.equal(formatByteSize(2048), '2.0 KB');
  assert.equal(formatByteSize(145408), '142 KB');
  assert.equal(formatByteSize(2 * 1024 * 1024), '2.00 MB');
});
