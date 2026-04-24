import { describe, it, expect } from "vitest";
// Task 4 — `ALLOWED_TAB_KEYS` / `isAllowedTabKey` 抽到 `@/lib/homepage-template-tabs`
// 以允许 client 组件复用（"use server" 模块不能 export 同步常量/函数）。
import {
  ALLOWED_TAB_KEYS,
  isAllowedTabKey,
} from "@/lib/homepage-template-tabs";
import { SHARED_HOMEPAGE_ACTION_ERROR } from "@/app/actions/homepage-template-order";

describe("isAllowedTabKey", () => {
  it("包含 featured + 8 员工 slug", () => {
    expect(ALLOWED_TAB_KEYS).toEqual([
      "featured",
      "xiaolei",
      "xiaoce",
      "xiaozi",
      "xiaowen",
      "xiaojian",
      "xiaoshen",
      "xiaofa",
      "xiaoshu",
    ]);
  });
  it("custom 不在白名单", () => {
    expect(isAllowedTabKey("custom")).toBe(false);
  });
  it("任意其他字符串不在白名单", () => {
    expect(isAllowedTabKey("xiaoming")).toBe(false);
    expect(isAllowedTabKey("")).toBe(false);
  });
  it("9 个合法 tab 返回 true", () => {
    for (const t of ALLOWED_TAB_KEYS) {
      expect(isAllowedTabKey(t)).toBe(true);
    }
  });
});

describe("SHARED_HOMEPAGE_ACTION_ERROR", () => {
  it("暴露 403/400/409 三种错误 code", () => {
    expect(SHARED_HOMEPAGE_ACTION_ERROR.FORBIDDEN).toBe("FORBIDDEN");
    expect(SHARED_HOMEPAGE_ACTION_ERROR.INVALID_TAB).toBe("INVALID_TAB");
    expect(SHARED_HOMEPAGE_ACTION_ERROR.CONFLICT).toBe("CONFLICT");
  });
});
