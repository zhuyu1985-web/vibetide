import { db } from "@/db";
import { workflowInstances, workflowSteps, aiEmployees } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { WorkflowInstance, WorkflowStepStatus } from "@/lib/types";
import type { EmployeeId } from "@/lib/constants";

export async function getWorkflows(): Promise<WorkflowInstance[]> {
  const rows = await db.query.workflowInstances.findMany({
    with: {
      steps: {
        with: {
          employee: true,
        },
        orderBy: (s, { asc }) => [asc(s.stepOrder)],
      },
    },
    orderBy: (w, { desc }) => [desc(w.startedAt)],
  });

  return rows.map((wf) => ({
    id: wf.id,
    topicId: wf.topicId || "",
    topicTitle: wf.topicTitle,
    startedAt: wf.startedAt.toISOString(),
    estimatedCompletion: wf.estimatedCompletion?.toISOString() || "",
    steps: wf.steps.map((step) => ({
      key: step.key,
      label: step.label,
      employeeId: (step.employee?.slug || "") as EmployeeId,
      status: step.status as WorkflowStepStatus,
      progress: step.progress,
      startedAt: step.startedAt?.toISOString(),
      completedAt: step.completedAt?.toISOString(),
      output: step.output || undefined,
    })),
  }));
}

export async function getWorkflow(
  id: string
): Promise<WorkflowInstance | undefined> {
  const wf = await db.query.workflowInstances.findFirst({
    where: eq(workflowInstances.id, id),
    with: {
      steps: {
        with: {
          employee: true,
        },
        orderBy: (s, { asc }) => [asc(s.stepOrder)],
      },
    },
  });

  if (!wf) return undefined;

  return {
    id: wf.id,
    topicId: wf.topicId || "",
    topicTitle: wf.topicTitle,
    startedAt: wf.startedAt.toISOString(),
    estimatedCompletion: wf.estimatedCompletion?.toISOString() || "",
    steps: wf.steps.map((step) => ({
      key: step.key,
      label: step.label,
      employeeId: (step.employee?.slug || "") as EmployeeId,
      status: step.status as WorkflowStepStatus,
      progress: step.progress,
      startedAt: step.startedAt?.toISOString(),
      completedAt: step.completedAt?.toISOString(),
      output: step.output || undefined,
    })),
  };
}
