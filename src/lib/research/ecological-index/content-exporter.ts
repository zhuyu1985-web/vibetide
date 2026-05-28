// 生态文明传播指数报告 - 内容源 xlsx 按 tier 拆 4 文件导出
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §5.4 Step 6
//
// 复用项目内容池标准模板 (32 列, opinion-export.EXPORT_COLUMN_ORDER):
//   - 序号 / 帖子ID / 标题 / 内容摘要 / 完整内容 / 作者昵称 / 用户ID / 平台
//   - 情感倾向 / 信息类型 / 发布时间 / 采集时间
//   - 点赞数 / 评论数 / 转发数 / 阅读数 / 收藏数 / 回复数 / 粉丝数
//   - IP属地 / 发布地 / 提及地 / 命中关键词 / 命中地域 / 行业分类
//   - 链接 / 封面图 / 短ID / MCN / 时长(秒) / OCR文本 / ASR文本
//
// 按 tier 拆 4 文件 (中央/行业/市级/区县),公众类不导出 (它是活动数据非稿件)

import * as XLSX from "@e965/xlsx";
import {
  exportRowToOpinionRecord,
  EXPORT_COLUMN_ORDER,
  type ExportItemRow,
} from "@/lib/collection/bulk-export/opinion-export";
import type { MediaTier } from "./compute";

/**
 * 一个 tier 的 items 输出为 xlsx Buffer
 *
 * @param items - 已按 tier + organizationId + 时间窗口过滤的 ExportItemRow[](含正文/OCR/ASR)
 * @param tier - 一级 tier 标识(用于 sheet 名 + 文件命名)
 * @returns xlsx Buffer (zip 编码)
 */
export function buildContentXlsxForTier(
  items: ExportItemRow[],
  tier: MediaTier,
): Buffer {
  const records = items.map((row, idx) => exportRowToOpinionRecord(row, idx + 1));
  const sheet = XLSX.utils.json_to_sheet(records, {
    header: [...EXPORT_COLUMN_ORDER],
  });

  // 列宽自适应(按 scripts/export-scope-content-xlsx.ts 验证过的宽度)
  const widths = EXPORT_COLUMN_ORDER.map((col) => {
    if (col === "完整内容") return { wch: 50 };
    if (col === "OCR文本" || col === "ASR文本") return { wch: 40 };
    if (col === "内容摘要" || col === "标题") return { wch: 35 };
    if (col === "链接" || col === "封面图") return { wch: 25 };
    if (col === "命中关键词" || col === "命中地域" || col === "行业分类") return { wch: 20 };
    if (col === "发布时间" || col === "采集时间") return { wch: 18 };
    return { wch: 12 };
  });
  sheet["!cols"] = widths;

  const wb = XLSX.utils.book_new();
  const sheetName = sheetNameForTier(tier);
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const TIER_SHEET_NAME: Record<MediaTier, string> = {
  central: "中央媒体内容池",
  industry: "行业媒体内容池",
  municipal: "市级媒体内容池",
  district: "区县媒体内容池",
};

export function sheetNameForTier(tier: MediaTier): string {
  return TIER_SHEET_NAME[tier];
}

const TIER_FILENAME: Record<MediaTier, string> = {
  central: "content-central",
  industry: "content-industry",
  municipal: "content-municipal",
  district: "content-district",
};

/**
 * tier → 推荐的 Storage 路径前缀 (供 P3.8 上传时用)
 * 完整路径示例: {reportId}/content-central.xlsx
 */
export function storageNameForTier(tier: MediaTier): string {
  return TIER_FILENAME[tier];
}

/**
 * 4 个 tier 的完整批量产出 (供端到端测试用)
 * 注意: 生产环境应在 Inngest Step 6a-6d 各跑各的, 避免单步 OOM
 */
export type ContentExportResult = {
  central: Buffer;
  industry: Buffer;
  municipal: Buffer;
  district: Buffer;
};

export function buildAllContentXlsx(
  itemsByTier: Record<MediaTier, ExportItemRow[]>,
): ContentExportResult {
  return {
    central: buildContentXlsxForTier(itemsByTier.central, "central"),
    industry: buildContentXlsxForTier(itemsByTier.industry, "industry"),
    municipal: buildContentXlsxForTier(itemsByTier.municipal, "municipal"),
    district: buildContentXlsxForTier(itemsByTier.district, "district"),
  };
}
