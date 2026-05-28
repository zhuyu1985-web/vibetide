// src/lib/research/ecological-index/chart-generator.ts
//
// 生态文明传播指数报告 - 3 张可视化图 PNG 生成
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §5.4 Step 4
// 字体: public/fonts/NotoSansSC-Regular.otf (P0.2 spike 已 vetted)
//
// 注意: chartjs-plugin-annotation 未安装,图 1 的平均线 / 80 / 72 阈值线暂以
//       图例信息 + 数据集 segment 表达,后续可由 docx-builder 用文本补充标注。

import path from "node:path";
import { existsSync } from "node:fs";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { registerFont } from "canvas";
import type { ChartConfiguration, LegendItem } from "chart.js";

import type { ComputeResult } from "./compute";

// ============ 字体注册 (模块加载时一次性) ============
const FONT_FAMILY = "Noto Sans SC";
const FONT_PATH = path.resolve("public/fonts/NotoSansSC-Regular.otf");

// 防御: 字体文件缺失时早失败 (生产部署需 includeFiles 打包)
if (existsSync(FONT_PATH)) {
  try {
    registerFont(FONT_PATH, { family: FONT_FAMILY });
  } catch {
    // 同进程内重复 register 会抛错, 忽略即可
  }
}

// ============ 颜色常量 ============
const COLOR = {
  HIGH: "#2E7D32", // 高分等级深绿
  MID: "#81C784", // 中分等级浅绿
  LOW: "#9E9E9E", // 低分等级灰
  MEAN_LINE: "#E57373", // 平均线红虚线 (保留, 供未来 annotation 用)
  // 5 一级颜色 (深绿渐变 → 灰)
  TIER_CENTRAL: "#1B5E20",
  TIER_INDUSTRY: "#43A047",
  TIER_MUNICIPAL: "#81C784",
  TIER_DISTRICT: "#A5D6A7",
  TIER_PUBLIC: "#9E9E9E",
} as const;

function getTierColor(score: number): string {
  if (score >= 80) return COLOR.HIGH;
  if (score >= 72) return COLOR.MID;
  return COLOR.LOW;
}

// ============ Chart 工厂 ============
function makeCanvas(width: number, height: number): ChartJSNodeCanvas {
  return new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: "white",
  });
}

// ============ 图 1: 综合得分柱状图 ============
export async function renderCompositeBarChart(result: ComputeResult): Promise<Buffer> {
  const names = result.ranked.map((r) => r.name);
  const scores = result.ranked.map((r) => r.composite);
  const colors = scores.map((s) => getTierColor(s));
  const mean = result.stats.mean;

  const canvas = makeCanvas(1920, 1024);

  const config: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels: names,
      datasets: [
        {
          label: "综合得分",
          data: scores,
          backgroundColor: colors,
          borderWidth: 0,
        },
      ],
    },
    options: {
      indexAxis: "x",
      plugins: {
        title: {
          display: true,
          text: `2025 年度重庆市生态文明传播指数综合得分排行 (平均 ${mean.toFixed(2)})`,
          font: { family: FONT_FAMILY, size: 22 },
          padding: { bottom: 16 },
        },
        legend: {
          display: true,
          position: "top",
          labels: {
            font: { family: FONT_FAMILY, size: 14 },
            generateLabels: (): LegendItem[] => [
              {
                text: `高分等级 (≥80) ${result.stats.tier_high} 个`,
                fillStyle: COLOR.HIGH,
                strokeStyle: COLOR.HIGH,
                lineWidth: 0,
                hidden: false,
                index: 0,
              },
              {
                text: `中分等级 (72-80) ${result.stats.tier_mid} 个`,
                fillStyle: COLOR.MID,
                strokeStyle: COLOR.MID,
                lineWidth: 0,
                hidden: false,
                index: 1,
              },
              {
                text: `低分等级 (<72) ${result.stats.tier_low} 个`,
                fillStyle: COLOR.LOW,
                strokeStyle: COLOR.LOW,
                lineWidth: 0,
                hidden: false,
                index: 2,
              },
            ],
          },
        },
      },
      scales: {
        x: {
          ticks: {
            font: { family: FONT_FAMILY, size: 11 },
            maxRotation: 60,
            minRotation: 45,
          },
        },
        y: {
          min: 60,
          max: 95,
          ticks: { font: { family: FONT_FAMILY, size: 12 } },
          title: { display: true, text: "综合得分", font: { family: FONT_FAMILY, size: 14 } },
        },
      },
    },
  };

  return await canvas.renderToBuffer(config);
}

