import { requireAuth } from "@/lib/auth";
import { listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import { OutletsClient } from "./outlets-client";
import { ConfigSubtabs } from "../config-subtabs";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function OutletsPage() {
  const user = await requireAuth();
  const initialOutlets = await listOutletsByOrg(user.organizationId, { includeInactive: true });
  const isAdmin = user.isSuperAdmin;
  return (
    <>
      <PageHeader
        title="采集配置"
        description="管理采集源、调度规则和媒体字典，统一配置内容入库来源。"
      />
      <ConfigSubtabs />
      <OutletsClient initialOutlets={initialOutlets} isAdmin={isAdmin} />
    </>
  );
}
