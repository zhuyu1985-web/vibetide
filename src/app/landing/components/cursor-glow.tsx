"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  createdAt: number;
  vx: number;
  vy: number;
}

const COLORS = ["#0A84FF", "#38bdf8", "#22d3ee", "#2dd4bf"];

export function CursorGlow() {
  const [isTouchDevice, setIsTouchDevice] = useState(true);
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);
  const lastParticleTimeRef = useRef(0);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const cursorX = useMotionValue(-500);
  const cursorY = useMotionValue(-500);
  const velocityX = useMotionValue(0);
  const velocityY = useMotionValue(0);

  const outerX = useSpring(cursorX, { damping: 30, stiffness: 100, mass: 1 });
  const outerY = useSpring(cursorY, { damping: 30, stiffness: 100, mass: 1 });
  const innerX = useSpring(cursorX, { damping: 20, stiffness: 200, mass: 0.3 });
  const innerY = useSpring(cursorY, { damping: 20, stiffness: 200, mass: 0.3 });
  const ringX = useSpring(cursorX, { damping: 25, stiffness: 250, mass: 0.2 });
  const ringY = useSpring(cursorY, { damping: 25, stiffness: 250, mass: 0.2 });
  const coreX = useSpring(cursorX, { damping: 15, stiffness: 300, mass: 0.1 });
  const coreY = useSpring(cursorY, { damping: 15, stiffness: 300, mass: 0.1 });

  const speed = useTransform(
    [velocityX, velocityY],
    ([vx, vy]: number[]) => Math.sqrt(vx * vx + vy * vy)
  );
  const ringScale = useSpring(
    useTransform(speed, [0, 800], [1, 1.6]),
    { damping: 20, stiffness: 200 }
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      velocityX.set(dx * 16);
      velocityY.set(dy * 16);

      const now = Date.now();
      if (now - lastParticleTimeRef.current > 50) {
        lastParticleTimeRef.current = now;
        const id = particleIdRef.current++;
        const color = COLORS[id % COLORS.length];
        const size = 2 + Math.random() * 3;
        setParticles((prev) => {
          const cleaned = prev.filter((p) => now - p.createdAt < 600);
          return [...cleaned, {
            id, x: e.clientX, y: e.clientY, size, color, createdAt: now,
            vx: dx * 0.5 + (Math.random() - 0.5) * 20,
            vy: dy * 0.5 + (Math.random() - 0.5) * 20,
          }];
        });
      }
    },
    [cursorX, cursorY, velocityX, velocityY]
  );

  useEffect(() => {
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    setIsTouchDevice(isCoarse);
    if (isCoarse) return;
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  useEffect(() => {
    if (particles.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setParticles((prev) => prev.filter((p) => now - p.createdAt < 600));
    }, 650);
    return () => clearTimeout(timer);
  }, [particles]);

  if (isTouchDevice) return null;

  return (
    <>
      <motion.div
        className="pointer-events-none fixed z-40 rounded-full"
        style={{
          top: 0, left: 0, x: outerX, y: outerY,
          width: 400, height: 400, marginLeft: -200, marginTop: -200,
          background: "radial-gradient(circle, rgba(10,132,255,0.10) 0%, rgba(56,189,248,0.04) 40%, transparent 70%)",
          filter: "blur(50px)", willChange: "transform",
        }}
        aria-hidden="true"
      />
      <motion.div
        className="pointer-events-none fixed z-40 rounded-full"
        style={{
          top: 0, left: 0, x: innerX, y: innerY,
          width: 180, height: 180, marginLeft: -90, marginTop: -90,
          background: "radial-gradient(circle, rgba(56,189,248,0.14) 0%, rgba(10,132,255,0.06) 50%, transparent 70%)",
          filter: "blur(25px)", willChange: "transform",
        }}
        aria-hidden="true"
      />
      <motion.div
        className="pointer-events-none fixed z-40 rounded-full"
        style={{
          top: 0, left: 0, x: ringX, y: ringY, scale: ringScale,
          width: 36, height: 36, marginLeft: -18, marginTop: -18,
          border: "1.5px solid rgba(56,189,248,0.45)",
          boxShadow: "0 0 15px rgba(10,132,255,0.2), inset 0 0 8px rgba(56,189,248,0.08)",
          willChange: "transform", backfaceVisibility: "hidden",
        }}
        aria-hidden="true"
      />
      <motion.div
        className="pointer-events-none fixed z-40 rounded-full"
        style={{
          top: 0, left: 0, x: coreX, y: coreY,
          width: 6, height: 6, marginLeft: -3, marginTop: -3,
          background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(10,132,255,0.6) 60%, transparent 100%)",
          boxShadow: "0 0 10px rgba(10,132,255,0.4), 0 0 20px rgba(56,189,248,0.25)",
          willChange: "transform",
        }}
        aria-hidden="true"
      />
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="pointer-events-none fixed z-40 rounded-full"
          style={{
            top: 0, left: 0,
            width: p.size, height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
          initial={{ x: p.x - p.size / 2, y: p.y - p.size / 2, opacity: 0.7, scale: 1 }}
          animate={{ opacity: 0, scale: 0, x: p.x - p.size / 2 + p.vx, y: p.y - p.size / 2 + p.vy - 15 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
