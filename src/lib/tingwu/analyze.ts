import "server-only";
import type { TingwuTranscriptionJson, ParsedSegment, ParsedChapter } from "./types";

/**
 * 转写 JSON → asset_segments 分段（一段一 Paragraph，词级时间戳聚合成秒）。
 * 这是听悟结果里结构最确定的部分（spec §8）。
 */
export function parseTranscription(json: TingwuTranscriptionJson): ParsedSegment[] {
  const paragraphs = json?.Transcription?.Paragraphs ?? [];
  const segments: ParsedSegment[] = [];
  paragraphs.forEach((p, idx) => {
    const words = p.Words ?? [];
    const text = words.map((w) => w.Text ?? "").join("").trim();
    if (!text) return;
    const starts = words
      .map((w) => w.Start)
      .filter((n): n is number => typeof n === "number");
    const ends = words
      .map((w) => w.End)
      .filter((n): n is number => typeof n === "number");
    segments.push({
      transcript: text,
      startTimeSeconds: starts.length ? Math.min(...starts) / 1000 : undefined,
      endTimeSeconds: ends.length ? Math.max(...ends) / 1000 : undefined,
      segmentOrder: idx,
    });
  });
  return segments;
}

/**
 * 防御式提取关键词：递归找 *keyword* 字段下的字符串/对象数组。
 * 注：听悟未单列关键词开关，关键词随摘要/章节产出，精确字段联调时核实。
 */
export function parseKeywords(json: unknown): string[] {
  const out = new Set<string>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (/keyword/i.test(k) && Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === "string") out.add(item.trim());
          else if (
            item &&
            typeof item === "object" &&
            typeof (item as { Text?: string }).Text === "string"
          ) {
            out.add((item as { Text: string }).Text.trim());
          }
        }
      } else if (v && typeof v === "object") {
        visit(v);
      }
    }
  };
  visit(json);
  return [...out].filter(Boolean);
}

/**
 * 防御式提取章节：找含 Title/Headline 的 *chapter* 数组。结构联调时核实。
 */
export function parseAutoChapters(json: unknown): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (/chapter/i.test(k) && Array.isArray(v)) {
        for (const it of v) {
          if (!it || typeof it !== "object") continue;
          const o = it as Record<string, unknown>;
          const title = (o.Title ?? o.Headline ?? o.title ?? o.headline) as
            | string
            | undefined;
          if (typeof title !== "string" || !title.trim()) continue;
          const startMs = (o.Start ?? o.StartTime ?? o.start) as number | undefined;
          const summary = (o.Summary ?? o.summary) as string | undefined;
          chapters.push({
            title: title.trim(),
            startTimeSeconds: typeof startMs === "number" ? startMs / 1000 : undefined,
            summary: typeof summary === "string" ? summary : undefined,
          });
        }
      } else if (v && typeof v === "object") {
        visit(v);
      }
    }
  };
  visit(json);
  return chapters;
}
