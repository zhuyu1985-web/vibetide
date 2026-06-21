import { describe, it, expect } from "vitest";
import { isConfirm, isCancel } from "../confirm-keywords";

describe("isConfirm/isCancel", () => {
  it("确认词命中", () => {
    expect(isConfirm("开始")).toBe(true);
    expect(isConfirm(" 确认 ")).toBe(true);
    expect(isConfirm("OK")).toBe(true);
  });
  it("取消词命中", () => {
    expect(isCancel("取消")).toBe(true);
    expect(isCancel("算了")).toBe(true);
  });
  it("普通编辑不命中", () => {
    expect(isConfirm("换财经")).toBe(false);
    expect(isCancel("换财经")).toBe(false);
  });
});
