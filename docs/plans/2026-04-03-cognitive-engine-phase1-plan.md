# 认知引擎 Phase 1：结果验证与记忆学习 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为任务执行和对话执行接入分级验证（AI 自评）+ 记忆沉淀（成功模式/失败教训/用户偏好）+ 基础 proficiency 更新。

**Architecture:** 新建 `src/lib/cognitive/` 模块，实现 VerifyLearner（自评 + 记忆生成）和 SkillManager（proficiency 原子更新）。Phase 1 仅实现 simple 级别验证（同一员工自评），不含交叉验证。将 VerifyLearner 接入现有 `mission-executor.ts`（任务完成后）和 `/api/chat/intent-execute`（每步完成后）。

**Tech Stack:** Next.js 16, Drizzle ORM, Supabase PostgreSQL, AI SDK v6 (generateText), DeepSeek LLM

**设计文档：** `docs/plans/2026-04-03-cognitive-engine-design.md`

---

## File Structure

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/db/schema/verification-records.ts` | verification_records 表定义 |
| `src/lib/cognitive/types.ts` | 认知引擎共享类型（VerificationResult, SkillLearningResult 等） |
| `src/lib/cognitive/verify-learner.ts` | 分级验证 + 记忆沉淀核心逻辑 |
| `src/lib/cognitive/skill-manager.ts` | proficiency 原子更新 + usage 统计 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/db/schema/enums.ts` | memoryTypeEnum 新增 4 个值 + 新增 verificationLevelEnum、verifierTypeEnum、learningSourceEnum |
| `src/db/schema/employee-memories.ts` | 新增 source_task_id, confidence, decay_rate 字段 |
| `src/db/schema/skills.ts` | employeeSkills 新增 usage_count, success_count, last_quality_avg, learned_at, learning_source 字段 |
| `src/db/schema/index.ts` | 导出 verification-records |
| `src/lib/mission-executor.ts` | executeTaskDirect 完成后调用 VerifyLearner |
| `src/app/api/chat/intent-execute/route.ts` | 每步完成后调用 VerifyLearner |
| `src/lib/agent/assembly.ts` | 记忆加载时过滤 confidence < 0.3 的记忆，更新 accessCount 时应用衰减 |

---

## Task 1: Schema — memoryTypeEnum 扩展

**Files:**
- Modify: `src/db/schema/enums.ts:341-345`

- [ ] **Step 1: 在 memoryTypeEnum 中添加新值**

在 `src/db/schema/enums.ts` 中，将 memoryTypeEnum 从：
```typescript
export const memoryTypeEnum = pgEnum("memory_type", [
  "feedback",
  "pattern",
  "preference",
]);
```
改为：
```typescript
export const memoryTypeEnum = pgEnum("memory_type", [
  "feedback",
  "pattern",
  "preference",
  "success_pattern",
  "failure_lesson",
  "user_preference",
  "skill_insight",
]);
```

- [ ] **Step 2: 添加 verificationLevelEnum、verifierTypeEnum、learningSourceEnum**

在同一文件 `src/db/schema/enums.ts` 末尾添加：
```typescript
export const verificationLevelEnum = pgEnum("verification_level", [
  "simple",
  "important",
  "critical",
]);

export const verifierTypeEnum = pgEnum("verifier_type", [
  "self_eval",
  "cross_review",
  "human",
]);

export const learningSourceEnum = pgEnum("learning_source", [
  "assigned",
  "discovered",
  "recommended",
]);
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误（枚举值扩展向后兼容）

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/enums.ts
git commit -m "feat(cognitive): add verification/learning enums to schema"
```

---

## Task 2: Schema — employee_memories 表扩展

**Files:**
- Modify: `src/db/schema/employee-memories.ts`

- [ ] **Step 1: 添加新字段到 employeeMemories 表**

在 `src/db/schema/employee-memories.ts` 中，在 `lastAccessedAt` 字段之后添加：
```typescript
  sourceTaskId: uuid("source_task_id"),  // 产生该记忆的任务（可选）
  confidence: real("confidence").notNull().default(1.0),  // 记忆可信度，随时间衰减
  decayRate: real("decay_rate").notNull().default(0.01),   // 每次未验证时衰减幅度
```

