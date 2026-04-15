"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  mediaOutlets,
  mediaOutletAliases,
} from "@/db/schema/research/media-outlets";
import { eq, and } from "drizzle-orm";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";

const tierEnum = z.enum([
  "central",
  "provincial_municipal",
  "industry",
  "district_media",
]);

const aliasSchema = z.object({
  alias: z.string().min(1).max(100),
  matchPattern: z.string().min(1).max(200),
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  tier: tierEnum,
  province: z.string().max(50).optional(),
  districtId: z.string().uuid().optional(),
  industryTag: z.string().max(50).optional(),
  officialUrl: z.string().url().max(500).optional(),
  aliases: z.array(aliasSchema).optional(),
});

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
});

export async function createMediaOutlet(
  input: z.infer<typeof createSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const { userId, organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_MEDIA_OUTLET_MANAGE,
    );
    const data = createSchema.parse(input);

    const [outlet] = await db
      .insert(mediaOutlets)
      .values({
        organizationId,
        createdBy: userId,
        name: data.name,
        tier: data.tier,
        province: data.province,
        districtId: data.districtId,
        industryTag: data.industryTag,
        officialUrl: data.officialUrl,
      })
      .returning();

    if (data.aliases?.length) {
      await db.insert(mediaOutletAliases).values(
        data.aliases.map((a) => ({ outletId: outlet.id, ...a })),
      );
    }

    revalidatePath("/research/admin/media-outlets");
    return { ok: true, id: outlet.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function updateMediaOutlet(
  input: z.infer<typeof updateSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_MEDIA_OUTLET_MANAGE,
    );
    const data = updateSchema.parse(input);
    const { id, aliases, ...patch } = data;

    await db
      .update(mediaOutlets)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(mediaOutlets.id, id),
          eq(mediaOutlets.organizationId, organizationId),
        ),
      );

    // Replace aliases if provided (simple strategy: delete + re-insert)
    if (aliases !== undefined) {
      await db.delete(mediaOutletAliases).where(eq(mediaOutletAliases.outletId, id));
      if (aliases.length > 0) {
        await db.insert(mediaOutletAliases).values(
          aliases.map((a) => ({ outletId: id, ...a })),
        );
      }
    }

    revalidatePath("/research/admin/media-outlets");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function archiveMediaOutlet(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_MEDIA_OUTLET_MANAGE,
    );

    await db
      .update(mediaOutlets)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(
          eq(mediaOutlets.id, id),
          eq(mediaOutlets.organizationId, organizationId),
        ),
      );

    revalidatePath("/research/admin/media-outlets");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function unarchiveMediaOutlet(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_MEDIA_OUTLET_MANAGE,
    );

    await db
      .update(mediaOutlets)
      .set({ status: "active", updatedAt: new Date() })
      .where(
        and(
          eq(mediaOutlets.id, id),
          eq(mediaOutlets.organizationId, organizationId),
        ),
      );

    revalidatePath("/research/admin/media-outlets");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
