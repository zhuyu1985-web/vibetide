// src/lib/dal/research/__tests__/ecological-index-reports.test.ts
//
// 类型签名测试 — 编译期校验导出类型形状是否与 spec §4.2 一致。
// (P3.10 端到端 fixture 测试覆盖真正的 SQL/IO 行为)

import { describe, it, expect } from "vitest";
import type {
  EcologicalIndexReportSummary,
  EcologicalIndexReportDetail,
  ScopeCoveragePreview,
} from "../ecological-index-reports";

describe("ecological-index-reports DAL types", () => {
  it("EcologicalIndexReportSummary 类型签名", () => {
    const sample: EcologicalIndexReportSummary = {
      id: "x",
      title: "y",
      status: "ready",
      currentStep: null,
      errorMessage: null,
      scopeId: "s1",
      activityDatasetId: "d1",
      year: 2025,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      generatedByName: "Zhuyu",
    };
    expect(sample.status).toBe("ready");
    expect(sample.year).toBe(2025);
  });

  it("EcologicalIndexReportDetail 含 3 个文件 URL + searchSnapshot + aggregatesJson", () => {
    const sample: EcologicalIndexReportDetail = {
      id: "x",
      title: "y",
      status: "ready",
      currentStep: null,
      errorMessage: null,
      scopeId: "s1",
      activityDatasetId: "d1",
      year: 2025,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      generatedByName: null,
      searchSnapshot: {
        kind: "ecological_index",
        scopeId: "s1",
        activityDatasetId: "d1",
        year: 2025,
        windowStart: "2025-01-01",
        windowEnd: "2026-01-01",
        includeContentSource: true,
        capturedAt: "2025-05-26T00:00:00Z",
      },
      aggregatesJson: null,
      wordFileUrl: null,
      excelFileUrl: null,
      contentSourceFileUrls: {
        central: null,
        industry: null,
        municipal: null,
        district: null,
      },
    };
    expect(sample.searchSnapshot.kind).toBe("ecological_index");
    expect(sample.contentSourceFileUrls?.central).toBeNull();
  });

  it("ScopeCoveragePreview 类型签名", () => {
    const sample: ScopeCoveragePreview = {
      matchedOutletCount: 97,
      itemsInScope: 57867,
      itemsTotal: 58387,
      retentionPct: 99.1,
      byTier: {
        central: 37697,
        industry: 1149,
        municipal: 14077,
        district: 4944,
      },
    };
    expect(sample.retentionPct).toBe(99.1);
    expect(sample.byTier.central).toBe(37697);
  });
});
