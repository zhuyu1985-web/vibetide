"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, BookOpen, Calendar } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EmployeeId } from "@/lib/constants";
import { EMPLOYEE_META } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";

interface Scenario {
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  color: string;
  duration: string;
  employees: EmployeeId[];
}

const scenarios: Scenario[] = [
  {
    title: "突发快讯",
    subtitle: "5 分钟极速响应",
    description: "热点捕获→快讯撰写→多平台抢发，比同行快 10 倍",
    icon: Zap,
    color: "#ef4444",
    duration: "~5min",
    employees: ["xiaolei", "xiaowen", "xiaoshen", "xiaofa"],
  },
  {
    title: "深度专题",
    subtitle: "从选题到万字长文",
    description: "AI 策划选题角度→资料收集→深度撰写→配图配视频→审核发布",
    icon: BookOpen,
    color: "#2dd4bf",
    duration: "~30min",
    employees: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaojian", "xiaoshen"],
  },
  {
    title: "日常运营",
    subtitle: "每日内容矩阵",
    description: "自动生成每日选题计划→批量创作→定时发布→数据回收复盘",
    icon: Calendar,
    color: "#0A84FF",
    duration: "每日自动",
    employees: ["xiaolei", "xiaoce", "xiaowen", "xiaofa", "xiaoshu"],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const [hovered, setHovered] = useState(false);
  const Icon = scenario.icon;

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group cursor-pointer"
    >
      <div className="relative h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200 dark:border-[#1e293b] dark:bg-[#111a2e]">
        {/* Duration badge */}
        <span className="absolute right-4 top-4 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-[#1e293b] dark:text-slate-400">
          {scenario.duration}
        </span>

        {/* Icon */}
        <motion.div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `${scenario.color}10`,
            border: `1px solid ${scenario.color}18`,
          }}
          animate={{ rotate: hovered ? 10 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Icon size={24} style={{ color: scenario.color }} strokeWidth={2} />
        </motion.div>

        <h3 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">{scenario.title}</h3>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{scenario.subtitle}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{scenario.description}</p>

        {/* Avatars */}
        <div className="mt-5 flex items-center">
          {scenario.employees.map((id, index) => {
            const meta = EMPLOYEE_META[id];
            return (
              <motion.div
                key={id}
                className="relative"
                animate={{ marginLeft: index === 0 ? 0 : hovered ? 4 : -8 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                title={meta?.nickname}
              >
                <EmployeeAvatar employeeId={id} size="sm" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export function ScenariosSection() {
  return (
    <section className="relative w-full py-24 px-4">
      <div className="mx-auto max-w-6xl">
        {/* Section badge */}
        <motion.div
          className="flex justify-center mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ margin: "-50px" }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center rounded-full border border-[#2dd4bf]/15 bg-[#2dd4bf]/5 px-3 py-1 text-xs font-medium tracking-wide text-[#2dd4bf] uppercase">
            应用场景
          </span>
        </motion.div>

        <motion.h2
          className="mb-4 text-center text-3xl font-bold md:text-4xl text-slate-900 dark:text-white"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          实战场景，即刻上手
        </motion.h2>

        <motion.p
          className="text-center text-slate-500 dark:text-slate-400 mb-12 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          适应不同内容生产节奏，从快讯到专题一站搞定
        </motion.p>

        <motion.div
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ margin: "-80px" }}
        >
          {scenarios.map((scenario) => (
            <ScenarioCard key={scenario.title} scenario={scenario} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
