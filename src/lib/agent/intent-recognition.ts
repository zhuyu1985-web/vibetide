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
  const byCategory = new Map<string, string[]>();
  for (const s of getAllBuiltinSkills()) {
    const list = byCategory.get(s.category) || [];
    list.push(`${s.slug}（${s.name}）：${s.description}`);
    byCategory.set(s.category, list);
  }

  const categoryLabels: Record<string, string> = {
    perception: "感知类",
    analysis: "分析类",
    generation: "生成类",
    production: "制作类",
    management: "管理类",
    knowledge: "知识类",
  };

  return Array.from(byCategory.entries())
    .map(
      ([cat, skills]) =>
        `### ${categoryLabels[cat] || cat}\n${skills.map((s) => `  - ${s}`).join("\n")}`
    )
    .join("\n\n");
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

const INTENT_PROMPT = `你是一个智能意图识别引擎。请分析用户的输入，识别其真实意图，并规划最优的执行方案。

## 意图类型
- information_retrieval：信息检索（搜索、聚合、监控）
- content_creation：内容创作（写文章、脚本、标题）
- deep_analysis：深度分析（调研+分析，通常需要先搜索再分析）
- data_analysis：数据分析（指标、受众、竞品）
- content_review：内容审核（质量检查、合规、事实核查）
- media_production：媒体制作（视频、音频、排版方案）
- publishing：发布运营（发布策略、渠道分发）
- general_chat：日常闲聊（不需要特定技能）

## 可用技能目录
{SKILL_CATALOG}

## 可用AI员工
{EMPLOYEE_CATALOG}
{FEW_SHOT}
## 规则
1. 根据用户输入判断最匹配的意图类型
2. 选择完成任务所需的最少技能组合（不要贪多）
3. 为每个步骤分配最合适的员工（根据员工的技能专长）
4. 如果任务需要多个员工协作，按依赖关系排列步骤
5. 如果是简单闲聊（打招呼、问好、聊天），返回 general_chat
6. confidence 评分标准：
   - 0.9-1.0：意图非常明确，用户明确说了要做什么
   - 0.7-0.89：意图较明确，但有一定模糊性
   - 0.5-0.69：意图不太明确，可能有多种理解
   - <0.5：意图非常模糊，建议让用户澄清

请以JSON格式返回（不要包含markdown代码块标记）：
{
  "intentType": "意图类型",
  "summary": "一句话描述执行方案（中文）",
  "confidence": 0.0-1.0,
  "steps": [
    {
      "employeeSlug": "员工slug",
      "employeeName": "员工昵称",
      "skills": ["技能slug列表"],
      "taskDescription": "该步骤的具体任务描述（中文）",
      "dependsOn": null 或前置步骤的index
    }
  ],
  "reasoning": "推理过程（中文）"
}`;

export async function recognizeIntent(
  message: string,
  currentEmployeeSlug: string,
  availableEmployees: EmployeeSkillInfo[],
  userMemories: IntentMemoryEntry[] = []
): Promise<IntentResult> {
  const skillCatalog = buildSkillCatalog();
  const employeeCatalog = buildEmployeeCatalog(availableEmployees);
  const fewShot = buildFewShotExamples(userMemories);

  const systemPrompt = INTENT_PROMPT
    .replace("{SKILL_CATALOG}", skillCatalog)
    .replace("{EMPLOYEE_CATALOG}", employeeCatalog)
    .replace("{FEW_SHOT}", fewShot);

  const userPrompt = `当前选中的员工：${currentEmployeeSlug}\n用户输入：${message}`;

  try {
    const result = await generateText({
      model: getLanguageModel({
        provider: "openai",
        model: process.env.OPENAI_MODEL || "deepseek-chat",
        temperature: 0.3,
        maxTokens: 2048,
      }),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.3,
      maxOutputTokens: 2048,
    });

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
