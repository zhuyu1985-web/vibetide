# IM 规划器重建 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 `clarifyOrPlan` 内核为专用 IM 规划 prompt，修复「模糊请求不澄清 / 计划空洞 / 清晰检索误判」三个根因。

**Architecture:** 把 clarify-vs-execute 决策从「读 recognizeIntent 的噪声 confidence」换成「一个 IM 专用 prompt 显式判断（有没有具体主题）+ 产自适应深度的真实多步计划」。单次 generateText + JSON.parse + 确定性校验。对外签名/返回不变，gateway 与 Phase 1a/1b 全不动。

**Tech Stack:** TypeScript / AI SDK v6 / Vitest。复用 intent-recognition 的目录构建器 + skill-loader 校验 + loadAvailableEmployees。

**Spec:** `docs/superpowers/specs/2026-06-21-im-planner-rebuild-design.md`

**分支：** `claude/im-planner-rebuild`（off `main`）。

**关键类型注意：** `IntentStep.employeeSlug` 类型是 `EmployeeId`（types.ts:195），但目录是工种 slug（reporter/editor…）。沿用 recognizeIntent 做法：`employeeSlug: s.employeeSlug as EmployeeId`（运行时按目录校验真实性，类型用 cast 应付）。`EmployeeId` from `@/lib/constants`。

---

### Task Pr-T1: 重写 clarifyOrPlan 内核（导出复用 + 新 prompt + 校验）

**Files:**
- Modify: `src/lib/agent/intent-recognition.ts`（给 `buildSkillCatalog`/`buildEmployeeCatalog`/`isGreeting` 加 `export`，零行为变更）
- Rewrite: `src/lib/channels/clarify-or-plan.ts`
- Test: `src/lib/channels/__tests__/clarify-or-plan.test.ts`（新建或重写；现有若有旧用例一并替换）

- [ ] **Step 1: 导出 3 个纯函数**

`src/lib/agent/intent-recognition.ts`：把 `function buildSkillCatalog()` → `export function buildSkillCatalog()`；`function buildEmployeeCatalog(` → `export function buildEmployeeCatalog(`；`function isGreeting(` → `export function isGreeting(`。仅加 export，不改实现。`npx tsc --noEmit` 确认 recognizeIntent 仍编译。

- [ ] **Step 2: 写失败单测（mock LLM）**

`src/lib/channels/__tests__/clarify-or-plan.test.ts`：
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { generateText, getLanguageModel, loadAvailableEmployees } = vi.hoisted(() => ({
  generateText: vi.fn(),
  getLanguageModel: vi.fn(() => ({})),
  loadAvailableEmployees: vi.fn(),
}));

vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/agent/model-router", () => ({ getLanguageModel }));
vi.mock("@/lib/mission-core", () => ({ loadAvailableEmployees }));
// 真实复用 intent-recognition 目录构建器 + skill-loader 校验（静态数据，不 mock）

import { clarifyOrPlan } from "../clarify-or-plan";

const session = { contextTurns: [], clarifyRounds: 0 } as never;
const CATALOG = [
  { slug: "reporter", name: "记者", nickname: "小记", title: "记者", skills: ["content_generate"] },
];

beforeEach(() => {
  generateText.mockReset();
  loadAvailableEmployees.mockReset();
  loadAvailableEmployees.mockResolvedValue(CATALOG);
});

const reply = (obj: unknown) => generateText.mockResolvedValue({ text: JSON.stringify(obj) });

