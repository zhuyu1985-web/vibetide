import { generateText } from "ai";
import { getLanguageModel, getDefaultModel } from "@/lib/agent/model-router";

/** 从生成正文里抽标题（首个标题行 / 首行兜底）。 */
export function deriveTitle(content: string, fallback: string): string {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const first = lines[0];
  if (first) {
    const cleaned = first.replace(/^#+\s*/, "").replace(/^(标题|题目)[:：]\s*/, "").trim();
    if (cleaned && cleaned.length <= 60) return cleaned;
  }
  return fallback.slice(0, 60);
}

/** 把"首行标题 + 其后正文"拆开（改稿/翻译产出的统一格式）。 */
export function splitTitleBody(
  text: string,
  fallbackTitle: string,
): { title: string; body: string } {
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => l.trim());
  if (idx === -1) return { title: fallbackTitle.slice(0, 80), body: text.trim() };
  const title = lines[idx]
    .trim()
    .replace(/^#+\s*/, "")
    .replace(/^(标题|题目|title)[:：]\s*/i, "")
    .trim();
  const body = lines.slice(idx + 1).join("\n").trim();
  if (!body) {
    // 没分出正文 → 整段当正文，标题用兜底
    return { title: fallbackTitle.slice(0, 80), body: lines.slice(idx).join("\n").trim() };
  }
  return { title: (title || fallbackTitle).slice(0, 80), body };
}

/** 改稿：基于完整当前稿 + 指令做增量编辑，铁律保留事实（防漂移）。 */
export async function reviseDraft(
  body: string,
  title: string,
  instruction: string,
  language: string,
): Promise<{ title: string; body: string } | null> {
  const langName = language === "en" ? "英文" : language === "zh" ? "中文" : language;
  const prompt =
    `你是资深新闻编辑。下面是当前${langName}稿件，请严格按用户的修改要求改写。\n` +
    `铁律：① 保留所有事实、数字、引用、人名地名时间不变，只按要求改动；` +
    `② 不要新增未提及的虚构信息；③ 全文保持${langName}。\n` +
    `输出改写后的完整稿件：第一行是标题，空一行后是正文。不要任何解释或代码围栏。\n\n` +
    `【当前标题】${title}\n【当前正文】\n${body}\n\n` +
    `【修改要求】${instruction || "(无具体要求，整体润色一遍)"}`;
  try {
    const { text } = await generateText({
      model: getLanguageModel({
        provider: "openai",
        model: getDefaultModel(),
        temperature: 0.5,
        maxTokens: 2400,
      }),
      prompt,
      maxOutputTokens: 2400,
    });
    const parsed = splitTitleBody(text, title);
    return parsed.body.trim() ? parsed : null;
  } catch (err) {
    console.error("[content-loop] reviseDraft 失败:", err);
    return null;
  }
}
