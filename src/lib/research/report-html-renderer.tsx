// src/lib/research/report-html-renderer.tsx
//
// A5 Phase 4 — HTML 报告渲染器
//
// Pure function（无 React state、无 DB、无 LLM）：返回完整 HTML string。
// 详情页 client component (Phase 5) 解析 `<div data-chart=... data-source=...>`
// 占位符并 hydrate 为 Recharts 图表。
//
// Spec: docs/superpowers/specs/2026-05-07-a5-report-export-design.md §5.2 + plan Phase 4 Task 4.1
//
// 时区：所有日期格式化用 Asia/Shanghai (+08:00)。
// 用户控制字段（title / topicDescription / outletName / districtName 等）一律 escape。

import type { AggregatesJson } from "@/db/schema/research/reports";
import type { ReportParagraphs } from "./report-prompts";

export interface AppendixRow {
  id: string;
  title: string;
  outletName: string | null;
  outletTier: string | null;
  districtName: string | null;
  publishedAt: string | null; // YYYY-MM-DD or null
  url: string | null;
}

export interface HtmlRenderInput {
  title: string;
  topicDescription?: string;
  /** ISO 时间窗起 */
  timeRangeStart: string;
  /** ISO 时间窗止 */
  timeRangeEnd: string;
  /** 报告生成时刻 ISO */
  completedAt: string;
  paragraphs: ReportParagraphs;
  aggregates: AggregatesJson;
  appendix: AppendixRow[];
  /** Step 3 LLM 失败降级 → true 时顶部插红黄 banner */
  isAiFallback: boolean;
  /** 数据漂移：原报告 N 条命中，重生时 alive 条仍存在；不一致时插 info banner */
  drift?: { original: number; alive: number };
}

/**
 * 渲染整份报告 HTML（pure function）。
 *
 * 章节结构（spec §5.2）:
 *   1. 封面 (title + 副标题 + 5 行 metadata)
 *   2. 第一章 研究背景 (paragraphs.background, markdown)
 *   3. 第二章 数据来源与统计
 *      2.1 数据简报 (paragraphs.brief_rewrite)
 *      2.2 媒体层级分布 (table + bar chart placeholder)
 *      2.3 区县分布 (table + horizontal-bar chart placeholder)
 *      2.4 主题分布 (table + donut chart placeholder)
 *      2.5 时间趋势 (table + line chart placeholder)
 *   4. 第三章 研究发现 (paragraphs.conclusions, markdown)
 *   5. 附录：数据来源详细列表 (table)
 *
 * 章节锚点用下划线分隔（chapter2_1）— spec §5.2 patch："不用连字符避免与可能的模型 slug 工具误判"
 */
export function renderReportHtml(input: HtmlRenderInput): string {
  const banners = renderBanners(input);
  const cover = renderCover(input);
  const chapter1 = renderChapterMarkdown(
    "第一章 研究背景",
    "chapter1",
    input.paragraphs.background,
  );
  const chapter2 = renderChapter2(input);
  const chapter3 = renderChapterMarkdown(
    "第三章 研究发现",
    "chapter3",
    input.paragraphs.conclusions,
  );
  const appendix = renderAppendix(input.appendix);

  return `<article class="research-report">${banners}${cover}${chapter1}${chapter2}${chapter3}${appendix}</article>`;
}

// ── 顶部 banner ────────────────────────────────────────────────────

function renderBanners(input: HtmlRenderInput): string {
  const parts: string[] = [];
  if (input.isAiFallback) {
    parts.push(
      `<div class="banner banner-warn" data-banner="ai-fallback">AI 段落降级，已使用模板兜底，可重新生成以重试 AI 撰写。</div>`,
    );
  }
  if (input.drift && input.drift.original !== input.drift.alive) {
    const missing = input.drift.original - input.drift.alive;
    parts.push(
      `<div class="banner banner-info" data-banner="drift">原报告 ${input.drift.original} 条数据，重生时检测到 ${input.drift.alive} 条仍存在（${missing} 条已删除）。</div>`,
    );
  }
  return parts.join("");
}

