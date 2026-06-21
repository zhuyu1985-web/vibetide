import { getWorkflowTemplate } from "@/lib/dal/workflow-templates";
import { listSkillsForWorkflowPicker } from "@/lib/dal/skills";
import { getAllToolParamSpecs } from "@/lib/agent/tool-registry";
import { WorkflowEditor } from "@/components/workflows/workflow-editor";
import { notFound } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { listSchedulesByTemplate } from "@/lib/dal/workflow-template-schedules";
import { listDomainsByOrg } from "@/lib/dal/domains";

export default async function EditWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [workflow, skills] = await Promise.all([
    getWorkflowTemplate(id),
    listSkillsForWorkflowPicker().catch(() => []),
  ]);
  if (!workflow) return notFound();

  // 预计算所有工具的 zod inputSchema → JSON Schema → ToolParamSpec[]。
  // 必须在 server 侧做：tool-registry 拖着 db / drizzle 依赖，客户端 bundle 里
  // 不能 import。
  const toolParamSpecs = getAllToolParamSpecs();

  // 2026-05-29 — 编辑器 Trigger Sheet 需要 per-template schedule 列表(用作初始
  // 状态 + 卡片摘要)。仅当模板属于当前 org 才有意义,跨 org 浏览时返回空数组。
  const orgId = await getCurrentUserOrg();
  const initialSchedules =
    orgId && workflow.organizationId === orgId
      ? await listSchedulesByTemplate(orgId, id)
      : [];
  const domains = orgId ? await listDomainsByOrg(orgId).catch(() => []) : [];

  return (
    <div className="-m-6 h-[calc(100%+48px)] overflow-hidden">
      <WorkflowEditor
        mode="edit"
        skills={skills}
        toolParamSpecs={toolParamSpecs}
        domains={domains}
        initialData={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description || "",
          category: workflow.category || "custom",
          triggerType: workflow.triggerType || "manual",
          triggerConfig: workflow.triggerConfig,
          steps: workflow.steps,
          inputFields: workflow.inputFields ?? [],
          promptTemplate: workflow.promptTemplate ?? "",
          defaultDomainId: workflow.defaultDomainId ?? null,
        }}
        initialSchedules={initialSchedules}
        workflowMeta={{
          id: workflow.id,
          name: workflow.name,
          inputFields: workflow.inputFields ?? [],
        }}
      />
    </div>
  );
}
