"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { EmployeeAgentCard } from "@/components/ai-employees/employee-agent-card";
import { SearchInput } from "@/components/shared/search-input";
import { EMPLOYEE_HOT_TASKS } from "@/lib/employee-tasks";
import { CRAFT_META, ORDERED_CRAFTS, type CraftType } from "@/lib/constants";
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

  // ── Filtering + 按工种(roleType)分组 ──
  // 同一工种(记者)下挂多个实例(基础记者 / 财经记者 / 时政记者…),工种内
  // 基础实例(isPreset)排前。非工种 roleType(总监/顾问/旧自定义)归「其他」。
  const { craftGroups, otherEmployees, total } = useMemo(() => {
    let result = [...employees];

    if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.nickname.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q),
      );
    }

    const byCraft = new Map<string, AIEmployee[]>();
    const other: AIEmployee[] = [];
    for (const e of result) {
      if (e.roleType && e.roleType in CRAFT_META) {
        const list = byCraft.get(e.roleType) ?? [];
        list.push(e);
        byCraft.set(e.roleType, list);
      } else {
        other.push(e);
      }
    }
    for (const list of byCraft.values()) {
      list.sort((a, b) => Number(b.isPreset) - Number(a.isPreset));
    }

    const groups = ORDERED_CRAFTS.filter((c) => byCraft.has(c)).map((c) => ({
      craft: c as CraftType,
      meta: CRAFT_META[c],
      items: byCraft.get(c)!,
    }));

    return { craftGroups: groups, otherEmployees: other, total: result.length };
  }, [employees, statusFilter, searchText]);

  // ── Handlers ──
  const handleDispatchTask = useCallback(
    () => {
      router.push("/cowork");
    },
    [router]
  );

  const handleHotTaskClick = useCallback(
    () => {
      router.push("/cowork");
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
          共 {total} 名员工 · {craftGroups.length} 个工种
          {statusFilter !== "all" && ` (已筛选)`}
        </span>
      </div>

      {/* ── Grid ── */}
      {total > 0 ? (
        <div className="space-y-8">
          {craftGroups.map((g) => {
            const Icon = g.meta.icon;
            return (
              <div key={g.craft}>
                {/* 工种分组头 */}
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="flex size-6 items-center justify-center rounded-lg"
                    style={{ backgroundColor: g.meta.bgColor, color: g.meta.color }}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-white/80">
                    {g.meta.name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-white/30">
                    {g.items.length} 个实例
                  </span>
                  <div className="flex-1 h-px bg-black/[0.06] dark:bg-white/[0.06]" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {g.items.map((emp) => (
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
            );
          })}

          {/* 其他(总监/顾问/旧自定义等非工种 roleType)*/}
          {otherEmployees.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-medium text-gray-400 dark:text-white/40">
                  其他
                </span>
                <div className="flex-1 h-px bg-black/[0.06] dark:bg-white/[0.06]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {otherEmployees.map((emp) => (
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
