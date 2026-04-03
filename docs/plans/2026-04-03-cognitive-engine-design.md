# 认知引擎（Cognitive Engine）设计文档

> 日期：2026-04-03
> 状态：已确认

## 1. 概述

### 1.1 目标

围绕 4 个核心能力重构智能员工的对话、任务执行和协作体系：

1. **意图深度理解** — 基于上下文 + 记忆自动推断，置信度不足时多轮追问
2. **技能学习与发现** — proficiency 动态变化 + 技能组合进化 + 技能缺口检测
3. **动态创建流程** — 模板匹配 + 动态生成混合，成功流程自动沉淀为模板
4. **结果验证与记忆学习** — 分级验证（自评/交叉/人工）+ 成功模式/失败教训/用户偏好沉淀

### 1.2 实施顺序

| 阶段 | 核心 | 理由 |
|------|------|------|
| Phase 1 | 结果验证与记忆学习 | 闭环根基，memory 表已有，改动最小价值最高 |
| Phase 2 | 意图深度理解 | 利用记忆提升推断准确度，在现有框架上增强 |
| Phase 3 | 动态创建流程 | 依赖意图输出 + 记忆沉淀的模板 |
| Phase 4 | 技能学习与发现 | 需要大量执行数据积累 |

### 1.3 架构方案

引入认知引擎层（`src/lib/cognitive/`），统一管理 4 个子系统的生命周期。现有 agent assembly/execution 作为底层执行单元不变。

## 2. 整体架构

### 2.1 模块结构

```
src/lib/cognitive/
├── engine.ts              — 引擎入口，协调 4 个子系统
├── intent-resolver.ts     — 意图深度理解
├── flow-planner.ts        — 流程规划（模板匹配+动态生成）
├── flow-executor.ts       — 流程执行（DAG调度+自适应规则）
├── skill-manager.ts       — 技能学习、发现、组合推荐
├── verify-learner.ts      — 分级验证 + 记忆沉淀
└── types.ts               — 统一类型定义
```

### 2.2 核心数据流

```
用户消息
  ↓
CognitiveEngine.process(message, context)
  │
  ├─① IntentResolver.resolve(message, history, memories, preferences)
  │    → DeepIntent { type, entities, confidence, ambiguities, suggestedFlow }
  │    → 如果 confidence < 0.5 → 返回 ClarificationRequest（中断流程，追问用户）
  │    → 如果 confidence ≥ 0.5 → 继续
  │
  ├─② FlowOrchestrator.plan(deepIntent, skillRecommendations)
  │    → 匹配模板 or 动态生成 DAG
  │    → ExecutionPlan { steps[], adaptiveRules[] }
  │
  ├─③ FlowOrchestrator.execute(plan)
  │    → 逐步执行，每步调用现有 agent execution
  │    → 步骤失败时触发 adaptiveRules（重试/替换/插入修复步骤）
  │    → 每步产出 → VerifyLearner 实时验证
  │
  ├─④ VerifyLearner.verify(stepOutput, verificationLevel)
  │    → simple: AI 自评
  │    → important: 交叉验证（另一员工审核）
  │    → critical: 标记需人工确认
  │    → 验证结果 → 写入记忆
  │
  └─⑤ SkillManager.learn(executionRecord)
       → 更新 proficiency
       → 发现技能组合模式
       → 记录成功/失败模式
```

### 2.3 与现有模块的关系

| 新模块 | 复用的现有模块 | 替代的现有模块 |
|--------|-------------|-------------|
| IntentResolver | `intent-recognition.ts`（增强） | `intent-parser.ts`（统一替代） |
| FlowOrchestrator | `agent/assembly.ts` + `agent/execution.ts`（底层调用） | `mission-executor.ts`（替代其编排逻辑） |
| SkillManager | `employee_skills` 表 + `skills` 表 | — |
| VerifyLearner | `employee_memories` 表 | — |
| CognitiveEngine | — | 协调层，新增 |

**关键原则**：agent 的 assembly 和 execution 不动，它们是底层执行单元。认知引擎负责"决定做什么、怎么做、做完怎么评价"。

**意图系统统一说明**：当前存在两套意图系统：
- `intent-parser.ts`：任务系统使用，6 种 IntentType（`breaking_news`、`deep_report` 等），输出 `ParsedIntent` + `SuggestedStep[]`
- `intent-recognition.ts`：对话中心使用，8 种 ChatIntentType（`information_retrieval`、`content_creation` 等），输出 `IntentResult` + `IntentStep[]`

