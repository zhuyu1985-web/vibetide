import { generateText, stepCountIs } from "ai";
import { getLanguageModel } from "./model-router";
import { toVercelTools } from "./tool-registry";
import {
  buildStepInstruction,
  formatPreviousStepContext,
  buildPreviousStepDetailContext,
} from "./prompt-templates";
import { parseStepOutput } from "./step-io";
import type {
  AssembledAgent,
  AgentExecutionInput,
  AgentExecutionResult,
  ProgressCallback,
} from "./types";

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
  onProgress?: ProgressCallback
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

  // Prepare tools
  const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs);

  let toolCallCount = 0;

  const model = getLanguageModel(agent.modelConfig);

  const result = await generateText({
    model,
    system: agent.systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    tools: vercelTools,
    stopWhen: stepCountIs(20),
    temperature: agent.modelConfig.temperature,
    maxOutputTokens: agent.modelConfig.maxTokens,
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
