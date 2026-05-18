import type { RawItem } from "../types";

/**
 * 舆情数据 Excel 33 列固定列名(对照 docs/data.xlsx 模板)
 * 列名顺序就是模板的列序,client 端通过列名匹配自动识别"这是舆情格式"
 */
export const OPINION_EXCEL_COLUMNS = [
  "查询时段", "序号", "帖子ID", "标题", "内容摘要", "完整内容",
  "作者昵称", "用户ID", "平台", "情感倾向", "信息类型",
  "发布时间", "采集时间",
  "点赞数", "评论数", "转发数", "阅读数", "收藏数", "回复数",
  "粉丝数", "IP属地", "发布地", "提及地",
  "命中关键词", "命中地域", "行业分类",
  "链接", "封面图", "短ID", "MCN", "时长(秒)",
  "OCR文本", "ASR文本",
] as const;

/**
 * 判断是否舆情格式:看是否包含至少 N 个特征列。
 * 用宽松判定(>=8 个核心列)避免用户改了某些列名或漏几列时判错。
 */
export function isOpinionExcelFormat(columns: string[]): boolean {
  const set = new Set(columns);
  const core = [
    "标题", "完整内容", "作者昵称", "平台", "情感倾向",
    "发布时间", "采集时间", "点赞数", "评论数", "链接", "IP属地", "命中关键词",
  ];
  return core.filter((c) => set.has(c)).length >= 8;
}

// ──────────────────────────────────────────────────────────────────────────────
// 字段提取小工具
// ──────────────────────────────────────────────────────────────────────────────

function str(row: Record<string, unknown>, col: string): string | undefined {
  const v = row[col];
  if (v == null || v === "") return undefined;
  return String(v).trim() || undefined;
}

