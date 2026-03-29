import { getMissionsWithActiveTasks } from "@/lib/dal/missions";
import { MissionsClient } from "./missions-client";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { retryStuckMissions } from "@/app/actions/missions";
import { after } from "next/server";

export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  const orgId = await getCurrentUserOrg();

  const missions = orgId ? await getMissionsWithActiveTasks(orgId) : [];

  // Auto-detect and retry stuck missions (planning with 0 tasks for > 2 min)
  if (orgId) {
    const stuck = missions.filter(
      (m) => m.status === "planning" && m.totalTaskCount === 0 &&
        Date.now() - new Date(m.createdAt).getTime() > 2 * 60 * 1000
    );
    if (stuck.length > 0) {
      after(async () => {
        for (const m of stuck) {
          await retryStuckMissions(m.id).catch(() => {});
        }
      });
    }
  }

  return (
    <MissionsClient missions={missions} />
  );
}
