import { getWorkflowTemplate } from "@/lib/dal/workflow-templates";
import { WorkflowEditor } from "@/components/workflows/workflow-editor";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workflow = await getWorkflowTemplate(id);
  if (!workflow) return notFound();

  return (
    <div className="-m-6 h-[calc(100vh-56px)]">
      <WorkflowEditor
        mode="edit"
        initialData={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description || "",
          category: workflow.category || "custom",
          triggerType: workflow.triggerType || "manual",
          triggerConfig: workflow.triggerConfig,
          steps: workflow.steps,
        }}
      />
    </div>
  );
}
