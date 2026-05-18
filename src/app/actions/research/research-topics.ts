"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  researchTopics,
  researchTopicKeywords,
  researchTopicSamples,
} from "@/db/schema/research/research-topics";
import { eq, and } from "drizzle-orm";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { inngest } from "@/inngest/client";
import { getResearchTopicById } from "@/lib/dal/research/research-topics";
import {
  searchCollectedItemsForResearch,
  type CollectedItemWithAnnotations,
} from "@/lib/dal/research/collected-item-search";

// ---------- Schemas ----------

const createTopicSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateTopicSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const addKeywordSchema = z.object({
  topicId: z.string().uuid(),
  keyword: z.string().min(1).max(100),
  isPrimary: z.boolean().optional(),
});

const addSampleSchema = z.object({
  topicId: z.string().uuid(),
  sampleText: z.string().min(10).max(2000),
});

const updateSampleSchema = z.object({
  id: z.string().uuid(),
  sampleText: z.string().min(10).max(2000),
});

// ---------- Helpers ----------

type Result<T = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

// ---------- Topic CRUD ----------

export async function createTopic(
  input: z.infer<typeof createTopicSchema>,
): Promise<Result<{ id: string }>> {
  try {
    const { userId, organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );
    const data = createTopicSchema.parse(input);

    const [row] = await db
      .insert(researchTopics)
      .values({
        organizationId,
        createdBy: userId,
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder ?? 0,
        isPreset: false,
      })
      .returning({ id: researchTopics.id });

    revalidatePath("/research/admin/topics");
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTopic(
  input: z.infer<typeof updateTopicSchema>,
): Promise<Result> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );
    const data = updateTopicSchema.parse(input);
    const { id, ...patch } = data;

    // 若改了 name —— topic.name 默认会作为 primaryKeyword 兜底,
    // 所以改名必须触发回算,否则旧命中可能不再正确。
    const nameChanged = typeof patch.name === "string" && patch.name.length > 0;

    await db
      .update(researchTopics)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(researchTopics.id, id),
          eq(researchTopics.organizationId, organizationId),
        ),
      );

    if (nameChanged) {
      await inngest.send({
        name: "research/topic.changed",
        data: { topicId: id, organizationId, reason: "topic-renamed" },
      });
    }

    revalidatePath("/research/admin/topics");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTopic(id: string): Promise<Result> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );

    // Guard: don't delete preset topics accidentally
    const [existing] = await db
      .select()
      .from(researchTopics)
      .where(
        and(
          eq(researchTopics.id, id),
          eq(researchTopics.organizationId, organizationId),
        ),
      );
    if (!existing) return { ok: false, error: "未找到主题" };
    if (existing.isPreset) {
      return { ok: false, error: "预置主题不可删除" };
    }

    await db.delete(researchTopics).where(eq(researchTopics.id, id));
    revalidatePath("/research/admin/topics");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Keywords ----------

export async function addKeyword(
  input: z.infer<typeof addKeywordSchema>,
): Promise<Result<{ id: string }>> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );
    const data = addKeywordSchema.parse(input);

    // Verify topic belongs to org
    const [topic] = await db
      .select({ id: researchTopics.id })
      .from(researchTopics)
      .where(
        and(
          eq(researchTopics.id, data.topicId),
          eq(researchTopics.organizationId, organizationId),
        ),
      );
    if (!topic) return { ok: false, error: "主题不存在或无权限" };

    const [row] = await db
      .insert(researchTopicKeywords)
      .values({
        topicId: data.topicId,
        keyword: data.keyword,
        isPrimary: data.isPrimary ?? false,
      })
      .returning({ id: researchTopicKeywords.id });

    // 新增 keyword 后,该 topic 的命中范围可能扩大 — 异步重算
    await inngest.send({
      name: "research/topic.changed",
      data: { topicId: data.topicId, organizationId, reason: "keyword-added" },
    });

    revalidatePath("/research/admin/topics");
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

export async function removeKeyword(id: string): Promise<Result> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );

    // Scope check via join + 拿到 topicId(删除后才能派发回算事件)
    const [kw] = await db
      .select({
        topicOrgId: researchTopics.organizationId,
        topicId: researchTopicKeywords.topicId,
      })
      .from(researchTopicKeywords)
      .innerJoin(
        researchTopics,
        eq(researchTopicKeywords.topicId, researchTopics.id),
      )
      .where(eq(researchTopicKeywords.id, id));
    if (!kw || kw.topicOrgId !== organizationId) {
      return { ok: false, error: "关键词不存在或无权限" };
    }

    await db.delete(researchTopicKeywords).where(eq(researchTopicKeywords.id, id));

    // 删除 keyword 后,旧命中可能依赖该词 — 必须 reannotate 重置该 topic 命中
    await inngest.send({
      name: "research/topic.changed",
      data: { topicId: kw.topicId, organizationId, reason: "keyword-removed" },
    });

    revalidatePath("/research/admin/topics");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Samples (with Inngest event emission) ----------

