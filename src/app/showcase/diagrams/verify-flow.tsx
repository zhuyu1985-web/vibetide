"use client";

import { motion } from "framer-motion";
import { Brain, MessageCircle } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};

interface FlowStepProps {
  title: string;
  detail?: string;
  subItems?: string[];
  isLast?: boolean;
}

function FlowStep({ title, detail, subItems, isLast }: FlowStepProps) {
  return (
    <div className="relative flex gap-3">
      {/* Vertical connector line */}
      <div className="flex flex-col items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-1.5" />
        {!isLast && <div className="w-0.5 flex-1 bg-border" />}
      </div>
      <div className={`pb-4 ${isLast ? "" : ""}`}>
        <p className="text-sm font-medium">{title}</p>
        {detail && (
          <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
        )}
        {subItems && (
          <ul className="mt-1.5 space-y-0.5">
            {subItems.map((s) => (
              <li key={s} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">·</span>
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function VerifyFlow() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Channel 1: LLM Self-evaluation */}
        <motion.div variants={item}>
          <GlassCard variant="secondary" className="h-full">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-indigo-500" />
              <h4 className="font-semibold text-sm">通道一：LLM 自我评估</h4>
            </div>
            <div className="pl-1">
              <FlowStep title="执行结果" detail="Agent 输出的原始内容" />
              <FlowStep
                title="LLM 评估器"
                detail="DeepSeek-chat · temperature=0.2"
              />
              <FlowStep
                title="四维打分"
                subItems={["准确性", "完整性", "风格", "合规性"]}
              />
              <FlowStep
                title="记忆生成"
                subItems={[
                  "≥80分 → 成功模式（importance=score/100）",
                  "<60分 → 失败教训（0.8）",
                  "高严重度 → 技能洞察（0.7）",
                ]}
                isLast
              />
            </div>
          </GlassCard>
        </motion.div>

        {/* Channel 2: User Feedback */}
        <motion.div variants={item}>
          <GlassCard variant="secondary" className="h-full">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-5 h-5 text-pink-500" />
              <h4 className="font-semibold text-sm">通道二：用户反馈</h4>
            </div>

            {/* Path A */}
            <div className="mb-5">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                路径 A：对话反馈（即时记忆）
              </p>
              <GlassCard variant="default" padding="sm">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span>👍</span>
                    <span>点赞</span>
                    <span className="text-xs text-muted-foreground ml-auto">importance: 0.75</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span>👎</span>
                    <span>点踩</span>
                    <span className="text-xs text-muted-foreground ml-auto">importance: 0.9</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">
                    → 直接写入 employeeMemories
                  </p>
                </div>
              </GlassCard>
            </div>

            {/* Path B */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                路径 B：工作流反馈（聚合学习）
              </p>
              <GlassCard variant="default" padding="sm">
                <div className="space-y-1.5">
                  <p className="text-sm">接受 / 拒绝 / 编辑</p>
                  <p className="text-xs text-muted-foreground">
                    → user_feedback 表 → 学习引擎
                  </p>
                </div>
              </GlassCard>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* Bottom convergence */}
      <motion.div variants={item}>
        <GlassCard variant="accent" padding="sm">
          <p className="text-sm leading-relaxed text-center">
            ↓ 所有记忆在下次 Agent Assembly 时加载到 Layer 6 → AI 行为自动优化
          </p>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
