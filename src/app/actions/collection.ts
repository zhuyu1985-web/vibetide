"use server";

import { db } from "@/db";
import { collectionSources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrg, getCurrentUserProfile } from "@/lib/dal/auth";
import { getAdapter } from "@/lib/collection/registry";
import { inngest } from "@/inngest/client";
import { assertSourceOwnership } from "@/lib/dal/collection";
import { z } from "zod";
import "@/lib/collection/adapters"; // ensure adapters are registered

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function requireOrg(): Promise<string> {
  await requireUser();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");
  return orgId;
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

  if (rest.config !== undefined) {
    // Validate config against adapter
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