export async function addSample(
  input: z.infer<typeof addSampleSchema>,
): Promise<Result<{ id: string }>> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );
    const data = addSampleSchema.parse(input);

    const [topic] = await db
      .select({ id: researchTopics.id })
      .from(researchTopics)
      .where(
        and(
          eq(researchTopics.id, data.topicId),
          eq(researchTopics.organizationId, organizationId),
        ),
      );
    if (!topic) return { ok: false, error: "主题不存在或无权限" };

    const [row] = await db
      .insert(researchTopicSamples)
      .values({
        topicId: data.topicId,
        sampleText: data.sampleText,
        embeddingStatus: "pending",
      })
      .returning({ id: researchTopicSamples.id });

    // Emit event for future Inngest vectorization listener (S3 will wire this)
    await inngest.send({
      name: "research/topic.sample.changed",
      data: { sampleId: row.id, topicId: data.topicId, operation: "created" },
    });

    revalidatePath("/research/admin/topics");
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateSample(
  input: z.infer<typeof updateSampleSchema>,
): Promise<Result> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );
    const data = updateSampleSchema.parse(input);

    // Scope check via join
    const [sample] = await db
      .select({
        topicOrgId: researchTopics.organizationId,
        topicId: researchTopicSamples.topicId,
      })
      .from(researchTopicSamples)
      .innerJoin(
        researchTopics,
        eq(researchTopicSamples.topicId, researchTopics.id),
      )
      .where(eq(researchTopicSamples.id, data.id));
    if (!sample || sample.topicOrgId !== organizationId) {
      return { ok: false, error: "样本不存在或无权限" };
    }

    await db
      .update(researchTopicSamples)
      .set({
        sampleText: data.sampleText,
        embedding: null,
        embeddingStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(researchTopicSamples.id, data.id));

    await inngest.send({
      name: "research/topic.sample.changed",
      data: {
        sampleId: data.id,
        topicId: sample.topicId,
        operation: "updated",
      },
    });

    revalidatePath("/research/admin/topics");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeSample(id: string): Promise<Result> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );

    const [sample] = await db
      .select({ topicOrgId: researchTopics.organizationId })
      .from(researchTopicSamples)
      .innerJoin(
        researchTopics,
        eq(researchTopicSamples.topicId, researchTopics.id),
      )
      .where(eq(researchTopicSamples.id, id));
    if (!sample || sample.topicOrgId !== organizationId) {
      return { ok: false, error: "样本不存在或无权限" };
    }

    await db.delete(researchTopicSamples).where(eq(researchTopicSamples.id, id));
    revalidatePath("/research/admin/topics");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Backfill ----------

/**
 * 一次性触发:对该 org 全量历史 collected_items 跑 topic + district 匹配。
 *
 * 用途:
 *   - 首次建立词库后,把历史已采集的 items 回填命中
 *   - 异常恢复(annotation 表数据丢失)
 *   - 跨系统导入词库后批量初始化
 *
 * 注意:这是兜底操作,日常词库变更已由 reannotate-topic Inngest fn 自动覆盖,
 * 不需要每次都手动触发本 action。
 */
export async function requestBackfillAnnotate(): Promise<Result<{ enqueued: true }>> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );
    await inngest.send({
      name: "research/backfill-annotate.requested",
      data: { organizationId },
    });
    return { ok: true, enqueued: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Group ----------

/**
 * 设置主题的分组名（null 表示移出分组 / 默认分组）。
 * Phase 3a 新增,配合 /data-collection/topics 侧边栏分组 UI(Phase 3b)。
 */
export async function setTopicGroup(
  topicId: string,
  groupName: string | null,
): Promise<Result> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );

    await db
      .update(researchTopics)
      .set({ groupName, updatedAt: new Date() })
      .where(
        and(
          eq(researchTopics.id, topicId),
          eq(researchTopics.organizationId, organizationId),
        ),
      );

    revalidatePath("/data-collection/topics");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Detail fetch ----------

export async function getTopicDetail(id: string) {
  const { organizationId } = await requirePermission(
    PERMISSIONS.RESEARCH_TOPIC_MANAGE,
  );
  return getResearchTopicById(id, organizationId);
}

// ---------- Topic hits search (for /data-collection/topics detail panel) ----------

/**
 * Phase 3b — 主题监测主从布局右栏专用:按 topicId 搜索命中卡片。
 * 包装 DAL searchCollectedItemsForResearch,锁死 topicIds=[topicId];
 * 支持 channelLabels / publishedAtFrom-To / 关键词三类 filter chips。
 */
export async function searchCollectedItemsByTopicAction(
  topicId: string,
  filters: {
    channelLabels?: string[];
    publishedAtFrom?: number; // epoch ms
    publishedAtTo?: number;
    titleKeyword?: string;
  },
  pagination: { limit: number; offset: number },
): Promise<{ items: CollectedItemWithAnnotations[]; total: number }> {
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);
  return searchCollectedItemsForResearch(
    organizationId,
    {
      topicIds: [topicId],
      channelLabels: filters.channelLabels,
      publishedAtFrom: filters.publishedAtFrom
        ? new Date(filters.publishedAtFrom)
        : undefined,
      publishedAtTo: filters.publishedAtTo
        ? new Date(filters.publishedAtTo)
        : undefined,
      titleKeyword: filters.titleKeyword,
    },
    pagination,
  );
}
