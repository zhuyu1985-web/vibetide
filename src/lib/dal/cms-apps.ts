import { db } from "@/db";
import { cmsApps } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export interface CmsAppUpsert {
  cmsAppId: string;
  channelKey: string;
  siteId: number;
  name: string;
  appkey?: string;
  appsecret?: string;
}

export async function upsertCmsApp(
  organizationId: string,
  input: CmsAppUpsert,
): Promise<void> {
  const now = new Date();
  await db
    .insert(cmsApps)
    .values({
      organizationId,
      cmsAppId: input.cmsAppId,
      channelKey: input.channelKey,
      siteId: input.siteId,
      name: input.name,
      appkey: input.appkey ?? null,
      appsecret: input.appsecret ?? null,
      lastSyncedAt: now,
    })
    .onConflictDoUpdate({
      target: [cmsApps.organizationId, cmsApps.cmsAppId],
      set: {
        channelKey: input.channelKey,
        siteId: input.siteId,
        name: input.name,
        appkey: input.appkey ?? null,
        appsecret: input.appsecret ?? null,
        lastSyncedAt: now,
      },
    });
}

export async function listCmsApps(
  organizationId: string,
  channelKey?: string,
) {
  const where = channelKey
    ? and(
        eq(cmsApps.organizationId, organizationId),
        eq(cmsApps.channelKey, channelKey),
      )
    : eq(cmsApps.organizationId, organizationId);
  return await db.query.cmsApps.findMany({
    where,
    orderBy: (c, { asc }) => [asc(c.siteId)],
  });
}

export async function getCmsAppBySiteId(
  organizationId: string,
  siteId: number,
) {
  const row = await db.query.cmsApps.findFirst({
    where: and(
      eq(cmsApps.organizationId, organizationId),
      eq(cmsApps.siteId, siteId),
    ),
  });
  return row ?? null;
}
