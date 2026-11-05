import test from 'node:test';
import assert from 'node:assert';
import { searchRealPhotoTemplates } from './mediaSearch.ts';

test('searchRealPhotoTemplates fetches real photos for elephant', async () => {
  const results = await searchRealPhotoTemplates('elephant');
  assert.strictEqual(Array.isArray(results), true);
  assert.strictEqual(results.length > 0, true);
  const first = results[0];
  assert.strictEqual(typeof first.name, 'string');
  assert.strictEqual(first.type, 'photo');
  assert.strictEqual(typeof first.mediaUrl, 'string');
  assert.strictEqual(first.mediaUrl!.startsWith('http'), true);
});

test('searchRealPhotoTemplates handles short query safely', async () => {
  const results = await searchRealPhotoTemplates('a');
  assert.deepStrictEqual(results, []);
});
