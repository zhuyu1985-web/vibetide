// activity-parser 单元测试
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §5.1
// Plan: docs/superpowers/plans/2026-05-26-ecological-index-report-plan.md Task 2.2
//
// Fixture 来源: 副本2025年线下生态宣传活动统计表(1).xlsx (39 区县 × 5 主题)
// 校验点:
//   1. Excel 日期序号 → ISO YYYY-MM-DD (基准 1899-12-30)
//   2. 39 区县全部解析(L5-L43)
//   3. 5 个标准活动主题列
//   4. 两江新区 lastSerial=46376 / firstSerial=46122 → 全 2026 年,触发异常警告
//   5. freq = total / spanDays (含两端 +1)
//
// 注意:Excel 日期序号 45995 实际对应 2025-12-04 (而非任何 2025-12-15 等推断),
//      以 Python 端 vetted 转换为准。

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseActivityXlsx, excelDateSerialToISO } from "../activity-parser";

const fixturePath = path.resolve(
  "src/lib/research/ecological-index/__tests__/fixtures/activity-sample.xlsx",
);

describe("activity-parser", () => {
  it("Excel 日期序号 45995 → 2025-12-04", () => {
    expect(excelDateSerialToISO(45995)).toBe("2025-12-04");
  });

  it("Excel 日期序号 46123 → 2026-04-11 (异常 2026 但保留)", () => {
    expect(excelDateSerialToISO(46123)).toBe("2026-04-11");
  });

  it("解析 39 区县", () => {
    const fixture = readFileSync(fixturePath);
    const result = parseActivityXlsx(fixture);
    expect(result.data).toHaveLength(39);
  });

  it("5 个活动主题列", () => {
    const fixture = readFileSync(fixturePath);
    const result = parseActivityXlsx(fixture);
    expect(result.activityThemes).toEqual([
      "六五环境日",
      "815全国生态日",
      "志愿服务活动",
      "环保设施向公众开放",
      "美丽重庆六进活动",
    ]);
  });

  it("两江新区 异常 2026 日期警告", () => {
    const fixture = readFileSync(fixturePath);
    const result = parseActivityXlsx(fixture);
    const w = result.warnings.find(
      (x) => x.includes("两江新区") && x.includes("2026"),
    );
    expect(w).toBeTruthy();
  });

  it("freq 计算正确 (total / spanDays)", () => {
    const fixture = readFileSync(fixturePath);
    const result = parseActivityXlsx(fixture);
    const wanzhou = result.data.find((d) => d.district === "万州区");
    expect(wanzhou).toBeTruthy();
    if (wanzhou && wanzhou.spanDays > 0) {
      expect(wanzhou.freq).toBeCloseTo(wanzhou.total / wanzhou.spanDays, 3);
    }
  });
});
