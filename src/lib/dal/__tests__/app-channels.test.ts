import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { appChannels, cmsCatalogs, organizations } from "@/db/schema";
import {
  upsertAppChannel,
  getAppChannelBySlug,
  listAppChannels,
  updateAppChannelBinding,
} from "../app-channels";
import { eq } from "drizzle-orm";

describe("DAL app-channels", () => {
  const orgId = randomUUID();
  const catalogId = randomUUID();

  beforeAll(async () => {
    // app_channels 有 2 个 FK：
    //   - organization_id → organizations.id
    //   - default_catalog_id → cms_catalogs.id (nullable, 但设置时必须存在)
    // 先 seed organizations，再 seed cms_catalogs（给 updateAppChannelBinding 测试用）。
    const stamp = Date.now();
    await db
      .insert(organizations)
      .values({ id: orgId, name: "test-org-app-ch", slug: `test-app-ch-${stamp}` })
      .onConflictDoNothing();
    await db
      .insert(cmsCatalogs)
      .values({
        id: catalogId,
        organizationId: orgId,
        cmsCatalogId: 99999,
        appId: 999,
        siteId: 999,
        name: "test-catalog-for-app-channels",
      })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await db.delete(appChannels).where(eq(appChannels.organizationId, orgId));
  });

  afterAll(async () => {
    // 逆序清理：先删 app_channels（引用 cms_catalogs），再删 cms_catalogs，最后删 org。
    await db.delete(appChannels).where(eq(appChannels.organizationId, orgId));
    await db.delete(cmsCatalogs).where(eq(cmsCatalogs.id, catalogId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("upsertAppChannel creates with defaults", async () => {
    await upsertAppChannel(orgId, {
      slug: "app_news",
      displayName: "新闻",
      reviewTier: "strict",
      sortOrder: 1,
      icon: "📰",
    });
    const row = await getAppChannelBySlug(orgId, "app_news");
    expect(row?.displayName).toBe("新闻");
    expect(row?.reviewTier).toBe("strict");
  });

  it("getAppChannelBySlug returns null when missing", async () => {
    const row = await getAppChannelBySlug(orgId, "app_not_exist");
    expect(row).toBeNull();
  });

  it("listAppChannels returns records sorted by sortOrder", async () => {
    await upsertAppChannel(orgId, {
      slug: "app_news",
      displayName: "B",
      sortOrder: 2,
      reviewTier: "strict",
    });
    await upsertAppChannel(orgId, {
      slug: "app_home",
      displayName: "A",
      sortOrder: 0,
      reviewTier: "relaxed",
    });
    const list = await listAppChannels(orgId);
    expect(list.map((r) => r.slug)).toEqual(["app_home", "app_news"]);
  });

  it("updateAppChannelBinding sets defaultCatalogId + listStyle", async () => {
    await upsertAppChannel(orgId, {
      slug: "app_news",
      displayName: "新闻",
      reviewTier: "strict",
      sortOrder: 0,
    });
    await updateAppChannelBinding(orgId, "app_news", {
      defaultCatalogId: catalogId,
      defaultListStyle: {
        listStyleType: "0",
        listStyleName: "默认",
        imageUrlList: [],
      },
      defaultCoverUrl: "https://x/cover.jpg",
    });
    const row = await getAppChannelBySlug(orgId, "app_news");
    expect(row?.defaultCatalogId).toBe(catalogId);
    expect(row?.defaultCoverUrl).toContain("cover.jpg");
  });
});
