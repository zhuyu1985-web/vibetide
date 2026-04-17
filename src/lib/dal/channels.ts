import { db } from "@/db";
import { channelConfigs, channelMessages } from "@/db/schema/channels";
import { eq, and, desc } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChannelPlatform = "dingtalk" | "wechat_work";
export type ChannelMessageDirection = "inbound" | "outbound";
export type ChannelMessageStatus = "received" | "processed" | "sent" | "failed";

export type ChannelConfigRow = {
  id: string;
  organizationId: string;
  platform: ChannelPlatform;
  name: string;
  appKey: string | null;
  appSecret: string | null;
  robotSecret: string | null;
  agentId: string | null;
  token: string | null;
  encodingAesKey: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChannelMessageRow = {
  id: string;
  organizationId: string;
  configId: string;
  platform: ChannelPlatform;
  direction: ChannelMessageDirection;
  externalMessageId: string | null;
  externalUserId: string | null;
  chatId: string | null;
  content: Record<string, unknown>;
  missionId: string | null;
  status: ChannelMessageStatus;
  errorMessage: string | null;
  createdAt: string;
};

export type ListChannelMessagesFilters = {
  platform?: ChannelPlatform;
  direction?: ChannelMessageDirection;
  configId?: string;
  limit?: number;
  offset?: number;
};

export type PaginatedChannelMessages = {
  rows: ChannelMessageRow[];
  limit: number;
  offset: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIso(value: Date | string | null | undefined): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : value;
}

function mapChannelConfig(
  r: typeof channelConfigs.$inferSelect
): ChannelConfigRow {
  return {
    id: r.id,
    organizationId: r.organizationId,
    platform: r.platform as ChannelPlatform,
    name: r.name,
    appKey: r.appKey ?? null,
    appSecret: r.appSecret ?? null,
    robotSecret: r.robotSecret ?? null,
    agentId: r.agentId ?? null,
    token: r.token ?? null,
    encodingAesKey: r.encodingAesKey ?? null,
    isEnabled: r.isEnabled,
    createdAt: toIso(r.createdAt),
    updatedAt: toIso(r.updatedAt),
  };
}

function mapChannelMessage(
  r: typeof channelMessages.$inferSelect
): ChannelMessageRow {
  return {
    id: r.id,
    organizationId: r.organizationId,
    configId: r.configId,
    platform: r.platform as ChannelPlatform,
    direction: r.direction as ChannelMessageDirection,
    externalMessageId: r.externalMessageId ?? null,
    externalUserId: r.externalUserId ?? null,
    chatId: r.chatId ?? null,
    content: (r.content as Record<string, unknown>) ?? {},
    missionId: r.missionId ?? null,
    status: r.status as ChannelMessageStatus,
    errorMessage: r.errorMessage ?? null,
    createdAt: toIso(r.createdAt),
  };
}

// ---------------------------------------------------------------------------
// 1. listChannelConfigs — all configs for an org
// ---------------------------------------------------------------------------

export async function listChannelConfigs(
  organizationId: string
): Promise<ChannelConfigRow[]> {
  const rows = await db
    .select()
    .from(channelConfigs)
    .where(eq(channelConfigs.organizationId, organizationId))
    .orderBy(desc(channelConfigs.createdAt));

  return rows.map(mapChannelConfig);
}

// ---------------------------------------------------------------------------
// 2. getChannelConfig — single config by ID (no org check — for webhook lookup)
// ---------------------------------------------------------------------------

export async function getChannelConfig(
  configId: string
): Promise<ChannelConfigRow | null> {
  const row = await db.query.channelConfigs.findFirst({
    where: eq(channelConfigs.id, configId),
  });
  if (!row) return null;
  return mapChannelConfig(row);
}

// ---------------------------------------------------------------------------
// 3. getChannelConfigForOrg — single config by ID with org ownership check
// ---------------------------------------------------------------------------

export async function getChannelConfigForOrg(
  configId: string,
  organizationId: string
): Promise<ChannelConfigRow | null> {
  const row = await db.query.channelConfigs.findFirst({
    where: and(
      eq(channelConfigs.id, configId),
      eq(channelConfigs.organizationId, organizationId)
    ),
  });
  if (!row) return null;
  return mapChannelConfig(row);
}

// ---------------------------------------------------------------------------
// 4. listChannelMessages — paginated messages for an org with optional filters
// ---------------------------------------------------------------------------

export async function listChannelMessages(
  organizationId: string,
  filters?: ListChannelMessagesFilters
): Promise<PaginatedChannelMessages> {
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const conditions = [eq(channelMessages.organizationId, organizationId)];

  if (filters?.platform) {
    conditions.push(eq(channelMessages.platform, filters.platform));
  }
  if (filters?.direction) {
    conditions.push(eq(channelMessages.direction, filters.direction));
  }
  if (filters?.configId) {
    conditions.push(eq(channelMessages.configId, filters.configId));
  }

  const rows = await db
    .select()
    .from(channelMessages)
    .where(and(...conditions))
    .orderBy(desc(channelMessages.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    rows: rows.map(mapChannelMessage),
    limit,
    offset,
  };
}

// ---------------------------------------------------------------------------
// 5. getChannelMessage — single message by ID
// ---------------------------------------------------------------------------

export async function getChannelMessage(
  messageId: string
): Promise<ChannelMessageRow | null> {
  const row = await db.query.channelMessages.findFirst({
    where: eq(channelMessages.id, messageId),
  });
  if (!row) return null;
  return mapChannelMessage(row);
}
