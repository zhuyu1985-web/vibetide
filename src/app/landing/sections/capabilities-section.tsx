"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Sparkles, Brain, Radio, Users, type LucideIcon } from "lucide-react";

interface Capability {
  num: string;
  title: string;
  color: string;
  icon: LucideIcon;
  points: string[];
}

const CAPABILITIES: Capability[] = [
  {
    num: "01",
    title: "智创生产",
    color: "#0A84FF",
    icon: Sparkles,
    points: [
      "灵感挖掘 — AI全网捕捉创作灵感",
      "超级创作 — 多风格一键生成优质内容",
      "批量生产 — 规模化内容产出能力",
      "精品输出 — 质量评分保障内容品质",
    ],
  },
  {
    num: "02",
    title: "AI 资产重构",
    color: "#2dd4bf",
    icon: Brain,
    points: [
      "媒资理解 — AI深度理解图文视频内容",
      "知识图谱 — 自动构建领域知识网络",
      "素材复活 — 历史资产智能再利用",
      "智能标签 — 多维度自动分类标注",
    ],
  },
  {
    num: "03",
    title: "全渠道传播",
    color: "#22d3ee",
    icon: Radio,
    points: [
      "一键多平台 — 内容自动适配多渠道",
      "最佳时段 — AI预测最优发布时间",
      "渠道顾问 — 平台规则智能解读",
      "数据回流 — 全渠道效果实时追踪",
    ],
  },
  {
    num: "04",
    title: "AI 团队引擎",
    color: "#0ea5e9",
    icon: Users,
    points: [
      "员工编排 — 灵活组建AI协作团队",
      "技能组合 — 28+技能自由搭配",
      "工作流引擎 — 可视化流程自动执行",
      "自主进化 — 持续学习越用越强",
    ],
  },
];

export function CapabilitiesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const lineScaleY = useTransform(scrollYProgress, [0.1, 0.85], [0, 1]);

  return (
    <section ref={sectionRef} className="relative max-w-6xl mx-auto py-24 px-4">
      {/* Section badge */}
      <motion.div
        className="flex justify-center mb-4"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.5 }}
        transition={{ duration: 0.5 }}
      >
        <span className="inline-flex items-center rounded-full border border-[#22d3ee]/15 bg-[#22d3ee]/5 px-3 py-1 text-xs font-medium tracking-wide text-[#22d3ee] uppercase">
          核心能力
        </span>
      </motion.div>

      <motion.h2
        className="text-3xl md:text-4xl font-bold text-center mb-4 text-slate-900 dark:text-white"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.5 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        四大核心引擎
      </motion.h2>

      <motion.p
        className="text-center text-slate-500 dark:text-slate-400 mb-16 max-w-2xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.5 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        从内容生产到智能分发，全链路AI赋能
      </motion.p>

      {/* Vertical connection line */}
      <motion.div
        className="absolute left-4 md:left-8 top-56 bottom-20 w-0.5 origin-top hidden md:block"
        style={{
          scaleY: lineScaleY,
          background: "linear-gradient(to bottom, #0A84FF, #22d3ee, #2dd4bf, #0ea5e9)",
        }}
        aria-hidden="true"
      />

      <div className="flex flex-col gap-20 md:gap-28">
        {CAPABILITIES.map((cap, index) => {
          const isEven = index % 2 === 1;
          const Icon = cap.icon;

          return (
            <div
              key={cap.num}
              className={`flex flex-col md:flex-row items-center gap-8 md:gap-16 ${isEven ? "md:flex-row-reverse" : ""}`}
            >
              {/* Text side */}
              <motion.div
                className="flex-1"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ amount: 0.3 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <span
                  className="text-6xl font-bold bg-clip-text text-transparent"
                  style={{ backgroundImage: `linear-gradient(135deg, ${cap.color}, ${cap.color}66)` }}
                >
                  {cap.num}
                </span>
                <h3 className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">{cap.title}</h3>
                <ul className="mt-4 space-y-3">
                  {cap.points.map((point, pi) => (
                    <motion.li
                      key={pi}
                      className="flex items-start gap-3 text-sm md:text-base text-slate-600 dark:text-slate-400"
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ amount: 0.3 }}
                      transition={{ duration: 0.4, delay: 0.1 * pi, ease: "easeOut" }}
                    >
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: cap.color }}
                        aria-hidden="true"
                      />
                      {point}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>

              {/* Illustration card — clean white */}
              <motion.div
                className="flex-1 flex items-center justify-center"
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ amount: 0.3 }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
              >
                <div
                  className="relative w-56 h-56 md:w-64 md:h-64 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-[#1e293b] dark:bg-[#111a2e]"
                >
                  {/* Subtle background tint */}
                  <div
                    className="absolute inset-0"
                    style={{ background: `radial-gradient(circle at 50% 50%, ${cap.color}08, transparent 70%)` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: `${cap.color}10`, border: `1px solid ${cap.color}15` }}
                    >
                      <Icon size={40} style={{ color: cap.color }} strokeWidth={1.5} />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
