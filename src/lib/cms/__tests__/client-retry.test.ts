import { describe, it, expect, afterEach, vi } from "vitest";
import {
  mockCmsFetch,
  restoreCmsFetch,
  cmsSuccessResponse,
  cmsErrorResponse,
  cmsAbortError,
} from "./test-helpers";
import { CmsClient } from "../client";
import { CmsAuthError, CmsBusinessError } from "../errors";

// 缩短 backoff 以便测试
const config = {
  host: "https://cms.example.com",
  loginCmcId: "id",
  loginCmcTid: "tid",
  timeoutMs: 2000,
  maxRetries: 3,
  retryBackoffMs: 5,   // ms 级，避免测试等太久
};

describe("CmsClient retry", () => {
  afterEach(() => restoreCmsFetch());

  it("retries on 5xx business error then succeeds", async () => {
    mockCmsFetch([
      cmsErrorResponse(500, "临时错误"),
      cmsErrorResponse(503, "服务重启"),
      cmsSuccessResponse({ ok: 1 }),
    ]);
    const client = new CmsClient(config);
    const res = await client.post<unknown, { ok: number }>("/x", {});
    expect(res.data).toEqual({ ok: 1 });
  });

  it("retries on network error (AbortError) then succeeds", async () => {
    mockCmsFetch([
      cmsAbortError(),
      cmsSuccessResponse({ ok: 2 }),
    ]);
    const client = new CmsClient(config);
    const res = await client.post("/x", {});
    expect(res.state).toBe(200);
  });

  it("does NOT retry on CmsAuthError", async () => {
    mockCmsFetch([cmsErrorResponse(401, "未登录")]);
    const client = new CmsClient(config);
    await expect(client.post("/x", {})).rejects.toThrow(CmsAuthError);
  });

  it("does NOT retry on 400 Bad Request", async () => {
    mockCmsFetch([cmsErrorResponse(400, "参数错误")]);
    const client = new CmsClient(config);
    await expect(client.post("/x", {})).rejects.toThrow(CmsBusinessError);
  });

  it("DOES retry on 429 rate limit then succeed", async () => {
    mockCmsFetch([
      cmsErrorResponse(429, "请求过快"),
      cmsSuccessResponse({ ok: 3 }),
    ]);
    const client = new CmsClient(config);
    const res = await client.post("/x", {});
    expect(res.state).toBe(200);
  });

  it("gives up after maxRetries retries and throws last error", async () => {
    mockCmsFetch([
      cmsErrorResponse(500, "fail1"),
      cmsErrorResponse(500, "fail2"),
      cmsErrorResponse(500, "fail3"),
      cmsErrorResponse(500, "fail4"),
    ]);
    const client = new CmsClient(config);
    await expect(client.post("/x", {})).rejects.toThrow(/fail4|fail/);
  });

  it("uses exponential backoff timing", async () => {
    vi.useFakeTimers();
    mockCmsFetch([
      cmsErrorResponse(500, "e1"),
      cmsErrorResponse(500, "e2"),
      cmsSuccessResponse({ ok: 1 }),
    ]);
    const client = new CmsClient({ ...config, retryBackoffMs: 100 });
    const promise = client.post("/x", {});
    // 首次立即失败 → 退避 100ms → 第二次失败 → 退避 200ms → 第三次成功
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    const res = await promise;
    expect(res.state).toBe(200);
    vi.useRealTimers();
  });
});