注意：`sourceTaskId` 不加外键约束（避免循环依赖，mission_tasks 可能不存在于同一迁移中）。

- [ ] **Step 2: 更新 employeeMemoriesRelations**

在同一文件中，更新 `employeeMemoriesRelations`，在 `organization` relation 之后添加：
```typescript
    sourceTask: one(missionTasks, {
      fields: [employeeMemories.sourceTaskId],
      references: [missionTasks.id],
    }),
```

并在文件顶部添加 import：
```typescript
import { missionTasks } from "./missions";
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/employee-memories.ts
git commit -m "feat(cognitive): add confidence, decayRate, sourceTaskId to employeeMemories"
```

---

## Task 3: Schema — employee_skills 表扩展

**Files:**
- Modify: `src/db/schema/skills.ts:59-72`

- [ ] **Step 1: 添加新字段到 employeeSkills 表**

在 `src/db/schema/skills.ts` 的 `employeeSkills` 表定义中，在 `bindingType` 字段之后、`createdAt` 之前添加：
```typescript
  usageCount: integer("usage_count").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  lastQualityAvg: real("last_quality_avg"),
  learnedAt: timestamp("learned_at", { withTimezone: true }),
  learningSource: learningSourceEnum("learning_source").notNull().default("assigned"),
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/db/schema/skills.ts
git commit -m "feat(cognitive): add usage tracking fields to employeeSkills"
```

---

## Task 4: Schema — verification_records 新表

**Files:**
- Create: `src/db/schema/verification-records.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1: 创建 verification_records 表定义**

创建 `src/db/schema/verification-records.ts`：
```typescript
import {
  pgTable,
  uuid,
  timestamp,
  real,
  boolean,
  jsonb,
  text,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { missions, missionTasks } from "./missions";
import { aiEmployees } from "./ai-employees";
import { savedConversations } from "./saved-conversations";
import { verificationLevelEnum, verifierTypeEnum } from "./enums";

export const verificationRecords = pgTable("verification_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  missionId: uuid("mission_id").references(() => missions.id),
  taskId: uuid("task_id").references(() => missionTasks.id),
  conversationId: uuid("conversation_id").references(() => savedConversations.id),
  verificationLevel: verificationLevelEnum("verification_level").notNull(),
  verifierType: verifierTypeEnum("verifier_type").notNull(),
  verifierEmployeeId: uuid("verifier_employee_id").references(() => aiEmployees.id),
  qualityScore: real("quality_score").notNull(),
  passed: boolean("passed").notNull(),
  feedback: text("feedback"),
  issuesFound: jsonb("issues_found")
    .$type<Array<{ type: string; description: string; severity: string }>>()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("idx_verification_org_mission").on(table.organizationId, table.missionId),
  index("idx_verification_task").on(table.taskId),
  index("idx_verification_verifier").on(table.verifierEmployeeId),
]);

export const verificationRecordsRelations = relations(
  verificationRecords,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [verificationRecords.organizationId],
      references: [organizations.id],
    }),
    mission: one(missions, {
      fields: [verificationRecords.missionId],
      references: [missions.id],
    }),
    task: one(missionTasks, {
      fields: [verificationRecords.taskId],
      references: [missionTasks.id],
    }),
    conversation: one(savedConversations, {
      fields: [verificationRecords.conversationId],
      references: [savedConversations.id],
    }),
    verifier: one(aiEmployees, {
      fields: [verificationRecords.verifierEmployeeId],
      references: [aiEmployees.id],
    }),
  })
);
```

- [ ] **Step 2: 在 schema/index.ts 中导出**

在 `src/db/schema/index.ts` 末尾添加：
```typescript
// Cognitive Engine (2026-04-03)
export * from "./verification-records";
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/verification-records.ts src/db/schema/index.ts
git commit -m "feat(cognitive): add verification_records table"
```

---

## Task 5: Schema — 推送迁移到数据库

**Files:**
- Generated: `supabase/migrations/` (由 drizzle-kit 生成)

- [ ] **Step 1: 生成迁移文件**

Run: `npm run db:generate`
检查生成的 SQL 文件，确保包含：
- ALTER TYPE memory_type ADD VALUE (4 个新值)
- ALTER TABLE employee_memories ADD COLUMN (3 个新列)
- ALTER TABLE employee_skills ADD COLUMN (5 个新列)
- CREATE TABLE verification_records

- [ ] **Step 2: 推送到数据库**

Run: `npm run db:push`
Expected: 成功应用所有变更

注意：如果 `ALTER TYPE ... ADD VALUE` 在事务中失败，需要手动在 Supabase SQL Editor 中执行这些语句（它们不能在事务内运行）。

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(cognitive): database migration for Phase 1 schema changes"
```

