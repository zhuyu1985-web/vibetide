"use server";

import { db } from "@/db";
import { collectionSources, collectionRuns } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserProfile } from "@/lib/dal/auth";
import { getAdapter } from "@/lib/collection/registry";
import { inngest } from "@/inngest/client";
import { assertSourceOwnership } from "@/lib/dal/collection";
import { z } from "zod";
import "@/lib/collection/adapters"; // ensure adapters are registered

async function requireUser() {
  return requireAuth();
}

async function requireOrg(): Promise<string> {
  const user = await requireAuth();
  if (!user.organizationId) throw new Error("无法获取组织信息");
  return user.organizationId;
}

// ──────────────────────────────────────────────────────
// createCollectionSource
// ──────────────────────────────────────────────────────

const createPayloadSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100),
  sourceType: z.string().min(1),
  config: z.unknown(),
  scheduleCron: z.string().nullable().optional(),
  scheduleMinIntervalSeconds: z.number().int().positive().nullable().optional(),
  targetModules: z.array(z.string()),
  defaultCategory: z.string().nullable().optional(),
  defaultTags: z.array(z.string()).nullable().optional(),
  // Outlet fields (Task 5.3)
  outletId: z.string().uuid().nullable().optional(),
  defaultOutletTier: z.string().nullable().optional(),
  defaultOutletRegion: z.string().nullable().optional(),
});

export async function createCollectionSource(payload: z.infer<typeof createPayloadSchema>) {
  const orgId = await requireOrg();
  const profile = await getCurrentUserProfile();

  const parsed = createPayloadSchema.parse(payload);

  // Validate type-specific config against adapter's zod schema
  const adapter = getAdapter(parsed.sourceType);
  const configResult = adapter.configSchema.safeParse(parsed.config);
  if (!configResult.success) {
    throw new Error(`配置校验失败: ${configResult.error.message}`);
  }

  const [row] = await db
    .insert(collectionSources)
    .values({
      organizationId: orgId,
      name: parsed.name,
      sourceType: parsed.sourceType,
      config: configResult.data as Record<string, unknown>,
      scheduleCron: parsed.scheduleCron ?? null,
      scheduleMinIntervalSeconds: parsed.scheduleMinIntervalSeconds ?? null,
      targetModules: parsed.targetModules,
      defaultCategory: parsed.defaultCategory ?? null,
      defaultTags: parsed.defaultTags ?? null,
      enabled: true,
      createdBy: profile?.userId ?? null,
      outletId: parsed.outletId ?? null,
      defaultOutletTier: parsed.defaultOutletTier ?? null,
      defaultOutletRegion: parsed.defaultOutletRegion ?? null,
    })
    .returning({ id: collectionSources.id });

  revalidatePath("/data-collection/sources");
  return { sourceId: row.id };
}

// ──────────────────────────────────────────────────────
// updateCollectionSource
// ──────────────────────────────────────────────────────

const updatePayloadSchema = createPayloadSchema.partial().extend({
  sourceId: z.string().uuid(),
});

