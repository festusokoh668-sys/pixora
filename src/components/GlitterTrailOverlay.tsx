import React, { useEffect, useRef } from 'react';
import {
  GlitterParticle,
  drawGlitterParticle,
  shouldSpawnGlitterOnMove,
  spawnGlitterBurst,
  stepGlitterParticles,
} from '../utils/glitter';

export interface GlitterTrailOverlayProps {
  enabled: boolean;
  accentColor?: string;
  secondaryColor?: string;
}

export const GlitterTrailOverlay: React.FC<GlitterTrailOverlayProps> = ({
  enabled,
  accentColor,
  secondaryColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<GlitterParticle[]>([]);
  const lastSpawnPosRef = useRef<{ x: number; y: number } | null>(null);
  const totalSpawnedRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  const colorsRef = useRef({ accentColor, secondaryColor });
  colorsRef.current = { accentColor, secondaryColor };

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }
    };

    syncCanvasSize();

    const syncDataset = () => {
      canvas.dataset.glitterSpawned = String(totalSpawnedRef.current);
      canvas.dataset.glitterActive = String(particlesRef.current.length);
    };

    const renderLoop = (timestampMs: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafRef.current = null;
        return;
      }

      const prevTime = lastFrameTimeRef.current || timestampMs;
      const dtSec = Math.max(0.004, Math.min(0.05, (timestampMs - prevTime) / 1000));
      lastFrameTimeRef.current = timestampMs;

      particlesRef.current = stepGlitterParticles(particlesRef.current, dtSec, 150);

      syncCanvasSize();
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const timeSec = timestampMs / 1000;
      const active = particlesRef.current;
      for (let i = 0; i < active.length; i++) {
        drawGlitterParticle(ctx, active[i], timeSec);
      }

      syncDataset();

      if (particlesRef.current.length > 0) {
        rafRef.current = window.requestAnimationFrame(renderLoop);
      } else {
        rafRef.current = null;
        lastFrameTimeRef.current = 0;
      }
    };

    const ensureLoopRunning = () => {
      if (rafRef.current === null && particlesRef.current.length > 0) {
        lastFrameTimeRef.current = performance.now();
        rafRef.current = window.requestAnimationFrame(renderLoop);
      }
    };

    const handleMove = (clientX: number, clientY: number) => {
      if (!enabledRef.current) return;
      const nextPos = { x: clientX, y: clientY };
      if (!shouldSpawnGlitterOnMove(lastSpawnPosRef.current, nextPos, 5)) {
        return;
      }

      const dx = lastSpawnPosRef.current ? nextPos.x - lastSpawnPosRef.current.x : 0;
      const dy = lastSpawnPosRef.current ? nextPos.y - lastSpawnPosRef.current.y : 0;
      lastSpawnPosRef.current = nextPos;

      const burst = spawnGlitterBurst(nextPos.x, nextPos.y, dx, dy, {
        accentColor: colorsRef.current.accentColor,
        secondaryColor: colorsRef.current.secondaryColor,
      });

      particlesRef.current = [...particlesRef.current, ...burst].slice(-150);
      totalSpawnedRef.current += burst.length;
      syncDataset();

      // Immediately draw frame on burst so visual response has zero frame delay
      const ctx = canvas.getContext('2d');
      if (ctx) {
        syncCanvasSize();
        const nowSec = performance.now() / 1000;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        for (let i = 0; i < particlesRef.current.length; i++) {
          drawGlitterParticle(ctx, particlesRef.current[i], nowSec);
        }
      }

      ensureLoopRunning();
    };

    const onPointerMove = (e: PointerEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const onPointerLeaveWindow = () => {
      lastSpawnPosRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeaveWindow);
    window.addEventListener('resize', syncCanvasSize);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeaveWindow);
      window.removeEventListener('resize', syncCanvasSize);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Clear particles immediately when disabled
  useEffect(() => {
    if (!enabled) {
      particlesRef.current = [];
      lastSpawnPosRef.current = null;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.dataset.glitterActive = '0';
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [enabled]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="glitter-trail-canvas"
      data-glitter-enabled={enabled ? 'true' : 'false'}
      data-glitter-spawned="0"
      data-glitter-active="0"
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-50"
    />
  );
};
