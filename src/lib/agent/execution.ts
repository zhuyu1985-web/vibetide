import { generateText, stepCountIs } from "ai";
import { getLanguageModel } from "./model-router";
import { toVercelTools, createKnowledgeBaseTools } from "./tool-registry";
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
  missionTools?: ToolSet
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
  const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs, missionTools, kbTools);

  let toolCallCount = 0;

  const model = getLanguageModel(agent.modelConfig);

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

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    tools: vercelTools,
    stopWhen: stepCountIs(20),
    temperature: agent.modelConfig.temperature,
    maxOutputTokens: agent.modelConfig.maxTokens,
    abortSignal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
    onStepFinish: ({ toolCalls }) => {
      if (toolCalls && toolCalls.length > 0) {
        toolCallCount += toolCalls.length;
        onProgress?.({
          percent: Math.min(30 + toolCallCount * 10, 80),
          message: `已执行 ${toolCallCount} 个工具调用...`,
        });
      }
    },
  });

  onProgress?.({ percent: 90, message: "正在整理输出..." });

  // Parse the final text output into structured StepOutput
  const output = parseStepOutput(
    result.text,
    input.stepKey,
    agent.slug
  );

  // Check if approval is needed based on authority level
  if (agent.authorityLevel === "observer" || agent.authorityLevel === "advisor") {
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