IntentResolver 将**统一替代两者**。采用 `intent-recognition.ts` 的 8 种意图类型作为基础（覆盖面更广），同时吸收 `intent-parser.ts` 的 scale/timeConstraint 概念到 `DeepIntent.entities` 中。迁移完成后两个旧文件标记为 deprecated。

## 3. 数据库 Schema 变更

### 3.1 新增表

#### `flow_templates` — 流程模板表

```sql
CREATE TABLE flow_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  name              TEXT NOT NULL,
  description       TEXT,
  scenario          TEXT,
  steps             JSONB NOT NULL,        -- [{title, employeeSlug, skills[], deps[], expectedOutput}]
  adaptive_rules    JSONB DEFAULT '[]',    -- [{condition, action}]
  success_count     INT NOT NULL DEFAULT 0,
  avg_quality_score REAL,
  source            TEXT NOT NULL DEFAULT 'system', -- 'system' | 'learned' | 'user_saved'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flow_templates_lookup
  ON flow_templates (organization_id, scenario, success_count DESC);
```

#### `skill_combo_patterns` — 技能组合发现表

> 注意：现有 `skill_combos` 表用于存储手动配置的技能执行链（含 sequential/passOutput 配置），语义不同。新表命名为 `skill_combo_patterns` 以区分——本表存储从执行数据中自动发现的统计模式。

```sql
CREATE TABLE skill_combo_patterns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  skill_ids         TEXT[] NOT NULL,
  skill_names       TEXT[] NOT NULL,
  scenario          TEXT,
  usage_count       INT NOT NULL DEFAULT 0,
  success_rate      REAL,
  avg_quality_score REAL,
  last_used_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skill_combo_patterns_lookup
  ON skill_combo_patterns (organization_id, scenario, success_rate DESC);
```

#### `verification_records` — 验证记录表

```sql
CREATE TABLE verification_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id),
  mission_id            UUID REFERENCES missions(id),
  task_id               UUID REFERENCES mission_tasks(id),
  conversation_id       UUID REFERENCES saved_conversations(id),
  verification_level    TEXT NOT NULL,          -- 'simple' | 'important' | 'critical'
  verifier_type         TEXT NOT NULL,          -- 'self_eval' | 'cross_review' | 'human'
  verifier_employee_id  UUID REFERENCES ai_employees(id),
  quality_score         REAL NOT NULL,
  passed                BOOLEAN NOT NULL,
  feedback              TEXT,
  issues_found          JSONB DEFAULT '[]',    -- [{type, description, severity}]
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 扩展现有表

#### `employee_memories` 新增字段

```sql
ALTER TABLE employee_memories
  ADD COLUMN source_task_id UUID REFERENCES mission_tasks(id),
  ADD COLUMN confidence     REAL NOT NULL DEFAULT 1.0,
  ADD COLUMN decay_rate     REAL NOT NULL DEFAULT 0.01;
```

**memory_type 枚举扩展**：现有值为 `feedback`、`pattern`、`preference`。新增 4 个值：

```sql
-- 注意：ALTER TYPE ... ADD VALUE 不能在事务内执行，需单独迁移文件
ALTER TYPE memory_type ADD VALUE IF NOT EXISTS 'success_pattern';
ALTER TYPE memory_type ADD VALUE IF NOT EXISTS 'failure_lesson';
ALTER TYPE memory_type ADD VALUE IF NOT EXISTS 'user_preference';
ALTER TYPE memory_type ADD VALUE IF NOT EXISTS 'skill_insight';
```

> 语义说明：现有 `pattern` 用于通用行为模式，`success_pattern` 专指验证通过的成功做法；现有 `preference` 用于通用偏好，`user_preference` 专指从用户手动修改中学到的偏好。新旧值共存，不迁移旧数据。

#### `employee_skills` 新增字段

```sql
ALTER TABLE employee_skills
  ADD COLUMN usage_count      INT NOT NULL DEFAULT 0,
  ADD COLUMN success_count    INT NOT NULL DEFAULT 0,
  ADD COLUMN last_quality_avg REAL,
  ADD COLUMN learned_at       TIMESTAMPTZ,
  ADD COLUMN learning_source  TEXT NOT NULL DEFAULT 'assigned'; -- 'assigned' | 'discovered' | 'recommended'
