import test from 'node:test';
import assert from 'node:assert/strict';
import { Stroke, CanvasLayer } from '../types';
import { formatAuthError } from '../firebase/auth';
import {
  cleanFirestoreObject,
  chunkSerializedProject,
  sanitizeEditableDataForFirestore,
  extractReadableFirestoreError,
} from '../firebase/firestore';
import { normalizeSyncStatus } from '../components/PaintStatusBar';

test('cleanFirestoreObject removes undefined properties recursively without mutating arrays', () => {
  const input = {
    title: 'Sunset Painting',
    description: undefined,
    dimensions: { width: 800, height: 600, depth: undefined },
    strokes: [
      { id: 's1', color: '#ff0000', extra: undefined },
      { id: 's2', color: '#00ff00' },
    ],
  };

  const output = cleanFirestoreObject(input);
  assert.equal('description' in output, false);
  assert.equal('extra' in output.strokes[0], false);
  assert.equal('depth' in output.dimensions, false);
  assert.equal(output.dimensions.width, 800);
  assert.equal(output.strokes.length, 2);
});

test('formatAuthError translates common Firebase error codes into friendly user messages', () => {
  assert.equal(
    formatAuthError({ code: 'auth/user-not-found' }),
    'No account was found with this email address.'
  );
  assert.equal(
    formatAuthError({ code: 'auth/wrong-password' }),
    'Incorrect email or password. Please verify your credentials.'
  );
  assert.equal(
    formatAuthError({ code: 'auth/email-already-in-use' }),
    'An account already exists with this email address. Please sign in instead.'
  );
  assert.equal(
    formatAuthError({ code: 'auth/weak-password' }),
    'Password is too weak. Please choose at least 6 characters.'
  );
  assert.equal(
    formatAuthError({ code: 'auth/network-request-failed' }),
    'Network connection error. Please check your internet connection.'
  );
});

test('chunkSerializedProject correctly splits large serialized strings and allows faithful reassembly', () => {
  const smallPayload = JSON.stringify({ message: 'Hello Pixora' });
  const smallChunks = chunkSerializedProject(smallPayload, 100);
  assert.equal(smallChunks.length, 1);
  assert.equal(smallChunks.join(''), smallPayload);

  const largeStrokes: Stroke[] = [];
  for (let i = 0; i < 200; i++) {
    largeStrokes.push({
      id: `stroke-${i}`,
      tool: 'brush',
      color: '#123456',
      size: 5,
      opacity: 1,
      points: [
        { x: i * 2, y: i * 3 },
        { x: i * 2 + 10, y: i * 3 + 10 },
        { x: i * 2 + 20, y: i * 3 + 20 },
      ],
    });
  }

  const serializedLarge = JSON.stringify({ strokes: largeStrokes });
  const chunks = chunkSerializedProject(serializedLarge, 1024);
  assert.ok(chunks.length > 5, 'Should produce multiple chunks');

  for (const c of chunks) {
    assert.ok(c.length <= 1024);
  }

  const reassembled = chunks.join('');
  assert.equal(reassembled, serializedLarge);
  const parsed = JSON.parse(reassembled);
  assert.equal(parsed.strokes.length, 200);
  assert.equal(parsed.strokes[0].id, 'stroke-0');
  assert.equal(parsed.strokes[199].id, 'stroke-199');
});

test('normalizeSyncStatus correctly maps raw status codes and legacy labels to exact status strings', () => {
  assert.equal(normalizeSyncStatus('local_only'), 'Local Only');
  assert.equal(normalizeSyncStatus('unsaved'), 'Local Only');
  assert.equal(normalizeSyncStatus('offline'), 'Local Only');
  assert.equal(normalizeSyncStatus('Local Only'), 'Local Only');

  assert.equal(normalizeSyncStatus('syncing'), 'Syncing');
  assert.equal(normalizeSyncStatus('saving'), 'Syncing');
  assert.equal(normalizeSyncStatus('Syncing'), 'Syncing');
  assert.equal(normalizeSyncStatus('Syncing...'), 'Syncing');

  assert.equal(normalizeSyncStatus('saved_to_cloud'), 'Saved to Cloud');
  assert.equal(normalizeSyncStatus('saved'), 'Saved to Cloud');
  assert.equal(normalizeSyncStatus('synced'), 'Saved to Cloud');
  assert.equal(normalizeSyncStatus('Saved to Cloud'), 'Saved to Cloud');

  assert.equal(normalizeSyncStatus('sync_failed'), 'Save Failed');
  assert.equal(normalizeSyncStatus('Sync Failed'), 'Save Failed');
  assert.equal(normalizeSyncStatus('Save Failed'), 'Save Failed');

  assert.equal(normalizeSyncStatus('waiting_to_sync'), 'Waiting to Sync');
  assert.equal(normalizeSyncStatus('Waiting to Sync'), 'Waiting to Sync');
});

