"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, useInView } from "framer-motion";
import { Check } from "lucide-react";
import { type EmployeeId, EMPLOYEE_META } from "@/lib/constants";
import { PipelineNode } from "../components/pipeline-node";

interface PipelineStep {
  employeeId: EmployeeId;
  label: string;
  description: string;
  duration: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  { employeeId: "xiaolei", label: "热点捕获", description: "全网扫描，锁定热点", duration: "~5秒" },
  { employeeId: "xiaoce", label: "选题策划", description: "分析角度，输出方案", duration: "~10秒" },
  { employeeId: "xiaowen", label: "内容创作", description: "多风格撰写，千字成文", duration: "~30秒" },
  { employeeId: "xiaojian", label: "视频制作", description: "图文转视频，批量产出", duration: "~60秒" },
  { employeeId: "xiaoshen", label: "质量审核", description: "合规检查，质量评分", duration: "~15秒" },
  { employeeId: "xiaofa", label: "渠道分发", description: "多平台一键发布", duration: "~10秒" },
];

const CONFETTI_PARTICLES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * 360;
  const rad = (angle * Math.PI) / 180;
  const distance = 40 + Math.random() * 50;
  return {
    id: i,
    tx: Math.cos(rad) * distance,
    ty: Math.sin(rad) * distance,
    color: ["#0A84FF", "#0ea5e9", "#22d3ee", "#2dd4bf", "#06b6d4", "#0284c7"][
      i % 6
    ],
    delay: Math.random() * 0.3,
  };
});