```

### 3.3 不需要改动的表

- `missions`、`missionTasks` — 结构够用，ExecutionPlan 产出直接映射
- `skills` — 技能定义不变，变的是员工与技能的关系
- `intent_logs` — 保持现有结构，IntentResolver 继续写入

## 4. 子系统详细设计

### 4.1 IntentResolver — 意图深度理解

**文件：** `src/lib/cognitive/intent-resolver.ts`

#### 输入/输出

```typescript
interface DeepIntent {
  type: IntentType;                // 沿用现有 8 种意图类型
  confidence: number;              // 0.0-1.0
  entities: {
    topic?: string;
    platform?: string;
    style?: string;
    audience?: string;
    deadline?: string;
    [key: string]: string | undefined;
  };
  inferredContext: {
    userPreferences: string[];     // "用户偏好短视频"
    relatedMemories: string[];     // 关联的员工记忆
    recentPatterns: string[];      // "最近3次都在做热点追踪"
  };
  suggestedFlow?: string;          // 推荐的流程模板 ID
  suggestedSkills: string[];       // 推荐使用的技能
  reasoning: string;
}

interface ClarificationRequest {
  type: 'clarification';
  question: string;                // "您希望针对什么平台发布？"
  options?: string[];              // ["微信公众号", "抖音", "微博", "不限"]
  partialIntent: Partial<DeepIntent>;
}
```

#### 核心逻辑

1. **上下文组装**：对话历史（最近 10 轮）+ 员工记忆（按相关性排序 top 5）+ 用户历史偏好（从 intent_logs 聚合）
2. **LLM 推断**：一次调用完成意图分类 + 实体提取 + 上下文补全
3. **置信度决策**：
   - ≥ 0.85 → 直接执行
   - 0.5 ~ 0.85 → 展示推断结果让用户确认/编辑
   - < 0.5 → 返回 `ClarificationRequest`，追问用户
4. **模板匹配**：用 intent type + entities 查询 `flow_templates`，成功率高的优先推荐

#### 与现有系统的关系

替换 `intent-recognition.ts` 的 `recognizeIntent()` 函数。API 路由 `/api/chat/intent` 改为调用 `IntentResolver.resolve()`。

### 4.2 FlowOrchestrator — 流程编排

拆分为两个职责清晰的子模块：

**文件：**
- `src/lib/cognitive/flow-planner.ts` — 规划（模板匹配 + 动态生成）
- `src/lib/cognitive/flow-executor.ts` — 执行（DAG 调度 + 自适应规则）

#### 输入/输出

```typescript
interface ExecutionPlan {
  id: string;
  sourceType: 'template' | 'dynamic' | 'hybrid';
  templateId?: string;
  steps: PlanStep[];
  adaptiveRules: AdaptiveRule[];
  estimatedTokens: number;
  verificationTokenBudget: number;  // 验证步骤的 token 预算（自评~500/次, 交叉~2000/次）
  verificationLevel: 'simple' | 'important' | 'critical';
}

interface PlanStep {
  index: number;
  title: string;
  description: string;
  employeeSlug: string;
  skills: string[];
  dependencies: number[];
  expectedOutput: string;
  verificationLevel: 'simple' | 'important' | 'critical';
  timeout: number;              // 单步超时（秒），优先于 mission.config.task_timeout
}

