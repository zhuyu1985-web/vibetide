# AI 数字员工基础架构设计方案

## Context

Vibetide 平台已有完整的 DB schema（14 张表）、DAL 层、Server Actions 和 3 个已迁移页面，但缺少**运行时执行引擎**——即驱动 AI 员工实际完成工作并协同的核心架构。本方案解决两个核心难题：

1. **工作流如何驱动** → Inngest 无服务器工作流引擎
2. **AI 员工如何协同** → 配置驱动 Agent Runtime + 结构化消息传递

---

## 架构总览

```
用户输入目标 (team-hub UI)
      ↓
[Intent Parser] — LLM 解析意图，选择模板，提取参数
      ↓
[Server Action] — 创建 workflow_instance + steps → 发送 Inngest 事件
      ↓
[Inngest 工作流引擎] — 确定性骨架，管理步骤流转
      ↓
┌─ Step N ──────────────────────────────────────┐
│ 1. assembleAgent() — 从 DB 组装 Agent 配置     │
│    (system prompt + tools + model + knowledge) │
│ 2. executeAgent() — Vercel AI SDK 调用 LLM     │
│    (多轮 tool use → 结构化输出)                │
│ 3. 写入 workflow_steps (progress/output)       │
│ 4. 写入 team_messages (status_update)          │
│ 5. 检查审批门控 → waitForEvent 或继续          │
└───────────────────────────────────────────────┘
      ↓ (output 作为下一步 input)
[Supabase Realtime] — 监听 DB 变更 → 推送到前端
```

---

## 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 工作流引擎 | **Inngest** | 专为 Next.js 设计，无基础设施负担，支持 step/waitForEvent/cancelOn |
| LLM 调用 | **Vercel AI SDK** (`ai`) | 统一多模型接口，支持 tool use、streaming、maxSteps |
| 多模型支持 | `@ai-sdk/anthropic` + `@ai-sdk/openai` | 按员工/任务类型路由到最优模型 |
| 实时推送 | **Supabase Realtime** | 已有基础设施，监听 workflow_steps/team_messages 表变更 |
| Agent 模式 | **配置驱动** | 员工行为由 DB 配置组装，自定义员工无需写代码 |

---

## 新增依赖

```bash
pnpm add inngest ai @ai-sdk/anthropic @ai-sdk/openai zod
```

---

## 文件结构

```
新增文件:
├── src/inngest/
│   ├── client.ts                    # Inngest 客户端 (id: "vibetide")
│   ├── events.ts                    # 事件类型定义
│   └── functions/
│       ├── index.ts                 # 函数注册表
│       └── execute-workflow.ts      # 主工作流函数
│
├── src/lib/agent/
│   ├── index.ts                     # 公共 API: assembleAgent, executeAgent
│   ├── types.ts                     # Agent 运行时类型
│   ├── assembly.ts                  # 从 DB 配置组装 Agent
│   ├── prompt-templates.ts          # 系统提示词生成
│   ├── tool-registry.ts            # 技能 → 工具映射
│   ├── model-router.ts             # 多模型路由
│   ├── execution.ts                # 核心执行循环
│   ├── step-io.ts                  # StepOutput 接口与格式化
│   └── tools/                      # 工具实现
│       ├── index.ts
│       ├── web-search.ts           # MVP: stub
│       ├── content-generate.ts     # MVP: stub
│       └── fact-check.ts           # MVP: stub
│
├── src/app/api/inngest/
│   └── route.ts                    # Inngest serve 端点
│
└── src/app/actions/
    └── workflow-engine.ts          # 新 Server Action: startWorkflow, approveStep

修改文件:
├── src/db/schema/enums.ts          # 新增 workflow_step_status 值
├── src/db/schema/workflows.ts      # workflow_steps 新增字段
├── src/db/schema/messages.ts       # team_messages 新增关联字段
├── src/lib/types.ts                # 新增 Agent 相关类型
├── src/middleware.ts               # 排除 /api/inngest 路径
├── .env.local                      # 新增 AI SDK + Inngest 环境变量
└── package.json                    # 新增依赖
```

