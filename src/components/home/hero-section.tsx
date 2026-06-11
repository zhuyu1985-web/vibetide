"use client";

import { memo } from "react";
import { motion } from "framer-motion";

// memo: 父组件 home-client 每个 keystroke 都重 render,而 HeroSection 完全静态,
// 不需要跟着重 render(motion 入场动画也只在 mount 时跑一次)。
export const HeroSection = memo(function HeroSection() {
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

      {/* Title — 新建会话提示语(每次新建会话即首页模板) */}
      <motion.h1
        className="text-center text-4xl font-bold tracking-tight text-foreground md:text-5xl"
        initial={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.22, 1.1, 0.36, 1] }}
      >
        说点什么，开始新会话
      </motion.h1>

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
