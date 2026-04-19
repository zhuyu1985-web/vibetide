import { describe, it, expect, afterEach } from "vitest";
import {
  mockCmsFetch,
  restoreCmsFetch,
  cmsSuccessResponse,
  cmsErrorResponse,
  cmsHttpErrorResponse,
  cmsAbortError,
} from "./test-helpers";
import { CmsClient } from "../client";
import {
  CmsAuthError,
  CmsBusinessError,
  CmsNetworkError,
  CmsSchemaError,
} from "../errors";

const baseConfig = {
  host: "https://cms.example.com",
  loginCmcId: "id123",
  loginCmcTid: "tid123",
  timeoutMs: 5000,
  maxRetries: 0, // 关闭重试，本 task 只测基础
};

describe("CmsClient.post (basic, no retry)", () => {
  afterEach(() => restoreCmsFetch());

  it("injects login_cmc_id and login_cmc_tid headers", async () => {
    mockCmsFetch([cmsSuccessResponse({ ok: 1 })]);
    const client = new CmsClient(baseConfig);
    let capturedHeaders: Record<string, string> = {};
    // 重新 mock 以捕获 request
    restoreCmsFetch();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      capturedHeaders = Object.fromEntries(new Headers(init?.headers).entries());
      return cmsSuccessResponse({ ok: 1 });
    }) as typeof globalThis.fetch;

    await client.post("/x", { any: 1 });

    expect(capturedHeaders["login_cmc_id"]).toBe("id123");
    expect(capturedHeaders["login_cmc_tid"]).toBe("tid123");
    expect(capturedHeaders["content-type"]).toContain("application/json");
    globalThis.fetch = originalFetch;
  });

  it("returns parsed envelope on success", async () => {
    mockCmsFetch([cmsSuccessResponse({ foo: "bar" })]);
    const client = new CmsClient(baseConfig);
    const res = await client.post<unknown, { foo: string }>("/x", {});
    expect(res.success).toBe(true);
    expect(res.state).toBe(200);
    expect(res.data).toEqual({ foo: "bar" });
  });

  it("throws CmsBusinessError when state != 200", async () => {
    mockCmsFetch([cmsErrorResponse(500, "内部错误")]);
    const client = new CmsClient(baseConfig);
    await expect(client.post("/x", {})).rejects.toThrow(CmsBusinessError);
  });

  it("throws CmsAuthError on state=401 / '未登录'", async () => {
    mockCmsFetch([cmsErrorResponse(401, "未登录")]);
    const client = new CmsClient(baseConfig);
    await expect(client.post("/x", {})).rejects.toThrow(CmsAuthError);
  });

  it("throws CmsAuthError when message contains '未登录' even with odd state", async () => {
    mockCmsFetch([cmsErrorResponse(403, "账号未登录，请重试")]);
    const client = new CmsClient(baseConfig);
    await expect(client.post("/x", {})).rejects.toThrow(CmsAuthError);
  });

  it("throws CmsNetworkError on HTTP 5xx", async () => {
    mockCmsFetch([cmsHttpErrorResponse(503, "gateway")]);
    const client = new CmsClient(baseConfig);
    await expect(client.post("/x", {})).rejects.toThrow(CmsBusinessError);
  });

  it("throws CmsNetworkError on fetch AbortError (timeout)", async () => {
    mockCmsFetch([cmsAbortError()]);
    const client = new CmsClient(baseConfig);
    await expect(client.post("/x", {})).rejects.toThrow(CmsNetworkError);
  });

  it("throws CmsSchemaError when response JSON missing required fields", async () => {
    const badResponse = new Response(JSON.stringify({ notAState: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    mockCmsFetch([badResponse]);
    const client = new CmsClient(baseConfig);
    await expect(client.post("/x", {})).rejects.toThrow(CmsSchemaError);
  });
});
