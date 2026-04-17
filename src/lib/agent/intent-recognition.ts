import { generateText } from "ai";
import { getLanguageModel } from "./model-router";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { getAllBuiltinSkills, getBuiltinSkillSlugs } from "@/lib/skill-loader";

// Types and labels re-exported from ./types (client-safe, no server dependencies)
export type {
  ChatIntentType,
  IntentStep,
  IntentResult,
} from "./types";
export { INTENT_TYPE_LABELS } from "./types";

import type { ChatIntentType, IntentResult } from "./types";

// ---------------------------------------------------------------------------
// Intent memory (recent logs used as few-shot examples)
// ---------------------------------------------------------------------------

export interface IntentMemoryEntry {
  userMessage: string;
  intentType: string;
  skills: string[];
  userEdited: boolean;
}

// ---------------------------------------------------------------------------
// Workflow info for matching
// ---------------------------------------------------------------------------

export interface AvailableWorkflow {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
}

// ---------------------------------------------------------------------------
// Employee + skill catalog for the prompt
// ---------------------------------------------------------------------------

interface EmployeeSkillInfo {
  slug: string;
  name: string;
  nickname: string;
  title: string;
  skills: string[];
}

function buildEmployeeCatalog(
  availableEmployees: EmployeeSkillInfo[]
): string {
  return availableEmployees
    .map(
      (e) =>
        `- ${e.slug}（${e.nickname}，${e.title}）：${e.skills.join("、")}`
    )
    .join("\n");
}

function buildSkillCatalog(): string {
  // Compact format: slug(name) per line, no descriptions (saves ~50% tokens)
  const byCategory = new Map<string, string[]>();
  for (const s of getAllBuiltinSkills()) {
    const list = byCategory.get(s.category) || [];
    list.push(`${s.slug}(${s.name})`);
    byCategory.set(s.category, list);
  }

  return Array.from(byCategory.entries())
    .map(([cat, skills]) => `${cat}: ${skills.join(", ")}`)
    .join("\n");
}

function buildWorkflowCatalog(workflows: AvailableWorkflow[]): string {
  if (workflows.length === 0) return "";

  const triggerLabels: Record<string, string> = {
    manual: "手动触发",
    scheduled: "定时触发",
  };

  const list = workflows
    .map(
      (w) =>
        `- ${w.name}：${w.description || "无描述"}（${triggerLabels[w.triggerType] || w.triggerType}）[id: ${w.id}]`
    )
    .join("\n");

  return `\n## 已配置的工作流\n${list}\n\n如果用户的意图明确匹配一个已配置的工作流，优先使用工作流执行。\n在返回的 JSON 中添加 workflowId、workflowName 和 executionMode 字段。\nexecutionMode 为 "workflow" 表示使用工作流执行，"skill" 表示使用技能执行。\n`;
}

function buildFewShotExamples(memories: IntentMemoryEntry[]): string {
  if (memories.length === 0) return "";

  const examples = memories
    .slice(0, 10)
    .map(
      (m, i) =>
        `${i + 1}. 用户："${m.userMessage}" → 意图：${m.intentType}，技能：[${m.skills.join(",")}]${m.userEdited ? "（用户修正过）" : ""}`
    )
    .join("\n");

  return `\n## 该用户的历史意图模式（参考，但不要生搬硬套）\n${examples}\n`;
}

// ---------------------------------------------------------------------------
// Core recognition function
// ---------------------------------------------------------------------------

const INTENT_PROMPT = `意图识别引擎。分析用户输入，输出JSON执行方案。

意图类型：information_retrieval/content_creation/deep_analysis/data_analysis/content_review/media_production/publishing/general_chat

## 技能目录
{SKILL_CATALOG}

## 员工
{EMPLOYEE_CATALOG}
{WORKFLOW_CATALOG}{FEW_SHOT}
## 规则
- 选最少技能组合，避免冗余
- 按依赖关系排列步骤
- 闲聊/问候返回 general_chat 且 steps=[]
- confidence: 明确>0.8, 较明确0.6-0.8, 模糊<0.6

输出JSON（不含markdown）：
{
  "intentType": "...",
  "summary": "一句话方案",
  "confidence": 0-1,
  "steps": [{"employeeSlug":"", "employeeName":"", "skills":[], "taskDescription":"", "dependsOn": null}],
  "reasoning": "简短推理（1-2句）",
  "workflowId": "可选",
  "workflowName": "可选",
  "executionMode": "skill | workflow"
}`;

// Fast-path patterns that skip LLM entirely
const GREETING_PATTERNS = /^(你好|您好|hi|hello|hey|在吗|在么|早|晚安|嗨|哈喽|哈罗|在不在|嘿|啊|嗯|好的|收到|谢谢|thanks|thank you|ok|okay)[\s!！。.?？~～]*$/i;
const SHORT_CHAT_THRESHOLD = 6; // Messages this short are almost always chat

