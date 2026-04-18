import { describe, it, expect, vi, afterEach } from "vitest";
import {
  mockCmsFetch,
  restoreCmsFetch,
  cmsSuccessResponse,
  cmsErrorResponse,
} from "./test-helpers";

describe("test-helpers", () => {
  afterEach(() => restoreCmsFetch());

  it("cmsSuccessResponse builds a proper 200 JSON body", async () => {
    const res = cmsSuccessResponse({ hello: "world" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      state: 200,
      success: true,
      message: "操作成功",
      data: { hello: "world" },
    });
  });

  it("cmsErrorResponse builds error body with custom state and message", async () => {
    const res = cmsErrorResponse(500, "内部错误");
    expect(res.status).toBe(200); // CMS 业务错误走 HTTP 200 但 state != 200
    const data = await res.json();
    expect(data).toEqual({
      state: 500,
      success: false,
      message: "内部错误",
      data: null,
    });
  });

  it("mockCmsFetch intercepts global fetch and returns queued response", async () => {
    mockCmsFetch([cmsSuccessResponse({ foo: "bar" })]);
    const res = await fetch("https://whatever/x");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ foo: "bar" });
  });

  it("mockCmsFetch returns queued responses in order then throws on over-consume", async () => {
    mockCmsFetch([
      cmsSuccessResponse({ n: 1 }),
      cmsSuccessResponse({ n: 2 }),
    ]);
    const r1 = await (await fetch("u")).json();
    const r2 = await (await fetch("u")).json();
    expect(r1.data).toEqual({ n: 1 });
    expect(r2.data).toEqual({ n: 2 });
    await expect(fetch("u")).rejects.toThrow(/no more mock/i);
  });
});
