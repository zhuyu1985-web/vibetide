# A6 学术研究员 xiaoyan 小研 — Design Spec

**Date:** 2026-05-07
**Status:** Spec finalized, awaiting implementation plan
**Belongs to:** Wave 1 of "新闻研究报告" overhaul（主 spec §4.7）
**Wave 1 sequence:** A1 → A2 → A2.5 → A3 → A4 → **A6（本 spec）→ A5**
**Phase scope:** 新增第 9 位 AI 员工 + 学术研究员核心三件套 skill + chat tool 完整闭环 + `@employee` 协作

---

## 1. Background

### 1.1 范围与目标

主 spec §4.7 定义 A6 = 新增第 9 位 AI 员工 `xiaoyan`（小研，学术研究员）+ 5 个研究专用 skill。本 sub-spec 落实主 spec 留待细化的 3 项决策：

- 5 个 skill 的具体 prompt（按 baoyu skill md 标准）
- xiaoyan 的人设描述、头像设计
- 与 xiaolei 的协作场景

并新增决策：
- skill 集**收缩到三件套**（report_drafter / research_query_builder / data_pivoter）— 见 Q1
- 实施深度做到**完整闭环**（SKILL.md + DB seed + chat handler + 前端 quick-action）— 见 Q2
- `@employee` 切换的轻量协作机制 — 见 Q4

### 1.2 已就绪的基线

- **8 位 AI 员工**：xiaolei / xiaoce / xiaozi / xiaowen / xiaojian / xiaoshen / xiaofa / xiaoshu（`src/lib/constants.ts:EMPLOYEE_META`）
- **~25 个 skill**：均已按 baoyu-inspired SKILL.md 标准入库（180-320 行 frontmatter + 10-12 章 body，参考 `/skills/news_aggregation/SKILL.md`）
- **`aiEmployees` / `skills` / `employeeSkills` schema**：`src/db/schema/ai-employees.ts` / `skills.ts`，多租户 + 幂等 seed 已就位
- **`seed.ts` employee seed 流程**：含 `EMPLOYEE_CORE_SKILLS` 自动绑定 core skill 逻辑
- **chat-center 架构**：`src/app/api/chat/{intent,intent-execute,stream}` + `src/lib/agent/{intent-parser,tool-registry,assembly,model-router,execution}.ts` 全套
- **A4 高级检索**（commits `3f1620e`-`bf5d1f4` shipped）= `research_query_builder` 输出协议复用
- **A5 报告导出 spec**（2026-05-07 落盘）= `report_drafter` 输出协议规约 + zod schema 已定义

### 1.3 设计决策（brainstorming 答案）

| Q | 决策 | 理由 |
|---|---|---|
| Q1 范围 | c — 三件套（report_drafter + research_query_builder + data_pivoter）| A5 阻塞解锁最快 + 学术核心场景完整故事 |
| Q2 实施深度 | c — 完整闭环（SKILL.md + DB seed + chat handler + 前端 quick-action）| 学术老师不会复制 JSON；自然语言→一键应用是杀手 demo |
| Q3 人设 | 中性中年学者 / "客观中立的研究分析，论文级别的报告产出" / lucide `BookOpen` / 深靛蓝 `#4f46e5` / authority=`assistant` / `formal_academic` | 与现有 8 员工风格一致；学术意象明确 |
| Q4 协作场景 | b — chat 内 `@employee` 切换（轻量） | Slack/Teams 通用习惯；不动 chat 架构；故事能讲 |

**收缩说明**：主 spec 原 5 skill，A6 砍掉 `topic_classifier`（Wave 2 W2.5 语义匹配一并做）和 `outlet_classifier`（A1 outlet-recognizer 已覆盖 90%+ 场景，长尾按客户反馈再上）。

---

## 2. xiaoyan 员工注册

### 2.1 `EMPLOYEE_META` 注册（`src/lib/constants.ts`）

```ts
// 在 EmployeeId union 加 xiaoyan
export type EmployeeId =
  | "xiaolei" | "xiaoce" | "xiaozi" | "xiaowen"
  | "xiaojian" | "xiaoshen" | "xiaofa" | "xiaoshu"
  | "xiaoyan";  // ← 新增第 9 位

// EMPLOYEE_META 加：
xiaoyan: {
  id: "xiaoyan",
  name: "学术研究员",
  nickname: "学术研究员",
  title: "学术研究员",
  description: "客观中立的研究分析，论文级别的报告产出",
  icon: BookOpen,                      // lucide-react
  color: "#4f46e5",                    // 深靛蓝
  bgColor: "rgba(79,70,229,0.12)",
},

// EMPLOYEE_SHORT_DESC 加：
xiaoyan: "数据驱动学术研究，论文级研报产出",

// EMPLOYEE_CORE_SKILLS 加：
xiaoyan: ["report_drafter", "research_query_builder", "data_pivoter"],
```

