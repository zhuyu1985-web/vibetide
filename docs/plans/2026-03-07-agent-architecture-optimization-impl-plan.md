# AI 数字员工架构优化 - 实施计划

> 日期：2026-03-07
> 设计文档：docs/plans/2026-03-07-agent-architecture-optimization-design.md

## 概览

4 个阶段，33 个步骤，2 个新文件，14 个修改文件。

---

## Phase 1 (P0): 技能体系重构 + 记忆系统

### Workstream A: 技能体系

| 步骤 | 文件 | 改动 |
|------|------|------|
| 1.1 | `src/db/schema/enums.ts` | 新增 `skillBindingTypeEnum` |
| 1.2 | `src/db/schema/skills.ts` | `employee_skills` 加 `bindingType` 字段 |
| 1.3 | `src/lib/constants.ts` | 新增 `BUILTIN_SKILLS`(28个) + `EMPLOYEE_CORE_SKILLS` |
| 1.4 | `src/app/actions/employees.ts` | `unbindSkillFromEmployee` 拒绝解绑 core 技能 |
| 1.5 | `src/app/actions/employees.ts` | `bindSkillToEmployee` 接受 `bindingType` 参数 |
| 1.6 | `src/db/types.ts` | 验证自动派生类型正确 |
| 1.7 | `src/db/seed.ts` | 使用 `BUILTIN_SKILLS` + `EMPLOYEE_CORE_SKILLS` 生成种子数据 |

### Workstream B: 记忆系统

| 步骤 | 文件 | 改动 |
|------|------|------|
| 1.8 | `src/db/schema/enums.ts` | 新增 `memoryTypeEnum` |
| 1.9 | `src/db/schema/employee-memories.ts` | **新文件**：`employeeMemories` 表 |
| 1.10 | `src/db/schema/index.ts` | 导出 `employee-memories` |
| 1.11 | `src/db/types.ts` | 新增 `EmployeeMemoryRow`, `NewEmployeeMemory` |
| 1.12 | `src/db/schema/ai-employees.ts` | `learnedPatterns` 类型从 `string[]` 改为 `Record<string, {...}>` |
| 1.13 | `src/lib/types.ts` | 更新 `EmployeeFullProfile.learnedPatterns` 类型 |
| 1.14 | `src/lib/dal/employees.ts` + `src/db/seed.ts` | 适配新类型 |
| 1.15 | 数据库 | `db:push` 推送 schema 变更 |

---

## Phase 2 (P1): 工件系统 + 质量判断 + 安全 + 学习

### Workstream C: 工件系统

| 步骤 | 文件 | 改动 |
|------|------|------|
| 2.1 | `src/db/schema/enums.ts` | 新增 `artifactTypeEnum` |
| 2.2 | `src/db/schema/workflows.ts` | 新增 `workflowArtifacts` 表；`workflowInstances` 加 `tokenBudget`/`tokensUsed` |
| 2.3 | `src/db/types.ts` | 新增 `WorkflowArtifactRow`, `NewWorkflowArtifact` |
| 2.4 | `src/lib/agent/prompt-templates.ts` | 新增 `formatArtifactContext()` |
| 2.5 | `src/inngest/functions/execute-workflow.ts` | 步骤完成后持久化工件；下游步骤加载上游工件 |

### Workstream D: 质量判断与修正

| 步骤 | 文件 | 改动 |
|------|------|------|
| 2.6 | `src/lib/agent/prompt-templates.ts` | Layer 7 加入自评指令 |
| 2.7 | `src/lib/agent/step-io.ts` | 新增 `extractQualityScore()`，`parseStepOutput` 填充 qualityScore |
| 2.8 | `src/inngest/functions/execute-workflow.ts` | 三层质量门：>=80 通过，60-80 自动重试，<60 强制审批 |
| 2.9 | `src/inngest/functions/execute-workflow.ts` | 步骤循环开头检查人工干预消息 |

### Workstream E: 安全权限

| 步骤 | 文件 | 改动 |
|------|------|------|
| 2.10 | `src/lib/agent/assembly.ts` | 按 `authorityLevel` 过滤可用工具 |
| 2.11 | `src/inngest/functions/execute-workflow.ts` | Token 预算累加和超限检查 |
| 2.12 | `src/lib/agent/execution.ts` | 工具调用次数硬上限改为 20 |

### Workstream F: 技能学习

| 步骤 | 文件 | 改动 |
|------|------|------|
| 2.13 | `src/lib/agent/types.ts` | `AssembledAgent` 加 `memories`, `proficiencyLevel` |
| 2.14 | `src/lib/agent/assembly.ts` | 加载 top-10 记忆，计算平均熟练度 |
| 2.15 | `src/lib/agent/prompt-templates.ts` | Layer 2 注入熟练度指导，Layer 6 注入经验记忆 |
| 2.16 | `src/inngest/functions/execute-workflow.ts` | 根据 qualityScore 更新技能 level (+2/+1/0/-1) |
| 2.17 | `src/inngest/functions/execute-workflow.ts` | 驳回时写入 `employee_memories` + 更新 `learnedPatterns` |
| 2.18 | `src/inngest/functions/execute-workflow.ts` | 工作流完成时写入 pattern 记忆 |

---

## Phase 3 (P2): 意图拆解

| 步骤 | 文件 | 改动 |
|------|------|------|
| 3.1 | `src/lib/agent/intent-parser.ts` | **新文件**：`parseUserIntent()` 函数 |
| 3.2 | `src/lib/agent/index.ts` | 导出 intent-parser |
| 3.3 | `src/app/actions/workflow-engine.ts` | `startWorkflow` 新增 `autoPlanning` 参数 |

---

## Phase 4: 验证

| 步骤 | 命令 | 验收标准 |
|------|------|---------|
| 4.1 | `npx tsc --noEmit` | 零类型错误 |
| 4.2 | `npm run lint` | 无新 lint 错误 |
| 4.3 | `npm run db:generate` | 迁移文件正确包含 3 枚举 + 2 表 + 3 列 |
| 4.4 | `npm run db:push && npm run db:seed && npm run dev` | 种子成功，dev 正常启动 |

---

## 依赖关系

```
Phase 1:
  1.1 → 1.2 → 1.4, 1.5
  1.3 → 1.7
  1.8 → 1.9 → 1.10 → 1.11
  1.12 → 1.13 → 1.14
  All → 1.15

Phase 2 (depends on Phase 1):
  2.1 → 2.2 → 2.3 → 2.5
  2.6 → 2.7 → 2.8
  2.13 → 2.14 → 2.15
  2.16, 2.17, 2.18 depend on Phase 1 memories

Phase 3 (depends on 1.3):
  3.1 → 3.2 → 3.3

Phase 4 (depends on all):
  4.1 → 4.2 → 4.3 → 4.4
```

## 关键风险

| 风险 | 缓解措施 |
|------|---------|
| `learnedPatterns` 类型变更导致现有数据不兼容 | 旧数据为 `[]`，新默认值为 `{}`，DB 中 jsonb 兼容 |
| `execute-workflow.ts` 改动集中且量大 | 按 Inngest step 粒度逐步添加，每个 step.run 独立可测试 |
| 意图解析 LLM 返回格式不稳定 | 解析失败时回退到默认 8 步工作流 |
