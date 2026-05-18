// src/lib/dal/monitoring-business.ts
// Phase 6: 业务看板 DAL — 全部基于 collected_items 真实字段聚合,
// sentiment 实际值是中文(敏感/非敏感/中性);主题过滤通过 research_collected_item_topics 桥接表 INNER JOIN。
import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import { researchCollectedItemTopics } from "@/db/schema/research/annotations";
import { and, eq, gte, inArray, sql, type SQL } from "drizzle-orm";

export interface BusinessFilters {
  topicIds?: string[];
  channels?: string[];
  since?: Date;
  until?: Date;
}

export interface BusinessSummary {
  postCount: { total: number; sensitive: number; nonSensitive: number; neutral: number };
  engagement: {
    total: number;
    likes: number;
    reposts: number;
    comments: number;
    favorites: number;
    views: number;
    replies: number;
  };
  influence: { authorCount: number; followerSum: number };
}

function buildWhere(orgId: string, f: BusinessFilters): SQL | undefined {
  const clauses: SQL[] = [eq(collectedItems.organizationId, orgId)];
  if (f.since) clauses.push(gte(collectedItems.firstSeenAt, f.since));
  if (f.until) clauses.push(sql`${collectedItems.firstSeenAt} <= ${f.until}`);
  if (f.channels?.length) clauses.push(inArray(collectedItems.firstSeenChannel, f.channels));
  return and(...clauses);
}

export async function getBusinessSummary(
  orgId: string,
  f: BusinessFilters,
): Promise<BusinessSummary> {
  const baseWhere = buildWhere(orgId, f);

  // sentiment 实际值是中文: '敏感' / '非敏感' / '中性' (来自 SELECT DISTINCT)
  let q = db
    .select({
      total: sql<number>`count(*)::int`,
      sensitive: sql<number>`count(*) FILTER (WHERE ${collectedItems.sentiment} = '敏感')::int`,
      nonSensitive: sql<number>`count(*) FILTER (WHERE ${collectedItems.sentiment} = '非敏感')::int`,
      neutral: sql<number>`count(*) FILTER (WHERE ${collectedItems.sentiment} = '中性')::int`,
      likes: sql<number>`coalesce(sum(${collectedItems.likeCount}), 0)::int`,
      reposts: sql<number>`coalesce(sum(${collectedItems.shareCount}), 0)::int`,
      comments: sql<number>`coalesce(sum(${collectedItems.commentCount}), 0)::int`,
      favorites: sql<number>`coalesce(sum(${collectedItems.favoriteCount}), 0)::int`,
      views: sql<number>`coalesce(sum(${collectedItems.viewCount}), 0)::int`,
      replies: sql<number>`coalesce(sum(${collectedItems.replyCount}), 0)::int`,
      authorCount: sql<number>`count(distinct ${collectedItems.author})::int`,
      followerSum: sql<string>`coalesce(sum(${collectedItems.authorFollowerCount}), 0)::text`,
    })
    .from(collectedItems)
    .$dynamic();

  if (f.topicIds?.length) {
    q = q
      .innerJoin(
        researchCollectedItemTopics,
        eq(researchCollectedItemTopics.collectedItemId, collectedItems.id),
      )
      .where(and(baseWhere!, inArray(researchCollectedItemTopics.topicId, f.topicIds)));
  } else if (baseWhere) {
    q = q.where(baseWhere);
  }

  const [r] = await q;
  const likes = Number(r.likes);
  const reposts = Number(r.reposts);
  const comments = Number(r.comments);
  const favorites = Number(r.favorites);
  const views = Number(r.views);
  const replies = Number(r.replies);
  return {
    postCount: {
      total: Number(r.total),
      sensitive: Number(r.sensitive),
      nonSensitive: Number(r.nonSensitive),
      neutral: Number(r.neutral),
    },
    engagement: {
      total: likes + reposts + comments + favorites + views + replies,
      likes,
      reposts,
      comments,
      favorites,
      views,
      replies,
    },
    influence: {
      authorCount: Number(r.authorCount),
      followerSum: Number(r.followerSum),
    },
  };
}

export interface ChannelTrendPoint {
  ts: string;
  channel: string;
  count: number;
}

export async function getChannelTrend(
  orgId: string,
  f: BusinessFilters,
  granularity: "hour" | "day",
): Promise<ChannelTrendPoint[]> {
  const trunc =
    granularity === "hour"
      ? sql<string>`date_trunc('hour', ${collectedItems.firstSeenAt})`
      : sql<string>`date_trunc('day', ${collectedItems.firstSeenAt})`;
  const baseWhere = buildWhere(orgId, f);

  let q = db
    .select({
      ts: sql<string>`${trunc}::text`,
      channel: collectedItems.firstSeenChannel,
      count: sql<number>`count(*)::int`,
    })
    .from(collectedItems)
    .$dynamic();

  if (f.topicIds?.length) {
    q = q
      .innerJoin(
        researchCollectedItemTopics,
        eq(researchCollectedItemTopics.collectedItemId, collectedItems.id),
      )
      .where(and(baseWhere!, inArray(researchCollectedItemTopics.topicId, f.topicIds)));
  } else if (baseWhere) {
    q = q.where(baseWhere);
  }

  const rows = await q
    .groupBy(trunc, collectedItems.firstSeenChannel)
    .orderBy(trunc);

  return rows.map((r) => ({
    ts: r.ts,
    channel: r.channel,
    count: Number(r.count),
  }));
}

export interface RecentBusinessItem {
  id: string;
  title: string;
  summary: string | null;
  author: string | null;
  platform: string | null;
  firstSeenChannel: string;
  firstSeenAt: Date;
  sentiment: string | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  canonicalUrl: string | null;
}

export async function getRecentBusinessItems(
  orgId: string,
  f: BusinessFilters,
  limit: number,
): Promise<RecentBusinessItem[]> {
  const baseWhere = buildWhere(orgId, f);

  let q = db
    .select({
      id: collectedItems.id,
      title: collectedItems.title,
      summary: collectedItems.summary,
      author: collectedItems.author,
      platform: collectedItems.platform,
      firstSeenChannel: collectedItems.firstSeenChannel,
      firstSeenAt: collectedItems.firstSeenAt,
      sentiment: collectedItems.sentiment,
      likeCount: collectedItems.likeCount,
      commentCount: collectedItems.commentCount,
      shareCount: collectedItems.shareCount,
      viewCount: collectedItems.viewCount,
      canonicalUrl: collectedItems.canonicalUrl,
    })
    .from(collectedItems)
    .$dynamic();

  if (f.topicIds?.length) {
    q = q
      .innerJoin(
        researchCollectedItemTopics,
        eq(researchCollectedItemTopics.collectedItemId, collectedItems.id),
      )
      .where(and(baseWhere!, inArray(researchCollectedItemTopics.topicId, f.topicIds)));
  } else if (baseWhere) {
    q = q.where(baseWhere);
  }

  return q
    .orderBy(sql`${collectedItems.firstSeenAt} desc`)
    .limit(limit);
}