### 2.2 `aiEmployees` DB seed（`src/db/seed.ts:employeesData`）

```ts
{
  slug: "xiaoyan",
  name: "学术研究员",
  nickname: "学术研究员",
  title: "学术研究员",
  motto: "客观中立的研究分析，论文级别的报告产出",
  roleType: "research_analyst",
  authorityLevel: "assistant",
  autoActions: [
    "draft_research_report",
    "build_research_query",
    "compute_data_pivot",
  ],
  needApprovalActions: [
    "publish_report",
    "delete_report",
    "export_to_external_system",
  ],
  status: "idle",
  workPreferences: {
    proactivity: "balanced",            // 不主动建议但响应迅速
    reportingFrequency: "on_demand",    // 仅在用户问起时报告进展
    autonomyLevel: 60,                  // 0-100，介于 advisor=20/executor=85
    communicationStyle: "formal_academic",
    workingHours: "09:00-22:00",        // 学术研究员常 evening 工作
  },
}
```

### 2.3 头像资源策略

跟其他 8 位员工一致：**只用 lucide-react `BookOpen` icon**，不引入 png/jpg 头像资源。员工卡 / chat header / EmployeeAvatar 组件已经支持 lucide icon 作为头像（参考 `src/components/shared/employee-avatar.tsx`）。

### 2.4 与现有员工的差异化定位

| 员工 | 主战场 | 风格 | 沟通 |
|---|---|---|---|
| xiaolei 热点分析师 | 全网热点 / 实时趋势 | 爆款 / 时效 / 产品化 | 简明活泼 |
| xiaoce 选题策划师 | 选题角度 / 内容主题 | 创意 / 编辑视角 | 启发式 |
| xiaowen 内容创作师 | 多风格内容生成 | 文笔灵活 / 多场景 | 多变 |
| xiaoshu 数据分析师 | 数据洞察 / 趋势可视化 | 数据驱动 / 简洁 | 中立 |
| **xiaoyan 学术研究员** | **学术研究 / 报告产出** | **学术 / 严谨 / 论文体** | **正式书面** |

xiaoyan 与 xiaolei 的关键差异（主 spec §4.7）：xiaolei 偏产品/爆款/时效，xiaoyan 偏学术/严谨/权威。两者通过 `@employee` 串联协作（见 §5）。

---

## 3. 三个 Skill 详细规约

### 3.1 入库统一规格（`skills` 表）

| 字段 | 值 |
|---|---|
| `slug` | `report_drafter` / `research_query_builder` / `data_pivoter` |
| `category` | `content_generation` / `data_collection` / `data_analysis` |
| `type` | `builtin` |
| `version` | `1.0` |
| `compatibleRoles` | 见 §3.2 |
| `runtimeConfig` | `{ type: "llm", avgLatencyMs: 5000-30000, maxConcurrency: 5, modelDependency: "deepseek:deepseek-chat" }` |
| `inputSchema` / `outputSchema` | 见各 skill 详情 §3.3-§3.5 |
| `content` | SKILL.md body 内容（180-320 行 baoyu 格式）|

### 3.2 compatibleRoles（哪些员工能用此 skill）

| Skill | compatibleRoles | 理由 |
|---|---|---|
| `report_drafter` | `["xiaoyan"]` | 学术专属，不应给爆款员工写学术报告 |
| `research_query_builder` | `["xiaoyan", "xiaolei"]` | xiaolei 也常需"找特定主题×时间×区域的报道"——可重用 |
| `data_pivoter` | `["xiaoyan", "xiaoshu"]` | xiaoshu（数据分析师）也是数据透视的天然受众 |

`employee_skills` 表里 xiaoyan 全 3 个 binding=`core`（level 范围 80 至 94，与其他员工一致）；xiaolei/xiaoshu 的额外 binding=`extended`（level 范围 50 至 65）。

### 3.3 `report_drafter` skill

**调用方式**：A5 `research-report-generate` Inngest Step 3 走以下流程（AI SDK v6 移除 `generateObject`，改用 `generateText + Output.object()` 拿结构化输出 — 参见 https://ai-sdk.dev/docs）：

