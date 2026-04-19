import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MapperContext } from "../../article-mapper/common";

// mock DAL 层
vi.mock("@/lib/dal/app-channels", () => ({
  getAppChannelBySlug: vi.fn(),
}));
vi.mock("@/lib/dal/cms-apps", () => ({
  listCmsApps: vi.fn(),
}));

import { mapArticleToCms, loadMapperContext } from "../../article-mapper";
import { getAppChannelBySlug } from "@/lib/dal/app-channels";
import { listCmsApps } from "@/lib/dal/cms-apps";

const orgId = "org-1";

describe("mapArticleToCms", () => {
  const ctx: MapperContext = {
    siteId: 81, appId: 10, catalogId: 8634,
    tenantId: "t", loginId: "id", loginTid: "tid", username: "admin",
    source: "x", author: "y",
    listStyleDefault: { imageUrlList: [], listStyleName: "默认", listStyleType: "0" },
    coverImageDefault: "https://cdn/d.jpg",
  };

  it("dispatches to type1 mapper when body present", async () => {
    const dto = await mapArticleToCms(
      {
        id: "x",
        title: "t",
        mediaType: "article",
        body: "<p>内容</p>",
        externalUrl: null,
        galleryImages: null,
        videoId: null,
        audioId: null,
        authorName: null,
        summary: null,
        shortTitle: null,
        tags: [],
        coverImageUrl: null,
        publishStatus: "draft",
        publishedAt: null,
      },
      ctx,
    );
    expect(dto.type).toBe("1");
    expect(dto.content).toContain("内容");
  });

  it("dispatches to type2 mapper for gallery", async () => {
    const dto = await mapArticleToCms(
      {
        id: "x",
        title: "t",
        mediaType: "gallery",
        body: null,
        externalUrl: null,
        galleryImages: [
          { url: "a", caption: null },
          { url: "b", caption: null },
          { url: "c", caption: null },
        ],
        videoId: null,
        audioId: null,
        authorName: null,
        summary: null, shortTitle: null, tags: [], coverImageUrl: null,
        publishStatus: "draft", publishedAt: null,
      },
      ctx,
    );
    expect(dto.type).toBe("2");
  });

  it("dispatches to type4 mapper for external URL", async () => {
    const dto = await mapArticleToCms(
      {
        id: "x", title: "t", mediaType: "article",
        body: null, externalUrl: "https://ext",
        galleryImages: null, videoId: null, audioId: null,
        authorName: null, summary: null, shortTitle: null, tags: [],
        coverImageUrl: null, publishStatus: "draft", publishedAt: null,
      },
      ctx,
    );
    expect(dto.type).toBe("4");
    expect(dto.redirectUrl).toBe("https://ext");
  });

  it("throws for type 5/11 in P1 (not supported this phase)", async () => {
    await expect(
      mapArticleToCms(
        {
          id: "x", title: "t", mediaType: "video",
          body: null, externalUrl: null, galleryImages: null,
          videoId: "vms-1", audioId: null,
          authorName: null, summary: null, shortTitle: null, tags: [],
          coverImageUrl: null, publishStatus: "draft", publishedAt: null,
        },
        ctx,
      ),
    ).rejects.toThrow(/type=5|not supported|P1/i);
  });
});

describe("loadMapperContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CMS_TENANT_ID = "tenant-from-env";
    process.env.CMS_LOGIN_CMC_ID = "id-env";
    process.env.CMS_LOGIN_CMC_TID = "tid-env";
    process.env.CMS_USERNAME = "admin-env";
    process.env.CMS_HOST = "https://cms";
    process.env.CMS_DEFAULT_COVER_URL = "https://cdn/default.jpg";
  });

  it("aggregates from app_channels + cms_apps + env", async () => {
    (getAppChannelBySlug as ReturnType<typeof vi.fn>).mockResolvedValue({
      slug: "app_news",
      displayName: "新闻",
      defaultCatalog: {
        id: "cat-uuid",
        cmsCatalogId: 8634,
        appId: 10,
        siteId: 81,
      },
      defaultListStyle: { listStyleType: "0", listStyleName: "默认", imageUrlList: [] },
      defaultCoverUrl: null,
    });
    (listCmsApps as ReturnType<typeof vi.fn>).mockResolvedValue([
      { siteId: 81, cmsAppId: "10", name: "APP1" },
    ]);

    const ctx = await loadMapperContext(orgId, "app_news", { brandName: "深圳广电" });
    expect(ctx.siteId).toBe(81);
    expect(ctx.catalogId).toBe(8634);
    expect(ctx.loginId).toBe("id-env");
    expect(ctx.tenantId).toBe("tenant-from-env");
    expect(ctx.source).toBe("深圳广电");
    expect(ctx.coverImageDefault).toBe("https://cdn/default.jpg");
  });

  it("throws when app_channel not found", async () => {
    (getAppChannelBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      loadMapperContext(orgId, "app_news", { brandName: "x" }),
    ).rejects.toThrow(/app_channel_not_mapped/);
  });

  it("throws when app_channel has no defaultCatalogId", async () => {
    (getAppChannelBySlug as ReturnType<typeof vi.fn>).mockResolvedValue({
      slug: "app_news",
      defaultCatalog: null,
      defaultListStyle: null,
      defaultCoverUrl: null,
    });
    await expect(
      loadMapperContext(orgId, "app_news", { brandName: "x" }),
    ).rejects.toThrow(/default_catalog|binding/i);
  });
});
