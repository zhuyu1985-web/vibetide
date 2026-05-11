import { redirect } from "next/navigation";
import { listAdapterMetas } from "@/lib/collection/adapter-meta";
import { listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { NewSourceWizardClient } from "./new-source-wizard-client";

export default async function NewSourcePage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const [adapterMetas, outlets] = await Promise.all([
    Promise.resolve(listAdapterMetas()),
    listOutletsByOrg(orgId),
  ]);

  return (
    <NewSourceWizardClient
      adapterMetas={adapterMetas}
      outlets={outlets.map((o) => ({
        id: o.id,
        outletName: o.outletName,
        outletTier: o.outletTier,
        // M4 新增:供 tikhub account 模式过滤"哪些 outlets 在某平台有 channel"
        channels: (o.channels ?? []) as Array<{ type: string; nickname?: string; name?: string }>,
      }))}
    />
  );
}
