"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { cn } from "@/lib/utils";

const DISPLAY_EMPLOYEES: EmployeeId[] = [
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
];

interface EmployeeQuickPanelProps {
  activeEmployee?: EmployeeId | null;
  onEmployeeClick: (id: EmployeeId) => void;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

export function EmployeeQuickPanel({
  activeEmployee,
  onEmployeeClick,
}: EmployeeQuickPanelProps) {
  return (
    <div className="w-full">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium text-slate-400">AI 专家团队</span>
        <Link
          href="/ai-employees"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors duration-200"
        >
          全部员工 →
        </Link>
      </div>

      {/* Horizontal scroll row */}
      <motion.div
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {DISPLAY_EMPLOYEES.map((id) => {
          const emp = EMPLOYEE_META[id];
          const isActive = activeEmployee === id;

          return (
            <motion.button
              key={id}
              variants={cardVariants}
              onClick={() => onEmployeeClick(id)}
              whileHover={{ y: -1 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={cn(
                "flex-shrink-0 w-[88px] flex flex-col items-center gap-2 py-3 px-2 rounded-xl",
                "cursor-pointer transition-colors duration-200",
                isActive
                  ? "bg-white/[0.08] ring-1 ring-white/15"
                  : "bg-white/[0.02] hover:bg-white/[0.06]"
              )}
            >
              <EmployeeAvatar employeeId={id} size="lg" animated />
              <span
                className={cn(
                  "text-[11px] text-center leading-tight",
                  isActive ? "text-slate-200" : "text-slate-500"
                )}
              >
                {emp.title}
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
