"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { DIMENSION_META } from "@/lib/topic-matching/dimension-analyzer";

export type AnalysisPhase =
  | "idle"
  | "matching"
  | "matched"
  | "analyzing"
  | "saving"
  | "done";

interface Props {
  phase: AnalysisPhase;
  matchCount?: number;
  message?: string;
}

/**
 * 分阶段进度：
 *   matching  (0-8%)  — 检索同题报道
 *   matched   (8-12%) — 已匹配 N 篇（瞬态）
 *   analyzing (12-90%) — AI 生成 10 维（匀速推进，模拟逐个维度思考）
 *   saving    (90-98%) — 保存结果
 *   done      (100%)
 */
function phaseToTarget(phase: AnalysisPhase): number {
  switch (phase) {
    case "matching": return 8;
    case "matched": return 12;
    case "analyzing": return 90;
    case "saving": return 98;
    case "done": return 100;
    default: return 0;
  }
}

export function AnalysisProgress({ phase, matchCount, message }: Props) {
  const [displayPercent, setDisplayPercent] = useState(0);
  const [activeDim, setActiveDim] = useState(0);
  const dimIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 进度平滑推进
  useEffect(() => {
    const target = phaseToTarget(phase);
    if (phase === "done") {
      setDisplayPercent(100);
      return;
    }

    // analyzing 阶段：匀速爬升，配合 60 秒预估时间
    if (phase === "analyzing") {
      const start = Date.now();
      const startPercent = displayPercent > 12 ? displayPercent : 12;
      const duration = 55_000; // 55 秒走到 90%
      const id = setInterval(() => {
        const elapsed = Date.now() - start;
        const pct = Math.min(
          90,
          startPercent + ((90 - startPercent) * elapsed) / duration
        );
        setDisplayPercent(pct);
      }, 200);
      return () => clearInterval(id);
    }

    // 其他阶段：快速靠近 target
    const id = setInterval(() => {
      setDisplayPercent((prev) => {
        if (prev >= target) {
          clearInterval(id);
          return target;
        }
        return Math.min(target, prev + 1.5);
      });
    }, 40);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // 10 维轮播高亮
  useEffect(() => {
    if (phase !== "analyzing") {
      if (dimIntervalRef.current) {
        clearInterval(dimIntervalRef.current);
        dimIntervalRef.current = null;
      }
      return;
    }
    dimIntervalRef.current = setInterval(() => {
      setActiveDim((i) => (i + 1) % DIMENSION_META.length);
    }, 3500);
    return () => {
      if (dimIntervalRef.current) clearInterval(dimIntervalRef.current);
    };
  }, [phase]);

  const phaseLabel = (() => {
    switch (phase) {
      case "matching": return "🔍 正在检索同题报道...";
      case "matched":
        return matchCount !== undefined
          ? `✨ 已找到 ${matchCount} 篇同题报道`
          : "✨ 已找到同题报道";
      case "analyzing": return "🤖 AI 正在生成 10 维度深度分析";
      case "saving": return "💾 正在保存分析结果...";
      case "done": return "✅ 分析完成";
      default: return "准备中...";
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-50/80 via-indigo-50/80 to-purple-50/80 dark:from-sky-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 p-8 min-h-[500px] flex flex-col items-center justify-center"
    >
      {/* 背景光斑动画 */}
      <motion.div
        className="absolute inset-0 opacity-30"
        initial={{ backgroundPosition: "0% 0%" }}
        animate={{
          backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 40%, rgba(14,165,233,0.25), transparent 45%), radial-gradient(circle at 70% 60%, rgba(168,85,247,0.25), transparent 45%)",
          backgroundSize: "200% 200%",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-md">
        {/* 环形进度 + 中心图标 */}
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              strokeWidth="6"
              className="fill-none stroke-gray-200 dark:stroke-gray-700"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="45"
              strokeWidth="6"
              strokeLinecap="round"
              className="fill-none stroke-sky-500"
              style={{
                strokeDasharray: 283,
                strokeDashoffset: 283 - (283 * displayPercent) / 100,
              }}
              transition={{ ease: "linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {phase === "done" ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            ) : (
              <motion.div
                animate={{ rotate: phase === "analyzing" ? 360 : 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                {phase === "analyzing" ? (
                  <Sparkles className="w-10 h-10 text-sky-500" />
                ) : (
                  <Loader2 className="w-10 h-10 text-sky-500" />
                )}
              </motion.div>
            )}
          </div>
          <div className="absolute -bottom-7 left-0 right-0 text-center text-sm font-bold text-sky-700 dark:text-sky-300">
            {Math.round(displayPercent)}%
          </div>
        </div>

        <div className="mt-6 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={phaseLabel}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="text-sm font-medium text-gray-800 dark:text-gray-200"
            >
              {phaseLabel}
            </motion.div>
          </AnimatePresence>
          {message && (
            <div className="mt-1 text-xs text-gray-500">{message}</div>
          )}
        </div>

        {/* 10 维度动态指示（analyzing 阶段显示） */}
        {phase === "analyzing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full mt-2"
          >
            <div className="text-[11px] uppercase tracking-wider text-gray-500 text-center mb-3">
              10 维度分析中
            </div>
            <div className="grid grid-cols-5 gap-2">
              {DIMENSION_META.map((d, i) => {
                const isActive = i === activeDim;
                const isPast = i < activeDim;
                return (
                  <motion.div
                    key={d.key}
                    animate={{
                      scale: isActive ? 1.08 : 1,
                      opacity: isActive ? 1 : isPast ? 0.8 : 0.4,
                    }}
                    transition={{ duration: 0.3 }}
                    className={`relative rounded-lg px-2 py-2 text-center text-[11px] font-medium ${
                      isActive
                        ? "bg-sky-500 text-white shadow-lg shadow-sky-500/30"
                        : isPast
                          ? "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                          : "bg-white/60 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400"
                    }`}
                  >
                    {isPast && (
                      <CheckCircle2 className="absolute -top-1 -right-1 w-3 h-3 text-emerald-500 bg-white dark:bg-gray-900 rounded-full" />
                    )}
                    {d.shortLabel}
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-gray-500">
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-sky-500"
              />
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                className="w-1.5 h-1.5 rounded-full bg-sky-500"
              />
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                className="w-1.5 h-1.5 rounded-full bg-sky-500"
              />
              <span className="ml-2">大约需要 60 秒，请耐心等待</span>
            </div>
          </motion.div>
        )}

        {phase === "matched" && matchCount !== undefined && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 text-sm"
          >
            <span className="text-sky-600 dark:text-sky-400 font-bold text-lg">
              {matchCount}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              篇对标报道已纳入分析
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
