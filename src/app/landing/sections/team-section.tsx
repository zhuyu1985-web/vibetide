"use client";

import { motion } from "framer-motion";
import {
  EMPLOYEE_META,
  EMPLOYEE_CORE_SKILLS,
  BUILTIN_SKILLS,
  type EmployeeId,
} from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";

const EMPLOYEE_IDS: EmployeeId[] = [
  "xiaolei", "xiaoce", "xiaozi", "xiaowen",
  "xiaojian", "xiaoshen", "xiaofa", "xiaoshu",
];

const EMPLOYEE_DESCRIPTIONS: Record<string, string> = {
  xiaolei: "7\u00d724小时全网热点监控，5秒内锁定趋势",
  xiaoce: "智能分析热点角度，精准策划爆款选题",
  xiaozi: "海量素材智能管理，一键检索精准匹配",
  xiaowen: "多风格内容创作，千字成文质量稳定",
  xiaojian: "图文智能转视频，批量产出效率翻倍",
  xiaoshen: "全维度质量审核，合规风险零容忍",
  xiaofa: "多平台智能分发，最佳时段精准触达",
  xiaoshu: "全渠道数据分析，效果归因清晰透明",
};

const skillNameMap = new Map(BUILTIN_SKILLS.map((s) => [s.slug, s.name]));

function getSkillDisplayNames(employeeId: string, count: number): string[] {
  const slugs = EMPLOYEE_CORE_SKILLS[employeeId] ?? [];
  return slugs.slice(0, count).map((slug) => skillNameMap.get(slug) ?? slug);
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export function TeamSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Section badge */}
        <motion.div
          className="flex justify-center mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center rounded-full border border-[#0A84FF]/15 bg-[#0A84FF]/5 px-3 py-1 text-xs font-medium tracking-wide text-[#0A84FF] uppercase">
            AI 团队
          </span>
        </motion.div>

        <motion.h2
          className="text-3xl md:text-4xl font-bold text-center mb-4 text-slate-900 dark:text-white"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          认识你的 AI 团队
        </motion.h2>

        <motion.p
          className="text-center text-slate-500 dark:text-slate-400 mb-12 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          8位专业AI员工各司其职，覆盖内容生产全链路
        </motion.p>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ amount: 0.2 }}
        >
          {EMPLOYEE_IDS.map((id) => {
            const meta = EMPLOYEE_META[id];
            const skills = getSkillDisplayNames(id, 3);
            const description = EMPLOYEE_DESCRIPTIONS[id];

            return (
              <motion.div
                key={id}
                variants={cardVariants}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="group cursor-pointer"
              >
                <div className="relative h-full rounded-2xl border border-slate-200/80 bg-white p-6 flex flex-col items-center text-center gap-3 shadow-sm hover:shadow-md transition-shadow duration-200 dark:border-[#1e293b] dark:bg-[#111a2e]">
                  {/* Subtle top accent */}
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-12 rounded-b-full"
                    style={{ backgroundColor: meta.color }}
                  />

                  {/* Avatar */}
                  <div className="mt-2">
                    <EmployeeAvatar employeeId={id} size="lg" />
                  </div>

                  <p className="font-semibold text-slate-900 dark:text-white">
                    {meta.nickname} · {meta.title}
                  </p>

                  {/* Skill badges */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-slate-500 bg-slate-100 dark:bg-[#1e293b] dark:text-slate-400"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