// ============ 图 2: 梯队分布饼图 ============
export async function renderTierPieChart(result: ComputeResult): Promise<Buffer> {
  const { tier_high, tier_mid, tier_low } = result.stats;
  const canvas = makeCanvas(1024, 1024);

  const config: ChartConfiguration<"pie"> = {
    type: "pie",
    data: {
      labels: [
        `高分等级 (≥80) ${tier_high} 个`,
        `中分等级 (72-80) ${tier_mid} 个`,
        `低分等级 (<72) ${tier_low} 个`,
      ],
      datasets: [
        {
          data: [tier_high, tier_mid, tier_low],
          backgroundColor: [COLOR.HIGH, COLOR.MID, COLOR.LOW],
          borderColor: "#ffffff",
          borderWidth: 3,
          offset: [12, 0, 0], // 高分片爆开
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "2025 年度 39 区县综合得分梯队分布",
          font: { family: FONT_FAMILY, size: 22 },
          padding: { bottom: 16 },
        },
        legend: {
          display: true,
          position: "bottom",
          labels: { font: { family: FONT_FAMILY, size: 14 } },
        },
      },
    },
  };

  return await canvas.renderToBuffer(config);
}

// ============ 图 3: Top 15 五类对比柱状图 ============
export async function renderTop15ComparisonChart(result: ComputeResult): Promise<Buffer> {
  const top15 = result.ranked.slice(0, 15);
  const labels = top15.map((r) => r.name);
  const canvas = makeCanvas(1920, 1024);

  const config: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "中央媒体指数",
          data: top15.map((r) => r.central),
          backgroundColor: COLOR.TIER_CENTRAL,
        },
        {
          label: "行业媒体指数",
          data: top15.map((r) => r.industry),
          backgroundColor: COLOR.TIER_INDUSTRY,
        },
        {
          label: "市级媒体指数",
          data: top15.map((r) => r.municipal),
          backgroundColor: COLOR.TIER_MUNICIPAL,
        },
        {
          label: "区县媒体指数",
          data: top15.map((r) => r.district),
          backgroundColor: COLOR.TIER_DISTRICT,
        },
        {
          label: "公众行为指数",
          data: top15.map((r) => r.public),
          backgroundColor: COLOR.TIER_PUBLIC,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "2025 年度 Top 15 区县五类传播指数对比",
          font: { family: FONT_FAMILY, size: 22 },
          padding: { bottom: 16 },
        },
        legend: {
          display: true,
          position: "top",
          labels: { font: { family: FONT_FAMILY, size: 13 } },
        },
      },
      scales: {
        x: {
          ticks: {
            font: { family: FONT_FAMILY, size: 12 },
            maxRotation: 45,
            minRotation: 30,
          },
        },
        y: {
          min: 60,
          max: 100,
          ticks: { font: { family: FONT_FAMILY, size: 12 } },
          title: { display: true, text: "指数得分", font: { family: FONT_FAMILY, size: 14 } },
        },
      },
    },
  };

  return await canvas.renderToBuffer(config);
}

// ============ 一次生成 3 张图 ============
export async function renderAllCharts(result: ComputeResult): Promise<{
  compositeBar: Buffer;
  tierPie: Buffer;
  top15Comparison: Buffer;
}> {
  const [compositeBar, tierPie, top15Comparison] = await Promise.all([
    renderCompositeBarChart(result),
    renderTierPieChart(result),
    renderTop15ComparisonChart(result),
  ]);
  return { compositeBar, tierPie, top15Comparison };
}