```ts
import { generateText, Output } from "ai";
import { assembleAgent } from "@/lib/agent/assembly";
import { getLanguageModel } from "@/lib/agent/model-router";

// 1) 先按 orgId+slug 查 xiaoyan 的 employee row（拿 employeeId）
const xiaoyan = await db.query.aiEmployees.findFirst({
  where: and(eq(aiEmployees.organizationId, orgId), eq(aiEmployees.slug, "xiaoyan")),
});
if (!xiaoyan) throw new Error("xiaoyan employee not seeded in this org (依赖 A6)");

// 2) assembleAgent 真实签名：(employeeId: string, modelOverride?, context?)
const agent = await assembleAgent(xiaoyan.id, undefined, {
  skillOverrides: ["report_drafter"],
});

const { output } = await generateText({
  model: getLanguageModel(agent.modelConfig),
  system: agent.systemPrompt,
  prompt: JSON.stringify(payload),
  output: Output.object({ schema: ReportParagraphsSchema }),
  temperature: 0.3,
  maxOutputTokens: 4000,
});
```

注：`assembleAgent` 真实签名为 `(employeeId: string, modelOverride?: Partial<ModelConfig>, context?: { sensitiveTopics?, skillOverrides? })` —— 第 1 参数是 employee UUID（不是 row），第 2 参数为 modelOverride（不需要时传 `undefined`），第 3 参数才是 context。orgId 在内部通过查 employee row 自动绑定。

**不**进 chat tool registry（不是 chat tool，是 backend Inngest job）。

> **注**：A5 spec 落盘较早（2026-05-07 上午），其中代码示例仍写 `generateObject`，A5 实施时同步迁移到 `generateText + Output.object()`。本 A6 spec 与 A5 implementation plan 都按 v6 API 写。

**inputSchema**：
```ts
{
  task_meta: "object {title, topic_description, time_range, districts[], topics[], hit_count}",
  aggregates: "object {media_tier_distribution[], district_distribution[], topic_distribution[], daily_trend[]}",
  template_brief: "string (template-interpolated 数据简报草稿)",
  sample_titles: "string[] (5 条命中文章标题)",
}
```

**outputSchema**：
```ts
{
  background: "string (200-700 字，第一章 研究背景)",
  brief_rewrite: "string (150-500 字，2.1 数据简报学术润色)",
  conclusions: "string (500-2000 字，第三章 研究发现，3-5 段)",
}
```

**SKILL.md 关键 prompt 内容**（A5 spec §6.4 已规约，A6 落实进 SKILL.md `content` 字段）：

```
身份：你是新闻研究员小研，为西南政法大学新闻学院输出学术研究报告段落。

风格约束：
- 学术中性、第三人称、不用感叹号
- 句式偏书面化，避免"互联网风"措辞（不写"刷屏""火爆""出圈""赛道"等爆款词）
- 数据引用必须给具体数字（"X 条""占 Y%"），不写"大量""很多"
- 结论必须基于 aggregates 字段，不臆造未提供的数据

禁止行为：
- 不写"AI 生成""作为大语言模型"等元元词
- 不臆造引文 / 来源 / 学者名 / 文献
- 不写未在 task_meta / aggregates 中提供的统计
- 不带主观立场（"我认为""应当"），改"数据显示""结果表明"

每个段落要求：
- background：开篇定义研究背景（主题意义、时间窗、区域定位），1-2 段
- brief_rewrite：保留 template_brief 全部数字，调整句式让其学术化
- conclusions：每段一个核心观点（如：层级分布特征 / 区县报道密度差异 / 主题热度分化 / 时间趋势特征），结尾可选留"研究展望"段
```

A6 仅交付：DB seed `skills` row + `employee_skills` row（绑给 xiaoyan core）+ `/skills/report_drafter/SKILL.md` 文件（baoyu 标准 10-12 章 body）。

### 3.4 `research_query_builder` skill

**调用方式**：chat-center tool call。用户在 chat 选 xiaoyan（或 xiaolei）→ 自然语言描述需求 → AI 输出 `AdvancedSearchCondition[]` JSON + `SidebarFilter`。

**inputSchema**：
```ts
{
  user_intent: "string (用户口语描述，如 '我想看 2025 上半年重庆乡村振兴的省级及以上媒体报道')",
  available_districts: "{id, name}[] (40 区县字典)",
  available_topics: "{id, name}[] (16 主题字典)",
}
```

