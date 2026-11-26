import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSymmetryGuideCoordinates,
  getSymmetryGuidesStatusMessage,
  hasHorizontalSymmetryGuide,
  hasVerticalSymmetryGuide,
  toggleSymmetryGuideAxis,
  toggleSymmetryGuides,
} from './symmetryGuides';

test('toggleSymmetryGuides toggles cleanly between none and last active guide mode', () => {
  assert.equal(toggleSymmetryGuides('none'), 'both');
  assert.equal(toggleSymmetryGuides('none', 'vertical'), 'vertical');
  assert.equal(toggleSymmetryGuides('none', 'horizontal'), 'horizontal');
  assert.equal(toggleSymmetryGuides('vertical'), 'none');
  assert.equal(toggleSymmetryGuides('horizontal'), 'none');
  assert.equal(toggleSymmetryGuides('both'), 'none');
});

test('toggleSymmetryGuideAxis independently adds and removes vertical and horizontal guides', () => {
  assert.equal(toggleSymmetryGuideAxis('none', 'vertical'), 'vertical');
  assert.equal(toggleSymmetryGuideAxis('none', 'horizontal'), 'horizontal');
  assert.equal(toggleSymmetryGuideAxis('vertical', 'horizontal'), 'both');
  assert.equal(toggleSymmetryGuideAxis('horizontal', 'vertical'), 'both');
  assert.equal(toggleSymmetryGuideAxis('both', 'vertical'), 'horizontal');
  assert.equal(toggleSymmetryGuideAxis('both', 'horizontal'), 'vertical');
  assert.equal(toggleSymmetryGuideAxis('vertical', 'vertical'), 'none');
  assert.equal(toggleSymmetryGuideAxis('horizontal', 'horizontal'), 'none');
});

test('axis visibility predicates reflect active SymmetryGuideMode accurately', () => {
  assert.equal(hasVerticalSymmetryGuide('none'), false);
  assert.equal(hasHorizontalSymmetryGuide('none'), false);

  assert.equal(hasVerticalSymmetryGuide('vertical'), true);
  assert.equal(hasHorizontalSymmetryGuide('vertical'), false);

  assert.equal(hasVerticalSymmetryGuide('horizontal'), false);
  assert.equal(hasHorizontalSymmetryGuide('horizontal'), true);

  assert.equal(hasVerticalSymmetryGuide('both'), true);
  assert.equal(hasHorizontalSymmetryGuide('both'), true);
});

test('getSymmetryGuideCoordinates computes exact canvas center and handles invalid sizes', () => {
  assert.deepEqual(getSymmetryGuideCoordinates(819, 460), { centerX: 409.5, centerY: 230 });
  assert.deepEqual(getSymmetryGuideCoordinates(1200, 800), { centerX: 600, centerY: 400 });
  assert.deepEqual(getSymmetryGuideCoordinates(0, -50), { centerX: 0, centerY: 0 });
  assert.deepEqual(getSymmetryGuideCoordinates(Number.NaN, 100), { centerX: 0, centerY: 50 });
});

test('getSymmetryGuidesStatusMessage clearly states alignment-only behavior without mirroring', () => {
  assert.match(getSymmetryGuidesStatusMessage('vertical'), /vertical/i);
  assert.match(getSymmetryGuidesStatusMessage('vertical'), /no mirror/i);
  assert.match(getSymmetryGuidesStatusMessage('horizontal'), /horizontal/i);
  assert.match(getSymmetryGuidesStatusMessage('both'), /vertical & horizontal/i);
  assert.match(getSymmetryGuidesStatusMessage('none'), /hidden/i);
});
