"use client";

import { memo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
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

// memo: 父组件 keystroke 高频重 render,只有 activeEmployee 切换时才需要更新
export const EmployeeQuickPanel = memo(function EmployeeQuickPanel({
  activeEmployee,
  onEmployeeClick,
}: EmployeeQuickPanelProps) {
  return (
    <div className="w-full">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium text-muted-foreground">AI 专家团队</span>
        <div className="flex items-center gap-3">
          <Link
            href="/ai-employees/create"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-200"
          >
            <Plus size={14} />
            创建员工
          </Link>
          <Link
            href="/ai-employees"
            className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors duration-200"
          >
            全部员工 →
          </Link>
        </div>
      </div>

      {/* Employee row */}
      <motion.div
        className="grid grid-cols-8 gap-1 pb-2"
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
                "flex w-full flex-col items-center gap-2 rounded-xl px-1 py-3",
                "cursor-pointer transition-colors duration-200 border-0",
                isActive
                  ? "bg-accent"
                  : "bg-transparent hover:bg-muted/50"
              )}
            >
              <EmployeeAvatar employeeId={id} size="lg" animated />
              <span
                className={cn(
                  "text-[11px] text-center leading-tight",
                  isActive ? "text-foreground" : "text-muted-foreground"
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
});