// ── 封面 ──────────────────────────────────────────────────────────

function renderCover(input: HtmlRenderInput): string {
  const start = formatDate(input.timeRangeStart);
  const end = formatDate(input.timeRangeEnd);
  const completed = formatDate(input.completedAt);
  return `<section class="report-cover">
    <h1>${escapeHtml(input.title)}</h1>
    <p class="subtitle">基于 ${start} 至 ${end} 数据</p>
    <ul class="cover-meta">
      <li>研究主题：${escapeHtml(input.topicDescription || input.title)}</li>
      <li>时间范围：${start} 至 ${end}</li>
      <li>数据范围：${input.aggregates.districtDistribution.length} 个区县 / ${input.aggregates.topicDistribution.length} 个主题 / 命中 ${input.aggregates.hitCount} 条报道</li>
      <li>数据来源：基于互联网公开报道采集</li>
      <li>生成时间：${completed}</li>
    </ul>
  </section>`;
}

// ── 章节 markdown 渲染 ────────────────────────────────────────────

/**
 * 渲染纯文本/markdown 段落章节。
 * 简单按双换行切段 → `<p>`；段内 `**bold**` → `<strong>`。
 * 所有用户/LLM 内容 escape 后再 wrap。
 */
function renderChapterMarkdown(
  title: string,
  anchor: string,
  body: string,
): string {
  const safeBody = body ?? "";
  const paragraphs = safeBody
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p>${renderInlineMarkdown(p)}</p>`)
    .join("");
  return `<section id="${anchor}"><h2>${escapeHtml(title)}</h2>${paragraphs}</section>`;
}

/** 段内 inline 渲染：先 escape，再把 `**bold**` 替换为 `<strong>` */
function renderInlineMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  // `**bold**` (escape 后 ** 仍存在；非贪婪匹配)
  return escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

// ── 第二章：5 个小节（含数据表 + 图表占位） ────────────────────────

function renderChapter2(input: HtmlRenderInput): string {
  return `<section id="chapter2"><h2>第二章 数据来源与统计</h2>
    <section id="chapter2_1"><h3>2.1 数据简报</h3><p>${renderInlineMarkdown(input.paragraphs.brief_rewrite ?? "")}</p></section>
    <section id="chapter2_2"><h3>2.2 媒体层级分布</h3>
      ${renderTierTable(input.aggregates)}
      ${renderChartPlaceholder("bar", "media_tier", input.aggregates.mediaTierDistribution.map((r) => ({ name: r.tier, value: r.count })))}
    </section>
    <section id="chapter2_3"><h3>2.3 区县分布</h3>
      ${renderDistrictTable(input.aggregates)}
      ${renderChartPlaceholder("hbar", "district", input.aggregates.districtDistribution.map((r) => ({ name: r.districtName, value: r.count })))}
    </section>
    <section id="chapter2_4"><h3>2.4 主题分布</h3>
      ${renderTopicTable(input.aggregates)}
      ${renderChartPlaceholder("donut", "topic", input.aggregates.topicDistribution.map((r) => ({ name: r.topicName, value: r.count })))}
    </section>
    <section id="chapter2_5"><h3>2.5 时间趋势</h3>
      ${renderTrendTable(input.aggregates)}
      ${renderChartPlaceholder("line", "trend", input.aggregates.dailyTrend.map((r) => ({ date: r.date, count: r.count, cumulative: r.cumulative })))}
    </section>
  </section>`;
}

function renderTierTable(agg: AggregatesJson): string {
  if (agg.mediaTierDistribution.length === 0) {
    return `<p class="empty-hint">无媒体层级数据</p>`;
  }
  const rows = agg.mediaTierDistribution
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.tier)}</td><td>${r.count}</td><td>${r.percentage}%</td><td>${r.topMediaNames.map(escapeHtml).join("、") || "—"}</td></tr>`,
    )
    .join("");
  return `<table class="data-table"><thead><tr><th>层级</th><th>报道数</th><th>占比</th><th>Top3 媒体</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderDistrictTable(agg: AggregatesJson): string {
  if (agg.districtDistribution.length === 0) {
    return `<p class="empty-hint">无区县分布数据</p>`;
  }
  const rows = agg.districtDistribution
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.districtName)}</td><td>${r.count}</td><td>${r.percentage}%</td><td>${r.topTopics.map(escapeHtml).join("、") || "—"}</td></tr>`,
    )
    .join("");
  return `<table class="data-table"><thead><tr><th>区县</th><th>报道数</th><th>占比</th><th>Top3 主题</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTopicTable(agg: AggregatesJson): string {
  if (agg.topicDistribution.length === 0) {
    return `<p class="empty-hint">无主题分布数据</p>`;
  }
  const rows = agg.topicDistribution
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.topicName)}</td><td>${r.count}</td><td>${r.percentage}%</td><td>${r.topDistricts.map(escapeHtml).join("、") || "—"}</td></tr>`,
    )
    .join("");
  return `<table class="data-table"><thead><tr><th>主题</th><th>报道数</th><th>占比</th><th>Top3 区县</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTrendTable(agg: AggregatesJson): string {
  if (agg.dailyTrend.length === 0) {
    return `<p class="empty-hint">无时间趋势数据</p>`;
  }
  const rows = agg.dailyTrend
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.date)}</td><td>${r.count}</td><td>${r.cumulative}</td></tr>`,
    )
    .join("");
  return `<table class="data-table"><thead><tr><th>日期</th><th>报道数</th><th>累计</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ── 附录：数据来源列表 ─────────────────────────────────────────────

function renderAppendix(rows: AppendixRow[]): string {
  if (rows.length === 0) {
    return `<section id="appendix"><h2>附录：数据来源详细列表</h2><p class="empty-hint">无数据</p></section>`;
  }
  const tr = rows
    .map((r, i) => {
      const titleCell = r.url
        ? `<a href="${escapeAttr(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title)}</a>`
        : escapeHtml(r.title);
      return `<tr><td>${i + 1}</td><td>${titleCell}</td><td>${escapeHtml(r.outletName ?? "—")}</td><td>${escapeHtml(r.outletTier ?? "未分类")}</td><td>${escapeHtml(r.districtName ?? "—")}</td><td>${escapeHtml(r.publishedAt ?? "—")}</td></tr>`;
    })
    .join("");
  return `<section id="appendix"><h2>附录：数据来源详细列表</h2>
    <table class="data-table data-table-appendix"><thead><tr><th>序号</th><th>标题</th><th>媒体</th><th>层级</th><th>区县</th><th>发布时间</th></tr></thead><tbody>${tr}</tbody></table>
  </section>`;
}

