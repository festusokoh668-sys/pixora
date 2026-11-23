import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldSpawnGlitterOnMove,
  spawnGlitterBurst,
  stepGlitterParticles,
  computeGlitterVisualState,
} from './glitter';

test('shouldSpawnGlitterOnMove gates tiny jitter and allows intentional movement', () => {
  assert.equal(shouldSpawnGlitterOnMove(null, { x: 100, y: 100 }, 5), true);
  assert.equal(shouldSpawnGlitterOnMove({ x: 100, y: 100 }, { x: 102, y: 102 }, 5), false);
  assert.equal(shouldSpawnGlitterOnMove({ x: 100, y: 100 }, { x: 106, y: 100 }, 5), true);
});

test('spawnGlitterBurst generates valid sparkling particles with optional accent color', () => {
  let seq = 0.15;
  const deterministicRand = () => {
    seq = (seq + 0.37) % 1;
    return seq;
  };

  const particles = spawnGlitterBurst(240, 180, 14, -6, {
    count: 4,
    accentColor: '#FF4081',
    randomFn: deterministicRand,
  });

  assert.equal(particles.length, 4);
  for (const p of particles) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(p.size > 0);
    assert.ok(p.life > 0 && p.life === p.maxLife);
    assert.ok(['sparkle', 'diamond', 'dot'].includes(p.shape));
  }
});

test('stepGlitterParticles advances physics, enforces max cap, and prunes expired particles', () => {
  const initial = spawnGlitterBurst(100, 100, 5, 0, {
    count: 5,
    randomFn: () => 0.4,
  });
  const startY = initial[0].y;

  const afterOneFrame = stepGlitterParticles(initial, 0.016, 10);
  assert.equal(afterOneFrame.length, 5);
  assert.notEqual(afterOneFrame[0].y, startY);
  assert.ok(afterOneFrame[0].life < initial[0].life);

  const capped = stepGlitterParticles([...initial, ...initial], 0.016, 4);
  assert.equal(capped.length, 4);

  // Expire particles completely across many steps
  let state = afterOneFrame;
  for (let i = 0; i < 40; i++) {
    state = stepGlitterParticles(state, 0.05);
  }
  assert.equal(state.length, 0);
});

test('computeGlitterVisualState returns bounded opacity and positive scale', () => {
  const [p] = spawnGlitterBurst(50, 50, 0, 0, { count: 1, randomFn: () => 0.5 });
  const vis = computeGlitterVisualState(p, 1.25);
  assert.ok(vis.opacity >= 0 && vis.opacity <= 1);
  assert.ok(vis.scale > 0);
});
