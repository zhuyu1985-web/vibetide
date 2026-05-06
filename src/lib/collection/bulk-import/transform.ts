import { createHash } from "crypto";
import type { RawItem } from "../types";

export interface ImportMapping {
  title?: string | null;
  content?: string | null;
  summary?: string | null;
  canonicalUrl?: string | null;
  publishedAt?: string | null;
  outletName?: string | null;
  outletTier?: string | null;
  outletRegion?: string | null;
  contentType?: string | null;
}

export interface ImportDefaults {
  contentType: "image_text" | "video" | "short_video" | "image_set" | "audio" | "live";
  outletTier: string | null;
  outletRegion: string | null;
}

// 注意：RawItem 接口（src/lib/collection/types.ts）没有 contentFingerprint 字段（writer 内部算）。
// 但 preview 阶段需要 fingerprint 去 DB 查重复。所以 transform 返回 { rawItem, fingerprint } 双字段。
export interface TransformResult {
  rawItem: RawItem;
  fingerprint: string; // preview 用来批量查 collected_items.contentFingerprint 是否已存在
}

export function parseExcelPublishedAt(raw: unknown): Date | undefined {
  if (raw == null || raw === "") return undefined;
  if (raw instanceof Date) return raw;

  if (typeof raw === "number") {
    if (raw > 1e12) return new Date(raw);
    if (raw > 1e9) return new Date(raw * 1000);
    return undefined;
  }

  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s) return undefined;

  const cn = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (cn) return new Date(parseInt(cn[1]!), parseInt(cn[2]!) - 1, parseInt(cn[3]!));

  const direct = new Date(s);
  return isNaN(direct.getTime()) ? undefined : direct;
}

function getFieldValue(
  row: Record<string, unknown>,
  columnName: string | null | undefined,
): string | undefined {
  if (!columnName) return undefined;
  const value = row[columnName];
  if (value == null) return undefined;
  return String(value).trim() || undefined;
}

function generateFingerprint(
  title: string,
  publishedAt: Date | undefined,
  canonicalUrl: string | undefined,
): string {
  const dateBucket = publishedAt
    ? `${publishedAt.getFullYear()}-${publishedAt.getMonth() + 1}-${publishedAt.getDate()}`
    : "0";
  const normalized = title.toLowerCase().replace(/\s+/g, "");
  return createHash("md5")
    .update(`${normalized}|${dateBucket}|${canonicalUrl ?? ""}`)
    .digest("hex");
}

export function transformRowToRawItem(
  row: Record<string, unknown>,
  mapping: ImportMapping,
  defaults: ImportDefaults,
): TransformResult | null {
  const title = getFieldValue(row, mapping.title);
  if (!title) return null; // 必填校验

  const content = getFieldValue(row, mapping.content);
  const summary = getFieldValue(row, mapping.summary) ?? content?.slice(0, 200);
  const canonicalUrl = getFieldValue(row, mapping.canonicalUrl);
  const publishedAt = parseExcelPublishedAt(
    mapping.publishedAt ? row[mapping.publishedAt] : undefined,
  );
  const outletName = getFieldValue(row, mapping.outletName);
  const outletTier =
    getFieldValue(row, mapping.outletTier) ?? defaults.outletTier ?? undefined;
  const outletRegion =
    getFieldValue(row, mapping.outletRegion) ?? defaults.outletRegion ?? undefined;
  const contentType = getFieldValue(row, mapping.contentType) ?? defaults.contentType;

  const rawMetadata: Record<string, unknown> = {
    importedFromExcel: true,
    ...(outletName ? { publicAccountName: outletName, author: outletName } : {}),
    ...(outletTier ? { defaultOutletTier: outletTier } : {}),
    ...(outletRegion ? { defaultOutletRegion: outletRegion } : {}),
    originalRow: row,
  };

  const rawItem: RawItem = {
    title,
    url: canonicalUrl ?? undefined,
    content,
    summary,
    publishedAt,
    channel: "excel_import",
    contentType: contentType as ImportDefaults["contentType"],
    attachments: [],
    rawMetadata,
  };

  const fingerprint = generateFingerprint(title, publishedAt, canonicalUrl);

  return { rawItem, fingerprint };
}
