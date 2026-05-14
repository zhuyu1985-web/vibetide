"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { collectedItems } from "@/db/schema/collection";
import { requireAuth } from "@/lib/auth";
import { OUTLET_TIER_VALUES } from "@/lib/collection/constants";
import { bumpDictionaryVersion } from "@/lib/dal/media-outlet-dictionary";
import { seedMediaOutletDictionary } from "@/db/seed/media-outlet-dictionary";
import { inngest } from "@/inngest/client";
import { channelsArraySchema } from "@/lib/media-outlet/channels";

const outletInputSchema = z.object({
  outletName: z.string().min(1).max(100),
  /** M1 新增:集团聚合,如"人民日报社" → 旗下"人民日报"/"人民网"/"人民视频"... */
  groupName: z.string().nullable().optional(),
  outletTier: z.enum(OUTLET_TIER_VALUES),
  outletRegion: z.string().nullable().optional(),
  outletDistrict: z.string().nullable().optional(),
  industryTag: z.string().nullable().optional(),
  /** M1 新增:平台账号矩阵 discriminated union */
  channels: channelsArraySchema.default([]),
  /** @deprecated 旧字段保留兼容,新表单填充 channels 即可 */
  domains: z.array(z.string()).default([]),
  /** @deprecated */
  publicAccountNames: z.array(z.string()).default([]),
  description: z.string().nullable().optional(),
});

export async function createOutlet(input: z.infer<typeof outletInputSchema>) {
  const user = await requireAuth();
  const data = outletInputSchema.parse(input);
  const [row] = await db.insert(mediaOutletDictionary).values({
    ...data, organizationId: user.organizationId,
  }).returning();
  await bumpDictionaryVersion(user.organizationId);
  revalidatePath("/data-collection/outlets");
  return row;
}

export async function updateOutlet(id: string, input: z.infer<typeof outletInputSchema>) {
  const user = await requireAuth();
  const data = outletInputSchema.parse(input);
  await db.update(mediaOutletDictionary).set({ ...data, updatedAt: new Date() })
    .where(and(
      eq(mediaOutletDictionary.id, id),
      eq(mediaOutletDictionary.organizationId, user.organizationId),
    ));
  await bumpDictionaryVersion(user.organizationId);
  revalidatePath("/data-collection/outlets");
}

export async function softDeleteOutlet(id: string) {
  const user = await requireAuth();
  await db.update(mediaOutletDictionary).set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(mediaOutletDictionary.id, id),
      eq(mediaOutletDictionary.organizationId, user.organizationId),
    ));
  await bumpDictionaryVersion(user.organizationId);
  revalidatePath("/data-collection/outlets");
}

export async function reactivateOutlet(id: string) {
  const user = await requireAuth();
  await db.update(mediaOutletDictionary).set({ isActive: true, updatedAt: new Date() })
    .where(and(
      eq(mediaOutletDictionary.id, id),
      eq(mediaOutletDictionary.organizationId, user.organizationId),
    ));
  await bumpDictionaryVersion(user.organizationId);
  revalidatePath("/data-collection/outlets");
}

/**
 * 硬删一个 outlet 的影响面预览(给 confirm dialog 用)。
 * 返回引用了该 outlet_id 但 FK 没约束的下游 dangling 数。
 */
export async function getOutletDeletionImpact(id: string): Promise<{
  outletName: string;
  isActive: boolean;
  collectedItems: number;
  collectionSources: number;
}> {
  const user = await requireAuth();
  const [outlet] = await db
    .select()
    .from(mediaOutletDictionary)
    .where(and(
      eq(mediaOutletDictionary.id, id),
      eq(mediaOutletDictionary.organizationId, user.organizationId),
    ))
    .limit(1);
  if (!outlet) throw new Error("outlet 不存在");

  const itemsRows = await db.execute(
    sql`SELECT count(*)::int AS n FROM collected_items WHERE outlet_id = ${id}::uuid AND organization_id = ${user.organizationId}::uuid`,
  );
  const sourcesRows = await db.execute(
    sql`SELECT count(*)::int AS n FROM collection_sources WHERE outlet_id = ${id}::uuid AND organization_id = ${user.organizationId}::uuid`,
  );
  const items = Number((itemsRows as unknown as Array<{ n: number }>)[0]?.n ?? 0);
  const sources = Number((sourcesRows as unknown as Array<{ n: number }>)[0]?.n ?? 0);

  return {
    outletName: outlet.outletName,
    isActive: outlet.isActive,
    collectedItems: items,
    collectionSources: sources,
  };
}

/**
 * 彻底删除一个 outlet 行,只允许在 is_active=false 时执行。
 * 同步把 collected_items / collection_sources 中引用它的 outlet_id 置 NULL,
 * 清理 dangling 引用。
 */
export async function hardDeleteOutlet(id: string): Promise<void> {
  const user = await requireAuth();
  const [outlet] = await db
    .select()
    .from(mediaOutletDictionary)
    .where(and(
      eq(mediaOutletDictionary.id, id),
      eq(mediaOutletDictionary.organizationId, user.organizationId),
    ))
    .limit(1);
  if (!outlet) throw new Error("outlet 不存在");
  if (outlet.isActive) {
    throw new Error("启用中的媒体不能彻底删除,请先停用");
  }

  // 1) 清理 dangling 引用
  await db.execute(
    sql`UPDATE collected_items SET outlet_id = NULL WHERE outlet_id = ${id}::uuid AND organization_id = ${user.organizationId}::uuid`,
  );
  await db.execute(
    sql`UPDATE collection_sources SET outlet_id = NULL WHERE outlet_id = ${id}::uuid AND organization_id = ${user.organizationId}::uuid`,
  );

  // 2) 真删 outlet
  await db
    .delete(mediaOutletDictionary)
    .where(and(
      eq(mediaOutletDictionary.id, id),
      eq(mediaOutletDictionary.organizationId, user.organizationId),
    ));

  await bumpDictionaryVersion(user.organizationId);
  revalidatePath("/data-collection/outlets");
}

export async function reseedDictionary() {
  const user = await requireAuth();
  if (!user.isSuperAdmin) throw new Error("权限不足");
  const result = await seedMediaOutletDictionary(user.organizationId);
  await bumpDictionaryVersion(user.organizationId);
  revalidatePath("/data-collection/outlets");
  return result;
}

export async function correctItemOutlet(itemId: string, outletId: string | null) {
  const user = await requireAuth();
  let outletTier: string | null = null;
  let outletRegion: string | null = null;
  if (outletId) {
    const [outlet] = await db.select().from(mediaOutletDictionary)
      .where(and(
        eq(mediaOutletDictionary.id, outletId),
        eq(mediaOutletDictionary.organizationId, user.organizationId),
      )).limit(1);
    if (!outlet) throw new Error("outlet 不存在或跨 org");
    outletTier = outlet.outletTier;
    outletRegion = outlet.outletRegion;
  }
  await db.update(collectedItems).set({ outletId, outletTier, outletRegion, updatedAt: new Date() })
    .where(and(
      eq(collectedItems.id, itemId),
      eq(collectedItems.organizationId, user.organizationId),
    ));
  revalidatePath("/data-collection/content");
}

export async function batchRecognizeOutlets() {
  const user = await requireAuth();
  if (!user.isSuperAdmin) throw new Error("权限不足");
  await inngest.send({
    name: "collection/outlet-batch-recognize.requested",
    data: { organizationId: user.organizationId },
  });
}
