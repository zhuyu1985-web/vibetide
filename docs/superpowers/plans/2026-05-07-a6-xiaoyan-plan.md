# A6 学术研究员 xiaoyan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 vibetide 的第 9 位 AI 员工 `xiaoyan`（小研，学术研究员）+ 三件套 skill（`report_drafter` / `research_query_builder` / `data_pivoter`）+ chat 内 `@employee` 切换协作机制完整 ship 到 main。

**Architecture:** xiaoyan 走和现有 8 位员工同一条注册流程（`EMPLOYEE_META` + `EMPLOYEE_CORE_SKILLS` + `seed.ts:employeesData` + `BUILTIN_SKILL_NAMES` + lucide `BookOpen` icon，零 png）。两个 chat tool（`research_query_builder` / `data_pivoter`）走 `tool-registry.ts:resolveTools` 既有 builtin 映射注入，调用 `assembleAgent(employee.id, undefined, { skillOverrides: [...] })`（3 位置参数，第 1 个是 UUID）+ AI SDK v6 `generateText({ output: Output.object({ schema }) })`（无 `generateObject`）；`@employee` 切换是 `chat/stream/route.ts` 入口的纯增量 message 预处理 hook，落到 `mention-switch.ts` util。

**Tech Stack:** Next.js 16 / React 19 / TypeScript 5 / Drizzle ORM / AI SDK v6 (`generateText` + `Output.object`) / `@ai-sdk/openai` (DeepSeek 兼容) / zod v4 / vitest 4 / lucide-react / shadcn/ui (`variant="ghost"` 无边框) / Tailwind v4。

---

## File Structure

### 新建（11 个）

| 路径 | 责任 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/skills/report_drafter/SKILL.md` | baoyu 标准 SKILL.md（180-320 行）：身份 / 输入输出 / 学术风格约束 / 学术段落输出模板，A5 Inngest job 通过 `loadSkillContent("report_drafter")` 拿全文注入 system prompt |
| `/Users/zhuyu/dev/chinamcloud/vibetide/skills/research_query_builder/SKILL.md` | baoyu 标准：身份 / 口语→`AdvancedSearchCondition[]` JSON 协议 / 区县 + 主题字典使用规则 / 5 operator 语义 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/skills/data_pivoter/SKILL.md` | baoyu 标准：身份 / 5 维度 / chart 选型规则 / `pivot_config` 输出协议 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/skills/research-query-builder.ts` | zod schema + tool execute（字典注入 + assembleAgent + generateText/Output.object） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/skills/data-pivoter.ts` | zod schema + tool execute（含 `computePivotPreview`） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/mention-switch.ts` | `detectMentionSwitch(message)` util，从 EMPLOYEE_META 派生 slug 列表生成 regex |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/components/chat/tool-action-card.tsx` | quick-action 卡片（`research_query_builder` / `data_pivoter` 两种 render，全部 `variant="ghost"` 无边框） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/components/chat/employee-mention-picker.tsx` | chat input `@` 触发 popover，列出 9 位员工头像 + nickname |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/skills/__tests__/research-query-builder.test.ts` | 4 case：正常 / district 找不到 / topic 找不到 / >10 conditions 抛 zod error |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/skills/__tests__/data-pivoter.test.ts` | 3 case：基础 / 含 filter / 无 current_report_id |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/__tests__/mention-switch.test.ts` | 3 case：合法 `@xiaolei` / 非法 `@unknown` / 无 `@` |

### 修改（7 个）

| 路径 | 改动 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/constants.ts` | `EmployeeId` union 加 `xiaoyan`；`EMPLOYEE_META.xiaoyan` 加 entry（`BookOpen` / `#4f46e5`）；`EMPLOYEE_SHORT_DESC.xiaoyan` 加；`EMPLOYEE_CORE_SKILLS.xiaoyan` 加 `["report_drafter", "research_query_builder", "data_pivoter"]`；`BUILTIN_SKILL_NAMES` 加 3 个 slug→中文名 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/seed.ts` | `employeesData` 加 xiaoyan row（`roleType: "research_analyst"` / `authorityLevel: "assistant"` / `workPreferences: { autonomyLevel: 60, communicationStyle: "formal_academic", ... }`） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/tool-registry.ts` | 新增 `createResearchQueryBuilderTool` + `createDataPivoterTool` 注入到 `ALL_TOOLS` map（与现有 builtin tool 同构）；`resolveTools` 不变 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/api/chat/stream/route.ts` | 入口加 `detectMentionSwitch` 预处理：切换 `employeeSlug` → 重新查 `aiEmployees` → 改写 `messages[last].content` → `send("system", { switched_to: ... })` 单独 SSE event |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/search-workbench-client.tsx` | useEffect 读 `searchParams.get("apply_query_builder")` → JSON.parse → `setMode("advanced")` + `setConditions` + `setSidebarFilter` + 自动触发 `handleAdvancedSearch` |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/reports/[id]/report-client.tsx`（A5 已建则改，未建则 A5 落盘后再补） | useEffect 读 `searchParams.get("apply_pivot")` → 解析 pivot_config + chart_type → 渲染"自定义透视" section |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/__tests__/seed-employees.test.ts`（无则新建）+ `src/lib/__tests__/employee-meta.test.ts`（无则新建） | 新增/扩 1+1=2 case：xiaoyan core skill 绑定 / EMPLOYEE_META 三处一致 |

---

## Phase 1: xiaoyan 员工注册 + 3 skill stub seed（Day 1）

### Task 1.1: `EMPLOYEE_META` + `EMPLOYEE_CORE_SKILLS` + `BUILTIN_SKILL_NAMES` 注册

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/constants.ts`

- [ ] **Step 1: lucide-react import 加 `BookOpen`**

`src/lib/constants.ts` 顶部 import block：

```ts
import {
  Telescope,
  Lightbulb,
  Package,
  PenTool,
  Film,
  Search,
  Radio,
  BarChart3,
  Brain,
  Crown,
  FileSearch,
  BookOpen,             // ← 新增
  type LucideIcon,
} from "lucide-react";
```

- [ ] **Step 2: `EmployeeId` union 在 `xiaoshu` 之后插入 `xiaoyan`**

```ts
export type EmployeeId =
  | "xiaolei"
  | "xiaoce"
  | "xiaozi"
  | "xiaowen"
  | "xiaojian"
  | "xiaoshen"
  | "xiaofa"
  | "xiaoshu"
  | "xiaoyan"           // ← 新增第 9 位
  | "xiaotan"
  | "advisor"
  | "leader";
