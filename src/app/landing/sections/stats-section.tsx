"use client";

import { motion } from "framer-motion";
import { AnimatedCounter } from "../components/animated-counter";

const stats = [
  { value: 8, suffix: "", label: "AI 专业员工", description: "覆盖内容生产全链路" },
  { value: 28, suffix: "+", label: "内置专业技能", description: "6 大类别持续扩展" },
  { value: 80, suffix: "%", label: "效率提升", description: "相比传统媒体团队" },
  { value: 4, suffix: "", label: "核心引擎模块", description: "端到端智能协作" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export function StatsSection() {
  return (
    <section className="relative w-full py-20 px-4">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A84FF]/[0.02] to-transparent dark:via-[#0A84FF]/[0.06]" />

      <motion.div
        className="relative z-10 mx-auto grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ margin: "-80px" }}
      >
        {stats.map((item) => (
          <motion.div
            key={item.label}
            className="flex flex-col items-center text-center"
            variants={itemVariants}
          >
            <AnimatedCounter
              value={item.value}
              suffix={item.suffix}
              className="bg-gradient-to-r from-[#0A84FF] to-[#22d3ee] bg-clip-text text-5xl font-bold text-transparent md:text-6xl"
            />
            <div
              className="mt-3 h-0.5 w-10 rounded-full"
              style={{ background: "linear-gradient(90deg, #0A84FF, #22d3ee)" }}
            />
            <p className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{item.label}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