// ── Chart placeholder ─────────────────────────────────────────────

/**
 * 输出 `<div data-chart="..." data-source="..." data-payload="...">` 占位符。
 * Phase 5 client 用 querySelectorAll 找占位符，解析 data-payload (JSON) 后用 Recharts 替换。
 *
 * data-payload 已 JSON.stringify + escape，直接放进 attribute 安全。
 */
function renderChartPlaceholder(
  type: "bar" | "hbar" | "donut" | "line",
  source: string,
  payload: unknown,
): string {
  const json = JSON.stringify(payload);
  return `<div class="chart-placeholder" data-chart="${type}" data-source="${escapeAttr(source)}" data-payload="${escapeAttr(json)}"></div>`;
}

// ── escape & date helpers ─────────────────────────────────────────

/** HTML 文本 escape：< > & " ' */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Attribute 值 escape — 同 escapeHtml（稳妥） */
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

/**
 * ISO timestamp / yyyy-mm-dd → yyyy-MM-dd（Asia/Shanghai = UTC+8）
 *
 * 不依赖 date-fns-tz：手动加 8 小时偏移再走 UTC getter。
 * 无效输入或纯日期字符串原样返回（escape 仍走外层）。
 */
export function formatDate(iso: string): string {
  if (!iso) return "";
  // 已经是 yyyy-mm-dd 格式 → 原样返回
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // shift to Asia/Shanghai by adding +8h, then read UTC fields
  const shifted = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
