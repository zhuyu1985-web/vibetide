"use server";

import { db } from "@/db";
import { channelConfigs, channelMessages } from "@/db/schema/channels";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getChannelConfigForOrg } from "@/lib/dal/channels";
import type { ChannelPlatform, ChannelMessageStatus } from "@/lib/dal/channels";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
async function requireOrg(): Promise<string> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");
  return orgId;
}

// ---------------------------------------------------------------------------
// 1. createChannelConfig — create a new channel integration config
// ---------------------------------------------------------------------------

export async function createChannelConfig(input: {
  platform: ChannelPlatform;
  name: string;
  appKey?: string;
  appSecret?: string;
  robotSecret?: string;
  agentId?: string;
  token?: string;
  encodingAesKey?: string;
  isEnabled?: boolean;
}): Promise<{ id: string }> {
  const orgId = await requireOrg();

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("渠道名称不能为空");

  const [created] = await db
    .insert(channelConfigs)
    .values({
      organizationId: orgId,
      platform: input.platform,
      name: trimmedName,
      appKey: input.appKey?.trim() || null,
      appSecret: input.appSecret?.trim() || null,
      robotSecret: input.robotSecret?.trim() || null,
      agentId: input.agentId?.trim() || null,
      token: input.token?.trim() || null,
      encodingAesKey: input.encodingAesKey?.trim() || null,
      isEnabled: input.isEnabled ?? true,
    })
    .returning({ id: channelConfigs.id });

  revalidatePath("/settings/channels");
  return { id: created.id };
}

// ---------------------------------------------------------------------------
// 2. updateChannelConfig — update an existing config (with org ownership check)
// ---------------------------------------------------------------------------

export async function updateChannelConfig(
  configId: string,
  updates: {
    name?: string;
    appKey?: string | null;
    appSecret?: string | null;
    robotSecret?: string | null;
    agentId?: string | null;
    token?: string | null;
    encodingAesKey?: string | null;
    isEnabled?: boolean;
  }
) {
  const orgId = await requireOrg();

  const existing = await db.query.channelConfigs.findFirst({
    where: and(
      eq(channelConfigs.id, configId),
      eq(channelConfigs.organizationId, orgId)
    ),
  });
  if (!existing) throw new Error("渠道配置不存在或无权访问");

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    if (!trimmed) throw new Error("渠道名称不能为空");
    patch.name = trimmed;
  }
  if (updates.appKey !== undefined) patch.appKey = updates.appKey?.trim() || null;
  if (updates.appSecret !== undefined) patch.appSecret = updates.appSecret?.trim() || null;
  if (updates.robotSecret !== undefined) patch.robotSecret = updates.robotSecret?.trim() || null;
  if (updates.agentId !== undefined) patch.agentId = updates.agentId?.trim() || null;
  if (updates.token !== undefined) patch.token = updates.token?.trim() || null;
  if (updates.encodingAesKey !== undefined) patch.encodingAesKey = updates.encodingAesKey?.trim() || null;
  if (updates.isEnabled !== undefined) patch.isEnabled = updates.isEnabled;

  await db
    .update(channelConfigs)
    .set(patch)
    .where(eq(channelConfigs.id, configId));

  revalidatePath("/settings/channels");
}

// ---------------------------------------------------------------------------
// 3. deleteChannelConfig — delete a config (with org ownership check)
// ---------------------------------------------------------------------------

export async function deleteChannelConfig(configId: string) {
  const orgId = await requireOrg();

  const existing = await db.query.channelConfigs.findFirst({
    where: and(
      eq(channelConfigs.id, configId),
      eq(channelConfigs.organizationId, orgId)
    ),
  });
  if (!existing) throw new Error("渠道配置不存在或无权访问");

  await db.delete(channelConfigs).where(eq(channelConfigs.id, configId));

  revalidatePath("/settings/channels");
}

