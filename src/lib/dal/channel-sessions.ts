import { db } from "@/db";
import { channelSessions } from "@/db/schema/channel-sessions";
import { and, eq } from "drizzle-orm";

export type ChannelSessionRow = typeof channelSessions.$inferSelect;

/**
 * 内容生产闭环会话的长 TTL（7 天）。
 * 普通 ad-hoc 会话用 30min（SESSION_TTL_MS / FOLLOWUP_WINDOW_MS）；
 * 闭环会话因审核可能隔天回流，必须用长窗口，且过期也不清产出/上下文（见 computeExpiredResetPatch）。
 */
export const CONTENT_LOOP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type ExpiredResetPatch = Partial<typeof channelSessions.$inferInsert>;

/**
 * 计算"过期会话"的复位 patch（纯函数，便于单测）。
 * - 未过期（或无 expiresAt）→ 返回 null（不动）。
 * - 闭环会话（scenarioPhase !== 'idle'）→ 只清瞬时 ad-hoc 字段，**保留**
 *   lastArticleId / loopContext / scenarioPhase / activeTopicId，并续一个长 TTL 窗口。
 * - 普通会话 → 维持原行为：全清回干净 idle。
 */
export function computeExpiredResetPatch(
  session: Pick<ChannelSessionRow, "expiresAt" | "scenarioPhase">,
  now: number = Date.now(),
): ExpiredResetPatch | null {
  if (!session.expiresAt || new Date(session.expiresAt).getTime() >= now) {
    return null;
  }
  const isLoop = Boolean(session.scenarioPhase && session.scenarioPhase !== "idle");
  if (isLoop) {
    return {
      status: "idle",
      activeMissionId: null,
      clarifyRounds: 0,
      contextTurns: [],
      pendingPlan: null,
      pendingPublish: null,
      expiresAt: new Date(now + CONTENT_LOOP_TTL_MS),
      updatedAt: new Date(now),
      // 刻意不含 lastArticleId / loopContext / scenarioPhase / activeTopicId → 保留闭环产出
    };
  }
  return {
    status: "idle",
    activeMissionId: null,
    clarifyRounds: 0,
    contextTurns: [],
    pendingPlan: null,
    lastArticleId: null,
    pendingPublish: null,
    expiresAt: null,
    updatedAt: new Date(now),
  };
}

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
    const resetPatch = computeExpiredResetPatch(existing);
    if (resetPatch) {
      const [refreshed] = await db
        .update(channelSessions)
        .set(resetPatch)
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
      | "scenarioPhase"
      | "activeTopicId"
      | "loopContext"
    >
  >
): Promise<void> {
  await db
    .update(channelSessions)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(channelSessions.id, id));
}

/** 按主键 id 查会话（content-loop 异步 handler 用，回写前读最新 loopContext）。 */
export async function getSessionById(
  id: string,
): Promise<ChannelSessionRow | null> {
  const row = await db.query.channelSessions.findFirst({
    where: eq(channelSessions.id, id),
  });
  return row ?? null;
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