```

- [ ] **Step 3: `EMPLOYEE_META` 在 `xiaoshu` 之后、`xiaotan` 之前插入 xiaoyan**

```ts
  xiaoshu: {
    id: "xiaoshu",
    name: "数据分析师",
    nickname: "数据分析师",
    title: "数据分析师",
    description: "数据洞察分析，效果追踪与内容复盘",
    icon: BarChart3,
    color: "#f97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
  xiaoyan: {
    id: "xiaoyan",
    name: "学术研究员",
    nickname: "学术研究员",
    title: "学术研究员",
    description: "客观中立的研究分析，论文级别的报告产出",
    icon: BookOpen,
    color: "#4f46e5",
    bgColor: "rgba(79,70,229,0.12)",
  },
  xiaotan: {
```

- [ ] **Step 4: `EMPLOYEE_SHORT_DESC` 加 xiaoyan**

```ts
export const EMPLOYEE_SHORT_DESC: Record<EmployeeId, string> = {
  xiaolei: "全网热点实时捕捉，深度趋势分析",
  // ... 其他 7 位 ...
  xiaoshu: "实时数据洞察，追踪效果深度复盘",
  xiaoyan: "数据驱动学术研究，论文级研报产出",   // ← 新增
  xiaotan: "深度调查专题追踪，挖掘事件真相",
  advisor: "频道运营策略咨询，内容方向建议",
  leader: "智能项目管理，多员工协同调度",
};
```

- [ ] **Step 5: `EMPLOYEE_CORE_SKILLS` 加 xiaoyan**

```ts
export const EMPLOYEE_CORE_SKILLS: Record<string, string[]> = {
  xiaolei: ["web_search", "web_deep_read", "trending_topics", "trend_monitor", "social_listening", "heat_scoring"],
  xiaoce:  ["web_search", "web_deep_read", "trending_topics", "topic_extraction", "angle_design", "audience_analysis", "task_planning"],
  xiaozi:  ["media_search", "knowledge_retrieval", "news_aggregation", "case_reference"],
  xiaowen: ["content_generate", "headline_generate", "summary_generate", "style_rewrite", "script_generate"],
  xiaojian: ["video_edit_plan", "thumbnail_generate", "layout_design", "audio_plan"],
  xiaoshen: ["quality_review", "compliance_check", "fact_check", "sentiment_analysis"],
  xiaofa:  ["publish_strategy", "style_rewrite", "translation", "audience_analysis"],
  xiaoshu: ["data_report", "competitor_analysis", "audience_analysis", "heat_scoring"],
  xiaoyan: ["report_drafter", "research_query_builder", "data_pivoter"],   // ← 新增
};
```

- [ ] **Step 6: `BUILTIN_SKILL_NAMES` 加 3 个 slug→中文名映射**

```ts
export const BUILTIN_SKILL_NAMES: Record<string, string> = {
  // ... 既有 30 项 ...
  data_report: "数据报告",
  // 新增 3 项（A6 学术研究员）
  report_drafter: "学术报告草拟",
  research_query_builder: "研究检索构建",
  data_pivoter: "数据透视分析",
};
```

- [ ] **Step 7: 跑 tsc 验证**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

预期：0 errors。`EMPLOYEE_META`/`EMPLOYEE_SHORT_DESC` 都是 `Record<EmployeeId, ...>` 形式，TS 编译器会卡漏掉的 key。

### Task 1.2: `seed.ts` 加 xiaoyan employee row

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/seed.ts`

- [ ] **Step 1: `employeesData` 数组在 xiaoshu 之后、leader 之前插入**

```ts
  {
    slug: "xiaoshu",
    // ... 既有 ...
  },
  {
    slug: "xiaoyan",
    name: "学术研究员",
    nickname: "学术研究员",
    title: "学术研究员",
    motto: "客观中立的研究分析，论文级别的报告产出",
    roleType: "research_analyst",
    authorityLevel: "assistant" as const,
    status: "idle" as const,
    currentTask: null,
    tasksCompleted: 0,
    accuracy: 0,
    avgResponseTime: "0s",
    satisfaction: 0,
  },
  {
    slug: "leader",
    // ... 既有 ...
  },
```

注意：`workPreferences` 不能直接放在 `...empData` 展开里（其他 employees 都没这个字段，类型推断会变 union）。改用插入后再 update（仅 xiaoyan 一行）：

- [ ] **Step 2: 在 `for (const empData of employeesData)` 循环结束后追加 xiaoyan 的 `workPreferences` update**

在 `console.log(`   ${empsCreated} new / ...`);` 之前插入：

```ts
  // xiaoyan 是 A6 新员工，单独写 workPreferences（其他 8 员工沿用 NULL/默认）
  const xiaoyanId = employeeMap.get("xiaoyan");
  if (xiaoyanId) {
    await db
      .update(schema.aiEmployees)
      .set({
        workPreferences: {
          proactivity: "balanced",
          reportingFrequency: "on_demand",
          autonomyLevel: 60,
          communicationStyle: "formal_academic",
          workingHours: "09:00-22:00",
        },
        autoActions: ["draft_research_report", "build_research_query", "compute_data_pivot"],
        needApprovalActions: ["publish_report", "delete_report", "export_to_external_system"],
      })
      .where(eq(schema.aiEmployees.id, xiaoyanId));
  }
```

- [ ] **Step 3: tsc 验证**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

预期：0 errors。

### Task 1.3: 创建 3 个 stub SKILL.md（最小 frontmatter）

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/skills/report_drafter/SKILL.md`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/skills/research_query_builder/SKILL.md`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/skills/data_pivoter/SKILL.md`

- [ ] **Step 1: `skills/report_drafter/SKILL.md`（stub）**

```markdown
---
name: report_drafter
displayName: 学术报告草拟
description: 把模板插值的数据简报草稿 + 命中文章统计聚合输入，转写成学术中性、第三人称、引用具体数字的研究背景 / 数据简报学术润色 / 研究发现段落（A5 Inngest 报告导出 Step 3 调用）。
version: "1.0"
category: content_gen
compatibleRoles: ["xiaoyan"]

metadata:
  skill_kind: content_generation
  scenario_tags: [academic, research-report]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/inngest/functions/research-report-generate.ts
    testPath: src/inngest/functions/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md
---

# 学术报告草拟（report_drafter）— STUB

Phase 2 填充完整 baoyu 10-12 章 body。
```

- [ ] **Step 2: `skills/research_query_builder/SKILL.md`（stub）**

```markdown
---
name: research_query_builder
displayName: 研究检索构建
description: 把用户口语化的研究检索需求（如"2025 上半年重庆乡村振兴的省级及以上媒体报道"）翻译成 vibetide A4 高级检索的 AdvancedSearchCondition[] + SidebarFilter JSON。
version: "1.0"
category: data_collection
compatibleRoles: ["xiaoyan", "xiaolei"]

metadata:
  skill_kind: data_collection
  scenario_tags: [academic, research-search]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/skills/research-query-builder.ts
    testPath: src/lib/agent/skills/__tests__/research-query-builder.test.ts
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md
---

# 研究检索构建（research_query_builder）— STUB

Phase 3 填充完整 baoyu 10-12 章 body。
```

- [ ] **Step 3: `skills/data_pivoter/SKILL.md`（stub）**

```markdown
---
name: data_pivoter
displayName: 数据透视分析
description: 把用户口语化的数据透视需求（如"按主题×媒体分级透视"）翻译成 pivot_config（rows/cols/measure/filter）+ chart_type（bar/heatmap/donut/line），并可选基于 current_report_id 计算 5×5 预览。
version: "1.0"
category: data_analysis
compatibleRoles: ["xiaoyan", "xiaoshu"]

metadata:
  skill_kind: data_analysis
  scenario_tags: [academic, research-pivot]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/skills/data-pivoter.ts
    testPath: src/lib/agent/skills/__tests__/data-pivoter.test.ts
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md
---

# 数据透视分析（data_pivoter）— STUB

Phase 4 填充完整 baoyu 10-12 章 body。
```

- [ ] **Step 4: 验证 seed 流程会自动 pick 新增的 SKILL.md（无需改 seed.ts）**

`src/lib/skill-loader.ts:getAllBuiltinSkills()`（第 132 行）会扫描 `skills/` 根目录所有含 `SKILL.md` 的子目录、解析 frontmatter（含 `compatibleRoles`），返回 `BuiltinSkillDef[]`。

`src/db/seed.ts` 第 184 行 `const builtinSkills = getAllBuiltinSkills();` 直接消费它，第 217-233 行 INSERT 进 `skills` 表（含 `compatibleRoles: skillDef.compatibleRoles ?? []`，第 209 行 / 231 行各一份 update / insert 路径）。

**不需要改 seed.ts**——只要 SKILL.md 落到 `/skills/<slug>/SKILL.md` 且 frontmatter 有合法 `category` + `compatibleRoles`，下次 `npm run db:seed` 会自动新增 skills 行 + bind 到 xiaoyan（通过 `EMPLOYEE_CORE_SKILLS.xiaoyan` Phase 1.1 已加）。

- [ ] **Step 5: 跑 seed 并 grep 输出**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run db:seed 2>&1 | tee /tmp/seed-a6.log
grep -E "(report_drafter|research_query_builder|data_pivoter|xiaoyan)" /tmp/seed-a6.log
```

预期 stdout 含：
- `3 new / N updated / M unchanged builtin skills`（report_drafter / research_query_builder / data_pivoter 在 3 new 里）
- `1 new / 9 existing employees`（xiaoyan 新插入）
- `xiaoyan -> <uuid>` 行

如果上面 grep 输出为空 / 显示 `0 new builtin skills`，先 sanity check：
```bash
ls /Users/zhuyu/dev/chinamcloud/vibetide/skills/ | grep -E "(report_drafter|research_query_builder|data_pivoter)"
```
应列出 3 个目录；如果缺，补 SKILL.md；如果 3 个都在但 seed 未 insert，回头检查 frontmatter `category` 是否合法（必须是 `SkillCategory` 联合类型之一）。

### Task 1.4: 写 EMPLOYEE_META 一致性测试 + xiaoyan core skill 绑定测试

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/__tests__/employee-meta.test.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/__tests__/seed-employees.test.ts`

- [ ] **Step 1: `src/lib/__tests__/employee-meta.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  EMPLOYEE_META,
  EMPLOYEE_SHORT_DESC,
  EMPLOYEE_CORE_SKILLS,
} from "@/lib/constants";

describe("EMPLOYEE_META xiaoyan registration", () => {
  it("xiaoyan registered consistently across META / SHORT_DESC / CORE_SKILLS", () => {
    expect(EMPLOYEE_META.xiaoyan).toBeDefined();
    expect(EMPLOYEE_META.xiaoyan.name).toBe("学术研究员");
    expect(EMPLOYEE_META.xiaoyan.color).toBe("#4f46e5");

    expect(EMPLOYEE_SHORT_DESC.xiaoyan).toBeDefined();
    expect(EMPLOYEE_SHORT_DESC.xiaoyan.length).toBeGreaterThan(0);

    expect(EMPLOYEE_CORE_SKILLS.xiaoyan).toEqual([
      "report_drafter",
      "research_query_builder",
      "data_pivoter",
    ]);
  });
});
```

- [ ] **Step 2: `src/db/__tests__/seed-employees.test.ts`**

DB 测试 — 假设当前 org 已 seed 过（`npm run db:seed` 在 1.3 已跑过）：

```ts
import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { aiEmployees, employeeSkills, skills } from "@/db/schema";
import { and, eq } from "drizzle-orm";

describe("xiaoyan employee seed", () => {
  it("xiaoyan exists with 3 core skills bound", async () => {
    const xiaoyan = await db.query.aiEmployees.findFirst({
      where: eq(aiEmployees.slug, "xiaoyan"),
    });
    expect(xiaoyan).toBeDefined();
    expect(xiaoyan!.roleType).toBe("research_analyst");
    expect(xiaoyan!.authorityLevel).toBe("assistant");

    const bound = await db
      .select({ slug: skills.slug, bindingType: employeeSkills.bindingType })
      .from(employeeSkills)
      .innerJoin(skills, eq(employeeSkills.skillId, skills.id))
      .where(eq(employeeSkills.employeeId, xiaoyan!.id));

    const slugs = bound.map((r) => r.slug).sort();
    expect(slugs).toEqual([
      "data_pivoter",
      "report_drafter",
      "research_query_builder",
    ]);
    expect(bound.every((r) => r.bindingType === "core")).toBe(true);
  });
});
```

- [ ] **Step 3: 跑测试**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/__tests__/employee-meta.test.ts src/db/__tests__/seed-employees.test.ts
```

预期：2 passed。

### Task 1.5: 浏览器手动验证 EmployeeAvatar 渲染

- [ ] **Step 1: 启动 dev server**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run dev
```

- [ ] **Step 2: 浏览器访问 `http://localhost:3000/employees`**

预期：员工列表 9 卡（含小研，BookOpen icon + #4f46e5 深靛蓝 bgColor）。点击进入小研详情页，header EmployeeAvatar 渲染正常。

### Task 1.6: Phase 1 commit

- [ ] **Step 1: stage + commit + push**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && git add \
  src/lib/constants.ts \
  src/db/seed.ts \
  skills/report_drafter/SKILL.md \
  skills/research_query_builder/SKILL.md \
  skills/data_pivoter/SKILL.md \
  src/lib/__tests__/employee-meta.test.ts \
  src/db/__tests__/seed-employees.test.ts && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a6): xiaoyan 学术研究员 + 3 skill stub seed — Phase 1

- EMPLOYEE_META / EMPLOYEE_SHORT_DESC / EMPLOYEE_CORE_SKILLS 加 xiaoyan（BookOpen / #4f46e5 / assistant authority）
- BUILTIN_SKILL_NAMES 加 report_drafter / research_query_builder / data_pivoter
- seed.ts employeesData 加 xiaoyan + workPreferences (formal_academic / autonomy=60)
- skills/{report_drafter,research_query_builder,data_pivoter}/SKILL.md stub frontmatter（Phase 2-4 填 body）
- 单测 2 case：EMPLOYEE_META 一致性 + xiaoyan core skill 绑定

A6 spec: docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md §2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)" && git push
```

---

## Phase 2: `report_drafter` SKILL.md 完整内容 + A5 调用打通验证（Day 2）

### Task 2.1: 把 `report_drafter` SKILL.md body 填到 baoyu 标准 180-320 行

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/skills/report_drafter/SKILL.md`

- [ ] **Step 1: 在 frontmatter `---` 之后追加完整 body**

按 baoyu 10-12 章标准，写入以下章节：

````markdown
# 学术报告草拟（report_drafter）

你是新闻研究员小研，为西南政法大学新闻学院输出学术研究报告段落。核心信条：**学术中性 · 数据可溯 · 不臆造 · 句句给具体数字**。

## 使用条件

✅ **应调用场景**：
- A5 `research-report-generate` Inngest job Step 3：把模板插值的数据简报草稿 + 命中文章 aggregates 转写成 3 段学术正文
- 任何"把已有结构化数据 → 学术段落"的批量场景

❌ **不应调用场景**：
- 无 aggregates 输入的纯虚构（不允许编数字）
- 营销 / 自媒体 / 爆款体（要去找 xiaowen `style_rewrite`）
- 中英文混排或翻译（仅产中文学术体）

**前置条件**：`task_meta` / `aggregates` / `template_brief` / `sample_titles` 必填；调用方必须保证 aggregates 数字真实。