// ---------------------------------------------------------------------------
// 4. toggleChannelConfig — enable / disable a config (with org ownership check)
// ---------------------------------------------------------------------------

export async function toggleChannelConfig(configId: string, enabled: boolean) {
  const orgId = await requireOrg();

  const existing = await db.query.channelConfigs.findFirst({
    where: and(
      eq(channelConfigs.id, configId),
      eq(channelConfigs.organizationId, orgId)
    ),
  });
  if (!existing) throw new Error("渠道配置不存在或无权访问");

  await db
    .update(channelConfigs)
    .set({ isEnabled: enabled, updatedAt: new Date() })
    .where(eq(channelConfigs.id, configId));

  revalidatePath("/settings/channels");
}

// ---------------------------------------------------------------------------
// Internal utilities — no auth required (called by webhooks / Inngest)
// ---------------------------------------------------------------------------

// 5. recordInboundMessage — persist an inbound message from a platform webhook
export async function recordInboundMessage(input: {
  organizationId: string;
  configId: string;
  platform: ChannelPlatform;
  externalMessageId?: string;
  externalUserId?: string;
  chatId?: string;
  content: Record<string, unknown>;
}): Promise<{ messageId: string }> {
  const [created] = await db
    .insert(channelMessages)
    .values({
      organizationId: input.organizationId,
      configId: input.configId,
      platform: input.platform,
      direction: "inbound",
      externalMessageId: input.externalMessageId ?? null,
      externalUserId: input.externalUserId ?? null,
      chatId: input.chatId ?? null,
      content: input.content,
      status: "received",
    })
    .returning({ id: channelMessages.id });

  return { messageId: created.id };
}

// 6. recordOutboundMessage — persist an outbound message before sending
export async function recordOutboundMessage(input: {
  organizationId: string;
  configId: string;
  platform: ChannelPlatform;
  externalUserId?: string;
  chatId?: string;
  content: Record<string, unknown>;
  missionId?: string;
  status: ChannelMessageStatus;
}): Promise<{ messageId: string }> {
  const [created] = await db
    .insert(channelMessages)
    .values({
      organizationId: input.organizationId,
      configId: input.configId,
      platform: input.platform,
      direction: "outbound",
      externalUserId: input.externalUserId ?? null,
      chatId: input.chatId ?? null,
      content: input.content,
      missionId: input.missionId ?? null,
      status: input.status,
    })
    .returning({ id: channelMessages.id });

  return { messageId: created.id };
}

// 7. updateMessageStatus — update delivery status of any message
export async function updateMessageStatus(
  messageId: string,
  status: ChannelMessageStatus,
  errorMessage?: string
) {
  await db
    .update(channelMessages)
    .set({
      status,
      errorMessage: errorMessage ?? null,
    })
    .where(eq(channelMessages.id, messageId));
}

// ---------------------------------------------------------------------------
// 8. testChannelConfig — send a test message to verify a config works
// ---------------------------------------------------------------------------

export async function testChannelConfig(
  configId: string
): Promise<{ success: boolean; message: string }> {
  const orgId = await requireOrg();

  // Get config with ownership check
  const config = await getChannelConfigForOrg(configId, orgId);
  if (!config) {
    return { success: false, message: "配置不存在或无权限" };
  }

  // Send a test message
  try {
    const { sendChannelMessage } = await import("@/lib/channels/outbound");
    const result = await sendChannelMessage({
      config,
      // DingTalk webhook sends to the bot's group regardless of chatId;
      // WeChat Work requires a real touser — "@all" broadcasts to all app users.
      chatId: config.platform === "wechat_work" ? "@all" : "",
      type: "text",
      content: `🔧 VibeTide 渠道连接测试 — ${new Date().toLocaleString("zh-CN")}`,
    });

    if (result.success) {
      return {
        success: true,
        message: "测试消息发送成功，请查看对应的钉钉/企业微信",
      };
    }
    return { success: false, message: result.error ?? "发送失败" };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "未知错误",
    };
  }
}
