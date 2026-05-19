import type { InferSelectModel } from "drizzle-orm";
import type { collectedItems } from "@/db/schema/collection";
import { OPINION_EXCEL_COLUMNS } from "../bulk-import/opinion-transform";

const EXCEL_CELL_TEXT_LIMIT = 32767;

/**
 * 导出行 = 主表行 + 副表 content/ocr/asr(LEFT JOIN 可能 null)
 */
export type ExportItemRow = InferSelectModel<typeof collectedItems> & {
  content: string | null;
  ocrText: string | null;
  asrText: string | null;
};

/**
 * 把一条 collected_items + contents 转为 Excel 导出 record。
 * 导出列基于 data.xlsx 模板,但不包含"查询时段"。
 *
 * 反向转换要点:
 * - "序号" 用导出顺序(由 caller 给 absoluteIndex)
 * - 多值数组 join("，"):industries/matchedKeywords/matchedRegions
 * - mentioned_regions 用分号 + 逗号下钻还原:["江苏省","上海市"] → "江苏省；上海市"
 * - 时间转 ISO 字符串(Excel 解析为字符串,后续再导入会被 transformer parse 回 Date)
 */
export function exportRowToOpinionRecord(
  row: ExportItemRow,
  seq: number,
): Record<string, unknown> {
  const meta = (row.rawMetadata as Record<string, unknown> | null) ?? {};
  const mcn = typeof meta.mcn === "string" ? meta.mcn : "";

  const record: Record<string, unknown> = {
    "序号": seq,
    "帖子ID": row.externalId ?? "",
    "标题": row.title,
    "内容摘要": row.summary ?? "",
    "完整内容": row.content ?? "",
    "作者昵称": row.author ?? "",
    "用户ID": row.accountId ?? "",
    "平台": row.platform ?? "",
    "情感倾向": row.sentiment ?? "",
    "信息类型": row.infoType ?? "",
    "发布时间": row.publishedAt ? formatDateTime(row.publishedAt) : "",
    "采集时间": row.firstSeenAt ? formatDateTime(row.firstSeenAt) : "",
    "点赞数": row.likeCount ?? 0,
    "评论数": row.commentCount ?? 0,
    "转发数": row.shareCount ?? 0,
    "阅读数": row.viewCount ?? 0,
    "收藏数": row.favoriteCount ?? 0,
    "回复数": row.replyCount ?? 0,
    "粉丝数": row.authorFollowerCount ?? 0,
    "IP属地": row.ipRegion ?? "",
    "发布地": row.postRegion ?? "",
    "提及地": (row.mentionedRegions ?? []).join("；"),
    "命中关键词": (row.matchedKeywords ?? []).join("，"),
    "命中地域": (row.matchedRegions ?? []).join("，"),
    "行业分类": (row.industries ?? []).join("，"),
    "链接": row.canonicalUrl ?? "",
    "封面图": row.coverImageUrl ?? "",
    "短ID": row.accountHandle ?? "",
    "MCN": mcn,
    "时长(秒)": row.durationSeconds ?? 0,
    "OCR文本": row.ocrText ?? "",
    "ASR文本": row.asrText ?? "",
  };

  return clampRecordText(record);
}

function clampRecordText(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === "string" && value.length > EXCEL_CELL_TEXT_LIMIT
        ? value.slice(0, EXCEL_CELL_TEXT_LIMIT)
        : value,
    ]),
  );
}

/** "2025-07-09 22:14:03" 风格(本地时区) — Excel 显示友好,且再导入时能 parse */
function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** 提供给 caller:Excel 列顺序(供 sheetjs json_to_sheet / header 配置) */
export const EXPORT_COLUMN_ORDER = OPINION_EXCEL_COLUMNS.filter((column) => column !== "查询时段");
