import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYBOARD_SHORTCUTS, resolveKeyboardShortcut } from './shortcuts';

test('resolveKeyboardShortcut maps requested image transform shortcuts cleanly and leaves Ctrl+R for browser refresh', () => {
  assert.equal(resolveKeyboardShortcut({ key: 'r', ctrlKey: true }), null);
  assert.equal(
    resolveKeyboardShortcut({ key: 'R', ctrlKey: true, shiftKey: true }),
    null
  );
  assert.equal(resolveKeyboardShortcut({ key: 'f', ctrlKey: true }), 'flip-horizontal');
  assert.equal(
    resolveKeyboardShortcut({ key: 'F', ctrlKey: true, shiftKey: true }),
    'flip-vertical'
  );
  assert.equal(
    resolveKeyboardShortcut({ key: 'X', ctrlKey: true, shiftKey: true }),
    'crop'
  );
  assert.equal(resolveKeyboardShortcut({ key: 'e', ctrlKey: true }), 'resize');
  assert.equal(resolveKeyboardShortcut({ key: 'i', ctrlKey: true }), 'filter-invert');
});

test('resolveKeyboardShortcut preserves precedence between Shift and standard Ctrl shortcuts', () => {
  assert.equal(resolveKeyboardShortcut({ key: 'x', ctrlKey: true }), 'cut');
  assert.equal(
    resolveKeyboardShortcut({ key: 'x', ctrlKey: true, shiftKey: true }),
    'crop'
  );

  assert.equal(resolveKeyboardShortcut({ key: 'z', ctrlKey: true }), 'undo');
  assert.equal(
    resolveKeyboardShortcut({ key: 'z', ctrlKey: true, shiftKey: true }),
    'redo'
  );
  assert.equal(resolveKeyboardShortcut({ key: 'y', ctrlKey: true }), 'redo');
});

test('resolveKeyboardShortcut handles edit, view, zoom, and unmodified tool/size shortcuts', () => {
  assert.equal(resolveKeyboardShortcut({ key: 's', ctrlKey: true }), 'save');
  assert.equal(resolveKeyboardShortcut({ key: 'S', ctrlKey: true, shiftKey: true }), 'quick-save');
  assert.equal(resolveKeyboardShortcut({ key: 'H', ctrlKey: true, shiftKey: true }), 'share');
  assert.equal(resolveKeyboardShortcut({ key: 'o', ctrlKey: true }), 'open-templates');
  assert.equal(resolveKeyboardShortcut({ key: 'p', ctrlKey: true }), 'print');
  assert.equal(resolveKeyboardShortcut({ key: 'c', ctrlKey: true }), 'copy');
  assert.equal(resolveKeyboardShortcut({ key: 'v', ctrlKey: true }), 'paste');
  assert.equal(resolveKeyboardShortcut({ key: 'a', ctrlKey: true }), 'select-all');
  assert.equal(resolveKeyboardShortcut({ key: 'g', ctrlKey: true }), 'toggle-grid');
  assert.equal(resolveKeyboardShortcut({ key: 'r', altKey: true }), 'toggle-rulers');
  assert.equal(resolveKeyboardShortcut({ key: '=', ctrlKey: true }), 'zoom-in');
  assert.equal(resolveKeyboardShortcut({ key: '-', ctrlKey: true }), 'zoom-out');
  assert.equal(resolveKeyboardShortcut({ key: '0', ctrlKey: true }), 'zoom-reset');
  assert.equal(resolveKeyboardShortcut({ key: 'F1', ctrlKey: true }), 'toggle-ribbon');

  assert.equal(resolveKeyboardShortcut({ key: 'b' }), 'tool-brush');
  assert.equal(resolveKeyboardShortcut({ key: 'p' }), 'tool-pencil');
  assert.equal(resolveKeyboardShortcut({ key: 'k' }), 'tool-bucket');
  assert.equal(resolveKeyboardShortcut({ key: 'e' }), 'tool-eraser');
  assert.equal(resolveKeyboardShortcut({ key: 't' }), 'tool-text');
  assert.equal(resolveKeyboardShortcut({ key: 'i' }), 'tool-picker');
  assert.equal(resolveKeyboardShortcut({ key: 'm' }), 'tool-magnifier');
  assert.equal(resolveKeyboardShortcut({ key: 's' }), 'tool-select');
  assert.equal(resolveKeyboardShortcut({ key: '[' }), 'size-decrease');
  assert.equal(resolveKeyboardShortcut({ key: ']' }), 'size-increase');

  assert.equal(
    resolveKeyboardShortcut({ key: 'Delete' }, { hasSelection: true }),
    'delete-selection'
  );
  assert.equal(
    resolveKeyboardShortcut({ key: 'Delete' }, { hasSelection: false }),
    null
  );
  assert.equal(resolveKeyboardShortcut({ key: 'Escape' }), 'clear-selection');
});

test('KEYBOARD_SHORTCUTS catalog includes crop and flip entries without rotate', () => {
  const keys = KEYBOARD_SHORTCUTS.map((s) => s.keys);
  assert.equal(keys.includes('Ctrl+R'), false);
  assert.ok(keys.includes('Ctrl+Shift+X'));
  assert.ok(keys.includes('Ctrl+F'));
});
