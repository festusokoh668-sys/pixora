import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canShareFiles,
  createPngShareFile,
  dataUrlToBlob,
  getShareSessionUrl,
  getShareText,
  getShareTitle,
  isAbortError,
  isWebShareSupported,
} from './share';

test('getShareTitle formats title with template name or default artwork title', () => {
  assert.equal(getShareTitle('Elephant'), 'Pixora - Elephant');
  assert.equal(getShareTitle('  Cat  '), 'Pixora - Cat');
  assert.equal(getShareTitle(null), 'Pixora Artwork');
  assert.equal(getShareTitle(''), 'Pixora Artwork');
});

test('getShareText generates friendly share caption', () => {
  assert.equal(
    getShareText('Dolphin'),
    'Check out my drawing of "Dolphin" on Pixora!'
  );
  assert.equal(
    getShareText(),
    'Check out my drawing created on Pixora!'
  );
});

test('getShareSessionUrl constructs paintbook or studio session URL', () => {
  assert.equal(
    getShareSessionUrl('https://example.com', 'tiger_1'),
    'https://example.com/?paintbook=tiger_1'
  );
  assert.equal(
    getShareSessionUrl('https://example.com/', null),
    'https://example.com/?studio=1'
  );
  assert.equal(
    getShareSessionUrl('', ''),
    '/?studio=1'
  );
});

test('isWebShareSupported detects presence of navigator.share', () => {
  assert.equal(isWebShareSupported(null), false);
  assert.equal(isWebShareSupported({}), false);
  assert.equal(isWebShareSupported({ share: async () => {} }), true);
});

test('canShareFiles checks navigator.canShare with files array', () => {
  const dummyFile = new File(['123'], 'test.png', { type: 'image/png' });

  assert.equal(canShareFiles(null, dummyFile), false);
  assert.equal(canShareFiles({}, dummyFile), false);

  const navWithoutFileSupport = {
    canShare: (data: { files?: File[] }) => !data.files,
  };
  assert.equal(canShareFiles(navWithoutFileSupport, dummyFile), false);

  const navWithFileSupport = {
    canShare: (data: { files?: File[] }) => Boolean(data.files && data.files.length > 0),
  };
  assert.equal(canShareFiles(navWithFileSupport, dummyFile), true);
  assert.equal(canShareFiles(navWithFileSupport, null), false);
});

test('isAbortError accurately detects user-cancelled share actions', () => {
  assert.equal(isAbortError(null), false);
  assert.equal(isAbortError(new Error('Network error')), false);
  assert.equal(isAbortError({ name: 'AbortError' }), true);
  assert.equal(isAbortError(new Error('The share operation was aborted')), true);
  assert.equal(isAbortError(new Error('User canceled share')), true);
});

test('dataUrlToBlob converts PNG data URL to a binary Blob and rejects invalid inputs', () => {
  // Minimal valid 1x1 transparent PNG data URL
  const validPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const blob = dataUrlToBlob(validPngDataUrl);
  assert.equal(blob.type, 'image/png');
  assert.ok(blob.size > 0);

  assert.throws(() => dataUrlToBlob('invalid-url'));
  assert.throws(() => dataUrlToBlob('data:'));
});

test('createPngShareFile wraps Blob into File with timestamped png filename', () => {
  const blob = new Blob(['png-bytes'], { type: 'image/png' });
  const file = createPngShareFile(blob, 'Rainbow Castle');
  assert.equal(file.type, 'image/png');
  assert.ok(file.name.startsWith('rainbow_castle_artwork_'));
  assert.ok(file.name.endsWith('.png'));
});
