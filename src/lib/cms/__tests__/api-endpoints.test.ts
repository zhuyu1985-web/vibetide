import { describe, it, expect, afterEach } from "vitest";
import { mockCmsFetch, restoreCmsFetch, cmsSuccessResponse } from "./test-helpers";
import { CmsClient } from "../client";
import { getChannels } from "../api-endpoints";

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

import { getAppList } from "../api-endpoints";

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
