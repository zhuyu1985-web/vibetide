import { and, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import {
  researchCollectedItemTopics,
  researchCollectedItemDistricts,
} from "@/db/schema/research/annotations";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";

export interface CollectedItemSearchFilter {
  outletTier?: string | "unclassified";
  outletId?: string;
  outletRegion?: string;
  contentType?: string;
  publishedAtFrom?: Date;
  publishedAtTo?: Date;
  topicIds?: string[];
  districtIds?: string[];
  titleKeyword?: string;
  contentKeyword?: string;
}

export interface CollectedItemWithAnnotations {
  id: string;
  title: string;
  content: string | null;
  outletId: string | null;
  outletTier: string | null;
  outletRegion: string | null;
  outletName: string | null;
  publishedAt: Date | null;
  contentType: string;
  url: string | null;
}

export async function searchCollectedItemsForResearch(
  orgId: string,
  filter: CollectedItemSearchFilter,
  pagination: { limit: number; offset: number },
): Promise<{ items: CollectedItemWithAnnotations[]; total: number }> {
  const conditions = [eq(collectedItems.organizationId, orgId)];

  if (filter.outletTier === "unclassified") {
    conditions.push(sql`${collectedItems.outletTier} IS NULL`);
  } else if (filter.outletTier) {
    conditions.push(eq(collectedItems.outletTier, filter.outletTier));
  }
  if (filter.outletId) {
    conditions.push(eq(collectedItems.outletId, filter.outletId));
  }
  if (filter.outletRegion) {
    conditions.push(eq(collectedItems.outletRegion, filter.outletRegion));
  }
  if (filter.contentType) {
    conditions.push(eq(collectedItems.contentType, filter.contentType));
  }
  if (filter.titleKeyword) {
    conditions.push(ilike(collectedItems.title, `%${filter.titleKeyword}%`));
  }
  if (filter.contentKeyword) {
    conditions.push(
      sql`${collectedItems.content} ILIKE ${"%" + filter.contentKeyword + "%"}`,
    );
  }
  if (filter.publishedAtFrom) {
    conditions.push(
      sql`${collectedItems.publishedAt} >= ${filter.publishedAtFrom}`,
    );
  }
  if (filter.publishedAtTo) {
    conditions.push(
      sql`${collectedItems.publishedAt} <= ${filter.publishedAtTo}`,
    );
  }

  // topic / district 过滤 — 用 EXISTS 子查询避免 leftJoin 引起重复行
  if (filter.topicIds?.length) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${researchCollectedItemTopics} cit
        WHERE cit.collected_item_id = ${collectedItems.id}
          AND cit.topic_id IN (${sql.join(
            filter.topicIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})
      )`,
    );
  }
  if (filter.districtIds?.length) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${researchCollectedItemDistricts} cid
        WHERE cid.collected_item_id = ${collectedItems.id}
          AND cid.district_id IN (${sql.join(
            filter.districtIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})
      )`,
    );
  }

  const where = and(...conditions);

  const items = await db
    .select({
      id: collectedItems.id,
      title: collectedItems.title,
      content: collectedItems.content,
      outletId: collectedItems.outletId,
      outletTier: collectedItems.outletTier,
      outletRegion: collectedItems.outletRegion,
      outletName: mediaOutletDictionary.outletName,
      publishedAt: collectedItems.publishedAt,
      contentType: collectedItems.contentType,
      url: collectedItems.canonicalUrl,
    })
    .from(collectedItems)
    .leftJoin(
      mediaOutletDictionary,
      eq(collectedItems.outletId, mediaOutletDictionary.id),
    )
    .where(where)
    .orderBy(sql`${collectedItems.publishedAt} DESC NULLS LAST`)
    .limit(pagination.limit)
    .offset(pagination.offset);

  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(collectedItems)
    .where(where);

  return { items, total: countRow?.count ?? 0 };
}
