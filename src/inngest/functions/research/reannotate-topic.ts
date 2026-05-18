// src/inngest/functions/research/reannotate-topic.ts
// 2026-05-14: 词库变更后,单 topic 增量回算。
//
// 触发场景(由 src/app/actions/research/research-topics.ts 派发):
//   - topic 改名(因为 topic.name 默认作为 primaryKeyword)
//   - 新增 keyword(可能命中更多历史 items)
//   - 删除 keyword(旧命中可能失效)
//
// 处理流程:
//   1. 加载该 topic 的当前 keywords(已经反映了最新变更)
//   2. DELETE 该 topic 的所有旧命中(org-scoped via JOIN)
//   3. 分批扫描 org 的全部 collected_items,对每条跑 matcher,有命中则 INSERT
//
// 安全性:
//   - 步骤 2 删除前先验证 topic 存在 + 属于该 org;否则跳过(防止误删)
//   - 步骤 3 ID-based cursor 分批,避免 NOT EXISTS 死循环

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectedItems, collectedItemContents } from "@/db/schema/collection";
import { researchTopics, researchTopicKeywords } from "@/db/schema/research/research-topics";
import { researchCollectedItemTopics } from "@/db/schema/research/annotations";
import { and, eq, asc, sql } from "drizzle-orm";
import { matchTopicsForItem, type TopicWithKeywords } from "@/lib/research/topic-matcher";

export const reannotateTopic = inngest.createFunction(
  { id: "research-reannotate-topic", concurrency: { limit: 2 } },
  { event: "research/topic.changed" },
  async ({ event, step }) => {
    const { topicId, organizationId, reason } = event.data;
    const BATCH = 500;

    // 1. 加载 topic + 当前 keywords (org-scoped 校验在 query 里完成)
    const topic = await step.run("load-topic", async (): Promise<TopicWithKeywords | null> => {
      const rows = await db
        .select({
          id: researchTopics.id,
          name: researchTopics.name,
          keyword: researchTopicKeywords.keyword,
          isPrimary: researchTopicKeywords.isPrimary,
        })
        .from(researchTopics)
        .leftJoin(researchTopicKeywords, eq(researchTopicKeywords.topicId, researchTopics.id))
        .where(
          and(
            eq(researchTopics.id, topicId),
            eq(researchTopics.organizationId, organizationId),
          ),
        );

      if (rows.length === 0) return null;
      const primaryKeywords: string[] = [];
      const otherKeywords: string[] = [];
      for (const row of rows) {
        if (!row.keyword) continue;
        if (row.isPrimary) primaryKeywords.push(row.keyword);
        else otherKeywords.push(row.keyword);
      }
      // 主词列表为空时,默认用 topic.name 作主词(与 annotate-collected-item / backfill-annotate 一致)
      if (primaryKeywords.length === 0) primaryKeywords.push(rows[0]!.name);
      return { id: topicId, name: rows[0]!.name, primaryKeywords, otherKeywords };
    });

    if (!topic) {
      return { skipped: true, reason: "topic-not-found-or-cross-org", reasonHint: reason };
    }

    // 2. 删除该 topic 的所有旧命中(限定 org,避免越权)
    await step.run("delete-old-matches", async () => {
      await db.execute(sql`
        DELETE FROM research_collected_item_topics
        WHERE topic_id = ${topicId}::uuid
          AND collected_item_id IN (
            SELECT id FROM collected_items WHERE organization_id = ${organizationId}::uuid
          )
      `);
    });

    // 3. 分批扫描 + 重新匹配
    let lastId: string | null = null;
    let scanned = 0;
    let matched = 0;
    let batchIdx = 0;

    while (true) {
      const batch = await step.run(`load-batch-${batchIdx}`, async () => {
        const conditions = [eq(collectedItems.organizationId, organizationId)];
        if (lastId) conditions.push(sql`${collectedItems.id}::text > ${lastId}`);
        return await db
          .select({
            id: collectedItems.id,
            title: collectedItems.title,
            content: collectedItemContents.content,
          })
          .from(collectedItems)
          .leftJoin(collectedItemContents, eq(collectedItemContents.itemId, collectedItems.id))
          .where(and(...conditions))
          .orderBy(asc(collectedItems.id))
          .limit(BATCH);
      });

      if (batch.length === 0) break;

      const insertCount = await step.run(`match-batch-${batchIdx}`, async () => {
        const inserts: Array<{
          collectedItemId: string;
          topicId: string;
          matchType: "keyword";
          matchedKeyword: string;
        }> = [];
        for (const item of batch) {
          const text = `${item.title}\n${item.content ?? ""}`;
          const m = matchTopicsForItem(text, [topic]);
          if (m.length > 0) {
            inserts.push({
              collectedItemId: item.id,
              topicId,
              matchType: "keyword" as const,
              matchedKeyword: m[0]!.matchedKeyword,
            });
          }
        }
        if (inserts.length > 0) {
          await db.insert(researchCollectedItemTopics).values(inserts).onConflictDoNothing();
        }
        return inserts.length;
      });

      scanned += batch.length;
      matched += insertCount;
      lastId = batch[batch.length - 1]!.id;
      batchIdx += 1;
      if (batch.length < BATCH) break;
    }

    return { topicId, organizationId, reason, scanned, matched };
  },
);