---

## Task 6: 认知引擎类型定义

**Files:**
- Create: `src/lib/cognitive/types.ts`

- [ ] **Step 1: 创建类型定义文件**

创建 `src/lib/cognitive/types.ts`：
```typescript
/**
 * Cognitive Engine — shared type definitions.
 * Phase 1: VerifyLearner + basic SkillManager types.
 */

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export type VerificationLevel = "simple" | "important" | "critical";
export type VerifierType = "self_eval" | "cross_review" | "human";

export interface VerificationInput {
  /** The text output to verify */
  output: string;
  /** Task/step context for the verifier */
  taskTitle: string;
  taskDescription: string;
  expectedOutput?: string;
  /** Who produced this output */
  employeeId: string;
  employeeSlug: string;
  /** Optional mission/task IDs for record-keeping */
  missionId?: string;
  taskId?: string;
  organizationId: string;
  /** Intent type helps determine verification level */
  intentType?: string;
}

export interface VerificationIssue {
  type: "accuracy" | "completeness" | "style" | "compliance";
  description: string;
  severity: "low" | "medium" | "high";
}

export interface GeneratedMemory {
  type: "success_pattern" | "failure_lesson" | "user_preference" | "skill_insight";
  content: string;
  importance: number;
}

export interface VerificationResult {
  passed: boolean;
  qualityScore: number;        // 0-100
  level: VerificationLevel;
  verifierType: VerifierType;
  feedback: string;
  issues: VerificationIssue[];
  memoriesGenerated: GeneratedMemory[];
}

// ---------------------------------------------------------------------------
// Skill Learning
// ---------------------------------------------------------------------------

export interface ProficiencyUpdate {
  employeeId: string;
  skillId: string;
  oldLevel: number;
  newLevel: number;
  reason: string;
}

export interface SkillLearningInput {
  employeeId: string;
  skillIds: string[];          // skills used in the execution
  qualityScore: number;
  passed: boolean;
  taskId?: string;
  organizationId: string;
}

export interface SkillLearningResult {
  proficiencyUpdates: ProficiencyUpdate[];
}

// ---------------------------------------------------------------------------
// Verification Level Determination
// ---------------------------------------------------------------------------

/** Intent types that map to each verification level */
export const VERIFICATION_LEVEL_MAP: Record<string, VerificationLevel> = {
  general_chat: "simple",
  information_retrieval: "simple",
  content_creation: "important",
  deep_analysis: "important",
  data_analysis: "important",
  content_review: "important",
  media_production: "important",
  publishing: "critical",
};

export function determineVerificationLevel(
  intentType?: string,
  isFinalStep?: boolean,
): VerificationLevel {
  if (isFinalStep) return "critical";
  if (!intentType) return "simple";
  return VERIFICATION_LEVEL_MAP[intentType] ?? "simple";
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/lib/cognitive/types.ts
git commit -m "feat(cognitive): add shared type definitions for Phase 1"
```

---

## Task 7: VerifyLearner 核心实现

**Files:**
- Create: `src/lib/cognitive/verify-learner.ts`

- [ ] **Step 1: 实现 VerifyLearner**

创建 `src/lib/cognitive/verify-learner.ts`：
```typescript
/**
 * VerifyLearner — Phase 1: simple verification (self-eval) + memory generation.
 *
 * Evaluates task output quality via LLM self-assessment, then generates
 * memories (success patterns / failure lessons) and persists them.
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
// Self-evaluation prompt
// ---------------------------------------------------------------------------

function buildSelfEvalPrompt(input: VerificationInput): string {
  return `你是一个严格的质量评审员。请评估以下任务产出的质量。

