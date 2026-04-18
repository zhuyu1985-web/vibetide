import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { cmsApps, organizations } from "@/db/schema";
import { upsertCmsApp, listCmsApps, getCmsAppBySiteId } from "../cms-apps";
import { eq } from "drizzle-orm";

describe("DAL cms-apps", () => {
  const orgId = randomUUID();

  beforeAll(async () => {
    // cms_apps.organization_id 有 FK 约束引用 organizations(id)，
    // 随机 UUID 必须先在 organizations 表里存在，否则 insert 会 FK 违例。
    const stamp = Date.now();
    await db
      .insert(organizations)
      .values([
        { id: orgId, name: "cms-apps-test", slug: `cms-apps-test-${stamp}` },
      ])
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await db.delete(cmsApps).where(eq(cmsApps.organizationId, orgId));
  });

  afterAll(async () => {
    await db.delete(cmsApps).where(eq(cmsApps.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("upsertCmsApp inserts and updates by (org, cmsAppId)", async () => {
    await upsertCmsApp(orgId, {
      cmsAppId: "10",
      channelKey: "CHANNEL_APP",
      siteId: 81,
      name: "深圳广电 APP",
      appkey: "ak_test",
      appsecret: "as_test",
    });
    await upsertCmsApp(orgId, {
      cmsAppId: "10",
      channelKey: "CHANNEL_APP",
      siteId: 81,
      name: "深圳广电 APP v2",
      appkey: "ak_test",
      appsecret: "as_test",
    });
    const rows = await listCmsApps(orgId);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("深圳广电 APP v2");
  });

  it("getCmsAppBySiteId returns the app or null", async () => {
    await upsertCmsApp(orgId, {
      cmsAppId: "10",
      channelKey: "CHANNEL_APP",
      siteId: 81,
      name: "A",
    });
    const app = await getCmsAppBySiteId(orgId, 81);
    expect(app?.cmsAppId).toBe("10");

    const notFound = await getCmsAppBySiteId(orgId, 999);
    expect(notFound).toBeNull();
  });
});