**outputSchema**：
```ts
{
  conditions: "AdvancedSearchCondition[] (≤10 条，A4 类型复用)",
  sidebarFilter: "SidebarFilter (可空)",
  reasoning: "string (向用户解释为什么这么拆条件，1-2 句)",
}
```

**SKILL.md 关键 prompt 要素**：
- 描述 11 个 AdvancedSearchField + 5 个 operator 的语义（title/content/author/outletName/outletTier/outletRegion/district/topic/contentType/publishedAt/platform；contains/not_contains/equals/not_equals/between）
- 时间表达解析约定："2025 上半年" → publishedAt between [2025-01-01, 2025-06-30]；"6 月" → 默认当年 6 月
- 字典使用规则：district 名匹配（"涪陵区" → 用对应 districtId）；topic 名匹配（"乡村振兴" → 对应 topicId）
- 媒体分级表达："省级及以上" → outletTier IN ["central", "provincial_municipal"]
- AND/OR 逻辑：默认 AND；用户用"或""任一""至少"时使用 OR
- 主题描述含 reasoning 字段，让用户知道 AI 怎么拆的

### 3.5 `data_pivoter` skill

**调用方式**：chat-center tool call。用户在报告页或 chat 中说"按 X×Y 透视"→ AI 输出透视配置 + chart 类型。

**inputSchema**：
```ts
{
  user_request: "string (用户口语，如 '按主题×媒体分级透视' 或 '统计 6 月每个区县的报道数')",
  available_dimensions: "string[] (主题/区县/媒体分级/时间/媒体名 等)",
  current_report_id: "uuid (可选，当前所在报告 ID)",
}
```

**outputSchema**：
```ts
{
  pivot_config: {
    rows: "string (维度名，如 'topic')",
    cols: "string (维度名，如 'media_tier')",
    measure: "'count' | 'percentage' | 'avg_tier'",
    filter: "Record<string, string[]> (可选)",
  },
  chart_type: "'bar' | 'heatmap' | 'donut' | 'line'",
  reasoning: "string",
}
```

**SKILL.md 关键 prompt 要素**：
- 5 个可用维度：`topic` / `district` / `media_tier` / `media_name` / `date`
- chart 选型规则：
  - 单维度 + count → `bar`（前 10 高）或 `donut`（占比）
  - 双维度交叉 → `heatmap`
  - 时间维度 → `line`
- measure 选型：用户说"占比"→`percentage`；说"数量"→`count`
- 给 reasoning 解释维度组合的意义

---

## 4. Chat tool 实施 + 前端 quick-action

### 4.1 现有 chat-center 接入点（已核对真实 API）

vibetide 已有：
- `src/app/api/chat/stream/route.ts` — chat 流式路由（直接调 `assembleAgent` + `resolveTools` + `streamText`）
- `src/app/api/chat/intent` + `intent-execute` — 旧 mission scenario 路由（与本 A6 chat 集成无关）
- `src/lib/agent/tool-registry.ts` — `AgentTool` + `resolveTools(skillNames): AgentTool[]` + `toVercelTools(...)` 转 AI SDK tool 集
- `src/lib/agent/assembly.ts` — `assembleAgent(employeeId, modelOverride?, context?)` 返回完整 agent（含 systemPrompt + tools + model）
- `src/lib/agent/model-router.ts` — `getLanguageModel({...})` 模型选择
- `src/lib/agent/intent-recognition.ts` — `recognizeIntent(...)`（**chat 路由器**，与 `intent-parser.ts` workflow planner 不同）

A6 仅做**增量加法**，不重写。两个新 chat tool 通过扩展 `resolveTools` 的 builtin skill 映射加入；`@employee` 切换在 chat stream route 内做预处理。

### 4.2 `research_query_builder` tool 注册

新建 `src/lib/agent/skills/research-query-builder.ts`：

