import { db } from "@/db";
import { channelSessions } from "@/db/schema/channel-sessions";
import { and, eq } from "drizzle-orm";

export type ChannelSessionRow = typeof channelSessions.$inferSelect;

export interface SessionKey {
  organizationId: string;
  configId: string;
  platform: "dingtalk" | "wechat_work";
  chatId: string;
  externalUserId: string;
}

/**
 * 按三元组键（configId + chatId + externalUserId）查找已有会话，
 * 不存在则插入新行并返回。
 */
export async function getOrCreateSession(
  key: SessionKey
): Promise<ChannelSessionRow> {
  const existing = await db.query.channelSessions.findFirst({
    where: and(
      eq(channelSessions.configId, key.configId),
      eq(channelSessions.chatId, key.chatId),
      eq(channelSessions.externalUserId, key.externalUserId)
    ),
  });
  if (existing) {
    if (existing.expiresAt && new Date(existing.expiresAt).getTime() < Date.now()) {
      const [refreshed] = await db
        .update(channelSessions)
        .set({ status: "idle", activeMissionId: null, clarifyRounds: 0, contextTurns: [], pendingPlan: null, expiresAt: null, updatedAt: new Date() })
        .where(eq(channelSessions.id, existing.id))
        .returning();
      return refreshed;
    }
    return existing;
  }

  const [row] = await db
    .insert(channelSessions)
    .values({
      organizationId: key.organizationId,
      configId: key.configId,
      platform: key.platform,
      chatId: key.chatId,
      externalUserId: key.externalUserId,
    })
    .returning();
  return row;
}

/**
 * 更新指定会话（按 id）的部分字段。
 */
export async function updateSession(
  id: string,
  patch: Partial<
    Pick<
      ChannelSessionRow,
      | "status"
      | "contextTurns"
      | "activeMissionId"
      | "clarifyRounds"
      | "expiresAt"
      | "pendingPlan"
    >
  >
): Promise<void> {
  await db
    .update(channelSessions)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(channelSessions.id, id));
}

/**
 * 按 activeMissionId 反查渠道会话，给终态回执 handler 使用。
 * 查不到返回 null。
 */
export async function getSessionByActiveMissionId(
  missionId: string,
): Promise<ChannelSessionRow | null> {
  const row = await db.query.channelSessions.findFirst({
    where: eq(channelSessions.activeMissionId, missionId),
  });
  return row ?? null;
}

/**
 * 按三元组键将会话复位为 idle 状态，清除 activeMissionId 和澄清轮次。
 */
export async function resetSession(
  key: Pick<SessionKey, "configId" | "chatId" | "externalUserId">
): Promise<void> {
  await db
    .update(channelSessions)
    .set({
      status: "idle",
      activeMissionId: null,
      clarifyRounds: 0,
      contextTurns: [],
      pendingPlan: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(channelSessions.configId, key.configId),
        eq(channelSessions.chatId, key.chatId),
        eq(channelSessions.externalUserId, key.externalUserId)
      )
    );
}
