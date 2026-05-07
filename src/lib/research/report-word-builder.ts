// src/lib/research/report-word-builder.ts
//
// A5 Phase 6 — Word 报告程式构建（docx@9.6.1 lib，无 native binding）
//
// Spec ref: docs/superpowers/specs/2026-05-07-a5-report-export-design.md §5.1 Word 体例
// Plan ref: docs/superpowers/plans/2026-05-07-a5-report-export-plan.md Phase 6 Task 6.2
//
// 体例（学术论文体）：
//   - A4 / 标准页边距（1 英寸 = 1440 twip）
//   - 正文：宋体小四号（12pt = size:24 半点）/ 1.5 倍行距
//   - 章节标题：黑体三号（16pt）
//   - 子章节：黑体小三号（14pt）
//   - 副标题：楷体小三号（16pt）
//
// 字体兜底（spec §1.2.1）：docx 不嵌字体，仅在 XML 里指定字体名。
// Word/WPS 客户端默认有"宋体"/"黑体"/"楷体"（Windows + Office 默认），无需特殊处理。
//
// 结构：封面 → 目录（TOC）→ 第一章 → 第二章（5 小节 + 4 表）→ 第三章 → 附录（6 列表）

import {
  AlignmentType,
  Document,
  HeadingLevel,
  PageBreak,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { AggregatesJson } from "@/db/schema/research/reports";
import type { ReportParagraphs } from "./report-prompts";

// ── 公共类型 ────────────────────────────────────────────────────────

export interface WordBuildInput {
  title: string;
  topicDescription?: string;
  /** ISO date or full ISO timestamp */
  timeRangeStart: string;
  timeRangeEnd: string;
  /** 报告完成时间（ISO timestamp） */
  completedAt: string;
  paragraphs: ReportParagraphs;
  aggregates: AggregatesJson;
  appendix: Array<{
    title: string;
    outletName: string | null;
    outletTier: string | null;
    /** 多区县时已折叠成 "name1、name2"（A5 Plan Phase 6 Task 6.3.1 B-1） */
    districtName: string | null;
    /** ISO date string (yyyy-MM-dd) or null */
    publishedAt: string | null;
  }>;
}

// ── 构建主入口 ──────────────────────────────────────────────────────

export async function buildReportDocx(input: WordBuildInput): Promise<Buffer> {
  const doc = new Document({
    creator: "vibetide",
    title: input.title,
    description: "vibetide 新闻研究报告",
    styles: {
      // 5 个段落样式（spec §5.1）。docx size 单位为半点（half-points）：
      //   宋体小四 = 12pt = size 24
      //   黑体小三 = 14pt = size 28
      //   黑体三号 = 16pt = size 32
      //   楷体小三 = 16pt = size 32
      //   黑体二号 = 22pt = size 44
      // 行距 360 = 1.5 倍行距（240 = 单倍）
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: "宋体", size: 24 },
          paragraph: { spacing: { line: 360 } },
        },
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          run: { font: "黑体", size: 44, bold: true },
          paragraph: { alignment: AlignmentType.CENTER },
        },
        {
          id: "Subtitle",
          name: "Subtitle",
          basedOn: "Normal",
          run: { font: "楷体", size: 32, italics: true },
          paragraph: { alignment: AlignmentType.CENTER },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "黑体", size: 32, bold: true },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "黑体", size: 28, bold: true },
          paragraph: { spacing: { before: 180, after: 90 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            // A4 默认 + 标准页边距（1 英寸 = 1440 twip）
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: [
          ...renderCover(input),
          new Paragraph({ children: [new PageBreak()] }),

          new Paragraph({ heading: HeadingLevel.HEADING_1, text: "目录" }),
          new TableOfContents("Table of Contents", {
            hyperlink: true,
            headingStyleRange: "1-3",
          }),
          new Paragraph({ children: [new PageBreak()] }),

          new Paragraph({ heading: HeadingLevel.HEADING_1, text: "第一章 研究背景" }),
          ...mdToParagraphs(input.paragraphs.background),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            text: "第二章 数据来源与统计",
          }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "2.1 数据简报" }),
          ...mdToParagraphs(input.paragraphs.brief_rewrite),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "2.2 媒体层级分布" }),
          renderTierTable(input.aggregates),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "2.3 区县分布" }),
          renderDistrictTable(input.aggregates),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "2.4 主题分布" }),
          renderTopicTable(input.aggregates),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "2.5 时间趋势" }),
          renderTrendTable(input.aggregates),

          new Paragraph({ heading: HeadingLevel.HEADING_1, text: "第三章 研究发现" }),
          ...mdToParagraphs(input.paragraphs.conclusions),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            text: "附录：数据来源详细列表",
          }),
          renderAppendix(input.appendix),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// ── 封面 ────────────────────────────────────────────────────────────

