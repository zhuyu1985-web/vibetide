"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Shield, ShieldAlert, ShieldX, FileText, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { archiveSelectedDraftAction } from "@/app/actions/hot-topics";
import type { MissionTask } from "@/lib/types";

interface DraftPair {
  industryLabel: string;
  industryKey: string;
  draftTask: MissionTask;
  auditTask?: MissionTask;
  body: string;
  headline: string;
  auditConclusion: AuditConclusion;
  auditText?: string;
}

type AuditConclusion = "pass" | "warn" | "fail" | "pending" | "unknown";

function extractText(task: MissionTask | undefined): { headline?: string; body: string } {
  if (!task || !task.outputData) return { body: "" };
  const data = task.outputData as {
    summary?: string;
    artifacts?: { title?: string; content?: string }[];
  };
  const headline = data.artifacts?.[0]?.title;
  const body = data.artifacts?.[0]?.content ?? data.summary ?? "";
  return { headline, body };
}

function classifyAudit(text: string): AuditConclusion {
  const lower = text.toLowerCase();
  if (lower.includes("不通过") || lower.includes("不合规") || lower.includes("拒绝")) return "fail";
  if (lower.includes("有风险") || lower.includes("warning") || lower.includes("注意")) return "warn";
  if (lower.includes("通过") || lower.includes("合规") || lower.includes("无风险")) return "pass";
  return "unknown";
}

interface DraftComparisonPanelProps {
  missionId: string;
  tasks: MissionTask[];
}

/**
 * 深度追踪 mission 的草稿对比与挑选面板。
 *
 * 从 mission.tasks 里抽出 inputContext.taskKind === 'draft' 的稿件和配对的
 * 'audit' 审查 task，按 industryLabel 分卡片展示，每张卡：
 *   - 稿件正文（可滚）
 *   - 合规审查结论 + 详情
 *   - "选用此稿"按钮 → 调 archiveSelectedDraftAction → 写 articles 表 → 跳到稿件详情
 *
 * 任意一张稿件被入库后，整个 mission 视为完成；后续如果要复用其他稿件，
 * 用户可以再次进入 mission console 选其他稿件入库（archiveSelectedDraftAction
 * 不互斥，articles 表多条）。
 */
