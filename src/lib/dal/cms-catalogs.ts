import { db } from "@/db";
import { cmsCatalogs } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export interface CmsCatalogFields {
  cmsCatalogId: number;
  appId: number;
  siteId: number;
  name: string;
  parentId?: number;
  innerCode?: string;
  alias?: string;
  treeLevel?: number;
  isLeaf?: boolean;
  catalogType?: number;
  videoPlayer?: string;
  audioPlayer?: string;
  livePlayer?: string;
  vlivePlayer?: string;
  h5Preview?: string;
  pcPreview?: string;
  url?: string;
}

export async function insertCmsCatalog(
  organizationId: string,
  input: CmsCatalogFields,
): Promise<void> {
  const now = new Date();
  await db.insert(cmsCatalogs).values({
    organizationId,
    cmsCatalogId: input.cmsCatalogId,
    appId: input.appId,
    siteId: input.siteId,
    name: input.name,
    parentId: input.parentId ?? 0,
    innerCode: input.innerCode ?? null,
    alias: input.alias ?? null,
    treeLevel: input.treeLevel ?? null,
    isLeaf: input.isLeaf ?? true,
    catalogType: input.catalogType ?? 1,
    videoPlayer: input.videoPlayer ?? null,
    audioPlayer: input.audioPlayer ?? null,
    livePlayer: input.livePlayer ?? null,
    vlivePlayer: input.vlivePlayer ?? null,
    h5Preview: input.h5Preview ?? null,
    pcPreview: input.pcPreview ?? null,
    url: input.url ?? null,
    lastSyncedAt: now,
  });
}

export async function updateCmsCatalog(
  organizationId: string,
  cmsCatalogId: number,
  patch: Partial<CmsCatalogFields>,
): Promise<void> {
  await db
    .update(cmsCatalogs)
    .set({ ...patch, lastSyncedAt: new Date(), deletedAt: null })
    .where(
      and(
        eq(cmsCatalogs.organizationId, organizationId),
        eq(cmsCatalogs.cmsCatalogId, cmsCatalogId),
      ),
    );
}

export async function softDeleteCmsCatalog(
  organizationId: string,
  cmsCatalogId: number,
): Promise<void> {
  await db
    .update(cmsCatalogs)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(cmsCatalogs.organizationId, organizationId),
        eq(cmsCatalogs.cmsCatalogId, cmsCatalogId),
      ),
    );
}

export async function findCmsCatalogByCmsId(
  organizationId: string,
  cmsCatalogId: number,
) {
  const row = await db.query.cmsCatalogs.findFirst({
    where: and(
      eq(cmsCatalogs.organizationId, organizationId),
      eq(cmsCatalogs.cmsCatalogId, cmsCatalogId),
    ),
  });
  return row ?? null;
}

export async function listCmsCatalogsByApp(
  organizationId: string,
  appId: number,
  options: { includeDeleted?: boolean } = {},
) {
  const conditions = [
    eq(cmsCatalogs.organizationId, organizationId),
    eq(cmsCatalogs.appId, appId),
  ];
  if (!options.includeDeleted) conditions.push(isNull(cmsCatalogs.deletedAt));
  return await db.query.cmsCatalogs.findMany({
    where: and(...conditions),
    orderBy: (c, { asc }) => [asc(c.treeLevel), asc(c.innerCode)],
  });
}

export async function listAllActiveCmsCatalogs(organizationId: string) {
  return await db.query.cmsCatalogs.findMany({
    where: and(
      eq(cmsCatalogs.organizationId, organizationId),
      isNull(cmsCatalogs.deletedAt),
    ),
  });
}
