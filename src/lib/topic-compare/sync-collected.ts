import { db } from "@/db";
import { sql } from "drizzle-orm";
import { benchmarkPosts, myPostDistributions } from "@/db/schema";
import { isTikhubAccountSupported } from "./constants";

export type SyncSourceBinding =
  | { kind: "benchmark"; platform: string; benchmarkAccountId: string }
  | { kind: "my"; platform: string; myAccountId: string };

export interface CollectedItemInput {
  externalId: string;
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  sourceUrl?: string | null;
  publishedAt?: Date | null;
  views?: number | null;
  likes?: number | null;
  shares?: number | null;
  comments?: number | null;
  contentFingerprint?: string | null;
  rawMetadata?: unknown;
}

export interface SyncResult {
  skipped: boolean;
  skipReason?: "platform_not_supported";
  processed: number;
  succeeded: number;
  parseFailed: number;
  upserted: number;
  newMyPostIds: string[];
}

function isParseable(item: CollectedItemInput): boolean {
  return typeof item.title === "string" && item.title.trim().length > 0;
}

export async function syncCollectedItems(params: {
  organizationId: string;
  binding: SyncSourceBinding;
  items: CollectedItemInput[];
}): Promise<SyncResult> {
  const { organizationId, binding, items } = params;
  const empty: SyncResult = {
    skipped: false,
    processed: items.length,
    succeeded: 0,
    parseFailed: 0,
    upserted: 0,
    newMyPostIds: [],
  };

  if (!isTikhubAccountSupported(binding.platform)) {
    return { ...empty, skipped: true, skipReason: "platform_not_supported", processed: 0 };
  }

  let succeeded = 0;
  let parseFailed = 0;
  let upserted = 0;
  const newMyPostIds: string[] = [];

  for (const item of items) {
    if (!isParseable(item)) {
      parseFailed++;
      continue;
    }

    try {
      if (binding.kind === "benchmark") {
        await db
          .insert(benchmarkPosts)
          .values({
            benchmarkAccountId: binding.benchmarkAccountId,
            title: item.title!,
            summary: item.summary ?? null,
            body: item.body ?? null,
            sourceUrl: item.sourceUrl ?? null,
            contentFingerprint: item.contentFingerprint ?? null,
            publishedAt: item.publishedAt ?? null,
            views: item.views ?? 0,
            likes: item.likes ?? 0,
            shares: item.shares ?? 0,
            comments: item.comments ?? 0,
            rawMetadata: item.rawMetadata ?? null,
          })
          .onConflictDoUpdate({
            target: [benchmarkPosts.benchmarkAccountId, benchmarkPosts.sourceUrl],
            set: {
              views: item.views ?? 0,
              likes: item.likes ?? 0,
              shares: item.shares ?? 0,
              comments: item.comments ?? 0,
              rawMetadata: item.rawMetadata ?? null,
            },
          });
        upserted++;
        succeeded++;
      } else {
        // my 分支：要求 contentFingerprint 才能 dedup
        if (!item.contentFingerprint) {
          parseFailed++;
          continue;
        }

        // 用 Postgres 系统列 xmax=0 精确判断本次是 INSERT 还是 UPDATE
        // （xmax=0 ⇔ 本事务首次插入；非 0 ⇔ update。比"createdAt 时间窗"可靠）
        const insertedRows = await db.execute<{ id: string; is_new: boolean }>(sql`
          INSERT INTO my_posts (
            organization_id, title, summary, body, content_fingerprint,
            original_source_url, published_at,
            total_views, total_likes, total_shares, total_comments,
            stats_aggregated_at
          ) VALUES (
            ${organizationId}, ${item.title!}, ${item.summary ?? null}, ${item.body ?? null}, ${item.contentFingerprint},
            ${item.sourceUrl ?? null}, ${item.publishedAt ?? null},
            ${item.views ?? 0}, ${item.likes ?? 0}, ${item.shares ?? 0}, ${item.comments ?? 0},
            ${new Date()}
          )
          ON CONFLICT (organization_id, content_fingerprint) DO UPDATE SET
            total_views = EXCLUDED.total_views,
            total_likes = EXCLUDED.total_likes,
            total_shares = EXCLUDED.total_shares,
            total_comments = EXCLUDED.total_comments,
            stats_aggregated_at = EXCLUDED.stats_aggregated_at
          RETURNING id, (xmax = 0) AS is_new
        `);

        // drizzle execute 返回值类型按 driver 不同:postgres-js 直接返回数组
        const rows = Array.isArray(insertedRows)
          ? insertedRows
          : ((insertedRows as { rows?: Array<{ id: string; is_new: boolean }> }).rows ?? []);
        const insertedPost = rows[0];

        if (insertedPost) {
          if (insertedPost.is_new) newMyPostIds.push(insertedPost.id);

          // upsert distribution（普通 Drizzle 调用即可）
          await db
            .insert(myPostDistributions)
            .values({
              myPostId: insertedPost.id,
              myAccountId: binding.myAccountId,
              publishedUrl: item.sourceUrl ?? null,
              publishedAt: item.publishedAt ?? null,
              views: item.views ?? 0,
              likes: item.likes ?? 0,
              shares: item.shares ?? 0,
              comments: item.comments ?? 0,
              rawMetadata: item.rawMetadata ?? null,
            })
            .onConflictDoUpdate({
              target: [myPostDistributions.myPostId, myPostDistributions.myAccountId],
              set: {
                views: item.views ?? 0,
                likes: item.likes ?? 0,
                shares: item.shares ?? 0,
                comments: item.comments ?? 0,
                rawMetadata: item.rawMetadata ?? null,
              },
            });
          upserted++;
          succeeded++;
        }
      }
    } catch (err) {
      console.error("[sync-collected] upsert failed:", { externalId: item.externalId, err });
      parseFailed++;
    }
  }

  return {
    skipped: false,
    processed: items.length,
    succeeded,
    parseFailed,
    upserted,
    newMyPostIds,
  };
}
