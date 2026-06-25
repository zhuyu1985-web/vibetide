/**
 * cowork-conversations DAL —— cowork 单窗口会话 + 消息读写接口。
 *
 * 与旧 `conversations.ts`(saved_conversations,员工 1:1)并存且互不干扰;
 * 旧文件保留只读直到 P8 清理。本文件只读写新表 conversations /
 * conversation_messages。
 *
 * 隔离:会话查询用 (organization_id, user_id) 双约束;消息按 conversationId
 * 查(调用方需先确认会话 ownership)。
 */
import { db } from "@/db";
import { conversations, conversationMessages } from "@/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";

export interface CreateConversationInput {
  title: string;
  projectId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AppendMessageInput {
  role: "user" | "assistant" | "system";
  content?: string;
  kind?:
    | "text"
    | "mission_card"
    | "plan_card"
    | "draft_result"
    | "multi_version_card";
  /** 这条消息承载的 mission(mission_card 用) */
  missionId?: string | null;
  /** 产出这条的员工(替代旧 employeeSlug) */
  executedByEmployeeId?: string | null;
  /** 富信息:durationMs/thinkingSteps/skillsUsed/sources/intentResult */
  meta?: Record<string, unknown> | null;
}

export interface UpdateConversationInput {
  title?: string;
  summary?: string | null;
  projectId?: string | null;
  status?: "active" | "archived";
  /** 置顶时间;传 Date 置顶、传 null 取消置顶 */
  pinnedAt?: Date | null;
}

/** 列出某用户的会话(默认只 active,按最近活跃倒序);可选按项目过滤 */
export async function listConversationsByUser(
  orgId: string,
  userId: string,
  opts: { projectId?: string | null; includeArchived?: boolean } = {},
) {
  const filters = [
    eq(conversations.organizationId, orgId),
    eq(conversations.userId, userId),
  ];
  if (!opts.includeArchived) filters.push(eq(conversations.status, "active"));
  if (opts.projectId != null) {
    filters.push(eq(conversations.projectId, opts.projectId));
  }
  return db
    .select()
    .from(conversations)
    .where(and(...filters))
    // 置顶组(pinnedAt 非 null)在前,组内均按最近活跃倒序
    .orderBy(
      sql`${conversations.pinnedAt} IS NOT NULL DESC`,
      desc(conversations.lastMessageAt),
    );
}

/** 取单个会话(校验 org + user ownership);不存在/越权返回 null */
export async function getConversationById(
  orgId: string,
  userId: string,
  id: string,
) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.organizationId, orgId),
        eq(conversations.userId, userId),
        eq(conversations.id, id),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 取会话 + 全部消息(按创建时间升序);会话不存在/越权返回 null */
export async function getConversationWithMessages(
  orgId: string,
  userId: string,
  id: string,
) {
  const conversation = await getConversationById(orgId, userId, id);
  if (!conversation) return null;
  const messages = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, id))
    .orderBy(asc(conversationMessages.createdAt));
  return { conversation, messages };
}

export async function createConversation(
  orgId: string,
  userId: string,
  input: CreateConversationInput,
) {
  const [row] = await db
    .insert(conversations)
    .values({
      organizationId: orgId,
      userId,
      title: input.title,
      projectId: input.projectId ?? null,
      summary: input.summary ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();
  return row;
}

/**
 * 追加一条消息,并把会话的 lastMessageAt / updatedAt 顶到最新(用于会话列表
 * 置顶排序)。两条语句不放事务:时间戳轻微滞后无副作用,换取与 PgBouncer
 * transaction-mode pooler 的兼容简单性。调用方应已确认会话 ownership。
 */
export async function appendMessage(
  conversationId: string,
  input: AppendMessageInput,
) {
  const [message] = await db
    .insert(conversationMessages)
    .values({
      conversationId,
      role: input.role,
      content: input.content ?? "",
      kind: input.kind ?? "text",
      missionId: input.missionId ?? null,
      executedByEmployeeId: input.executedByEmployeeId ?? null,
      meta: input.meta ?? null,
    })
    .returning();
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
  return message;
}

/** 把某条消息(通常是 mission_card)关联到一个 mission */
export async function linkMissionToMessage(
  messageId: string,
  missionId: string,
) {
  const [row] = await db
    .update(conversationMessages)
    .set({ missionId })
    .where(eq(conversationMessages.id, messageId))
    .returning();
  return row ?? null;
}

export async function updateConversation(
  orgId: string,
  userId: string,
  id: string,
  input: UpdateConversationInput,
) {
  const patch: Partial<typeof conversations.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.title !== undefined) patch.title = input.title;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.projectId !== undefined) patch.projectId = input.projectId;
  if (input.status !== undefined) patch.status = input.status;
  if (input.pinnedAt !== undefined) patch.pinnedAt = input.pinnedAt;

  const [row] = await db
    .update(conversations)
    .set(patch)
    .where(
      and(
        eq(conversations.organizationId, orgId),
        eq(conversations.userId, userId),
        eq(conversations.id, id),
      ),
    )
    .returning();
  return row ?? null;
}

/** 硬删除会话(消息因 FK cascade 自动删);mission.conversationId 软引用置脏不影响 mission */
export async function deleteConversation(
  orgId: string,
  userId: string,
  id: string,
) {
  const [row] = await db
    .delete(conversations)
    .where(
      and(
        eq(conversations.organizationId, orgId),
        eq(conversations.userId, userId),
        eq(conversations.id, id),
      ),
    )
    .returning({ id: conversations.id });
  return row?.id ?? null;
}