function ConnectingLine({
  isActive,
  isVertical,
  fromEmployeeId,
  toEmployeeId,
}: {
  isActive: boolean;
  isVertical: boolean;
  fromEmployeeId: EmployeeId;
  toEmployeeId: EmployeeId;
}) {
  const fromColor = EMPLOYEE_META[fromEmployeeId].color;
  const toColor = EMPLOYEE_META[toEmployeeId].color;

  const gradientDir = isVertical ? "to bottom" : "to right";
  const activeGradient = `linear-gradient(${gradientDir}, ${fromColor}, ${toColor})`;

  return (
    <div
      className={`relative shrink-0 ${
        isVertical ? "w-0.5 h-8" : "h-0.5 w-12 md:w-16"
      }`}
    >
      {/* Base gray line */}
      <div
        className={`absolute inset-0 rounded-full transition-colors duration-300 ${
          isActive ? "bg-transparent" : "bg-border dark:bg-white/20"
        }`}
      />

      {/* Active gradient line */}
      <div
        className="absolute inset-0 rounded-full transition-opacity duration-500"
        style={{
          background: activeGradient,
          opacity: isActive ? 1 : 0,
        }}
      />

      {/* Flowing dot */}
      {isActive && (
        <div
          className="absolute rounded-full"
          style={{
            width: 8,
            height: 8,
            background: toColor,
            boxShadow: `0 0 8px ${toColor}`,
            top: isVertical ? 0 : -3,
            left: isVertical ? -3 : 0,
            animation: isVertical
              ? "flow-dot-vertical 0.6s ease-out forwards"
              : "flow-dot-horizontal 0.6s ease-out forwards",
          }}
        />
      )}

      <style jsx>{`
        @keyframes flow-dot-horizontal {
          0% {
            transform: translateX(0);
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateX(calc(100% + 48px));
            opacity: 0;
          }
        }
        @keyframes flow-dot-vertical {
          0% {
            transform: translateY(0);
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(32px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function CompletionBadge({ animationKey }: { animationKey: number }) {
  return (
    <motion.div
      key={animationKey}
      className="flex flex-col items-center gap-2 mt-8"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="relative">
        {/* Confetti burst */}
        {CONFETTI_PARTICLES.map((p) => (
          <span
            key={p.id}
            className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
            style={{
              backgroundColor: p.color,
              animation: `confetti-burst 0.8s ease-out ${p.delay}s forwards`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ["--tx" as any]: `${p.tx}px`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ["--ty" as any]: `${p.ty}px`,
            }}
          />
        ))}

        {/* Badge */}
        <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-5 py-2 shadow-sm dark:border-green-500/30 dark:bg-green-500/15">
          <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">完成</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes confetti-burst {
          0% {
            transform: translate(-50%, -50%) translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) translate(var(--tx), var(--ty))
              scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </motion.div>
  );
}

function ComparisonBar() {
  return (
    <motion.div
      className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ amount: 0.5 }}
      transition={{ duration: 0.6 }}
    >
      {/* AI time card */}
      <div className="flex-1 max-w-xs w-full rounded-2xl border border-[#22d3ee]/15 bg-[#22d3ee]/[0.04] p-5 text-center shadow-sm dark:bg-[#22d3ee]/[0.08] dark:border-[#22d3ee]/25">
        <p className="text-3xl font-bold text-[#0A84FF]">~3 分钟</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">AI 全流程</p>
        <div className="mt-3 h-2 rounded-full overflow-hidden bg-[#22d3ee]/10">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #0A84FF, #22d3ee)" }}
            initial={{ width: 0 }}
            whileInView={{ width: "8%" }}
            viewport={{ amount: 0.5 }}
            transition={{ duration: 1, delay: 0.3 }}
          />
        </div>
      </div>

      <span className="text-slate-300 dark:text-slate-600 text-lg font-medium">vs</span>

      {/* Traditional time card */}
      <div className="flex-1 max-w-xs w-full rounded-2xl border border-slate-200/80 bg-white p-5 text-center shadow-sm dark:border-[#1e293b] dark:bg-[#111a2e]">
        <p className="text-3xl font-bold text-slate-400">~4 小时</p>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">传统人工</p>
        <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-slate-300 dark:bg-slate-600"
            initial={{ width: 0 }}
            whileInView={{ width: "100%" }}
            viewport={{ amount: 0.5 }}
            transition={{ duration: 1.5, delay: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export function WorkflowSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.4 });
  const [activeStep, setActiveStep] = useState(-1);
  const [completionKey, setCompletionKey] = useState(0);

  const allComplete = useMemo(
    () => activeStep >= PIPELINE_STEPS.length - 1,
    [activeStep]
  );

  useEffect(() => {
    if (!isInView) {
      // Reset when leaving view so it replays on next scroll-in
      setActiveStep(-1);
      return;
    }

    // Activate first step immediately
    setActiveStep(0);

    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= PIPELINE_STEPS.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isInView]);

  // Increment completion key each time pipeline completes for confetti replay
  useEffect(() => {
    if (allComplete) {
      setCompletionKey((k) => k + 1);
    }
  }, [allComplete]);

  return (
    <section ref={sectionRef} className="max-w-6xl mx-auto py-20 px-4">
      {/* Section badge */}
      <motion.div
        className="flex justify-center mb-4"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.5 }}
        transition={{ duration: 0.5 }}
      >
        <span className="inline-flex items-center rounded-full border border-[#0A84FF]/15 bg-[#0A84FF]/5 px-3 py-1 text-xs font-medium tracking-wide text-[#0A84FF] uppercase">
          工作流程
        </span>
      </motion.div>

      {/* Title */}
      <motion.h2
        className="text-3xl md:text-4xl font-bold text-center text-slate-900 dark:text-white"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.5 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        AI 全链路协作，一条龙搞定
      </motion.h2>

      {/* Pipeline — horizontal on desktop, vertical on mobile */}
      <div className="mt-16">
        {/* Desktop: horizontal */}
        <div className="hidden md:flex items-center justify-center">
          {PIPELINE_STEPS.map((step, index) => (
            <div key={step.employeeId} className="flex items-center">
              <PipelineNode
                employeeId={step.employeeId}
                label={step.label}
                description={step.description}
                duration={step.duration}
                isActive={index <= activeStep}
                index={index}
              />
              {index < PIPELINE_STEPS.length - 1 && (
                <ConnectingLine
                  isActive={index + 1 <= activeStep}
                  isVertical={false}
                  fromEmployeeId={step.employeeId}
                  toEmployeeId={PIPELINE_STEPS[index + 1].employeeId}
                />
              )}
            </div>
          ))}
        </div>

        {/* Mobile: vertical */}
        <div className="flex md:hidden flex-col items-center">
          {PIPELINE_STEPS.map((step, index) => (
            <div key={step.employeeId} className="flex flex-col items-center">
              <PipelineNode
                employeeId={step.employeeId}
                label={step.label}
                description={step.description}
                duration={step.duration}
                isActive={index <= activeStep}
                index={index}
              />
              {index < PIPELINE_STEPS.length - 1 && (
                <ConnectingLine
                  isActive={index + 1 <= activeStep}
                  isVertical={true}
                  fromEmployeeId={step.employeeId}
                  toEmployeeId={PIPELINE_STEPS[index + 1].employeeId}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Completion badge */}
      {allComplete && <CompletionBadge animationKey={completionKey} />}

      {/* Comparison bar */}
      <ComparisonBar />
    </section>
  );
}
