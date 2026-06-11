"use client";

import { memo, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// MClaw 品牌彩色渐变(与早期首页一致)
const BRAND_GRADIENT =
  "linear-gradient(135deg, #0b1224 0%, #1e3a8a 40%, #0ea5e9 90%, #22d3ee 100%)";

type Slide = { type: "brand" } | { type: "prompt"; text: string };

// 大标题在「MClaw 品牌」与「开始新会话提示」之间动态轮换
const SLIDES: Slide[] = [
  { type: "brand" },
  { type: "prompt", text: "说点什么，开始新会话" },
];

// memo: 父组件 home-client 每个 keystroke 都重 render,HeroSection 不需要跟着重 render
// (内部用自己的定时器驱动标题轮换)。
export const HeroSection = memo(function HeroSection() {
  const [idx, setIdx] = useState(0);

  // 定时在品牌 / 提示语之间切换(挂载后才启动,SSR 与首屏均为 slide 0,无水合差异)
  useEffect(() => {
    const t = setInterval(() => setIdx((v) => (v + 1) % SLIDES.length), 4200);
    return () => clearInterval(t);
  }, []);

  const slide = SLIDES[idx];

  return (
    <div className="flex flex-col items-center gap-3 pt-4 pb-2">
      {/* Status badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.65, ease: "easeOut" }}
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
            超级个体已就绪 · 8 位专家待命
          </span>
        </div>
      </motion.div>

      {/* Title —— 在「MClaw 你的智媒工作空间」与「说点什么，开始新会话」之间动态轮换。
          固定高度槽位 + 绝对定位交叉淡入,避免轮换时布局抖动。 */}
      <div className="relative flex h-11 w-full items-center justify-center md:h-14">
        <AnimatePresence>
          <motion.div
            key={idx}
            className="absolute inset-0 flex items-baseline justify-center text-center text-3xl font-bold tracking-tight md:text-4xl"
            initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
            transition={{ duration: 0.5, ease: [0.22, 1.1, 0.36, 1] }}
          >
            {slide.type === "brand" ? (
              <span className="inline-flex items-baseline gap-2 md:gap-3">
                <span
                  className="relative inline-block font-black leading-none"
                  style={{
                    background: BRAND_GRADIENT,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  MClaw
                  {/* brushstroke 渐变下划线 */}
                  <span
                    className="absolute -bottom-1 left-1/2 h-[3px] w-4/5 -translate-x-1/2 rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, #0ea5e9, #22d3ee, transparent)",
                    }}
                  />
                </span>
                <span className="text-foreground">你的智媒工作空间</span>
              </span>
            ) : (
              <span className="text-foreground">{slide.text}</span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Subtitle — fade in after title */}
      <motion.p
        className="text-center text-base text-muted-foreground"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45, ease: "easeOut" }}
      >
        描述你的需求，AI 团队会解析意图、组建专家并安排任务执行
      </motion.p>
    </div>
  );
});
