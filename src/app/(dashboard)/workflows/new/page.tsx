import { WorkflowEditor } from "@/components/workflows/workflow-editor";

export default function NewWorkflowPage() {
  return (
    <div className="-m-6 h-[calc(100%+48px)] overflow-hidden">
      <WorkflowEditor mode="create" />
    </div>
  );
}
