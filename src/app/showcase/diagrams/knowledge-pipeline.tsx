"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { FileText, Scissors, Cpu, Link, Search, type LucideIcon } from "lucide-react";
import { KNOWLEDGE_PIPELINE } from "@/app/showcase/data/showcase-content";

const ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  Scissors,
  Cpu,
  Link,
  Search,
};

function StepNode({ step, index, active }: { step: typeof KNOWLEDGE_PIPELINE[number]; index: number; active: boolean }) {
  const Icon = ICON_MAP[step.icon] ?? FileText;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="flex flex-col items-center gap-2 md:gap-3"
    >
      {/* Circle node */}
      <div
        className={`
          relative w-16 h-16 rounded-full flex items-center justify-center
          transition-all duration-500 ease-out
          ${active
            ? "ring-2 ring-primary shadow-[0_0_20px_rgba(var(--primary-rgb,99,102,241),0.35)]"
            : "ring-1 ring-border"
          }
        `}
      >
        <div
          className={`
            absolute inset-0 rounded-full transition-opacity duration-500
            ${active ? "opacity-100" : "opacity-0"}
          `}
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.12), transparent 70%)" }}
        />
        <Icon
          className={`
            w-6 h-6 relative z-10 transition-colors duration-500
            ${active ? "text-primary" : "text-muted-foreground"}
          `}
        />
      </div>

      {/* Label */}
      <div className="text-center">
        <p
          className={`
            text-sm font-semibold transition-colors duration-500
            ${active ? "text-foreground" : "text-muted-foreground"}
          `}
        >
          {step.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
      </div>
    </motion.div>
  );
}

function Connector({ active, direction }: { active: boolean; direction: "horizontal" | "vertical" }) {
  const isH = direction === "horizontal";

  return (
    <div
      className={`
        ${isH ? "h-0.5 w-12 mx-1" : "w-0.5 h-8 my-1"}
        rounded-full transition-all duration-500 ease-out
        ${active
          ? "bg-gradient-to-r from-primary/60 to-primary"
          : "bg-border"
        }
      `}
      style={
        !isH && active
          ? { backgroundImage: "linear-gradient(to bottom, hsl(var(--primary) / 0.6), hsl(var(--primary)))" }
          : undefined
      }
    />
  );
}

export function KnowledgePipeline() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.3 });
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    if (!inView) {
      setActiveStep(-1);
      return;
    }

    setActiveStep(-1);
    const timer = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= KNOWLEDGE_PIPELINE.length - 1) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 500);

    return () => clearInterval(timer);
  }, [inView]);

  return (
    <div ref={ref}>
      {/* Desktop: horizontal */}
      <div className="hidden md:flex flex-row items-center justify-center">
        {KNOWLEDGE_PIPELINE.map((step, i) => (
          <div key={step.title} className="flex items-center">
            <StepNode step={step} index={i} active={i <= activeStep} />
            {i < KNOWLEDGE_PIPELINE.length - 1 && (
              <Connector active={i + 1 <= activeStep} direction="horizontal" />
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical */}
      <div className="flex md:hidden flex-col items-center">
        {KNOWLEDGE_PIPELINE.map((step, i) => (
          <div key={step.title} className="flex flex-col items-center">
            <StepNode step={step} index={i} active={i <= activeStep} />
            {i < KNOWLEDGE_PIPELINE.length - 1 && (
              <Connector active={i + 1 <= activeStep} direction="vertical" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
