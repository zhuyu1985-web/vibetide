import { getMyWorkflows, getBuiltinTemplates } from "@/lib/dal/workflow-templates";
import { listScheduleSummariesByTemplateIds } from "@/lib/dal/workflow-template-schedules";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { isSuperAdmin } from "@/lib/rbac";
import { WorkflowsClient } from "./workflows-client";
import type { WorkflowTemplateRow } from "@/db/types";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 15000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function WorkflowsPage() {
  let myWorkflows: WorkflowTemplateRow[] = [];
  let builtinTemplates: WorkflowTemplateRow[] = [];
  let isAdmin = false;
  let scheduleByWorkflowId: Record<
    string,
    { cronExpression: string; enabled: boolean }
  > = {};

  try {
    const user = await getCurrentUser();

    if (user) {
      const [mine, builtin, admin, orgId] = await Promise.all([
        withTimeout(getMyWorkflows(user.id), []),
        withTimeout(getBuiltinTemplates(), []),
        withTimeout(isSuperAdmin(user.id), false),
        getCurrentUserOrg(),
      ]);
      myWorkflows = mine;
      builtinTemplates = builtin;
      isAdmin = admin;

      if (orgId && mine.length > 0) {
        const summaries = await listScheduleSummariesByTemplateIds(
          orgId,
          mine.map((w) => w.id),
        );
        scheduleByWorkflowId = Object.fromEntries(summaries);
      }
    }
  } catch {
    // Graceful degradation — render empty state
  }

  return (
    <WorkflowsClient
      myWorkflows={myWorkflows}
      builtinTemplates={builtinTemplates}
      scheduleByWorkflowId={scheduleByWorkflowId}
      isAdmin={isAdmin}
    />
  );
}
