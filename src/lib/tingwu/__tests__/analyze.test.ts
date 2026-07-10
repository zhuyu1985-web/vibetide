import { describe, it, expect } from "vitest";
import { parseTranscription, parseKeywords, parseAutoChapters } from "../analyze";
import type { TingwuTranscriptionJson } from "../types";

describe("parseTranscription", () => {
  it("Paragraphs[].Words → 分段(文本 + 秒级时间戳)", () => {
    const json: TingwuTranscriptionJson = {
      Transcription: {
        Paragraphs: [
          {
            Words: [
              { Text: "你好", Start: 1200, End: 1560, SentenceId: 1 },
              { Text: "世界", Start: 1560, End: 2000, SentenceId: 1 },
            ],
          },
          {
            Words: [{ Text: "第二段", Start: 3000, End: 3500, SentenceId: 2 }],
          },
        ],
      },
    };
    const segs = parseTranscription(json);
    expect(segs).toHaveLength(2);
    expect(segs[0].transcript).toBe("你好世界");
    expect(segs[0].startTimeSeconds).toBeCloseTo(1.2);
    expect(segs[0].endTimeSeconds).toBeCloseTo(2.0);
    expect(segs[0].segmentOrder).toBe(0);
    expect(segs[1].transcript).toBe("第二段");
  });

  it("空/缺字段 → 安全返回空数组", () => {
    expect(parseTranscription({})).toEqual([]);
    expect(parseTranscription({ Transcription: { Paragraphs: [{ Words: [] }] } })).toEqual([]);
  });
});

describe("parseKeywords", () => {
  it("提取字符串数组关键词", () => {
    expect(parseKeywords({ Summarization: { Keywords: ["人工智能", "媒体"] } })).toEqual([
      "人工智能",
      "媒体",
    ]);
  });

  it("提取对象数组里的 Text 关键词", () => {
    const r = parseKeywords({ AutoChapters: { Chapters: [{ Keywords: [{ Text: "选题" }] }] } });
    expect(r).toContain("选题");
  });

  it("无关键词 → []", () => {
    expect(parseKeywords({ foo: "bar" })).toEqual([]);
  });
});

describe("parseAutoChapters", () => {
  it("Chapters[] → 归一 title/startTimeSeconds/summary", () => {
    const r = parseAutoChapters({
      AutoChapters: {
        Chapters: [{ Title: "第一章", Start: 5000, Summary: "本章摘要" }],
      },
    });
    expect(r).toHaveLength(1);
    expect(r[0].title).toBe("第一章");
    expect(r[0].startTimeSeconds).toBeCloseTo(5);
    expect(r[0].summary).toBe("本章摘要");
  });

  it("无章节 → []", () => {
    expect(parseAutoChapters({ x: 1 })).toEqual([]);
  });
});
