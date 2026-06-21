import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { missions } from "@/db/schema";

/**
 * 无登录态取消渠道发起的 mission（IM ChatOps 用，无 requireAuth）。
 * org 隔离 + 终态守卫：只取消仍在途的 mission，防把已 completed/failed 误覆盖成 cancelled。
 * @returns 是否真取消了一个在途 mission（false = 该 mission 已是终态 / 不属于该 org）
 */
export async function cancelChannelMission(
  missionId: string,
  organizationId: string,
): Promise<boolean> {
  const rows = await db
    .update(missions)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(
      and(
        eq(missions.id, missionId),
        eq(missions.organizationId, organizationId),
        notInArray(missions.status, ["completed", "failed", "cancelled"]),
      ),
    )
    .returning({ id: missions.id });
  return rows.length > 0;
}
