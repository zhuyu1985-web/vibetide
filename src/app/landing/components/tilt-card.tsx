"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}

export function TiltCard({
  children,
  className,
  glowColor = "rgba(10, 132, 255, 0.2)",
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const springConfig = { stiffness: 150, damping: 20, mass: 0.5 };
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouchDevice || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const relativeX = (e.clientX - centerX) / (rect.width / 2);
    const relativeY = (e.clientY - centerY) / (rect.height / 2);

    rotateX.set(-relativeY * 15);
    rotateY.set(relativeX * 15);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    setIsHovered(false);
  };

  return (
    <div style={{ perspective: 800 }}>
      <motion.div
        ref={ref}
        className={cn("relative", className)}
        style={{
          rotateX: isTouchDevice ? 0 : springRotateX,
          rotateY: isTouchDevice ? 0 : springRotateY,
          transformStyle: "preserve-3d",
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
      >
        <motion.div
          className="pointer-events-none absolute -inset-1 rounded-[inherit] opacity-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${glowColor}, transparent 70%)`,
            filter: "blur(20px)",
            opacity: isHovered ? 0.8 : 0,
          }}
          aria-hidden="true"
        />
        <div className="relative z-10">{children}</div>
      </motion.div>
    </div>
  );
}
