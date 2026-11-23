export type GlitterShape = 'sparkle' | 'diamond' | 'dot';

export interface GlitterParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vr: number;
  life: number;
  maxLife: number;
  color: string;
  outlineColor: string;
  shape: GlitterShape;
  twinklePhase: number;
  twinkleSpeed: number;
}

export interface SpawnGlitterOptions {
  count?: number;
  accentColor?: string;
  secondaryColor?: string;
  randomFn?: () => number;
}

export const DEFAULT_GLITTER_SWATCHES: ReadonlyArray<{ fill: string; outline: string }> = [
  { fill: '#FFD166', outline: '#D97706' }, // Warm gold
  { fill: '#FF7EB6', outline: '#DB2777' }, // Rose pink
  { fill: '#38BDF8', outline: '#0284C7' }, // Sky aqua
  { fill: '#A78BFA', outline: '#6D28D9' }, // Iridescent violet
  { fill: '#34D399', outline: '#059669' }, // Mint prism
  { fill: '#FDE047', outline: '#CA8A04' }, // Bright starlight
];

let nextParticleId = 1;

function isVisuallyNeutralLightColor(hex?: string): boolean {
  if (!hex || typeof hex !== 'string') return true;
  const normalized = hex.trim().toUpperCase();
  return (
    normalized === '#FFFFFF' ||
    normalized === '#FFF' ||
    normalized === '#F8FAFC' ||
    normalized === '#000000'
  );
}

/**
 * Returns true when pointer movement has traveled at least `minDistancePx`
 * since the last emitted glitter burst, preventing stationary jitter bursts.
 */
export function shouldSpawnGlitterOnMove(
  prevPos: { x: number; y: number } | null,
  nextPos: { x: number; y: number },
  minDistancePx: number = 5
): boolean {
  if (!prevPos) return true;
  const dx = nextPos.x - prevPos.x;
  const dy = nextPos.y - prevPos.y;
  return dx * dx + dy * dy >= minDistancePx * minDistancePx;
}

/**
 * Creates a small burst of sparkling glitter particles along the pointer trail.
 */
export function spawnGlitterBurst(
  x: number,
  y: number,
  dx: number = 0,
  dy: number = 0,
  options: SpawnGlitterOptions = {}
): GlitterParticle[] {
  const rand = options.randomFn ?? Math.random;
  const speed = Math.hypot(dx, dy);
  const defaultCount = speed > 18 ? 4 : speed > 7 ? 3 : 2;
  const count = Math.max(1, Math.min(6, Math.round(options.count ?? defaultCount)));

  const palette: Array<{ fill: string; outline: string }> = [...DEFAULT_GLITTER_SWATCHES];
  if (!isVisuallyNeutralLightColor(options.accentColor)) {
    palette.push({
      fill: options.accentColor!,
      outline: '#1E293B',
    });
  }
  if (
    !isVisuallyNeutralLightColor(options.secondaryColor) &&
    options.secondaryColor !== options.accentColor
  ) {
    palette.push({
      fill: options.secondaryColor!,
      outline: '#334155',
    });
  }

  const shapes: GlitterShape[] = ['sparkle', 'sparkle', 'diamond', 'dot'];
  const particles: GlitterParticle[] = [];

  for (let i = 0; i < count; i++) {
    const swatch = palette[Math.floor(rand() * palette.length) % palette.length];
    const shape = shapes[Math.floor(rand() * shapes.length) % shapes.length];
    const angle = rand() * Math.PI * 2;
    const burstSpeed = 14 + rand() * 38;
    // Slight trailing bias behind cursor movement plus playful lateral scatter
    const vx = Math.cos(angle) * burstSpeed - Math.max(-20, Math.min(20, dx * 0.35));
    const vy = Math.sin(angle) * burstSpeed - Math.max(-20, Math.min(20, dy * 0.25)) - 12;
    const maxLife = 0.65 + rand() * 0.65;
    const size = shape === 'sparkle' ? 4.5 + rand() * 5 : shape === 'diamond' ? 3.2 + rand() * 3.5 : 2 + rand() * 2.4;

    particles.push({
      id: nextParticleId++,
      x: x + (rand() - 0.5) * 10,
      y: y + (rand() - 0.5) * 10,
      vx,
      vy,
      size,
      rotation: rand() * Math.PI * 2,
      vr: (rand() - 0.5) * 6,
      life: maxLife,
      maxLife,
      color: swatch.fill,
      outlineColor: swatch.outline,
      shape,
      twinklePhase: rand() * Math.PI * 2,
      twinkleSpeed: 12 + rand() * 14,
    });
  }

  return particles;
}

