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

type Result<T = {}> =
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

    await db
      .update(researchTopics)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(researchTopics.id, id),
          eq(researchTopics.organizationId, organizationId),
        ),
      );

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

    // Scope check via join to ensure keyword belongs to a topic in this org
    const [kw] = await db
      .select({ topicOrgId: researchTopics.organizationId })
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

// ---------- Detail fetch ----------

export async function getTopicDetail(id: string) {
  const { organizationId } = await requirePermission(
    PERMISSIONS.RESEARCH_TOPIC_MANAGE,
  );
  return getResearchTopicById(id, organizationId);
}
