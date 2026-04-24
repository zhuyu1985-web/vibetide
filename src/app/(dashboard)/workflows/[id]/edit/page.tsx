import { getWorkflowTemplate } from "@/lib/dal/workflow-templates";
import { listSkillsForWorkflowPicker } from "@/lib/dal/skills";
import { getAllToolParamSpecs } from "@/lib/agent/tool-registry";
import { WorkflowEditor } from "@/components/workflows/workflow-editor";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

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

  return (
    <div className="-m-6 h-[calc(100%+48px)] overflow-hidden">
      <WorkflowEditor
        mode="edit"
        skills={skills}
        toolParamSpecs={toolParamSpecs}
        initialData={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description || "",
          category: workflow.category || "custom",
          triggerType: workflow.triggerType || "manual",
          triggerConfig: workflow.triggerConfig,
          steps: workflow.steps,
          inputFields: workflow.inputFields ?? [],
          launchMode:
            workflow.launchMode === "direct" ? "direct" : "form",
          promptTemplate: workflow.promptTemplate ?? "",
        }}
      />
    </div>
  );
}
