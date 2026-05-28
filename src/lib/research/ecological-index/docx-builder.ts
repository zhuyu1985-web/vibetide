// src/lib/research/ecological-index/docx-builder.ts
//
// 生态文明传播指数报告 - 排行榜及解读 docx 生成
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §5.4 Step 5
// docx lib: docx@9.6.1 (P0.1 spike 已 vetted, ImageRun 必须显式 type: "png")
//
// 输入: ComputeResult + 3 张图 PNG Buffer
// 输出: docx Buffer (可 upload 到 Supabase Storage)

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  AlignmentType,
  WidthType,
  BorderStyle,
} from "docx";

import type { ComputeResult, FinalScore } from "./compute";

// ============ 公共样式 ============
const CHART_WIDTH_PX = 600;  // docx 内图片宽度(像素)
const HEADER_FILL = "1F6FEB";

const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
};

// ============ 工具函数 ============

function p(
  text: string,
  opts?: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; bold?: boolean; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] },
): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts?.bold })],
    heading: opts?.heading,
    alignment: opts?.alignment,
    spacing: { after: 120 },
  });
}

function cell(
  text: string,
  opts?: { bold?: boolean; fill?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] },
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: opts?.bold, color: opts?.fill ? "FFFFFF" : "000000" })],
        alignment: opts?.align ?? AlignmentType.CENTER,
      }),
    ],
    shading: opts?.fill ? { fill: opts.fill, color: "auto", type: "clear" } : undefined,
    borders: CELL_BORDER,
  });
}

function imageParagraph(buffer: Buffer, widthPx = CHART_WIDTH_PX, heightPx?: number): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new ImageRun({
        type: "png",
        data: buffer,
        transformation: {
          width: widthPx,
          height: heightPx ?? Math.round((widthPx * 9) / 16),
        },
      }),
    ],
    spacing: { before: 240, after: 240 },
  });
}

// ============ 39 区县评语自动生成 ============

const DIM_LABEL: Record<keyof Pick<FinalScore, "central" | "industry" | "municipal" | "district" | "public">, string> = {
  central: "中央媒体",
  industry: "行业媒体",
  municipal: "市级媒体",
  district: "区县媒体",
  public: "公众行为",
};

function generateDistrictReview(r: FinalScore & { rank: number }): string {
  const dims = [
    { key: "central" as const, score: r.central },
    { key: "industry" as const, score: r.industry },
    { key: "municipal" as const, score: r.municipal },
    { key: "district" as const, score: r.district },
    { key: "public" as const, score: r.public },
  ];
  const strong = dims.filter((d) => d.score >= 80).sort((a, b) => b.score - a.score);
  const weak = dims.filter((d) => d.score < 73).sort((a, b) => a.score - b.score);

  const parts: string[] = [];
  if (strong.length > 0) {
    parts.push(`${strong.map((d) => DIM_LABEL[d.key]).join("、")}表现突出`);
  } else {
    parts.push("各维度均较均衡");
  }
  if (weak.length > 0) {
    parts.push(`${weak.map((d) => DIM_LABEL[d.key]).join("、")}偏弱,需重点提升`);
  } else {
    parts.push("暂无明显短板");
  }

  return `(${r.rank})${r.name}: ${parts.join(";")}。`;
}

// ============ 综合排行表 ============

