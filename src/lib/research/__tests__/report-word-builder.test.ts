// A5 Phase 6 — report-word-builder 单测
//
// 3 case：
//  1. buffer 非空（>1000 bytes 合理 docx 起步 size）
//  2. .docx 是 ZIP，magic bytes "PK" (0x50 0x4B) 头
//  3. 解压后 word/document.xml 含关键章节标题文本
//
// .docx 是 ZIP 压缩的，所以章节文字（第一章/第二章/...）在原始 buffer 里被压缩看不到。
// 用 zlib.inflateRawSync 解压 ZIP entry 拿到 word/document.xml 原文做断言。
//
// Spec ref: §5.1 Word 体例
// Plan ref: Phase 6 Task 6.2.2

import { inflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import type { AggregatesJson } from "@/db/schema/research/reports";
import { buildReportDocx, type WordBuildInput } from "../report-word-builder";

/**
 * 极简 ZIP 解析：扫描 local file headers，找到指定 entry name，按存储/deflate 解压返回 utf8 字符串。
 * 仅用于测试，不要 production 用——production 应使用专门 ZIP 库。
 */
function readDocxEntry(buf: Buffer, entryName: string): string | null {
  const target = Buffer.from(entryName, "utf8");
  let i = 0;
  while (i < buf.length - 4) {
    // ZIP local file header signature: 0x04034b50
    if (
      buf[i] === 0x50 &&
      buf[i + 1] === 0x4b &&
      buf[i + 2] === 0x03 &&
      buf[i + 3] === 0x04
    ) {
      const compressionMethod = buf.readUInt16LE(i + 8);
      const compressedSize = buf.readUInt32LE(i + 18);
      const uncompressedSize = buf.readUInt32LE(i + 22);
      const fileNameLen = buf.readUInt16LE(i + 26);
      const extraFieldLen = buf.readUInt16LE(i + 28);
      const nameStart = i + 30;
      const name = buf.subarray(nameStart, nameStart + fileNameLen);
      const dataStart = nameStart + fileNameLen + extraFieldLen;
      if (name.equals(target)) {
        const data = buf.subarray(dataStart, dataStart + compressedSize);
        if (compressionMethod === 0) {
          return data.toString("utf8");
        }
        if (compressionMethod === 8) {
          // raw DEFLATE (no zlib wrapper)
          const inflated = inflateRawSync(data);
          return inflated.toString("utf8");
        }
        return null;
      }
      i = dataStart + compressedSize;
      // 数据描述符（GP bit 3）兜底：如果 compressedSize=0，扫到下一个 PK 头
      if (compressedSize === 0 && uncompressedSize === 0) {
        i++;
      }
    } else {
      i++;
    }
  }
  return null;
}

const baseAggregates: AggregatesJson = {
  hitCount: 3,
  mediaTierDistribution: [
    { tier: "央级", count: 2, percentage: 66.7, topMediaNames: ["人民网"] },
    { tier: "省级", count: 1, percentage: 33.3, topMediaNames: ["重庆日报"] },
  ],
  districtDistribution: [
    {
      districtId: "d1",
      districtName: "渝中区",
      count: 1,
      percentage: 33.3,
      topTopics: ["营商环境"],
    },
  ],
  topicDistribution: [
    {
      topicId: "t1",
      topicName: "营商环境",
      count: 2,
      percentage: 66.7,
      topDistricts: ["渝中区"],
      topMedia: ["人民网"],
    },
  ],
  dailyTrend: [
    { date: "2026-04-01", count: 1, cumulative: 1 },
    { date: "2026-04-15", count: 2, cumulative: 3 },
  ],
  isAiFallback: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
};

const baseInput: WordBuildInput = {
  title: "重庆营商环境研究报告",
  topicDescription: "重庆 38 区县营商环境媒体声量分析",
  timeRangeStart: "2026-04-01",
  timeRangeEnd: "2026-04-30",
  completedAt: "2026-05-07T10:00:00.000Z",
  paragraphs: {
    background: "x".repeat(300),
    brief_rewrite: "y".repeat(200),
    conclusions: "z".repeat(800),
  },
  aggregates: baseAggregates,
  appendix: [
    {
      title: "重庆营商环境再升级",
      outletName: "人民网",
      outletTier: "央级",
      districtName: "渝中区",
      publishedAt: "2026-04-01",
    },
    {
      title: "江北区招商引资创新高",
      outletName: "重庆日报",
      outletTier: "省级",
      districtName: "江北区",
      publishedAt: "2026-04-15",
    },
  ],
};

describe("buildReportDocx", () => {
  it("returns non-empty Buffer (合理 docx size > 1000 bytes)", async () => {
    const buf = await buildReportDocx(baseInput);
    // docx@9.6.1 Packer.toBuffer 返 Buffer（Buffer 是 Uint8Array 子类）
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("docx ZIP magic bytes 'PK' 在 buffer 头", async () => {
    const buf = await buildReportDocx(baseInput);
    // .docx 是 ZIP container, ZIP magic = 0x50 0x4B (P K)
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it("章节标题文本（第一章/第二章/第三章/附录）解压后出现在 word/document.xml", async () => {
    const buf = await buildReportDocx(baseInput);
    const xml = readDocxEntry(Buffer.from(buf), "word/document.xml");
    expect(xml).not.toBeNull();
    expect(xml).toContain("第一章");
    expect(xml).toContain("第二章");
    expect(xml).toContain("第三章");
    expect(xml).toContain("附录");
  });
});