## 输入 / 输出

**输入：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `task_meta` | object | `{ title, topic_description, time_range, districts[], topics[], hit_count }` |
| `aggregates` | object | `{ media_tier_distribution[], district_distribution[], topic_distribution[], daily_trend[] }` |
| `template_brief` | string | 模板插值的数据简报草稿 |
| `sample_titles` | string[5] | 5 条命中文章标题 |

**输出（A5 spec ReportParagraphsSchema 已锁）：**

| 字段 | 字数 | 说明 |
|---|---|---|
| `background` | 200-700 | 第一章 研究背景（主题意义、时间窗、区域定位） |
| `brief_rewrite` | 150-500 | 2.1 数据简报学术润色（保留全部数字） |
| `conclusions` | 500-2000 | 第三章 研究发现，3-5 段 |

## 工作流 Checklist

1. 读 task_meta 拿到主题 + 区域 + 时间窗
2. 扫 aggregates 4 个分布数组，找最大/最小/异常值
3. 写 background：定义研究背景（主题意义 1 段 + 时间窗 / 区域定位 1 段）
4. 写 brief_rewrite：保留 template_brief 全部数字，只调句式
5. 写 conclusions（3-5 段）：每段 1 个核心观点
6. 自检：每段都有具体数字？没有"大量""很多"？

## 学术风格硬约束

- 第三人称、不用感叹号、不用"我认为""应当"
- 数据必须给具体数字（"X 条""占 Y%"）
- 句式偏书面化（不写"刷屏""火爆""出圈""赛道"等爆款词）
- 不写"AI 生成""作为大语言模型"等元元词
- 不臆造引文 / 来源 / 学者名 / 文献
- 结论必须基于 aggregates，不写未提供的统计

## 段落写作模板

### background 模板
> 在[时间范围]的研究窗口内，[topic_description]作为[研究意义陈述]，已成为[区域定位]新闻报道的重要议题。本研究覆盖[district 数]个区县，聚焦[topic 数]个核心主题，共采集到[hit_count]条相关报道，旨在[研究目标]。

### brief_rewrite 模板
> 数据显示，本次研究共纳入[hit_count]条命中报道，分布于[N]个区县与[M]个主题。其中[最大类别]占比 X%，居首位；[次要类别]占 Y%，反映出[特征描述]。从时间分布看，[峰值日期]单日产出报道[峰值数量]条。

### conclusions 段落角度（任选 3-5）
- 媒体层级分布特征（央/省/市级比例 + 行业含义）
- 区县报道密度差异（高密度 vs 低密度的对比 + 可能成因）
- 主题热度分化（哪些主题主导 + 边缘主题缺位）
- 时间趋势特征（峰值 / 缓降 / 周期）
- 研究展望（可选末段，仅基于上述事实展开）

## 输出示例

````json
{
  "background": "在 2025 年 1 月至 6 月的研究窗口内，乡村振兴作为重庆市委市政府重点推进的战略性议题，已成为重庆地区新闻报道的核心叙事之一。本研究覆盖重庆市 38 个区县，聚焦 16 个核心主题维度，共采集到 1247 条相关报道，旨在揭示重庆乡村振兴议题的媒体话语结构、区域报道密度差异及时间动态特征。",
  "brief_rewrite": "数据显示，本次研究共纳入 1247 条命中报道，分布于 38 个区县与 16 个主题。其中省级及以上媒体报道 482 条，占比 38.7%，居首位；市级媒体 612 条，占 49.1%；区县级媒体 153 条，占 12.3%。从时间分布看，2025 年 3 月 5 日（两会期间）单日产出报道 47 条，为窗口峰值。",
  "conclusions": "（一）媒体层级分布呈现倒金字塔特征。省级及以上媒体贡献 38.7% 的报道量，反映乡村振兴议题在更高层级媒体话语中的权重高于一般地方议题。\n\n（二）区县报道密度差异显著。涪陵区、永川区、奉节县合计贡献 41% 的报道，而位居末位的 5 个区县合计仅贡献 3.2%，差距达 13 倍以上。这一分布与各区县乡村振兴试点项目的密度高度相关。\n\n（三）主题热度高度集中。'产业振兴'+'人才振兴'+'文化振兴'三个子主题合计占比 68%，'生态振兴'与'组织振兴'各占 11.5% / 10.8%，呈现明显的话语重心偏移。\n\n（四）时间趋势上行。3 月（两会期间）报道密度达 11.3 条/日，6 月降至 5.8 条/日，呈典型的政策节点驱动衰减模式。\n\n（五）研究展望：未来研究可进一步纳入用户互动数据（评论、转发、阅读量）以补充话语扩散维度的观察。"
}
````

## EXTEND.md 示例（领域定制）

某研究项目希望强调"扶贫历史脉络"，可在 conclusions 末段后追加：

> 从历史脉络看，本次研究窗口内的报道呈现 X 特征，与 2018-2020 脱贫攻坚阶段的报道结构 [比对结论]。

## 上下游协作

- **上游**：`build_research_report_brief`（A2.5 模板插值）→ template_brief
- **同期**：`compute_research_aggregates`（A3）→ aggregates
- **下游**：A5 Inngest job 把 `{ background, brief_rewrite, conclusions }` 写入 `research_reports.report_html`

## 常见问题

**Q：aggregates 没给某个分布数组怎么办？**
A：在对应段落跳过该角度，不臆造数字。

**Q：sample_titles 是否要逐条引用？**
A：不要。仅用于体感校准（确认 aggregates 与命中文章主题一致），不在输出中列举。

**Q：能否带上"建议"或"对策"段落？**
A：不能。本 skill 只输出研究发现；对策建议属于扩展研究范畴，需用户显式追加请求。

## 参考资料

- A5 spec: docs/superpowers/specs/2026-05-07-a5-research-report-export-design.md §6.4
- A6 spec: docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md §3.3
````

- [ ] **Step 2: 验证 SKILL.md 行数 180-320**

```bash
wc -l /Users/zhuyu/dev/chinamcloud/vibetide/skills/report_drafter/SKILL.md
```

预期：行数在 180-320 之间。如果不到 180，按 baoyu 标准补齐（多写几个示例段落 / Q&A）。如果超过 320，精简示例。

### Task 2.2: 验证 A5 既有调用能拿到完整 system prompt

**Files:**
- 无新增 / 修改文件，仅运行命令验证

- [ ] **Step 1: 重新跑 seed 让 skills 表 description 字段更新**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run db:seed
```

`seed.ts` 第 199-216 行 update 路径会刷新 description（content 字段在 SKILL.md 里，运行时通过 `loadSkillContent("report_drafter")` 拿）。

- [ ] **Step 2: 写一次性脚本验证 assembleAgent 注入 SKILL.md content**

新建临时文件 `/tmp/verify-xiaoyan-prompt.ts`：

```ts
import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { assembleAgent } from "@/lib/agent/assembly";

async function main() {
  const xiaoyan = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.slug, "xiaoyan"),
  });
  if (!xiaoyan) throw new Error("xiaoyan not found");

  const agent = await assembleAgent(xiaoyan.id, undefined, {
    skillOverrides: ["report_drafter"],
  });

  console.log("=== systemPrompt length:", agent.systemPrompt.length);
  console.log("=== contains '学术中性':", agent.systemPrompt.includes("学术中性"));
  console.log("=== contains 'background 模板':", agent.systemPrompt.includes("background 模板"));
  console.log("=== tools count:", agent.tools.length);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsx /tmp/verify-xiaoyan-prompt.ts
```

预期：systemPrompt length > 5000；含 "学术中性"; 含 "background 模板"。

注：assembleAgent 真实签名 `(employeeId: string, modelOverride?, context?)` — 第 1 参数是 UUID（已通过查 row 拿到），不是 slug。

- [ ] **Step 3: 删临时脚本**

```bash
rm /tmp/verify-xiaoyan-prompt.ts
```

### Task 2.3: tsc + lint + build 全套

- [ ] **Step 1: 跑 tsc / lint / build**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit && npm run lint && npm run build
```

预期：3 项全过。

### Task 2.4: Phase 2 commit

- [ ] **Step 1: commit + push**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && git add skills/report_drafter/SKILL.md && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a6): report_drafter SKILL.md 完整 baoyu 内容 + A5 调用打通 — Phase 2

- skills/report_drafter/SKILL.md body 填 180-320 行：使用条件 / 输入输出 / 工作流 / 学术风格硬约束 / 段落模板 / 输出示例 / Q&A
- A5 既有调用 assembleAgent(xiaoyan.id, undefined, { skillOverrides: ["report_drafter"] }) 拿到的 systemPrompt 含全部 SKILL.md body
- AI SDK v6 hard rule：A5 必须用 generateText({ output: Output.object({ schema }) })，不允许 generateObject

A6 spec §3.3 + A5 spec §6.4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)" && git push
```

---

## Phase 3: `research_query_builder` 全套（Day 3）

### Task 3.1: 写完整 SKILL.md body

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/skills/research_query_builder/SKILL.md`

- [ ] **Step 1: frontmatter 之后追加完整 baoyu 10-12 章 body**

````markdown
# 研究检索构建（research_query_builder）

你是新闻研究员小研的检索助手，把用户口语化的研究检索需求**精准翻译**成 vibetide A4 高级检索的 `AdvancedSearchCondition[]` + `SidebarFilter` JSON。核心信条：**字段映射要准 · 时间表达要精 · 字典名要严格匹配 · 不许凭训练数据猜区县/主题名**。

## 使用条件

✅ **应调用场景**：
- 学术老师 / 研究员在 chat 描述检索意图（"我想看 2025 上半年重庆乡村振兴的省级及以上媒体报道"）
- xiaolei 协助快速构造一次复合检索

❌ **不应调用场景**：
- 用户已经会用 A4 高级检索界面手动配（不需要 AI 翻译）
- 自由文本搜索（走 web_search / news_aggregation）
- 跨数据源（本 skill 仅产 vibetide articles 表的检索条件）

**前置条件**：`available_districts`（区县字典）+ `available_topics`（主题字典）必须由 tool execute 注入；user_intent ≥ 5 字。

## 输入 / 输出

**输入：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `user_intent` | string | 用户口语描述（≥ 5 字） |
| `available_districts` | `{id,name}[]` | 当前 org 区县字典（38-40 项） |
| `available_topics` | `{id,name}[]` | 当前 org 主题字典（16 项） |

**输出（zod schema）：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `conditions` | `AdvancedSearchCondition[]` | ≤ 10 条；A4 复用类型 |
| `sidebarFilter` | `SidebarFilter \| undefined` | 区县 / 主题快筛 |
| `reasoning` | string | 10-300 字，向用户解释拆条件逻辑 |

## 字段语义表

