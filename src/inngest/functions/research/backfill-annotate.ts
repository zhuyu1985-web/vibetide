// src/inngest/functions/research/backfill-annotate.ts
// A3 Phase 3: 一次性手工触发批量回填历史 collected_items 的 annotation
// ID-based cursor 分页（避免 NOT EXISTS 死循环）

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import { researchTopics, researchTopicKeywords } from "@/db/schema/research/research-topics";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import {
  researchCollectedItemTopics,
  researchCollectedItemDistricts,
} from "@/db/schema/research/annotations";
import { eq, and, sql, asc } from "drizzle-orm";
import { matchTopicsForItem } from "@/lib/research/topic-matcher";
import { matchDistrictsForItem } from "@/lib/research/district-matcher";

export const backfillAnnotate = inngest.createFunction(
  { id: "research-backfill-annotate", concurrency: { limit: 1 } },
  { event: "research/backfill-annotate.requested" },
  async ({ event, step }) => {
    const { organizationId } = event.data;
    const BATCH = 500;

    // 加载 topic + 关键词（org-scoped；按 isPrimary 分组；同 annotate-collected-item.ts 逻辑）
    const topics = await step.run("load-topics", async () => {
      const rows = await db
        .select({
          id: researchTopics.id,
          name: researchTopics.name,
          keyword: researchTopicKeywords.keyword,
          isPrimary: researchTopicKeywords.isPrimary,
        })
        .from(researchTopics)
        .leftJoin(researchTopicKeywords, eq(researchTopicKeywords.topicId, researchTopics.id))
        .where(eq(researchTopics.organizationId, organizationId));

      const map = new Map<string, {
        id: string;
        name: string;
        primaryKeywords: string[];
        otherKeywords: string[];
      }>();
      for (const row of rows) {
        if (!map.has(row.id)) {
          map.set(row.id, { id: row.id, name: row.name, primaryKeywords: [], otherKeywords: [] });
        }
        const t = map.get(row.id)!;
        if (row.keyword) {
          if (row.isPrimary) t.primaryKeywords.push(row.keyword);
          else t.otherKeywords.push(row.keyword);
        }
      }
      // 主词列表为空时，默认用 topic.name 作主词（兼容未灌关键词的 topic）
      for (const t of map.values()) {
        if (t.primaryKeywords.length === 0) t.primaryKeywords.push(t.name);
      }
      return Array.from(map.values());
    });

    const districts = await step.run("load-districts", async () => {
      return await db
        .select({ id: cqDistricts.id, name: cqDistricts.name })
        .from(cqDistricts);
    });

    let processed = 0;
    // ID-based cursor 分页 — 不依赖 NOT EXISTS 状态变化（避免死循环）
    let lastId: string | null = null;
    let batchIdx = 0;

    while (true) {
      const batch = await step.run(`load-batch-${batchIdx}`, async () => {
        const conditions = [eq(collectedItems.organizationId, organizationId)];
        if (lastId) conditions.push(sql`${collectedItems.id}::text > ${lastId}`);
        return await db
          .select({
            id: collectedItems.id,
            title: collectedItems.title,
            content: collectedItems.content,
          })
          .from(collectedItems)
          .where(and(...conditions))
          .orderBy(asc(collectedItems.id))
          .limit(BATCH);
      });

      if (batch.length === 0) break;

      await step.run(`annotate-batch-${batchIdx}`, async () => {
        for (const item of batch) {
          const text = `${item.title}\n${item.content ?? ""}`;
          const topicMatches = matchTopicsForItem(text, topics);
          const districtMatches = matchDistrictsForItem(text, districts);

          if (topicMatches.length > 0) {
            await db
              .insert(researchCollectedItemTopics)
              .values(
                topicMatches.map(m => ({
                  collectedItemId: item.id,
                  topicId: m.topicId,
                  matchType: "keyword" as const,
                  matchedKeyword: m.matchedKeyword,
                })),
              )
              .onConflictDoNothing();
          }
          if (districtMatches.length > 0) {
            await db
              .insert(researchCollectedItemDistricts)
              .values(
                districtMatches.map(m => ({
                  collectedItemId: item.id,
                  districtId: m.districtId,
                  matchType: "keyword" as const,
                  matchedKeyword: m.matchedKeyword,
                })),
              )
              .onConflictDoNothing();
          }
        }
      });

      processed += batch.length;
      lastId = batch[batch.length - 1]!.id; // 关键：用最后一条 id 推进 cursor
      batchIdx += 1;
      if (batch.length < BATCH) break;
    }

    return { processed };
  },
);
