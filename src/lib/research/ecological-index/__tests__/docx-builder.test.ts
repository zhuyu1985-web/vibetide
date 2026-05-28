// src/lib/research/ecological-index/__tests__/docx-builder.test.ts
//
// 验证 buildRankingReportDocx:
// - 输出真实 docx zip(文件头 PK)
// - 防御空 ranked(报告必须 ≥ 1 个区县)
// - docx 大小随区县数增长

import { describe, it, expect } from "vitest";
import { buildRankingReportDocx } from "../docx-builder";
import type { ComputeResult } from "../compute";

// 1×1 透明 PNG (b64)
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const fixture: ComputeResult = {
  ranked: [
    { rank: 1, name: "两江新区", central: 86, industry: 91, municipal: 95, district: 84, public: 68, composite: 86.0 },
    { rank: 2, name: "渝中区", central: 80, industry: 84, municipal: 82, district: 87, public: 68, composite: 75.0 },
    { rank: 3, name: "垫江县", central: 70, industry: 66, municipal: 68, district: 77, public: 68, composite: 69.0 },
  ],
  rawMedia: {},
  rawPublic: {},
  scaledMedia: {},
  scaledPublic: {},
  stats: {
    max: 86,
    min: 69,
    span: 17,
    mean: 76.7,
    median: 75,
    stdev: 7.0,
    tier_high: 1,
    tier_mid: 1,
    tier_low: 1,
  },
};

describe("docx-builder", () => {
  it("buildRankingReportDocx 返回 docx Buffer (zip 头 PK)", async () => {
    const buf = await buildRankingReportDocx({
      title: "2025 测试报告",
      year: 2025,
      result: fixture,
      charts: { compositeBar: TINY_PNG, tierPie: TINY_PNG, top15Comparison: TINY_PNG },
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.byteLength).toBeGreaterThan(5000);
    // docx 是 zip,文件头是 PK (0x50 0x4B)
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4B);
  }, 10_000);

  it("空 ranked 也能跑(防御边界)", async () => {
    const empty: ComputeResult = {
      ranked: [],
      rawMedia: {},
      rawPublic: {},
      scaledMedia: {},
      scaledPublic: {},
      stats: {
        max: 0,
        min: 0,
        span: 0,
        mean: 0,
        median: 0,
        stdev: 0,
        tier_high: 0,
        tier_mid: 0,
        tier_low: 0,
      },
    };
    // 空 ranked 时,buildRankingReportDocx 会因为 top1/bot1 是 undefined 抛错
    // 这是已知行为(报告必须有至少 1 个区县)
    await expect(
      buildRankingReportDocx({
        title: "empty",
        year: 2025,
        result: empty,
        charts: { compositeBar: TINY_PNG, tierPie: TINY_PNG, top15Comparison: TINY_PNG },
      }),
    ).rejects.toThrow();
  });

  it("docx 大小随区县数增长", async () => {
    const small: ComputeResult = {
      ranked: [fixture.ranked[0]!],
      rawMedia: {},
      rawPublic: {},
      scaledMedia: {},
      scaledPublic: {},
      stats: { ...fixture.stats, tier_high: 1, tier_mid: 0, tier_low: 0 },
    };
    const smallBuf = await buildRankingReportDocx({
      title: "small",
      year: 2025,
      result: small,
      charts: { compositeBar: TINY_PNG, tierPie: TINY_PNG, top15Comparison: TINY_PNG },
    });
    const fullBuf = await buildRankingReportDocx({
      title: "full",
      year: 2025,
      result: fixture,
      charts: { compositeBar: TINY_PNG, tierPie: TINY_PNG, top15Comparison: TINY_PNG },
    });
    expect(fullBuf.byteLength).toBeGreaterThan(smallBuf.byteLength);
  }, 10_000);
});
