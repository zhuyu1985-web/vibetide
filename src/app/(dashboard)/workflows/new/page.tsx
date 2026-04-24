import { WorkflowEditor } from "@/components/workflows/workflow-editor";
import { listSkillsForWorkflowPicker } from "@/lib/dal/skills";
import { getAllToolParamSpecs } from "@/lib/agent/tool-registry";

export const dynamic = "force-dynamic";

export default async function NewWorkflowPage() {
  const skills = await listSkillsForWorkflowPicker().catch(() => []);
  // 预计算工具参数 spec 透传给 WorkflowEditor —— 客户端不能直接 import
  // tool-registry（server-only 依赖）。
  const toolParamSpecs = getAllToolParamSpecs();

  return (
    <div className="-m-6 h-[calc(100%+48px)] overflow-hidden">
      <WorkflowEditor
        mode="create"
        skills={skills}
        toolParamSpecs={toolParamSpecs}
      />
    </div>
  );
}