---

## Phase 1: DB Schema 修改（最小化）

### 1.1 枚举扩展 (`src/db/schema/enums.ts`)

```typescript
export const workflowStepStatusEnum = pgEnum("workflow_step_status", [
  "completed", "active", "pending", "skipped",
  "waiting_approval",  // 新增: 等待人工审批
  "failed",            // 新增: 步骤执行失败
]);
```

### 1.2 workflow_steps 新增字段 (`src/db/schema/workflows.ts`)

```typescript
// 在 workflowSteps 表定义中新增:
structuredOutput: jsonb("structured_output"),  // StepOutput JSON
errorMessage: text("error_message"),           // 错误详情
retryCount: integer("retry_count").default(0), // 重试次数
```

### 1.3 workflow_instances 新增字段

```typescript
inngestRunId: text("inngest_run_id"),          // Inngest 运行 ID
currentStepKey: text("current_step_key"),       // 当前活动步骤
```

### 1.4 team_messages 新增关联字段 (`src/db/schema/messages.ts`)

```typescript
workflowInstanceId: uuid("workflow_instance_id")
  .references(() => workflowInstances.id),     // 关联到工作流实例
workflowStepKey: text("workflow_step_key"),     // 哪个步骤产生的消息
```

### 1.5 types.ts 更新

```typescript
export type WorkflowStepStatus =
  | "completed" | "active" | "pending" | "skipped"
  | "waiting_approval" | "failed";
```

---

## Phase 2: Inngest 集成

### 2.1 Inngest Client (`src/inngest/client.ts`)

```typescript
import { Inngest, EventSchemas } from "inngest";
import type { InngestEvents } from "./events";

export const inngest = new Inngest({
  id: "vibetide",
  schemas: new EventSchemas().fromRecord<InngestEvents>(),
});
```

### 2.2 事件定义 (`src/inngest/events.ts`)

```typescript
export type InngestEvents = {
  "workflow/started": {
    data: {
      workflowInstanceId: string;
      teamId: string;
      organizationId: string;
      topicTitle: string;
      scenario: string;
    };
  };
  "workflow/step-approved": {
    data: {
      workflowInstanceId: string;
      stepId: string;
      approved: boolean;
      feedback?: string;
      approvedBy: string;
    };
  };
  "workflow/cancelled": {
    data: {
      workflowInstanceId: string;
      cancelledBy: string;
    };
  };
};
```

### 2.3 API Route (`src/app/api/inngest/route.ts`)

```typescript
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({ client: inngest, functions });
```

### 2.4 Middleware 排除

```typescript
// src/middleware.ts matcher 中添加 api/inngest 排除
matcher: ["/((?!_next/static|_next/image|favicon.ico|api/inngest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
```

### 2.5 主工作流函数 (`src/inngest/functions/execute-workflow.ts`)

核心逻辑：
1. `step.run("load-workflow")` — 从 DB 加载工作流实例和所有步骤
2. `step.run("load-team-config")` — 加载团队审批规则
3. 遍历步骤，每个步骤执行：
   - `step.run("execute-{stepKey}")` — 调用 Agent Runtime 执行
   - 检查是否需要审批 → `step.waitForEvent("workflow/step-approved", { timeout: "24h" })`
   - 审批通过/驳回/超时处理
4. `step.run("complete-workflow")` — 标记完成

**协作模式在此层实现：**
- **顺序执行**: for 循环遍历步骤，上一步 output 作为下一步 input
- **并行执行**: `Promise.all([step.run("material"), step.run("create")])`
- **条件跳过**: `evaluateSkipCondition(stepKey, scenario, previousOutput)`
- **审批门控**: `step.waitForEvent()` 暂停等待人工操作
- **反馈回退**: 审核员驳回 → 带 feedback 重新执行创作步骤
- **取消支持**: `cancelOn: [{ event: "workflow/cancelled" }]`

---

## Phase 3: Agent Runtime

