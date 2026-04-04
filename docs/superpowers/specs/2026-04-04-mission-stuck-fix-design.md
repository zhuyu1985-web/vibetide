# Mission 任务卡住修复方案设计

> 日期：2026-04-04
> 状态：已确认
> 方案：增强 Direct Execution + 守护机制（方案 B）

## 问题概述

任务中心存在大量卡在 `executing`、`planning`、`consolidating` 状态的任务，以及 `in_progress` 状态的子任务。根因分析如下：

| 故障模式 | 根因 | 严重度 |
|---------|------|--------|
| LLM 调用挂起 | `executeAgent()` 无超时，`generateText()` 可无限等待 | 高 |
| 进程死亡 | `executeMissionDirect()` 以 fire-and-forget promise 运行，进程重启后任务丢失 | 高 |
| 员工状态卡住 | Direct Execution 路径无 `employeeStatusGuard` cron 保护 | 高 |
| 依赖链死锁 | 并行执行中的级联失败存在时序间隙 | 中 |
| 汇总阶段失败 | `leaderConsolidateDirect()` LLM 调用失败 + 进程中断 | 中 |
| Token 预算竞态 | 并行任务同时通过预算检查 | 低 |

## 设计方案

### 模块 1：LLM 调用超时（根因修复）

**改动文件：** `src/lib/agent/execution.ts`

- 给 `generateText()` 添加 `AbortSignal.timeout(AGENT_TIMEOUT_MS)`
- 超时时间：**2 分钟**（120,000ms）
- 超时后 `generateText` 抛出 `AbortError`，被 `executeTaskDirect` 的 try-catch 捕获
- 任务标记为 `failed`，错误信息："AI 模型响应超时（超过 2 分钟）"

**常量定义：**
```typescript
const AGENT_TIMEOUT_MS = 2 * 60 * 1000; // 2 分钟
```

**选择 2 分钟的理由：** 单个子任务的 LLM 调用正常在 30s-2min 内完成，超过 2 分钟说明 API 大概率已挂起。

### 模块 2：Mission 级超时（整体执行保护）

**改动文件：** `src/lib/mission-executor.ts`

- `executeMissionDirect()` 入口记录 `missionStartTime`
- 将 `missionStartTime` 作为参数传给 `executeAllTasksDirect(missionId, missionStartTime)`
- `executeAllTasksDirect()` 每轮循环开头检查已用时间
- 超时时间：**15 分钟**（900,000ms）
- 超时后：剩余 `pending`/`ready` 任务标记 `failed`，break 退出循环
- 退出后仍走降级汇总流程（Level 2-4），已完成子任务成果不丢弃

**常量定义：**
```typescript
const MISSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 分钟
```

**检查位置：** 在 `executeAllTasksDirect()` 的 while 循环内，位于现有 cancellation + budget 检查之后。

**选择 15 分钟的理由：** 一个 Mission 通常 3-6 个子任务，每个最多 2 分钟（agent 超时），加上 planning 和 consolidation 各一次 LLM 调用，15 分钟足够正常完成。

### 模块 3：清理 API + 员工守护（兜底恢复）

**改动文件：** `src/app/actions/missions.ts`、`src/app/(dashboard)/missions/page.tsx`

#### 3.1 新增 `cleanupStuckMissions()` Server Action

检测并恢复 3 种卡住场景：

| 场景 | 检测条件 | 恢复动作 |
|------|---------|---------|
| Planning 卡住 | status=`planning`，无子任务，创建超过 3 分钟 | 标记 `failed`，记录 "任务规划超时" |
| Executing 卡住 | status=`executing`，`updatedAt` 超过 20 分钟无变化 | 强制走降级汇总（保留已完成子任务成果） |
| Consolidating 卡住 | status=`consolidating`，超过 5 分钟 | 用已完成子任务输出拼接 fallback，标记 `completed` |

#### 3.2 员工状态清理 `resetStaleEmployees()`

从 Inngest `employeeStatusGuard` 抽取核心逻辑为纯函数：

- 检测 `status='working'` 且 `updatedAt` 超过 **10 分钟**的员工
- 重置为 `idle`，`currentTask` 设为 `null`
- 对应的 `in_progress` 子任务标记 `failed`，错误信息："任务执行超时，已被系统自动终止"

#### 3.3 调用时机

任务列表页 `missions/page.tsx` 加载时自动调用 `cleanupStuckMissions()`。替换现有的 `retryStuckMissions` 单任务重试逻辑。

### 模块 4：历史卡住任务清理

不需要额外脚本。模块 3 的清理逻辑首次执行时自动覆盖所有历史卡住任务：

- 时间条件已超过阈值，首次清理直接命中
- 清理后 Mission 按完成率走降级策略（≥70% 降级汇总，≥30% 部分交付，<30% 标记失败）
- 用户可在任务中心查看最终状态和原因，按需"重新执行"

## 改动范围

| 文件 | 改动类型 | 改动内容 |
|------|---------|---------|
| `src/lib/agent/execution.ts` | 修改 | 添加 `AbortSignal.timeout()` |
| `src/lib/mission-executor.ts` | 修改 | 添加 mission 级超时检查 + 传递 startTime 参数 |
| `src/app/actions/missions.ts` | 修改 | 新增 `cleanupStuckMissions()`、`resetStaleEmployees()` |
| `src/app/(dashboard)/missions/page.tsx` | 修改 | 页面加载调用 `cleanupStuckMissions()` |

**无新文件**，改动集中在 4 个现有文件，不改变执行架构。

## 超时参数汇总

| 层级 | 超时时间 | 作用 |
|------|---------|------|
| Agent 调用 | 2 分钟 | 单次 LLM 调用上限 |
| Mission 整体 | 15 分钟 | 整个任务流程上限 |
| 员工状态守护 | 10 分钟 | 检测卡住的员工 |
| Planning 清理 | 3 分钟 | 检测规划阶段卡住 |
| Executing 清理 | 20 分钟 | 检测执行阶段卡住 |
| Consolidating 清理 | 5 分钟 | 检测汇总阶段卡住 |
