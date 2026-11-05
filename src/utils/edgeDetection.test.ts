import test from 'node:test';
import assert from 'node:assert';
import { generateOutlineTraceDataUrl } from './edgeDetection.ts';

test('generateOutlineTraceDataUrl handles edge cases safely', () => {
  // In Node environment without DOM Image, returns null gracefully
  const mockImg = {} as any;
  const result = generateOutlineTraceDataUrl(mockImg);
  assert.strictEqual(result, null);
});
