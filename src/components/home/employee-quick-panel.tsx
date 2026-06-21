"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ORDERED_CRAFTS, type CraftType } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";

/**
 * 首页「AI 专家团队」信任条 —— 四层重构后【纯展示·非选择器】。
 * 用户开工只面对"场景 / 对话",从不挑员工;这里只用一行轻量信任条让用户感知
 * "背后有一支按工种分工的专业团队",并提供通往团队管理 / AI-HR 页的入口。
 * 重叠头像簇(非可点网格)天然读作"一个团队",而非"可选项"。
 */
const SHOWCASE_CRAFTS: CraftType[] = ORDERED_CRAFTS.filter(
  (c) => c !== "producer",
);

// 信任条里只叠放几个代表工种的头像,营造"团队"观感(不逐个露出全部工种)。
const AVATAR_CRAFTS: CraftType[] = [
  "director",
  "reporter",
  "editor",
  "reviewer",
  "operator",
];

export function EmployeeQuickPanel() {
  return (
    <motion.div
      className="flex items-center justify-between gap-3 px-1"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {/* 重叠头像簇,复用场景卡 defaultTeam 的视觉语言 */}
        <div className="flex items-center -space-x-2">
          {AVATAR_CRAFTS.map((craft) => (
            <EmployeeAvatar key={craft} employeeId={craft} size="sm" />
          ))}
        </div>
        <span className="truncate text-xs text-muted-foreground">
          一支按工种分工的 AI 团队 · {SHOWCASE_CRAFTS.length} 个工种协同
        </span>
      </div>

      <Link
        href="/ai-employees"
        className="shrink-0 text-xs text-muted-foreground/70 transition-colors duration-200 hover:text-foreground"
      >
        团队管理与考核 →
      </Link>
    </motion.div>
  );
}