export async function updateCollectionSource(payload: z.infer<typeof updatePayloadSchema>) {
  const orgId = await requireOrg();
  const { sourceId, ...rest } = updatePayloadSchema.parse(payload);
  const source = await assertSourceOwnership(sourceId, orgId);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (rest.name !== undefined) patch.name = rest.name;
  if (rest.scheduleCron !== undefined) patch.scheduleCron = rest.scheduleCron;
  if (rest.scheduleMinIntervalSeconds !== undefined) {
    patch.scheduleMinIntervalSeconds = rest.scheduleMinIntervalSeconds;
  }
  if (rest.targetModules !== undefined) patch.targetModules = rest.targetModules;
  if (rest.defaultCategory !== undefined) patch.defaultCategory = rest.defaultCategory;
  if (rest.defaultTags !== undefined) patch.defaultTags = rest.defaultTags;
  // Outlet fields (Task 5.3)
  if (rest.outletId !== undefined) patch.outletId = rest.outletId;
  if (rest.defaultOutletTier !== undefined) patch.defaultOutletTier = rest.defaultOutletTier;
  if (rest.defaultOutletRegion !== undefined) patch.defaultOutletRegion = rest.defaultOutletRegion;

  // 源类型不可变更:历史 collection_runs / collected_items 都基于当前 sourceType 跑,
  // 换 type 数据语义会断。如需换类型,请用户删除当前源后新建。
  if (rest.sourceType !== undefined && rest.sourceType !== source.sourceType) {
    throw new Error("源类型不可变更,如需切换请删除当前源后新建");
  }

  if (rest.config !== undefined) {
    // 校验始终用当前 source.sourceType 的 adapter schema
    const adapter = getAdapter(source.sourceType);
    const configResult = adapter.configSchema.safeParse(rest.config);
    if (!configResult.success) {
      throw new Error(`配置校验失败: ${configResult.error.message}`);
    }
    patch.config = configResult.data;
  }

  await db
    .update(collectionSources)
    .set(patch)
    .where(eq(collectionSources.id, sourceId));

  revalidatePath("/data-collection/sources");
  revalidatePath(`/data-collection/sources/${sourceId}`);
  return { success: true };
}

// ──────────────────────────────────────────────────────
// toggleCollectionSourceEnabled
// ──────────────────────────────────────────────────────

export async function toggleCollectionSourceEnabled(sourceId: string, enabled: boolean) {
  const orgId = await requireOrg();
  await assertSourceOwnership(sourceId, orgId);
  await db
    .update(collectionSources)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(collectionSources.id, sourceId));
  revalidatePath("/data-collection/sources");
  revalidatePath(`/data-collection/sources/${sourceId}`);
  return { success: true };
}

// ──────────────────────────────────────────────────────
// deleteCollectionSource (soft delete)
// ──────────────────────────────────────────────────────

export async function deleteCollectionSource(sourceId: string) {
  const orgId = await requireOrg();
  await assertSourceOwnership(sourceId, orgId);
  await db
    .update(collectionSources)
    .set({ deletedAt: new Date(), enabled: false })
    .where(eq(collectionSources.id, sourceId));
  revalidatePath("/data-collection/sources");
  return { success: true };
}

// ──────────────────────────────────────────────────────
// triggerCollectionSource: manually dispatch a run
// ──────────────────────────────────────────────────────

export async function triggerCollectionSource(sourceId: string) {
  const orgId = await requireOrg();
  const source = await assertSourceOwnership(sourceId, orgId);
  if (!source.enabled) throw new Error("源已暂停,无法触发");

  await inngest.send({
    name: "collection/source.run-requested",
    data: {
      sourceId,
      organizationId: orgId,
      trigger: "manual",
    },
  });

  revalidatePath(`/data-collection/sources/${sourceId}`);
  return { success: true };
}

// ──────────────────────────────────────────────────────
// getLatestRunForSource: poll endpoint for live trigger status
// ──────────────────────────────────────────────────────

export interface LatestRunStatus {
  runId: string | null;
  status: "running" | "success" | "partial" | "failed" | "none";
  startedAt: string | null;
  finishedAt: string | null;
  itemsInserted: number;
  itemsMerged: number;
  itemsFailed: number;
  errorSummary: string | null;
}

export async function getLatestRunForSource(
  sourceId: string,
): Promise<LatestRunStatus> {
  const orgId = await requireOrg();
  await assertSourceOwnership(sourceId, orgId);

  const [run] = await db
    .select()
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.sourceId, sourceId),
        eq(collectionRuns.organizationId, orgId),
      ),
    )
    .orderBy(desc(collectionRuns.startedAt))
    .limit(1);

  if (!run) {
    return {
      runId: null,
      status: "none",
      startedAt: null,
      finishedAt: null,
      itemsInserted: 0,
      itemsMerged: 0,
      itemsFailed: 0,
      errorSummary: null,
    };
  }

  return {
    runId: run.id,
    status: run.status as LatestRunStatus["status"],
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    itemsInserted: run.itemsInserted,
    itemsMerged: run.itemsMerged,
    itemsFailed: run.itemsFailed,
    errorSummary: run.errorSummary,
  };
}