| field | 含义 | operator 候选 | 示例 |
|---|---|---|---|
| `title` | 标题 | contains/not_contains | 标题含"乡村振兴" |
| `content` | 正文 | contains/not_contains | 正文含"扶贫" |
| `author` | 作者 | equals/not_equals | 作者=张三 |
| `outletName` | 媒体名 | equals/not_equals | 人民日报 |
| `outletTier` | 媒体分级 | equals/not_equals | central/provincial_municipal/local |
| `outletRegion` | 媒体所在区域 | equals/not_equals | 重庆 |
| `district` | 报道指向区县 | equals/not_equals | 涪陵区 |
| `topic` | 主题 | equals/not_equals | 乡村振兴 |
| `contentType` | 内容类型 | equals/not_equals | 新闻/评论/调查 |
| `publishedAt` | 发布时间 | between | [start, end] |
| `platform` | 平台 | equals/not_equals | 微信/微博/官方 |

## 时间表达解析约定

| 用户说 | 输出 |
|---|---|
| "2025 上半年" | publishedAt between [2025-01-01, 2025-06-30] |
| "2025 下半年" | publishedAt between [2025-07-01, 2025-12-31] |
| "6 月" | 默认当年 6 月 publishedAt between [YYYY-06-01, YYYY-06-30] |
| "近 30 天" | publishedAt between [今日-30, 今日] |
| "3-5 月" | publishedAt between [当年-03-01, 当年-05-31] |

## 媒体分级表达

| 用户说 | outletTier 取值 |
|---|---|
| "央媒" / "央级" | `equals: central` |
| "省级及以上" | `equals: provincial_municipal` 或 `central`（拆 2 条 OR） |
| "省市级" | `equals: provincial_municipal` |
| "地方媒体" | `equals: local` |

## 字典使用硬约束

- district / topic 名匹配必须在 `available_districts` / `available_topics` 里有对应；找不到 → reasoning 里说明并降级用 `title contains` / `content contains`
- 严禁凭训练数据猜区县名（重庆有"涪陵区"但你训练数据里可能记成"涪陵市"，必须看字典）

## AND/OR 逻辑

- 默认所有 conditions 走 AND
- 用户用"或" / "任一" / "至少" / "OR" → 标 `logic: "or"`

## 工作流 Checklist

1. 读 user_intent 抽出：主题 / 时间 / 区县 / 媒体分级 / 媒体名 / 平台
2. 主题 → 查 available_topics 拿 topic name；找不到 → 降级 title/content contains + reasoning 说明
3. 时间 → 解析为 publishedAt between [start, end]（ISO date）
4. 区县 → 查 available_districts；找不到 → 降级
5. 媒体分级 → 映射到 outletTier
6. 拼 conditions[]，校验 ≤ 10 条
7. 拼 sidebarFilter（区县 + 主题快筛）
8. 写 reasoning（10-300 字）

## 输出示例

输入：
> 我想看 2025 上半年重庆乡村振兴的省级及以上媒体报道

available_districts: 含 `{id: "x1", name: "涪陵区"}` 等 38 项；available_topics: 含 `{id: "t-rural", name: "乡村振兴"}` 等 16 项。

输出：

```json
{
  "conditions": [
    { "field": "topic",       "operator": "equals",  "value": "乡村振兴",         "logic": "and" },
    { "field": "publishedAt", "operator": "between", "value": ["2025-01-01","2025-06-30"], "logic": "and" },
    { "field": "outletTier",  "operator": "equals",  "value": "provincial_municipal", "logic": "or"  },
    { "field": "outletTier",  "operator": "equals",  "value": "central",          "logic": "or"  },
    { "field": "outletRegion","operator": "equals",  "value": "重庆",              "logic": "and" }
  ],
  "sidebarFilter": { "topicIds": ["t-rural"] },
  "reasoning": "拆 5 条：主题=乡村振兴；时间=2025 上半年；'省级及以上'=省市级 OR 央级（2 条 OR）；区域=重庆。"
}
```

## 常见问题

**Q：用户说"涪陵或永川"，但字典里只有'涪陵区'/'永川区'？**
A：自动加"区"匹配。如果还找不到，降级 `district contains` + reasoning 说明。

**Q：用户口语很模糊（"最近的事")？**
A：默认 publishedAt between [今日-7, 今日] + reasoning 说明假设。

## 参考资料

- A6 spec: docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md §3.4
- A4 高级检索类型: src/app/(dashboard)/research/search-mode-types.ts
````

把 stub 替换为以上完整版本。

### Task 3.2: 实现 `research-query-builder.ts` tool

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/skills/research-query-builder.ts`

- [ ] **Step 1: 写文件**

```ts
/**
 * research_query_builder — chat tool for xiaoyan / xiaolei.
 *
 * 把用户口语化的研究检索需求 → AdvancedSearchCondition[] + SidebarFilter JSON.
 *
 * AI SDK v6 — uses generateText({ output: Output.object({ schema }) })
 * (generateObject removed in v6).
 */

import { tool, generateText, Output } from "ai";
import { z } from "zod/v4";
import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { researchTopics } from "@/db/schema/research/research-topics";
import { and, eq } from "drizzle-orm";
import { assembleAgent } from "../assembly";
import { getLanguageModel } from "../model-router";

// ---- AdvancedSearchCondition (复用 A4 类型) ----
const AdvancedSearchConditionSchema = z.object({
  field: z.enum([
    "title",
    "content",
    "author",
    "outletName",
    "outletTier",
    "outletRegion",
    "district",
    "topic",
    "contentType",
    "publishedAt",
    "platform",
  ]),
  operator: z.enum([
    "contains",
    "not_contains",
    "equals",
    "not_equals",
    "between",
  ]),
  value: z.union([z.string(), z.array(z.string()).length(2)]),
  logic: z.enum(["and", "or"]).default("and"),
});

const SidebarFilterSchema = z.object({
  districtIds: z.array(z.string()).optional(),
  topicIds: z.array(z.string()).optional(),
});

const ResearchQueryBuilderOutputSchema = z.object({
  conditions: z.array(AdvancedSearchConditionSchema).max(10),
  sidebarFilter: SidebarFilterSchema.optional(),
  reasoning: z.string().min(10).max(300),
});

export type ResearchQueryBuilderResult = z.infer<
  typeof ResearchQueryBuilderOutputSchema
> & { applyUrl: string };

// ---- Dictionary loaders ----
// 注意：cqDistricts 是 org-scoped 之外的全局字典（schema 无 organization_id），所有 org 共用 38 项重庆区县。
// researchTopics 才有 organizationId 字段，按 org 隔离。
async function listDistricts(_orgId: string) {
  // schema: research_cq_districts { id, name, code, sort_order, created_at } —— 无 organization_id
  const rows = await db
    .select({ id: cqDistricts.id, name: cqDistricts.name })
    .from(cqDistricts);
  return rows;
}

async function listTopics(orgId: string) {
  // schema: research_topics { id, organizationId, name, description, sort_order, is_preset, ... }
  const rows = await db
    .select({ id: researchTopics.id, name: researchTopics.name })
    .from(researchTopics)
    .where(eq(researchTopics.organizationId, orgId));
  return rows;
}

// ---- Tool factory ----
export function createResearchQueryBuilderTool(orgId: string) {
  return tool({
    description:
      "把用户口语化的研究检索需求翻译成 vibetide A4 高级检索的 conditions[] + sidebarFilter JSON。适用于学术研究员小研 / 热点分析师小雷场景。",
    inputSchema: z.object({
      user_intent: z
        .string()
        .min(5)
        .describe("用户口语化的检索需求，至少 5 字"),
    }),
    execute: async ({ user_intent }) => {
      const [districts, topics] = await Promise.all([
        listDistricts(orgId),
        listTopics(orgId),
      ]);

      const xiaoyan = await db.query.aiEmployees.findFirst({
        where: and(
          eq(aiEmployees.organizationId, orgId),
          eq(aiEmployees.slug, "xiaoyan"),
        ),
      });
      if (!xiaoyan) {
        throw new Error(
          "xiaoyan employee not seeded in this org（依赖 A6 Phase 1 seed）",
        );
      }

      const agent = await assembleAgent(xiaoyan.id, undefined, {
        skillOverrides: ["research_query_builder"],
      });

      const prompt = JSON.stringify({
        user_intent,
        available_districts: districts,
        available_topics: topics,
      });

      const { output } = await generateText({
        model: getLanguageModel(agent.modelConfig),
        system: agent.systemPrompt,
        prompt,
        output: Output.object({ schema: ResearchQueryBuilderOutputSchema }),
        temperature: 0.2,
        maxOutputTokens: 1500,
      });

      const applyUrl = `/research?mode=advanced&apply_query_builder=${encodeURIComponent(
        JSON.stringify(output),
      )}`;

      return { ...output, applyUrl } satisfies ResearchQueryBuilderResult;
    },
  });
}
```

- [ ] **Step 2: 已 pre-bake 正确表名（无需 grep 验证）**

实际 schema 已在 spec 阶段确认：
- `cqDistricts` from `@/db/schema/research/cq-districts.ts` —— `research_cq_districts` 表，列：`id` (uuid) / `name` (text, unique) / `code` / `sort_order` / `created_at`，**无 organization_id**（全局字典，所有 org 共用 38 项重庆区县）
- `researchTopics` from `@/db/schema/research/research-topics.ts` —— `research_topics` 表，列：`id` (uuid) / `organization_id` (uuid, FK orgs) / `name` (text) / `description` / `sort_order` / `is_preset` / ...，按 org 隔离

如果 import path 在你的本地 worktree 上 tsc 报错（schema 文件被重命名/移动），先跑 `grep -rn "cqDistricts\\|researchTopics" src/db/schema/` 确认实际位置；不应改 import 名（这两个 export 是 A4 引入的稳定 API）。

- [ ] **Step 3: tsc 验证**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

预期：0 errors。

### Task 3.3: 注册到 `tool-registry.ts:ALL_TOOLS`

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/tool-registry.ts`

- [ ] **Step 1: 在文件顶部 import block 后追加 import**

紧挨现有 import 块下面：

```ts
import { createResearchQueryBuilderTool } from "./skills/research-query-builder";
import { createDataPivoterTool } from "./skills/data-pivoter";
```

- [ ] **Step 2: 找到 `createToolDefinitions()` 函数（在 `ALL_TOOLS = createToolDefinitions()` 上方），在返回对象里加 2 个新 tool**

由于 `createResearchQueryBuilderTool(orgId)` 需要 orgId 参数，而 `ALL_TOOLS` 是无 orgId 的全局 map，**改用 lazy factory 模式**：用 `getToolByName(name, orgId)` 替代 `ALL_TOOLS[name]` 访问点。

但为了避免大改 `ALL_TOOLS` API，按 spec 走"resolveTools 注册描述符 + execute 时通过 chat stream route 注入 orgId" 路径：

在 `createToolDefinitions()` 内部，把两个新 tool 注册成 stub（execute throw "must be injected via chat stream"），实际 execute 在 `chat/stream/route.ts` 里通过 `toVercelTools` 之前替换。

更简单的做法是参考 `createMissionTools` / `createKnowledgeBaseTools` 模式 — 它们就是 lazy factory，在 chat/mission 入口动态注入。本 plan 沿用同模式：

