import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getProductionTemplates, getTemplateStats } from "@/lib/dal/production-templates";
import { ProductionTemplatesClient } from "./production-templates-client";

export default async function ProductionTemplatesPage() {
  let templates: Awaited<ReturnType<typeof getProductionTemplates>> = [];
  let stats: Awaited<ReturnType<typeof getTemplateStats>> = { categories: [], totalTemplates: 0, totalUsage: 0 };

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      [templates, stats] = await Promise.all([
        getProductionTemplates(orgId),
        getTemplateStats(orgId),
      ]);
    }
  } catch {
    // Gracefully degrade when DB is unavailable
  }

  return (
    <ProductionTemplatesClient
      templates={templates}
      stats={stats}
    />
  );
}