```ts
// AI SDK v6 — 用 generateText + Output.object() 拿结构化输出（v6 移除了 generateObject）
import { tool, generateText, Output } from "ai";
import { z } from "zod/v4";
import { assembleAgent } from "../assembly";
import { getLanguageModel } from "../model-router";
import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { AgentTool } from "../types";

const ResearchQueryBuilderOutputSchema = z.object({
  conditions: z.array(/* AdvancedSearchCondition zod schema */).max(10),
  sidebarFilter: z.object({ /* ... */ }).optional(),
  reasoning: z.string().min(10).max(300),
});

export function createResearchQueryBuilderTool(orgId: string): AgentTool {
  return tool({
    description: "把用户口语化的研究检索需求翻译成 vibetide A4 高级检索的 conditions[] + sidebarFilter JSON",
    inputSchema: z.object({ user_intent: z.string().min(5) }),
    execute: async ({ user_intent }) => {
      const districts = await listDistricts(orgId);
      const topics = await listTopics(orgId);

      // 拿 xiaoyan 在当前 org 下的 employee row（id + slug）
      const xiaoyan = await db.query.aiEmployees.findFirst({
        where: and(eq(aiEmployees.organizationId, orgId), eq(aiEmployees.slug, "xiaoyan")),
      });
      if (!xiaoyan) throw new Error("xiaoyan employee not seeded in this org");

      // 用 assembleAgent 拿到 7-layer system prompt + tools + modelConfig
      // 真实签名：(employeeId: string, modelOverride?, context?) — 3 个位置参数
      const agent = await assembleAgent(xiaoyan.id, undefined, {
        skillOverrides: ["research_query_builder"],
      });

      const { output } = await generateText({
        model: getLanguageModel(agent.modelConfig),
        system: agent.systemPrompt,
        prompt: JSON.stringify({ user_intent, available_districts: districts, available_topics: topics }),
        output: Output.object({ schema: ResearchQueryBuilderOutputSchema }),
        temperature: 0.2,
        maxOutputTokens: 1500,
      });

      return {
        ...output,
        applyUrl: `/research?mode=advanced&apply_query_builder=${encodeURIComponent(JSON.stringify(output))}`,
      };
    },
  });
}
```

注册到 `tool-registry.ts:resolveTools(skillNames)` 的 builtin skill 映射，xiaoyan / xiaolei 在场时（即 employee 已绑此 skill）自动注入。

### 4.3 `data_pivoter` tool 注册

新建 `src/lib/agent/skills/data-pivoter.ts`，结构同上（同样用 `generateText + Output.object()`）。`execute` 内：
- 调 `generateText({ output: Output.object({ schema }) })` 拿 `pivot_config + chart_type + reasoning`
- 若有 `current_report_id`：调内部 `computePivotPreview(orgId, reportId, pivotConfig)` 预先算一份 5 行 × 5 列预览，连同结果返回
- 返回值含 `applyUrl`（报告页 deeplink，带 pivot 配置）

注册到 `tool-registry.ts:assembleAgentTools()`：xiaoyan / xiaoshu 在场时注入。

### 4.4 quick-action 卡片组件

新建 `src/components/chat/tool-action-card.tsx`：

```tsx
interface ToolActionCardProps {
  toolName: "research_query_builder" | "data_pivoter";
  toolResult: ResearchQueryBuilderResult | DataPivoterResult;
}

export function ToolActionCard({ toolName, toolResult }: ToolActionCardProps) {
  if (toolName === "research_query_builder") {
    return (
      <GlassCard>
        <p className="text-sm text-muted-foreground">{toolResult.reasoning}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {toolResult.conditions.map((c, i) => (
            <li key={i}>• {FIELD_LABELS[c.field]} {OPERATOR_LABELS[c.operator]} {c.value}</li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" onClick={() => router.push(toolResult.applyUrl)}>
          一键填入 A4 高级检索 →
        </Button>
      </GlassCard>
    );
  }
  if (toolName === "data_pivoter") {
    return (
      <GlassCard>
        <p className="text-sm text-muted-foreground">{toolResult.reasoning}</p>
        {toolResult.preview && <DataTable rows={toolResult.preview} ... />}
        {toolResult.applyUrl && (
          <Button variant="ghost" size="sm" onClick={() => router.push(toolResult.applyUrl)}>
            在报告页应用此透视 →
          </Button>
        )}
      </GlassCard>
    );
  }
  return null;
}
```

### 4.5 前端 deeplink hydrate

**A4 search-workbench-client.tsx**：
```tsx
useEffect(() => {
  const apply = searchParams.get("apply_query_builder");
  if (!apply) return;
  try {
    const data = JSON.parse(decodeURIComponent(apply));
    setMode("advanced");
    setConditions(data.conditions);
    setSidebarFilter(data.sidebarFilter ?? {});
    handleAdvancedSearch();  // 自动触发检索
  } catch (e) {
    toast.error("无法解析检索参数");
  }
}, []);
```

