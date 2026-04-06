export const dynamic = "force-dynamic";

import { getMyWorkflows, getBuiltinTemplates } from "@/lib/dal/workflow-templates";
import { createClient } from "@/lib/supabase/server";
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

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [mine, builtin] = await Promise.all([
        withTimeout(getMyWorkflows(user.id), []),
        withTimeout(getBuiltinTemplates(), []),
      ]);
      myWorkflows = mine;
      builtinTemplates = builtin;
    }
  } catch {
    // Graceful degradation — render empty state
  }

  return (
    <WorkflowsClient
      myWorkflows={myWorkflows}
      builtinTemplates={builtinTemplates}
    />
  );
}
