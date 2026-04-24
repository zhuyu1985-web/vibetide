"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import {
  Pencil,
  Save,
  X,
  FileText,
  ListTree,
  Clock,
  Rocket,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { updateWorkflowTemplate } from "@/app/actions/workflow-engine";
import { startMission } from "@/app/actions/missions";
import { templateToScenarioSlug } from "@/lib/workflow-template-slug";
import type { WorkflowTemplateRow } from "@/db/types";
import type { WorkflowStepDef } from "@/db/schema/workflows";

interface WorkflowDetailClientProps {
  workflow: WorkflowTemplateRow;
}

const CATEGORY_LABELS: Record<string, string> = {
  daily_brief: "日常简报",
  deep: "深度内容",
  news: "新闻资讯",
  podcast: "播客音频",
  livelihood: "民生内容",
  video: "视频制作",
  analytics: "数据分析",
  distribution: "渠道分发",
  advanced: "进阶场景",
  social: "社交平台",
  drama: "短剧",
  custom: "通用场景",
};

export function WorkflowDetailClient({ workflow }: WorkflowDetailClientProps) {
  const router = useRouter();
  const [mdEditing, setMdEditing] = useState(false);
  const [mdDraft, setMdDraft] = useState(workflow.content ?? "");
  const [mdSaving, setMdSaving] = useState(false);
  const [runPending, setRunPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mdEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mdEditing]);

  const handleMdSave = async () => {
    setMdSaving(true);
    try {
      await updateWorkflowTemplate(workflow.id, { content: mdDraft });
      toast.success("规格文档已保存");
      setMdEditing(false);
      router.refresh();
    } catch (err) {
      console.error("[workflow-detail] save content failed:", err);
      toast.error("保存失败，请重试");
    } finally {
      setMdSaving(false);
    }
  };

  const handleMdCancel = () => {
    setMdDraft(workflow.content ?? "");
    setMdEditing(false);
  };

  const handleRun = async () => {
    setRunPending(true);
    try {
      const result = await startMission({
        title: workflow.name,
        scenario: templateToScenarioSlug(workflow),
        userInstruction: workflow.description ?? "",
        workflowTemplateId: workflow.id,
      });
      if (result?.id) {
        toast.success("任务已启动");
        router.push(`/missions/${result.id}`);
      }
    } catch (err) {
      console.error("[workflow-detail] startMission failed:", err);
      toast.error("启动失败，请重试");
    } finally {
      setRunPending(false);
    }
  };

  const steps = (workflow.steps ?? []) as WorkflowStepDef[];
  const team = (workflow.defaultTeam ?? []) as string[];
  const catLabel = CATEGORY_LABELS[workflow.category ?? "custom"] ?? workflow.category;

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        title={workflow.name}
        description={workflow.description ?? "—"}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link href="/skills">返回</Link>
            </Button>
            <Button onClick={handleRun} disabled={runPending}>
              {runPending ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <Rocket size={14} className="mr-1" />
              )}
              立即运行
            </Button>
          </div>
        }
      />

      {/* Summary card */}
      <GlassCard className="mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">分类</div>
            <Badge variant="outline" className="border-0 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[11px]">
              {catLabel}
            </Badge>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">团队</div>
            {team.length > 0 ? (
              <div className="flex -space-x-1">
                {team.slice(0, 6).map((slug) => (
                  <EmployeeAvatar key={slug} employeeId={slug} size="xs" />
                ))}
                {team.length > 6 && (
                  <span className="text-[10px] text-gray-400 ml-1.5">+{team.length - 6}</span>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-gray-400">—</span>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">步骤数</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {steps.length}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Tabs */}
      <Tabs defaultValue="spec" className="w-full">
        <TabsList variant="line" className="mb-5">
          <TabsTrigger value="spec" className="gap-1.5">
            <FileText size={14} />
            规格文档
          </TabsTrigger>
          <TabsTrigger value="steps" className="gap-1.5">
            <ListTree size={14} />
            流程步骤 ({steps.length})
          </TabsTrigger>
          <TabsTrigger value="meta" className="gap-1.5">
            <Clock size={14} />
            元数据
          </TabsTrigger>
        </TabsList>

        {/* Spec Document Tab — baoyu SKILL.md */}
        <TabsContent value="spec" className="mt-0">
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  规格文档（SKILL.md）
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  baoyu 规范的场景工作流规格 · 双向同步（DB ⇌ workflows/{workflow.legacyScenarioKey ?? "?"}/SKILL.md）
                </p>
              </div>
              {!mdEditing ? (
                <Button variant="ghost" onClick={() => setMdEditing(true)}>
                  <Pencil size={14} className="mr-1" />
                  编辑
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleMdCancel}
                    disabled={mdSaving}
                  >
                    <X size={14} className="mr-1" />
                    取消
                  </Button>
                  <Button
                    onClick={handleMdSave}
                    disabled={mdSaving || mdDraft === (workflow.content ?? "")}
                  >
                    {mdSaving ? (
                      <Loader2 size={14} className="mr-1 animate-spin" />
                    ) : (
                      <Save size={14} className="mr-1" />
                    )}
                    保存
                  </Button>
                </div>
              )}
            </div>

            {mdEditing ? (
              <Textarea
                ref={textareaRef}
                value={mdDraft}
                onChange={(e) => setMdDraft(e.target.value)}
                className="min-h-[600px] font-mono text-xs"
                placeholder="（空，请填写 baoyu 规范 SKILL.md 内容）"
              />
            ) : workflow.content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{workflow.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                <p>该工作流尚无规格文档。</p>
                <p className="mt-2">
                  <Button variant="ghost" onClick={() => setMdEditing(true)}>
                    <Pencil size={14} className="mr-1" />
                    立即创建
                  </Button>
                </p>
                <p className="text-xs mt-3">
                  或运行 <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                    npx tsx scripts/sync-workflows-from-md.ts
                  </code>{" "}
                  从 workflows/ 目录批量导入
                </p>
              </div>
            )}
          </GlassCard>
        </TabsContent>

        {/* Steps Tab — workflow pipeline */}
        <TabsContent value="steps" className="mt-0">
          <GlassCard>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              流程步骤
            </h3>
            {steps.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                未配置流程步骤
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((s, idx) => (
                  <div
                    key={s.id ?? idx}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30"
                  >
                    <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-semibold">
                      {s.order}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {s.name}
                        </span>
                        {s.config?.skillSlug && (
                          <Link
                            href={`/skills?slug=${s.config.skillSlug}`}
                            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            {s.config.skillSlug}
                          </Link>
                        )}
                      </div>
                      {s.config?.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {s.config.description}
                        </p>
                      )}
                      {s.dependsOn && s.dependsOn.length > 0 && (
                        <div className="text-[11px] text-gray-400 mt-1">
                          依赖 → {s.dependsOn.join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
              <Button variant="ghost" asChild>
                <Link href={`/workflows/${workflow.id}/edit`}>
                  <Pencil size={14} className="mr-1" />
                  编辑流程
                </Link>
              </Button>
            </div>
          </GlassCard>
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="meta" className="mt-0">
          <GlassCard>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              元数据
            </h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">ID</dt>
                <dd className="text-gray-900 dark:text-gray-100 font-mono text-xs break-all">{workflow.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Slug</dt>
                <dd className="text-gray-900 dark:text-gray-100 font-mono text-xs">{workflow.legacyScenarioKey ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">是否启用</dt>
                <dd className="text-gray-900 dark:text-gray-100">{workflow.isEnabled ? "是" : "否"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">是否内置</dt>
                <dd className="text-gray-900 dark:text-gray-100">{workflow.isBuiltin ? "是" : "否"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">触发方式</dt>
                <dd className="text-gray-900 dark:text-gray-100">{workflow.triggerType ?? "manual"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">运行次数</dt>
                <dd className="text-gray-900 dark:text-gray-100">{workflow.runCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">创建时间</dt>
                <dd className="text-gray-900 dark:text-gray-100 text-xs">
                  {new Date(workflow.createdAt).toLocaleString("zh-CN")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">更新时间</dt>
                <dd className="text-gray-900 dark:text-gray-100 text-xs">
                  {new Date(workflow.updatedAt).toLocaleString("zh-CN")}
                </dd>
              </div>
            </dl>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
