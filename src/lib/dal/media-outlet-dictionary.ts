import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { mediaOutletDictionary, type MediaOutletRow } from "@/db/schema/media-outlet-dictionary";
import { organizations } from "@/db/schema/users";

export interface ListOutletsFilter {
  tier?: string;
  region?: string;
  search?: string;
  includeInactive?: boolean;
}

export async function listOutletsByOrg(
  orgId: string,
  filter: ListOutletsFilter = {},
): Promise<MediaOutletRow[]> {
  const conditions = [eq(mediaOutletDictionary.organizationId, orgId)];
  if (!filter.includeInactive) {
    conditions.push(eq(mediaOutletDictionary.isActive, true));
  }
  if (filter.tier) {
    conditions.push(eq(mediaOutletDictionary.outletTier, filter.tier));
  }
  if (filter.region) {
    conditions.push(eq(mediaOutletDictionary.outletRegion, filter.region));
  }
  if (filter.search) {
    const q = `%${filter.search}%`;
    const searchExpr = or(
      ilike(mediaOutletDictionary.outletName, q),
      sql`EXISTS (SELECT 1 FROM unnest(${mediaOutletDictionary.publicAccountNames}) x WHERE x ILIKE ${q})`,
      sql`EXISTS (SELECT 1 FROM unnest(${mediaOutletDictionary.domains}) x WHERE x ILIKE ${q})`,
    );
    if (searchExpr) conditions.push(searchExpr);
  }
  return await db.select().from(mediaOutletDictionary)
    .where(and(...conditions))
    .orderBy(asc(mediaOutletDictionary.outletTier), asc(mediaOutletDictionary.outletName));
}

export async function getOutletById(id: string, orgId: string): Promise<MediaOutletRow | null> {
  const rows = await db.select().from(mediaOutletDictionary)
    .where(and(eq(mediaOutletDictionary.id, id), eq(mediaOutletDictionary.organizationId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function searchOutletsByName(
  orgId: string, query: string, limit = 20,
): Promise<MediaOutletRow[]> {
  const rows = await listOutletsByOrg(orgId, { search: query });
  return rows.slice(0, limit);
}

export async function bumpDictionaryVersion(orgId: string): Promise<number> {
  const result = await db.update(organizations).set({
    mediaOutletDictionaryVersion: sql`${organizations.mediaOutletDictionaryVersion} + 1`,
    updatedAt: new Date(),
  }).where(eq(organizations.id, orgId))
    .returning({ version: organizations.mediaOutletDictionaryVersion });
  return result[0]!.version;
}

export async function getDictionaryVersion(orgId: string): Promise<number> {
  const rows = await db.select({ version: organizations.mediaOutletDictionaryVersion })
    .from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return rows[0]?.version ?? 0;
}