test('sanitizeEditableDataForFirestore strips custom blob and large data URLs while keeping built-in templates', () => {
  const largeDataUrl = `data:image/png;base64,${'A'.repeat(12000)}`;
  const customEditable = sanitizeEditableDataForFirestore({
    canvasWidth: 819,
    canvasHeight: 460,
    strokes: [],
    template: {
      id: 'custom_123',
      name: 'My Photo',
      category: 'nature',
      difficulty: 'Easy',
      type: 'photo',
      mediaUrl: largeDataUrl,
      description: 'Uploaded photo',
    },
  });
  assert.equal(customEditable.template?.mediaUrl, '');

  const blobEditable = sanitizeEditableDataForFirestore({
    canvasWidth: 819,
    canvasHeight: 460,
    strokes: [],
    template: {
      id: 'tpl_external',
      name: 'Blob Photo',
      category: 'nature',
      difficulty: 'Easy',
      type: 'photo',
      mediaUrl: 'blob:http://localhost:3000/abc-123',
      description: 'Blob photo',
    },
  });
  assert.equal(blobEditable.template?.mediaUrl, '');

  const builtInEditable = sanitizeEditableDataForFirestore({
    canvasWidth: 819,
    canvasHeight: 460,
    strokes: [],
    template: {
      id: 'rose_1',
      name: 'Crimson Rose',
      category: 'nature',
      difficulty: 'Easy',
      type: 'photo',
      mediaUrl: '/templates/rose.svg',
      description: 'Built-in template',
    },
  });
  assert.equal(builtInEditable.template?.mediaUrl, '/templates/rose.svg');
});

test('extractReadableFirestoreError extracts friendly error messages from serialized JSON FirestoreErrorInfo', () => {
  const permErr = new Error(
    JSON.stringify({
      error: 'Missing or insufficient permissions.',
      operationType: 'write',
      path: 'users/u1/artworks/a1',
    })
  );
  assert.ok(extractReadableFirestoreError(permErr).includes('Permission denied by Firestore security rules'));

  const offlineErr = new Error(
    JSON.stringify({
      error: 'Failed to get document because the client is offline.',
      operationType: 'get',
      path: 'users/u1/artworks/a1',
    })
  );
  assert.ok(extractReadableFirestoreError(offlineErr).includes('Cannot reach Cloud Firestore'));
});

test('Reconstructs editable project data faithfully', () => {
  const strokes: Stroke[] = [
    {
      id: 'stroke-1',
      tool: 'brush',
      color: '#ED1C24',
      size: 10,
      opacity: 0.8,
      points: [{ x: 50, y: 50 }, { x: 60, y: 70 }],
    },
    {
      id: 'stroke-2',
      tool: 'shape',
      color: '#00A2E8',
      size: 4,
      opacity: 1,
      points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
      shapeType: 'rectangle',
      fillStyle: 'solid',
      fillColor: '#FFC90E',
    },
  ];

  const layers: CanvasLayer[] = [
    { id: 'layer-1', name: 'Background', visible: true, opacity: 1 },
    { id: 'layer-2', name: 'Ink Layer', visible: true, opacity: 0.9 },
  ];

  const projectPayload = {
    canvasWidth: 819,
    canvasHeight: 460,
    strokes,
    layers,
    activeLayerId: 'layer-2',
    templateId: 'rose_1',
    templateName: 'Crimson Rose',
  };

  const serialized = JSON.stringify(projectPayload);
  const deserialized = JSON.parse(serialized);

  assert.equal(deserialized.canvasWidth, 819);
  assert.equal(deserialized.canvasHeight, 460);
  assert.equal(deserialized.strokes.length, 2);
  assert.equal(deserialized.strokes[0].tool, 'brush');
  assert.equal(deserialized.strokes[1].shapeType, 'rectangle');
  assert.equal(deserialized.layers.length, 2);
  assert.equal(deserialized.layers[1].name, 'Ink Layer');
  assert.equal(deserialized.templateName, 'Crimson Rose');
});