**A5 reports/[id]/report-client.tsx**（A5 已建）：
```tsx
useEffect(() => {
  const apply = searchParams.get("apply_pivot");
  if (!apply) return;
  // 解析 pivot_config + chart_type → 渲染"自定义透视"section
}, []);
```

---

## 5. `@employee` 切换协作

### 5.1 新建 `src/lib/agent/mention-switch.ts`（独立 util，不动 intent-parser / intent-recognition）

vibetide 既有 `intent-parser.ts` 是 mission/workflow 步骤规划器，`intent-recognition.ts` 是旧 chat 场景路由器，**都不是** chat stream 的 message 入口拦截层。chat stream route (`src/app/api/chat/stream/route.ts`) 直接调 `assembleAgent + resolveTools + streamText`，没有 message 预处理 hook。

A6 加新 util，不挂到既有 parser/recognition：

```ts
// src/lib/agent/mention-switch.ts
import type { EmployeeId } from "@/lib/constants";
import { EMPLOYEE_META } from "@/lib/constants";

export function detectMentionSwitch(message: string): {
  targetEmployee: EmployeeId | null;
  cleanMessage: string;
} {
  // 从 EMPLOYEE_META 派生 slug 列表，避免硬编码（新增第 10 位员工不需改 regex）
  const slugs = Object.keys(EMPLOYEE_META).join("|");
  const re = new RegExp(`^@(${slugs})\\s+(.+)`, "s");
  const match = message.match(re);
  if (!match) return { targetEmployee: null, cleanMessage: message };
  return { targetEmployee: match[1] as EmployeeId, cleanMessage: match[2] };
}
```

### 5.2 chat stream API（`src/app/api/chat/stream/route.ts`）改造

在现有 message 处理入口（`assembleAgent` 调用前）加：

```ts
import { detectMentionSwitch } from "@/lib/agent/mention-switch";

// 入口处理 user message
const lastUserMessage = messages[messages.length - 1].content;
const { targetEmployee, cleanMessage } = detectMentionSwitch(lastUserMessage);

let activeEmployeeId = currentEmployee;
if (targetEmployee && targetEmployee !== currentEmployee) {
  activeEmployeeId = targetEmployee;
  // 把 user message 改为 cleanMessage（去掉 @prefix，避免 LLM 看到无关 token）
  messages[messages.length - 1].content = cleanMessage;
  // 给前端发 system 提示："已切换到 @{nickname}"（通过 streamText 的 onChunk 注入或单独 SSE event）
}

// 后续走既有逻辑（chat stream 当前模式：先按 orgId+slug 查 employee row 拿到 id，再 assembleAgent）
const employee = await db.query.aiEmployees.findFirst({
  where: and(eq(aiEmployees.organizationId, orgId), eq(aiEmployees.slug, activeEmployeeId)),
});
if (!employee) throw new Error(`employee ${activeEmployeeId} not seeded`);
const agent = await assembleAgent(employee.id);
const result = streamText({
  model: getLanguageModel(agent.modelConfig),
  system: agent.systemPrompt,
  messages,
  tools: toVercelTools(agent.tools, agent.pluginConfigs),
  // ...
});
```

历史 message 上下文：chat stream 现有 `messages[]` 数组直接传给 streamText，最近 N 条上下文已在用户 chat history 中。无需额外 token budget 控制（streamText 内部按 model 上下文窗口截断）。

### 5.3 chat input enhancement

新建 `src/components/chat/employee-mention-picker.tsx`：

- 用户在 chat input 输入 `@` 时触发 popover，列出 9 位 employee（nickname + lucide icon + bgColor）
- 用户键盘上下选择 / 鼠标点击 → 插入 `@xiaoyan ` 前缀，光标到末尾
- 用户继续输入消息内容
- 发送时 backend 自动 detect 切换

**chat header 反馈**：切换后顶部"当前对话员工"badge 更新为新 employee 头像 + nickname；历史消息保留（不重置对话）。

---

## 6. 文件结构

### 6.1 新建（10 个文件 + 测试）

