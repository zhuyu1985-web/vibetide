import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { EmployeeId } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntentType =
  | "breaking_news"
  | "deep_report"
  | "social_campaign"
  | "series"
  | "event_coverage"
  | "routine";

export type IntentScale = "single" | "batch" | "series";
export type TimeConstraint = "urgent" | "normal" | "flexible";

export interface SuggestedStep {
  key: string;
  label: string;
  employeeSlug: EmployeeId;
  parallel?: boolean;
}

export interface ParsedIntent {
  intentType: IntentType;
  scale: IntentScale;
  timeConstraint: TimeConstraint;
  requiredCapabilities: string[];
  suggestedSteps: SuggestedStep[];
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Default 8-step workflow (fallback)
// ---------------------------------------------------------------------------

const DEFAULT_STEPS: SuggestedStep[] = [
  { key: "monitor", label: "热点监控", employeeSlug: "xiaolei" },
  { key: "plan", label: "选题策划", employeeSlug: "xiaoce" },
  { key: "material", label: "素材准备", employeeSlug: "xiaozi" },
  { key: "create", label: "内容创作", employeeSlug: "xiaowen" },
  { key: "produce", label: "视频制作", employeeSlug: "xiaojian" },
  { key: "review", label: "质量审核", employeeSlug: "xiaoshen" },
  { key: "publish", label: "渠道发布", employeeSlug: "xiaofa" },
  { key: "analyze", label: "数据分析", employeeSlug: "xiaoshu" },
];

// ---------------------------------------------------------------------------
// Parse user intent via LLM
// ---------------------------------------------------------------------------

export async function parseUserIntent(
  topicTitle: string,
  scenario: string,
  availableEmployees: { slug: string; name: string; title: string }[]
): Promise<ParsedIntent> {
  const employeeList = availableEmployees
    .map((e) => `- ${e.slug}: ${e.name}（${e.title}）`)
    .join("\n");

  const prompt = `你是一个内容生产工作流规划助手。请分析以下用户输入，并生成最优的工作流步骤。

选题：${topicTitle}
场景：${scenario}

可用AI员工：
${employeeList}

请以JSON格式返回（不要包含markdown代码块标记）：
{
  "intentType": "breaking_news" | "deep_report" | "social_campaign" | "series" | "event_coverage" | "routine",
  "scale": "single" | "batch" | "series",
  "timeConstraint": "urgent" | "normal" | "flexible",
  "requiredCapabilities": ["需要的能力列表"],
  "suggestedSteps": [
    { "key": "步骤key", "label": "步骤名称", "employeeSlug": "员工slug" }
  ],
  "reasoning": "规划理由"
}

规划要求：
- 根据场景类型选择合适的步骤，不必使用全部8步
- 突发新闻(breaking_news)应精简步骤，跳过视频制作和深度分析
- 深度报道(deep_report)保留全部步骤
- 社交传播(social_campaign)可跳过热点监控但需要数据分析
- 每个步骤必须分配一个可用的员工slug`;

  try {
    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxOutputTokens: 2048,
    });

    const parsed = JSON.parse(result.text) as ParsedIntent;

    // Validate suggestedSteps have valid employee slugs
    const validSlugs = new Set(availableEmployees.map((e) => e.slug));
    const validSteps = parsed.suggestedSteps.filter((s) =>
      validSlugs.has(s.employeeSlug)
    );

    if (validSteps.length === 0) {
      return {
        ...parsed,
        suggestedSteps: DEFAULT_STEPS,
        reasoning: parsed.reasoning + "（步骤验证失败，回退到默认工作流）",
      };
    }

    return { ...parsed, suggestedSteps: validSteps };
  } catch {
    // Fallback to default workflow on any error
    return {
      intentType: "routine",
      scale: "single",
      timeConstraint: "normal",
      requiredCapabilities: [],
      suggestedSteps: DEFAULT_STEPS,
      reasoning: "意图解析失败，使用默认工作流。",
    };
  }
}
