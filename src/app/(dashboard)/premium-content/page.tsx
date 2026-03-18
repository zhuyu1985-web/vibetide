export const dynamic = "force-dynamic";

import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getPipelineNodes,
  getHitTemplates,
  getDefaultEDLProject,
  getActivityLogs,
} from "@/lib/dal/creation";
import { getWorkflows } from "@/lib/dal/workflows";
import { PremiumContentClient } from "./premium-content-client";

export default async function PremiumContentPage() {
  let pipelineNodes: Awaited<ReturnType<typeof getPipelineNodes>> = [];
  let hitTemplates: Awaited<ReturnType<typeof getHitTemplates>> = [];
  let activityLogs: Awaited<ReturnType<typeof getActivityLogs>> = [];

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      const workflows = await getWorkflows();
      const activeWorkflow = workflows[0];

      [pipelineNodes, hitTemplates, activityLogs] = await Promise.all([
        activeWorkflow
          ? getPipelineNodes(activeWorkflow.id)
          : Promise.resolve([]),
        getHitTemplates(orgId),
        getActivityLogs(orgId),
      ]);
    }
  } catch {
    // Gracefully degrade when DB is unavailable
  }

  const edlProject = getDefaultEDLProject();

  return (
    <PremiumContentClient
      pipelineNodes={pipelineNodes}
      hitTemplates={hitTemplates}
      edlProject={edlProject}
      activityLogs={activityLogs}
    />
  );
}