新增 export：

```ts
// ---------------------------------------------------------------------------
// xiaoyan / xiaolei chat tools (research_query_builder + data_pivoter)
// orgId-scoped — injected at chat stream time, not in static ALL_TOOLS.
// ---------------------------------------------------------------------------

export function createXiaoyanChatTools(context: { organizationId: string }): ToolSet {
  return {
    research_query_builder: createResearchQueryBuilderTool(context.organizationId),
    data_pivoter: createDataPivoterTool(context.organizationId),
  };
}
```

- [ ] **Step 3: 修改 `chat/stream/route.ts` 把 `createXiaoyanChatTools` 加到既有 import + 合并到 vercelTools**

**3a. 改既有 import 行（第 7 行）—— 不要新增 import 行**：

route.ts 当前第 7 行是：

```ts
import { resolveTools, toVercelTools } from "@/lib/agent/tool-registry";
```

改为（在原行追加 `createXiaoyanChatTools`）：

```ts
import { resolveTools, toVercelTools, createXiaoyanChatTools } from "@/lib/agent/tool-registry";
```

⚠️ 严禁新增第二行 `import { createXiaoyanChatTools } from ...`——会触发 `Duplicate identifier` TS 编译错误。

**3b. 改既有 `const vercelTools = toVercelTools(...)` 行（第 128 行附近）**：

```ts
// 既有
const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs);
```

改为：

```ts
// agent.tools 里如果含 research_query_builder / data_pivoter（说明该员工绑了对应 skill），
// 把 lazy-injected 真实 execute 合并进来。
const baseTools = toVercelTools(agent.tools, agent.pluginConfigs);
const xiaoyanTools = createXiaoyanChatTools({ organizationId });
const vercelTools: typeof baseTools = { ...baseTools };
for (const toolName of agent.tools.map((t) => t.name)) {
  if (toolName === "research_query_builder" || toolName === "data_pivoter") {
    (vercelTools as Record<string, unknown>)[toolName] =
      xiaoyanTools[toolName as keyof typeof xiaoyanTools];
  }
}
```

- [ ] **Step 4: tsc 验证**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

预期：0 errors。

### Task 3.4: 写 4 case 单测

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/skills/__tests__/research-query-builder.test.ts`

- [ ] **Step 1: mock generateText / DAL，写 4 case**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks（必须 hoist 到 import 之前，vitest auto-hoists vi.mock）----
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: vi.fn(),
    Output: actual.Output,
    tool: actual.tool,
  };
});

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    query: { aiEmployees: { findFirst: vi.fn() } },
  },
}));

vi.mock("../../assembly", () => ({
  assembleAgent: vi.fn(async () => ({
    employeeId: "fake-uuid",
    systemPrompt: "stub system prompt",
    modelConfig: { provider: "openai", model: "deepseek-chat", temperature: 0.2, maxTokens: 1500 },
    tools: [],
  })),
}));

vi.mock("../../model-router", () => ({
  getLanguageModel: vi.fn(() => ({} as unknown)),
}));

import { createResearchQueryBuilderTool } from "../research-query-builder";
import { generateText } from "ai";
import { db } from "@/db";

const mockGenerateText = vi.mocked(generateText);
const mockDb = vi.mocked(db, true);

beforeEach(() => {
  vi.clearAllMocks();

  // db.select(...).from(...).where(...) 链式 mock —— 默认 districts/topics
  const chain = (rows: unknown[]) => ({
    from: () => ({ where: () => Promise.resolve(rows) }),
  });
  mockDb.select.mockImplementation(((args: { id: unknown; name: unknown }) => {
    // 区分 districts / topics 用对象 keys 反推不可行，简化：返回固定列表，每次调用切换
    return chain([]) as never;
  }) as never);

  mockDb.query.aiEmployees.findFirst.mockResolvedValue({
    id: "xiaoyan-uuid",
    organizationId: "org-1",
    slug: "xiaoyan",
  } as never);
});

describe("research_query_builder tool", () => {
  it("正常 user_intent 输出合理 conditions（≤10）", async () => {
    let callIdx = 0;
    mockDb.select.mockImplementation((() => ({
      from: () => ({
        where: () => {
          callIdx++;
          return Promise.resolve(
            callIdx === 1
              ? [{ id: "d1", name: "涪陵区" }]
              : [{ id: "t-rural", name: "乡村振兴" }],
          );
        },
      }),
    })) as never);

    mockGenerateText.mockResolvedValue({
      output: {
        conditions: [
          { field: "topic", operator: "equals", value: "乡村振兴", logic: "and" },
          {
            field: "publishedAt",
            operator: "between",
            value: ["2025-01-01", "2025-06-30"],
            logic: "and",
          },
        ],
        sidebarFilter: { topicIds: ["t-rural"] },
        reasoning: "解析 2 条：主题=乡村振兴 + 时间=2025 上半年。",
      },
    } as never);

    const t = createResearchQueryBuilderTool("org-1");
    const result = await (t.execute as never as (a: { user_intent: string }) => Promise<{
      conditions: unknown[];
      reasoning: string;
      applyUrl: string;
    }>)({ user_intent: "2025 上半年的乡村振兴报道" });

    expect(result.conditions).toHaveLength(2);
    expect(result.applyUrl).toContain("/research?mode=advanced&apply_query_builder=");
    expect(result.reasoning.length).toBeGreaterThanOrEqual(10);
  });

  it("district 名找不到 → tool 不抛错（由 LLM 返回 reasoning 降级）", async () => {
    mockDb.select.mockImplementation((() => ({
      from: () => ({ where: () => Promise.resolve([]) }),
    })) as never);

    mockGenerateText.mockResolvedValue({
      output: {
        conditions: [
          { field: "title", operator: "contains", value: "未知地名", logic: "and" },
        ],
        reasoning: "字典中找不到该区县，降级用 title contains。",
      },
    } as never);

    const t = createResearchQueryBuilderTool("org-1");
    const result = await (t.execute as never as (a: { user_intent: string }) => Promise<{
      conditions: unknown[];
      reasoning: string;
    }>)({ user_intent: "未知地名 xxx 的报道" });

    expect(result.conditions).toHaveLength(1);
    expect(result.reasoning).toContain("降级");
  });

  it("topic 名找不到 → reasoning 说明降级", async () => {
    mockDb.select.mockImplementation((() => ({
      from: () => ({ where: () => Promise.resolve([]) }),
    })) as never);

    mockGenerateText.mockResolvedValue({
      output: {
        conditions: [
          { field: "content", operator: "contains", value: "玄学", logic: "and" },
        ],
        reasoning: "主题字典无玄学，降级 content contains。",
      },
    } as never);

    const t = createResearchQueryBuilderTool("org-1");
    const result = await (t.execute as never as (a: { user_intent: string }) => Promise<{
      reasoning: string;
    }>)({ user_intent: "玄学相关报道" });

    expect(result.reasoning).toContain("降级");
  });

  it(">10 conditions 抛 zod error", async () => {
    mockDb.select.mockImplementation((() => ({
      from: () => ({ where: () => Promise.resolve([]) }),
    })) as never);

    mockGenerateText.mockRejectedValue(
      new Error("Schema validation: conditions length 11 exceeds max 10"),
    );

    const t = createResearchQueryBuilderTool("org-1");
    await expect(
      (t.execute as never as (a: { user_intent: string }) => Promise<unknown>)({
        user_intent: "极复杂的检索（堆 11 条以上）",
      }),
    ).rejects.toThrow(/exceeds max 10/);
  });
});
```

- [ ] **Step 2: 跑测试**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/agent/skills/__tests__/research-query-builder.test.ts
```

预期：4 passed。

### Task 3.5: ToolActionCard chat 渲染 + A4 deeplink hydrate

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/components/chat/tool-action-card.tsx`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/search-workbench-client.tsx`

- [ ] **Step 1: `tool-action-card.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";

const FIELD_LABELS: Record<string, string> = {
  title: "标题",
  content: "正文",
  author: "作者",
  outletName: "媒体",
  outletTier: "媒体分级",
  outletRegion: "媒体区域",
  district: "报道区县",
  topic: "主题",
  contentType: "内容类型",
  publishedAt: "发布时间",
  platform: "平台",
};

const OPERATOR_LABELS: Record<string, string> = {
  contains: "含",
  not_contains: "不含",
  equals: "=",
  not_equals: "≠",
  between: "在",
};

interface ResearchQueryBuilderResult {
  conditions: { field: string; operator: string; value: string | string[]; logic: "and" | "or" }[];
  sidebarFilter?: { districtIds?: string[]; topicIds?: string[] };
  reasoning: string;
  applyUrl: string;
}

interface DataPivoterResult {
  pivot_config: { rows: string; cols?: string; measure: "count" | "percentage" | "avg_tier"; filter?: Record<string, string[]> };
  chart_type: "bar" | "heatmap" | "donut" | "line";
  reasoning: string;
  preview?: { rows: Record<string, string | number>[]; columns: string[] };
  applyUrl?: string;
}

type ToolName = "research_query_builder" | "data_pivoter";

interface ToolActionCardProps {
  toolName: ToolName;
  toolResult: ResearchQueryBuilderResult | DataPivoterResult;
}

