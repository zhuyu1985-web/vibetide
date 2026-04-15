// src/lib/dal/research/media-outlets.ts
import { db } from "@/db";
import {
  mediaOutlets,
  mediaOutletAliases,
} from "@/db/schema/research/media-outlets";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { eq, and, desc, sql } from "drizzle-orm";

export type MediaTier =
  | "central"
  | "provincial_municipal"
  | "industry"
  | "district_media";

export type MediaOutletSummary = {
  id: string;
  name: string;
  tier: MediaTier;
  province: string | null;
  districtName: string | null;
  industryTag: string | null;
  officialUrl: string | null;
  status: "active" | "archived";
  aliasCount: number;
};

export async function listMediaOutlets(opts: {
  organizationId: string;
  tier?: MediaTier;
  search?: string;
}): Promise<MediaOutletSummary[]> {
  const conds = [eq(mediaOutlets.organizationId, opts.organizationId)];
  if (opts.tier) conds.push(eq(mediaOutlets.tier, opts.tier));

  const rows = await db
    .select({
      id: mediaOutlets.id,
      name: mediaOutlets.name,
      tier: mediaOutlets.tier,
      province: mediaOutlets.province,
      districtName: cqDistricts.name,
      industryTag: mediaOutlets.industryTag,
      officialUrl: mediaOutlets.officialUrl,
      status: mediaOutlets.status,
    })
    .from(mediaOutlets)
    .leftJoin(cqDistricts, eq(mediaOutlets.districtId, cqDistricts.id))
    .where(and(...conds))
    .orderBy(desc(mediaOutlets.createdAt));

  // Alias count via raw SQL count to avoid depending on db.$count availability
  const aliasCounts = await db
    .select({
      outletId: mediaOutletAliases.outletId,
      count: sql<number>`count(${mediaOutletAliases.id})::int`.as("count"),
    })
    .from(mediaOutletAliases)
    .groupBy(mediaOutletAliases.outletId);

  const aliasMap = new Map(aliasCounts.map((a) => [a.outletId, a.count]));

  let result: MediaOutletSummary[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    tier: r.tier as MediaTier,
    province: r.province,
    districtName: r.districtName ?? null,
    industryTag: r.industryTag,
    officialUrl: r.officialUrl,
    status: r.status as "active" | "archived",
    aliasCount: aliasMap.get(r.id) ?? 0,
  }));

  if (opts.search) {
    const q = opts.search.toLowerCase();
    result = result.filter((r) => r.name.toLowerCase().includes(q));
  }
  return result;
}

export async function getMediaOutletById(id: string, organizationId: string) {
  const [outlet] = await db
    .select()
    .from(mediaOutlets)
    .where(
      and(
        eq(mediaOutlets.id, id),
        eq(mediaOutlets.organizationId, organizationId),
      ),
    );
  if (!outlet) return null;
  const aliases = await db
    .select()
    .from(mediaOutletAliases)
    .where(eq(mediaOutletAliases.outletId, id));
  return { outlet, aliases };
}
