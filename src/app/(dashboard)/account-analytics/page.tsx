import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  listAnalyzableAccounts,
  type AnalyzableAccountRow,
} from "@/lib/dal/account-analytics";
import { listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import type { OutletOption } from "@/components/account-analytics/bind-account-dialog";
import { AccountAnalyticsLandingClient } from "./account-analytics-landing-client";

export const dynamic = "force-dynamic";

export default async function AccountAnalyticsPage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  let accounts: AnalyzableAccountRow[] = [];
  let outlets: OutletOption[] = [];
  try {
    accounts = await listAnalyzableAccounts(orgId, { source: "both" });
  } catch (err) {
    console.error("[account-analytics] 加载账号列表失败:", err);
  }
  try {
    const rows = await listOutletsByOrg(orgId, { includeInactive: false });
    outlets = rows.map((r) => ({
      id: r.id,
      outletName: r.outletName,
      outletTier: r.outletTier,
      outletRegion: r.outletRegion,
      channels: (r.channels ?? []).map((c) => ({
        type: c.type as string,
        nickname:
          "nickname" in c && typeof c.nickname === "string"
            ? c.nickname
            : undefined,
      })),
    }));
  } catch (err) {
    console.error("[account-analytics] 加载媒体字典失败:", err);
  }

  return (
    <AccountAnalyticsLandingClient accounts={accounts} outlets={outlets} />
  );
}
