"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { COGNITIVE_LOOP_STEPS } from "@/app/showcase/data/showcase-content";

function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.2) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return inView;
}

// Positions for 6 nodes around a circle (clockwise from top center)
const positions: { top?: string; bottom?: string; left?: string; right?: string; transform?: string }[] = [
  { top: "2%", left: "50%", transform: "translateX(-50%)" },        // 0 - top center
  { top: "20%", right: "3%" },                                       // 1 - top right
  { top: "62%", right: "3%" },                                       // 2 - bottom right
  { bottom: "2%", left: "50%", transform: "translateX(-50%)" },     // 3 - bottom center
  { top: "62%", left: "3%" },                                        // 4 - bottom left
  { top: "20%", left: "3%" },                                        // 5 - top left
];

// Arrow positions between adjacent nodes (placed on the circle path)
const arrowPositions: { top: string; left: string; rotate: string }[] = [
  { top: "9%", left: "76%", rotate: "55deg" },    // 0→1
  { top: "42%", left: "92%", rotate: "95deg" },    // 1→2
  { top: "78%", left: "76%", rotate: "135deg" },   // 2→3
  { top: "78%", left: "22%", rotate: "225deg" },   // 3→4
  { top: "42%", left: "4%", rotate: "265deg" },    // 4→5
  { top: "9%", left: "22%", rotate: "305deg" },    // 5→0
];

function StepCard({
  step,
  active,
  allDone,
}: {
  step: (typeof COGNITIVE_LOOP_STEPS)[number];
  active: boolean;
  allDone: boolean;
}) {
  return (
    <div
      className="w-[130px] rounded-xl p-3 border transition-all duration-500 bg-card"
      style={{
        borderTopWidth: 4,
        borderTopColor: step.color,
        borderLeftColor: "hsl(var(--border))",
        borderRightColor: "hsl(var(--border))",
        borderBottomColor: "hsl(var(--border))",
        opacity: active || allDone ? 1 : 0.35,
        transform: active && !allDone ? "scale(1.08)" : "scale(1)",
        boxShadow: active && !allDone ? `0 0 24px ${step.color}33` : "none",
      }}
    >
      <p className="font-bold text-sm" style={{ color: step.color }}>
        {step.num}
      </p>
      <p className="font-semibold text-sm mt-0.5">{step.title}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
        {step.description}
      </p>
    </div>
  );
}

function VerticalStepCard({
  step,
  active,
  allDone,
}: {
  step: (typeof COGNITIVE_LOOP_STEPS)[number];
  active: boolean;
  allDone: boolean;
}) {
  return (
    <GlassCard
      variant="secondary"
      padding="sm"
      className="transition-all duration-500"
    >
      <div
        className="pl-3"
        style={{
          borderLeft: `4px solid ${step.color}`,
          opacity: active || allDone ? 1 : 0.35,
          boxShadow: active && !allDone ? `0 0 18px ${step.color}33` : "none",
          borderRadius: 4,
        }}
      >
        <p className="font-bold text-sm" style={{ color: step.color }}>
          {step.num} {step.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {step.description}
        </p>
      </div>
    </GlassCard>
  );
}

function VLine() {
  return <div className="w-0.5 h-4 mx-auto bg-border" />;
}

export function CognitiveLoop() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    if (!inView) return;
    let step = 0;
    const interval = setInterval(() => {
      if (step >= COGNITIVE_LOOP_STEPS.length) {
        setAllDone(true);
        clearInterval(interval);
        return;
      }
      setActiveIndex(step);
      step++;
    }, 500);
    return () => clearInterval(interval);
  }, [inView]);

  return (
    <div ref={containerRef}>
      {/* Desktop: circular layout */}
      <div className="hidden md:block">
        <div className="relative w-full aspect-square max-w-[520px] mx-auto">
          {/* Dashed rotating ring */}
          <div
            className="absolute rounded-full border-2 border-dashed border-border/40 animate-spin"
            style={{
              top: "15%",
              left: "15%",
              width: "70%",
              height: "70%",
              animationDuration: "60s",
            }}
          />

          {/* Center label */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-10">
            <p className="font-bold text-lg">认知进化闭环</p>
            <p className="text-sm text-muted-foreground mt-1">越用越好</p>
          </div>

          {/* Arrow indicators between nodes */}
          {arrowPositions.map((pos, i) => (
            <div
              key={`arrow-${i}`}
              className="absolute text-muted-foreground/50 text-sm font-bold z-0"
              style={{
                top: pos.top,
                left: pos.left,
                transform: `rotate(${pos.rotate})`,
              }}
            >
              →
            </div>
          ))}

          {/* Step nodes */}
          {COGNITIVE_LOOP_STEPS.map((step, i) => (
            <div
              key={step.id}
              className="absolute z-10"
              style={positions[i]}
            >
              <StepCard
                step={step}
                active={activeIndex === i}
                allDone={allDone}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: vertical list */}
      <div className="block md:hidden space-y-0">
        <div className="text-center mb-4">
          <p className="font-bold text-base">认知进化闭环</p>
          <p className="text-sm text-muted-foreground">越用越好</p>
        </div>
        {COGNITIVE_LOOP_STEPS.map((step, i) => (
          <div key={step.id}>
            <VerticalStepCard
              step={step}
              active={activeIndex === i}
              allDone={allDone}
            />
            {i < COGNITIVE_LOOP_STEPS.length - 1 && <VLine />}
          </div>
        ))}
        {/* Loop-back */}
        <VLine />
        <div className="border-2 border-dashed border-border/50 rounded-lg p-2 text-center">
          <p className="text-xs text-muted-foreground">↩ 回到 ① 意图理解（认知已升级）</p>
        </div>
      </div>

    </div>
  );
}
