import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getHitTemplates,
  getDefaultEDLProject,
} from "@/lib/dal/creation";
import { PremiumContentClient } from "./premium-content-client";

export default async function PremiumContentPage() {
  let hitTemplates: Awaited<ReturnType<typeof getHitTemplates>> = [];

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      hitTemplates = await getHitTemplates(orgId);
    }
  } catch {
    // Gracefully degrade when DB is unavailable
  }

  const edlProject = getDefaultEDLProject();

  return (
    <PremiumContentClient
      pipelineNodes={[]}
      hitTemplates={hitTemplates}
      edlProject={edlProject}
      activityLogs={[]}
    />
  );
}
