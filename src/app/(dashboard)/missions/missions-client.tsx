"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startMission } from "@/app/actions/missions";
import {
  SCENARIO_CONFIG,
  SCENARIO_CATEGORIES,
  EMPLOYEE_META,
  type EmployeeId,
} from "@/lib/constants";
import type { MissionSummary } from "@/lib/dal/missions";
import { cn } from "@/lib/utils";

// ── Source module labels ────────────────────────────────────
const SOURCE_MODULE_LABEL: Record<string, { label: string; cls: string }> = {
  hot_topics:   { label: "灵感雷达", cls: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" },
  publishing:   { label: "全渠道发布", cls: "bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400" },
  benchmarking: { label: "对标监控", cls: "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400" },
  analytics:    { label: "数据分析", cls: "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400" },
  creation:     { label: "超级创作", cls: "bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400" },
  inspiration:  { label: "灵感池", cls: "bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400" },
};

// ── Status config ───────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  planning:      { label: "排队中", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
  executing:     { label: "执行中", color: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400" },
  consolidating: { label: "协调中", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  completed:     { label: "已完成", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  failed:        { label: "异常",   color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  cancelled:     { label: "已取消", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
};

const PHASE_LABEL: Record<string, string> = {
  planning: "排队中", executing: "并行执行", consolidating: "协调收口",
  completed: "已交付", failed: "异常中断", cancelled: "已取消",
};

const PHASES = ["组队", "拆解", "执行", "协调", "交付"];

const PROGRESS_CLASS: Record<string, string> = {
  planning: "bg-gray-400", executing: "bg-cyan-500", consolidating: "bg-blue-500",
  completed: "bg-emerald-500", failed: "bg-red-500", cancelled: "bg-gray-400",
};

type FilterKey = "all" | "running" | "done" | "error" | "queued";

function statusToFilter(s: string): FilterKey {
  if (s === "executing" || s === "consolidating") return "running";
  if (s === "completed") return "done";
  if (s === "failed") return "error";
  if (s === "planning") return "queued";
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
}: {
  missions: MissionSummary[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchText, setSearchText] = useState("");
  const [scenarioFilter, setScenarioFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Sheet creation
  const [sheetOpen, setSheetOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [scenarioCategory, setScenarioCategory] = useState("news");
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");

  // Auto-refresh
  const hasActive = missions.some((m) =>
    ["planning", "executing", "consolidating"].includes(m.status)
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
    queued: missions.filter((m) => m.status === "planning").length,
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

  // Create
  async function handleCreate() {
    if (!title.trim() || !instruction.trim() || !selectedScenario) return;
    setCreating(true);
    try {
      await startMission({ title: title.trim(), scenario: selectedScenario, userInstruction: instruction.trim() });
      setSheetOpen(false);
      resetForm();
      router.refresh();
    } catch { /* noop */ } finally { setCreating(false); }
  }
  function resetForm() { setSelectedScenario(null); setScenarioCategory("news"); setTitle(""); setInstruction(""); }
  function pickScenario(key: string) {
    setSelectedScenario(key);
    const cfg = SCENARIO_CONFIG[key];
    if (cfg?.templateInstruction) setInstruction(cfg.templateInstruction);
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
                {!selectedScenario ? (
                  <div className="space-y-5">
                    <p className="text-sm text-gray-500 dark:text-gray-400">选择任务场景，系统将自动匹配最佳团队配置</p>
                    <Tabs value={scenarioCategory} onValueChange={setScenarioCategory}>
                      <TabsList className="w-full">
                        {SCENARIO_CATEGORIES.map((cat) => { const I = cat.icon; return <TabsTrigger key={cat.key} value={cat.key} className="gap-1.5 flex-1"><I size={14} />{cat.label}</TabsTrigger>; })}
                      </TabsList>
                    </Tabs>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(SCENARIO_CONFIG).filter(([, c]) => c.category === scenarioCategory).map(([k, c]) => {
                        const I = c.icon;
                        return (
                          <button key={k} onClick={() => pickScenario(k)} className="glass-card-interactive p-5 text-left rounded-2xl transition-all hover:scale-[1.02]">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: c.bgColor }}><I size={18} style={{ color: c.color }} /></div>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{c.label}</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">{c.description}</p>
                            {c.defaultTeam.length > 0 && <div className="flex items-center gap-1.5"><Crown size={10} className="text-rose-400" />{c.defaultTeam.slice(0, 4).map((e) => <EmployeeAvatar key={e} employeeId={e} size="xs" />)}{c.defaultTeam.length > 4 && <span className="text-[10px] text-gray-400 ml-0.5">+{c.defaultTeam.length - 4}</span>}</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <button onClick={() => setSelectedScenario(null)} className="flex items-center gap-4 w-full text-left glass-card p-4 rounded-xl">
                      {(() => { const c = SCENARIO_CONFIG[selectedScenario]; const I = c.icon; return (<><div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: c.bgColor }}><I size={22} style={{ color: c.color }} /></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><CheckCircle size={14} className="text-emerald-400" /><span className="font-medium text-gray-900 dark:text-gray-100">{c.label}</span></div><p className="text-xs text-gray-500 dark:text-gray-400">{c.description}</p></div><span className="text-xs text-gray-400 shrink-0">点击更换</span></>); })()}
                    </button>
                    <div className="space-y-2"><label className="text-sm font-medium block text-gray-700 dark:text-gray-300">任务标题</label><Input placeholder="例：两会热点追踪与深度报道" value={title} onChange={(e) => setTitle(e.target.value)} className="glass-input h-11" /></div>
                    <div className="space-y-2"><label className="text-sm font-medium block text-gray-700 dark:text-gray-300">任务说明</label><Textarea placeholder="详细描述你希望团队完成的任务..." rows={6} value={instruction} onChange={(e) => setInstruction(e.target.value)} className="glass-input" /></div>
                    {SCENARIO_CONFIG[selectedScenario]?.defaultTeam.length > 0 && (
                      <div className="space-y-3"><label className="text-sm font-medium block text-gray-700 dark:text-gray-300">参与团队</label><div className="flex items-center gap-2.5 flex-wrap"><div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-100 dark:bg-rose-900/20 text-xs"><EmployeeAvatar employeeId="leader" size="xs" /><span>小领</span><span className="text-gray-400">队长</span></div>{SCENARIO_CONFIG[selectedScenario].defaultTeam.map((e) => { const m = EMPLOYEE_META[e]; return <div key={e} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs"><EmployeeAvatar employeeId={e} size="xs" /><span>{m?.nickname}</span></div>; })}</div></div>
                    )}
                    <div className="pt-2"><Button className="w-full gap-2 h-11" onClick={handleCreate} disabled={creating || !title.trim() || !instruction.trim()}>{creating ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}{creating ? "正在创建..." : "提交任务"}</Button></div>
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
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <Input
              placeholder="搜索任务..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="glass-input h-7 pl-8 w-40 text-xs"
            />
          </div>
          <Select value={scenarioFilter} onValueChange={setScenarioFilter}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue placeholder="全部场景" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部场景</SelectItem>
              {Object.entries(SCENARIO_CONFIG).map(([k, c]) => (
                <SelectItem key={k} value={k}>{c.label}</SelectItem>
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
            <div className="w-4 shrink-0" />
            <div className="w-16 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">状态</div>
            <div className="flex-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">任务名称</div>
            <div className="w-20 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">场景</div>
            <div className="w-28 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">进度</div>
            <div className="w-20 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">阶段</div>
            <div className="w-28 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">团队</div>
            <div className="w-16 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">子任务</div>
            <div className="w-12 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">消息</div>
            <div className="w-52 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">最新动态</div>
          </div>

          {/* Table body */}
          {visibleMissions.map((m) => (
            <MissionRow
              key={m.id}
              mission={m}
              isExpanded={expandedId === m.id}
              onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
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
    </div>
  );
}

// ── Mission Row ─────────────────────────────────────────────

function MissionRow({
  mission: m,
  isExpanded,
  onToggle,
}: {
  mission: MissionSummary;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const sc = STATUS_CFG[m.status] ?? STATUS_CFG.planning;
  const isDone = ["completed", "failed", "cancelled"].includes(m.status);
  const progressPct = m.status === "completed" ? 100
    : m.totalTaskCount > 0 ? Math.round((m.completedTaskCount / m.totalTaskCount) * 100) : 0;
  const progressCls = PROGRESS_CLASS[m.status] ?? "bg-gray-400";
  const skippedCount = isDone ? m.totalTaskCount - m.completedTaskCount - m.inProgressTaskCount : 0;
  const scCfg = SCENARIO_CONFIG[m.scenario];
  const isActive = ["executing", "consolidating"].includes(m.status);

  const fromMeta = m.latestActivityFromSlug ? EMPLOYEE_META[m.latestActivityFromSlug as EmployeeId] : null;
  const activity = m.latestActivityText
    ? `${fromMeta?.nickname ?? ""}: ${m.latestActivityText}`
    : m.status === "planning" ? "等待资源分配..." : null;

  return (
    <div className={cn(
      "border-b border-gray-100/60 dark:border-gray-800/40 last:border-b-0 transition-colors duration-200",
      isExpanded && "bg-gray-50/50 dark:bg-gray-800/20"
    )}>
      {/* Row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-5 py-3.5 text-left hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors"
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
            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
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
            className="text-[10px] font-medium px-2 py-0.5 rounded"
            style={{
              backgroundColor: scCfg?.bgColor ?? "rgba(107,114,128,0.12)",
              color: scCfg?.color ?? "#6b7280",
            }}
          >
            {scCfg?.label ?? m.scenario}
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
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">任务阶段</p>
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
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">子任务分布</p>
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
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">团队成员</p>
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
          </div>
        </div>
      </div>
    </div>
  );
}
