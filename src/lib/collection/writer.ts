import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { collectedItems, collectionRuns } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { computeContentFingerprint, computeUrlHash, normalizeUrl } from "./normalize";
import type { WriteArgs, WriteResult, RawItem } from "./types";

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

  await updateRunCounters(args.runId, { inserted, merged, failed });
  return { inserted, merged, failed, insertedItemIds };
}

async function writeSingleItem(args: WriteArgs, raw: RawItem): Promise<WriteOutcome> {
  const canonicalUrl = raw.url ? normalizeUrl(raw.url) : null;
  const urlHash = raw.url ? computeUrlHash(raw.url) : null;
  const capturedAt = new Date();
  const fingerprint = computeContentFingerprint(
    raw.title,
    raw.publishedAt ?? null,
    capturedAt,
  );

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

    // 2. Try content fingerprint match
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

    // 3. Insert new item
    const [insertedRow] = await tx
      .insert(collectedItems)
      .values({
        organizationId: args.organizationId,
        contentFingerprint: fingerprint,
        canonicalUrl,
        canonicalUrlHash: urlHash,
        title: raw.title,
        content: raw.content,
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
        category: args.source.defaultCategory,
        tags: args.source.defaultTags,
        rawMetadata: raw.rawMetadata ?? null,
      })
      .returning({ id: collectedItems.id });

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
  counts: { inserted: number; merged: number; failed: number },
): Promise<void> {
  const attempted = counts.inserted + counts.merged + counts.failed;
  await db
    .update(collectionRuns)
    .set({
      itemsAttempted: attempted,
      itemsInserted: counts.inserted,
      itemsMerged: counts.merged,
      itemsFailed: counts.failed,
    })
    .where(eq(collectionRuns.id, runId));
}
