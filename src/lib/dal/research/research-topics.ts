// src/lib/dal/research/research-topics.ts
import { db } from "@/db";
import {
  researchTopics,
  researchTopicKeywords,
  researchTopicSamples,
} from "@/db/schema/research/research-topics";
import { eq, and, asc, inArray } from "drizzle-orm";

export type TopicSummary = {
  id: string;
  name: string;
  description: string | null;
  groupName: string | null;
  isPreset: boolean;
  primaryKeyword: string | null;
  aliasCount: number;
  sampleCount: number;
};

export async function listResearchTopics(orgId: string): Promise<TopicSummary[]> {
  const topics = await db
    .select()
    .from(researchTopics)
    .where(eq(researchTopics.organizationId, orgId))
    .orderBy(asc(researchTopics.sortOrder));

  if (topics.length === 0) return [];

  const topicIds = topics.map((t) => t.id);

  const keywordRows = await db
    .select()
    .from(researchTopicKeywords)
    .where(inArray(researchTopicKeywords.topicId, topicIds));

  const sampleRows = await db
    .select({ topicId: researchTopicSamples.topicId })
    .from(researchTopicSamples)
    .where(inArray(researchTopicSamples.topicId, topicIds));

  const kwByTopic = new Map<string, typeof keywordRows>();
  for (const k of keywordRows) {
    const arr = kwByTopic.get(k.topicId) ?? [];
    arr.push(k);
    kwByTopic.set(k.topicId, arr);
  }
  const sampleCountByTopic = new Map<string, number>();
  for (const s of sampleRows) {
    sampleCountByTopic.set(s.topicId, (sampleCountByTopic.get(s.topicId) ?? 0) + 1);
  }

  return topics.map((t) => {
    const kws = kwByTopic.get(t.id) ?? [];
    const primary = kws.find((k) => k.isPrimary);
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      groupName: t.groupName,
      isPreset: t.isPreset,
      primaryKeyword: primary?.keyword ?? null,
      aliasCount: kws.filter((k) => !k.isPrimary).length,
      sampleCount: sampleCountByTopic.get(t.id) ?? 0,
    };
  });
}

/**
 * 返回该 org 下所有去重的 group_name（null 不返回，由 UI 单独处理为"默认分组"）。
 */
export async function listTopicGroups(orgId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ g: researchTopics.groupName })
    .from(researchTopics)
    .where(eq(researchTopics.organizationId, orgId));
  return rows
    .map((r) => r.g)
    .filter((g): g is string => Boolean(g))
    .sort();
}

export async function getResearchTopicById(id: string, orgId: string) {
  const [topic] = await db
    .select()
    .from(researchTopics)
    .where(
      and(
        eq(researchTopics.id, id),
        eq(researchTopics.organizationId, orgId),
      ),
    );
  if (!topic) return null;
  const keywords = await db
    .select()
    .from(researchTopicKeywords)
    .where(eq(researchTopicKeywords.topicId, id));
  const samples = await db
    .select()
    .from(researchTopicSamples)
    .where(eq(researchTopicSamples.topicId, id));
  return { topic, keywords, samples };
}