## 任务信息
- 标题：${input.taskTitle}
- 描述：${input.taskDescription}
${input.expectedOutput ? `- 期望输出：${input.expectedOutput}` : ""}

## 产出内容
${input.output.slice(0, 6000)}

## 评估要求
请从以下维度评估，并给出 0-100 的总分：
1. **准确性** (accuracy)：信息是否正确、有依据
2. **完整性** (completeness)：是否覆盖了任务要求的所有方面
3. **风格** (style)：表达是否清晰、专业、符合目标受众
4. **合规性** (compliance)：是否有敏感内容或违规风险

## 输出格式
请严格按照以下 JSON 格式输出，不要包含任何其他文本：

\`\`\`json
{
  "qualityScore": 85,
  "passed": true,
  "feedback": "整体质量良好，信息准确，覆盖面较广...",
  "issues": [
    {
      "type": "completeness",
      "description": "缺少对竞品的对比分析",
      "severity": "low"
    }
  ],
  "successPattern": "使用多源交叉验证的方法确保了信息准确性",
  "failureLesson": null
}
\`\`\`

注意：
- qualityScore: 0-100 整数
- passed: score >= 60 为 true
- issues: 数组，可为空
- successPattern: 如果产出质量好（≥80），总结可复用的成功做法（一句话），否则为 null
- failureLesson: 如果产出质量差（<60），总结需要避免的做法（一句话），否则为 null`;
}

// ---------------------------------------------------------------------------
// Parse LLM output
// ---------------------------------------------------------------------------

interface SelfEvalOutput {
  qualityScore: number;
  passed: boolean;
  feedback: string;
  issues: VerificationIssue[];
  successPattern: string | null;
  failureLesson: string | null;
}