function num(row: Record<string, unknown>, col: string): number | undefined {
  const v = row[col];
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const n = parseInt(String(v).replace(/[,\s]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
}

function date(row: Record<string, unknown>, col: string): Date | undefined {
  const v = row[col];
  if (v == null || v === "") return undefined;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    if (v > 1e12) return new Date(v);
    if (v > 1e9) return new Date(v * 1000);
    // Excel serial date(自 1900-01-00 起的天数)
    if (v > 20000 && v < 80000) return new Date((v - 25569) * 86400 * 1000);
    return undefined;
  }
  const s = String(v).trim();
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

/** 切分多值字符串。常见分隔:中英文逗号、分号 */
function splitList(s: string | undefined, separators: RegExp): string[] {
  if (!s) return [];
  return s
    .split(separators)
    .map((x) => x.trim())
    .filter(Boolean);
}

const COMMA_SEP = /[,，]/;
const SEMI_SEP = /[;；]/;

/**
 * 提及地特殊处理:分号分多组,每组逗号下钻(取第一段即省级)。
 * "江苏省，扬州市，高邮市；上海市，青浦区" → ["江苏省", "上海市"]
 */
function parseMentionedRegions(s: string | undefined): string[] {
  const groups = splitList(s, SEMI_SEP);
  const provinces = new Set<string>();
  for (const g of groups) {
    const first = splitList(g, COMMA_SEP)[0];
    if (first) provinces.add(first);
  }
  return Array.from(provinces);
}

// ──────────────────────────────────────────────────────────────────────────────
// Main transformer
// ──────────────────────────────────────────────────────────────────────────────

export interface OpinionTransformResult {
  rawItem: RawItem;
}

/**
 * 把舆情 Excel 一行转 RawItem。返回 null 表示标题为空(过滤掉)。
 *
 * 设计点:
 * - 帖子ID → externalId(平台原生 ID,后续可对接更新)
 * - 平台名直接落库("微信"/"微博"/"今日头条")
 * - 行业分类按逗号切多值
 * - 互动指标全填(缺则 0)
 * - 完整内容长则进副表(writer 自动拆),内容摘要进主表 summary
 * - publishedAt 用"发布时间",firstSeenAt = writer 内部当前时间(导入时刻);
 *   想用 Excel"采集时间"做 firstSeenAt? 不行 — writer 不开放 firstSeenAt 参数,
 *   要改 schema 才行。当前用导入时刻 OK,排序仍按 publishedAt 也合理。
 */
export function transformOpinionRow(
  row: Record<string, unknown>,
): OpinionTransformResult | null {
  const title = str(row, "标题");
  if (!title) return null;

  const url = str(row, "链接");
  const externalId = str(row, "帖子ID");
  const summary = str(row, "内容摘要");
  const content = str(row, "完整内容");
  const platform = str(row, "平台");
  const author = str(row, "作者昵称");
  const accountId = str(row, "用户ID");
  const accountHandle = str(row, "短ID");
  const sentiment = str(row, "情感倾向");
  const infoType = str(row, "信息类型");
  const publishedAt = date(row, "发布时间");
  const ipRegion = str(row, "IP属地");
  const postRegion = str(row, "发布地");
  const mentionedRegions = parseMentionedRegions(str(row, "提及地"));
  const matchedKeywords = splitList(str(row, "命中关键词"), COMMA_SEP);
  const matchedRegions = splitList(str(row, "命中地域"), COMMA_SEP);
  const industries = splitList(str(row, "行业分类"), COMMA_SEP);
  const coverImageUrl = str(row, "封面图");
  const durationSeconds = num(row, "时长(秒)");
  const ocrText = str(row, "OCR文本");
  const asrText = str(row, "ASR文本");
  const mcn = str(row, "MCN");

  const likeCount = num(row, "点赞数") ?? 0;
  const commentCount = num(row, "评论数") ?? 0;
  const shareCount = num(row, "转发数") ?? 0;
  const viewCount = num(row, "阅读数") ?? 0;
  const favoriteCount = num(row, "收藏数") ?? 0;
  const replyCount = num(row, "回复数") ?? 0;
  const authorFollowerCount = num(row, "粉丝数");

  // channel 字段:用于 first_seen_channel + source_channels 数组项
  // 格式跟其它 adapter 对齐 — "opinion_excel/<platform>"
  const channel = platform ? `opinion_excel/${platform}` : "opinion_excel";

  // 媒体附加:封面图入 attachments,详细媒体识别交给后续 enrichment
  const attachments = coverImageUrl
    ? [{ kind: "thumbnail" as const, url: coverImageUrl }]
    : [];

  // 视频判断:有时长 > 0 且有 ASR → short_video;否则按封面有无定 image_text
  const contentType: RawItem["contentType"] = durationSeconds && durationSeconds > 0
    ? "short_video"
    : "image_text";

  // rawMetadata 兜底存稀疏字段(MCN 等)+ 原始行(用户可在详情看到 raw)
  const rawMetadata: Record<string, unknown> = {
    importedFromOpinionExcel: true,
    ...(mcn ? { mcn } : {}),
    queryWindow: str(row, "查询时段"),
    excelSeq: num(row, "序号"),
    capturedTimeExcel: str(row, "采集时间"),
  };

  const rawItem: RawItem = {
    title,
    url,
    content,
    summary,
    publishedAt,
    channel,
    contentType,
    attachments,
    rawMetadata,

    // 舆情专属字段(writer 已支持)
    externalId,
    platform,
    author,
    accountId,
    accountHandle,
    authorFollowerCount,
    sentiment,
    infoType,
    likeCount,
    commentCount,
    shareCount,
    viewCount,
    favoriteCount,
    replyCount,
    ipRegion,
    postRegion,
    mentionedRegions: mentionedRegions.length > 0 ? mentionedRegions : undefined,
    matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : undefined,
    matchedRegions: matchedRegions.length > 0 ? matchedRegions : undefined,
    industries: industries.length > 0 ? industries : undefined,
    coverImageUrl,
    durationSeconds,
    ocrText,
    asrText,
  };

  return { rawItem };
}