interface AdaptiveRule {
  condition: 'step_failed' | 'quality_below' | 'timeout' | 'budget_exceeded';
  threshold?: number;
  targetStep: number | null;    // null = 全局规则
  action: 'retry' | 'substitute_employee' | 'insert_fix_step' | 'skip' | 'abort';
  maxRetries?: number;
  fallbackEmployeeSlug?: string;
}
```

#### FlowPlanner 核心逻辑

1. **模板匹配**：查询 `flow_templates`，按 scenario + success_count 排序
2. **动态调整**：即使用了模板，也根据 DeepIntent 的 entities 调整步骤
3. **纯动态生成**：无匹配模板时，由 Leader + LLM 从零构建（沿用 `leaderPlanDirect` 分解逻辑，输出格式改为 ExecutionPlan）
4. **自适应规则生成**：根据 verificationLevel 自动附加规则
   - critical 步骤失败 → 重试 2 次再 abort
   - simple 步骤失败 → skip
5. **Token 预算估算**：`estimatedTokens`（执行）+ `verificationTokenBudget`（验证开销）合计不超过 mission.tokenBudget

#### FlowExecutor 核心逻辑

1. **DAG 执行**：逐步执行，每步完成后调用 VerifyLearner 验证，不通过则触发 AdaptiveRule
2. **自适应调整**：匹配 adaptiveRules，执行对应 action（重试/替换员工/插入修复步骤/跳过/中止）
3. **流程沉淀**：整体质量 ≥ 80 分时，自动保存为 `flow_templates`（source='learned'）
4. **降级策略**：沿用现有 4 级降级（100%/70%/30%/<30%），在 FlowExecutor 中实现

#### 与现有系统的关系

替代 `mission-executor.ts` 中的 `executeAllTasksDirect()` 编排逻辑。底层仍调用 `executeTaskDirect()` 执行单个任务。

### 4.3 SkillManager — 技能学习与发现

**文件：** `src/lib/cognitive/skill-manager.ts`

无独立执行环节，作为其他子系统的观察者和顾问。

#### 输入/输出

```typescript
interface SkillRecommendation {
  skillIds: string[];
  skillNames: string[];
  reason: string;              // "历史数据显示该组合成功率 92%"
  comboId?: string;
  confidence: number;
}

