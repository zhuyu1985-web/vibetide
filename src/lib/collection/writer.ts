import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { collectedItems, collectedItemContents, collectionRuns } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { computeContentFingerprint, computeUrlHash, normalizeUrl } from "./normalize";
import type { WriteArgs, WriteResult, RawItem } from "./types";
import { recognizeOutlet } from "./outlet-recognizer";
import { getDictionaryVersion, listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";

// version-stamp cache（进程级，跨请求复用）
const dictCache = new Map<string, { version: number; outlets: MediaOutletRow[] }>();

async function loadOutletDictionaryCached(orgId: string): Promise<MediaOutletRow[]> {
  const currentVersion = await getDictionaryVersion(orgId);
  const cached = dictCache.get(orgId);
  if (cached && cached.version === currentVersion) return cached.outlets;
  const outlets = await listOutletsByOrg(orgId, { includeInactive: false });
  dictCache.set(orgId, { version: currentVersion, outlets });
  return outlets;
}

interface WriteOutcome {
  itemId: string;
  isNew: boolean;
  merged: boolean;
}

export async function writeItems(args: WriteArgs): Promise<WriteResult> {
  let inserted = 0;
  let merged = 0;
  let failed = 0;
  const insertedItemIds: string[] = [];

  for (const raw of args.items) {
    try {
      const outcome = await writeSingleItem(args, raw);
      if (outcome.isNew) {
        inserted++;
        insertedItemIds.push(outcome.itemId);
      }
      if (outcome.merged) merged++;

      if (outcome.isNew) {
        await inngest.send({
          name: "collection/item.created",
          data: {
            itemId: outcome.itemId,
            sourceId: args.sourceId,
            organizationId: args.organizationId,
            targetModules: args.source.targetModules,
            firstSeenChannel: raw.channel,
          },
        });
      }
    } catch (err) {
      failed++;
      console.error("[collection-writer] failed to write item", {
        sourceId: args.sourceId,
        title: raw.title?.slice(0, 50),
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await updateRunCounters(args.runId, { inserted, merged, failed, runMetadata: args.runMetadata });
  return { inserted, merged, failed, insertedItemIds };
}

async function writeSingleItem(args: WriteArgs, raw: RawItem): Promise<WriteOutcome> {
  const canonicalUrl = raw.url ? normalizeUrl(raw.url) : null;
  const urlHash = raw.url ? computeUrlHash(raw.url) : null;
  const capturedAt = new Date();

  // 默认 'url_and_fingerprint',跟历史行为一致;舆情 import 显式传 'url_only'。
  const strategy: "url_only" | "url_and_fingerprint" =
    args.dedupStrategy ?? "url_and_fingerprint";

  // 主表 contentFingerprint 列 NOT NULL + UNIQUE。
  // - url_and_fingerprint:用语义 fingerprint(title + publishedAt 当日)用作合并 key
  // - url_only:fingerprint 仅满足 UNIQUE,不参与合并;掺 url + uuid 确保每行唯一
  const fingerprint =
    strategy === "url_only"
      ? createHash("md5")
          .update(`${raw.title}|${raw.url ?? ""}|${capturedAt.toISOString()}|${randomUUID()}`)
          .digest("hex")
      : computeContentFingerprint(raw.title, raw.publishedAt ?? null, capturedAt);

  return db.transaction(async (tx) => {
    // 1. Try URL hash match first
    if (urlHash) {
      const byUrl = await tx
        .select()
        .from(collectedItems)
        .where(
          and(
            eq(collectedItems.organizationId, args.organizationId),
            eq(collectedItems.canonicalUrlHash, urlHash),
          ),
        )
        .for("update")
        .limit(1);
      if (byUrl.length > 0) {
        await appendSourceChannel(tx, byUrl[0].id, {
          channel: raw.channel,
          url: raw.url,
          sourceId: args.sourceId,
          runId: args.runId,
          capturedAt: capturedAt.toISOString(),
        });
        return { itemId: byUrl[0].id, isNew: false, merged: true };
      }
    }

    // 2. Content fingerprint 第二层 — 仅在策略允许时查
    if (strategy === "url_and_fingerprint") {
      const byFp = await tx
        .select()
        .from(collectedItems)
        .where(
          and(
            eq(collectedItems.organizationId, args.organizationId),
            eq(collectedItems.contentFingerprint, fingerprint),
          ),
        )
        .for("update")
        .limit(1);
      if (byFp.length > 0) {
        await appendSourceChannel(tx, byFp[0].id, {
          channel: raw.channel,
          url: raw.url,
          sourceId: args.sourceId,
          runId: args.runId,
          capturedAt: capturedAt.toISOString(),
        });
        return { itemId: byFp[0].id, isNew: false, merged: true };
      }
    }

    // 3. Insert new item
    const dict = await loadOutletDictionaryCached(args.organizationId);
    const recognized = recognizeOutlet(
      { canonicalUrl: canonicalUrl ?? undefined, rawMetadata: raw.rawMetadata },
      {
        outletId: args.source.outletId ?? null,
        defaultOutletTier: args.source.defaultOutletTier ?? null,
        defaultOutletRegion: args.source.defaultOutletRegion ?? null,
      },
      dict,
    );

    // 行业分类:adapter 给的 industries 优先;否则用 source.defaultCategory 单值包成数组;都空则空数组。
    const categoryArray: string[] = raw.industries && raw.industries.length > 0
      ? raw.industries
      : args.source.defaultCategory
        ? [args.source.defaultCategory]
        : [];

    const [insertedRow] = await tx
      .insert(collectedItems)
      .values({
        organizationId: args.organizationId,
        contentFingerprint: fingerprint,
        canonicalUrl,
        canonicalUrlHash: urlHash,
        title: raw.title,
        summary: raw.summary,
        publishedAt: raw.publishedAt,
        firstSeenSourceId: args.sourceId,
        firstSeenChannel: raw.channel,
        firstSeenAt: capturedAt,
        sourceChannels: [
          {
            channel: raw.channel,
            url: raw.url,
            sourceId: args.sourceId,
            runId: args.runId,
            capturedAt: capturedAt.toISOString(),
          },
        ],
        category: categoryArray,
        tags: args.source.defaultTags,
        rawMetadata: raw.rawMetadata ?? null,
        contentType: raw.contentType ?? "image_text",
        attachments: raw.attachments ?? [],
        outletId: recognized?.outletId ?? null,
        outletTier: recognized?.outletTier ?? null,
        outletRegion: recognized?.outletRegion ?? null,

        // 舆情/账号身份字段(adapter 可选填,缺省 null/0)
        externalId: raw.externalId ?? null,
        platform: raw.platform ?? null,
        author: raw.author ?? null,
        accountId: raw.accountId ?? null,
        accountHandle: raw.accountHandle ?? null,
        authorFollowerCount: raw.authorFollowerCount ?? null,
        sentiment: raw.sentiment ?? null,
        infoType: raw.infoType ?? null,
        likeCount: raw.likeCount ?? 0,
        commentCount: raw.commentCount ?? 0,
        shareCount: raw.shareCount ?? 0,
        viewCount: raw.viewCount ?? 0,
        favoriteCount: raw.favoriteCount ?? 0,
        replyCount: raw.replyCount ?? 0,
        ipRegion: raw.ipRegion ?? null,
        postRegion: raw.postRegion ?? null,
        mentionedRegions: raw.mentionedRegions ?? null,
        matchedKeywords: raw.matchedKeywords ?? null,
        matchedRegions: raw.matchedRegions ?? null,
        industries: raw.industries ?? null,
        coverImageUrl: raw.coverImageUrl ?? null,
        durationSeconds: raw.durationSeconds ?? null,
      })
      .returning({ id: collectedItems.id });

    // 拆表后:正文写到 collected_item_contents 副表(1:1)。
    // content / ocrText / asrText 任意非空就写;事务内,与主表插入一致。
    const hasContent = raw.content && raw.content.length > 0;
    const hasOcr = raw.ocrText && raw.ocrText.length > 0;
    const hasAsr = raw.asrText && raw.asrText.length > 0;
    if (hasContent || hasOcr || hasAsr) {
      await tx.insert(collectedItemContents).values({
        itemId: insertedRow.id,
        content: raw.content ?? "",
        ocrText: raw.ocrText ?? null,
        asrText: raw.asrText ?? null,
      });
    }

    // Phase 0: no light-derive into domain tables yet; Phase 1+ will add hot_topics / news_articles etc. here
    return { itemId: insertedRow.id, isNew: true, merged: false };
  });
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function appendSourceChannel(
  tx: DbTx,
  itemId: string,
  entry: {
    channel: string;
    url?: string;
    sourceId: string;
    runId: string;
    capturedAt: string;
  },
): Promise<void> {
  await tx.execute(sql`
    UPDATE collected_items
    SET source_channels = source_channels || ${JSON.stringify([entry])}::jsonb,
        updated_at = now()
    WHERE id = ${itemId}
  `);
}

async function updateRunCounters(
  runId: string,
  counts: { inserted: number; merged: number; failed: number; runMetadata?: Record<string, unknown> },
): Promise<void> {
  const attempted = counts.inserted + counts.merged + counts.failed;
  await db
    .update(collectionRuns)
    .set({
      itemsAttempted: attempted,
      itemsInserted: counts.inserted,
      itemsMerged: counts.merged,
      itemsFailed: counts.failed,
      ...(counts.runMetadata ? { metadata: counts.runMetadata } : {}),
    })
    .where(eq(collectionRuns.id, runId));
}