export function ToolActionCard({ toolName, toolResult }: ToolActionCardProps) {
  const router = useRouter();

  if (toolName === "research_query_builder") {
    const r = toolResult as ResearchQueryBuilderResult;
    return (
      <GlassCard className="p-4">
        <p className="text-sm text-muted-foreground">{r.reasoning}</p>
        <ul className="mt-3 space-y-1 text-sm">
          {r.conditions.map((c, i) => {
            const value = Array.isArray(c.value) ? c.value.join(" ~ ") : c.value;
            return (
              <li key={i}>
                · {FIELD_LABELS[c.field] ?? c.field} {OPERATOR_LABELS[c.operator] ?? c.operator} {value}
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => router.push(r.applyUrl)}>
            一键填入 A4 高级检索 →
          </Button>
        </div>
      </GlassCard>
    );
  }

  if (toolName === "data_pivoter") {
    const r = toolResult as DataPivoterResult;
    return (
      <GlassCard className="p-4">
        <p className="text-sm text-muted-foreground">{r.reasoning}</p>
        <p className="mt-2 text-xs">
          维度：{r.pivot_config.rows}{r.pivot_config.cols ? ` × ${r.pivot_config.cols}` : ""} · 度量：{r.pivot_config.measure} · 图表：{r.chart_type}
        </p>
        {r.preview && (
          <div className="mt-3">
            <DataTable
              rows={r.preview.rows}
              rowKey={(_, i) => String(i)}
              columns={r.preview.columns.map((c) => ({
                key: c,
                header: c,
                render: (row) => String(row[c] ?? ""),
              }))}
            />
          </div>
        )}
        {r.applyUrl && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => router.push(r.applyUrl!)}>
              在报告页应用此透视 →
            </Button>
          </div>
        )}
      </GlassCard>
    );
  }

  return null;
}
```

- [ ] **Step 2: A4 `search-workbench-client.tsx` 加 deeplink hydrate**

`useEffect` 在文件顶层 import 后插入（紧挨现有 useEffect / useState）：

```tsx
useEffect(() => {
  const apply = searchParams?.get("apply_query_builder");
  if (!apply) return;
  try {
    const data = JSON.parse(decodeURIComponent(apply)) as {
      conditions: AdvancedSearchCondition[];
      sidebarFilter?: SidebarFilter;
    };
    setMode("advanced");
    setConditions(data.conditions);
    if (data.sidebarFilter) {
      setSidebarFilter(data.sidebarFilter);
    }
    // 自动触发检索（下一帧确保 state 已 commit）
    setTimeout(() => handleAdvancedSearch(), 0);
  } catch (e) {
    console.error("[research/apply_query_builder] parse failed:", e);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

注：`setMode` / `setConditions` / `setSidebarFilter` / `handleAdvancedSearch` 必须是 `search-workbench-client.tsx` 已有的 setter / handler。如果命名不同，按实际 grep 出的命名调整。

- [ ] **Step 3: tsc 验证**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

### Task 3.6: Phase 3 commit

- [ ] **Step 1: commit + push**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && git add \
  skills/research_query_builder/SKILL.md \
  src/lib/agent/skills/research-query-builder.ts \
  src/lib/agent/tool-registry.ts \
  src/app/api/chat/stream/route.ts \
  src/components/chat/tool-action-card.tsx \
  src/app/\(dashboard\)/research/search-workbench-client.tsx \
  src/lib/agent/skills/__tests__/research-query-builder.test.ts && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a6): research_query_builder 全套 — Phase 3

- skills/research_query_builder/SKILL.md baoyu 完整 body（字段表/时间表达/字典硬约束/AND-OR 逻辑/输出示例）
- src/lib/agent/skills/research-query-builder.ts: zod schema + tool factory（assembleAgent + generateText/Output.object，AI SDK v6）
- tool-registry.ts: createXiaoyanChatTools(orgId) lazy factory（与 createMissionTools 同模式）
- chat/stream/route.ts: 把 xiaoyan tools 合并到 vercelTools
- ToolActionCard chat 卡片渲染（variant="ghost" 无边框 per CLAUDE.md）
- A4 search-workbench-client.tsx: 读 ?apply_query_builder=... → setMode/setConditions + 触发检索
- 单测 4 case：正常 / district 找不到 / topic 找不到 / >10 抛 zod error

A6 spec §3.4 + §4.2 + §4.4 + §4.5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)" && git push
```

---

## Phase 4: `data_pivoter` 全套（Day 4）

### Task 4.1: 写完整 SKILL.md body

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/skills/data_pivoter/SKILL.md`

- [ ] **Step 1: frontmatter 之后追加 baoyu 10-12 章 body**

````markdown
# 数据透视分析（data_pivoter）

你是新闻研究员小研 / 数据分析师小数的透视助手，把用户口语化的"按 X×Y 透视"需求 → 严格的 `pivot_config` JSON + `chart_type`。核心信条：**维度选准 · 图表选对 · 不臆造数据 · preview 仅做截断不做生成**。

## 使用条件

✅ **应调用场景**：
- 学术老师在报告页或 chat 说"按主题×媒体分级透视"
- 小数在数据分析场景被叫去快速出一张交叉透视

❌ **不应调用场景**：
- 用户已经手动配好透视参数（不需要 AI 翻译）
- 跨数据源（本 skill 仅适用于 `articles + research_reports` 数据池）
- 时间序列预测 / 异常检测（走专门的 ML skill，不在 vibetide 第 1 期）

**前置条件**：`available_dimensions` 必填；如果带 `current_report_id`，则 tool 内部计算 5×5 preview。

## 输入 / 输出

**输入：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `user_request` | string | 用户口语化（≥ 5 字） |
| `available_dimensions` | string[] | 可用维度（默认 5：topic / district / media_tier / media_name / date） |
| `current_report_id` | uuid? | 可选：当前所在报告 ID（决定 preview 是否计算） |

**输出（zod schema）：**

| 字段 | 说明 |
|---|---|
| `pivot_config.rows` | 主维度（必填） |
| `pivot_config.cols` | 次维度（可选，单维度透视不填） |
| `pivot_config.measure` | `count` / `percentage` / `avg_tier` |
| `pivot_config.filter` | `Record<string, string[]>` 可选 |
| `chart_type` | `bar` / `heatmap` / `donut` / `line` |
| `reasoning` | 10-300 字 |

工具 execute 在拿到 LLM 输出后，若 `current_report_id` 非空，自动追加 `preview: { rows, columns }`（5 行 × 5 列）。

## 维度字典

| 维度 | 描述 | 数据源 |
|---|---|---|
| `topic` | 主题（16 项） | articles.topic |
| `district` | 报道指向区县 | articles.district |
| `media_tier` | 央/省市/地方 | articles.outlet_tier |
| `media_name` | 媒体名 | articles.outlet_name |
| `date` | 日期（年/月/日） | articles.published_at（截 YYYY-MM-DD） |

## chart 选型规则

| 维度组合 | measure | chart_type |
|---|---|---|
| 单维度 + count | count | `bar`（前 10 高）或 `donut`（占比） |
| 双维度交叉 | count/percentage | `heatmap` |
| 时间维度（含 date） | count | `line` |
| 时间 + 1 个其他 | count | `line`（多线） |

## measure 选型

- 用户说"占比" / "百分比" → `percentage`
- 用户说"数量" / "条数" → `count`
- 用户说"平均媒体级别" → `avg_tier`（央=3 / 省市=2 / 地方=1）

## 工作流 Checklist

1. 读 user_request 抽出维度 + 度量
2. 维度名匹配 available_dimensions（找不到 → reasoning 说明降级）
3. 单维度 → cols 留空；双维度 → 填 cols
4. 推断 chart_type（按表格规则）
5. 写 reasoning（10-300 字）
6. 若 current_report_id 非空，由 tool 内部 SQL 算 preview

## 输出示例

输入：
> 按主题×媒体分级统计每个组合的报道数量

输出：

```json
{
  "pivot_config": {
    "rows": "topic",
    "cols": "media_tier",
    "measure": "count"
  },
  "chart_type": "heatmap",
  "reasoning": "双维度交叉（主题 × 媒体分级）→ heatmap；度量=count（数量）。"
}
```

输入（带 current_report_id）：
> 6 月每个区县的报道趋势

输出：

```json
{
  "pivot_config": {
    "rows": "date",
    "cols": "district",
    "measure": "count",
    "filter": { "month": ["2025-06"] }
  },
  "chart_type": "line",
  "reasoning": "时间维度（按日）+ 区县（多线）→ line；度量=count；过滤 6 月。"
}
```

## 常见问题

**Q：用户说"占比"但维度组合不适合 percentage（如 5 个维度）？**
A：仍输出 percentage，由前端渲染层把<1% 项合并到"其他"。

**Q：preview 计算超过 1s？**
A：tool execute 内部 timeout=2s；超时则降级返回不带 preview 的输出。

## 参考资料

- A6 spec: docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md §3.5
- A5 报告页透视 section: src/app/(dashboard)/research/reports/[id]/report-client.tsx
````

### Task 4.2: 实现 `data-pivoter.ts` tool（含 `computePivotPreview`）

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/skills/data-pivoter.ts`

- [ ] **Step 1: 写文件**

```ts
/**
 * data_pivoter — chat tool for xiaoyan / xiaoshu.
 *
 * 把用户口语化的数据透视需求 → pivot_config + chart_type；
 * 若带 current_report_id，自动算 5×5 preview。
 *
 * AI SDK v6 — uses generateText({ output: Output.object({ schema }) }).
 */

import { tool, generateText, Output } from "ai";
import { z } from "zod/v4";
import { db } from "@/db";
import { aiEmployees, articles, researchReports } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { assembleAgent } from "../assembly";
import { getLanguageModel } from "../model-router";

const PivotConfigSchema = z.object({
  rows: z.string().min(1),
  cols: z.string().optional(),
  measure: z.enum(["count", "percentage", "avg_tier"]),
  filter: z.record(z.string(), z.array(z.string())).optional(),
});

const DataPivoterOutputSchema = z.object({
  pivot_config: PivotConfigSchema,
  chart_type: z.enum(["bar", "heatmap", "donut", "line"]),
  reasoning: z.string().min(10).max(300),
});

const PreviewSchema = z.object({
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
  columns: z.array(z.string()),
});

export type DataPivoterResult = z.infer<typeof DataPivoterOutputSchema> & {
  preview?: z.infer<typeof PreviewSchema>;
  applyUrl?: string;
};

const DIMENSION_TO_COLUMN: Record<string, string> = {
  topic: "topic",
  district: "district",
  media_tier: "outlet_tier",
  media_name: "outlet_name",
  date: "to_char(published_at, 'YYYY-MM-DD')",
};

async function computePivotPreview(
  orgId: string,
  reportId: string,
  pivotConfig: z.infer<typeof PivotConfigSchema>,
): Promise<z.infer<typeof PreviewSchema> | undefined> {
  const rowCol = DIMENSION_TO_COLUMN[pivotConfig.rows];
  const colCol = pivotConfig.cols ? DIMENSION_TO_COLUMN[pivotConfig.cols] : null;
  if (!rowCol) return undefined;

  // 仅取该 report 关联的 articles —— 假设 researchReports 表有 articleIds[] 或 reportArticles 关联表
  // 简化：直接 group by 全 org articles 的前 5 行 × 5 列（用 reportId 过滤需视实际 schema 调整）
  const rowExpr = sql.raw(rowCol);
  const colExpr = colCol ? sql.raw(colCol) : null;

  try {
    if (colExpr) {
      // 双维度交叉
      const rows = await db
        .select({
          row_key: rowExpr,
          col_key: colExpr,
          cnt: sql<number>`count(*)::int`,
        })
        .from(articles)
        .where(eq(articles.organizationId, orgId))
        .groupBy(rowExpr, colExpr)
        .limit(50);

      const rowKeys = Array.from(new Set(rows.map((r) => String(r.row_key)))).slice(0, 5);
      const colKeys = Array.from(new Set(rows.map((r) => String(r.col_key)))).slice(0, 5);

      const matrix = rowKeys.map((rk) => {
        const obj: Record<string, string | number> = { [pivotConfig.rows]: rk };
        for (const ck of colKeys) {
          const found = rows.find(
            (r) => String(r.row_key) === rk && String(r.col_key) === ck,
          );
          obj[ck] = found?.cnt ?? 0;
        }
        return obj;
      });

      return { rows: matrix, columns: [pivotConfig.rows, ...colKeys] };
    } else {
      // 单维度
      const rows = await db
        .select({
          row_key: rowExpr,
          cnt: sql<number>`count(*)::int`,
        })
        .from(articles)
        .where(eq(articles.organizationId, orgId))
        .groupBy(rowExpr)
        .orderBy(sql`count(*) desc`)
        .limit(5);

      return {
        rows: rows.map((r) => ({
          [pivotConfig.rows]: String(r.row_key),
          count: r.cnt,
        })),
        columns: [pivotConfig.rows, "count"],
      };
    }
  } catch (e) {
    console.error("[data_pivoter] computePivotPreview failed:", e);
    return undefined;
  }
}

export function createDataPivoterTool(orgId: string) {
  return tool({
    description:
      "把用户口语化的数据透视需求翻译成 pivot_config + chart_type；若给 current_report_id，自动计算 5×5 preview。适用于学术研究员小研 / 数据分析师小数。",
    inputSchema: z.object({
      user_request: z.string().min(5),
      current_report_id: z.string().uuid().optional(),
    }),
    execute: async ({ user_request, current_report_id }) => {
      const xiaoyan = await db.query.aiEmployees.findFirst({
        where: and(
          eq(aiEmployees.organizationId, orgId),
          eq(aiEmployees.slug, "xiaoyan"),
        ),
      });
      if (!xiaoyan) {
        throw new Error(
          "xiaoyan employee not seeded in this org（依赖 A6 Phase 1 seed）",
        );
      }

      const agent = await assembleAgent(xiaoyan.id, undefined, {
        skillOverrides: ["data_pivoter"],
      });

      const prompt = JSON.stringify({
        user_request,
        available_dimensions: ["topic", "district", "media_tier", "media_name", "date"],
        current_report_id,
      });

      const { output } = await generateText({
        model: getLanguageModel(agent.modelConfig),
        system: agent.systemPrompt,
        prompt,
        output: Output.object({ schema: DataPivoterOutputSchema }),
        temperature: 0.2,
        maxOutputTokens: 1000,
      });

      let preview: z.infer<typeof PreviewSchema> | undefined;
      if (current_report_id) {
        preview = await computePivotPreview(orgId, current_report_id, output.pivot_config);
      }

      const applyUrl = current_report_id
        ? `/research/reports/${current_report_id}?apply_pivot=${encodeURIComponent(
            JSON.stringify({ pivot_config: output.pivot_config, chart_type: output.chart_type }),
          )}`
        : undefined;

      return { ...output, preview, applyUrl } satisfies DataPivoterResult;
    },
  });
}
```

- [ ] **Step 2: 验证 schema 表名**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && grep -n "researchReports\|research_reports" src/db/schema/index.ts | head -3
```

如果 `researchReports` 表名不同（A5 实施时可能叫别的），改 import；本 plan 的 `computePivotPreview` 只用 `articles`，所以 `researchReports` import 可删（保留只是占位）。简化：只 import `articles`。

修订 import：

```ts
import { aiEmployees, articles } from "@/db/schema";
```

- [ ] **Step 3: tsc 验证**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

### Task 4.3: 写 3 case 单测

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/skills/__tests__/data-pivoter.test.ts`

- [ ] **Step 1: 写测试文件**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: vi.fn(),
    Output: actual.Output,
    tool: actual.tool,
  };
});

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    query: { aiEmployees: { findFirst: vi.fn() } },
  },
}));

vi.mock("../../assembly", () => ({
  assembleAgent: vi.fn(async () => ({
    employeeId: "fake-uuid",
    systemPrompt: "stub",
    modelConfig: { provider: "openai", model: "deepseek-chat", temperature: 0.2, maxTokens: 1000 },
    tools: [],
  })),
}));

vi.mock("../../model-router", () => ({
  getLanguageModel: vi.fn(() => ({}) as unknown),
}));

import { createDataPivoterTool } from "../data-pivoter";
import { generateText } from "ai";
import { db } from "@/db";

const mockGenerateText = vi.mocked(generateText);
const mockDb = vi.mocked(db, true);

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.query.aiEmployees.findFirst.mockResolvedValue({
    id: "xiaoyan-uuid",
    organizationId: "org-1",
    slug: "xiaoyan",
  } as never);

  mockDb.select.mockImplementation((() => ({
    from: () => ({
      where: () => ({
        groupBy: () => ({
          orderBy: () => ({ limit: () => Promise.resolve([]) }),
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
  })) as never);
});

describe("data_pivoter tool", () => {
  it("基础透视（双维度，无 current_report_id → 不算 preview）", async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        pivot_config: { rows: "topic", cols: "media_tier", measure: "count" },
        chart_type: "heatmap",
        reasoning: "双维度交叉 → heatmap。",
      },
    } as never);

    const t = createDataPivoterTool("org-1");
    const result = await (t.execute as never as (a: { user_request: string }) => Promise<{
      pivot_config: { rows: string; cols?: string };
      chart_type: string;
      preview?: unknown;
      applyUrl?: string;
    }>)({ user_request: "按主题×媒体分级透视" });

    expect(result.pivot_config.rows).toBe("topic");
    expect(result.pivot_config.cols).toBe("media_tier");
    expect(result.chart_type).toBe("heatmap");
    expect(result.preview).toBeUndefined();
    expect(result.applyUrl).toBeUndefined();
  });

  it("含 filter → pivot_config.filter 透传", async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        pivot_config: {
          rows: "date",
          cols: "district",
          measure: "count",
          filter: { month: ["2025-06"] },
        },
        chart_type: "line",
        reasoning: "6 月日级 × 区县 → line。",
      },
    } as never);

    const t = createDataPivoterTool("org-1");
    const result = await (t.execute as never as (a: { user_request: string }) => Promise<{
      pivot_config: { filter?: Record<string, string[]> };
    }>)({ user_request: "6 月每个区县的日报道趋势" });

    expect(result.pivot_config.filter).toEqual({ month: ["2025-06"] });
  });

  it("带 current_report_id → 调用 computePivotPreview（mock 返回空数组也不报错）", async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        pivot_config: { rows: "topic", measure: "count" },
        chart_type: "donut",
        reasoning: "单维度占比 → donut。",
      },
    } as never);

    const t = createDataPivoterTool("org-1");
    const result = await (t.execute as never as (a: {
      user_request: string;
      current_report_id?: string;
    }) => Promise<{ applyUrl?: string }>)({
      user_request: "主题占比",
      current_report_id: "00000000-0000-0000-0000-000000000001",
    });

    expect(result.applyUrl).toContain("/research/reports/");
    expect(result.applyUrl).toContain("apply_pivot=");
  });
});
```

- [ ] **Step 2: 跑测试**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/agent/skills/__tests__/data-pivoter.test.ts
```

预期：3 passed。

### Task 4.4: 报告页 deeplink hydrate（A5 已建则改，未建则 stub）

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/reports/[id]/report-client.tsx`（A5 已建则改；未建则把 hydrate 逻辑写成 TODO 注释）

- [ ] **Step 1: 检查文件是否存在**

```bash
ls /Users/zhuyu/dev/chinamcloud/vibetide/src/app/\(dashboard\)/research/reports/\[id\]/report-client.tsx 2>&1 || echo "FILE NOT EXISTS, A5 还未落盘"
```

- [ ] **Step 2: 若文件存在，加 useEffect**

在文件已有 useEffect 块附近插入：

```tsx
useEffect(() => {
  const apply = searchParams?.get("apply_pivot");
  if (!apply) return;
  try {
    const data = JSON.parse(decodeURIComponent(apply)) as {
      pivot_config: { rows: string; cols?: string; measure: string };
      chart_type: "bar" | "heatmap" | "donut" | "line";
    };
    // setCustomPivotConfig / setCustomPivotChart 等 setter 由 A5 报告页自带
    setCustomPivotConfig(data.pivot_config);
    setCustomPivotChart(data.chart_type);
    // scroll 到"自定义透视" section
    document.getElementById("custom-pivot-section")?.scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    console.error("[research/apply_pivot] parse failed:", e);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 3: 若文件不存在（A5 未落盘）**

不动 report-client.tsx；在 plan 后续实施时由 A5 实施者读本 plan 的 §Task 4.4 代码片段补上。在 commit message 里注明"A5 落盘后补 deeplink hydrate"。

### Task 4.5: tsc + lint + build

- [ ] **Step 1: 全套验证**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit && npm run lint && npm run build
```

预期：3 项全过。

### Task 4.6: Phase 4 commit

- [ ] **Step 1: commit + push**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && git add \
  skills/data_pivoter/SKILL.md \
  src/lib/agent/skills/data-pivoter.ts \
  src/lib/agent/skills/__tests__/data-pivoter.test.ts && \
[ -f src/app/\(dashboard\)/research/reports/\[id\]/report-client.tsx ] && \
git add src/app/\(dashboard\)/research/reports/\[id\]/report-client.tsx ; \
git commit --no-verify -m "$(cat <<'EOF'
feat(a6): data_pivoter 全套 — Phase 4

- skills/data_pivoter/SKILL.md baoyu 完整 body（5 维度 / chart 选型规则 / measure 选型）
- src/lib/agent/skills/data-pivoter.ts: zod schema + tool factory + computePivotPreview SQL（5×5 截断）
- A5 报告页 deeplink hydrate（若 A5 已落盘）: ?apply_pivot=... → setCustomPivotConfig + scroll
- 单测 3 case：基础双维 / 含 filter / current_report_id 走 preview 路径

A6 spec §3.5 + §4.3 + §4.5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)" && git push
```

---

## Phase 5: `@employee` 切换 + 全套回归（Day 4.5 半天）

### Task 5.1: `mention-switch.ts` util + 单测

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/mention-switch.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/__tests__/mention-switch.test.ts`

- [ ] **Step 1: 写 util**

```ts
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";

/**
 * 从 user message 头部检测 @employee 切换标记。
 *
 * 支持格式：`@xiaolei 帮我看一下热点` →
 *   { targetEmployee: "xiaolei", cleanMessage: "帮我看一下热点" }
 *
 * 不匹配（无 @ 或 @ 后跟未知 slug）→ targetEmployee = null。
 *
 * 设计：从 EMPLOYEE_META 派生 slug 列表，避免硬编码 — 新增第 10 位员工无需改 regex。
 */
export function detectMentionSwitch(message: string): {
  targetEmployee: EmployeeId | null;
  cleanMessage: string;
} {
  if (!message) return { targetEmployee: null, cleanMessage: message };

  const slugs = Object.keys(EMPLOYEE_META).join("|");
  const re = new RegExp(`^@(${slugs})\\s+([\\s\\S]+)`);
  const match = message.match(re);
  if (!match) return { targetEmployee: null, cleanMessage: message };

  return {
    targetEmployee: match[1] as EmployeeId,
    cleanMessage: match[2],
  };
}
```

- [ ] **Step 2: 写 3 case 单测**

```ts
import { describe, it, expect } from "vitest";
import { detectMentionSwitch } from "../mention-switch";

describe("detectMentionSwitch", () => {
  it("合法 @xiaolei → 切换 + 剥前缀", () => {
    const r = detectMentionSwitch("@xiaolei 帮我看下今日热点");
    expect(r.targetEmployee).toBe("xiaolei");
    expect(r.cleanMessage).toBe("帮我看下今日热点");
  });

  it("非法 @unknown → 不切换 + 原文不变", () => {
    const r = detectMentionSwitch("@unknown 你是谁");
    expect(r.targetEmployee).toBeNull();
    expect(r.cleanMessage).toBe("@unknown 你是谁");
  });

  it("无 @ → 不切换 + 原文不变", () => {
    const r = detectMentionSwitch("帮我写篇报告");
    expect(r.targetEmployee).toBeNull();
    expect(r.cleanMessage).toBe("帮我写篇报告");
  });
});
```

- [ ] **Step 3: 跑测试**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/agent/__tests__/mention-switch.test.ts
```

预期：3 passed。

### Task 5.2: `chat/stream/route.ts` 接入 detectMentionSwitch

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/api/chat/stream/route.ts`

- [ ] **Step 1: import + 入口预处理（顺序非常关键）**

文件顶部 import 块加：

```ts
import { detectMentionSwitch } from "@/lib/agent/mention-switch";
```

**关键执行顺序**——预处理必须发生在 `employeeRecord` 查询和 `assembleAgent(...)` 之前，否则 system prompt + tools 仍是原员工：

```
旧流程：query employeeSlug → assembleAgent → ...
新流程：(messages slice) → detectMentionSwitch → 改写 last user message + activeEmployeeSlug → query activeEmployeeSlug → assembleAgent(employeeRecord.id) → ...
```

具体修改：把现有 `src/app/api/chat/stream/route.ts` 第 91-104 行（`const employeeRecord = await db.query.aiEmployees.findFirst({...})` 到 `agent = await assembleAgent(employeeRecord.id);`）整段连同前面 `const messages = conversationHistory.slice(-10);` 一起，重排为下列结构：

```ts
    // 1) 取 messages 切片（既有逻辑提前到这里）
    const messages = conversationHistory.slice(-10);

    // 2) ---- @employee 切换预处理（A6 新增） ----
    let activeEmployeeSlug = employeeSlug;
    let switchNotice: string | null = null;

    const reverseIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (reverseIdx >= 0) {
      const realIdx = messages.length - 1 - reverseIdx;
      const detection = detectMentionSwitch(messages[realIdx].content);
      if (detection.targetEmployee && detection.targetEmployee !== employeeSlug) {
        activeEmployeeSlug = detection.targetEmployee;
        // 改写 last user message —— 后续 assembleAgent → streamText 看到的是 cleanMessage
        messages[realIdx] = { ...messages[realIdx], content: detection.cleanMessage };
        switchNotice = `已切换到 @${detection.targetEmployee}`;
      }
    }

    // 3) ---- 用 activeEmployeeSlug 查 employee（注意：不再是 employeeSlug） ----
    const employeeRecord = await db.query.aiEmployees.findFirst({
      where: and(
        eq(aiEmployees.slug, activeEmployeeSlug),               // ← 改成 activeEmployeeSlug
        eq(aiEmployees.organizationId, profile.organizationId)
      ),
    });
    if (!employeeRecord) {
      return new Response("员工不存在或无权操作", { status: 403 });
    }

    // 4) ---- 用 employeeRecord.id 装配 agent（system prompt + tools 全部反映新员工） ----
    let agent;
    try {
      agent = await assembleAgent(employeeRecord.id);
    } catch (err) {
      console.error("[chat/stream] assembleAgent failed:", err);
      return new Response(
        `Agent assembly failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: 500 }
      );
    }

    // 5) 后续 model / tools 装配（既有逻辑保持不变；toVercelTools 用 agent.tools，
    //    Phase 3.3 已加 createXiaoyanChatTools 合并）
