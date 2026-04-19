import { describe, it, expect, afterEach } from "vitest";
import { mockCmsFetch, restoreCmsFetch, cmsSuccessResponse } from "./test-helpers";
import { CmsClient } from "../client";
import { getChannels, getAppList, getCatalogTree } from "../api-endpoints";

const cfg = {
  host: "https://cms.example.com",
  loginCmcId: "id",
  loginCmcTid: "tid",
  maxRetries: 0,
};

describe("getChannels", () => {
  afterEach(() => restoreCmsFetch());

  it("returns CHANNEL_APP with typed structure", async () => {
    mockCmsFetch([
      cmsSuccessResponse({
        CHANNEL_APP: { code: 1, pickValue: "1", thirdFlag: "2", name: "APP" },
        CHANNEL_WEB: { code: 2, pickValue: "0", thirdFlag: "2", name: "网站" },
      }),
    ]);
    const client = new CmsClient(cfg);
    const res = await getChannels(client);
    expect(res.data?.CHANNEL_APP?.code).toBe(1);
    expect(res.data?.CHANNEL_WEB?.name).toBe("网站");
  });

  it("passes appAndWeb/privilegeFlag options in body", async () => {
    let captured: unknown;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      captured = JSON.parse((init?.body as string) ?? "{}");
      return cmsSuccessResponse({});
    }) as typeof globalThis.fetch;
    try {
      const client = new CmsClient(cfg);
      await getChannels(client, { appAndWeb: 1, privilegeFlag: 0 });
      expect(captured).toEqual({ appAndWeb: 1, privilegeFlag: 0 });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws CmsSchemaError when data shape invalid", async () => {
    mockCmsFetch([
      cmsSuccessResponse({
        CHANNEL_APP: { codeWrong: "bad" }, // missing required fields
      }),
    ]);
    const client = new CmsClient(cfg);
    await expect(getChannels(client)).rejects.toThrow(/CHANNEL|invalid|code/i);
  });
});

describe("getAppList", () => {
  afterEach(() => restoreCmsFetch());

  it("returns an array of CmsApp entries", async () => {
    mockCmsFetch([
      cmsSuccessResponse([
        { id: 1, siteid: 73, name: "A", type: 1, appkey: null, appsecret: null, addtime: null },
        { id: 2, siteid: 73, name: "B", type: 1, appkey: "ak", appsecret: "as", addtime: "2024-01-01" },
      ]),
    ]);
    const client = new CmsClient(cfg);
    const res = await getAppList(client, "1");
    expect(res.data).toHaveLength(2);
    expect(res.data?.[1].appkey).toBe("ak");
  });

  it("sends the correct body { type }", async () => {
    let captured: unknown;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      captured = JSON.parse((init?.body as string) ?? "{}");
      return cmsSuccessResponse([]);
    }) as typeof globalThis.fetch;
    try {
      const client = new CmsClient(cfg);
      await getAppList(client, "2");
      expect(captured).toEqual({ type: "2" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("getCatalogTree", () => {
  afterEach(() => restoreCmsFetch());

  it("returns an array of catalog nodes (flat)", async () => {
    mockCmsFetch([
      cmsSuccessResponse([
        {
          id: 9369, appid: 250, siteId: 73, name: "A", parentId: 0,
          innerCode: "009887", alias: "a", treeLevel: 1, isLeaf: 1, type: 1,
          childCatalog: [],
        },
      ]),
    ]);
    const client = new CmsClient(cfg);
    const res = await getCatalogTree(client, { appId: "250", types: "1" });
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0].id).toBe(9369);
  });

  it("handles recursive children", async () => {
    mockCmsFetch([
      cmsSuccessResponse([
        {
          id: 9373, appid: 250, siteId: 73, name: "父", parentId: 0,
          innerCode: "009891", alias: "p", treeLevel: 1, isLeaf: 0, type: 1,
          childCatalog: [
            {
              id: 9374, appid: 250, siteId: 73, name: "子", parentId: 9373,
              innerCode: "009891000001", alias: "c", treeLevel: 2, isLeaf: 0, type: 1,
              childCatalog: [],
            },
          ],
        },
      ]),
    ]);
    const client = new CmsClient(cfg);
    const res = await getCatalogTree(client, { appId: "250" });
    expect(res.data?.[0].childCatalog?.[0].id).toBe(9374);
  });

  it("forwards optional params", async () => {
    let captured: unknown;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      captured = JSON.parse((init?.body as string) ?? "{}");
      return cmsSuccessResponse([]);
    }) as typeof globalThis.fetch;
    try {
      const client = new CmsClient(cfg);
      await getCatalogTree(client, {
        appId: "250",
        types: "1",
        isPrivilege: "false",
        catalogName: "新闻",
      });
      expect(captured).toMatchObject({
        appId: "250", types: "1", isPrivilege: "false", catalogName: "新闻",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