/**
 * Advances all active glitter particles by `dtSec` with gentle gravity,
 * air drag, and cap trimming, removing expired particles.
 */
export function stepGlitterParticles(
  particles: GlitterParticle[],
  dtSec: number,
  maxParticles: number = 140
): GlitterParticle[] {
  if (particles.length === 0) return [];
  const clampedDt = Math.max(0.001, Math.min(0.05, dtSec));
  const drag = Math.pow(0.18, clampedDt); // smooth exponential air drag
  const gravity = 46; // gentle downward glitter fall in px/s^2

  const next: GlitterParticle[] = [];
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const remainingLife = p.life - clampedDt;
    if (remainingLife <= 0) continue;

    const vx = p.vx * drag;
    const vy = p.vy * drag + gravity * clampedDt;

    next.push({
      ...p,
      x: p.x + vx * clampedDt,
      y: p.y + vy * clampedDt,
      vx,
      vy,
      rotation: p.rotation + p.vr * clampedDt,
      life: remainingLife,
    });
  }

  if (next.length > maxParticles) {
    return next.slice(next.length - maxParticles);
  }
  return next;
}

/**
 * Computes shimmering opacity and pulse scale for a glitter particle.
 */
export function computeGlitterVisualState(
  particle: GlitterParticle,
  timeSec: number
): { opacity: number; scale: number } {
  const lifeRatio = Math.max(0, Math.min(1, particle.life / Math.max(0.001, particle.maxLife)));
  const fadeCurve = lifeRatio < 0.7 ? lifeRatio / 0.7 : 1;
  const twinkle = 0.55 + 0.45 * Math.sin(timeSec * particle.twinkleSpeed + particle.twinklePhase);
  const scale = (0.55 + 0.45 * lifeRatio) * (0.82 + 0.35 * twinkle);
  return {
    opacity: Math.max(0, Math.min(1, fadeCurve * twinkle)),
    scale,
  };
}

/**
 * Draws a single shimmering glitter particle onto a 2D canvas context.
 */
export function drawGlitterParticle(
  ctx: CanvasRenderingContext2D,
  particle: GlitterParticle,
  timeSec: number
): void {
  const { opacity, scale } = computeGlitterVisualState(particle, timeSec);
  if (opacity <= 0.01) return;

  const r = particle.size * scale;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation);

  if (particle.shape === 'sparkle') {
    const inner = r * 0.28;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(0, -inner * 0.5, inner, -inner);
    ctx.quadraticCurveTo(inner * 0.5, 0, r, 0);
    ctx.quadraticCurveTo(inner * 0.5, 0, inner, inner);
    ctx.quadraticCurveTo(0, inner * 0.5, 0, r);
    ctx.quadraticCurveTo(0, inner * 0.5, -inner, inner);
    ctx.quadraticCurveTo(-inner * 0.5, 0, -r, 0);
    ctx.quadraticCurveTo(-inner * 0.5, 0, -inner, -inner);
    ctx.quadraticCurveTo(0, -inner * 0.5, 0, -r);
    ctx.closePath();

    ctx.fillStyle = particle.color;
    ctx.fill();
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = particle.outlineColor;
    ctx.stroke();

    // Hot white center glint
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.8, r * 0.2), 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  } else if (particle.shape === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.65, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.65, 0);
    ctx.closePath();

    ctx.fillStyle = particle.color;
    ctx.fill();
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = particle.outlineColor;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = particle.color;
    ctx.fill();
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = particle.outlineColor;
    ctx.stroke();
  }

  ctx.restore();
}
