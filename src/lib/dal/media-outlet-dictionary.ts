import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { mediaOutletDictionary, type MediaOutletRow } from "@/db/schema/media-outlet-dictionary";
import { organizations } from "@/db/schema/users";
import type { ChannelType } from "@/lib/media-outlet/channels";

export interface ListOutletsFilter {
  tier?: string;
  region?: string;
  search?: string;
  includeInactive?: boolean;
  /** 新增: 按 channel.type 过滤 — 如只看"有抖音号的 outlets" */
  channelType?: ChannelType;
  /** 新增: 按集团聚合(如"人民日报社"返回旗下所有 outlet) */
  groupName?: string;
}

export async function listOutletsByOrg(
  orgId: string,
  filter: ListOutletsFilter = {},
): Promise<MediaOutletRow[]> {
  const conditions = [eq(mediaOutletDictionary.organizationId, orgId)];
  if (!filter.includeInactive) {
    conditions.push(eq(mediaOutletDictionary.isActive, true));
  }
  if (filter.tier) {
    conditions.push(eq(mediaOutletDictionary.outletTier, filter.tier));
  }
  if (filter.region) {
    conditions.push(eq(mediaOutletDictionary.outletRegion, filter.region));
  }
  if (filter.search) {
    const q = `%${filter.search}%`;
    const searchExpr = or(
      ilike(mediaOutletDictionary.outletName, q),
      ilike(mediaOutletDictionary.groupName, q),
      // M1 新: 搜 channels 内部的 name/nickname/domain
      sql`${mediaOutletDictionary.channels}::text ILIKE ${q}`,
      // 旧字段过渡期保留(1-2 sprint 后清理)
      sql`EXISTS (SELECT 1 FROM unnest(${mediaOutletDictionary.publicAccountNames}) x WHERE x ILIKE ${q})`,
      sql`EXISTS (SELECT 1 FROM unnest(${mediaOutletDictionary.domains}) x WHERE x ILIKE ${q})`,
    );
    if (searchExpr) conditions.push(searchExpr);
  }
  if (filter.channelType) {
    conditions.push(
      sql`${mediaOutletDictionary.channels} @> ${JSON.stringify([{ type: filter.channelType }])}::jsonb`,
    );
  }
  if (filter.groupName) {
    conditions.push(eq(mediaOutletDictionary.groupName, filter.groupName));
  }
  return await db.select().from(mediaOutletDictionary)
    .where(and(...conditions))
    .orderBy(asc(mediaOutletDictionary.outletTier), asc(mediaOutletDictionary.outletName));
}

/**
 * 按 channel 中的账号识别符反查 outlet — 利用 channels_gin (jsonb_path_ops) 索引。
 *
 * 用法举例:
 *   - findOutletByChannelIdentifier(orgId, "douyin", "secUid", "MS4wLjABxxx")
 *   - findOutletByChannelIdentifier(orgId, "wechat_oa", "ghid", "gh_a3d35d4c9d3f")
 *   - findOutletByChannelIdentifier(orgId, "website", "domain", "people.com.cn")
 *
 * 返回首个匹配的 outlet(媒体字典本应保证 channel 标识符在 org 内唯一,但代码不强校验)。
 * M3 tikhub adapter 账号模式启动时调用此方法做 outlet 合法性校验 + 拿对应 channel 详情。
 */
export async function findOutletByChannelIdentifier(
  orgId: string,
  channelType: ChannelType,
  identifierField: string,
  identifierValue: string,
): Promise<MediaOutletRow | null> {
  // jsonb @> [{type, [field]: value}] containment 查询会命中 channels_gin 索引
  const probe = JSON.stringify([{ type: channelType, [identifierField]: identifierValue }]);
  const rows = await db
    .select()
    .from(mediaOutletDictionary)
    .where(
      and(
        eq(mediaOutletDictionary.organizationId, orgId),
        sql`${mediaOutletDictionary.channels} @> ${probe}::jsonb`,
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getOutletById(id: string, orgId: string): Promise<MediaOutletRow | null> {
  const rows = await db.select().from(mediaOutletDictionary)
    .where(and(eq(mediaOutletDictionary.id, id), eq(mediaOutletDictionary.organizationId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function searchOutletsByName(
  orgId: string, query: string, limit = 20,
): Promise<MediaOutletRow[]> {
  const rows = await listOutletsByOrg(orgId, { search: query });
  return rows.slice(0, limit);
}

export async function bumpDictionaryVersion(orgId: string): Promise<number> {
  const result = await db.update(organizations).set({
    mediaOutletDictionaryVersion: sql`${organizations.mediaOutletDictionaryVersion} + 1`,
    updatedAt: new Date(),
  }).where(eq(organizations.id, orgId))
    .returning({ version: organizations.mediaOutletDictionaryVersion });
  return result[0]!.version;
}

export async function getDictionaryVersion(orgId: string): Promise<number> {
  const rows = await db.select({ version: organizations.mediaOutletDictionaryVersion })
    .from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return rows[0]?.version ?? 0;
}
