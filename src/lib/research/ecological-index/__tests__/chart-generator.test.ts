// chart-generator 单测
// 注意: chartjs-node-canvas 用 canvas 包 (native binding),
// 在 vitest 环境跑可能慢 (single chart ~300-500ms),
// 只测核心调用是否返回 Buffer + size > 0,不做 pixel-level 对比
//
// 字体 + canvas 编译 prebuilt 已在 P0.2 spike 验证过

import { describe, it, expect } from "vitest";
import {
  renderCompositeBarChart,
  renderTierPieChart,
  renderTop15ComparisonChart,
  renderAllCharts,
} from "../chart-generator";
import type { ComputeResult } from "../compute";

// 简化 fixture: 3 个区县 (跨 high/mid/low 三个梯队)
const fixture: ComputeResult = {
  ranked: [
    {
      rank: 1,
      name: "两江新区",
      central: 86,
      industry: 91,
      municipal: 95,
      district: 84,
      public: 68,
      composite: 86.0,
    },
    {
      rank: 2,
      name: "渝中区",
      central: 80,
      industry: 84,
      municipal: 82,
      district: 87,
      public: 68,
      composite: 75.0,
    },
    {
      rank: 3,
      name: "垫江县",
      central: 70,
      industry: 66,
      municipal: 68,
      district: 77,
      public: 68,
      composite: 69.0,
    },
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

describe("chart-generator", () => {
  it("renderCompositeBarChart 返回 PNG Buffer", async () => {
    const png = await renderCompositeBarChart(fixture);
    expect(png).toBeInstanceOf(Buffer);
    expect(png.byteLength).toBeGreaterThan(5000); // 应有 10KB+
    // PNG 文件头 89 50 4E 47
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
  }, 15_000);

  it("renderTierPieChart 返回 PNG Buffer", async () => {
    const png = await renderTierPieChart(fixture);
    expect(png).toBeInstanceOf(Buffer);
    expect(png.byteLength).toBeGreaterThan(5000);
  }, 15_000);

  it("renderTop15ComparisonChart 返回 PNG Buffer", async () => {
    const png = await renderTop15ComparisonChart(fixture);
    expect(png).toBeInstanceOf(Buffer);
    expect(png.byteLength).toBeGreaterThan(5000);
  }, 15_000);

  it("renderAllCharts 并发生成 3 张图", async () => {
    const charts = await renderAllCharts(fixture);
    expect(charts.compositeBar).toBeInstanceOf(Buffer);
    expect(charts.tierPie).toBeInstanceOf(Buffer);
    expect(charts.top15Comparison).toBeInstanceOf(Buffer);
  }, 20_000);
});
