"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployeeCreateDialog } from "@/components/shared/employee-create-dialog";
import { Plus, Filter, Users, Loader2, RefreshCw, Trash2, Search, ArrowUpDown, MessageSquare } from "lucide-react";
import Link from "next/link";
import { EMPLOYEE_META } from "@/lib/constants";
import { deleteEmployee } from "@/app/actions/employees";
import type { AIEmployee } from "@/lib/types";

const statusLabel: Record<string, string> = {
  working: "工作中",
  idle: "空闲",
  learning: "学习中",
  reviewing: "审核中",
};

const statusColor: Record<string, string> = {
  working: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  idle: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  learning: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  reviewing: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
};

interface EmployeeMarketplaceClientProps {
  employees: AIEmployee[];
  organizationId: string;
}

async function fetchEmployeesFromAPI(retries = 3): Promise<{ employees: AIEmployee[]; organizationId: string } | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch("/api/employees", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.employees && data.employees.length > 0) {
        return data;
      }
    } catch {
      // retry
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;
}

export function EmployeeMarketplaceClient({
  employees: initialEmployees,
  organizationId: initialOrgId,
}: EmployeeMarketplaceClientProps) {
  const router = useRouter();
  const [employees, setEmployees] = useState(initialEmployees);
  const [orgId, setOrgId] = useState(initialOrgId);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "performance" | "name" | "status">("default");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(initialEmployees.length === 0);
  const [retryFailed, setRetryFailed] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ dbId: string; nickname: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // If SSR returned empty data, auto-retry via client-side API
  useEffect(() => {
    if (initialEmployees.length > 0) return;
    let cancelled = false;
    (async () => {
      const data = await fetchEmployeesFromAPI();
      if (cancelled) return;
      if (data) {
        setEmployees(data.employees);
        setOrgId(data.organizationId);
        setRetryFailed(false);
      } else {
        setRetryFailed(true);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [initialEmployees]);

  const handleManualRetry = useCallback(async () => {
    setLoading(true);
    setRetryFailed(false);
    const data = await fetchEmployeesFromAPI(2);
    if (data) {
      setEmployees(data.employees);
      setOrgId(data.organizationId);
    } else {
      setRetryFailed(true);
    }
    setLoading(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    router.refresh();
    setTimeout(async () => {
      const data = await fetchEmployeesFromAPI(1);
      if (data) {
        setEmployees(data.employees);
        setOrgId(data.organizationId);
      }
    }, 500);
  }, [router]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteEmployee(deleteTarget.dbId);
      setEmployees((prev) => prev.filter((e) => e.dbId !== deleteTarget.dbId));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "删除失败，请稍后重试");
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget]);

  const filteredEmployees = useMemo(() => {
    let result = employees;

    // 状态筛选
    if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter);
    }

    // 文本搜索
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.nickname.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q)
      );
    }

    // 排序
    switch (sortBy) {
      case "performance":
        result = [...result].sort(
          (a, b) => b.stats.tasksCompleted - a.stats.tasksCompleted
        );
        break;
      case "name":
        result = [...result].sort((a, b) =>
          a.name.localeCompare(b.name, "zh-CN")
        );
        break;
      case "status": {
        const statusOrder: Record<string, number> = {
          working: 0,
          learning: 1,
          reviewing: 2,
          idle: 3,
        };
        result = [...result].sort(
          (a, b) =>
            (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
        );
        break;
      }
    }

    return result;
  }, [employees, statusFilter, searchText, sortBy]);

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        title="AI员工市场"
        description="浏览、管理和创建你的AI智能员工团队"
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Filter size={16} className="text-gray-400 dark:text-gray-500" />
          <div className="flex gap-2">
            {[
              { value: "all", label: "全部" },
              { value: "working", label: "工作中" },
              { value: "idle", label: "空闲" },
              { value: "learning", label: "学习中" },
              { value: "reviewing", label: "审核中" },
            ].map((opt) => (
              <Button
                key={opt.value}
                variant={statusFilter === opt.value ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7"
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Users size={12} className="mr-1" />
              {employees.length} 名员工
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <Input
              placeholder="搜索员工名称、昵称或职位..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-8 h-8 text-xs border-none bg-white/60 dark:bg-white/5"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={14} className="text-gray-400 dark:text-gray-500" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-8 w-[130px] text-xs border-none bg-white/60 dark:bg-white/5">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default" className="text-xs">默认排序</SelectItem>
                <SelectItem value="performance" className="text-xs">按绩效排序</SelectItem>
                <SelectItem value="name" className="text-xs">按名称排序</SelectItem>
                <SelectItem value="status" className="text-xs">按状态排序</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">正在加载员工数据...</p>
        </div>
      )}

      {/* Retry Failed State */}
      {!loading && retryFailed && employees.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">数据加载失败，请重试</p>
          <Button variant="outline" size="sm" onClick={handleManualRetry}>
            <RefreshCw size={14} className="mr-1" />
            重新加载
          </Button>
        </div>
      )}

      {/* Employee Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map((emp) => {
            const isPreset = !!(EMPLOYEE_META as Record<string, unknown>)[emp.id];
            return (
              <div key={emp.dbId} className="relative group">
                <Link href={`/employee/${emp.id}`}>
                  <GlassCard variant="interactive" padding="md" className="h-full">
                    <div className="flex items-start gap-3 mb-3">
                      <EmployeeAvatar
                        employeeId={emp.id}
                        size="md"
                        showStatus
                        status={emp.status}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">
                          {emp.nickname}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{emp.title}</p>
                        <Badge
                          className={`${statusColor[emp.status]} text-[10px] mt-1`}
                        >
                          {statusLabel[emp.status]}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic mb-3 line-clamp-2">
                      &ldquo;{emp.motto}&rdquo;
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {emp.skills.length} 项技能
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        准确率 {emp.stats.accuracy}%
                      </span>
                    </div>
                  </GlassCard>
                </Link>
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    href={`/chat?employee=${emp.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-500 dark:text-blue-400 border-none"
                    title="对话"
                  >
                    <MessageSquare size={14} />
                  </Link>
                  {!isPreset && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteError(null);
                        setDeleteTarget({ dbId: emp.dbId, nickname: emp.nickname });
                      }}
                      className="p-1.5 rounded-md bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 dark:text-red-400 border-none"
                      title="删除员工"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Create Custom Employee Card */}
          <GlassCard
            variant="interactive"
            padding="md"
            className="flex flex-col items-center justify-center min-h-[180px] border-dashed border-2 border-blue-200/50 dark:border-blue-700/30"
          >
            <button
              onClick={() => setCreateOpen(true)}
              className="flex flex-col items-center gap-2 w-full h-full justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
                <Plus size={24} className="text-blue-500" />
              </div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                创建自定义员工
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                按照你的需求定制专属AI员工
              </p>
            </button>
          </GlassCard>
        </div>
      )}

      <EmployeeCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={orgId}
        onSuccess={handleCreateSuccess}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="删除员工"
        description={
          deleteError
            ? deleteError
            : `确认删除员工「${deleteTarget?.nickname}」？删除后该员工的所有技能绑定将一并移除，此操作不可恢复。`
        }
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
