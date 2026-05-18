import { requireAuth } from "@/lib/auth";
import { listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import { OutletsClient } from "./outlets-client";
import { ConfigSubtabs } from "../config-subtabs";

export const dynamic = "force-dynamic";

export default async function OutletsPage() {
  const user = await requireAuth();
  const initialOutlets = await listOutletsByOrg(user.organizationId, { includeInactive: true });
  const isAdmin = user.isSuperAdmin;
  return (
    <>
      <ConfigSubtabs />
      <OutletsClient initialOutlets={initialOutlets} isAdmin={isAdmin} />
    </>
  );
}
