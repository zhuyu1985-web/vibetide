"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { EmployeeAgentCard } from "@/components/ai-employees/employee-agent-card";
import { SearchInput } from "@/components/shared/search-input";
import { EMPLOYEE_HOT_TASKS } from "@/lib/employee-tasks";
import type { AIEmployee } from "@/lib/types";
import { UserPlus } from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS = [
  { value: "all", label: "全部" },
  { value: "working", label: "工作中" },
  { value: "idle", label: "空闲" },
  { value: "learning", label: "学习中" },
  { value: "reviewing", label: "审核中" },
] as const;

const EMPLOYEE_ORDER = [
  "xiaolei", "xiaoce", "xiaozi", "xiaowen",
  "xiaojian", "xiaoshen", "xiaofa", "xiaoshu",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiEmployeesClientProps {
  employees: AIEmployee[];
  organizationId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiEmployeesClient({
  employees,
  organizationId: _organizationId,
}: AiEmployeesClientProps) {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Filtering & sorting ──
  const { presetEmployees, customEmployees } = useMemo(() => {
    let result = [...employees].sort((a, b) => {
      const ia = EMPLOYEE_ORDER.indexOf(a.id);
      const ib = EMPLOYEE_ORDER.indexOf(b.id);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.nickname.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q)
      );
    }

    return {
      presetEmployees: result.filter((e) => !String(e.id).startsWith("custom_")),
      customEmployees: result.filter((e) => String(e.id).startsWith("custom_")),
    };
  }, [employees, statusFilter, searchText]);

  const filteredEmployees = useMemo(
    () => [...presetEmployees, ...customEmployees],
    [presetEmployees, customEmployees]
  );

  // ── Handlers ──
  const handleDispatchTask = useCallback(
    (slug: string) => {
      router.push(`/chat?employee=${slug}`);
    },
    [router]
  );

  const handleHotTaskClick = useCallback(
    (slug: string, prompt: string) => {
      router.push(`/chat?employee=${slug}&task=${encodeURIComponent(prompt)}`);
    },
    [router]
  );

  return (
    <div className="max-w-[1400px] mx-auto px-1">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90 mb-1">
            AI 数字员工
          </h1>
          <p className="text-sm text-gray-400 dark:text-white/40">
            你的智能媒体团队，自主完成复杂任务。
          </p>
        </div>
        <button
          onClick={() => router.push("/ai-employees/create")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 cursor-pointer border-0 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          创建新员工
        </button>
      </div>

      {/* ── Search + Status Filter ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        {/* Search */}
        <SearchInput
          className="w-full sm:w-72"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="搜索员工名称、昵称或职位..."
        />

        {/* Status filter pills */}
        <div className="flex gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-0 cursor-pointer ${
                statusFilter === tab.value
                  ? "bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white/90"
                  : "bg-transparent text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Employee count ── */}
      <div className="mb-4">
        <span className="text-xs text-gray-600 dark:text-gray-300">
          共 {filteredEmployees.length} 名员工
          {statusFilter !== "all" && ` (已筛选)`}
        </span>
      </div>

      {/* ── Grid ── */}
      {filteredEmployees.length > 0 ? (
        <div className="space-y-8">
          {/* Preset employees */}
          {presetEmployees.length > 0 && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {presetEmployees.map((emp) => (
                  <EmployeeAgentCard
                    key={emp.dbId}
                    employee={emp}
                    hotTasks={EMPLOYEE_HOT_TASKS[emp.id] || []}
                    onDispatchTask={handleDispatchTask}
                    onHotTaskClick={handleHotTaskClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom employees */}
          {customEmployees.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-medium text-gray-400 dark:text-white/40">
                  自定义员工
                </span>
                <div className="flex-1 h-px bg-black/[0.06] dark:bg-white/[0.06]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {customEmployees.map((emp) => (
                  <EmployeeAgentCard
                    key={emp.dbId}
                    employee={emp}
                    hotTasks={EMPLOYEE_HOT_TASKS[emp.id] || []}
                    onDispatchTask={handleDispatchTask}
                    onHotTaskClick={handleHotTaskClick}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-sm text-gray-300 dark:text-white/30">
            {searchText.trim() || statusFilter !== "all"
              ? "没有匹配的员工"
              : "暂无员工数据"}
          </p>
        </div>
      )}
    </div>
  );
}