interface SkillLearningResult {
  proficiencyUpdates: Array<{
    employeeId: string;
    skillId: string;
    oldLevel: number;
    newLevel: number;
    reason: string;
  }>;
  newCombosDiscovered: Array<{
    skillNames: string[];
    scenario: string;
    successRate: number;
  }>;
  skillGapDetected?: {
    employeeSlug: string;
    missingSkill: string;
    reason: string;
  };
}
```

#### 核心逻辑

1. **技能推荐**（被 FlowPlanner 调用）：根据 intent type + scenario 查询 `skill_combo_patterns`，按 success_rate 排序
2. **执行后学习**（被 VerifyLearner 调用）：
   - 质量 ≥ 80 → proficiency += (基础 3 + 质量加成)
   - 质量 < 60 → proficiency -= (基础 2)
   - proficiency 钳位在 [0, 100]
   - **并发安全**：使用原子 SQL 更新 `SET level = GREATEST(0, LEAST(100, level + delta))`，避免多任务并发时的读写竞争
3. **组合发现**：相同 skill 组合出现 ≥ 3 次且成功率 ≥ 70% → 写入 `skill_combo_patterns`
4. **技能缺口检测**：执行失败且 errorMessage 暗示技能不足 → 记录 skillGap

### 4.4 VerifyLearner — 分级验证与记忆沉淀

**文件：** `src/lib/cognitive/verify-learner.ts`

#### 输入/输出

```typescript
interface VerificationResult {
  passed: boolean;
  qualityScore: number;        // 0-100
  level: 'simple' | 'important' | 'critical';
  verifierType: 'self_eval' | 'cross_review' | 'human';
  feedback: string;
  issues: Array<{
    type: 'accuracy' | 'completeness' | 'style' | 'compliance';
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  memoriesGenerated: Array<{
    type: 'success_pattern' | 'failure_lesson' | 'user_preference';
    content: string;
    importance: number;
  }>;
}
```

#### 验证等级判定规则

| 条件 | 等级 |
|------|------|
| 通用对话、信息查询 | simple |
| 内容创作、数据分析 | important |
| 对外发布、多步骤任务的最终产出 | critical |

#### 核心逻辑

1. **Simple 验证**：同一员工自评，用 LLM 打分（沿用 100 分制）。自评 < 60 触发重做
2. **Important 验证**：指定审核员工交叉评审。优先选择 `xiaoshen`（小审），若 `xiaoshen` 正在执行同一任务中的其他步骤（状态为 `working`），则按技能匹配度选择其他空闲员工作为审核者。自评和交叉评审取较低分
3. **Critical 验证**：交叉评审 + 标记 `needs_human_review`，流程暂停等待用户确认
4. **记忆沉淀**（所有等级）：
   - 通过 → 生成 `success_pattern` 记忆
   - 失败 → 生成 `failure_lesson` 记忆
   - 用户手动修改产出 → 生成 `user_preference` 记忆
   - 记忆用 LLM 生成摘要，importance 基于质量分差值
5. **记忆衰减**：旧记忆 `confidence -= decay_rate`，低于 0.3 时不再注入 prompt

## 5. API 变更

### 5.1 `/api/chat/intent`（增强）

```diff
- 调用 recognizeIntent()
+ 调用 IntentResolver.resolve()
+ 新增 SSE 事件: 'clarification' — 返回追问问题
+ 新增 SSE 事件: 'context_inferred' — 返回推断的上下文信息
```

### 5.2 `/api/chat/intent-execute`（增强）

```diff
- 直接遍历 steps 执行
+ 调用 FlowExecutor.execute(plan)
+ 新增 SSE 事件: 'verification' — 返回每步验证结果
+ 新增 SSE 事件: 'adaptive_action' — 返回自适应调整动作
+ 新增 SSE 事件: 'skill_learned' — 返回技能学习结果
```

### 5.3 `/api/missions/execute`（替换）

```diff
- 调用 executeMissionDirect()
+ 调用 CognitiveEngine.executeMission()
  内部调用 FlowPlanner + FlowExecutor + VerifyLearner + SkillManager
```

## 6. 前端影响

### 6.1 对话中心

- 新增 `ClarificationBubble` 组件：展示追问问题 + 选项按钮
- `IntentResultBubble` 增加 `inferredContext` 展示区（用户可看到 AI 推断的依据）
- 新增 `VerificationBubble` 组件：展示验证结果（质量分、问题列表）
- 新增 `SkillLearnedBubble` 组件：展示技能成长提示

### 6.2 任务中心

- 任务卡片增加验证状态标识（自评通过 / 交叉验证通过 / 待人工确认）
- 新增 `AdaptiveActionLog`：展示流程自适应调整记录

### 6.3 技能管理

- 技能详情页增加"使用统计"面板（usage_count, success_rate）
- 新增"技能组合"页面：展示 `skill_combo_patterns` 数据
- 新增"技能缺口"提醒区域

### 6.4 流程模板管理（新页面）

- 展示所有 flow_templates（系统预置 + AI 学习 + 用户保存）
- 支持查看模板步骤、成功率、使用次数
- 支持手动创建/编辑模板

## 7. 分阶段实施说明

### Phase 1：结果验证与记忆学习

**接入点**：Phase 1 先接入现有的 `mission-executor.ts` 和 `/api/chat/intent-execute` 路由，而非等 FlowOrchestrator（Phase 3）就绪。具体做法：
- 在 `executeTaskDirect()` 完成后调用 `VerifyLearner.verify()`
- 在 `/api/chat/intent-execute` 每步执行完成后调用 `VerifyLearner.verify()`
- 验证结果写入 `verification_records`，记忆写入 `employee_memories`
- SkillManager 的 proficiency 更新也在此阶段开始（作为 VerifyLearner 的下游回调）

**不包含**：交叉验证（需要 FlowExecutor 的协调），Phase 1 仅实现 simple 级别的 AI 自评 + 记忆沉淀。

### Phase 2：意图深度理解

**前置条件**：Phase 1 的记忆系统已运行，积累了用户偏好和成功模式数据。
**接入点**：替换 `/api/chat/intent` 路由中的 `recognizeIntent()` 调用为 `IntentResolver.resolve()`。

### Phase 3：动态创建流程

**前置条件**：Phase 1 + Phase 2 完成。
**接入点**：FlowPlanner + FlowExecutor 替代 `mission-executor.ts` 的编排逻辑。此阶段启用 important/critical 级别的交叉验证。

### Phase 4：技能学习与发现

**前置条件**：Phase 1-3 完成，已积累足够的执行数据。
**接入点**：SkillManager 的组合发现和技能缺口检测上线。

### CognitiveEngine 错误处理

引擎协调层采用与现有 `mission-executor.ts` 一致的降级策略：
- IntentResolver 失败 → 退回到现有 `recognizeIntent()` 作为 fallback
- FlowPlanner 失败 → 退回到 `leaderPlanDirect()` 动态分解
- FlowExecutor 中某步失败 → 触发 AdaptiveRule，最终按 4 级降级处理
- VerifyLearner 失败 → 跳过验证，不阻塞执行流程（记录错误日志）
- SkillManager 失败 → 跳过学习，不影响任何执行路径
