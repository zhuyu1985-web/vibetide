/**
 * Phase 4 — cms_publish 工具支持 catalogId/appId/siteId 参数化的单测
 *
 * 6 case:
 *   dryRun:
 *     1. 不传 target → wouldPublish 走 env 默认 81/1768/10210
 *     2. 传 catalogId=10462 → wouldPublish.catalogId === 10462
 *     3. env CMS_DEFAULT_CATALOG_ID=55555 + 不传 → 用 55555
 *   execute:
 *     4. 传完整 {catalogId,appId,siteId} → target 完整传给 publishArticleToCms
 *     5. 全 undefined → target=undefined 不污染参数
 *     6. meta 回显真实使用的 target/默认值
 *
 * 通过 vi.hoisted mock @/lib/cms 的 publishArticleToCms / @/db 的 insert，避免真连库。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const publishArticleToCmsMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cms", () => ({
  publishArticleToCms: publishArticleToCmsMock,
}));
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: insertMock })),
    })),
  },
}));
vi.mock("@/db/schema/articles", () => ({ articles: {} }));

import { invokeToolDirectly } from "../tool-registry";

beforeEach(() => {
  process.env.CMS_HOST = "https://cms.test";
  process.env.CMS_LOGIN_CMC_ID = "id";
  process.env.CMS_LOGIN_CMC_TID = "tid";
  process.env.CMS_TENANT_ID = "t";
  process.env.CMS_USERNAME = "u";
  process.env.VIBETIDE_CMS_PUBLISH_ENABLED = "true";
  delete process.env.CMS_DEFAULT_SITE_ID;
  delete process.env.CMS_DEFAULT_APP_ID;
  delete process.env.CMS_DEFAULT_CATALOG_ID;

  publishArticleToCmsMock.mockReset();
  insertMock.mockReset();
  insertMock.mockResolvedValue([{ id: "art-1" }]);
  publishArticleToCmsMock.mockResolvedValue({
    success: true,
    publicationId: "pub-1",
    cmsArticleId: "9999",
    cmsState: "submitted",
    publishedUrl: "https://web/article/9999",
    previewUrl: "https://preview/9999",
    timings: { totalMs: 100, mappingMs: 10, httpMs: 90 },
  });
});

/**
 * Helper：解开 invokeToolDirectly 的 wrapper { ok, result } 拿到工具自身的返回值。
 */
type ToolResult = Record<string, unknown>;
function unwrap(res: Awaited<ReturnType<typeof invokeToolDirectly>>): ToolResult {
  if (!res.ok) throw new Error(`invokeToolDirectly failed: ${res.error}`);
  return res.result as ToolResult;
}

describe("cms_publish tool — dryRun 回显真实 target", () => {
  it("不传栏目 → wouldPublish.{catalogId,appId,siteId} 走 env 默认 81/1768/10210", async () => {
    const res = await invokeToolDirectly(
      "cms_publish",
      { title: "T", body: "B", dryRun: true },
      { organizationId: "org-1" },
    );
    const result = unwrap(res);
    expect(result).toMatchObject({
      success: true,
      dryRun: true,
      wouldPublish: { catalogId: 10210, appId: 1768, siteId: 81 },
    });
  });

  it("传 catalogId=10462 → wouldPublish.catalogId === 10462", async () => {
    const res = await invokeToolDirectly(
      "cms_publish",
      { title: "T", body: "B", dryRun: true, catalogId: 10462 },
      { organizationId: "org-1" },
    );
    const result = unwrap(res);
    expect(result).toMatchObject({
      dryRun: true,
      wouldPublish: { catalogId: 10462, appId: 1768, siteId: 81 },
    });
  });

  it("env 设了 CMS_DEFAULT_CATALOG_ID=55555 → 不传时走 55555", async () => {
    process.env.CMS_DEFAULT_CATALOG_ID = "55555";
    const res = await invokeToolDirectly(
      "cms_publish",
      { title: "T", body: "B", dryRun: true },
      { organizationId: "org-1" },
    );
    const result = unwrap(res);
    expect(result).toMatchObject({
      dryRun: true,
      wouldPublish: { catalogId: 55555 },
    });
  });
});

describe("cms_publish tool — execute 聚合 target 传给 publishArticleToCms", () => {
  it("传 {catalogId,appId,siteId} → target 完整传下去", async () => {
    await invokeToolDirectly(
      "cms_publish",
      { title: "T", body: "B", catalogId: 10462, appId: 1768, siteId: 81 },
      { organizationId: "org-1" },
    );

    expect(publishArticleToCmsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: "art-1",
        target: { catalogId: 10462, appId: 1768, siteId: 81 },
      }),
    );
  });

  it("全 undefined → target=undefined 不污染参数", async () => {
    await invokeToolDirectly(
      "cms_publish",
      { title: "T", body: "B" },
      { organizationId: "org-1" },
    );
    expect(publishArticleToCmsMock).toHaveBeenCalledWith(
      expect.objectContaining({ target: undefined }),
    );
  });

  it("meta 回显真实使用的 target/默认值", async () => {
    const res = await invokeToolDirectly(
      "cms_publish",
      { title: "T", body: "B", catalogId: 10462 },
      { organizationId: "org-1" },
    );
    const result = unwrap(res);
    expect(result).toMatchObject({
      meta: {
        catalogId: 10462,
        appId: 1768,
        siteId: 81,
      },
    });
  });
});
