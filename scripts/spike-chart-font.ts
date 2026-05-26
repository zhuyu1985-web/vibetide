// scripts/spike-chart-font.ts
// 验证 chartjs-node-canvas 能渲染含中文的 chart
// 用 canvas 包的 registerFont 加载 Noto Sans SC,确保中文标题/标签正常显示
import { writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

async function main() {
  const { ChartJSNodeCanvas } = await import("chartjs-node-canvas");
  const { registerFont } = await import("canvas");

  const fontPath = path.resolve("public/fonts/NotoSansSC-Regular.otf");
  registerFont(fontPath, { family: "Noto Sans SC" });
  console.log(`✓ 字体已注册: ${fontPath}`);

  const width = 1920;
  const height = 1024;
  const canvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: "white",
  });

  const config: import("chart.js").ChartConfiguration = {
    type: "bar",
    data: {
      labels: ["两江新区", "涪陵区", "渝中区", "南岸区", "长寿区"],
      datasets: [
        {
          label: "综合得分",
          data: [86.01, 81.93, 81.25, 81.01, 80.47],
          backgroundColor: "#2E7D32",
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "2025 年度重庆市生态文明传播指数 Top 5",
          font: { family: "Noto Sans SC", size: 24 },
        },
        legend: {
          labels: { font: { family: "Noto Sans SC", size: 16 } },
        },
      },
      scales: {
        x: { ticks: { font: { family: "Noto Sans SC", size: 14 } } },
        y: {
          ticks: { font: { family: "Noto Sans SC", size: 14 } },
          beginAtZero: false,
          min: 75,
        },
      },
    },
  };

  const t0 = performance.now();
  const png = await canvas.renderToBuffer(config);
  const elapsed = performance.now() - t0;

  const outPath = "/tmp/spike-chart-font-output.png";
  writeFileSync(outPath, png);
  console.log(
    `✓ 已生成 ${outPath} (${png.length} bytes, ${elapsed.toFixed(0)} ms, ${width}x${height})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
