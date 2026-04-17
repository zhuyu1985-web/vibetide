"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Shield, CheckCircle, XCircle, Clock, Search, Filter, FileText, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import type { AuditStats, AuditRecordRow, AuditStage } from "@/lib/dal/audit";

// ── Label maps ──────────────────────────────────────────────

const STAGE_CFG: Record<AuditStage, { label: string; cls: string }> = {
  review_1: {
    label: "初审",
    cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  },
  review_2: {
    label: "复审",
    cls: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400",
  },
  review_3: {
    label: "终审",
    cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  },
};

const RESULT_CFG: Record<string, { label: string; cls: string }> = {
  warning: {
    label: "需修改",
    cls: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
  },
  fail: {
    label: "需人工",
    cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  },
  pass: {
    label: "已通过",
    cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  },
};

const CONTENT_TYPE_LABEL: Record<string, string> = {
  mission_task: "任务",
  article: "稿件",
  draft: "稿件",
};

type StageFilter = "all" | AuditStage;
type TypeFilter = "all" | "mission_task" | "article";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

// ── Main Component ──────────────────────────────────────────

export function AuditCenterClient({
  stats,
  pendingAudits,
}: {
  stats: AuditStats;
  pendingAudits: AuditRecordRow[];
}) {
  const router = useRouter();
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchText, setSearchText] = useState("");

  const filtered = useMemo(() => {
    let list = pendingAudits;
    if (stageFilter !== "all") {
      list = list.filter((r) => r.stage === stageFilter);
    }
    if (typeFilter !== "all") {
      list = list.filter((r) =>
        typeFilter === "article"
          ? r.contentType === "article" || r.contentType === "draft"
          : r.contentType === typeFilter
      );
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((r) => r.contentId.toLowerCase().includes(q));
    }
    return list;
  }, [pendingAudits, stageFilter, typeFilter, searchText]);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <PageHeader
        title="审核中心"
        description="三审三校内容合规工作台 — 初审、复审、终审全流程管理"
      />

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatsCard
          label="待审内容"
          value={stats.pendingCount}
          icon={<Shield size={20} />}
          accentCls="text-orange-500 dark:text-orange-400"
          bgCls="bg-orange-50 dark:bg-orange-950/20"
        />
        <StatsCard
          label="今日通过"
          value={stats.approvedToday}
          icon={<CheckCircle size={20} />}
          accentCls="text-emerald-500 dark:text-emerald-400"
          bgCls="bg-emerald-50 dark:bg-emerald-950/20"
        />
        <StatsCard
          label="今日退回"
          value={stats.rejectedToday}
          icon={<XCircle size={20} />}
          accentCls="text-red-500 dark:text-red-400"
          bgCls="bg-red-50 dark:bg-red-950/20"
        />
        <StatsCard
          label="平均审核时长"
          value="—"
          icon={<Clock size={20} />}
          accentCls="text-blue-500 dark:text-blue-400"
          bgCls="bg-blue-50 dark:bg-blue-950/20"
        />
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Filter size={15} className="text-muted-foreground shrink-0" />

        {/* Stage filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-0.5">阶段</span>
          {(
            [
              { key: "all" as StageFilter, label: "全部" },
              { key: "review_1" as StageFilter, label: "初审" },
              { key: "review_2" as StageFilter, label: "复审" },
              { key: "review_3" as StageFilter, label: "终审" },
            ] as const
          ).map((f) => (
            <Button
              key={f.key}
              variant={stageFilter === f.key ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setStageFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Type filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-0.5">类型</span>
          {(
            [
              { key: "all" as TypeFilter, label: "全部" },
              { key: "mission_task" as TypeFilter, label: "任务" },
              { key: "article" as TypeFilter, label: "稿件" },
            ] as const
          ).map((f) => (
            <Button
              key={f.key}
              variant={typeFilter === f.key ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setTypeFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="ml-auto relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="搜索内容标题..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="glass-input h-7 pl-8 w-44 text-xs"
          />
        </div>
      </div>

      {/* ── Audit List ── */}
      {filtered.length === 0 ? (
        <GlassCard className="p-16 text-center">
          <ClipboardList
            size={40}
            className="mx-auto text-muted-foreground/30 mb-4"
          />
          <p className="text-muted-foreground text-sm">暂无待审内容</p>
        </GlassCard>
      ) : (
        <GlassCard variant="panel" padding="none">
          {/* Table header */}
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border/60">
            <div className="flex-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              内容标识
            </div>
            <div className="w-16 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              审核阶段
            </div>
            <div className="w-20 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              审核结果
            </div>
            <div className="w-20 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              类型
            </div>
            <div className="w-28 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              审核员
            </div>
            <div className="w-24 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
              创建时间
            </div>
          </div>

          {/* Rows */}
          {filtered.map((record) => (
            <AuditRow
              key={record.id}
              record={record}
              onClick={() => router.push(`/audit-center/${record.id}`)}
            />
          ))}
        </GlassCard>
      )}
    </div>
  );
}

// ── Stats Card ──────────────────────────────────────────────

function StatsCard({
  label,
  value,
  icon,
  accentCls,
  bgCls,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accentCls: string;
  bgCls: string;
}) {
  return (
    <GlassCard padding="md" className="flex items-center gap-4">
      <div
        className={cn(
          "shrink-0 h-11 w-11 rounded-xl flex items-center justify-center",
          bgCls,
          accentCls
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold font-mono text-foreground leading-none">
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-2">{label}</p>
      </div>
    </GlassCard>
  );
}

// ── Audit Row ───────────────────────────────────────────────

function AuditRow({
  record,
  onClick,
}: {
  record: AuditRecordRow;
  onClick: () => void;
}) {
  const stageCfg = STAGE_CFG[record.stage] ?? {
    label: record.stage,
    cls: "bg-gray-100 dark:bg-gray-800 text-gray-500",
  };
  const resultCfg = RESULT_CFG[record.overallResult] ?? {
    label: record.overallResult,
    cls: "bg-gray-100 dark:bg-gray-800 text-gray-500",
  };
  const typeLabel =
    CONTENT_TYPE_LABEL[record.contentType] ?? record.contentType;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3.5 text-left border-b border-border/40 last:border-b-0 hover:bg-accent/50 transition-colors rounded-lg"
    >
      {/* Content title */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <FileText size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm text-foreground truncate font-medium">
          {record.contentId}
        </span>
        {record.issues.length > 0 && (
          <span className="text-[10px] text-orange-500 dark:text-orange-400 shrink-0">
            {record.issues.length} 个问题
          </span>
        )}
      </div>

      {/* Stage badge */}
      <div className="w-16 shrink-0">
        <Badge className={cn("text-[10px] font-semibold px-2 py-0.5", stageCfg.cls)}>
          {stageCfg.label}
        </Badge>
      </div>

      {/* Result badge */}
      <div className="w-20 shrink-0">
        <Badge className={cn("text-[10px] font-semibold px-2 py-0.5", resultCfg.cls)}>
          {resultCfg.label}
        </Badge>
      </div>

      {/* Content type */}
      <div className="w-20 shrink-0">
        <span className="text-xs text-muted-foreground">{typeLabel}</span>
      </div>

      {/* Reviewer */}
      <div className="w-28 shrink-0">
        <span className="text-xs text-muted-foreground truncate block">
          {record.reviewerType === "ai" ? `AI · ${record.reviewerId}` : record.reviewerId}
        </span>
      </div>

      {/* Created time */}
      <div className="w-24 shrink-0 text-right">
        <span className="text-xs text-muted-foreground">
          {relativeTime(record.createdAt)}
        </span>
      </div>
    </button>
  );
}
