import { generateText } from "ai";
import { getLanguageModel, getDefaultModel } from "@/lib/agent/model-router";
import {
  buildSkillCatalog,
  buildEmployeeCatalog,
  isGreeting,
} from "@/lib/agent/intent-recognition";
import { getBuiltinSkillSlugs } from "@/lib/skill-loader";
import { loadAvailableEmployees } from "@/lib/mission-core";
import type { IntentStep } from "@/lib/agent/types";
import type { EmployeeId } from "@/lib/constants";
import type { ChannelSessionRow } from "@/lib/dal/channel-sessions";

export type ClarifyOrPlanResult =
  | { action: "clarify"; question: string }
  | { action: "execute"; summary: string; steps: IntentStep[] };

const CLARIFY_FALLBACK = "能再具体说说你想做什么吗？";

const PLANNER_PROMPT = `你是 IM 群里的任务规划助手。基于对话历史和最新消息，判断并只输出 JSON。

## 第一步：判断信息是否足够开工
判断标准是"有没有一个能动笔的主题/对象"，**不是"主题够不够细"**。给了主题就开工，宽主题不要反问用户缩窄。
- 写作/内容创作类：**有领域级主题就算够**——"AI行业""新能源车""成都美食"都够，直接规划；主题宽就在计划里加"拟选题/提纲"步骤去聚焦，**绝不反问让用户把主题缩窄**。
  只有**完全没有主题/对象**才不够，例如"帮我写点东西""写篇稿子""做个内容""随便写写""帮我搞个东西"。
- 检索/热点/搜索类（抓热点、搜某关键词进展、查某网页）：动作+对象明确即可（"抓科技热点""搜英伟达进展"都够）。
- 数据分析类：分析对象明确即可（"上周的内容数据"够，默认用本组织数据），不必追问指标。
- 审核/校对类：**必须有待审对象**（稿件正文或链接）；只说"审核一篇稿子"却没给内容 → 不足，请对方提供。
信息不足 → { "needClarify": true, "question": "<一句简洁中文，问最关键缺失的 1 项>" }

## 第二步：信息足够 → 产出【自适应深度】执行计划
{ "needClarify": false, "summary": "<一句话方案>", "steps": [...] }
- 步数按复杂度自适应：发通知/简单改写 1-2 步；常规写稿 2-3 步；深度稿/系列/多平台 3-4 步。
  不为凑步数注水，也不要把复杂任务压成一步。
- 内容创作典型分解（按需取舍）：① 联网搜集资料 ② 拟提纲 ③ 撰写正文 ④ 配图。
- 每个 step 选技能最匹配的工种员工，绑该步所需技能，taskDescription 写成人看得懂的一句话。

## 技能/检索路由（重要）
- "热点/热榜/热搜/今天最火/各平台在讨论什么" → 必须用 trending_topics（实时热榜），不要 web_search。
- "某关键词最新进展/全网怎么报道 XX" → web_search。
- "某网页/URL 正文" → web_deep_read。

## 技能目录
{SKILL_CATALOG}
## 员工
{EMPLOYEE_CATALOG}

只输出 JSON（不含 markdown）：
{ "needClarify": true|false, "question": "...", "summary": "...", "steps": [{"employeeSlug":"","employeeName":"","skills":[],"taskDescription":""}] }`;

interface PlannerStep {
  employeeSlug?: string;
  employeeName?: string;
  skills?: string[];
  taskDescription?: string;
}
interface PlannerJSON {
  needClarify?: boolean;
  question?: string;
  summary?: string;
  steps?: PlannerStep[];
}

/**
 * IM 规划器：判断信息够不够开工。不够→澄清问最关键缺项；够→产自适应深度的真实多步计划。
 * 决策由 prompt 显式判断（不读 confidence）；校验层只做合法性过滤 + 空则退回 clarify，绝不 fabricate。
 */
export async function clarifyOrPlan(
  orgId: string,
  session: ChannelSessionRow,
  message: string,
): Promise<ClarifyOrPlanResult> {
  if (isGreeting(message)) {
    return { action: "clarify", question: "你好！想让我帮你做什么？" };
  }

  const ctx = (session.contextTurns ?? []).map((t) => `${t.role}: ${t.content}`).join("\n");
  const fullMessage = ctx ? `${ctx}\nuser: ${message}` : message;

  const employees = await loadAvailableEmployees(orgId);
  const catalog = employees.map((e) => ({
    slug: e.slug,
    name: e.name,
    nickname: e.nickname,
    title: e.title,
    skills: e.skills ?? [],
  }));
  const systemPrompt = PLANNER_PROMPT
    .replace("{SKILL_CATALOG}", buildSkillCatalog())
    .replace("{EMPLOYEE_CATALOG}", buildEmployeeCatalog(catalog));

  const { text } = await generateText({
    model: getLanguageModel({ provider: "openai", model: getDefaultModel(), temperature: 0.2, maxTokens: 1024 }),
    system: systemPrompt,
    messages: [{ role: "user", content: fullMessage }],
    temperature: 0.2,
    maxOutputTokens: 1024,
  });

  let parsed: PlannerJSON;
  try {
    let t = text.trim();
    if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    parsed = JSON.parse(t) as PlannerJSON;
  } catch {
    return { action: "clarify", question: CLARIFY_FALLBACK };
  }

  if (parsed.needClarify !== false) {
    return { action: "clarify", question: (parsed.question ?? "").trim() || CLARIFY_FALLBACK };
  }

  const validSlugs = new Set(catalog.map((e) => e.slug));
  const bySlug = new Map(catalog.map((e) => [e.slug, e]));
  const skillSlugs = getBuiltinSkillSlugs();
  const steps: IntentStep[] = (parsed.steps ?? [])
    .filter((s): s is PlannerStep & { employeeSlug: string } =>
      typeof s.employeeSlug === "string" && validSlugs.has(s.employeeSlug))
    .map((s) => ({
      employeeSlug: s.employeeSlug as EmployeeId,
      employeeName: s.employeeName || bySlug.get(s.employeeSlug)?.nickname || s.employeeSlug,
      skills: (s.skills ?? []).filter((sk) => skillSlugs.has(sk)),
      taskDescription: s.taskDescription ?? "",
    }));

  if (steps.length === 0) {
    return { action: "clarify", question: CLARIFY_FALLBACK };
  }

  return { action: "execute", summary: parsed.summary ?? message, steps };
}
