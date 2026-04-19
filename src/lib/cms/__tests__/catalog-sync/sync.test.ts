import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mockCmsFetch,
  restoreCmsFetch,
  cmsSuccessResponse,
} from "../test-helpers";

// mock all DAL
vi.mock("@/lib/dal/cms-channels", () => ({
  upsertCmsChannel: vi.fn(),
  listCmsChannels: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/dal/cms-apps", () => ({
  upsertCmsApp: vi.fn(),
  listCmsApps: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/dal/cms-catalogs", () => ({
  insertCmsCatalog: vi.fn(),
  updateCmsCatalog: vi.fn(),
  softDeleteCmsCatalog: vi.fn(),
  listAllActiveCmsCatalogs: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/dal/cms-sync-logs", () => ({
  startCmsSyncLog: vi.fn().mockResolvedValue("log-uuid-1"),
  completeCmsSyncLog: vi.fn(),
  failCmsSyncLog: vi.fn(),
  getSyncLogById: vi.fn(),
}));

import { syncCmsCatalogs } from "../../catalog-sync/sync";
import { upsertCmsChannel } from "@/lib/dal/cms-channels";
import { upsertCmsApp, listCmsApps } from "@/lib/dal/cms-apps";
import {
  insertCmsCatalog,
  updateCmsCatalog,
  softDeleteCmsCatalog,
} from "@/lib/dal/cms-catalogs";
import {
  startCmsSyncLog,
  completeCmsSyncLog,
  failCmsSyncLog,
} from "@/lib/dal/cms-sync-logs";

const orgId = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CMS_HOST = "https://cms.example.com";
  process.env.CMS_LOGIN_CMC_ID = "id";
  process.env.CMS_LOGIN_CMC_TID = "tid";
  process.env.CMS_TENANT_ID = "tenant";
  process.env.CMS_USERNAME = "admin";
});
afterEach(() => restoreCmsFetch());

describe("syncCmsCatalogs", () => {
  it("runs full happy-path (channels → apps → catalogs)", async () => {
    mockCmsFetch([
      // getChannels
      cmsSuccessResponse({
        CHANNEL_APP: { code: 1, pickValue: "1", thirdFlag: "2", name: "APP" },
        CHANNEL_WEB: { code: 2, pickValue: "0", thirdFlag: "2", name: "网站" },
      }),
      // getAppList type=1
      cmsSuccessResponse([
        { id: 10, siteid: 81, name: "APP1", type: 1, appkey: "ak", appsecret: "as", addtime: null },
      ]),
      // getCatalogTree for app 10
      cmsSuccessResponse([
        { id: 8634, appid: 10, siteId: 81, name: "新闻", parentId: 0,
          innerCode: "001", alias: "news", treeLevel: 1, isLeaf: 1, type: 1, childCatalog: [] },
      ]),
    ]);

    const result = await syncCmsCatalogs(orgId, { triggerSource: "manual", operatorId: "u1" });

    expect(result.success).toBe(true);
    expect(startCmsSyncLog).toHaveBeenCalledWith(orgId, expect.objectContaining({ triggerSource: "manual" }));
    expect(upsertCmsChannel).toHaveBeenCalledWith(orgId, expect.objectContaining({ channelKey: "CHANNEL_APP" }));
    expect(upsertCmsApp).toHaveBeenCalledWith(orgId, expect.objectContaining({ cmsAppId: "10", siteId: 81 }));
    expect(insertCmsCatalog).toHaveBeenCalledWith(orgId, expect.objectContaining({ cmsCatalogId: 8634 }));
    expect(completeCmsSyncLog).toHaveBeenCalledWith("log-uuid-1", expect.objectContaining({
      stats: expect.objectContaining({ inserted: 1 }),
    }));
  });

  it("throws when getChannels returns no CHANNEL_APP", async () => {
    mockCmsFetch([
      cmsSuccessResponse({ CHANNEL_WEB: { code: 2, name: "网站" } }),
    ]);
    const result = await syncCmsCatalogs(orgId, { triggerSource: "manual", operatorId: "u1" });
    expect(result.success).toBe(false);
    expect(failCmsSyncLog).toHaveBeenCalledWith("log-uuid-1", expect.stringMatching(/CHANNEL_APP/));
  });

  it("detects updates for changed catalog name", async () => {
    (listCmsApps as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    // existing local has the same id but different name
    const { listAllActiveCmsCatalogs } = await import("@/lib/dal/cms-catalogs");
    (listAllActiveCmsCatalogs as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "local-1",
        cmsCatalogId: 8634,
        appId: 10, siteId: 81, name: "旧名",
        parentId: 0, innerCode: "001", alias: "news",
        treeLevel: 1, isLeaf: true, catalogType: 1,
        deletedAt: null,
      },
    ]);

    mockCmsFetch([
      cmsSuccessResponse({
        CHANNEL_APP: { code: 1, pickValue: "1", thirdFlag: "2", name: "APP" },
      }),
      cmsSuccessResponse([
        { id: 10, siteid: 81, name: "APP1", type: 1, appkey: null, appsecret: null, addtime: null },
      ]),
      cmsSuccessResponse([
        { id: 8634, appid: 10, siteId: 81, name: "新名", parentId: 0,
          innerCode: "001", alias: "news", treeLevel: 1, isLeaf: 1, type: 1, childCatalog: [] },
      ]),
    ]);

    await syncCmsCatalogs(orgId, { triggerSource: "scheduled" });
    expect(updateCmsCatalog).toHaveBeenCalledWith(orgId, 8634, expect.objectContaining({ name: "新名" }));
  });

  it("soft-deletes catalogs missing from CMS (deleteMissing=true default)", async () => {
    const { listAllActiveCmsCatalogs } = await import("@/lib/dal/cms-catalogs");
    (listAllActiveCmsCatalogs as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "local-stale",
        cmsCatalogId: 9999,
        appId: 10, siteId: 81, name: "已删除",
        parentId: 0, innerCode: "x", alias: "x",
        treeLevel: 1, isLeaf: true, catalogType: 1,
        deletedAt: null,
      },
    ]);

    mockCmsFetch([
      cmsSuccessResponse({ CHANNEL_APP: { code: 1, name: "APP" } }),
      cmsSuccessResponse([{ id: 10, siteid: 81, name: "APP1", type: 1, appkey: null, appsecret: null, addtime: null }]),
      cmsSuccessResponse([]),  // CMS 侧栏目为空
    ]);

    await syncCmsCatalogs(orgId, { triggerSource: "scheduled" });
    expect(softDeleteCmsCatalog).toHaveBeenCalledWith(orgId, 9999);
  });

  it("respects dryRun: does not write to DB", async () => {
    mockCmsFetch([
      cmsSuccessResponse({ CHANNEL_APP: { code: 1, name: "APP" } }),
      cmsSuccessResponse([{ id: 10, siteid: 81, name: "APP1", type: 1, appkey: null, appsecret: null, addtime: null }]),
      cmsSuccessResponse([
        { id: 8634, appid: 10, siteId: 81, name: "x", parentId: 0,
          innerCode: "001", alias: "x", treeLevel: 1, isLeaf: 1, type: 1, childCatalog: [] },
      ]),
    ]);

    const result = await syncCmsCatalogs(orgId, { triggerSource: "manual", dryRun: true });
    expect(result.success).toBe(true);
    expect(insertCmsCatalog).not.toHaveBeenCalled();
    expect(upsertCmsChannel).not.toHaveBeenCalled();
    expect(upsertCmsApp).not.toHaveBeenCalled();
  });
});
