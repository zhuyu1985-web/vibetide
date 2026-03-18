"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";

/* ── particle system ───────────────────────────────────────────── */

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

const PARTICLE_COUNT = 80;
const CONNECTION_DIST = 160;
const CURSOR_RADIUS = 250;

const PALETTE: [number, number, number][] = [
  [10, 132, 255], // brand blue
  [34, 211, 238], // cyan
  [139, 92, 246], // violet
];

function seedParticles(w: number, h: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    size: Math.random() * 3 + 1,
    baseOpacity: Math.random() * 0.5 + 0.3,
    opacity: 0,
    color: Math.floor(Math.random() * PALETTE.length),
  }));
}

/* ── component ─────────────────────────────────────────────────── */

export function HeroBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef(0);
  const [mounted, setMounted] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // cursor glow – spring-driven for smooth trailing
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const glowX = useSpring(rawX, { damping: 15, stiffness: 80, mass: 0.5 });
  const glowY = useSpring(rawY, { damping: 15, stiffness: 80, mass: 0.5 });

  /* ── canvas animation loop ───────────────────────────────── */
  useEffect(() => {
    setMounted(true);
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = container.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (particlesRef.current.length === 0) {
        particlesRef.current = seedParticles(width, height);
      }
    };
    resize();

    // initialise glow to centre
    const initRect = container.getBoundingClientRect();
    rawX.set(initRect.width / 2);
    rawY.set(initRect.height / 2);

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const { left, top } = container.getBoundingClientRect();
      let cx: number, cy: number;
      if ("touches" in e && e.touches.length > 0) {
        cx = e.touches[0].clientX - left;
        cy = e.touches[0].clientY - top;
      } else if ("clientX" in e) {
        cx = (e as MouseEvent).clientX - left;
        cy = (e as MouseEvent).clientY - top;
      } else return;
      mouseRef.current = { x: cx, y: cy };
      rawX.set(cx);
      rawY.set(cy);
    };

    const onTouchEnd = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    const isDark = () => document.documentElement.classList.contains("dark");

    const tick = () => {
      const { width: W, height: H } = container.getBoundingClientRect();
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

        // cursor repulsion + attraction
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < CURSOR_RADIUS && d > 0) {
          const f = (CURSOR_RADIUS - d) / CURSOR_RADIUS;
          // push away
          p.vx -= (dx / d) * f * 0.05;
          p.vy -= (dy / d) * f * 0.05;
          p.opacity = Math.min(1, p.baseOpacity + f * 0.8);
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
            const c = PALETTE[ps[i].color];
            ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
            ctx.lineWidth = dark ? 1 : 0.8;
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            ctx.stroke();
          }
        }
      }

      /* cursor-to-particle connections */
      for (const p of ps) {
        const d = Math.hypot(mouse.x - p.x, mouse.y - p.y);
        if (d < CURSOR_RADIUS) {
          const a = (1 - d / CURSOR_RADIUS) * (dark ? 0.5 : 0.35);
          ctx.strokeStyle = dark
            ? `rgba(139,92,246,${a})`
            : `rgba(10,132,255,${a})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      /* draw particles */
      for (const p of ps) {
        const c = PALETTE[p.color];
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

      /* cursor dot */
      if (mouse.x > 0 && mouse.y > 0) {
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
          dark ? "rgba(139,92,246,0.4)" : "rgba(10,132,255,0.3)"
        );
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 30, 0, Math.PI * 2);
        ctx.fill();
        // inner dot
        ctx.fillStyle = dark
          ? "rgba(139,92,246,0.8)"
          : "rgba(10,132,255,0.6)";
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
        ctx.fill();
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
  }, [prefersReducedMotion, rawX, rawY]);

  /* ── reduced-motion fallback ─────────────────────────────── */
  if (prefersReducedMotion) {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 dark:hidden"
          style={{
            background:
              "linear-gradient(180deg,#f0f7ff 0%,#e8f4fd 40%,#f8fafc 100%)",
          }}
        />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background:
              "linear-gradient(180deg,#0a1628 0%,#060d1b 50%,#080d19 100%)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* ═══ base gradient ═══ */}
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          background:
            "linear-gradient(180deg,#f0f7ff 0%,#e8f4fd 40%,#f8fafc 100%)",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background:
            "linear-gradient(180deg,#0a1628 0%,#060d1b 50%,#080d19 100%)",
        }}
      />

      {/* ═══ aurora mesh blobs (intensified) ═══ */}
      <motion.div
        className="absolute h-[800px] w-[800px] rounded-full opacity-50 dark:opacity-40"
        style={{
          background:
            "radial-gradient(circle,rgba(10,132,255,0.6) 0%,rgba(10,132,255,0.2) 40%,transparent 70%)",
          filter: "blur(80px)",
          left: "0%",
          top: "-5%",
        }}
        animate={{
          x: [0, 100, -40, 0],
          y: [0, 60, 120, 0],
          scale: [1, 1.3, 0.85, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute h-[700px] w-[700px] rounded-full opacity-40 dark:opacity-35"
        style={{
          background:
            "radial-gradient(circle,rgba(139,92,246,0.5) 0%,rgba(139,92,246,0.15) 40%,transparent 70%)",
          filter: "blur(80px)",
          right: "-5%",
          top: "5%",
        }}
        animate={{
          x: [0, -80, 50, 0],
          y: [0, 80, -40, 0],
          scale: [1.1, 0.8, 1.2, 1.1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute h-[600px] w-[600px] rounded-full opacity-35 dark:opacity-30"
        style={{
          background:
            "radial-gradient(circle,rgba(34,211,238,0.5) 0%,rgba(34,211,238,0.15) 40%,transparent 70%)",
          filter: "blur(70px)",
          left: "20%",
          bottom: "0%",
        }}
        animate={{
          x: [0, 70, -50, 0],
          y: [0, -60, 40, 0],
          scale: [0.9, 1.25, 0.95, 0.9],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute h-[500px] w-[500px] rounded-full opacity-30 dark:opacity-25"
        style={{
          background:
            "radial-gradient(circle,rgba(45,212,191,0.45) 0%,rgba(45,212,191,0.1) 40%,transparent 70%)",
          filter: "blur(60px)",
          right: "10%",
          bottom: "10%",
        }}
        animate={{
          x: [0, -50, 60, 0],
          y: [0, 50, -70, 0],
          scale: [1, 1.35, 0.75, 1],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* extra warm accent blob */}
      <motion.div
        className="absolute h-[400px] w-[400px] rounded-full opacity-20 dark:opacity-15"
        style={{
          background:
            "radial-gradient(circle,rgba(251,146,60,0.35) 0%,transparent 70%)",
          filter: "blur(70px)",
          left: "50%",
          top: "30%",
        }}
        animate={{
          x: [0, -60, 40, 0],
          y: [0, -40, 50, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ═══ grid overlay (stronger) ═══ */}
      <div
        className="absolute inset-0 opacity-[0.15] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(10,132,255,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(10,132,255,0.6) 1px,transparent 1px)",
          backgroundSize: "50px 50px",
          maskImage:
            "radial-gradient(ellipse 90% 70% at 50% 40%,black 20%,transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 70% at 50% 40%,black 20%,transparent 70%)",
        }}
      />

      {/* ═══ canvas particle network ═══ */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* ═══ cursor glow ═══ */}
      {mounted && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 180,
            height: 180,
            left: -90,
            top: -90,
            x: glowX,
            y: glowY,
            background:
              "radial-gradient(circle,rgba(10,132,255,0.22) 0%,rgba(139,92,246,0.08) 40%,transparent 70%)",
            filter: "blur(20px)",
          }}
        />
      )}

      {/* ═══ light beams (dark mode, thicker) ═══ */}
      <div className="absolute inset-0 hidden dark:block">
        <motion.div
          className="absolute left-1/2 top-0 h-[120%] w-[3px] origin-top -translate-x-1/2"
          style={{
            background:
              "linear-gradient(180deg,rgba(10,132,255,0.4) 0%,rgba(10,132,255,0.1) 30%,transparent 60%)",
            boxShadow: "0 0 20px 4px rgba(10,132,255,0.15)",
          }}
          animate={{ rotate: [-25, 25, -25] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/2 top-0 h-[120%] w-[2px] origin-top -translate-x-1/2"
          style={{
            background:
              "linear-gradient(180deg,rgba(139,92,246,0.35) 0%,rgba(139,92,246,0.08) 25%,transparent 50%)",
            boxShadow: "0 0 15px 3px rgba(139,92,246,0.12)",
          }}
          animate={{ rotate: [18, -30, 18] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/2 top-0 h-[120%] w-[2px] origin-top -translate-x-1/2"
          style={{
            background:
              "linear-gradient(180deg,rgba(34,211,238,0.3) 0%,rgba(34,211,238,0.06) 20%,transparent 45%)",
            boxShadow: "0 0 15px 3px rgba(34,211,238,0.1)",
          }}
          animate={{ rotate: [-12, 35, -12] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-[40%] top-0 h-[120%] w-[2px] origin-top"
          style={{
            background:
              "linear-gradient(180deg,rgba(10,132,255,0.25) 0%,transparent 40%)",
            boxShadow: "0 0 12px 2px rgba(10,132,255,0.1)",
          }}
          animate={{ rotate: [-8, 20, -8] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-[60%] top-0 h-[120%] w-[2px] origin-top"
          style={{
            background:
              "linear-gradient(180deg,rgba(139,92,246,0.2) 0%,transparent 35%)",
            boxShadow: "0 0 12px 2px rgba(139,92,246,0.08)",
          }}
          animate={{ rotate: [10, -18, 10] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* ═══ floating sparkles (CSS-animated) ═══ */}
      <div className="absolute inset-0">
        {[
          { left: "10%", top: "20%", delay: "0s", dur: "3s" },
          { left: "25%", top: "60%", delay: "1s", dur: "4s" },
          { left: "45%", top: "15%", delay: "0.5s", dur: "3.5s" },
          { left: "65%", top: "45%", delay: "1.5s", dur: "3s" },
          { left: "80%", top: "25%", delay: "0.8s", dur: "4s" },
          { left: "35%", top: "75%", delay: "2s", dur: "3.5s" },
          { left: "75%", top: "70%", delay: "0.3s", dur: "4.5s" },
          { left: "55%", top: "35%", delay: "1.2s", dur: "3s" },
          { left: "15%", top: "45%", delay: "2.5s", dur: "3.5s" },
          { left: "90%", top: "55%", delay: "0.7s", dur: "4s" },
        ].map((s, i) => (
          <div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-[#0A84FF]/60 dark:bg-[#0A84FF]/80"
            style={{
              left: s.left,
              top: s.top,
              animation: `sparkle ${s.dur} ${s.delay} ease-in-out infinite`,
              boxShadow:
                "0 0 6px 2px rgba(10,132,255,0.4), 0 0 12px 4px rgba(10,132,255,0.15)",
            }}
          />
        ))}
      </div>

      {/* sparkle keyframes */}
      <style jsx>{`
        @keyframes sparkle {
          0%,
          100% {
            opacity: 0;
            transform: scale(0.5) translateY(0px);
          }
          50% {
            opacity: 1;
            transform: scale(1.5) translateY(-10px);
          }
        }
      `}</style>
    </div>
  );
}
