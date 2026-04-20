"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as LucideIcons from "lucide-react";
import {
  Plus,
  Target,
  CheckCircle,
  XCircle,
  Loader2,
  Crown,
  MessageSquare,
  Filter,
  ArrowRight,
  Clock,
  Zap,
  CircleDot,
  ChevronDown,
  ChevronRight,
  Search,
  FileText,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/shared/search-input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startMission, deleteMissions } from "@/app/actions/missions";
import {
  ORDERED_CATEGORIES,
  CATEGORY_LABELS,
  EMPLOYEE_META,
  type EmployeeId,
  type OrderedCategory,
} from "@/lib/constants";
import { getLegacyTemplateInstruction } from "@/lib/scenario-fallback";
import { templateToScenarioSlug } from "@/lib/workflow-template-slug";
import type { MissionSummary } from "@/lib/dal/missions";
import type { WorkflowTemplateRow } from "@/db/types";
import { cn } from "@/lib/utils";

/**
 * B.1 Unified Scenario Workflow: resolve a Lucide icon by its string name (as
 * stored in `workflow_templates.icon`). Falls back to `FileText` for unknown
 * names or null. Mirrors the helper in `components/home/scenario-grid.tsx`.
 */
function resolveLucideIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return FileText;
  const maybe = (LucideIcons as unknown as Record<string, LucideIcon>)[iconName];
  return maybe ?? FileText;
}

