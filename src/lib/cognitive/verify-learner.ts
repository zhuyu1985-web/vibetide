/**
 * Cognitive Engine — VerifyLearner module.
 *
 * Self-evaluates task output quality via LLM, persists verification records
 * and generates memories (success patterns / failure lessons / skill insights).
 *
 * Design principle: verification must NEVER block execution. All LLM and DB
 * errors are caught and a default passing result is returned.
 */

import { generateText } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";
import { db } from "@/db";
import { employeeMemories, verificationRecords } from "@/db/schema";
import type {
  VerificationInput,
  VerificationResult,
  VerificationIssue,
  GeneratedMemory,
  VerificationLevel,
} from "./types";
import { determineVerificationLevel } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_OUTPUT_CHARS = 6000;

// ---------------------------------------------------------------------------
// Default (fallback) result — used when LLM / DB errors occur
// ---------------------------------------------------------------------------

function defaultResult(level: VerificationLevel): VerificationResult {
  return {
    passed: true,
    qualityScore: 70,
    level,
    verifierType: "self_eval",
    feedback: "验证跳过（系统回退）",
    issues: [],
    memoriesGenerated: [],
  };
}

// ---------------------------------------------------------------------------
// Build self-eval prompt
// ---------------------------------------------------------------------------

function buildPrompt(input: VerificationInput): string {
  const truncatedOutput =
    input.output.length > MAX_OUTPUT_CHARS
      ? input.output.slice(0, MAX_OUTPUT_CHARS) + "\n…（已截断）"
      : input.output;

  const expectedSection = input.expectedOutput
    ? `- 期望输出：${input.expectedOutput}`
    : "";

  return `你是一个严格的质量评审员。请评估以下任务产出的质量。

## 任务信息
- 标题：${input.taskTitle}
- 描述：${input.taskDescription}
${expectedSection}

## 产出内容
${truncatedOutput}

## 评估要求
请从以下维度评估，并给出 0-100 的总分：
1. 准确性 (accuracy)
2. 完整性 (completeness)
3. 风格 (style)
4. 合规性 (compliance)

## 输出格式
严格按 JSON 输出，不要包含任何其他文字：
{
  "qualityScore": <number 0-100>,
  "passed": <boolean, score >= 60 为 true>,
  "feedback": "<string 总体评价>",
  "issues": [
    { "type": "<accuracy|completeness|style|compliance>", "description": "<问题描述>", "severity": "<low|medium|high>" }
  ],
  "successPattern": "<string 成功模式总结, score >= 80 时提供, 否则 null>",
  "failureLesson": "<string 失败教训, score < 60 时提供, 否则 null>"
}`;
}

// ---------------------------------------------------------------------------
// Parse LLM response
// ---------------------------------------------------------------------------

interface LLMEvalResponse {
  qualityScore: number;
  passed: boolean;
  feedback: string;
  issues: Array<{
    type: string;
    description: string;
    severity: string;
  }>;
  successPattern: string | null;
  failureLesson: string | null;
}

function parseLLMResponse(raw: string): LLMEvalResponse | null {
  try {
    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(cleaned) as LLMEvalResponse;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Generate memories from evaluation
// ---------------------------------------------------------------------------

function generateMemories(
  eval_: LLMEvalResponse,
): GeneratedMemory[] {
  const memories: GeneratedMemory[] = [];

  if (eval_.qualityScore >= 80 && eval_.successPattern) {
    memories.push({
      type: "success_pattern",
      content: eval_.successPattern,
      importance: Math.min(1.0, eval_.qualityScore / 100),
    });
  }

  if (eval_.qualityScore < 60 && eval_.failureLesson) {
    memories.push({
      type: "failure_lesson",
      content: eval_.failureLesson,
      importance: 0.8,
    });
  }

  // Generate skill_insight for any high-severity issue
  const highSeverityIssues = eval_.issues.filter((i) => i.severity === "high");
  for (const issue of highSeverityIssues) {
    memories.push({
      type: "skill_insight",
      content: `[${issue.type}] ${issue.description}`,
      importance: 0.7,
    });
  }

  return memories;
}

// ---------------------------------------------------------------------------
// Persist verification record
// ---------------------------------------------------------------------------

async function persistVerificationRecord(
  input: VerificationInput,
  result: VerificationResult,
): Promise<void> {
  await db.insert(verificationRecords).values({
    organizationId: input.organizationId,
    missionId: input.missionId ?? null,
    taskId: input.taskId ?? null,
    verificationLevel: result.level,
    verifierType: result.verifierType,
    verifierEmployeeId: input.employeeId,
    qualityScore: result.qualityScore,
    passed: result.passed,
    feedback: result.feedback,
    issuesFound: result.issues.map((i) => ({
      type: i.type,
      description: i.description,
      severity: i.severity,
    })),
  });
}

// ---------------------------------------------------------------------------
// Persist generated memories
// ---------------------------------------------------------------------------

async function persistMemories(
  input: VerificationInput,
  memories: GeneratedMemory[],
): Promise<void> {
  if (memories.length === 0) return;

  const rows = memories.map((m) => ({
    employeeId: input.employeeId,
    organizationId: input.organizationId,
    memoryType: m.type as "success_pattern" | "failure_lesson" | "user_preference" | "skill_insight",
    content: m.content,
    importance: m.importance,
    sourceTaskId: input.taskId ?? null,
    confidence: 1.0,
    decayRate: 0.01,
  }));

  await db.insert(employeeMemories).values(rows);
}

// ---------------------------------------------------------------------------
// Main public function
// ---------------------------------------------------------------------------

export async function verify(
  input: VerificationInput,
): Promise<VerificationResult> {
  const level = determineVerificationLevel(input.intentType);

  try {
    // 1. Call LLM for self-evaluation
    const model = getLanguageModel({
      provider: "openai",
      model: process.env.OPENAI_MODEL || "deepseek-chat",
      temperature: 0.2,
      maxTokens: 2000,
    });

    const { text } = await generateText({
      model,
      prompt: buildPrompt(input),
      maxOutputTokens: 2000,
    });

    // 2. Parse response
    const eval_ = parseLLMResponse(text);
    if (!eval_) {
      console.warn("[VerifyLearner] Failed to parse LLM response, using default");
      return defaultResult(level);
    }

    // 3. Build result
    const issues: VerificationIssue[] = eval_.issues.map((i) => ({
      type: i.type as VerificationIssue["type"],
      description: i.description,
      severity: i.severity as VerificationIssue["severity"],
    }));

    const memoriesGenerated = generateMemories(eval_);

    const result: VerificationResult = {
      passed: eval_.passed,
      qualityScore: eval_.qualityScore,
      level,
      verifierType: "self_eval",
      feedback: eval_.feedback,
      issues,
      memoriesGenerated,
    };

    // 4. Persist (fire-and-forget; errors logged but don't block)
    await Promise.all([
      persistVerificationRecord(input, result).catch((err) =>
        console.error("[VerifyLearner] Failed to persist verification record:", err),
      ),
      persistMemories(input, memoriesGenerated).catch((err) =>
        console.error("[VerifyLearner] Failed to persist memories:", err),
      ),
    ]);

    return result;
  } catch (err) {
    console.error("[VerifyLearner] Verification failed, returning default:", err);
    return defaultResult(level);
  }
}