function isGreeting(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length <= SHORT_CHAT_THRESHOLD && GREETING_PATTERNS.test(trimmed)) {
    return true;
  }
  return false;
}

export async function recognizeIntent(
  message: string,
  currentEmployeeSlug: string,
  availableEmployees: EmployeeSkillInfo[],
  userMemories: IntentMemoryEntry[] = [],
  availableWorkflows: AvailableWorkflow[] = []
): Promise<IntentResult> {
  // Fast path: simple greetings skip LLM entirely
  if (isGreeting(message)) {
    return {
      intentType: "general_chat",
      summary: "日常对话",
      confidence: 0.95,
      steps: [],
      reasoning: "检测到问候语，直接进入自由对话",
    };
  }

  const skillCatalog = buildSkillCatalog();
  const employeeCatalog = buildEmployeeCatalog(availableEmployees);
  const workflowCatalog = buildWorkflowCatalog(availableWorkflows);
  const fewShot = buildFewShotExamples(userMemories.slice(0, 5)); // reduce from 10 to 5

  const systemPrompt = INTENT_PROMPT
    .replace("{SKILL_CATALOG}", skillCatalog)
    .replace("{EMPLOYEE_CATALOG}", employeeCatalog)
    .replace("{WORKFLOW_CATALOG}", workflowCatalog)
    .replace("{FEW_SHOT}", fewShot);

  const userPrompt = `当前选中的员工：${currentEmployeeSlug}\n用户输入：${message}`;

  try {
    // Add timeout — if LLM takes > 15s, abort and fallback to free chat
    const INTENT_TIMEOUT_MS = 15000;
    const generatePromise = generateText({
      model: getLanguageModel({
        provider: "openai",
        model: process.env.OPENAI_MODEL || "deepseek-chat",
        temperature: 0.2,
        maxTokens: 1024, // reduced from 2048 — JSON output rarely exceeds 500 tokens
      }),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.2,
      maxOutputTokens: 1024,
    });

    const result = await Promise.race([
      generatePromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("意图识别超时（15秒）")),
          INTENT_TIMEOUT_MS
        )
      ),
    ]);

    // Strip markdown code fences if present
    let text = result.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(text) as IntentResult;

    // Validate and clamp confidence
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));

    // Validate intent type
    const validTypes: ChatIntentType[] = [
      "information_retrieval",
      "content_creation",
      "deep_analysis",
      "data_analysis",
      "content_review",
      "media_production",
      "publishing",
      "general_chat",
    ];
    if (!validTypes.includes(parsed.intentType)) {
      parsed.intentType = "general_chat";
      parsed.confidence = 0.5;
    }

    // Validate employee slugs in steps
    const validSlugs = new Set(availableEmployees.map((e) => e.slug));
    parsed.steps = parsed.steps.filter((s) => validSlugs.has(s.employeeSlug));

    // If no valid steps and not general_chat, fallback to current employee
    if (parsed.steps.length === 0 && parsed.intentType !== "general_chat") {
      const current = availableEmployees.find(
        (e) => e.slug === currentEmployeeSlug
      );
      if (current) {
        parsed.steps = [
          {
            employeeSlug: current.slug as EmployeeId,
            employeeName: current.nickname,
            skills: current.skills.slice(0, 3),
            taskDescription: message,
          },
        ];
        parsed.confidence = Math.min(parsed.confidence, 0.6);
      }
    }

    // Validate skill slugs within steps
    const allSkillSlugs = getBuiltinSkillSlugs();
    for (const step of parsed.steps) {
      step.skills = step.skills.filter((s) => allSkillSlugs.has(s));
    }

    // Validate workflow fields if present
    if (parsed.workflowId) {
      const validWorkflowIds = new Set(availableWorkflows.map((w) => w.id));
      if (!validWorkflowIds.has(parsed.workflowId)) {
        // Invalid workflow ID — clear workflow fields
        delete parsed.workflowId;
        delete parsed.workflowName;
        parsed.executionMode = "skill";
      } else {
        parsed.executionMode = "workflow";
      }
    } else {
      // No workflow matched — ensure executionMode defaults to "skill"
      if (!parsed.executionMode) {
        parsed.executionMode = "skill";
      }
    }

    return parsed;
  } catch (err) {
    console.error("[intent-recognition] Failed:", err);
    // Fallback: general_chat with current employee
    const meta = EMPLOYEE_META[currentEmployeeSlug as EmployeeId];
    return {
      intentType: "general_chat",
      summary: "自由对话",
      confidence: 1.0,
      steps: [],
      reasoning: `意图识别失败，回退到自由对话模式。(${err instanceof Error ? err.message : "unknown"})`,
    };
  }
}

// INTENT_TYPE_LABELS is re-exported from ./types at the top of this file
