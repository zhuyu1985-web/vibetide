"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  PenLine,
  Eye,
  ClipboardCheck,
  SendHorizonal,
  UserCheck,
  Bot,
  GitCompare,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";
import { approveAudit, rejectAudit } from "@/app/actions/audit";
import type {
  AuditRecordRow,
  ContentTrailLogRow,
  AuditStage,
  AuditResult,
  TrailAction,
} from "@/lib/dal/audit";

// ── Label/config maps ────────────────────────────────────────

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

const RESULT_CFG: Record<AuditResult, { label: string; cls: string; bgCls: string }> = {
  pass: {
    label: "通过",
    cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    bgCls: "bg-emerald-500",
  },
  warning: {
    label: "需关注",
    cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    bgCls: "bg-amber-500",
  },
  fail: {
    label: "不通过",
    cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    bgCls: "bg-red-500",
  },
};

const DIMENSION_LABELS: Record<string, string> = {
  political_compliance: "政治合规",
  factual_accuracy: "事实准确",
  sensitive_content: "敏感内容",
  language_quality: "语言质量",
  source_credibility: "信源可信度",
  legal_compliance: "法律合规",
};

const SEVERITY_CFG: Record<string, { label: string; cls: string }> = {
  critical: { label: "严重", cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  high: { label: "高", cls: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" },
  medium: { label: "中", cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  low: { label: "低", cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
};

const TRAIL_ACTION_CFG: Record<TrailAction, { label: string; icon: React.ReactNode; cls: string }> = {
  create: {
    label: "创建",
    icon: <FileText size={14} />,
    cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  },
  edit: {
    label: "编辑",
    icon: <PenLine size={14} />,
    cls: "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
  },
  review: {
    label: "审核",
    icon: <ClipboardCheck size={14} />,
    cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  },
  approve: {
    label: "通过",
    icon: <CheckCircle size={14} />,
    cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
  },
  reject: {
    label: "退回",
    icon: <XCircle size={14} />,
    cls: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  },
  publish: {
    label: "发布",
    icon: <SendHorizonal size={14} />,
    cls: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
  },
};

const TRAIL_STAGE_LABELS: Record<string, string> = {
  planning: "策划",
  writing: "撰写",
  review_1: "初审",
  review_2: "复审",
  review_3: "终审",
  publishing: "发布",
};

// ── Helpers ──────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Component Props ──────────────────────────────────────────

interface Props {
  record: AuditRecordRow;
  trailLogs: ContentTrailLogRow[];
  auditHistory: AuditRecordRow[];
}

// ── Main Client Component ────────────────────────────────────

export function AuditDetailClient({ record, trailLogs }: Props) {
  const router = useRouter();
  const [comment, setComment] = useState(record.comment ?? "");
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState(false);

  const stageCfg = STAGE_CFG[record.stage];
  const resultCfg = RESULT_CFG[record.overallResult];

  const hasDiff = !!record.diff;

  // Parse dimensions from record
  const dimensionKeys = Object.keys(DIMENSION_LABELS);
  const dimensions = record.dimensions as Record<string, string> | null;

  function handleApprove() {
    setActionError(null);
    startTransition(async () => {
      try {
        await approveAudit(record.id, comment || undefined);
        router.push("/audit-center");
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "操作失败，请重试");
      }
    });
  }

  function handleReject() {
    if (!comment.trim()) {
      setActionError("退回时请填写审核意见");
      return;
    }
    setActionError(null);
    startTransition(async () => {
      try {
        await rejectAudit(record.id, comment);
        router.push("/audit-center");
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "操作失败，请重试");
      }
    });
  }

  return (
    <div className="max-w-[1400px] mx-auto pb-32">
      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/audit-center")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
          返回列表
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm text-foreground font-medium">审核详情</span>
        <div className="ml-auto flex items-center gap-2">
          <Badge className={cn("text-xs font-semibold px-2.5 py-1", stageCfg.cls)}>
            {stageCfg.label}
          </Badge>
          <Badge
            className={cn(
              "text-xs font-semibold px-2.5 py-1",
              resultCfg.cls
            )}
          >
            {resultCfg.label}
          </Badge>
        </div>
      </div>

      {/* ── Two-column main layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
        {/* LEFT: 内容预览 */}
        <GlassCard variant="panel" padding="none">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Eye size={15} className="text-muted-foreground" />
              <span className="text-sm font-medium">内容预览</span>
            </div>
            {hasDiff && (
              <button
                onClick={() => setDiffMode((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-3 py-1 rounded-md transition-colors",
                  diffMode
                    ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <GitCompare size={12} />
                {diffMode ? "对比视图" : "原文"}
              </button>
            )}
          </div>

          <div className="px-5 py-4 min-h-[400px]">
            {diffMode && hasDiff ? (
              <DiffView diff={record.diff as Record<string, unknown>} />
            ) : (
              <ContentPreview content={record.contentSnapshot} />
            )}
          </div>
        </GlassCard>

        {/* RIGHT: AI 审核报告 */}
        <div className="flex flex-col gap-4">
          {/* Overall result */}
          <GlassCard variant="panel" padding="none">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/60">
              <ClipboardCheck size={15} className="text-muted-foreground" />
              <span className="text-sm font-medium">AI 审核报告</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {record.reviewerType === "ai" ? (
                  <span className="flex items-center gap-1">
                    <Bot size={12} />
                    AI 审核员 · {record.reviewerId}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <UserCheck size={12} />
                    {record.reviewerId}
                  </span>
                )}
              </span>
            </div>

            {/* Overall result banner */}
            <div
              className={cn(
                "mx-5 mt-4 mb-3 rounded-lg px-4 py-3 flex items-center justify-between",
                record.overallResult === "pass"
                  ? "bg-emerald-50 dark:bg-emerald-950/30"
                  : record.overallResult === "warning"
                  ? "bg-amber-50 dark:bg-amber-950/30"
                  : "bg-red-50 dark:bg-red-950/30"
              )}
            >
              <span className="text-sm text-muted-foreground">综合结论</span>
              <span
                className={cn(
                  "text-base font-bold",
                  record.overallResult === "pass"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : record.overallResult === "warning"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {resultCfg.label}
              </span>
            </div>

            {/* 6-dimension scores */}
            <div className="px-5 pb-4 space-y-2.5">
              {dimensionKeys.map((key) => {
                const val = dimensions?.[key] as string | undefined;
                const dimResult = (val ?? "pass") as AuditResult;
                const cfg = RESULT_CFG[dimResult] ?? RESULT_CFG.pass;
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {DIMENSION_LABELS[key]}
                    </span>
                    <Badge
                      className={cn(
                        "text-[11px] font-medium px-2 py-0.5",
                        cfg.cls
                      )}
                    >
                      {cfg.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Issues list */}
          {record.issues.length > 0 && (
            <GlassCard variant="panel" padding="none">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/60">
                <AlertTriangle size={15} className="text-amber-500" />
                <span className="text-sm font-medium">问题清单</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {record.issues.length} 项
                </span>
              </div>
              <div className="px-5 py-3 space-y-3">
                {record.issues.map((issue, idx) => {
                  const sevCfg =
                    SEVERITY_CFG[issue.severity] ?? SEVERITY_CFG.medium;
                  return (
                    <IssueCard key={idx} issue={issue} sevCfg={sevCfg} />
                  );
                })}
              </div>
            </GlassCard>
          )}

          {/* AI comment */}
          {record.comment && (
            <GlassCard variant="panel" padding="none">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/60">
                <Info size={15} className="text-muted-foreground" />
                <span className="text-sm font-medium">审核备注</span>
              </div>
              <p className="px-5 py-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {record.comment}
              </p>
            </GlassCard>
          )}
        </div>
      </div>

      {/* ── Trail Timeline ── */}
      {trailLogs.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-4 text-foreground">操作记录</h3>
          <GlassCard variant="panel" padding="none">
            <div className="px-5 py-4">
              <TrailTimeline logs={trailLogs} />
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── Fixed Bottom Action Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/90 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-start gap-4">
          {/* Comment textarea */}
          <div className="flex-1">
            <Textarea
              placeholder="填写审核意见（退回时必填）..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
            {actionError && (
              <p className="text-xs text-red-500 mt-1">{actionError}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1 shrink-0">
            <Button
              onClick={handleApprove}
              disabled={isPending}
              className="bg-emerald-500 hover:bg-emerald-600 text-white h-9 px-5 font-medium"
            >
              {isPending ? "处理中..." : "通过"}
            </Button>
            <Button
              onClick={handleReject}
              disabled={isPending}
              className="bg-red-500 hover:bg-red-600 text-white h-9 px-5 font-medium"
            >
              {isPending ? "处理中..." : "退回"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function ContentPreview({ content }: { content: string | null }) {
  if (!content) {
    return (
      <p className="text-sm text-muted-foreground italic">暂无内容快照</p>
    );
  }
  return (
    <pre className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-sans">
      {content}
    </pre>
  );
}

interface DiffEntry {
  type: "added" | "removed" | "unchanged";
  line: string;
}

function DiffView({ diff }: { diff: Record<string, unknown> }) {
  // Expect diff.lines = DiffEntry[] or diff.added/removed as string arrays
  const lines = diff.lines as DiffEntry[] | undefined;

  if (!lines || lines.length === 0) {
    const added = (diff.added as string[]) ?? [];
    const removed = (diff.removed as string[]) ?? [];

    if (!added.length && !removed.length) {
      return <p className="text-sm text-muted-foreground italic">暂无差异数据</p>;
    }

    return (
      <div className="space-y-1 text-sm font-mono">
        {removed.map((line, i) => (
          <div key={`r${i}`} className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded">
            - {line}
          </div>
        ))}
        {added.map((line, i) => (
          <div key={`a${i}`} className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded">
            + {line}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-0.5 text-sm font-mono">
      {lines.map((entry, i) => (
        <div
          key={i}
          className={cn(
            "px-2 py-0.5 rounded",
            entry.type === "added" &&
              "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
            entry.type === "removed" &&
              "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400",
            entry.type === "unchanged" && "text-muted-foreground"
          )}
        >
          {entry.type === "added" ? "+ " : entry.type === "removed" ? "- " : "  "}
          {entry.line}
        </div>
      ))}
    </div>
  );
}

function IssueCard({
  issue,
  sevCfg,
}: {
  issue: { type: string; severity: string; location: string; description: string; suggestion: string };
  sevCfg: { label: string; cls: string };
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg bg-muted/40 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <Badge className={cn("text-[10px] font-semibold px-1.5 py-0 shrink-0", sevCfg.cls)}>
          {sevCfg.label}
        </Badge>
        <span className="text-xs text-muted-foreground shrink-0">{issue.type}</span>
        <span className="text-xs text-foreground flex-1 truncate">{issue.description}</span>
        {expanded ? (
          <ChevronUp size={13} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown size={13} className="text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-border/40 pt-2.5">
          {issue.location && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">位置：</span>
              {issue.location}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">描述：</span>
            {issue.description}
          </p>
          {issue.suggestion && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">建议：</span>
              {issue.suggestion}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TrailTimeline({ logs }: { logs: ContentTrailLogRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border/60" />

      <div className="space-y-4">
        {logs.map((log, idx) => {
          const actionCfg =
            TRAIL_ACTION_CFG[log.action] ?? {
              label: log.action,
              icon: <FileText size={14} />,
              cls: "bg-gray-100 dark:bg-gray-800 text-gray-500",
            };
          const stageLabel = TRAIL_STAGE_LABELS[log.stage] ?? log.stage;
          const isExpanded = expandedId === log.id;
          const hasDetails = !!(log.comment || log.diff || log.contentSnapshot);

          return (
            <div key={log.id} className="relative flex gap-4 pl-10">
              {/* Node icon */}
              <div
                className={cn(
                  "absolute left-0 w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                  actionCfg.cls
                )}
              >
                {actionCfg.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">
                    {log.operatorType === "ai" ? `AI · ${log.operator}` : log.operator}
                  </span>
                  <Badge
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0",
                      actionCfg.cls
                    )}
                  >
                    {actionCfg.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{stageLabel}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatTime(log.createdAt)}
                  </span>
                </div>

                {log.comment && !isExpanded && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {log.comment}
                  </p>
                )}

                {hasDetails && (
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : log.id)
                    }
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp size={11} /> 收起
                      </>
                    ) : (
                      <>
                        <ChevronDown size={11} /> 展开详情
                      </>
                    )}
                  </button>
                )}

                {isExpanded && (
                  <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2.5 space-y-2">
                    {log.comment && (
                      <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                        {log.comment}
                      </p>
                    )}
                    {log.diff && (
                      <div className="border-t border-border/40 pt-2">
                        <p className="text-[10px] text-muted-foreground mb-1">差异记录</p>
                        <DiffView diff={log.diff as Record<string, unknown>} />
                      </div>
                    )}
                    {log.contentSnapshot && !log.diff && (
                      <div className="border-t border-border/40 pt-2">
                        <p className="text-[10px] text-muted-foreground mb-1">内容快照</p>
                        <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                          {log.contentSnapshot}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {idx < logs.length - 1 && <div className="sr-only" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
