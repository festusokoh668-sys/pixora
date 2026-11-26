import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getThemeToggleIcon,
  resolveThemePreference,
  toggleThemeMode,
} from './theme';

test('resolveThemePreference defaults safely to light unless stored value is dark', () => {
  assert.equal(resolveThemePreference(null), 'light');
  assert.equal(resolveThemePreference(undefined), 'light');
  assert.equal(resolveThemePreference(''), 'light');
  assert.equal(resolveThemePreference('light'), 'light');
  assert.equal(resolveThemePreference('dark'), 'dark');
});

test('toggleThemeMode switches between light and dark cleanly', () => {
  assert.equal(toggleThemeMode('light'), 'dark');
  assert.equal(toggleThemeMode('dark'), 'light');
});

test('getThemeToggleIcon shows moon when in light mode and sun when in dark mode', () => {
  assert.equal(getThemeToggleIcon('light'), 'moon');
  assert.equal(getThemeToggleIcon('dark'), 'sun');
});