describe("clarifyOrPlan（重建规划器）", () => {
  it("needClarify:true → clarify", async () => {
    reply({ needClarify: true, question: "想写什么主题？" });
    const r = await clarifyOrPlan("org1", session, "帮我写点东西");
    expect(r).toEqual({ action: "clarify", question: "想写什么主题？" });
  });

  it("needClarify:false + 合法 steps → execute", async () => {
    reply({ needClarify: false, summary: "写AI稿", steps: [
      { employeeSlug: "reporter", employeeName: "小记", skills: ["content_generate"], taskDescription: "撰写AI深度稿" },
    ] });
    const r = await clarifyOrPlan("org1", session, "写一篇AI深度稿");
    expect(r.action).toBe("execute");
    if (r.action === "execute") {
      expect(r.summary).toBe("写AI稿");
      expect(r.steps).toHaveLength(1);
      expect(r.steps[0].employeeSlug).toBe("reporter");
    }
  });

  it("非法 employeeSlug 被过滤，全空 → 退回 clarify（不 fabricate）", async () => {
    reply({ needClarify: false, summary: "x", steps: [
      { employeeSlug: "ghost", employeeName: "鬼", skills: ["content_generate"], taskDescription: "x" },
    ] });
    const r = await clarifyOrPlan("org1", session, "写稿");
    expect(r.action).toBe("clarify");
  });

  it("非法 skill 被过滤但 step 保留（employeeSlug 合法）→ execute", async () => {
    reply({ needClarify: false, summary: "x", steps: [
      { employeeSlug: "reporter", employeeName: "小记", skills: ["content_generate", "fake_skill"], taskDescription: "写" },
    ] });
    const r = await clarifyOrPlan("org1", session, "写AI稿");
    expect(r.action).toBe("execute");
    if (r.action === "execute") expect(r.steps[0].skills).toEqual(["content_generate"]);
  });

  it("needClarify:false 但 steps 空 → 退回 clarify", async () => {
    reply({ needClarify: false, summary: "x", steps: [] });
    const r = await clarifyOrPlan("org1", session, "写稿");
    expect(r.action).toBe("clarify");
  });

  it("JSON 解析失败 → clarify 兜底", async () => {
    generateText.mockResolvedValue({ text: "这不是JSON" });
    const r = await clarifyOrPlan("org1", session, "写稿");
    expect(r.action).toBe("clarify");
  });

  it("generateText 抛错 → 向上抛（gateway 兜）", async () => {
    generateText.mockRejectedValue(new Error("LLM down"));
    await expect(clarifyOrPlan("org1", session, "写稿")).rejects.toThrow();
  });

  it("问候语 → 快路径 clarify，不调 LLM", async () => {
    const r = await clarifyOrPlan("org1", session, "你好");
    expect(r.action).toBe("clarify");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("employeeName 缺失 → 用目录 nickname 回填", async () => {
    reply({ needClarify: false, summary: "x", steps: [
      { employeeSlug: "reporter", skills: ["content_generate"], taskDescription: "写" },
    ] });
    const r = await clarifyOrPlan("org1", session, "写AI稿");
    if (r.action === "execute") expect(r.steps[0].employeeName).toBe("小记");
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run src/lib/channels/__tests__/clarify-or-plan.test.ts`
Expected: FAIL（旧实现不满足新契约）

- [ ] **Step 4: 重写 clarify-or-plan.ts**

完整替换 `src/lib/channels/clarify-or-plan.ts`：
```ts
import { generateText } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";
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
- 写作/内容创作类（写稿/推文/文案/脚本/笔记等）：必须有【具体主题或对象】。
  "帮我写点东西""写篇稿子""做个内容""随便写写" —— 没有具体主题 → 信息不足。
- 检索/热点/搜索类（抓热点、搜某关键词进展、查某网页）：动作+对象明确即可，通常足够。
- 数据分析/审核/发布类：对象明确即可。
信息不足 → { "needClarify": true, "question": "<一句简洁中文，问最关键缺失的 1 项；写作类优先问主题，再问篇幅/风格/渠道>" }

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
  // 0. 问候快路径（不调 LLM）
  if (isGreeting(message)) {
    return { action: "clarify", question: "你好！想让我帮你做什么？" };
  }

  // 1. 拼累积上下文
  const ctx = (session.contextTurns ?? []).map((t) => `${t.role}: ${t.content}`).join("\n");
  const fullMessage = ctx ? `${ctx}\nuser: ${message}` : message;

  // 2. 员工/技能目录
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

  // 3. 单次 LLM 调用（抛错向上传，gateway try/catch 回"系统忙"）
  const modelName = process.env.OPENAI_MODEL ?? "deepseek-chat";
  const { text } = await generateText({
    model: getLanguageModel({ provider: "openai", model: modelName, temperature: 0.2, maxTokens: 1024 }),
    system: systemPrompt,
    messages: [{ role: "user", content: fullMessage }],
    temperature: 0.2,
    maxOutputTokens: 1024,
  });

  // 4. 解析
  let parsed: PlannerJSON;
  try {
    let t = text.trim();
    if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    parsed = JSON.parse(t) as PlannerJSON;
  } catch {
    return { action: "clarify", question: CLARIFY_FALLBACK };
  }

  // 5. 决策：needClarify 非 false（true/缺失）→ clarify
  if (parsed.needClarify !== false) {
    return { action: "clarify", question: (parsed.question ?? "").trim() || CLARIFY_FALLBACK };
  }

  // 6. needClarify:false → 校验 steps（合法 employeeSlug + 合法 skill + 回填 employeeName）
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

  // 7. 校验后空 → 退回 clarify（绝不 fabricate）
  if (steps.length === 0) {
    return { action: "clarify", question: CLARIFY_FALLBACK };
  }

  return { action: "execute", summary: parsed.summary ?? message, steps };
}
```

- [ ] **Step 5: 跑测试 + tsc**

Run: `npx vitest run src/lib/channels/__tests__/clarify-or-plan.test.ts && npx tsc --noEmit`
Expected: 9 passed、tsc 0 errors。以测试为准。

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent/intent-recognition.ts src/lib/channels/clarify-or-plan.ts src/lib/channels/__tests__/clarify-or-plan.test.ts
git commit -m "feat(channel): 重写 clarifyOrPlan 为 IM 专用规划器（显式 slot-gate + 自适应多步计划，弃 confidence 门）"
```

---

### Task Pr-T2: 经验回归 + Ultracode 穷尽验证

**Files:**
- Modify: `scripts/_im-chain-probe.ts`（扩到 ~18 输入；改成调真实 `clarifyOrPlan` 而非 recognizeIntent；输出 JSON 文件）

本 task 验证**真实 LLM 行为**（单测只验确定性解析，证明不了 prompt 质量）。先跑探针，再用 workflow 扇出评审。

- [ ] **Step 1: 改探针调真实 clarifyOrPlan + 扩输入 + 落 JSON**

把 `scripts/_im-chain-probe.ts` 改成：import `clarifyOrPlan`（不再直接调 recognizeIntent），对每个输入构造 `{contextTurns:[],clarifyRounds:0}` 假 session 调用，输入扩到 ~18 条覆盖：
- 无主题写作（应 clarify）：`帮我写点东西`/`写篇稿子`/`随便写写`/`我想做个内容`/`帮我搞个东西`
- 有主题写作（应 execute，多步）：`写一篇AI行业的深度稿`/`写篇关于新能源车的稿子`/`帮我写一篇成都美食小红书种草笔记800字配3图`
- 检索/热点（应 execute）：`抓今天的科技热点`/`微博热搜现在什么最火`/`搜一下英伟达最新进展`
- 数据/审核/发布（应 execute 或合理 clarify）：`分析一下我们上周的内容数据`/`帮我审核这篇稿子`
- 多轮：模糊→补主题（应 execute）
- 边界：`你好`（问候→clarify）/ `在吗`（问候）
把结果（input → action / summary / steps）写到 `/tmp/im-probe-results.json`（用 `fs.writeFileSync`）。

- [ ] **Step 2: 跑探针（真 LLM）**

Run: `npx tsx --env-file=.env.local scripts/_im-chain-probe.ts`
人工先核对硬性门：无主题写作=clarify、有主题=多步 execute、热点=execute、问候=clarify。若硬性门有错 → 回 Pr-T1 调 `PLANNER_PROMPT` 重跑（systematic-debugging：改一处、重测）。

- [ ] **Step 3: Ultracode 穷尽验证 workflow**

把 `/tmp/im-probe-results.json` 读进来作为 `args`，跑一个 Workflow：每条结果扇出一个 judge agent，judge 输入 `{input, action, summary, steps}`，按 schema 输出 `{decisionCorrect:boolean, planReasonable:boolean, issue:string}`（judge 标准：模糊无主题该 clarify；有主题/检索该 execute 且 steps 真实、深度与复杂度匹配、employeeSlug/skill 合理）。汇总打分表 + 列出所有 `decisionCorrect=false` 或 `planReasonable=false`。
- 通过门槛：硬性 4 类全对；整体 judge 通过率 ≥ 90%。
- 不达标 → 据 judge 反馈调 `PLANNER_PROMPT`（回 Pr-T1），重跑 Step 2-3，直到达标。

- [ ] **Step 4: 记录验证结论**

把最终探针结果摘要（哪些 clarify/execute、计划几步）贴进本 task 完成说明，作为验证证据。

---

### Task Pr-T3: 全量验证 + 终审 + 合并

**Files:** 无新增（验证 + 清理 + 合并）

- [ ] **Step 1: 全量验证**

Run: `npx tsc --noEmit && npm run build && npx vitest run`
Expected: tsc 0、build exit 0、全量测试全过（在 1141 基础上 +Pr-T1 的 9 新用例，若旧 clarify-or-plan 测试存在则已被替换）。

- [ ] **Step 2: 终审**

Dispatch code-reviewer 审本期 diff（`intent-recognition.ts` export、`clarify-or-plan.ts` 重写、测试），按 spec 核对：决策由 prompt 出（无 confidence 门）、校验后空退回 clarify（不 fabricate）、错误向上抛、employeeName 回填、问候快路径。修真实问题，re-review 直到 ✅。

- [ ] **Step 3: 清理探针**

```bash
rm scripts/_im-chain-probe.ts
```
（探针是临时验证脚本，不入库。验证证据已记录在 Pr-T2 完成说明。）

- [ ] **Step 4: 端到端手测清单（交付用户）**

钉钉群重跑用户那条主线：
1. `帮我写点东西` → 应**澄清追问**（问主题/领域）。
2. 补 `写一篇AI行业的深度稿` → 应出**2-4 步真实计划卡**（含搜资料/撰写等，不是单句空话）。
3. `抓今天的科技热点` → 应直接**计划卡/执行**（不被误判澄清）。
4. 确认"开始"→ 正常起 mission。

- [ ] **Step 5: 合并回 main**

REQUIRED SUB-SKILL: `superpowers:finishing-a-development-branch`。全量过后 ff-merge `claude/im-planner-rebuild` → `main`，删分支。

---

## Remember
- 决策由 **prompt 显式判断**，不再读 confidence——这是修复的核心，别退回阈值逻辑。
- 校验后 steps 空 → **退回 clarify**，绝不像旧 recognizeIntent 那样 fabricate 空洞步骤。
- LLM 错误**向上抛**，gateway 兜"系统忙"；不在出错时 fabricate execute。
- 单测只证确定性解析/校验；prompt 质量靠探针 + workflow 评审证。两层都要。
- `recognizeIntent` 不动（对话中心仍用）；导出 3 个纯函数只加 export。
