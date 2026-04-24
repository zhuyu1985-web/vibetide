"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WorkflowTemplateCard } from "@/components/workflows/workflow-template-card";
import { MyWorkflowCard } from "@/components/workflows/my-workflow-card";
import { WorkflowLaunchDialog } from "@/components/workflows/workflow-launch-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  createWorkflowFromTemplate,
  deleteWorkflow,
} from "@/app/actions/workflow-engine";
import { startMissionFromTemplate } from "@/app/actions/workflow-launch";
import { Plus, GitBranch, Inbox } from "lucide-react";
import type { WorkflowTemplateRow } from "@/db/types";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import type { InputFieldDef } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * 一级大类 → DB `category` 的映射（一个一级可覆盖多个 DB category）。
 * "新闻报道" 涵盖 news / deep / livelihood / daily_brief；
 * "视频 & 短剧" 涵盖 video / drama；
 * "社交 & 播客" 涵盖 social / podcast。
 */
const CATEGORY_GROUPS = [
  { value: "all", label: "全部", match: null },
  { value: "news", label: "新闻报道", match: ["news", "deep", "livelihood", "daily_brief"] },
  { value: "video", label: "视频 & 短剧", match: ["video", "drama"] },
  { value: "social", label: "社交 & 播客", match: ["social", "podcast"] },
  { value: "analytics", label: "数据分析", match: ["analytics"] },
  { value: "distribution", label: "渠道运营", match: ["distribution"] },
  { value: "advanced", label: "高级 / 自定义", match: ["advanced", "custom"] },
] as const;

/** "新闻报道" 二级场景过滤 —— 对应 DB `category` 精确值。 */
const NEWS_SCENE_FILTERS = [
  { value: "all", label: "全部新闻" },
  { value: "news", label: "突发快讯" },
  { value: "deep", label: "深度报道" },
  { value: "livelihood", label: "民生服务" },
  { value: "daily_brief", label: "每日简报" },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowsClientProps {
  myWorkflows: WorkflowTemplateRow[];
  builtinTemplates: WorkflowTemplateRow[];
  /** Super-admin bypass — allows editing/deleting builtin templates. */
  isAdmin?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowsClient({
  myWorkflows,
  builtinTemplates,
  isAdmin = false,
}: WorkflowsClientProps) {
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [newsScene, setNewsScene] = useState<string>("all"); // 新闻报道二级场景
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  // 运行我的工作流时的参数采集 dialog —— inputFields/promptTemplate 靠它生效
  const [launchTemplate, setLaunchTemplate] =
    useState<WorkflowTemplateRow | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // ── Filtered templates ──
  const filteredTemplates = useMemo(() => {
    const group = CATEGORY_GROUPS.find((g) => g.value === categoryFilter);
    // 一级 "全部" 或未命中 → 返回全部
    if (!group || group.match === null) return builtinTemplates;

    // 一级 "新闻报道" + 二级场景（非 all）→ 精确过滤到具体 category
    if (categoryFilter === "news" && newsScene !== "all") {
      return builtinTemplates.filter((t) => t.category === newsScene);
    }

    // 其余：按一级大类映射的 DB category 集合过滤
    const allowed = new Set(group.match);
    return builtinTemplates.filter(
      (t) => t.category && allowed.has(t.category),
    );
  }, [builtinTemplates, categoryFilter, newsScene]);

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
      const wf = myWorkflows.find((w) => w.id === id);
      if (!wf) {
        showFeedback("error", "工作流不存在");
        return;
      }
      const fields = (wf.inputFields ?? []) as InputFieldDef[];
      const hasPrompt = (wf.promptTemplate ?? "").trim().length > 0;
      // "direct" + 无字段 + 无 prompt 模板 → 允许一键启动，不弹 dialog
      if (wf.launchMode === "direct" && fields.length === 0 && !hasPrompt) {
        startTransition(async () => {
          try {
            const res = await startMissionFromTemplate(id, {});
            if (!res.ok) {
              showFeedback(
                "error",
                res.errors._global ?? "运行失败"
              );
              return;
            }
            showFeedback("success", "工作流已开始运行");
            router.push(`/missions/${res.missionId}`);
          } catch (err) {
            showFeedback(
              "error",
              err instanceof Error ? err.message : "运行失败"
            );
          }
        });
        return;
      }
      // 有字段 / promptTemplate / launchMode=form → 弹 dialog 让用户填参数
      setLaunchTemplate(wf);
    },
    [myWorkflows, router, showFeedback]
  );

  const handleEdit = useCallback(
    (id: string) => {
      router.push(`/workflows/${id}/edit`);
    },
    [router]
  );

  const handleDelete = useCallback(
    (id: string) => {
      setDeleteTargetId(id);
    },
    [],
  );

  const confirmDelete = useCallback(
    () => {
      const id = deleteTargetId;
      if (!id) return;
      setDeleteTargetId(null);
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
    [deleteTargetId, router, showFeedback]
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

        {/* 一级大类 filter pills */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {CATEGORY_GROUPS.map((cat) => (
            <button
              key={cat.value}
              onClick={() => {
                setCategoryFilter(cat.value);
                setNewsScene("all"); // 切一级时重置二级
              }}
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

        {/* 新闻报道 二级场景 pills */}
        {categoryFilter === "news" && (
          <div className="flex flex-wrap items-center gap-1.5 mb-6 pl-2 border-l-2 border-blue-200/60 dark:border-blue-500/30">
            {NEWS_SCENE_FILTERS.map((s) => (
              <button
                key={s.value}
                onClick={() => setNewsScene(s.value)}
                className={`px-3 py-1 rounded-lg text-xs border-0 cursor-pointer transition-all ${
                  newsScene === s.value
                    ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300"
                    : "bg-transparent text-gray-500 dark:text-white/45 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-gray-700 dark:hover:text-white/70"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* 非 news 时补回底部间距 */}
        {categoryFilter !== "news" && <div className="mb-3" />}

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
                onEdit={isAdmin ? handleEdit : undefined}
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

      {/* 运行参数采集 dialog —— 使 inputFields + promptTemplate 生效 */}
      {launchTemplate && (
        <WorkflowLaunchDialog
          template={launchTemplate}
          open={!!launchTemplate}
          onOpenChange={(o) => {
            if (!o) setLaunchTemplate(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="删除工作流"
        description="确定要删除该工作流吗？此操作不可恢复。"
        confirmText="删除"
        variant="danger"
        loading={isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
