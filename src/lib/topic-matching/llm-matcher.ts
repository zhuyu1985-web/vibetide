import { generateObject } from "ai";
import { z } from "zod";
import { resolveModelConfig, getLanguageModel } from "@/lib/agent/model-router";
import type { CandidatePost } from "./keyword-recall";

/**
 * LLM 判定：从候选列表中挑出与 myPost 真同题的帖子。
 *
 * 不同媒体对同一事件可能改标题，所以不能只靠关键词。必须用 LLM 语义判断。
 */

const matchSchema = z.object({
  matched: z
    .array(
      z.object({
        candidateId: z.string().describe("候选帖子 ID"),
        similarityScore: z
          .number()
          .min(0)
          .max(1)
          .describe("语义相似度 0-1，1 表示同一事件"),
        reason: z.string().describe("判定理由（10-30 字）"),
      })
    )
    .describe("判定为同题的候选"),
  overallTopic: z.string().describe("我方帖子与匹配候选共同的主题概括"),
});

export interface MatchResult {
  matched: Array<{
    candidateId: string;
    similarityScore: number;
    reason: string;
  }>;
  overallTopic: string;
}

export async function matchSameTopicViaLLM(params: {
  myPostTitle: string;
  myPostBody: string;
  candidates: CandidatePost[];
  minScore?: number;
}): Promise<MatchResult> {
  const { myPostTitle, myPostBody, candidates, minScore = 0.65 } = params;

  if (candidates.length === 0) {
    return { matched: [], overallTopic: "" };
  }

  const candidatesBrief = candidates
    .map(
      (c, i) =>
        `[${i}] id=${c.id}\n  标题：${c.title}\n  来源：${c.accountName}（${c.accountLevel}）\n  摘要：${(c.summary ?? c.body ?? "").slice(0, 150)}`
    )
    .join("\n\n");

  const config = resolveModelConfig(["content_analysis"], {
    temperature: 0.2,
    maxTokens: 2000,
  });
  const model = getLanguageModel(config);

  const { object } = await generateObject({
    model,
    schema: matchSchema,
    maxOutputTokens: 2000,
    messages: [
      {
        role: "system",
        content: `你是一位资深媒体编辑。任务：判断下列候选外部报道中，哪些与我方稿件是"同一新闻事件/同一主题的报道"（标题可能不一致，但事实对象、事件核心相同即视为同题）。

判定规则：
1. 核心事件/事实对象一致 → 同题（分数 0.8-1.0）
2. 事件相关但角度不同（例如我方报主事件，对方报衍生评论）→ 弱相关（分数 0.5-0.7）
3. 话题类似但事件不同 → 不同题（跳过，不输出）
4. 只保留 similarityScore ≥ ${minScore} 的候选，最多 15 条
5. overallTopic 用 10-20 字概括共同主题`,
      },
      {
        role: "user",
        content: `我方稿件：
标题：${myPostTitle}
正文（前 500 字）：${myPostBody.slice(0, 500)}

候选外部报道（共 ${candidates.length} 条）：
${candidatesBrief}

请判定哪些候选与我方稿件是同题报道。`,
      },
    ],
  });

  const filtered = object.matched
    .filter((m) => m.similarityScore >= minScore)
    .filter((m) => candidates.some((c) => c.id === m.candidateId));

  return {
    matched: filtered,
    overallTopic: object.overallTopic,
  };
}