| 文件 | 责任 |
|---|---|
| `/skills/report_drafter/SKILL.md` | baoyu 标准 SKILL.md：身份 / 输入输出 / 学术风格约束 / 降级模板（A5 已规约 zod schema） |
| `/skills/research_query_builder/SKILL.md` | baoyu 标准：身份 / 口语→检索 JSON 协议 / 区县/主题字典使用规则 |
| `/skills/data_pivoter/SKILL.md` | baoyu 标准：身份 / 透视维度 / chart 选型 / preview 计算约束 |
| `src/lib/agent/skills/research-query-builder.ts` | zod schema + tool execute function |
| `src/lib/agent/skills/data-pivoter.ts` | zod schema + tool execute function（含 computePivotPreview）|
| `src/components/chat/tool-action-card.tsx` | quick-action 卡片（research_query_builder / data_pivoter 两种渲染）|
| `src/components/chat/employee-mention-picker.tsx` | chat input `@` 弹员工选择器 |
| `src/lib/agent/mention-switch.ts` | `detectMentionSwitch` util，从 EMPLOYEE_META 派生 slug regex |
| `__tests__/research-query-builder.test.ts` | tool execute + zod schema 4 case |
| `__tests__/data-pivoter.test.ts` | tool execute + zod 3 case |
| `__tests__/mention-switch.test.ts` | detectMentionSwitch 3 case |

### 6.2 修改（7 个文件）

| 文件 | 改动 |
|---|---|
| `src/lib/constants.ts` | EmployeeId union 加 `xiaoyan` / EMPLOYEE_META 加 entry / EMPLOYEE_SHORT_DESC 加 / EMPLOYEE_CORE_SKILLS 加 `xiaoyan: ["report_drafter", "research_query_builder", "data_pivoter"]` |
| `src/db/seed.ts` 或 `src/db/seed-builtin-skills.ts` | employeesData 加 xiaoyan / builtinSkills 加 3 skill def（slug + content + inputSchema/outputSchema）|
| `src/lib/agent/tool-registry.ts` | 注册 `createResearchQueryBuilderTool` + `createDataPivoterTool` 进 `resolveTools(skillNames)` 的 builtin skill 映射；按 skillNames 注入 |
| `src/app/api/chat/stream/route.ts` | message 入口跑 `detectMentionSwitch`（来自新 `mention-switch.ts`）→ 切 active employee + 改写 cleanMessage + 给前端 SSE system event |
| `src/app/(dashboard)/research/search-workbench-client.tsx` | useEffect 读 `searchParams.get("apply_query_builder")` → JSON.parse → hydrate `setConditions` + `setSidebarFilter` + 触发 `handleAdvancedSearch` |
| `src/app/(dashboard)/research/reports/[id]/report-client.tsx`（A5 已建） | 读 `searchParams.get("apply_pivot")` → 渲染"自定义透视"section |

---

## 7. 工期估算（4-4.5 天）

| Day | 任务 |
|---|---|
| 1 | xiaoyan 注册（constants + seed）+ 3 skill DB seed（slug + 占位 content + I/O schema）+ migration + EmployeeAvatar 渲染验证 |
| 2 | `report_drafter` SKILL.md 完整内容（180-320 行 baoyu）+ 验证 A5 既有调用 (`assembleAgent("xiaoyan", "report_drafter")`) 拿到的 prompt 与 SKILL.md content 字段对齐 + 单测 |
| 3 | `research_query_builder` SKILL.md + tool execute（zod schema + 字典注入）+ chat 渲染（ToolActionCard）+ A4 deeplink hydrate + 单测 |
| 4 | `data_pivoter` SKILL.md + tool execute（zod schema + computePivotPreview SQL）+ chat 内透视预览渲染 + 报告页 deeplink hydrate + 单测 |
| 4.5（半天） | `@employee` 切换：`detectMentionSwitch` + employee-mention-picker autocomplete + chat-center stream 切换逻辑 + tsc/lint/build / 测试集回归 / 浏览器手动验收 |

合计 4-4.5 天，符合主 spec §4.7 估的 4-6 天。

---

## 8. 测试策略

| 测试类型 | 文件 | case 数 | 验证内容 |
|---|---|---|---|
| **xiaoyan seed 单测** | `__tests__/seed-employees.test.ts`（如已存在则扩） | 1 | xiaoyan 9 位员工 seed 后 EMPLOYEE_CORE_SKILLS 绑定 3 个 core skill |
| **research_query_builder tool** | `__tests__/research-query-builder.test.ts` | 4 | 正常 user_intent 输出合理 conditions / district 名找不到走 LLM 回退 / topic 名找不到 / >10 conditions 抛 zod error |
| **data_pivoter tool** | `__tests__/data-pivoter.test.ts` | 3 | 基础透视 / 含 filter / 无 current_report_id（不计算 preview）|
| **detectMentionSwitch** | `__tests__/mention-switch.test.ts` | 3 | 合法 `@xiaolei` / 非法 `@unknown` / 无 `@` |
| **EMPLOYEE_META 完整性** | `__tests__/employee-meta.test.ts`（如已存在则扩） | 1 | xiaoyan 在 EmployeeId / EMPLOYEE_META / EMPLOYEE_SHORT_DESC 三处都注册一致 |

