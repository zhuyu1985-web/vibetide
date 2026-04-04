# Mission 任务卡住修复方案设计

> 日期：2026-04-04
> 状态：已确认（Spec Review 通过）
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
- 超时时间：**3 分钟**（180,000ms）
- 这是 **整个 agent 多步执行的总时间上限**（含所有 tool call 步骤），不是单次 HTTP 请求超时
- 注意：DeepSeek client 在 `model-router.ts` 已有 2 分钟的单次 fetch 超时（per-request），两层超时互补
- 超时后 `generateText` 抛出 `AbortError`，被 `executeTaskDirect` 的 try-catch 捕获
- 任务标记为 `failed`，错误信息："AI 模型响应超时（超过 3 分钟）"

**常量定义：**
```typescript
const AGENT_TIMEOUT_MS = 3 * 60 * 1000; // 3 分钟（整个 agent 多步执行上限）
```

**选择 3 分钟的理由：** 单次 LLM 调用通常 30s-2min。部分任务涉及 tool call 多步执行（最多 20 步），需要比单次调用更多时间。3 分钟覆盖正常多步执行，超时说明 API 异常。

### 模块 2：Mission 级超时（整体执行保护）

**改动文件：** `src/lib/mission-executor.ts`

- `executeMissionDirect()` 入口记录 `missionStartTime`
- **所有三个阶段**都检查超时（不仅限于 task 执行循环）：
  - `leaderPlanDirect()` 调用前检查
  - `executeAllTasksDirect()` 每轮循环开头检查（传入 `missionStartTime` 参数）
  - `leaderConsolidateDirect()` 调用前检查
- 超时时间：**15 分钟**（900,000ms）
- 超时后：剩余 `pending`/`ready` 任务标记 `failed`，跳过未执行的阶段
- Planning 阶段超时 → 直接标记 mission failed
- Executing 阶段超时 → break 退出循环，走降级汇总
- Consolidation 前超时 → 用 fallback 输出（拼接已完成子任务摘要），标记 completed

**实现方式：** 在 `executeMissionDirect()` 中封装辅助函数：

```typescript
const missionStartTime = Date.now();
const MISSION_TIMEOUT_MS = 15 * 60 * 1000;

function isMissionTimedOut() {
  return Date.now() - missionStartTime > MISSION_TIMEOUT_MS;
}
```

在 planning 前、每轮 task 执行前、consolidation 前都调用 `isMissionTimedOut()` 检查。

**选择 15 分钟的理由：** 一个 Mission 通常 3-6 个子任务，每个最多 3 分钟（agent 超时），加上 planning 和 consolidation 各一次 LLM 调用，15 分钟足够正常完成。

### 模块 3：清理 API + 员工守护（兜底恢复）

**改动文件：** `src/app/actions/missions.ts`、`src/app/(dashboard)/missions/page.tsx`

#### 3.1 新增 `cleanupStuckMissions()` Server Action

**组织隔离：** 清理操作通过 `getCurrentUserOrg()` 获取当前用户组织 ID，仅处理该组织下的任务。

**执行顺序：**
1. 先执行 `resetStaleEmployees(orgId)` — 清理卡住的员工和子任务
2. 再执行 mission 级清理 — 此时子任务状态已更新，mission 完成率计算准确

**检测 "Executing 卡住" 的方式：** `missions` 表没有 `updatedAt` 列。改用子任务活动时间作为代理指标：

```sql
-- 取该 mission 下子任务的最后活动时间
MAX(COALESCE(mission_tasks.completed_at, mission_tasks.started_at))
```

如果该值超过 18 分钟且 mission 仍为 `executing`，判定为卡住。

检测并恢复 3 种卡住场景：

| 场景 | 检测条件 | 恢复动作 |
|------|---------|---------|
| Planning 卡住 | status=`planning`，无子任务，`created_at` 超过 3 分钟 | 标记 `failed`，记录 "任务规划超时" |
| Executing 卡住 | status=`executing`，子任务最后活动超过 18 分钟 | 将剩余 pending/ready/in_progress 子任务标记 failed，走降级汇总 |
| Consolidating 卡住 | status=`consolidating`，`started_at` 超过 5 分钟（consolidation 阶段无子任务活动） | 用已完成子任务摘要拼接 fallback 输出，标记 `completed` |

**Executing 清理阈值选择 18 分钟的理由：** 内部 mission 超时是 15 分钟，18 分钟意味着只有进程已死（内部超时无法触发）时才会被外部清理命中。避免与活跃执行冲突。

#### 3.2 员工状态清理 `resetStaleEmployees(orgId)`

从 Inngest `employeeStatusGuard` 抽取核心逻辑为纯函数，接受 `orgId` 参数限定范围：

- 检测 `status='working'` 且 `updatedAt` 超过 **10 分钟**的员工
- 重置为 `idle`，`currentTask` 设为 `null`
- 对应的 `in_progress` 子任务标记 `failed`，错误信息："任务执行超时，已被系统自动终止"

#### 3.3 调用时机

任务列表页 `missions/page.tsx` 在 Server Component 中调用 `cleanupStuckMissions()`。使用 `after()` 异步执行，不阻塞页面渲染。

#### 3.4 删除旧代码

移除 `retryStuckMissions()` 函数及其在 `page.tsx` 中的调用，由 `cleanupStuckMissions()` 完全替代。

### 模块 4：历史卡住任务清理

不需要额外脚本。模块 3 的清理逻辑首次执行时自动覆盖所有历史卡住任务：

- 时间条件已超过阈值，首次清理直接命中
- 清理后 Mission 按完成率走降级策略（≥70% 降级汇总，≥30% 部分交付，<30% 标记失败）
- 用户可在任务中心查看最终状态和原因，按需"重新执行"

## 改动范围

| 文件 | 改动类型 | 改动内容 |
|------|---------|---------|
| `src/lib/agent/execution.ts` | 修改 | 添加 `AbortSignal.timeout(3min)` |
| `src/lib/mission-executor.ts` | 修改 | 三阶段超时检查 + `isMissionTimedOut()` + 传递 startTime |
| `src/app/actions/missions.ts` | 修改 | 新增 `cleanupStuckMissions()`、`resetStaleEmployees()`，删除 `retryStuckMissions()` |
| `src/app/(dashboard)/missions/page.tsx` | 修改 | 页面 `after()` 调用 `cleanupStuckMissions()`，删除旧 retry 调用 |

**无新文件**，改动集中在 4 个现有文件，不改变执行架构。

## 超时参数汇总

| 层级 | 超时时间 | 作用 | 说明 |
|------|---------|------|------|
| DeepSeek fetch | 2 分钟 | 单次 HTTP 请求超时 | 已有，在 `model-router.ts` |
| Agent 整体执行 | 3 分钟 | 多步 agent 执行总上限 | 新增，在 `execution.ts` |
| Mission 整体 | 15 分钟 | 三阶段流程总上限 | 新增，在 `mission-executor.ts` |
| 员工状态守护 | 10 分钟 | 检测卡住的员工 | 新增，在 `actions/missions.ts` |
| Planning 清理 | 3 分钟 | 检测规划阶段卡住 | 新增，外部清理 |
| Executing 清理 | 18 分钟 | 检测执行阶段卡住（> 内部 15 分钟） | 新增，外部清理 |
| Consolidating 清理 | 5 分钟 | 检测汇总阶段卡住 | 新增，外部清理 |
