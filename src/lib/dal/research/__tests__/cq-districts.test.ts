// src/lib/dal/research/__tests__/cq-districts.test.ts
import { describe, it, expect } from "vitest";
import { listCqDistricts } from "../cq-districts";

describe("listCqDistricts", () => {
  it("returns all 39 Chongqing districts in sortOrder", async () => {
    const result = await listCqDistricts();
    expect(result.length).toBe(39);
    // 校验排序稳定
    for (let i = 1; i < result.length; i++) {
      expect(result[i].sortOrder).toBeGreaterThanOrEqual(result[i - 1].sortOrder);
    }
    // 抽查关键区县存在
    const names = result.map((r) => r.name);
    expect(names).toContain("两江新区");
    expect(names).toContain("北碚区");
    expect(names).toContain("巫溪县");
  });
});