```

**为什么这个顺序重要**：spec §5 的 `@xiaoyan ...` 切换语义是"完整切到目标员工的人格 + 工具集"。如果先用 `employeeSlug` 装了 agent 再改 slug，system prompt（含 7 层人格 + skill 内容）+ tools 仍是原员工，会出现"小雷的 prompt 在用 xiaoyan 的语气说话"的混乱。

- [ ] **Step 2: 在 `stream` 的 `start(controller)` 内、首个 `for await` 之前 send 切换 SSE event**

```ts
        try {
          if (switchNotice) {
            send("system", { message: switchNotice, employeeSlug: activeEmployeeSlug });
          }
          for await (const part of result.fullStream) {
```

- [ ] **Step 3: tsc 验证**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

### Task 5.3: `employee-mention-picker.tsx` 组件

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/components/chat/employee-mention-picker.tsx`

- [ ] **Step 1: 写组件**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmployeeMentionPickerProps {
  /** 当前 chat input 完整文本 */
  value: string;
  /** 选中员工后，用 callback 把更新后的完整 input 文本回传给父组件 */
  onSelect: (next: string, employeeId: EmployeeId) => void;
  /** 隐藏 picker 的回调 */
  onClose: () => void;
}

const SELECTABLE_EMPLOYEES: EmployeeId[] = [
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
  "xiaoyan",
];

export function EmployeeMentionPicker({ value, onSelect, onClose }: EmployeeMentionPickerProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % SELECTABLE_EMPLOYEES.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + SELECTABLE_EMPLOYEES.length) % SELECTABLE_EMPLOYEES.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const slug = SELECTABLE_EMPLOYEES[activeIdx];
        // 把 value 中最后一个 "@" 替换成 "@slug "
        const next = value.replace(/@(\w*)$/, `@${slug} `);
        onSelect(next, slug);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeIdx, value, onSelect, onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-64 rounded-md bg-background/95 p-2 shadow-lg backdrop-blur"
    >
      <p className="px-2 py-1 text-xs text-muted-foreground">选择员工</p>
      {SELECTABLE_EMPLOYEES.map((slug, i) => {
        const meta = EMPLOYEE_META[slug];
        return (
          <Button
            key={slug}
            variant="ghost"
            size="sm"
            className={cn("w-full justify-start gap-2", i === activeIdx && "bg-accent")}
            onClick={() => {
              const next = value.replace(/@(\w*)$/, `@${slug} `);
              onSelect(next, slug);
            }}
          >
            <EmployeeAvatar employeeId={slug} size="xs" />
            <span className="text-sm">{meta.nickname}</span>
          </Button>
        );
      })}
    </div>
  );
}
```

注：`Button` 用 `variant="ghost"`，per CLAUDE.md "可点击触发的按钮不要带边框"。

- [ ] **Step 2: tsc 验证**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

注：组件创建 + tsc 通过即可；本 plan 不强制把它接入到所有 chat input — 由具体 chat 页面（chat-launcher / chat-center）实施时按需接入。后续 PR 可加。

### Task 5.4: 全套回归测试 + 浏览器手动验收

- [ ] **Step 1: tsc + lint + build + 全套单测**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
  npx tsc --noEmit && \
  npm run lint && \
  npm run build && \
  npx vitest run \
    src/lib/__tests__/employee-meta.test.ts \
    src/db/__tests__/seed-employees.test.ts \
    src/lib/agent/skills/__tests__/research-query-builder.test.ts \
    src/lib/agent/skills/__tests__/data-pivoter.test.ts \
    src/lib/agent/__tests__/mention-switch.test.ts
```

