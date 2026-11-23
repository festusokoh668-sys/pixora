import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_RECENT_BRUSHES,
  RecentBrushSetting,
  getBrushOptionLabel,
  recordRecentBrushSetting,
} from './recentBrushes';

test('getBrushOptionLabel resolves all supported brush options and ignores non-brush tools', () => {
  assert.equal(getBrushOptionLabel('brush'), 'Brush');
  assert.equal(getBrushOptionLabel('oil'), 'Oil brush');
  assert.equal(getBrushOptionLabel('watercolor'), 'Watercolor brush');
  assert.equal(getBrushOptionLabel('calligraphy'), 'Calligraphy brush 1');
  assert.equal(getBrushOptionLabel('blur'), 'Blur');
  assert.equal(getBrushOptionLabel('eraser'), null);
  assert.equal(getBrushOptionLabel('shape'), null);
});

test('recordRecentBrushSetting maintains most-recent-first order capped at 5 items', () => {
  let list: RecentBrushSetting[] = [];

  list = recordRecentBrushSetting(list, 'brush', 5, '#000000');
  list = recordRecentBrushSetting(list, 'oil', 8, '#ed1c24');
  list = recordRecentBrushSetting(list, 'watercolor', 12, '#00a2e8');
  list = recordRecentBrushSetting(list, 'crayon', 3, '#ff7f27');
  list = recordRecentBrushSetting(list, 'airbrush', 16, '#22b14c');
  list = recordRecentBrushSetting(list, 'calligraphy', 4, '#3f48cc');

  assert.equal(list.length, MAX_RECENT_BRUSHES);
  assert.equal(list[0].tool, 'calligraphy');
  assert.equal(list[0].size, 4);
  assert.equal(list[0].color, '#3F48CC');
  // Oldest item (brush 5px #000000) should have been evicted
  assert.equal(list.some((item) => item.tool === 'brush'), false);
});

test('recordRecentBrushSetting deduplicates matching tool+size+color and promotes it to top', () => {
  let list: RecentBrushSetting[] = [];
  list = recordRecentBrushSetting(list, 'brush', 5, '#000000');
  list = recordRecentBrushSetting(list, 'oil', 8, '#ED1C24');
  list = recordRecentBrushSetting(list, 'watercolor', 12, '#00A2E8');

  // Re-selecting brush 5px #000000 (case-insensitive hex) promotes it without duplicating
  list = recordRecentBrushSetting(list, 'brush', 5, '#000000');
  assert.equal(list.length, 3);
  assert.equal(list[0].tool, 'brush');
  assert.equal(list[1].tool, 'watercolor');
  assert.equal(list[2].tool, 'oil');

  // Changing only size creates a separate recent brush setting entry
  list = recordRecentBrushSetting(list, 'brush', 10, '#000000');
  assert.equal(list.length, 4);
  assert.equal(list[0].size, 10);
});