// ── Source module labels ────────────────────────────────────
const SOURCE_MODULE_LABEL: Record<string, { label: string; cls: string }> = {
  hot_topics:   { label: "灵感雷达", cls: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" },
  publishing:   { label: "全渠道发布", cls: "bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400" },
  benchmarking: { label: "对标监控", cls: "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400" },
  analytics:    { label: "数据分析", cls: "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400" },
  creation:     { label: "超级创作", cls: "bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400" },
  inspiration:  { label: "热点发现", cls: "bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400" },
};

// ── Status config ───────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  queued:        { label: "排队中", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
  planning:      { label: "规划中", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  executing:     { label: "执行中", color: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400" },
  consolidating: { label: "协调中", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  completed:     { label: "已完成", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  failed:        { label: "异常",   color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  cancelled:     { label: "已取消", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
};

const PHASE_LABEL: Record<string, string> = {
  queued: "排队中", planning: "任务规划", executing: "并行执行", consolidating: "协调收口",
  completed: "已交付", failed: "异常中断", cancelled: "已取消",
};

const PHASES = ["组队", "拆解", "执行", "协调", "交付"];

const PROGRESS_CLASS: Record<string, string> = {
  queued: "bg-gray-400", planning: "bg-amber-500", executing: "bg-cyan-500", consolidating: "bg-blue-500",
  completed: "bg-emerald-500", failed: "bg-red-500", cancelled: "bg-gray-400",
};

type FilterKey = "all" | "running" | "done" | "error" | "queued";

function statusToFilter(s: string): FilterKey {
  if (s === "executing" || s === "consolidating") return "running";
  if (s === "completed") return "done";
  if (s === "failed") return "error";
  if (s === "queued" || s === "planning") return "queued";
  return "all";
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getPhaseIndex(status: string, hasTasks: boolean): number {
  switch (status) {
    case "queued": return 0;
    case "planning": return hasTasks ? 2 : 1;
    case "executing": return 3;
    case "consolidating": return 4;
    case "completed": return 6;
    case "failed": return 3;
    default: return 0;
  }
}

// ── Main Component ──────────────────────────────────────────

export function MissionsClient({
  missions,
  workflows,
}: {
  missions: MissionSummary[];
  /**
   * B.1 Unified Scenario Workflow: workflow_templates rows for this org. The
   * "发起新任务" Sheet iterates this list grouped by `category` as the single
   * source of truth. Replaces the prior SCENARIO_CONFIG / SCENARIO_CATEGORIES
   * hardcoded iteration. Mission row rendering still uses resolveScenarioConfig
   * (Task 14) for legacy slugs / custom fallback.
   */
  workflows: WorkflowTemplateRow[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchText, setSearchText] = useState("");
  const [scenarioFilter, setScenarioFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Batch delete state (preserved from main 72b6788) ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // ── Workflow grouping (B.1 Task 18) ──
  const workflowsByCategory = useMemo(() => {
    return workflows.reduce((acc, wf) => {
      const c = (wf.category ?? "custom") as OrderedCategory;
      (acc[c] ??= []).push(wf);
      return acc;
    }, {} as Partial<Record<OrderedCategory, WorkflowTemplateRow[]>>);
  }, [workflows]);

  const activeCategoryTabs = useMemo(() => {
    return ORDERED_CATEGORIES.filter(
      (c) => (workflowsByCategory[c]?.length ?? 0) > 0,
    );
  }, [workflowsByCategory]);

  // Sheet creation
  const [sheetOpen, setSheetOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTemplateRow | null>(
    null,
  );
  const [scenarioCategory, setScenarioCategory] = useState<OrderedCategory>("news");
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");

  // Keep the active tab in sync with available categories — if "news" has no
  // workflows for this org, snap to the first tab that does.
  useEffect(() => {
    if (
      activeCategoryTabs.length > 0 &&
      !activeCategoryTabs.includes(scenarioCategory)
    ) {
      setScenarioCategory(activeCategoryTabs[0]);
    }
  }, [activeCategoryTabs, scenarioCategory]);

  // Auto-refresh
  const hasActive = missions.some((m) =>
    ["queued", "planning", "executing", "consolidating"].includes(m.status)
  );
  useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [hasActive, router]);

  // Stats
  const stats = useMemo(() => ({
    total: missions.length,
    running: missions.filter((m) => ["executing", "consolidating"].includes(m.status)).length,
    done: missions.filter((m) => m.status === "completed").length,
    error: missions.filter((m) => m.status === "failed").length,
    queued: missions.filter((m) => m.status === "queued" || m.status === "planning").length,
  }), [missions]);

  // Filter
  const filtered = useMemo(() => {
    let list = missions;
    if (filter !== "all") list = list.filter((m) => statusToFilter(m.status) === filter);
    if (searchText) list = list.filter((m) => m.title.toLowerCase().includes(searchText.toLowerCase()));
    if (scenarioFilter !== "all") list = list.filter((m) => m.scenario === scenarioFilter);
    return list;
  }, [missions, filter, searchText, scenarioFilter]);

  // Paginated view
  const visibleMissions = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  // Reset visible count when filter changes
  useEffect(() => { setVisibleCount(20); }, [filter, searchText, scenarioFilter]);

  // Missions that can be deleted — matches the server-side `deleteMissions`
  // enforcement. `queued` / `planning` are allowed because they often get
  // stuck without progressing. Actively running statuses (`executing`,
  // `consolidating`, `coordinating`) still require an explicit cancel first.
  const deletableStatuses = ["completed", "failed", "cancelled", "queued", "planning"];
  const deletableVisibleIds = useMemo(
    () => visibleMissions.filter((m) => deletableStatuses.includes(m.status)).map((m) => m.id),
    [visibleMissions],
  );
  const allVisibleSelected =
    deletableVisibleIds.length > 0 &&
    deletableVisibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    deletableVisibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  // Drop selections that no longer exist (e.g. after a delete or filter change).
  useEffect(() => {
    const existing = new Set(filtered.map((m) => m.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (existing.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of deletableVisibleIds) next.delete(id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of deletableVisibleIds) next.add(id);
        return next;
      });
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await deleteMissions(ids);
      if (result.deletedCount > 0) {
        toast.success(`已删除 ${result.deletedCount} 个任务`);
      }
      if (result.skipped.length > 0) {
        toast.warning(`${result.skipped.length} 个任务已跳过（运行中或无权限）`);
      }
      // Close dialog and refresh. We intentionally do NOT clearSelection()
      // here — the selectedIds drop effect prunes no-longer-existing IDs
      // once `router.refresh()` delivers the new list, so the floating
      // bar and rows disappear in the same frame instead of two jarring
      // beats ("bar vanishes → rows vanish").
      setDeleteConfirmOpen(false);
      router.refresh();
      // Keep `deleting=true` until the dialog's exit animation has played
      // out. Otherwise the confirm button flashes from "删除中..." back to
      // "确认删除" while the dialog fades, which reads as a flicker.
      window.setTimeout(() => setDeleting(false), 200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
      setDeleting(false);
    }
  }

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 20);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  // Create — B.1 dual-write scenario slug + workflowTemplateId
  async function handleCreate() {
    if (!title.trim() || !instruction.trim() || !selectedWorkflow) return;
    setCreating(true);
    try {
      await startMission({
        title: title.trim() || selectedWorkflow.name,
        scenario: templateToScenarioSlug(selectedWorkflow),
        workflowTemplateId: selectedWorkflow.id,
        userInstruction: instruction.trim(),
      });
      setSheetOpen(false);
      resetForm();
      router.refresh();
    } catch {
      /* noop */
    } finally {
      setCreating(false);
    }
  }
  function resetForm() {
    setSelectedWorkflow(null);
    setScenarioCategory(activeCategoryTabs[0] ?? "news");
    setTitle("");
    setInstruction("");
  }
  function pickWorkflow(wf: WorkflowTemplateRow) {
    setSelectedWorkflow(wf);
    // Pre-fill instruction from the legacy template-instruction helper when
    // the workflow maps to a builtin scenario key. Custom workflows leave the
    // field blank. Phase 3 can remove the helper + underlying constant in one
    // place (src/lib/scenario-fallback.ts).
    const preset = getLegacyTemplateInstruction(wf.legacyScenarioKey);
    if (preset) setInstruction(preset);
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <PageHeader
        title="任务中心"
        description="AI 多智能体协作工作台 — 队长智能调度，多 Agent 并行执行"
        actions={
          <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) resetForm(); }}>
            <SheetTrigger asChild>
              <Button className="gap-2"><Plus size={16} />新建任务</Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto p-0">
              <div className="px-8 pt-8 pb-6"><SheetHeader><SheetTitle className="text-xl">发起新任务</SheetTitle></SheetHeader></div>
              <div className="px-8 pb-8">
                {!selectedWorkflow ? (
                  <div className="space-y-5">
                    <p className="text-sm text-gray-500 dark:text-gray-400">选择任务场景，系统将自动匹配最佳团队配置</p>
                    {activeCategoryTabs.length === 0 ? (
                      <div className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
                        暂无可用的工作流，请先到「工作流」页面创建或启用内置模板。
                      </div>
                    ) : (
                      <Tabs
                        value={scenarioCategory}
                        onValueChange={(v) => setScenarioCategory(v as OrderedCategory)}
                      >
                        <TabsList variant="line" className="w-full">
                          {activeCategoryTabs.map((c) => (
                            <TabsTrigger key={c} value={c} className="flex-1">
                              {CATEGORY_LABELS[c]}
                              <span className="ml-1 text-[10px] text-gray-400">
                                ({workflowsByCategory[c]?.length ?? 0})
                              </span>
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        {activeCategoryTabs.map((c) => (
                          <TabsContent key={c} value={c} className="mt-4">
                            <div className="grid grid-cols-2 gap-4">
                              {(workflowsByCategory[c] ?? []).map((wf) => {
                                const Icon = resolveLucideIcon(wf.icon);
                                const team = (wf.defaultTeam ?? []) as EmployeeId[];
                                return (
                                  <button
                                    key={wf.id}
                                    type="button"
                                    onClick={() => pickWorkflow(wf)}
                                    className="glass-card-interactive p-5 text-left rounded-2xl transition-all hover:scale-[1.02] border-0"
                                  >
                                    <div className="flex items-center gap-3 mb-3">
                                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/10">
                                        <Icon size={18} className="text-indigo-500" />
                                      </div>
                                      <span className="font-medium text-gray-900 dark:text-gray-100">
                                        {wf.name}
                                      </span>
                                    </div>
                                    {wf.description && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed line-clamp-2">
                                        {wf.description}
                                      </p>
                                    )}
                                    {team.length > 0 && (
                                      <div className="flex items-center gap-1.5">
                                        <Crown size={10} className="text-rose-400" />
                                        {team.slice(0, 4).map((e) => (
                                          <EmployeeAvatar key={e} employeeId={e} size="xs" />
                                        ))}
                                        {team.length > 4 && (
                                          <span className="text-[10px] text-gray-400 ml-0.5">
                                            +{team.length - 4}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      const Icon = resolveLucideIcon(selectedWorkflow.icon);
                      return (
                        <button
                          type="button"
                          onClick={() => setSelectedWorkflow(null)}
                          className="flex items-center gap-4 w-full text-left glass-card p-4 rounded-xl border-0"
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-indigo-500/10">
                            <Icon size={22} className="text-indigo-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <CheckCircle size={14} className="text-emerald-400" />
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {selectedWorkflow.name}
                              </span>
                            </div>
                            {selectedWorkflow.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                {selectedWorkflow.description}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">点击更换</span>
                        </button>
                      );
                    })()}
                    <div className="space-y-2">
                      <label className="text-sm font-medium block text-gray-700 dark:text-gray-300">
                        任务标题
                      </label>
                      <Input
                        placeholder="例：两会热点追踪与深度报道"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="glass-input h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium block text-gray-700 dark:text-gray-300">
                        任务说明
                      </label>
                      <Textarea
                        placeholder="详细描述你希望团队完成的任务..."
                        rows={6}
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        className="glass-input"
                      />
                    </div>
                    {((selectedWorkflow.defaultTeam ?? []) as EmployeeId[]).length > 0 && (
                      <div className="space-y-3">
                        <label className="text-sm font-medium block text-gray-700 dark:text-gray-300">
                          参与团队
                        </label>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-100 dark:bg-rose-900/20 text-xs">
                            <EmployeeAvatar employeeId="leader" size="xs" />
                            <span>小领</span>
                            <span className="text-gray-400">队长</span>
                          </div>
                          {((selectedWorkflow.defaultTeam ?? []) as EmployeeId[]).map((e) => {
                            const m = EMPLOYEE_META[e];
                            return (
                              <div
                                key={e}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs"
                              >
                                <EmployeeAvatar employeeId={e} size="xs" />
                                <span>{m?.nickname ?? e}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <Button
                        className="w-full gap-2 h-11"
                        onClick={handleCreate}
                        disabled={creating || !title.trim() || !instruction.trim()}
                      >
                        {creating ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Crown size={16} />
                        )}
                        {creating ? "正在创建..." : "提交任务"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        }
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {([
          { value: stats.total, label: "总任务", cls: "text-gray-800 dark:text-gray-100" },
          { value: stats.running, label: "执行中", cls: "text-cyan-600 dark:text-cyan-400" },
          { value: stats.done, label: "已完成", cls: "text-emerald-600 dark:text-emerald-400" },
          { value: stats.error, label: "异常", cls: "text-red-600 dark:text-red-400" },
          { value: stats.queued, label: "排队中", cls: "text-gray-500 dark:text-gray-400" },
        ]).map((s) => (
          <GlassCard key={s.label} padding="sm" className="text-center">
            <p className={cn("text-2xl font-bold font-mono", s.cls)}>{s.value}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
          </GlassCard>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Filter size={16} className="text-gray-400 dark:text-gray-500" />
        <div className="flex gap-2">
          {([
            { key: "all" as FilterKey, label: "全部", count: stats.total },
            { key: "running" as FilterKey, label: "执行中", count: stats.running },
            { key: "done" as FilterKey, label: "已完成", count: stats.done },
            { key: "error" as FilterKey, label: "异常", count: stats.error },
            { key: "queued" as FilterKey, label: "排队中", count: stats.queued },
          ]).map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="opacity-50">({f.count})</span>
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <SearchInput
            className="w-40"
            placeholder="搜索任务..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select value={scenarioFilter} onValueChange={setScenarioFilter}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue placeholder="全部场景" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部场景</SelectItem>
              {/* Phase 4A: iterate over org workflow templates (single source of
                  truth). The filter value is the scenario slug that
                  `templateToScenarioSlug` writes into `mission.scenario`. */}
              {workflows.map((wf) => (
                <SelectItem key={wf.id} value={templateToScenarioSlug(wf)}>
                  {wf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Mission Table ── */}
      {filtered.length === 0 ? (
        <GlassCard className="p-16 text-center">
          <Target size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">没有匹配的任务</p>
        </GlassCard>
      ) : (
        <GlassCard variant="panel" padding="none">
          {/* Table header */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-gray-200/60 dark:border-gray-700/40">
            <div className="w-6 shrink-0 flex items-center">
              <Checkbox
                checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                onCheckedChange={toggleSelectAllVisible}
                disabled={deletableVisibleIds.length === 0}
                aria-label="全选当前页可删除任务"
              />
            </div>
            <div className="w-4 shrink-0" />
            <div className="w-16 text-sm font-semibold text-gray-600 dark:text-gray-400">状态</div>
            <div className="flex-1 text-sm font-semibold text-gray-600 dark:text-gray-400">任务名称</div>
            <div className="w-20 text-sm font-semibold text-gray-600 dark:text-gray-400">场景</div>
            <div className="w-28 text-sm font-semibold text-gray-600 dark:text-gray-400">进度</div>
            <div className="w-20 text-sm font-semibold text-gray-600 dark:text-gray-400">阶段</div>
            <div className="w-28 text-sm font-semibold text-gray-600 dark:text-gray-400">团队</div>
            <div className="w-16 text-sm font-semibold text-gray-600 dark:text-gray-400">子任务</div>
            <div className="w-12 text-sm font-semibold text-gray-600 dark:text-gray-400">消息</div>
            <div className="w-52 text-sm font-semibold text-gray-600 dark:text-gray-400">最新动态</div>
          </div>

          {/* Table body */}
          {visibleMissions.map((m) => (
            <MissionRow
              key={m.id}
              mission={m}
              isExpanded={expandedId === m.id}
              onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
              selected={selectedIds.has(m.id)}
              selectable={deletableStatuses.includes(m.status)}
              onToggleSelect={() => toggleSelectOne(m.id)}
            />
          ))}

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-4 text-xs text-gray-400 dark:text-gray-500">
              <Loader2 size={14} className="animate-spin mr-2" />
              加载更多...
            </div>
          )}
        </GlassCard>
      )}

      {/* Floating batch-action bar — rendered via portal to `document.body`
          because the dashboard layout has ancestors with `backdrop-filter`
          (creates a containing block and traps `position: fixed` inside the
          scrolling page, making the bar scroll away). A portal moves it out
          of that containing block entirely so it truly sticks to the
          viewport bottom. */}
      {selectedIds.size > 0 && typeof window !== "undefined" &&
        createPortal(
          <div
            className="!fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl glass-float shadow-lg"
          >
            <span className="text-sm text-gray-700 dark:text-gray-200">
              已选 <span className="font-semibold">{selectedIds.size}</span> 个任务
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleting}
            >
              <Trash2 size={14} className="mr-1" />
              批量删除
            </Button>
          </div>,
          document.body,
        )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除所选任务？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除 {selectedIds.size} 个任务及其下的子任务、消息、产出物。
              此操作不可恢复。运行中的任务会被自动跳过。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleBatchDelete();
              }}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 size={14} className="mr-1 animate-spin" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Mission Row ─────────────────────────────────────────────

function MissionRow({
  mission: m,
  isExpanded,
  onToggle,
  selected,
  selectable,
  onToggleSelect,
}: {
  mission: MissionSummary;
  isExpanded: boolean;
  onToggle: () => void;
  selected: boolean;
  selectable: boolean;
  onToggleSelect: () => void;
}) {
  const sc = STATUS_CFG[m.status] ?? STATUS_CFG.planning;
  const isDone = ["completed", "failed", "cancelled"].includes(m.status);
  const progressPct = m.status === "completed" ? 100
    : m.totalTaskCount > 0 ? Math.round((m.completedTaskCount / m.totalTaskCount) * 100) : 0;
  const progressCls = PROGRESS_CLASS[m.status] ?? "bg-gray-400";
  const skippedCount = isDone ? m.totalTaskCount - m.completedTaskCount - m.inProgressTaskCount : 0;
  // Phase 4A: scenario display label comes from server-resolved
  // `m.scenarioLabel` (see `MissionSummary`). Color/bgColor are not stored on
  // `workflow_templates` — fall back to a neutral tint here. (Phase 3 may
  // migrate palette data into the DB; for now this keeps the pill visible.)
  const scLabel = m.scenarioLabel || m.scenario;
  const isActive = ["executing", "consolidating"].includes(m.status);

  // Extract error message from finalOutput for failed missions
  const errorInfo = m.status === "failed" && m.finalOutput && typeof m.finalOutput === "object"
    ? (m.finalOutput as { error?: boolean; message?: string })
    : null;

  const fromMeta = m.latestActivityFromSlug ? EMPLOYEE_META[m.latestActivityFromSlug as EmployeeId] : null;
  const activity = m.latestActivityText
    ? `${fromMeta?.nickname ?? ""}: ${m.latestActivityText}`
    : m.status === "queued" ? "等待资源分配..."
    : m.status === "planning" ? "任务规划中..."
    : errorInfo?.message ? errorInfo.message
    : null;

  return (
    <div className={cn(
      "border-b border-gray-100/60 dark:border-gray-800/40 last:border-b-0 transition-colors duration-200",
      isExpanded && "bg-gray-50/50 dark:bg-gray-800/20",
      selected && "bg-sky-50/40 dark:bg-sky-900/10",
    )}>
      {/* Row — split into two sibling elements so the checkbox lives outside
          the expand-toggle <button>. Nested interactive elements are invalid
          HTML and break clicks. */}
      <div className="flex items-stretch">
        {/* Checkbox cell — <label> wraps Checkbox so the whole cell is a
            large click target that Radix auto-forwards to the Checkbox
            primitive. */}
        <label
          className={cn(
            "w-10 shrink-0 pl-5 flex items-center",
            selectable ? "cursor-pointer" : "cursor-not-allowed pointer-events-none",
          )}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            disabled={!selectable}
            aria-label={selectable ? "选中任务" : "运行中的任务不能删除"}
          />
        </label>

        {/* Clickable row body */}
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 pl-2 pr-5 py-3.5 text-left hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors"
        >
          {/* Chevron */}
          <div className="w-4 shrink-0 flex items-center justify-center">
          <ChevronRight
            size={14}
            className={cn(
              "text-gray-400 dark:text-gray-500 transition-transform duration-200 ease-out",
              isExpanded && "rotate-90"
            )}
          />
        </div>

        {/* Status */}
        <div className="w-16 shrink-0">
          <Badge className={cn("text-[10px] font-semibold gap-1 px-2 py-0.5", sc.color)}>
            {(isActive || m.status === "planning") && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
            {sc.label}
          </Badge>
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{m.title}</p>
            {m.sourceModule && SOURCE_MODULE_LABEL[m.sourceModule] && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0", SOURCE_MODULE_LABEL[m.sourceModule].cls)}>
                {SOURCE_MODULE_LABEL[m.sourceModule].label}
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(m.createdAt)}</p>
        </div>

        {/* Scenario */}
        <div className="w-20 shrink-0">
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            {scLabel}
          </span>
        </div>

        {/* Progress */}
        <div className="w-28 shrink-0 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700/50 overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-500", progressCls)} style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs font-mono font-semibold text-gray-600 dark:text-gray-300 w-8 text-right">{progressPct}%</span>
        </div>

        {/* Phase */}
        <div className="w-20 shrink-0">
          <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
            {PHASE_LABEL[m.status] ?? m.status}
          </span>
        </div>

        {/* Team */}
        <div className="w-28 shrink-0 overflow-hidden">
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1.5 shrink-0">
              {m.teamSlugs.slice(0, 4).map((slug) => (
                <EmployeeAvatar key={slug} employeeId={slug} size="xs" />
              ))}
            </div>
            {m.teamSlugs.length > 0 && <span className="text-[10px] text-gray-400 whitespace-nowrap">{m.teamSlugs.length}人</span>}
            {m.teamSlugs.length === 0 && <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>}
          </div>
        </div>

        {/* Subtasks */}
        <div className="w-16 shrink-0">
          {m.totalTaskCount > 0 ? (
            <span className="text-xs font-mono">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{m.completedTaskCount}</span>
              <span className="text-gray-400"> / </span>
              <span className="text-gray-600 dark:text-gray-300">{isDone ? m.completedTaskCount : m.totalTaskCount}</span>
            </span>
          ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
        </div>

        {/* Messages */}
        <div className="w-12 shrink-0">
          {m.messageCount > 0 ? (
            <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
              <MessageSquare size={11} />{m.messageCount}
            </span>
          ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
        </div>

        {/* Activity */}
        <div className="w-52 shrink-0 min-w-0">
          {activity ? (
            <>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{activity}</p>
              {m.latestActivityTime && <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">{relativeTime(m.latestActivityTime)}</p>}
            </>
          ) : <span className="text-gray-300 dark:text-gray-600 text-[11px]">—</span>}
        </div>
        </button>
      </div>

      {/* Expanded panel — CSS grid height transition (no layout jitter) */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className={cn(
          "overflow-hidden transition-opacity duration-200",
          isExpanded ? "opacity-100" : "opacity-0"
        )}>
          <div className="px-5 pb-4 pt-1">
              <div className="relative grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-6 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 overflow-hidden">
                <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-blue-400/60 dark:bg-blue-500/40" />
                {/* Phase pipeline */}
                <div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">任务阶段</p>
                  <div className="flex items-center">
                    {PHASES.map((p, i) => {
                      const idx = i + 1;
                      const phaseIdx = getPhaseIndex(m.status, m.totalTaskCount > 0);
                      const isDone = m.status === "completed" || idx < phaseIdx;
                      const isPhaseActive = m.status !== "completed" && idx === phaseIdx;
                      const isErr = m.status === "failed" && isPhaseActive;
                      return (
                        <div key={p} className="flex items-center gap-1">
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0",
                            isErr ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                            : isDone ? "bg-emerald-500"
                            : isPhaseActive ? "bg-cyan-500 shadow-[0_0_8px_rgba(0,212,255,0.4)]"
                            : "bg-gray-300 dark:bg-gray-600"
                          )}>
                            {isDone ? "✓" : isErr ? "!" : idx}
                          </div>
                          <span className={cn(
                            "text-[10px] whitespace-nowrap",
                            isDone || isPhaseActive ? "text-gray-700 dark:text-gray-200" : "text-gray-400 dark:text-gray-500"
                          )}>{p}</span>
                          {i < 4 && <span className={cn("w-4 h-0.5 rounded mx-0.5", isDone ? "bg-emerald-400" : "bg-gray-200 dark:bg-gray-700")} />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Subtask distribution */}
                <div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">子任务分布</p>
                  {m.totalTaskCount > 0 ? (
                    <>
                      <div className="flex h-2 rounded-full overflow-hidden gap-0.5 bg-gray-200/60 dark:bg-gray-700/30">
                        {isDone ? (
                          <div className="bg-emerald-500 rounded-full w-full" />
                        ) : (<>
                          {m.completedTaskCount > 0 && <div className="bg-emerald-500 rounded-full" style={{ flex: m.completedTaskCount }} />}
                          {m.inProgressTaskCount > 0 && <div className="bg-cyan-500 rounded-full" style={{ flex: m.inProgressTaskCount }} />}
                          {(m.totalTaskCount - m.completedTaskCount - m.inProgressTaskCount) > 0 && <div className="bg-gray-300 dark:bg-gray-600 rounded-full" style={{ flex: m.totalTaskCount - m.completedTaskCount - m.inProgressTaskCount }} />}
                        </>)}
                      </div>
                      <div className="flex gap-3 mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />已完成 {m.completedTaskCount}</span>
                        {!isDone && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />执行中 {m.inProgressTaskCount}</span>}
                        {!isDone && (m.totalTaskCount - m.completedTaskCount - m.inProgressTaskCount) > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />等待 {m.totalTaskCount - m.completedTaskCount - m.inProgressTaskCount}</span>}
                        {isDone && skippedCount > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-300/50 dark:bg-gray-700/50" />已跳过 {skippedCount}</span>}
                      </div>
                    </>
                  ) : <span className="text-[11px] text-gray-300 dark:text-gray-600">—</span>}
                </div>

                {/* Team members */}
                <div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">团队成员</p>
                  <div className="flex flex-wrap gap-2">
                    {m.teamSlugs.map((slug, i) => {
                      const meta = EMPLOYEE_META[slug as EmployeeId];
                      if (!meta) return null;
                      return (
                        <div key={slug} className="flex items-center gap-1.5">
                          <EmployeeAvatar employeeId={slug} size="xs" />
                          <span className="text-xs font-medium" style={{ color: meta.color }}>{meta.nickname}</span>
                          {i === 0 && <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 font-bold text-rose-500 dark:text-rose-400">Leader</Badge>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action */}
                <div className="flex items-end justify-end">
                  <Link href={`/missions/${m.id}`}>
                    <Button variant="ghost" className="gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                      进入任务详情
                      <ArrowRight size={14} />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Error details for failed missions */}
              {errorInfo?.message && (
                <div className="mt-3 p-3 rounded-lg bg-red-50/80 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30">
                  <div className="flex items-start gap-2">
                    <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-red-700 dark:text-red-400">异常原因</p>
                      <p className="text-[11px] text-red-600/80 dark:text-red-400/70 mt-0.5">{errorInfo.message}</p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