function renderCover(input: WordBuildInput): Paragraph[] {
  const districtCount = input.aggregates.districtDistribution.length;
  const topicCount = input.aggregates.topicDistribution.length;
  const hitCount = input.aggregates.hitCount;

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: input.title,
          bold: true,
          font: "黑体",
          size: 44,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `—— 基于 ${formatDate(input.timeRangeStart)} 至 ${formatDate(
            input.timeRangeEnd,
          )} 数据`,
          italics: true,
          font: "楷体",
          size: 32,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      text: `研究主题：${input.topicDescription || input.title}`,
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      text: `时间范围：${formatDate(input.timeRangeStart)} 至 ${formatDate(
        input.timeRangeEnd,
      )}`,
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      text: `数据范围：${districtCount} 个区县 / ${topicCount} 个主题 / 命中 ${hitCount} 条报道`,
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      text: "数据来源：基于互联网公开报道采集",
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      text: `生成时间：${formatDate(input.completedAt)} / 系统：vibetide 新闻研究模块`,
    }),
  ];
}

// ── 表格 ────────────────────────────────────────────────────────────

function renderTierTable(agg: AggregatesJson): Table {
  return makeTable(
    ["层级", "报道数", "占比", "Top3 媒体"],
    agg.mediaTierDistribution.map((r) => [
      r.tier,
      String(r.count),
      `${r.percentage}%`,
      r.topMediaNames.join("、") || "—",
    ]),
  );
}

function renderDistrictTable(agg: AggregatesJson): Table {
  return makeTable(
    ["区县", "报道数", "占比", "Top3 主题"],
    agg.districtDistribution.map((r) => [
      r.districtName,
      String(r.count),
      `${r.percentage}%`,
      r.topTopics.join("、") || "—",
    ]),
  );
}

function renderTopicTable(agg: AggregatesJson): Table {
  return makeTable(
    ["主题", "报道数", "占比", "Top3 区县"],
    agg.topicDistribution.map((r) => [
      r.topicName,
      String(r.count),
      `${r.percentage}%`,
      r.topDistricts.join("、") || "—",
    ]),
  );
}

function renderTrendTable(agg: AggregatesJson): Table {
  return makeTable(
    ["日期", "报道数", "累计"],
    agg.dailyTrend.map((r) => [r.date, String(r.count), String(r.cumulative)]),
  );
}

function renderAppendix(rows: WordBuildInput["appendix"]): Table {
  return makeTable(
    ["序号", "标题", "媒体", "层级", "区县", "发布时间"],
    rows.map((r, i) => [
      String(i + 1),
      r.title,
      r.outletName ?? "—",
      r.outletTier ?? "未分类",
      r.districtName ?? "—",
      r.publishedAt ?? "—",
    ]),
  );
}

// ── 表格 helper ─────────────────────────────────────────────────────

function makeTable(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: h, bold: true, font: "黑体" })],
            }),
          ],
        }),
    ),
  });
  const dataRows = rows.map(
    (cells) =>
      new TableRow({
        children: cells.map(
          (c) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: c, font: "宋体" })],
                }),
              ],
            }),
        ),
      }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

// ── markdown → Paragraphs（轻量，仅切段 + 去 markdown markers） ──────

function mdToParagraphs(text: string): Paragraph[] {
  if (!text || !text.trim()) {
    return [new Paragraph({ text: "—" })];
  }
  // 按双换行切段，再去 markdown markers (**bold**, ###, *italic*)
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        new Paragraph({
          text: stripMarkdownMarkers(p),
          spacing: { line: 360 }, // 1.5 倍行距
        }),
    );
}

function stripMarkdownMarkers(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/`(.+?)`/g, "$1"); // inline code
}

// ── date helper ─────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
