import { getMissionsWithActiveTasks } from "@/lib/dal/missions";
import { MissionsClient } from "./missions-client";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { cleanupStuckMissions } from "@/app/actions/missions";
import { after } from "next/server";

export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  const orgId = await getCurrentUserOrg();

  const missions = orgId ? await getMissionsWithActiveTasks(orgId) : [];

  // 页面加载时自动清理卡住的任务和员工
  if (orgId) {
    after(async () => {
      await cleanupStuckMissions().catch(() => {});
    });
  }

  return (
    <MissionsClient missions={missions} />
  );
}
