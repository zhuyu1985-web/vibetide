import { generateText } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";
import { recognizeIntent } from "@/lib/agent/intent-recognition";
import { loadAvailableEmployees } from "@/lib/mission-core";
import type { IntentStep } from "@/lib/agent/types";
import type { ChannelSessionRow } from "@/lib/dal/channel-sessions";

export type ClarifyOrPlanResult =
  | { action: "clarify"; question: string }
  | { action: "execute"; summary: string; steps: IntentStep[] };

const CONFIDENCE_THRESHOLD = 0.6;

/**
 * 用累积上下文 + 最新消息判定：信息够→规划 steps 执行；不够→产一个澄清问题。
 *
 * 判定规则：
 * - intent.confidence >= 0.6 且 steps 非空 且 intentType != 'general_chat' → execute
 * - 否则调 LLM 产一句中文澄清问题 → clarify
 */
export async function clarifyOrPlan(
  orgId: string,
  session: ChannelSessionRow,
  message: string,
): Promise<ClarifyOrPlanResult> {
  // 拼接历史上下文
  const ctx = (session.contextTurns ?? [])
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n");
  const fullMessage = ctx ? `${ctx}\nuser: ${message}` : message;

  // 加载员工能力目录
  const employees = await loadAvailableEmployees(orgId);
  const catalog = employees.map((e) => ({
    slug: e.slug,
    name: e.name,
    nickname: e.nickname,
    title: e.title,
    skills: e.skills ?? [],
  }));

  // 用 recognizeIntent 做意图识别 + 规划
  const intent = await recognizeIntent(fullMessage, "xiaolei", catalog, [], []);

  if (
    intent.confidence >= CONFIDENCE_THRESHOLD &&
    intent.steps.length > 0 &&
    intent.intentType !== "general_chat"
  ) {
    return { action: "execute", summary: intent.summary, steps: intent.steps };
  }

  // 信息不足 → 调 LLM 产一句澄清问题
  const modelName = process.env.OPENAI_MODEL ?? "deepseek-chat";
  const { text } = await generateText({
    model: getLanguageModel({
      provider: "openai",
      model: modelName,
      temperature: 0.3,
      maxTokens: 256,
    }),
    prompt:
      `你是任务助手。用户在 IM 里的请求信息不足以执行。基于对话：\n${fullMessage}\n\n` +
      `用一句中文问一个最关键的澄清问题，帮你补齐执行所需信息。只输出问题本身。`,
    maxOutputTokens: 256,
  });

  return { action: "clarify", question: text.trim() || "能再具体说说你想做什么吗？" };
}
