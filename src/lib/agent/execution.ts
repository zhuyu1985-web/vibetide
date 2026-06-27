import { generateText, stepCountIs } from "ai";
import { getLanguageModel, applySkillOverride } from "./model-router";
import { toVercelTools, createKnowledgeBaseTools, type ToolContext } from "./tool-registry";
import { createMcpToolset } from "@/lib/mcp/toolset";
import { isMcpEnabled } from "@/lib/mcp/feature-flags";
import {
  buildStepInstruction,
  formatPreviousStepContext,
  buildPreviousStepDetailContext,
} from "./prompt-templates";
import { parseStepOutput } from "./step-io";
import type { ToolSet } from "ai";
import type {
  AssembledAgent,
  AgentExecutionInput,
  AgentExecutionResult,
  ProgressCallback,
} from "./types";

const AGENT_TIMEOUT_MS = 3 * 60 * 1000; // 3 分钟（整个 agent 多步执行上限）

type ArticleDraft = {
  title: string;
  body: string;
  summary: string;
  language: "zh";
};

function stripMarkdownTitle(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*]\s*/, "")
    .replace(/^标题[：:]\s*/, "")
    .trim();
}

function stripCodeFence(value: string): string {
  return value
    .trim()
    .replace(/^```[a-zA-Z0-9_-]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractResultSection(rawText: string): string {
  const match = rawText.match(/【产出结果】([\s\S]*?)(?:\n\s*【质量自评[：:]|\n\s*【质量评估】|$)/);
  const section = (match?.[1] ?? rawText).trim();
  return stripCodeFence(section).replace(/^json\s*(?=\{)/i, "").trim();
}

function tryParseJsonObject(value: string): Record<string, unknown> | null {
  const normalized = stripCodeFence(value)
    .replace(/^json\s*(?=\{)/i, "")
    .replace(/^json\s*\n(?=\{)/i, "")
    .trim();
  const candidates = [normalized];
  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(normalized.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToReadableMarkdown(html: string): string {
  return decodeBasicHtmlEntities(html)
    .replace(/<h1[^>]*>/gi, "\n# ")
    .replace(/<h2[^>]*>/gi, "\n## ")
    .replace(/<h3[^>]*>/gi, "\n### ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "\n\n")
    .replace(/<\/p>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getStringField(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function buildBodyFromSections(sections: unknown): string {
  if (!Array.isArray(sections)) return "";
  return sections
    .map((section) => {
      if (!section || typeof section !== "object") return "";
      const obj = section as Record<string, unknown>;
      const heading = getStringField(obj, ["heading", "title"]);
      const body = getStringField(obj, ["body", "content", "text"]);
      return [heading ? `## ${heading}` : "", body].filter(Boolean).join("\n\n");
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function buildArticleDraftFromJsonPayload(
  payload: Record<string, unknown>,
  fallbackTitle: string,
): ArticleDraft | null {
  const title = getStringField(payload, ["title", "headline", "name"]) || fallbackTitle;
  const summary = getStringField(payload, ["summary", "leadParagraph", "subtitle"]);
  const body =
    getStringField(payload, ["bodyMarkdown", "body", "content", "markdown"]) ||
    buildBodyFromSections(payload.sections) ||
    htmlToReadableMarkdown(getStringField(payload, ["bodyHtml", "html"]));

  if (body.replace(/\s/g, "").length < 10) return null;

  return {
    title: stripMarkdownTitle(title).slice(0, 200) || fallbackTitle,
    body,
    summary: (summary || body.replace(/[*_`>#-]/g, "").replace(/\s+/g, " ").trim()).slice(0, 180),
    language: "zh",
  };
}

function buildArticleDraftFromGeneratedText(
  rawText: string,
  fallbackTitle: string,
): ArticleDraft | null {
  const body = extractResultSection(rawText);
  if (body.replace(/\s/g, "").length < 10) return null;

  const jsonPayload = tryParseJsonObject(body);
  if (jsonPayload) {
    const article = buildArticleDraftFromJsonPayload(jsonPayload, fallbackTitle);
    if (article) return article;
  }

  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const heading =
    lines.find((line) => /^#{1,6}\s+\S/.test(line)) ??
    lines.find((line) => /^标题[：:]\s*\S/.test(line)) ??
    lines.find((line) => !line.startsWith("【") && !line.startsWith("```"));
  const title = stripMarkdownTitle(heading ?? fallbackTitle).slice(0, 200);
  const plain = body
    .replace(/^#{1,6}\s+.+$/gm, "")
    .replace(/【[^】]+】/g, "")
    .replace(/[*_`>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: title || fallbackTitle,
    body,
    summary: plain.slice(0, 180),
    language: "zh",
  };
}

/**
 * Execute an assembled agent for a specific workflow step.
 *
 * Flow:
 * 1. Build messages (system + previous context + step instruction)
 * 2. Call generateText with tools and maxSteps
 * 3. Parse output into StepOutput
 * 4. Return execution result
 */
export async function executeAgent(
  agent: AssembledAgent,
  input: AgentExecutionInput,
  onProgress?: ProgressCallback,
  missionTools?: ToolSet,
  /**
   * Phase 2 (2026-05-30-tool-context-injection-fix-plan): organizationId /
   * operatorId 等 context 透传给 toVercelTools, 让 LLM 触发的 tool 调用能拿到
   * 多租户上下文（cms_publish / archive_to_drafts 等需要）。
   */
  context?: ToolContext,
): Promise<AgentExecutionResult> {
  const startTime = Date.now();

  onProgress?.({ percent: 10, message: "正在准备执行环境..." });

  // Build the user message with context
  const stepInstruction = buildStepInstruction(input.stepKey);
  const previousContext = formatPreviousStepContext(input.previousSteps);
  const previousDetail = buildPreviousStepDetailContext(input.previousSteps);

  const userMessageParts: string[] = [
    `# 当前任务`,
    `选题：${input.topicTitle}`,
    `场景：${input.scenario}`,
    `当前步骤：${input.stepLabel}`,
    "",
    stepInstruction,
  ];

  if (previousContext) {
    userMessageParts.push("", previousContext);
  }
  if (previousDetail) {
    userMessageParts.push("", "# 详细参考资料", "", previousDetail);
  }
  if (input.userInstructions) {
    userMessageParts.push("", `# 用户附加指示`, input.userInstructions);
  }

  const userMessage = userMessageParts.join("\n");

  onProgress?.({ percent: 30, message: "正在调用 AI 模型..." });

  // Prepare tools (merge mission collaboration tools + KB retrieval tool)
  const kbTools =
    agent.knowledgeBaseIds && agent.knowledgeBaseIds.length > 0
      ? createKnowledgeBaseTools({ employeeKnowledgeBaseIds: agent.knowledgeBaseIds })
      : undefined;

  const mcp = isMcpEnabled() && context?.organizationId
    ? await createMcpToolset(context.organizationId)
    : null;

  const vercelTools = toVercelTools(
    agent.tools,
    agent.pluginConfigs,
    missionTools,
    kbTools,
    {
      ...context,
      authorityDomains: agent.domainAuthoritySources,
    },
    mcp?.tools,
  );

  let toolCallCount = 0;
  // Bug B (Phase 2): 累积所有 success=false 的 tool 结果, parseStepOutput
  // 之后用来 override output.status="failed"。LLM 文本叙述 "我失败了" 不可信
  // —— parseStepOutput 只看三段式结构, 检测不到失败。
  const toolFailures: Array<{ toolName: string; code: string; message: string }> = [];
  const successfulToolOutputs: Array<Record<string, unknown>> = [];
  // 四层重构:记录本步骤实际调用过的工具名,连同 skillSlug 写回 outputData,
  // 供执行面板渲染"用了什么技能/工具"chip。
  const invokedToolNames = new Set<string>();

  // 应用 skill-level override（如 layout_design 降 maxTokens 提速）
  const effectiveModelConfig = applySkillOverride(agent.modelConfig, input.skillSlug);
  const model = getLanguageModel(effectiveModelConfig);

  // 注入「当前日期」：模型训练截止日可能早于真实时间，不明示的话 LLM 会按训练数据
  // 里的时间判断时效，导致 web_search 设错 timeRange（比如默认 24h 命中旧数据）。
  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateContext = `

## 时间基准
当前日期：${today}
涉及时间相关的工具调用（尤其是 web_search / trending_topics）请以此为基准：
- 用户要求覆盖"最近一周"或跨多天 → timeRange="7d"
- 覆盖"最近一个月"/"本月"/指定月份 → timeRange="30d"
- 只要今日突发 → 保持默认 timeRange="24h"
- 需要历史回顾 → timeRange="all"`;

  // When the caller supplies a skillSpec (i.e. this step must execute a
  // specific SKILL.md), pin it into the system prompt so the model treats the
  // skill's workflow + output schema as a hard execution contract, not as
  // optional context. Without this, generic outputs like "周度热点聚合结果"
  // were observed because the SKILL body sat in the user-message tail.
  //
  // The output frame at the end is the contract the UI assumes: every step
  // shows【执行摘要】/【执行过程】/【产出结果】sections in mission-console.
  const systemPrompt = input.skillSpec
    ? `${agent.systemPrompt}${dateContext}

## 必须遵守：当前步骤执行规范

下面是本步骤对应技能的完整规范（SKILL.md），包含工作流 checklist、输出模板与质量要求。你必须严格按其结构产出，不可输出空泛的一句话占位文本（如"XX结果"）。

**SKILL.md 中若提到"应调用场景"、"前置条件"、"输入"或明示工具调用流程，你必须真实调用相应工具，不得跳过工具直接按输出模板想象结果**。参数必须取自用户在【工作流输入参数】/【本次工作流任务】中的实际输入。工具返回空结果 → 如实说明，不要替换为无关话题。（呼应 system prompt 的"真实性与工具调用"层）

${input.skillSpec}

## 输出格式要求（强制）

无论 SKILL 内部要求如何，你的最终回复必须按以下三段式呈现，每段不少于 100 字、含具体数据 / 来源 / 推理依据：

【执行摘要】
本步骤完成了什么、关键结论是什么（3-5 句话）。

【执行过程】
按编号列出 3-5 个执行子步骤，每条说明：① 做了什么 ② 关键参数或来源 ③ 选择该做法的理由。

【产出结果】
按 SKILL.md 中"输出"或"输出模板"章节定义的结构化字段输出真实可用的产出（具体数字、列表、片段，不要写"待补充"）。

最后另起一行附：【质量自评：XX/100】`
    : `${agent.systemPrompt}${dateContext}`;

  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: vercelTools,
      stopWhen: stepCountIs(20),
      temperature: effectiveModelConfig.temperature,
      maxOutputTokens: effectiveModelConfig.maxTokens,
      abortSignal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
      onStepFinish: ({ toolCalls, toolResults }) => {
        if (toolCalls && toolCalls.length > 0) {
          toolCallCount += toolCalls.length;
          for (const tc of toolCalls as Array<{ toolName?: string }>) {
            if (tc.toolName) invokedToolNames.add(tc.toolName);
          }
          onProgress?.({
            percent: Math.min(30 + toolCallCount * 10, 80),
            message: `已执行 ${toolCallCount} 个工具调用...`,
          });
        }
        // Bug B (Phase 2): 扫 toolResults 抓 success=false, 后续覆盖 output.status。
        // AI SDK v6 的 TypedToolResult 把工具返回值放在 `.output` 字段(见
        // node_modules/ai/dist/index.d.ts:514-540),不是 `.result`。早期实现误读
        // `tr.result` 导致整个失败检测分支在真实 SDK 下永远是 undefined → 静默失效。
        if (toolResults) {
          for (const tr of toolResults as Array<{ toolName?: string; output?: unknown }>) {
            const r = tr.output;
            if (!r || typeof r !== "object") continue;
            if ((r as { success?: unknown }).success === false) {
              const err = (r as { error?: unknown }).error as
                | { code?: unknown; message?: unknown }
                | undefined;
              toolFailures.push({
                toolName: tr.toolName ?? "unknown",
                code: typeof err?.code === "string" ? err.code : "tool_error",
                message:
                  typeof err?.message === "string" ? err.message : "工具返回 success=false",
              });
            } else {
              successfulToolOutputs.push(r as Record<string, unknown>);
            }
          }
        }
      },
    });
  } finally {
    await mcp?.close();
  }

  onProgress?.({ percent: 90, message: "正在整理输出..." });

  // Parse the final text output into structured StepOutput
  const output = parseStepOutput(
    result.text,
    input.stepKey,
    agent.slug
  );

  // Successful tool calls often return structured fields that downstream
  // workflow steps need for parameter binding, e.g. archive_to_drafts returns
  // `firstArticleId` / `created[]` and cms_publish can consume those via
  // `{{stepN.firstArticleId}}`. parseStepOutput only captures the final text,
  // so preserve non-reserved tool fields on the StepOutput itself.
  const reservedOutputKeys = new Set([
    "stepKey",
    "employeeSlug",
    "summary",
    "artifacts",
    "metrics",
    "status",
    "errorMessage",
    "errorCode",
    "usedSkills",
    "usedTools",
  ]);
  for (const toolOutput of successfulToolOutputs) {
    for (const [key, value] of Object.entries(toolOutput)) {
      if (!reservedOutputKeys.has(key)) {
        output[key] = value;
      }
    }
  }

  // 四层重构:回写本步骤实际用到的技能 + 工具(供执行面板 chip)。
  if (input.skillSlug) output.usedSkills = [input.skillSlug];
  if (invokedToolNames.size > 0) output.usedTools = [...invokedToolNames];

  if (input.skillSlug === "content_generate") {
    const article = buildArticleDraftFromGeneratedText(
      result.text,
      input.topicTitle || input.stepLabel || "工作流生成稿件",
    );
    if (article) {
      output.title = article.title;
      output.body = article.body;
      output.articles = [article];
    }
  }

  // Bug B (Phase 2): tool 调用失败时 override 为 "failed"。
  // 必须在 authority-level 检查之前/或保持 guard ——- 如果 observer agent 的 tool 真挂了,
  // status 应该是 failed, 不能被 "needs_approval" 覆盖（工具没成功跑, 没东西可审批）。
  if (toolFailures.length > 0) {
    output.status = "failed";
    const first = toolFailures[0];
    const more =
      toolFailures.length > 1 ? `（共 ${toolFailures.length} 个工具失败）` : "";
    output.errorMessage = `工具 ${first.toolName} 失败：${first.code} — ${first.message}${more}`;
    output.errorCode = first.code;
  }

  // Check if approval is needed based on authority level.
  // Guard: 不要覆盖上面已经标记为 "failed" 的状态 —— 工具没跑成, 没东西审批。
  if (
    (agent.authorityLevel === "observer" || agent.authorityLevel === "advisor") &&
    output.status !== "failed"
  ) {
    output.status = "needs_approval";
  }

  const durationMs = Date.now() - startTime;

  onProgress?.({ percent: 100, message: "步骤完成" });

  return {
    output,
    tokensUsed: {
      input: result.usage?.inputTokens ?? 0,
      output: result.usage?.outputTokens ?? 0,
    },
    durationMs,
    toolCallCount,
  };
}
