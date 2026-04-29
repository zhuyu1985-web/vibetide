import { listCollectionSources } from "@/lib/dal/collection";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { redirect } from "next/navigation";
import { SourcesClient } from "./sources-client";
import { listAdapterMetas } from "@/lib/collection/adapter-meta";

export default async function SourcesPage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const [sources, adapterMetas] = await Promise.all([
    listCollectionSources(orgId),
    Promise.resolve(listAdapterMetas()),
  ]);

  return (
    <SourcesClient
      initialSources={sources.map((s) => ({
        id: s.id,
        name: s.name,
        sourceType: s.sourceType,
        enabled: s.enabled,
        scheduleCron: s.scheduleCron,
        targetModules: s.targetModules,
        lastRunAt: s.lastRunAt?.toISOString() ?? null,
        lastRunStatus: s.lastRunStatus,
        totalItemsCollected: s.totalItemsCollected,
      }))}
      adapterMetas={adapterMetas}
    />
  );
}
