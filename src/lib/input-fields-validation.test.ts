import { describe, it, expect } from "vitest";
import { validateInputs } from "@/lib/input-fields-validation";
import type { InputFieldDef } from "@/lib/types";

describe("validateInputs", () => {
  it("text: required 字段为空时返回「必填」错误", () => {
    const fields: InputFieldDef[] = [{ name: "a", label: "A", type: "text", required: true }];
    expect(validateInputs(fields, { a: "" }).errors).toEqual({ a: "必填" });
  });

  it("text: minLength 校验", () => {
    const fields: InputFieldDef[] = [
      { name: "a", label: "A", type: "text", required: true, validation: { minLength: 3 } },
    ];
    expect(validateInputs(fields, { a: "ab" }).errors).toHaveProperty("a");
    expect(validateInputs(fields, { a: "abcd" }).errors).not.toHaveProperty("a");
  });

  it("number: min/max 校验", () => {
    const fields: InputFieldDef[] = [
      { name: "n", label: "N", type: "number", required: true, validation: { min: 1, max: 10 } },
    ];
    expect(validateInputs(fields, { n: 0 }).errors).toHaveProperty("n");
    expect(validateInputs(fields, { n: 11 }).errors).toHaveProperty("n");
    expect(validateInputs(fields, { n: 5 }).errors).not.toHaveProperty("n");
  });

  it("select: 值必须匹配 options（兼容 string 数组与 {value,label} 对象数组）", () => {
    const fieldStrOpts: InputFieldDef[] = [
      { name: "s", label: "S", type: "select", required: true, options: ["x", "y"] },
    ];
    expect(validateInputs(fieldStrOpts, { s: "z" }).errors).toHaveProperty("s");
    expect(validateInputs(fieldStrOpts, { s: "x" }).errors).not.toHaveProperty("s");

    const fieldObjOpts: InputFieldDef[] = [
      { name: "t", label: "T", type: "select", required: true, options: [{ value: "a", label: "A" }] },
    ];
    expect(validateInputs(fieldObjOpts, { t: "b" }).errors).toHaveProperty("t");
    expect(validateInputs(fieldObjOpts, { t: "a" }).errors).not.toHaveProperty("t");
  });

  it("daterange: 必须是 {start, end}", () => {
    const fields: InputFieldDef[] = [
      { name: "r", label: "R", type: "daterange", required: true },
    ];
    expect(validateInputs(fields, { r: null }).errors).toHaveProperty("r");
    expect(
      validateInputs(fields, { r: { start: "2026-04-01", end: "2026-04-20" } }).errors
    ).not.toHaveProperty("r");
  });

  it("optional 字段为空时允许通过", () => {
    const fields: InputFieldDef[] = [{ name: "a", label: "A", type: "text" }];
    expect(validateInputs(fields, {}).errors).toEqual({});
  });

  it("cleaned 返回归一化后的值（number 字符串转 number）", () => {
    const fields: InputFieldDef[] = [{ name: "n", label: "N", type: "number" }];
    const { cleaned } = validateInputs(fields, { n: "5" });
    expect(cleaned.n).toBe(5);
  });
});
