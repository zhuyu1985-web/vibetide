// src/inngest/functions/research/annotate-collected-item.ts
// A3 Phase 3: 订阅 collection/item.created 事件 → 加载 topic/district → 命中 → 写 annotation

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectedItems, collectedItemContents } from "@/db/schema/collection";
import { researchTopics, researchTopicKeywords } from "@/db/schema/research/research-topics";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import {
  researchCollectedItemTopics,
  researchCollectedItemDistricts,
} from "@/db/schema/research/annotations";
import { eq } from "drizzle-orm";
import { matchTopicsForItem } from "@/lib/research/topic-matcher";
import { matchDistrictsForItem } from "@/lib/research/district-matcher";

export const annotateCollectedItem = inngest.createFunction(
  { id: "research-annotate-collected-item", concurrency: { limit: 4 } },
  { event: "collection/item.created" },
  async ({ event, step }) => {
    const { itemId, organizationId } = event.data;

    const item = await step.run("load-item", async () => {
      // 正文已拆到 collected_item_contents 副表 — LEFT JOIN 读取(可能 null)
      const [row] = await db
        .select({
          id: collectedItems.id,
          title: collectedItems.title,
          content: collectedItemContents.content,
        })
        .from(collectedItems)
        .leftJoin(collectedItemContents, eq(collectedItemContents.itemId, collectedItems.id))
        .where(eq(collectedItems.id, itemId))
        .limit(1);
      return row;
    });
    if (!item) return { skipped: true, reason: "item not found" };

    const text = `${item.title}\n${item.content ?? ""}`;

    // 加载 topic + 关键词（org-scoped；按 isPrimary 分组）
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

      // 聚合按 topicId 分组
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

    const topicMatches = matchTopicsForItem(text, topics);
    const districtMatches = matchDistrictsForItem(text, districts);

    if (topicMatches.length > 0) {
      await step.run("write-topic-annotations", async () => {
        await db
          .insert(researchCollectedItemTopics)
          .values(
            topicMatches.map(m => ({
              collectedItemId: itemId,
              topicId: m.topicId,
              matchType: "keyword" as const, // topicMatchTypeEnum 仅 keyword/semantic/both
              matchedKeyword: m.matchedKeyword,
            })),
          )
          .onConflictDoNothing({
            target: [
              researchCollectedItemTopics.collectedItemId,
              researchCollectedItemTopics.topicId,
              researchCollectedItemTopics.matchType,
            ],
          });
      });
    }

    if (districtMatches.length > 0) {
      await step.run("write-district-annotations", async () => {
        await db
          .insert(researchCollectedItemDistricts)
          .values(
            districtMatches.map(m => ({
              collectedItemId: itemId,
              districtId: m.districtId,
              matchType: "keyword" as const,
              matchedKeyword: m.matchedKeyword,
            })),
          )
          .onConflictDoNothing({
            target: [
              researchCollectedItemDistricts.collectedItemId,
              researchCollectedItemDistricts.districtId,
            ],
          });
      });
    }

    return { topicMatched: topicMatches.length, districtMatched: districtMatches.length };
  },
);
