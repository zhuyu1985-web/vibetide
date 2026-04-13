"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/glass-card";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

interface CardData {
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  scenarios: string[];
  features: string[];
  analogy: string;
}

const LEFT_CARD: CardData = {
  badge: "AI",
  badgeColor: "bg-indigo-500",
  title: "AI 员工（垂类深度智能体）",
  description: "为特定垂类场景预设好的专家型智能体",
  scenarios: ["单一领域任务", "多轮交互探索", "即时性需求", "日常高频操作"],
  features: ["绑定知识库+记忆", "持续进化", "预设技能组合"],
  analogy: "类比：直接找同事聊一件事",
};

const RIGHT_CARD: CardData = {
  badge: "WF",
  badgeColor: "bg-pink-500",
  title: "工作流（灵活编排引擎）",
  description: "跨职能协作的流程编排",
  scenarios: ["多专业领域协作", "标准化可复用流程", "需要审批节点", "步骤间数据传递"],
  features: ["自定义步骤序列", "DAG依赖管理", "Leader动态分配员工"],
  analogy: "类比：启动一个项目流程",
};

function ComparisonCard({ data }: { data: CardData }) {
  return (
    <motion.div variants={item}>
      <GlassCard variant="secondary" className="h-full flex flex-col">
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`${data.badgeColor} text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0`}
          >
            {data.badge}
          </span>
          <h4 className="font-semibold text-base">{data.title}</h4>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{data.description}</p>

        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">适用场景</p>
          <ul className="space-y-1">
            {data.scenarios.map((s) => (
              <li key={s} className="text-sm flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">核心特点</p>
          <ul className="space-y-1">
            {data.features.map((f) => (
              <li key={f} className="text-sm flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto pt-3 border-t border-border/40">
          <span className="text-xs text-muted-foreground italic">{data.analogy}</span>
        </div>
      </GlassCard>
    </motion.div>
  );
}

export function SkillComparisonCards() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ComparisonCard data={LEFT_CARD} />
        <ComparisonCard data={RIGHT_CARD} />
      </div>

      <motion.div variants={item}>
        <GlassCard variant="accent" padding="sm">
          <p className="text-sm leading-relaxed">
            🔑 <span className="font-semibold">关键关系：</span>AI
            员工可以被工作流调度——工作流的每个步骤本质上就是调用某个 AI
            员工的某个技能。AI 员工侧重深度，工作流侧重广度。
          </p>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
