// scope-parser 单元测试
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §5.1
// Plan: docs/superpowers/plans/2026-05-26-ecological-index-report-plan.md Task 2.1
//
// Fixture 来源: 副本媒体站点名单-2(1).xlsx (94 单位, 14 列)
// 校验点:
//   1. 总数 94
//   2. 分级分布 央4 业2 市6 融41 政41 (其中市6 = 省/市级4 + 市级2 合并)
//   3. 江北区 + 渝北区 → 两江新区
//   4. L32 忠州新闻 districtOrig=null → districtNormalized=忠县
//   5. 公众号别名用 "|" 分隔
//   6. 微博 URL → UID 提取

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseMediaScopeXlsx } from "../scope-parser";

const fixturePath = path.resolve(
  "src/lib/research/ecological-index/__tests__/fixtures/scope-sample.xlsx",
);

describe("scope-parser", () => {
  it("解析 94 个单位", () => {
    const fixture = readFileSync(fixturePath);
    const result = parseMediaScopeXlsx(fixture);
    expect(result.stats.totalUnits).toBe(94);
  });

  it("分级分布: 央4 业2 市6 融41 政41", () => {
    const fixture = readFileSync(fixturePath);
    const result = parseMediaScopeXlsx(fixture);
    expect(result.stats.centralCount).toBe(4);
    expect(result.stats.industryCount).toBe(2);
    expect(result.stats.municipalCount).toBe(6);
    expect(result.stats.districtRmtCount).toBe(41);
    expect(result.stats.districtGovCount).toBe(41);
  });

  it("江北区 + 渝北区 → 两江新区归并", () => {
    const fixture = readFileSync(fixturePath);
    const result = parseMediaScopeXlsx(fixture);
    const jiangbei = result.units.find((u) => u.name === "江北发布");
    const yubei = result.units.find((u) => u.name === "渝北发布");
    expect(jiangbei?.districtOrig).toBe("江北区");
    expect(jiangbei?.districtNormalized).toBe("两江新区");
    expect(yubei?.districtOrig).toBe("渝北区");
    expect(yubei?.districtNormalized).toBe("两江新区");
  });

  it("L32 忠州新闻 → 忠县补全", () => {
    const fixture = readFileSync(fixturePath);
    const result = parseMediaScopeXlsx(fixture);
    const unit = result.units.find((u) => u.name === "忠州新闻");
    expect(unit?.districtNormalized).toBe("忠县");
    // notes 应记录补全行为,便于人工审计
    expect(unit?.notes).toContain("district");
  });

  it("公众号别名 | 分隔解析", () => {
    const fixture = readFileSync(fixturePath);
    const result = parseMediaScopeXlsx(fixture);
    const cctv = result.units.find((u) => u.name.includes("央视"));
    expect(cctv?.wechatNames).toContain("央视新闻");
    expect(cctv?.wechatNames).toContain("央视财经");
  });

  it("微博 URL 提取 UID", () => {
    const fixture = readFileSync(fixturePath);
    const result = parseMediaScopeXlsx(fixture);
    const rmrb = result.units.find((u) => u.name === "人民日报");
    expect(rmrb?.weiboUid).toBe("2803301701");
  });
});
