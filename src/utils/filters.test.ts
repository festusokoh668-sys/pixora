import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLayerFilterToContext, getLayerFilterSpec } from './filters';

test('getLayerFilterSpec returns accurate CSS filter and globalCompositeOperation settings', () => {
  const gray = getLayerFilterSpec('grayscale');
  assert.equal(gray.cssFilter, 'grayscale(100%)');
  assert.equal(gray.compositeMode, 'saturation');

  const sepia = getLayerFilterSpec('sepia');
  assert.equal(sepia.cssFilter, 'sepia(100%)');
  assert.equal(sepia.compositeMode, 'color');

  const invert = getLayerFilterSpec('invert');
  assert.equal(invert.cssFilter, 'invert(100%)');
  assert.equal(invert.compositeMode, 'difference');
});

test('applyLayerFilterToContext configures canvas filter property and resets cleanly', () => {
  const calls: string[] = [];
  const mockCtx = {
    filter: 'none',
    fillStyle: '',
    globalCompositeOperation: 'source-over',
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    clearRect: () => calls.push('clearRect'),
    fillRect: () => calls.push('fillRect'),
    drawImage: () => calls.push(`drawImage:${mockCtx.filter}:${mockCtx.globalCompositeOperation}`),
  } as unknown as CanvasRenderingContext2D;

  const fakeSource = {} as CanvasImageSource;

  applyLayerFilterToContext(mockCtx, fakeSource, 800, 460, 'grayscale');
  assert.ok(calls.includes('drawImage:grayscale(100%):source-over'));
  assert.equal(mockCtx.filter, 'none');

  calls.length = 0;
  applyLayerFilterToContext(mockCtx, fakeSource, 800, 460, 'sepia');
  assert.ok(calls.includes('drawImage:sepia(100%):source-over'));

  calls.length = 0;
  applyLayerFilterToContext(mockCtx, fakeSource, 800, 460, 'invert', {
    opaquePaperBackground: true,
  });
  assert.ok(calls.includes('save'));
  assert.ok(calls.includes('fillRect'));
  assert.ok(calls.includes('restore'));
  assert.equal(mockCtx.globalCompositeOperation, 'difference');
});

test('applyLayerFilterToContext uses globalCompositeOperation fallback when ctx.filter is unavailable', () => {
  const ops: string[] = [];
  const mockCtx = {
    fillStyle: '',
    globalCompositeOperation: 'source-over',
    save: () => ops.push('save'),
    restore: () => ops.push('restore'),
    clearRect: () => ops.push('clearRect'),
    fillRect: () => ops.push(`fillRect:${mockCtx.globalCompositeOperation}`),
    drawImage: () => ops.push(`drawImage:${mockCtx.globalCompositeOperation}`),
  } as unknown as CanvasRenderingContext2D;

  const fakeSource = {} as CanvasImageSource;

  applyLayerFilterToContext(mockCtx, fakeSource, 400, 300, 'sepia');
  assert.ok(ops.includes('fillRect:color'));
  assert.ok(ops.includes('drawImage:destination-in'));
});
