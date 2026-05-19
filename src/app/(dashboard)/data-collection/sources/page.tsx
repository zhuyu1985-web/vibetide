import { listCollectionSources } from "@/lib/dal/collection";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import { redirect } from "next/navigation";
import { SourcesClient } from "./sources-client";
import { listAdapterMetas } from "@/lib/collection/adapter-meta";
import { ConfigSubtabs } from "../config-subtabs";
import { PageHeader } from "@/components/shared/page-header";

export default async function SourcesPage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const [sources, adapterMetas, outlets] = await Promise.all([
    listCollectionSources(orgId),
    Promise.resolve(listAdapterMetas()),
    listOutletsByOrg(orgId),
  ]);

  return (
    <>
      <PageHeader
        title="采集配置"
        description="管理采集源、调度规则和媒体字典，统一配置内容入库来源。"
      />
      <ConfigSubtabs />
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
          // A1 (2026-05-14)
          outletId: s.outletId ?? null,
        }))}
        adapterMetas={adapterMetas}
        outlets={outlets.map((o) => ({ id: o.id, outletName: o.outletName }))}
      />
    </>
  );
}