### 3.1 核心类型 (`src/lib/agent/types.ts`)

```typescript
// 组装完成的 Agent
interface AssembledAgent {
  employeeId: string;
  slug: EmployeeId;
  systemPrompt: string;
  tools: AgentTool[];
  modelConfig: ModelConfig;
  knowledgeContext: string;
  authorityLevel: AuthorityLevel;
}

// 模型配置
interface ModelConfig {
  provider: "openai" | "anthropic";
  model: string;
  temperature: number;
  maxTokens: number;
}

// 步骤间传递的结构化输出
interface StepOutput {
  stepKey: string;
  employeeSlug: EmployeeId;
  summary: string;                  // 人类可读摘要
  artifacts: StepArtifact[];        // 结构化产出物
  metrics?: { qualityScore?: number; wordCount?: number };
  status: "success" | "partial" | "needs_approval";
}

interface StepArtifact {
  id: string;
  type: ArtifactType;  // hot_topic_list | topic_angles | article_draft | ...
  title: string;
  content: string;     // JSON 或 Markdown
}
```

### 3.2 Agent 组装 (`src/lib/agent/assembly.ts`)

```
assembleAgent(employeeId, stepKey)
  ├── 查 ai_employees 表 → 角色、权限、偏好
  ├── 查 employee_skills + skills 表 → 技能列表
  ├── 查 employee_knowledge_bases + knowledge_bases 表 → 知识库
  ├── buildSystemPrompt() → 7 层提示词
  ├── resolveTools() → 技能映射为工具
  └── resolveModelConfig() → 选择模型
```

### 3.3 提示词模板系统 (`src/lib/agent/prompt-templates.ts`)

7 层结构化系统提示词：
1. **身份层**: 角色名、昵称、头衔、座右铭
2. **能力层**: 绑定技能列表 + 熟练度
3. **权限层**: authority level 约束 + 自动/审批操作列表
4. **知识层**: 绑定知识库摘要
5. **风格层**: 工作偏好（主动性、沟通风格等）
6. **学习层**: 已学习的用户偏好
7. **输出层**: 中文、结构化、工具使用规范

上下文注入：
- `formatPreviousStepContext()` — 将上游步骤产出格式化为用户消息
- `buildStepInstruction()` — 步骤特定指令（monitor/plan/create 等各有专属指引）

### 3.4 模型路由 (`src/lib/agent/model-router.ts`)

按技能类别路由到最优模型：

| 类别 | 默认模型 | 理由 |
|------|----------|------|
| perception (感知) | gpt-4o-mini | 搜索快、成本低 |
| analysis (分析) | claude-sonnet | 推理能力强 |
| generation (生成) | claude-sonnet | 中文写作质量高 |
| production (制作) | gpt-4o | 函数调用快 |
| management (管理) | claude-sonnet | 审核判断准确 |
| knowledge (知识) | gpt-4o-mini | 检索快、成本低 |

优先级: 员工 DB 配置 > 步骤覆盖 > 类别默认

### 3.5 工具注册表 (`src/lib/agent/tool-registry.ts`)

- 技能名 → Vercel AI SDK tool 映射
- 有实现的技能注册真实执行器
- 无实现的技能自动生成 stub（让 LLM "模拟"执行）
- `toVercelTool()` 将 AgentTool 转换为 Vercel AI SDK 格式

### 3.6 执行循环 (`src/lib/agent/execution.ts`)

```
executeAgent(agent, input, onProgress)
  ├── 1. 输入验证
  ├── 2. 构建消息: system + previous context + step instruction
  ├── 3. 调用 generateText({ model, messages, tools, maxSteps: 10 })
  │      ├── onStepFinish: 记录 tool calls, 更新 progress
  │      └── 多轮 tool use 直到 LLM 返回最终文本
  ├── 4. 解析输出为 StepOutput（summary + artifacts）
  ├── 5. 检查是否需要审批（基于 authority level + team rules）
  └── 6. 返回 AgentExecutionResult
```

---

## Phase 4: Server Actions & UI 集成

