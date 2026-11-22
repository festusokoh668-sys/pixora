import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLayerFilterToContext,
  clampBrightnessDelta,
  getLayerFilterSpec,
  processImageDataPixels,
} from './filters';

test('getLayerFilterSpec returns accurate settings for grayscale, sepia, brightness, and invert', () => {
  const gray = getLayerFilterSpec('grayscale');
  assert.equal(gray.cssFilter, 'grayscale(100%)');
  assert.equal(gray.compositeMode, 'saturation');

  const sepia = getLayerFilterSpec('sepia');
  assert.equal(sepia.cssFilter, 'sepia(100%)');
  assert.equal(sepia.compositeMode, 'color');

  const brightness = getLayerFilterSpec('brightness');
  assert.equal(brightness.label, 'Brightness');

  const invert = getLayerFilterSpec('invert');
  assert.equal(invert.cssFilter, 'invert(100%)');
  assert.equal(invert.compositeMode, 'difference');
});

test('clampBrightnessDelta clamps values safely into [-100, 100]', () => {
  assert.equal(clampBrightnessDelta(25), 25);
  assert.equal(clampBrightnessDelta(-40), -40);
  assert.equal(clampBrightnessDelta(150), 100);
  assert.equal(clampBrightnessDelta(-220), -100);
  assert.equal(clampBrightnessDelta(Number.NaN), 0);
});

test('processImageDataPixels converts opaque pixels to grayscale, sepia, brightness, and invert while preserving transparent pixels', () => {
  // Pixel 0: pure red (200, 40, 20, 255), Pixel 1: transparent (10, 20, 30, 0)
  const grayBuf = new Uint8ClampedArray([200, 40, 20, 255, 10, 20, 30, 0]);
  processImageDataPixels(grayBuf, 'grayscale');
  assert.equal(grayBuf[0], grayBuf[1]);
  assert.equal(grayBuf[1], grayBuf[2]);
  assert.equal(grayBuf[3], 255);
  assert.deepEqual(Array.from(grayBuf.slice(4, 8)), [10, 20, 30, 0]);

  const sepiaBuf = new Uint8ClampedArray([100, 120, 140, 255, 0, 0, 0, 0]);
  processImageDataPixels(sepiaBuf, 'sepia');
  assert.ok(sepiaBuf[0] > sepiaBuf[1] && sepiaBuf[1] > sepiaBuf[2]);
  assert.equal(sepiaBuf[3], 255);
  assert.deepEqual(Array.from(sepiaBuf.slice(4, 8)), [0, 0, 0, 0]);

  // Brightness +20% (+51) and -20% (-51)
  const brightBuf = new Uint8ClampedArray([0, 100, 240, 255, 5, 5, 5, 0]);
  processImageDataPixels(brightBuf, 'brightness', { brightnessDelta: 20 });
  assert.deepEqual(Array.from(brightBuf.slice(0, 4)), [51, 151, 255, 255]);
  assert.deepEqual(Array.from(brightBuf.slice(4, 8)), [5, 5, 5, 0]);

  const darkBuf = new Uint8ClampedArray([30, 100, 200, 255]);
  processImageDataPixels(darkBuf, 'brightness', { brightnessDelta: -20 });
  assert.deepEqual(Array.from(darkBuf), [0, 49, 149, 255]);

  const invertBuf = new Uint8ClampedArray([10, 100, 200, 255]);
  processImageDataPixels(invertBuf, 'invert');
  assert.deepEqual(Array.from(invertBuf), [245, 155, 55, 255]);
});

test('applyLayerFilterToContext processes ImageData pixels via getImageData and putImageData when available', () => {
  const pixelStore = new Uint8ClampedArray([200, 50, 50, 255]);
  let putCalled = false;
  const mockCtx = {
    filter: 'none',
    fillStyle: '',
    globalCompositeOperation: 'source-over',
    save: () => {},
    restore: () => {},
    clearRect: () => {},
    fillRect: () => {},
    drawImage: () => {},
    getImageData: () => ({ data: pixelStore, width: 1, height: 1 }),
    putImageData: () => {
      putCalled = true;
    },
  } as unknown as CanvasRenderingContext2D;

  const fakeSource = {} as CanvasImageSource;
  applyLayerFilterToContext(mockCtx, fakeSource, 1, 1, 'grayscale');
  assert.equal(putCalled, true);
  assert.equal(pixelStore[0], pixelStore[1]);
  assert.equal(pixelStore[1], pixelStore[2]);
});

test('applyLayerFilterToContext configures canvas filter property and resets cleanly when getImageData is unavailable', () => {
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
  applyLayerFilterToContext(mockCtx, fakeSource, 800, 460, 'brightness', {
    brightnessDelta: 30,
  });
  assert.ok(calls.includes('drawImage:brightness(130%):source-over'));

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
