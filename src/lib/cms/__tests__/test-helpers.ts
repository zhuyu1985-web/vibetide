/**
 * CMS 测试工具：mock 全局 fetch、构建典型响应。
 *
 * 用法：
 *   beforeEach(() => mockCmsFetch([cmsSuccessResponse({...})]));
 *   afterEach(() => restoreCmsFetch());
 */

import { vi } from "vitest";

/** 构建一个 CMS 约定的成功响应 */
export function cmsSuccessResponse<T>(data: T, message = "操作成功"): Response {
  return new Response(
    JSON.stringify({
      state: 200,
      success: true,
      message,
      data,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** 构建一个 CMS 约定的业务错误响应（HTTP 仍 200，state 携带错误码） */
export function cmsErrorResponse(state: number, message: string): Response {
  return new Response(
    JSON.stringify({
      state,
      success: false,
      message,
      data: null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** 构建一个真正的 HTTP 层错误响应（如 5xx） */
export function cmsHttpErrorResponse(httpStatus: number, body = ""): Response {
  return new Response(body, { status: httpStatus });
}

/** 构建一个 network 级 AbortError（超时） */
export function cmsAbortError(): Error {
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  return err;
}

// vi.spyOn on globalThis.fetch has awkward typing in strict mode; use a permissive
// holder so the test file stays readable without leaking `any` into consumers.
type FetchSpy = {
  mockRestore: () => void;
};
let fetchSpy: FetchSpy | null = null;
let _queue: Array<Response | Error> = [];

/**
 * 按顺序返回队列中的响应（或抛出错误）。
 * 超出队列容量抛 "no more mock responses"。
 */
export function mockCmsFetch(queue: Array<Response | Error>): void {
  _queue = [...queue];
  const impl: typeof fetch = async () => {
    const next = _queue.shift();
    if (!next) throw new Error("no more mock responses queued");
    if (next instanceof Error) throw next;
    return next;
  };
  fetchSpy = vi
    .spyOn(globalThis as { fetch: typeof fetch }, "fetch")
    .mockImplementation(impl);
}

/** 恢复真实 fetch */
export function restoreCmsFetch(): void {
  if (fetchSpy) {
    fetchSpy.mockRestore();
    fetchSpy = null;
  }
  _queue = [];
}
