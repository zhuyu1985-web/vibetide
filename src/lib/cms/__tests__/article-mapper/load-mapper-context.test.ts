import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadMapperContext } from "@/lib/cms/article-mapper";

const ORIGINAL_ENV = { ...process.env };

function setRequiredEnv() {
  process.env.CMS_HOST = "https://cms.test";
  process.env.CMS_LOGIN_CMC_ID = "id";
  process.env.CMS_LOGIN_CMC_TID = "tid";
  process.env.CMS_TENANT_ID = "t";
  process.env.CMS_USERNAME = "u";
}

describe("loadMapperContext — target override", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CMS_DEFAULT_SITE_ID;
    delete process.env.CMS_DEFAULT_APP_ID;
    delete process.env.CMS_DEFAULT_CATALOG_ID;
    setRequiredEnv();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("不传 target → siteId/appId/catalogId 全部走 env 默认 81/1768/10210", () => {
    const ctx = loadMapperContext({ brandName: "Demo" });
    expect(ctx.siteId).toBe(81);
    expect(ctx.appId).toBe(1768);
    expect(ctx.catalogId).toBe(10210);
  });

  it("传 { catalogId: 10462 } → 只 override catalogId，appId/siteId 仍走默认", () => {
    const ctx = loadMapperContext({ brandName: "Demo" }, { catalogId: 10462 });
    expect(ctx.catalogId).toBe(10462);
    expect(ctx.appId).toBe(1768);
    expect(ctx.siteId).toBe(81);
  });

  it("传完整 target → 三字段全部 override", () => {
    const ctx = loadMapperContext(
      { brandName: "Demo" },
      { catalogId: 10127, appId: 9999, siteId: 99 },
    );
    expect(ctx.catalogId).toBe(10127);
    expect(ctx.appId).toBe(9999);
    expect(ctx.siteId).toBe(99);
  });

  it("env 自定义 + target undefined → 走 env 值", () => {
    process.env.CMS_DEFAULT_CATALOG_ID = "55555";
    const ctx = loadMapperContext({ brandName: "Demo" });
    expect(ctx.catalogId).toBe(55555);
  });
});
