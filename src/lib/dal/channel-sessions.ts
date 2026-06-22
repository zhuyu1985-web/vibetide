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
        .set({ status: "idle", activeMissionId: null, clarifyRounds: 0, contextTurns: [], pendingPlan: null, lastArticleId: null, pendingPublish: null, expiresAt: null, updatedAt: new Date() })
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
      | "lastArticleId"
      | "pendingPublish"
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
      lastArticleId: null,
      pendingPublish: null,
      expiresAt: null,
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

/** mission 成功出结果后的跟进窗口：30 分钟内回话可在上次基础上重做。 */
export const FOLLOWUP_WINDOW_MS = 30 * 60 * 1000;

/**
 * 仅更新 lastArticleId + 刷新 30min 跟进窗口。
 * link-ingest 收稿后调用，把新落库的 articleId 写入会话，让后续配图/发布分支能拿到。
 *
 * **只在 status='idle' 时生效**（条件 UPDATE）：链接分支在 gateway 里排在 running 检查之前，
 * mission 进行中（clarifying/confirming/running）用户发链接也会派 link-ingest。若此时无条件刷
 * expiresAt，会给本无过期的进行中会话强加 30min 窗口——mission 跑超 30min 后下条消息触发
 * getOrCreateSession 过期复位，清掉 activeMissionId，导致终态回执反查不到会话、结果丢失。
 * 跟进窗口本就是 idle 态特性，故进行中会话下这里直接 no-op，不动任何字段。
 */
export async function setSessionLastArticleId(
  key: Pick<SessionKey, "configId" | "chatId" | "externalUserId">,
  articleId: string,
): Promise<void> {
  await db
    .update(channelSessions)
    .set({
      lastArticleId: articleId,
      expiresAt: new Date(Date.now() + FOLLOWUP_WINDOW_MS),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(channelSessions.configId, key.configId),
        eq(channelSessions.chatId, key.chatId),
        eq(channelSessions.externalUserId, key.externalUserId),
        eq(channelSessions.status, "idle")
      )
    );
}

/**
 * mission 成功出结果后调用：软复位为 idle，把"上次请求 + 已完成摘要"写进 contextTurns，
 * 设 30min 跟进窗口。用户在窗口内回话时 clarifyOrPlan 自动带上这段上下文（一键跟进）。
 * 过期由 getOrCreateSession 的过期分支清掉 contextTurns，回干净 idle。
 */
export async function recordSessionResult(
  key: Pick<SessionKey, "configId" | "chatId" | "externalUserId">,
  args: { instruction: string; resultSummary: string; articleId?: string }
): Promise<void> {
  await db
    .update(channelSessions)
    .set({
      status: "idle",
      activeMissionId: null,
      clarifyRounds: 0,
      pendingPlan: null,
      lastArticleId: args.articleId ?? null,
      contextTurns: [
        { role: "user", content: args.instruction },
        { role: "assistant", content: `已完成：${args.resultSummary}` },
      ],
      expiresAt: new Date(Date.now() + FOLLOWUP_WINDOW_MS),
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
