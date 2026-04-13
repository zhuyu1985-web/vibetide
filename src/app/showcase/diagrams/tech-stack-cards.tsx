"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/glass-card";
import { TECH_STACK, IMPL_STATUS } from "@/app/showcase/data/showcase-content";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export function TechStackCards() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      className="space-y-8"
    >
      {/* Part 1: Tech stack grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {TECH_STACK.map((tech) => (
          <motion.div key={tech.name} variants={item}>
            <GlassCard variant="interactive" hover className="h-full">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {tech.category}
              </p>
              <p className="text-sm font-semibold mb-1.5">{tech.name}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {tech.reason}
              </p>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Part 2: Implementation status table */}
      <motion.div variants={item}>
        <GlassCard variant="secondary">
          <h4 className="font-semibold text-sm mb-4">实现状态</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">
                    功能点
                  </th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">
                    状态
                  </th>
                  <th className="text-left py-2 text-xs font-medium text-muted-foreground">
                    说明
                  </th>
                </tr>
              </thead>
              <tbody>
                {IMPL_STATUS.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={
                      i % 2 === 0
                        ? "bg-muted/20"
                        : ""
                    }
                  >
                    <td className="py-2 pr-4">{row.feature}</td>
                    <td className="py-2 pr-4">
                      {row.status === "done" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-600 dark:text-green-400">
                          ✅ 已完成
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          🔜 规划中
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-muted-foreground text-xs">
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