function buildRankingTable(result: ComputeResult): Table {
  const header = new TableRow({
    children: [
      cell("排名", { bold: true, fill: HEADER_FILL }),
      cell("区县", { bold: true, fill: HEADER_FILL }),
      cell("中央媒体", { bold: true, fill: HEADER_FILL }),
      cell("行业媒体", { bold: true, fill: HEADER_FILL }),
      cell("市级媒体", { bold: true, fill: HEADER_FILL }),
      cell("区县媒体", { bold: true, fill: HEADER_FILL }),
      cell("公众行为", { bold: true, fill: HEADER_FILL }),
      cell("综合得分", { bold: true, fill: HEADER_FILL }),
    ],
    tableHeader: true,
  });

  const rows = result.ranked.map(
    (r) =>
      new TableRow({
        children: [
          cell(String(r.rank)),
          cell(r.name),
          cell(r.central.toFixed(2)),
          cell(r.industry.toFixed(2)),
          cell(r.municipal.toFixed(2)),
          cell(r.district.toFixed(2)),
          cell(r.public.toFixed(2)),
          cell(r.composite.toFixed(2), { bold: true }),
        ],
      }),
  );

  return new Table({
    rows: [header, ...rows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ============ 主入口 ============

export type DocxInput = {
  title: string;                  // "2025 年度重庆市生态文明传播指数排行榜及解读"
  year: number;                   // 2025
  result: ComputeResult;
  charts: {
    compositeBar: Buffer;
    tierPie: Buffer;
    top15Comparison: Buffer;
  };
};

export async function buildRankingReportDocx(input: DocxInput): Promise<Buffer> {
  const { title, year, result, charts } = input;
  const top1 = result.ranked[0]!;
  const bot1 = result.ranked[result.ranked.length - 1]!;
  const { stats } = result;

  const high = result.ranked.filter((r) => r.composite >= 80);
  const mid = result.ranked.filter((r) => r.composite >= 72 && r.composite < 80);
  const low = result.ranked.filter((r) => r.composite < 72);

  const sections = [
    // 标题
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 32 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 240 },
    }),

    // 一、引言
    p("一、引言", { heading: HeadingLevel.HEADING_1, bold: true }),
    p(
      `本报告基于重庆市 ${result.ranked.length} 个区县媒体数据,综合中央媒体、行业媒体、市级媒体、` +
        `区县媒体、公众行为引导 5 个维度,每个维度下含报道数量、主题丰富度、传播速度 3 个子指标,` +
        `共计 15 个二级指标,使用 AHP 层次分析法权重 + min-max 区间化 [65, 95] 计算得出 ${year} 年度综合排名。`,
    ),

    // 二、综合排行
    p("二、综合排行", { heading: HeadingLevel.HEADING_1, bold: true }),
    p(`表 2-1: ${year} 年度重庆市生态文明传播指数综合排行表`, { bold: true }),
    buildRankingTable(result),
    p(""),
    p(`图 2-1: ${year} 年度 ${result.ranked.length} 区县综合得分排行(按梯队着色)`, {
      bold: true,
      alignment: AlignmentType.CENTER,
    }),
    imageParagraph(charts.compositeBar, 600, 320),
    p(`图 2-2: ${year} 年度综合得分梯队分布`, { bold: true, alignment: AlignmentType.CENTER }),
    imageParagraph(charts.tierPie, 400, 400),

    // 三、整体情况分析
    p("三、整体情况分析", { heading: HeadingLevel.HEADING_1, bold: true }),
    p("(一)整体差异", { heading: HeadingLevel.HEADING_2, bold: true }),
    p(
      `从整体来看,各区县关于生态文明传播的得分存在较大的差异。最高分"${top1.name}"达到了 ${top1.composite.toFixed(2)} 分,` +
        `而最低分"${bot1.name}"为 ${bot1.composite.toFixed(2)} 分,两者之间的分差达到了 ${stats.span.toFixed(2)} 分。` +
        `这种显著的差异表明,各区县在生态文明传播方面的努力程度和效果存在明显的差异。`,
    ),
    p("(二)分布等级", { heading: HeadingLevel.HEADING_2, bold: true }),
    p(
      `本期共有 ${high.length} 个区县进入高分等级 (≥ 80 分),${mid.length} 个区县属于中分等级 (72-80 分),` +
        `${low.length} 个区县在低分等级 (< 72 分)。这种 "金字塔" 形状的分布反映了重庆市生态文明传播工作的整体不均衡:` +
        `高分等级数量较少,但拉高整体平均水平;中分等级数量最大,是后续提升的重点;低分等级有较大改进空间。`,
    ),
    p("(三)区域差异", { heading: HeadingLevel.HEADING_2, bold: true }),
    p(
      `${top1.name}作为本期排名第一的区县,在多个维度全面占优,展现了较强的传播力。` +
        `中心城区与非中心城区在媒体传播力和市级媒体覆盖广度上呈现一定差异。` +
        `${bot1.name}等区县处于总榜单的末位区段,可能与其地理位置、经济发展水平、媒体资源密度等因素有关,有较大提升空间。`,
    ),
    p("(四)平均值分析", { heading: HeadingLevel.HEADING_2, bold: true }),
    p(
      `重庆市 ${result.ranked.length} 个地区的总分平均值为 ${stats.mean.toFixed(2)},中位数为 ${stats.median.toFixed(2)},` +
        `标准差为 ${stats.stdev.toFixed(2)}。两者差异较小(仅 ${Math.abs(stats.mean - stats.median).toFixed(2)} 分),` +
        `说明数据基本呈对称分布;标准差为 ${stats.stdev.toFixed(2)},意味着大多数数据值集中在均值 ${stats.mean.toFixed(2)} 附近。` +
        `各区县的生态文明传播发展状况大致在一定范围之内,存在少数偏高与偏低区县,但呈现出相对均衡和平稳的发展态势。`,
    ),

    // 四、五维 Top 对比
    p("四、Top 15 区县五维传播指数对比", { heading: HeadingLevel.HEADING_1, bold: true }),
    p(`图 3-1: ${year} 年度 Top 15 区县五类传播指数对比`, {
      bold: true,
      alignment: AlignmentType.CENTER,
    }),
    imageParagraph(charts.top15Comparison, 600, 320),

    // 五、39 区县评语
    p("五、各区县评语", { heading: HeadingLevel.HEADING_1, bold: true }),
    p(`(一)高分等级 (80 分及以上 ${high.length} 个)`, {
      heading: HeadingLevel.HEADING_2,
      bold: true,
    }),
    ...high.map((r) => p(generateDistrictReview(r))),
    p(`(二)中分等级 (72-80 分 ${mid.length} 个)`, { heading: HeadingLevel.HEADING_2, bold: true }),
    ...mid.map((r) => p(generateDistrictReview(r))),
    p(`(三)低分等级 (72 分以下 ${low.length} 个)`, { heading: HeadingLevel.HEADING_2, bold: true }),
    ...low.map((r) => p(generateDistrictReview(r))),
  ];

  const doc = new Document({
    sections: [{ children: sections }],
  });

  return await Packer.toBuffer(doc);
}
