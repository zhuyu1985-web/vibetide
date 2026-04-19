import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { cmsChannels, organizations } from "@/db/schema";
import { upsertCmsChannel, listCmsChannels } from "../cms-channels";
import { eq } from "drizzle-orm";

describe("DAL cms-channels", () => {
  const orgId = randomUUID();
  const otherOrgId = randomUUID();

  beforeAll(async () => {
    // cms_channels.organization_id 有 FK 约束引用 organizations(id)，
    // 随机 UUID 必须先在 organizations 表里存在，否则 insert 会 FK 违例。
    const stamp = Date.now();
    await db
      .insert(organizations)
      .values([
        { id: orgId, name: "cms-channels-test-A", slug: `cms-channels-test-a-${stamp}` },
        { id: otherOrgId, name: "cms-channels-test-B", slug: `cms-channels-test-b-${stamp}` },
      ])
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await db.delete(cmsChannels).where(eq(cmsChannels.organizationId, orgId));
    await db.delete(cmsChannels).where(eq(cmsChannels.organizationId, otherOrgId));
  });

  afterAll(async () => {
    await db.delete(cmsChannels).where(eq(cmsChannels.organizationId, orgId));
    await db.delete(cmsChannels).where(eq(cmsChannels.organizationId, otherOrgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(organizations).where(eq(organizations.id, otherOrgId));
  });

  it("upsertCmsChannel inserts on first call", async () => {
    await upsertCmsChannel(orgId, {
      channelKey: "CHANNEL_APP",
      channelCode: 1,
      name: "APP",
      pickValue: "1",
      thirdFlag: "2",
    });
    const rows = await listCmsChannels(orgId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ channelKey: "CHANNEL_APP", channelCode: 1, name: "APP" });
    expect(rows[0].lastSyncedAt).toBeInstanceOf(Date);
  });

  it("upsertCmsChannel updates on second call with same (orgId, channelKey)", async () => {
    await upsertCmsChannel(orgId, { channelKey: "CHANNEL_APP", channelCode: 1, name: "APP" });
    await upsertCmsChannel(orgId, { channelKey: "CHANNEL_APP", channelCode: 1, name: "APP 更新" });
    const rows = await listCmsChannels(orgId);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("APP 更新");
  });

  it("listCmsChannels only returns records for the org", async () => {
    await upsertCmsChannel(orgId, { channelKey: "CHANNEL_APP", channelCode: 1, name: "A" });
    await upsertCmsChannel(otherOrgId, { channelKey: "CHANNEL_APP", channelCode: 1, name: "B" });
    expect(await listCmsChannels(orgId)).toHaveLength(1);
    expect(await listCmsChannels(otherOrgId)).toHaveLength(1);
  });
});
