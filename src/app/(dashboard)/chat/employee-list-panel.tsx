"use client";

import { useState, useMemo } from "react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { Search, Trash2, MessageSquare, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AIEmployee } from "@/lib/types";
import type { SavedConversationRow } from "@/db/types";

const statusLabel: Record<string, string> = {
  working: "工作中",
  idle: "空闲",
  learning: "学习中",
  reviewing: "审核中",
};

const statusDot: Record<string, string> = {
  working: "bg-green-500",
  idle: "bg-gray-400",
  learning: "bg-blue-500",
  reviewing: "bg-amber-500",
};

interface EmployeeListPanelProps {
  employees: AIEmployee[];
  savedConversations: SavedConversationRow[];
  selectedSlug: string;
  activeTab: "employees" | "saved";
  onSelectEmployee: (slug: string) => void;
  onSelectSaved: (conversation: SavedConversationRow) => void;
  onTabChange: (tab: "employees" | "saved") => void;
  onDeleteSaved: (id: string) => void;
}

function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  return `${months}个月前`;
}

export function EmployeeListPanel({
  employees,
  savedConversations,
  selectedSlug,
  activeTab,
  onSelectEmployee,
  onSelectSaved,
  onTabChange,
  onDeleteSaved,
}: EmployeeListPanelProps) {
  const [search, setSearch] = useState("");

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.nickname.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const filteredSaved = useMemo(() => {
    if (!search.trim()) return savedConversations;
    const q = search.toLowerCase();
    return savedConversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.employeeSlug.toLowerCase().includes(q)
    );
  }, [savedConversations, search]);

  return (
    <div className="w-[280px] flex flex-col border-r border-gray-200/40 dark:border-gray-700/40 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-lg bg-white/60 dark:bg-gray-800/60 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-blue-400/50 transition-all border-0"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 pb-2 flex gap-1">
        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border-0",
            activeTab === "employees"
              ? "bg-blue-500 text-white shadow-sm"
              : "bg-white/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-700/60"
          )}
          onClick={() => onTabChange("employees")}
        >
          <MessageSquare size={12} />
          员工
        </button>
        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border-0",
            activeTab === "saved"
              ? "bg-blue-500 text-white shadow-sm"
              : "bg-white/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-700/60"
          )}
          onClick={() => onTabChange("saved")}
        >
          <Bookmark size={12} />
          收藏
          {savedConversations.length > 0 && (
            <span className="ml-0.5 text-[10px] opacity-70">
              {savedConversations.length}
            </span>
          )}
        </button>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {activeTab === "employees" ? (
          /* Employee list */
          <div className="space-y-0.5">
            {filteredEmployees.map((emp) => {
              const meta = EMPLOYEE_META[emp.id as EmployeeId];
              const isSelected = emp.id === selectedSlug;
              return (
                <button
                  key={emp.id}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 border-0",
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-900/20"
                      : "bg-transparent hover:bg-white/50 dark:hover:bg-gray-800/40"
                  )}
                  onClick={() => onSelectEmployee(emp.id)}
                >
                  <EmployeeAvatar
                    employeeId={emp.id}
                    size="sm"
                    showStatus
                    status={emp.status}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          isSelected
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-gray-800 dark:text-gray-200"
                        )}
                      >
                        {emp.nickname}
                      </span>
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                          statusDot[emp.status] || "bg-gray-400"
                        )}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {emp.title}
                    </p>
                  </div>
                  {isSelected && (
                    <div
                      className="w-1 h-6 rounded-full flex-shrink-0"
                      style={{ backgroundColor: meta?.color ?? "#3b82f6" }}
                    />
                  )}
                </button>
              );
            })}
            {filteredEmployees.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">
                未找到匹配的员工
              </div>
            )}
          </div>
        ) : (
          /* Saved conversations list */
          <div className="space-y-0.5">
            {filteredSaved.map((conv) => (
              <div
                key={conv.id}
                className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/50 dark:hover:bg-gray-800/40 transition-all duration-200"
                onClick={() => onSelectSaved(conv)}
              >
                <EmployeeAvatar
                  employeeId={conv.employeeSlug}
                  size="xs"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                    {conv.title}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {formatRelativeTime(conv.createdAt)}
                  </p>
                </div>
                <button
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 border-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSaved(conv.id);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {filteredSaved.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">
                {search ? "未找到匹配的收藏" : "暂无收藏对话"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
