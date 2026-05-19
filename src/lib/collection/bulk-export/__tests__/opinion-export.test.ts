import { describe, expect, it } from "vitest";
import { OPINION_EXCEL_COLUMNS } from "../../bulk-import/opinion-transform";
import { EXPORT_COLUMN_ORDER, exportRowToOpinionRecord, type ExportItemRow } from "../opinion-export";

function makeRow(overrides: Partial<ExportItemRow> = {}): ExportItemRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    organizationId: "00000000-0000-4000-8000-000000000002",
    contentFingerprint: "fp-export-test",
    canonicalUrl: "https://example.com/a",
    canonicalUrlHash: "hash",
    title: "测试标题",
    summary: "测试摘要",
    publishedAt: new Date("2026-05-19T08:00:00Z"),
    firstSeenSourceId: null,
    firstSeenChannel: "excel_import",
    firstSeenAt: new Date("2026-05-19T09:00:00Z"),
    sourceChannels: [],
    category: [],
    tags: [],
    language: null,
    derivedModules: [],
    rawMetadata: { queryWindow: "2026-05-01 - 2026-05-19", mcn: "测试机构" },
    enrichmentStatus: "pending",
    createdAt: new Date("2026-05-19T09:00:00Z"),
    updatedAt: new Date("2026-05-19T09:00:00Z"),
    contentType: "image_text",
    attachments: [],
    outletId: null,
    outletTier: null,
    outletRegion: null,
    externalId: null,
    platform: null,
    author: null,
    accountId: null,
    accountHandle: null,
    authorFollowerCount: null,
    sentiment: null,
    infoType: null,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    viewCount: 0,
    favoriteCount: 0,
    replyCount: 0,
    ipRegion: null,
    postRegion: null,
    mentionedRegions: [],
    matchedKeywords: [],
    matchedRegions: [],
    industries: [],
    coverImageUrl: null,
    durationSeconds: null,
    content: "完整内容",
    ocrText: null,
    asrText: null,
    ...overrides,
  };
}

describe("opinion Excel export", () => {
  it("导出列去掉查询时段,其余列保持模板顺序", () => {
    expect(EXPORT_COLUMN_ORDER).not.toContain("查询时段");
    expect(EXPORT_COLUMN_ORDER).toEqual(OPINION_EXCEL_COLUMNS.filter((column) => column !== "查询时段"));
  });

  it("导出 record 不包含查询时段字段", () => {
    const record = exportRowToOpinionRecord(makeRow(), 1);
    expect(record).not.toHaveProperty("查询时段");
    expect(record["序号"]).toBe(1);
  });

  it("导出 record 的单元格文本不超过 Excel 限制", () => {
    const record = exportRowToOpinionRecord(
      makeRow({
        content: "a".repeat(33000),
        ocrText: "b".repeat(33000),
      }),
      1,
    );

    expect(String(record["完整内容"])).toHaveLength(32767);
    expect(String(record["OCR文本"])).toHaveLength(32767);
  });
});
