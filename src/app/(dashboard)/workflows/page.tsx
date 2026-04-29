import { getMyWorkflows, getBuiltinTemplates } from "@/lib/dal/workflow-templates";
import { getCurrentUser } from "@/lib/auth";
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

  try {
    const user = await getCurrentUser();

    if (user) {
      const [mine, builtin, admin] = await Promise.all([
        withTimeout(getMyWorkflows(user.id), []),
        withTimeout(getBuiltinTemplates(), []),
        withTimeout(isSuperAdmin(user.id), false),
      ]);
      myWorkflows = mine;
      builtinTemplates = builtin;
      isAdmin = admin;
    }
  } catch {
    // Graceful degradation — render empty state
  }

  return (
    <WorkflowsClient
      myWorkflows={myWorkflows}
      builtinTemplates={builtinTemplates}
      isAdmin={isAdmin}
    />
  );
}
