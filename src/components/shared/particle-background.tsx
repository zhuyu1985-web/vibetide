"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/* ── types ─────────────────────────────────────────────────────── */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseOpacity: number;
  opacity: number;
  color: number;
}

/* ── constants ──────────────────────────────────────────────────── */

const CONNECTION_DIST = 160;
const CURSOR_RADIUS = 250;

/* ── helpers ────────────────────────────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const int = parseInt(clean, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function seedParticles(
  w: number,
  h: number,
  count: number,
  paletteLength: number
): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    size: Math.random() * 3 + 1,
    baseOpacity: Math.random() * 0.5 + 0.3,
    opacity: 0,
    color: Math.floor(Math.random() * paletteLength),
  }));
}

/* ── props ──────────────────────────────────────────────────────── */

interface ParticleBackgroundProps {
  particleCount?: number;
  colors?: string[];
  cursorGlow?: boolean;
  className?: string;
}

/* ── component ──────────────────────────────────────────────────── */

export function ParticleBackground({
  particleCount = 80,
  colors = ["#6366f1", "#06b6d4", "#8b5cf6"],
  cursorGlow = true,
  className,
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Pre-compute RGB palette from hex color strings
    const palette: [number, number, number][] = colors.map(hexToRgb);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const parent = canvas.parentElement;
      const width = parent ? parent.clientWidth : window.innerWidth;
      const height = parent ? parent.clientHeight : window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (particlesRef.current.length === 0) {
        particlesRef.current = seedParticles(width, height, particleCount, palette.length);
      }
    };
    resize();

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      let cx: number, cy: number;
      if ("touches" in e && e.touches.length > 0) {
        cx = e.touches[0].clientX - rect.left;
        cy = e.touches[0].clientY - rect.top;
      } else if ("clientX" in e) {
        cx = (e as MouseEvent).clientX - rect.left;
        cy = (e as MouseEvent).clientY - rect.top;
      } else return;
      mouseRef.current = { x: cx, y: cy };
    };

    const onTouchEnd = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    const isDark = () => document.documentElement.classList.contains("dark");

    const tick = () => {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      ctx.clearRect(0, 0, W, H);

      const dark = isDark();
      const mouse = mouseRef.current;
      const ps = particlesRef.current;

      /* update particles */
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;

        // wrap around
        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20;
        if (p.y > H + 20) p.y = -20;

        if (cursorGlow) {
          // cursor repulsion + attraction
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < CURSOR_RADIUS && d > 0) {
            const f = (CURSOR_RADIUS - d) / CURSOR_RADIUS;
            p.vx -= (dx / d) * f * 0.05;
            p.vy -= (dy / d) * f * 0.05;
            p.opacity = Math.min(1, p.baseOpacity + f * 0.8);
          } else {
            p.opacity += (p.baseOpacity - p.opacity) * 0.03;
          }
        } else {
          p.opacity += (p.baseOpacity - p.opacity) * 0.03;
        }

        // damping + speed cap
        p.vx *= 0.993;
        p.vy *= 0.993;
        const spd = Math.hypot(p.vx, p.vy);
        if (spd > 1.5) {
          p.vx = (p.vx / spd) * 1.5;
          p.vy = (p.vy / spd) * 1.5;
        }
      }

      /* inter-particle connections */
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const d = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y);
          if (d < CONNECTION_DIST) {
            const a = (1 - d / CONNECTION_DIST) * (dark ? 0.35 : 0.2);
            const c = palette[ps[i].color];
            ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
            ctx.lineWidth = dark ? 1 : 0.8;
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            ctx.stroke();
          }
        }
      }

      if (cursorGlow) {
        /* cursor-to-particle connections */
        for (const p of ps) {
          const d = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (d < CURSOR_RADIUS) {
            const a = (1 - d / CURSOR_RADIUS) * (dark ? 0.5 : 0.35);
            const c = palette[ps[0].color]; // use first palette color for cursor lines
            ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      /* draw particles */
      for (const p of ps) {
        const c = palette[p.color];
        const a = dark ? p.opacity : p.opacity * 0.8;
        // glow ring
        if (p.opacity > 0.3) {
          ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(p.opacity - 0.3) * 0.25})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 5, 0, Math.PI * 2);
          ctx.fill();
        }
        // core dot
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (cursorGlow) {
        /* cursor dot */
        if (mouse.x > 0 && mouse.y > 0) {
          const c = palette[0];
          // outer glow
          const grad = ctx.createRadialGradient(
            mouse.x,
            mouse.y,
            0,
            mouse.x,
            mouse.y,
            30
          );
          grad.addColorStop(
            0,
            `rgba(${c[0]},${c[1]},${c[2]},${dark ? 0.4 : 0.3})`
          );
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 30, 0, Math.PI * 2);
          ctx.fill();
          // inner dot
          ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${dark ? 0.8 : 0.6})`;
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion, particleCount]);
  // Note: `colors` and `cursorGlow` are intentionally excluded from deps —
  // changing them at runtime would require re-seeding particles; if callers
  // need dynamic color/glow changes they should remount the component via key.

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
    />
  );
}