export function DraftComparisonPanel({ missionId, tasks }: DraftComparisonPanelProps) {
  const router = useRouter();
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const pairs = useMemo<DraftPair[]>(() => {
    // 注意：mission-executor 会在 task ready 时把 inputContext 覆盖为依赖输出，
    // 所以不能靠 inputContext.taskKind 识别。改用 title 模式匹配：
    //   "{industryLabel} · 视角改写" → draft
    //   "{industryLabel} · 合规审查" → audit
    const DRAFT_RE = /^(.+) · 视角改写$/;
    const AUDIT_RE = /^(.+) · 合规审查$/;

    const draftEntries = tasks
      .map((t) => {
        const m = DRAFT_RE.exec(t.title);
        return m ? { task: t, industryLabel: m[1] } : null;
      })
      .filter((x): x is { task: MissionTask; industryLabel: string } => x !== null);

    return draftEntries.map(({ task: draftTask, industryLabel }) => {
      const industryKey = industryLabel; // title 里的中文 label 当 stable key

      const auditTask = tasks.find((t) => {
        const m = AUDIT_RE.exec(t.title);
        return m !== null && m[1] === industryLabel;
      });

      const draftText = extractText(draftTask);
      const auditText = extractText(auditTask);
      let conclusion: AuditConclusion = "unknown";
      if (!auditTask) conclusion = "unknown";
      else if (auditTask.status !== "completed") conclusion = "pending";
      else conclusion = classifyAudit(auditText.body);

      return {
        industryKey,
        industryLabel,
        draftTask,
        auditTask,
        body: draftText.body || "（稿件正文为空）",
        headline: draftText.headline ?? `${industryLabel} 视角稿件`,
        auditConclusion: conclusion,
        auditText: auditText.body,
      };
    });
  }, [tasks]);

  const handleSelect = (draftTaskId: string) => {
    setPendingTaskId(draftTaskId);
    startTransition(async () => {
      try {
        const res = await archiveSelectedDraftAction(missionId, draftTaskId);
        toast.success("已入稿件库，跳转到详情");
        router.push(`/articles/${res.articleId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "入库失败";
        toast.error(msg);
      } finally {
        setPendingTaskId(null);
      }
    });
  };

  if (pairs.length === 0) return null;

  return (
    <GlassCard padding="none" className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <FileText size={14} className="text-purple-500 dark:text-purple-400" />
          多维度草稿对比（共 {pairs.length} 篇，请挑选 1 篇入库）
        </h2>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
          稿件入库后状态为 draft，可在「稿件库」继续编辑、配置发送华栖云 CMS。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
        {pairs.map((pair) => (
          <DraftCard
            key={pair.industryKey}
            pair={pair}
            isPending={pendingTaskId === pair.draftTask.id}
            globalPending={pendingTaskId !== null}
            onSelect={() => handleSelect(pair.draftTask.id)}
          />
        ))}
      </div>
    </GlassCard>
  );
}

function DraftCard({
  pair,
  isPending,
  globalPending,
  onSelect,
}: {
  pair: DraftPair;
  isPending: boolean;
  globalPending: boolean;
  onSelect: () => void;
}) {
  const auditMeta = AUDIT_META[pair.auditConclusion];
  const draftReady = pair.draftTask.status === "completed";

  return (
    <div
      className={cn(
        "rounded-xl bg-white/60 dark:bg-white/[0.03] border border-gray-200/60 dark:border-white/5 overflow-hidden flex flex-col",
        isPending && "ring-2 ring-purple-400/60",
      )}
    >
      <div className="px-3 py-2 border-b border-gray-200/60 dark:border-white/5 flex items-center gap-2">
        <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 truncate">
          {pair.industryLabel}
        </span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
            auditMeta.cls,
          )}
        >
          <auditMeta.Icon size={10} />
          {auditMeta.label}
        </span>
      </div>

      <h3 className="px-3 pt-3 text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-2">
        {pair.headline}
      </h3>

      <ScrollArea className="px-3 mt-2 max-h-[240px]">
        <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap pb-3">
          {draftReady ? pair.body : <span className="text-gray-400">{pair.draftTask.status === "failed" ? `生成失败：${pair.draftTask.errorMessage ?? "未知错误"}` : "稿件生成中..."}</span>}
        </div>
      </ScrollArea>

      {pair.auditText && pair.auditConclusion !== "pass" && (
        <div className="px-3 py-2 border-t border-gray-200/60 dark:border-white/5 bg-amber-50/40 dark:bg-amber-900/10">
          <p className="text-[11px] text-amber-700 dark:text-amber-300 line-clamp-3">
            <span className="font-semibold">审查意见：</span>
            {pair.auditText.slice(0, 200)}
          </p>
        </div>
      )}

      <div className="px-3 py-2 border-t border-gray-200/60 dark:border-white/5 flex items-center justify-end">
        <Button
          size="sm"
          onClick={onSelect}
          disabled={!draftReady || globalPending}
        >
          {isPending ? (
            <>
              <Loader2 size={12} className="mr-1 animate-spin" />
              入库中...
            </>
          ) : (
            <>
              <Check size={12} className="mr-1" />
              选用此稿入库
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

const AUDIT_META: Record<AuditConclusion, { label: string; Icon: typeof Shield; cls: string }> = {
  pass: {
    label: "已过审",
    Icon: Shield,
    cls: "bg-emerald-100/70 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  },
  warn: {
    label: "有风险",
    Icon: ShieldAlert,
    cls: "bg-amber-100/70 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  },
  fail: {
    label: "未通过",
    Icon: ShieldX,
    cls: "bg-red-100/70 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  },
  pending: {
    label: "审查中",
    Icon: Loader2,
    cls: "bg-blue-100/70 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  },
  unknown: {
    label: "未审查",
    Icon: Shield,
    cls: "bg-gray-100/70 dark:bg-white/5 text-gray-500 dark:text-gray-400",
  },
};