function parseSelfEvalOutput(text: string): SelfEvalOutput {
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    const rawMatch = text.match(/\{[\s\S]*"qualityScore"[\s\S]*\}/);
    if (rawMatch) jsonStr = rawMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      qualityScore: Math.max(0, Math.min(100, Math.round(parsed.qualityScore ?? 50))),
      passed: parsed.passed ?? (parsed.qualityScore >= 60),
      feedback: parsed.feedback ?? "",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      successPattern: parsed.successPattern ?? null,
      failureLesson: parsed.failureLesson ?? null,
    };
  } catch {
    // Fallback: moderate score, pass, no memories
    return {
      qualityScore: 65,
      passed: true,
      feedback: "自评解析失败，使用默认评分",
      issues: [],
      successPattern: null,
      failureLesson: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function verify(input: VerificationInput): Promise<VerificationResult> {
  const level = determineVerificationLevel(input.intentType);

  // Phase 1: only simple (self-eval) verification
  // Phase 3 will add cross_review and human verification
  const evalResult = await selfEvaluate(input);

  // Persist verification record
  await db.insert(verificationRecords).values({
    organizationId: input.organizationId,
    missionId: input.missionId ?? null,
    taskId: input.taskId ?? null,
    verificationLevel: level,
    verifierType: "self_eval",
    verifierEmployeeId: input.employeeId,
    qualityScore: evalResult.qualityScore,
    passed: evalResult.passed,
    feedback: evalResult.feedback,
    issuesFound: evalResult.issues,
  });

  // Generate and persist memories
  const memories = generateMemories(evalResult, input, level);
  if (memories.length > 0) {
    await db.insert(employeeMemories).values(
      memories.map((m) => ({
        employeeId: input.employeeId,
        organizationId: input.organizationId,
        memoryType: m.type,
        content: m.content,
        source: `verification:${level}`,
        importance: m.importance,
        sourceTaskId: input.taskId ?? null,
        confidence: 1.0,
        decayRate: 0.01,
      }))
    );
  }

  return {
    passed: evalResult.passed,
    qualityScore: evalResult.qualityScore,
    level,
    verifierType: "self_eval",
    feedback: evalResult.feedback,
    issues: evalResult.issues,
    memoriesGenerated: memories,
  };
}

// ---------------------------------------------------------------------------
// Internal: self-evaluation via LLM
// ---------------------------------------------------------------------------

async function selfEvaluate(input: VerificationInput): Promise<SelfEvalOutput> {
  try {
    const model = getLanguageModel({
      provider: "deepseek",
      modelId: "deepseek-chat",
      temperature: 0.2,
      maxTokens: 2000,
    });

    const result = await generateText({
      model,
      messages: [{ role: "user", content: buildSelfEvalPrompt(input) }],
      maxOutputTokens: 2000,
      temperature: 0.2,
    });

    return parseSelfEvalOutput(result.text);
  } catch (error) {
    console.error("[verify-learner] Self-eval LLM call failed:", error);
    // Don't block execution — return a passing default
    return {
      qualityScore: 65,
      passed: true,
      feedback: `自评失败：${error instanceof Error ? error.message : "unknown"}`,
      issues: [],
      successPattern: null,
      failureLesson: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Internal: generate memories from verification result
// ---------------------------------------------------------------------------

function generateMemories(
  evalResult: SelfEvalOutput,
  input: VerificationInput,
  level: VerificationLevel,
): GeneratedMemory[] {
  const memories: GeneratedMemory[] = [];

  if (evalResult.successPattern && evalResult.qualityScore >= 80) {
    memories.push({
      type: "success_pattern",
      content: `[${input.taskTitle}] ${evalResult.successPattern}`,
      importance: Math.min(1.0, evalResult.qualityScore / 100),
    });
  }

  if (evalResult.failureLesson && evalResult.qualityScore < 60) {
    memories.push({
      type: "failure_lesson",
      content: `[${input.taskTitle}] ${evalResult.failureLesson}`,
      importance: Math.min(1.0, (100 - evalResult.qualityScore) / 100),
    });
  }

  // For important/critical verification, also generate a skill_insight
  if (level !== "simple" && evalResult.issues.length > 0) {
    const highSeverity = evalResult.issues.filter((i) => i.severity === "high");
    if (highSeverity.length > 0) {
      memories.push({
        type: "skill_insight",
        content: `[${input.taskTitle}] 高优问题：${highSeverity.map((i) => i.description).join("；")}`,
        importance: 0.8,
      });
    }
  }

  return memories;
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/lib/cognitive/verify-learner.ts
git commit -m "feat(cognitive): implement VerifyLearner with self-eval and memory generation"
```

---

## Task 8: SkillManager 基础实现

**Files:**
- Create: `src/lib/cognitive/skill-manager.ts`

- [ ] **Step 1: 实现 SkillManager（基础版）**

创建 `src/lib/cognitive/skill-manager.ts`：
```typescript
/**
 * SkillManager — Phase 1: proficiency updates + usage tracking.
 *
 * Uses atomic SQL updates to avoid concurrency issues when multiple
 * tasks execute in parallel for the same employee.
 */

import { db } from "@/db";
import { employeeSkills } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { SkillLearningInput, SkillLearningResult, ProficiencyUpdate } from "./types";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Update skill proficiency and usage stats based on execution quality.
 *
 * Rules:
 * - qualityScore >= 80 → proficiency += (3 + bonus), where bonus = floor((score-80)/10)
 * - qualityScore < 60  → proficiency -= 2
 * - 60 <= score < 80   → no proficiency change (neutral zone)
 * - proficiency clamped to [0, 100]
 * - usage_count always incremented
 * - success_count incremented if passed
 */
export async function updateSkillStats(
  input: SkillLearningInput,
): Promise<SkillLearningResult> {
  const { employeeId, skillIds, qualityScore, passed } = input;

  if (skillIds.length === 0) {
    return { proficiencyUpdates: [] };
  }

  // Calculate proficiency delta
  let delta = 0;
  let reason = "";
  if (qualityScore >= 80) {
    const bonus = Math.floor((qualityScore - 80) / 10); // 0, 1, or 2
    delta = 3 + bonus;
    reason = `质量评分 ${qualityScore}，技能熟练度 +${delta}`;
  } else if (qualityScore < 60) {
    delta = -2;
    reason = `质量评分 ${qualityScore}，技能熟练度 -2`;
  } else {
    reason = `质量评分 ${qualityScore}，中性区间，熟练度不变`;
  }

  const updates: ProficiencyUpdate[] = [];

  for (const skillId of skillIds) {
    // Read current level for reporting (not for the update — update is atomic)
    const current = await db.query.employeeSkills.findFirst({
      where: and(
        eq(employeeSkills.employeeId, employeeId),
        eq(employeeSkills.skillId, skillId),
      ),
    });

    if (!current) continue;

    const oldLevel = current.level;

    // Atomic update: usage stats + proficiency
    await db
      .update(employeeSkills)
      .set({
        usageCount: sql`${employeeSkills.usageCount} + 1`,
        successCount: passed
          ? sql`${employeeSkills.successCount} + 1`
          : employeeSkills.successCount,
        lastQualityAvg: qualityScore,
        ...(delta !== 0
          ? {
              level: sql`GREATEST(0, LEAST(100, ${employeeSkills.level} + ${delta}))`,
            }
          : {}),
      })
      .where(
        and(
          eq(employeeSkills.employeeId, employeeId),
          eq(employeeSkills.skillId, skillId),
        ),
      );

    if (delta !== 0) {
      updates.push({
        employeeId,
        skillId,
        oldLevel,
        newLevel: Math.max(0, Math.min(100, oldLevel + delta)),
        reason,
      });
    }
  }

  return { proficiencyUpdates: updates };
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/lib/cognitive/skill-manager.ts
git commit -m "feat(cognitive): implement SkillManager with atomic proficiency updates"
```

---

## Task 9: 接入 mission-executor（任务完成后验证）

**Files:**
- Modify: `src/lib/mission-executor.ts:189-264`

- [ ] **Step 1: 在文件顶部添加 import**

在 `src/lib/mission-executor.ts` 的 import 区域（第 22 行附近 `import { assembleAgent...` 之后）添加：
```typescript
import { verify } from "@/lib/cognitive/verify-learner";
import { updateSkillStats } from "@/lib/cognitive/skill-manager";
```

- [ ] **Step 2: 在 executeTaskDirect 的任务完成后接入验证**

在 `executeTaskDirect()` 函数中，找到任务成功完成后的 `return { status: "completed" ...}` 语句（约第 264 行），在该 return 之前插入验证逻辑：

将当前的：
```typescript
    return { status: "completed" as const, taskId, durationMs: result.durationMs };
```

替换为：
```typescript
    // --- Cognitive Engine: verify + learn (fire-and-forget, don't block) ---
    const verifyAndLearn = async () => {
      try {
        const outputText = result.output.summary || result.output.artifacts?.[0]?.content || "";
        if (!outputText || !task.assignedEmployeeId) return;

        // Load organizationId from mission (not in cachedMission shape)
        const missionRow = await db
          .select({ orgId: missions.organizationId })
          .from(missions).where(eq(missions.id, missionId)).limit(1);
        const orgId = missionRow[0]?.orgId;
        if (!orgId) return;

        const verification = await verify({
          output: outputText,
          taskTitle: task.title,
          taskDescription: task.description,
          expectedOutput: task.expectedOutput ?? undefined,
          employeeId: task.assignedEmployeeId,
          employeeSlug: "",
          missionId,
          taskId,
          organizationId: orgId,
          intentType: mission.scenario,
        });

        // Update skill proficiency based on verification
        const empSkillRows = await db
          .select({ skillId: employeeSkills.skillId })
          .from(employeeSkills)
          .where(eq(employeeSkills.employeeId, task.assignedEmployeeId));

        if (empSkillRows.length > 0) {
          await updateSkillStats({
            employeeId: task.assignedEmployeeId,
            skillIds: empSkillRows.map((r) => r.skillId),
            qualityScore: verification.qualityScore,
            passed: verification.passed,
            taskId,
            organizationId: orgId,
          });
        }
      } catch (err) {
        console.error("[mission-executor] Verify+learn failed (non-blocking):", err);
      }
    };
    verifyAndLearn(); // fire-and-forget

    return { status: "completed" as const, taskId, durationMs: result.durationMs };
```

注意：需要在文件顶部 import 中添加 `employeeSkills`（添加到 `import { missions, missionTasks, ... } from "@/db/schema"` 中）。`missions` 已导入。

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/lib/mission-executor.ts
git commit -m "feat(cognitive): hook VerifyLearner into mission task completion"
```

---

## Task 10: 接入 intent-execute（对话每步完成后验证）

**Files:**
- Modify: `src/app/api/chat/intent-execute/route.ts`

- [ ] **Step 1: 添加 import**

在 `src/app/api/chat/intent-execute/route.ts` 顶部（约第 10 行 `import type { IntentResult }...` 之后）添加：
```typescript
import { verify } from "@/lib/cognitive/verify-learner";
```

- [ ] **Step 2: 在每步完成后调用验证**

在 `step-complete` 事件发送之前（约第 256-264 行之间），在 `priorStepOutput = stepText;` 之后、`send("step-complete", ...)` 之前插入：

```typescript
            // --- Cognitive Engine: verify step output (non-blocking) ---
            if (stepText.length > 50) {
              verify({
                output: stepText,
                taskTitle: step.taskDescription,
                taskDescription: step.taskDescription,
                employeeId: emp.id,
                employeeSlug: step.employeeSlug,
                organizationId: orgId,
                intentType: intent.intentType,
              })
                .then((vr) => {
                  send("verification", {
                    stepIndex: i,
                    qualityScore: vr.qualityScore,
                    passed: vr.passed,
                    feedback: vr.feedback,
                    issueCount: vr.issues.length,
                    memoriesGenerated: vr.memoriesGenerated.length,
                  });
                })
                .catch((err) =>
                  console.error("[intent-execute] Verification failed:", err)
                );
            }
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/intent-execute/route.ts
git commit -m "feat(cognitive): hook VerifyLearner into intent-execute step completion"
```

---

## Task 11: 记忆加载优化（confidence 过滤 + 衰减）

**Files:**
- Modify: `src/lib/agent/assembly.ts:59-68`

- [ ] **Step 1: 更新记忆加载查询**

在 `src/lib/agent/assembly.ts` 中，找到记忆加载的查询（约第 59-68 行）：

将当前的：
```typescript
    db
      .select({
        content: employeeMemories.content,
        memoryType: employeeMemories.memoryType,
        importance: employeeMemories.importance,
      })
      .from(employeeMemories)
      .where(eq(employeeMemories.employeeId, employeeId))
      .orderBy(desc(employeeMemories.importance))
      .limit(10),
```

替换为：
```typescript
    db
      .select({
        id: employeeMemories.id,
        content: employeeMemories.content,
        memoryType: employeeMemories.memoryType,
        importance: employeeMemories.importance,
        confidence: employeeMemories.confidence,
        decayRate: employeeMemories.decayRate,
      })
      .from(employeeMemories)
      .where(
        and(
          eq(employeeMemories.employeeId, employeeId),
          gt(employeeMemories.confidence, 0.3),  // 过滤低置信度记忆
        )
      )
      .orderBy(desc(employeeMemories.importance))
      .limit(10),
```

在文件顶部的 drizzle-orm import 中添加 `gt`：
```typescript
import { eq, desc, and, gt, sql } from "drizzle-orm";
```
（检查现有 import，保留已有的 `eq`、`desc` 等，添加缺少的 `gt`、`and`、`sql`）

- [ ] **Step 2: 更新记忆访问计数（不衰减）**

在记忆加载之后（约第 86-90 行 `const memories = memoryRows.map(...)` 附近），添加访问计数更新：

```typescript
  // Update access stats for loaded memories (fire-and-forget)
  // Note: confidence decay is NOT applied on access — decay should happen
  // on a schedule for memories that are NOT re-verified over time.
  if (memoryRows.length > 0) {
    Promise.all(
      memoryRows.map((m) =>
        db
          .update(employeeMemories)
          .set({
            accessCount: sql`${employeeMemories.accessCount} + 1`,
            lastAccessedAt: new Date(),
          })
          .where(eq(employeeMemories.id, m.id))
      )
    ).catch((err) =>
      console.error("[assembly] Memory access update failed:", err)
    );
  }
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent/assembly.ts
git commit -m "feat(cognitive): filter low-confidence memories and apply decay on access"
```

---

## Task 12: 构建验证

- [ ] **Step 1: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 2: 生产构建**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 3: 修复任何构建错误**

如果有错误，逐一修复后重新运行构建。

- [ ] **Step 4: 最终 Commit**

```bash
git add -A
git commit -m "feat(cognitive): Phase 1 complete — verification, memory learning, skill tracking"
```