合计 12 case。LLM 调用全部 mock（不实际打 API）；DB 用真实 supabase（与 A4 测试模式一致）。

---

## 9. 边界 / 已知不做

### 9.1 A6 范围内但延后（如时间紧张可砍）

- chat input `@` autocomplete 的搜索过滤（先列全 9 位，输入字符过滤是 nice-to-have）
- 切换 employee 后历史 message 上下文传递的 token budget 控制（默认传最近 5 条）

### 9.2 明确不在 A6 范围

- `topic_classifier` skill — Wave 2 W2.5（语义匹配）一并做
- `outlet_classifier` skill — Wave 2 follow-up（A1 outlet-recognizer 自动跑覆盖 90%+，长尾按客户反馈）
- chat 多员工**并行**对话（多人协作 group chat）— Wave 2
- chat **持久会话** persistence（每次 chat 是一次性会话）— Wave 2 chat history 模块
- xiaoyan 的"已学习模式"（learnedPatterns）从其他员工迁移 — N/A，新员工冷启动
- xiaoyan 的 png/jpg 头像资源（保持 lucide icon）— 与 8 位现有员工对齐
- A5 的 `report_drafter` 实施回流到 chat tool（A5 是 Inngest backend job，不进 chat tool）
- 多语言（仅中文）

---

## 10. 与 A5 的执行顺序（硬依赖）

A6 ship → A5 ship 是硬依赖序列：

1. **A6 Day 1**：xiaoyan 员工 + 3 skill DB seed（即使 SKILL.md content 还是 stub）
2. **A6 Day 2 完成**：`report_drafter` SKILL.md content 完整 + A5 既有调用调通
3. **A5 Day 0 前置检查**：A5 spec §8 已说明 "验证 xiaoyan + research_drafter skill 已 seed"
4. **A6 Day 4.5 完成 + 验收过**：A5 才能开打 Day 1
5. A5 Day 4 跑 Inngest Step 3 (`generateObject + xiaoyan + report_drafter`) → 调通 = A6 接入完成

注：A6 的 `research_query_builder` / `data_pivoter` 是 chat-first skill，**不阻塞 A5**。A5 可以在 A6 Day 2.5 开打（report_drafter SKILL.md 完成时）—— 工期可压缩 1.5-2 天，重叠开发。**保守建议**：A6 完整 ship + 验收后再开 A5。

---

## 11. 主 spec 修订（A6 实施前 follow-up）

实施 A6 前需 follow-up commit 修订 [`docs/superpowers/specs/2026-05-04-news-research-overhaul-design.md`](./2026-05-04-news-research-overhaul-design.md)：

- §156 行序更新为 `A1 → A2 → A2.5 → A3 → A4 → A6 → A5`（Wave 1 顺序调整）
- §4.7 添加 cross-link 到本 sub-spec
- §4.7 范围说明从 5 skill 修订为 3 skill（report_drafter / research_query_builder / data_pivoter）+ 注明剩 2 skill 的去向（topic_classifier 进 Wave 2 W2.5；outlet_classifier 进 Wave 2 follow-up）

---

## 12. 已采纳的设计原则

- **三件套足够 ship A5 + 完整学术研究员故事**（不堆 5 skill 占工期）
- **完整闭环优于占位**（chat tool + 前端 quick-action 同时 ship，避免"小研只能聊不能干"的客户感知）
- **lucide icon 优于 png 资源**（与现有 8 员工对齐，不增加资源管理负担）
- **`@employee` 是 chat 行业通用习惯**（学术老师能秒上手，不强制 vibetide 自创交互）
- **复用 A4 类型协议**（research_query_builder 输出 = `AdvancedSearchCondition[]` + `SidebarFilter`，与高级检索 1:1 对齐，避免转译层）
- **复用 A5 zod schema**（report_drafter 输出 = A5 已定义的 `ReportParagraphsSchema`，A5 接入零适配）
- **chat tool 增量加法 ≠ chat 架构重写**（仅扩 tool-registry / intent-parser，不动 stream / intent-execute 主流程）
