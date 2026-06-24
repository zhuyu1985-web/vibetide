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
        description="「源管理」配置采集任务（用什么方式、多久抓一次）；「媒体账号库」维护媒体在各平台的账号名单，供采集源「按账号抓」时引用。"
      />
      <ConfigSubtabs />
      <OutletsClient initialOutlets={initialOutlets} isAdmin={isAdmin} />
    </>
  );
}