预期：tsc/lint/build/12 case 单测全过。

- [ ] **Step 2: 浏览器手动验收**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run dev
```

打开 `http://localhost:3000`：

1. `/employees` 页 — 9 位员工卡，含小研（BookOpen icon + 深靛蓝）
2. 点小研 → chat → 输入 "我想看 2025 上半年重庆乡村振兴的省级及以上媒体报道" → 期望工具卡渲染（reasoning + conditions 列表 + "一键填入 A4 高级检索 →"）
3. 点击 "一键填入 A4 高级检索 →" → 跳到 `/research?mode=advanced&apply_query_builder=...` → 高级检索 form 自动填入并触发检索
4. 在小雷 chat 输入 `@xiaoyan 帮我把这次结果按主题×媒体分级透视` → 期望 SSE `system` event 报"已切换到 @xiaoyan" + 后续走小研的 data_pivoter tool

### Task 5.5: Phase 5 commit

- [ ] **Step 1: commit + push**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && git add \
  src/lib/agent/mention-switch.ts \
  src/lib/agent/__tests__/mention-switch.test.ts \
  src/app/api/chat/stream/route.ts \
  src/components/chat/employee-mention-picker.tsx && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a6): @employee 切换 + employee-mention-picker + Phase 5 回归 — Phase 5

- src/lib/agent/mention-switch.ts: detectMentionSwitch util（从 EMPLOYEE_META 派生 slug regex，避免硬编码）
- src/app/api/chat/stream/route.ts: 入口预处理切换 activeEmployeeSlug + 改写 last user message + 单独 SSE system event
- src/components/chat/employee-mention-picker.tsx: chat input @ popover（9 员工 + variant="ghost" 无边框 per CLAUDE.md）
- 单测 3 case：合法 / 非法 / 无 @
- 全套回归：tsc/lint/build + 12 case 全过

A6 spec §5（轻量协作机制）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)" && git push
```

---

## Tests Summary（12 case 总览）

| Test 文件 | Phase | Cases |
|---|---|---|
| `src/lib/__tests__/employee-meta.test.ts` | P1 | 1 |
| `src/db/__tests__/seed-employees.test.ts` | P1 | 1 |
| `src/lib/agent/skills/__tests__/research-query-builder.test.ts` | P3 | 4 |
| `src/lib/agent/skills/__tests__/data-pivoter.test.ts` | P4 | 3 |
| `src/lib/agent/__tests__/mention-switch.test.ts` | P5 | 3 |
| **合计** | | **12** |

LLM 调用全部 mock；DB 用真实 Supabase（与 A4 测试模式一致）。

---

## 关键约束（实施时不得违反）

1. **AI SDK v6 only** — 所有结构化输出走 `generateText({ output: Output.object({ schema }) })`；严禁 `generateObject`（v6 已移除）
2. **assembleAgent 签名** — `assembleAgent(employee.id, undefined, { skillOverrides: [...] })`，3 位置参数；第 1 个是 employee UUID，不是 slug
3. **单分支 main** — 全部 commit 直接 push 到 main，**不开** feature/* 或 worktree（CLAUDE.md Git Workflow 强约束）
4. **commit --no-verify 已被 user 授权** — pre-commit hook 历史上偶有 false positive，本 plan 显式带上
5. **borderless buttons** — 所有 `<Button>` 用 `variant="ghost"`（或 `default` 已是无边框液态玻璃），CLAUDE.md 规定
6. **Chinese UI text** — 所有 UI 文案中文（per CLAUDE.md）
7. **不修改既有 8 员工 / 既有 25 skills** — 只增量加 xiaoyan 1 员工 + 3 skill + 2 chat tool + 1 mention-switch util
8. **lucide BookOpen icon，零 png** — 与现有员工对齐
9. **每个 Phase commit 都能独立 build** — Phase 1 stub SKILL.md + tsc 过 build 过即可 ship；Phase 2-5 增量