### 4.1 新 Server Action (`src/app/actions/workflow-engine.ts`)

```typescript
"use server";

// 启动工作流
export async function startWorkflow(data: {
  topicTitle: string;
  scenario: string;
  teamId: string;
  templateId: string;
}) {
  const orgId = await requireAuth();
  // 1. createWorkflowInstance (已有)
  // 2. inngest.send({ name: "workflow/started", data: {...} })
}

// 审批步骤
export async function approveWorkflowStep(data: {
  workflowInstanceId: string;
  stepId: string;
  approved: boolean;
  feedback?: string;
}) {
  const orgId = await requireAuth();
  // inngest.send({ name: "workflow/step-approved", data: {...} })
}

// 取消工作流
export async function cancelWorkflow(workflowInstanceId: string) {
  const orgId = await requireAuth();
  // inngest.send({ name: "workflow/cancelled", data: {...} })
}
```

### 4.2 Supabase Realtime 订阅 (客户端)

在 team-hub-client.tsx 中：
- 订阅 `workflow_steps` 表变更 → 实时更新 WorkflowPipeline 进度
- 订阅 `team_messages` 表插入 → 实时追加 ActivityFeed 消息

---

## Phase 5: 环境变量

```env
# .env.local 新增
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
INNGEST_EVENT_KEY=...          # 生产环境
INNGEST_SIGNING_KEY=...        # 生产环境
```

---

## 员工协同机制总结

### 问题 1: 工作流如何驱动？

**Inngest step functions** 提供持久化执行：
- 每个步骤是一个 `step.run()` 调用，Inngest 保证 exactly-once 执行
- 步骤间数据通过返回值自动传递（Inngest 持久化中间状态）
- 审批门控通过 `step.waitForEvent()` 实现，支持 24h 超时
- 工作流可取消（`cancelOn` 事件匹配）
- 失败自动重试（per-step 配置）

### 问题 2: AI 员工如何协同？

**结构化消息传递 + 配置驱动 Agent**：
- 每个员工的 Agent 从 DB 配置动态组装（prompt + tools + model + knowledge）
- 步骤间通过 `StepOutput` 结构化传递数据（summary + artifacts）
- 上游步骤的输出被格式化注入为下游步骤的输入上下文
- 协调层（Inngest 函数）管理流转逻辑：顺序、并行、条件跳过、审批门控、反馈回退
- 实时通信通过 `team_messages` 表 + Supabase Realtime 推送到 UI

---

## 实施顺序

| 步骤 | 内容 | 依赖 |
|------|------|------|
| 1 | DB schema 修改 + migration | 无 |
| 2 | 安装依赖 (inngest, ai, @ai-sdk/*) | 无 |
| 3 | Agent Runtime 核心 (types, assembly, prompt-templates, model-router, tool-registry, execution) | 步骤 2 |
| 4 | Inngest 集成 (client, events, API route, execute-workflow) | 步骤 1, 3 |
| 5 | Server Actions (startWorkflow, approveStep, cancelWorkflow) | 步骤 4 |
| 6 | Middleware 修改 + 环境变量 | 步骤 4 |
| 7 | 工具 stub 实现 (tools/) | 步骤 3 |
| 8 | Supabase Realtime 客户端订阅 | 步骤 1 |

---

## 验证方案

1. **单元测试**: assembleAgent、buildSystemPrompt、resolveModelConfig 纯函数测试
2. **集成测试**:
   - `pnpm inngest-cli dev` 启动 Inngest 开发服务器
   - 通过 Server Action 触发工作流
   - 验证 workflow_steps 表状态变更
   - 验证 team_messages 表消息生成
3. **端到端验证**:
   - 在 team-hub 页面输入目标 → 观察 WorkflowPipeline 实时进度更新
   - 审批门控: 观察流程暂停 → 点击审批按钮 → 观察流程继续
   - 取消: 点击取消按钮 → 验证工作流停止
4. **类型检查**: `npx tsc --noEmit` 确保无类型错误
