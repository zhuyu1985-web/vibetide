"use client";

import { cn } from "@/lib/utils";

interface FloatingOrbsProps {
  className?: string;
}

const orbs = [
  { color: "#0A84FF", size: 320, top: "10%", left: "15%", duration: 18, delay: 0 },
  { color: "#38bdf8", size: 380, top: "55%", left: "65%", duration: 22, delay: 2 },
  { color: "#22d3ee", size: 300, top: "70%", left: "20%", duration: 15, delay: 4 },
  { color: "#2dd4bf", size: 350, top: "20%", left: "75%", duration: 25, delay: 1 },
];

export function FloatingOrbs({ className }: FloatingOrbsProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      <style>{`
        @keyframes orb-drift-0 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(60px, -40px) scale(1.05); }
          50% { transform: translate(-30px, 50px) scale(0.95); }
          75% { transform: translate(40px, 30px) scale(1.02); }
        }
        @keyframes orb-drift-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-50px, 30px) scale(0.97); }
          50% { transform: translate(40px, -60px) scale(1.04); }
          75% { transform: translate(-20px, -30px) scale(1.01); }
        }
        @keyframes orb-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, 50px) scale(1.03); }
          50% { transform: translate(-50px, -20px) scale(0.96); }
          75% { transform: translate(20px, -40px) scale(1.05); }
        }
        @keyframes orb-drift-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-40px, -50px) scale(1.02); }
          50% { transform: translate(50px, 30px) scale(0.98); }
          75% { transform: translate(-30px, 60px) scale(1.04); }
        }
      `}</style>
      {orbs.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: orb.left,
            background: `radial-gradient(circle, ${orb.color}30 0%, ${orb.color}08 50%, transparent 70%)`,
            filter: "blur(80px)",
            willChange: "transform",
            animation: `orb-drift-${i} ${orb.duration}s ease-in-out ${orb.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
