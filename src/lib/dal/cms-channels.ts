import { db } from "@/db";
import { cmsChannels } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface CmsChannelUpsert {
  channelKey: string;
  channelCode: number;
  name: string;
  pickValue?: string;
  thirdFlag?: string;
}

export async function upsertCmsChannel(
  organizationId: string,
  input: CmsChannelUpsert,
): Promise<void> {
  const now = new Date();
  await db
    .insert(cmsChannels)
    .values({
      organizationId,
      channelKey: input.channelKey,
      channelCode: input.channelCode,
      name: input.name,
      pickValue: input.pickValue ?? null,
      thirdFlag: input.thirdFlag ?? null,
      lastSyncedAt: now,
    })
    .onConflictDoUpdate({
      target: [cmsChannels.organizationId, cmsChannels.channelKey],
      set: {
        channelCode: input.channelCode,
        name: input.name,
        pickValue: input.pickValue ?? null,
        thirdFlag: input.thirdFlag ?? null,
        lastSyncedAt: now,
      },
    });
}

export async function listCmsChannels(organizationId: string) {
  return await db.query.cmsChannels.findMany({
    where: eq(cmsChannels.organizationId, organizationId),
    orderBy: (c, { asc }) => [asc(c.channelCode)],
  });
}
