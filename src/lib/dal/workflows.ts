import type { WorkflowInstance } from "@/lib/types";

/**
 * Workflow instances and steps have been replaced by the mission system.
 * These stubs maintain API compatibility for pages not yet migrated.
 */

export async function getWorkflows(): Promise<WorkflowInstance[]> {
  return [];
}

export async function getWorkflow(
  _id: string
): Promise<WorkflowInstance | undefined> {
  return undefined;
}
