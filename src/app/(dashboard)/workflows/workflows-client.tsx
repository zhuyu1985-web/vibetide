"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WorkflowTemplateCard } from "@/components/workflows/workflow-template-card";
import { MyWorkflowCard } from "@/components/workflows/my-workflow-card";
import {
  createWorkflowFromTemplate,
  executeWorkflow,
  deleteWorkflow,
} from "@/app/actions/workflow-engine";
import { Plus, GitBranch, Inbox } from "lucide-react";
import type { WorkflowTemplateRow } from "@/db/types";
import type { WorkflowStepDef } from "@/db/schema/workflows";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_FILTERS = [
  { value: "all", label: "全部" },
  { value: "news", label: "新闻报道" },
  { value: "video", label: "视频生产" },
  { value: "analytics", label: "数据分析" },
  { value: "distribution", label: "渠道运营" },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowsClientProps {
  myWorkflows: WorkflowTemplateRow[];
  builtinTemplates: WorkflowTemplateRow[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowsClient({
  myWorkflows,
  builtinTemplates,
}: WorkflowsClientProps) {
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ── Filtered templates ──
  const filteredTemplates = useMemo(() => {
    if (categoryFilter === "all") return builtinTemplates;
    return builtinTemplates.filter((t) => t.category === categoryFilter);
  }, [builtinTemplates, categoryFilter]);

  // ── Show temporary feedback ──
  const showFeedback = useCallback(
    (type: "success" | "error", message: string) => {
      setFeedback({ type, message });
      const id = window.setTimeout(() => setFeedback(null), 3000);
      return () => window.clearTimeout(id);
    },
    []
  );

  // ── Handlers ──
  const handleUseTemplate = useCallback(
    (templateId: string) => {
      startTransition(async () => {
        try {
          await createWorkflowFromTemplate(templateId);
          showFeedback("success", "已从模板创建工作流");
          router.refresh();
        } catch (err) {
          showFeedback(
            "error",
            err instanceof Error ? err.message : "创建失败"
          );
        }
      });
    },
    [router, showFeedback]
  );

  const handleRun = useCallback(
    (id: string) => {
      startTransition(async () => {
        try {
          const missionId = await executeWorkflow(id);
          showFeedback("success", "工作流已开始运行");
          router.push(`/missions/${missionId}`);
        } catch (err) {
          showFeedback(
            "error",
            err instanceof Error ? err.message : "运行失败"
          );
        }
      });
    },
    [router, showFeedback]
  );

  const handleEdit = useCallback(
    (id: string) => {
      router.push(`/workflows/${id}/edit`);
    },
    [router]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (!window.confirm("确定要删除该工作流吗？此操作不可恢复。")) return;

      startTransition(async () => {
        try {
          await deleteWorkflow(id);
          showFeedback("success", "工作流已删除");
          router.refresh();
        } catch (err) {
          showFeedback(
            "error",
            err instanceof Error ? err.message : "删除失败"
          );
        }
      });
    },
    [router, showFeedback]
  );

  return (
    <div className="max-w-[1400px] mx-auto px-1">
      {/* ── Feedback toast ── */}
      {feedback && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-2.5 rounded-xl backdrop-blur-xl text-sm transition-all ${
            feedback.type === "success"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/15 text-red-400 border border-red-500/20"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90 mb-1 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-gray-500 dark:text-white/50" />
            工作流
          </h1>
          <p className="text-sm text-gray-400 dark:text-white/40">
            创建和管理自动化工作流程
          </p>
        </div>
        <button
          onClick={() => router.push("/workflows/new")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50/80 dark:bg-blue-500/[0.08] backdrop-blur-sm text-sm text-blue-600 dark:text-blue-400 border-0 cursor-pointer transition-all hover:bg-blue-100/90 dark:hover:bg-blue-500/[0.15] hover:text-blue-700 dark:hover:text-blue-300"
        >
          <Plus className="w-4 h-4" />
          新建工作流
        </button>
      </div>

      {/* ── 我的工作流 ── */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-white/70 mb-4">
          我的工作流
        </h2>

        {myWorkflows.length === 0 ? (
          <div className="bg-slate-50/80 dark:bg-white/[0.05] rounded-2xl py-12 flex flex-col items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <Inbox className="w-10 h-10 text-gray-400 dark:text-white/30" />
            <p className="text-sm text-gray-500 dark:text-white/60">
              还没有工作流，从模板开始或创建自定义工作流
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {myWorkflows.map((wf) => (
              <MyWorkflowCard
                key={wf.id}
                workflow={{
                  id: wf.id,
                  name: wf.name,
                  description: wf.description,
                  triggerType: wf.triggerType ?? "manual",
                  triggerConfig: wf.triggerConfig as {
                    cron?: string;
                    timezone?: string;
                  } | null,
                  runCount: wf.runCount,
                  lastRunAt: wf.lastRunAt
                    ? wf.lastRunAt.toISOString()
                    : null,
                  isEnabled: wf.isEnabled,
                  steps: (wf.steps ?? []) as WorkflowStepDef[],
                }}
                onRun={handleRun}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── 从模板开始 ── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 dark:text-white/70 mb-4">
          从模板开始
        </h2>

        {/* Category filter pills */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`px-3.5 py-1.5 rounded-xl text-sm border-0 cursor-pointer transition-all ${
                categoryFilter === cat.value
                  ? "bg-black/[0.08] dark:bg-white/[0.12] text-gray-900 dark:text-white/90"
                  : "bg-black/[0.03] dark:bg-white/[0.04] text-gray-500 dark:text-white/45 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:text-gray-700 dark:hover:text-white/70"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Template grid */}
        {filteredTemplates.length === 0 ? (
          <div className="bg-slate-50/80 dark:bg-white/[0.05] rounded-2xl py-12 flex flex-col items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <Inbox className="w-10 h-10 text-gray-400 dark:text-white/30" />
            <p className="text-sm text-gray-500 dark:text-white/60">
              该分类暂无模板
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.map((tpl) => (
              <WorkflowTemplateCard
                key={tpl.id}
                template={{
                  id: tpl.id,
                  name: tpl.name,
                  description: tpl.description,
                  category: tpl.category ?? "custom",
                  triggerType: tpl.triggerType ?? "manual",
                  steps: (tpl.steps ?? []) as WorkflowStepDef[],
                }}
                onUseTemplate={handleUseTemplate}
              />
            ))}
          </div>
        )}
      </section>

      {/* Loading overlay */}
      {isPending && (
        <div className="fixed inset-0 z-40 bg-white/70 dark:bg-black/30 flex items-center justify-center">
          <div className="bg-white/90 dark:bg-white/[0.08] backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.12] rounded-2xl px-6 py-4 text-sm text-gray-700 dark:text-white/70">
            处理中...
          </div>
        </div>
      )}
    </div>
  );
}
