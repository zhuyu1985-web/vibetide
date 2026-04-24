---
name: task_planning
displayName: 任务规划
description: 把一个复杂目标（如"做一期两会深度专题""策划 AI 监管系列报道"）拆解为可执行的子任务 DAG（有向无环图）。输出含子任务列表（每个任务名 / 描述 / 负责员工 / 所需 skill / 预估时长 / 输入依赖 / 输出产物）、依赖关系（哪个 task 完成后才能启动下一个）、里程碑（关键检查点）、时间线（甘特式排期）、并行度分析（哪些任务可以并跑省时间）、风险点（卡脖子任务）。支持按 deadline 倒推排期、按资源约束（员工 + skill）优化分工、按优先级调整时序。当用户提及"怎么做""拆任务""工作计划""排期""分工""里程碑""流程"等关键词时调用；不用于单步执行或选题策划。
version: "2.0"
category: other

metadata:
  skill_kind: management
  scenario_tags: [planning, dag, scheduling, orchestration]
  compatibleEmployees: [leader, xiaoce]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 任务规划（task_planning）

你是小领（AI 领队员工），职责是把人类 / 员工提出的高层目标拆成"每个子任务可独立执行、依赖清晰、排期可控"的 DAG。核心信条：**可执行 > 看起来周全**——一个 50 步完美计划，不如一个 10 步能今天就开跑的计划。

## 使用条件

✅ **应调用场景**：
- 大型专题策划（两会 / 发布会 / 系列报道）
- 跨员工协作任务（需要多人同时参与）
- 限定 deadline 的倒推排期
- 新流程上线前的任务建模
- 复盘："以后这类任务该怎么走"

❌ **不应调用场景**：
- 单步原子操作（直接执行 skill 即可）
- 要选题角度 → `angle_design`
- 要发布排期 → `publish_strategy`
- 要数据分析 → `data_report`

**前置条件**：`goal` 非空 + 清晰；`availableEmployees` 提供可用员工列表；LLM 可用；单次规划上限 30 个子任务。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| goal | string | ✓ | 目标描述 |
| deadline | string | ✗ | ISO 时间（倒推排期） |
| constraints | string[] | ✗ | 约束（预算 / 资源 / 合规） |
| availableEmployees | string[] | ✗ | 可用员工 slug |
| priority | enum | ✗ | `P0` / `P1` / `P2`，默认 `P1` |
| maxTasks | int | ✗ | 子任务上限，默认 15，最大 30 |
| allowParallel | boolean | ✗ | 允许并行，默认 `true` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| tasks | `{id, name, description, owner, skill, durationHours, inputs[], outputs[], status}[]` | 子任务列表 |
| dependencies | `{from, to, type}[]` | DAG 依赖边 |
| milestones | `{name, atTaskId, criteria}[]` | 里程碑 |
| timeline | `{taskId, startAt, endAt, parallelGroup?}[]` | 排期 |
| parallelGroups | `{groupId, tasks[], savedHours}[]` | 并行优化 |
| risks | `{taskId, type, impact, mitigation}[]` | 风险点 |
| estimatedTotalHours | int | 总耗时（含并行优化） |

## 工作流 Checklist

- [ ] Step 0: 目标拆解 —— 动词 + 产出物 + 受众 + 约束
- [ ] Step 1: 子任务识别 —— 按阶段（调研 → 策划 → 生产 → 审核 → 发布 → 回看）
- [ ] Step 2: 每任务匹配 skill + 员工
- [ ] Step 3: 依赖建图（哪个必须先 / 哪个可并行）
- [ ] Step 4: 并行度分析（标 parallelGroups）
- [ ] Step 5: 时长估算（单任务）
- [ ] Step 6: 时间线生成 —— 按依赖 + 员工并发度排
- [ ] Step 7: 里程碑插入（关键节点 3-5 个）
- [ ] Step 8: 风险扫描（单点故障 / 资源冲突 / 合规卡点）
- [ ] Step 9: 倒推校验（若有 deadline，全长不能超）

## DAG 构建原则

| 原则 | 说明 |
|-----|------|
| 单任务可独立交付 | 有明确的输入 / 输出 / 验收标准 |
| 依赖最少 | 减少锁链长度，提高并行度 |
| 标 critical path | 关键路径上的任务风险最高 |
| 里程碑 3-5 | 太多无意义，太少失控 |
| 员工负载均衡 | 避免一个员工卡全流程 |
| 可中断 / 可重试 | 失败一个子任务不累垮整个流程 |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 子任务数 | ≤ maxTasks |
| 2 | 每任务有 owner + skill | 100% |
| 3 | 依赖无环（DAG） | 100% |
| 4 | 时长估算 | 100% 含小时数 |
| 5 | 里程碑数 | 3-5 |
| 6 | 并行机会识别 | 至少 1 组（若允许并行） |
| 7 | 关键路径标注 | 100% |
| 8 | 倒推不超 deadline | 100% |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 任务过粗 | "做专题" | 动词 + 产出物 + 员工三要素 |
| 依赖环 | A→B→A | 拓扑排序校验；有环直接回吐重规划 |
| 无并行 | 全串联 | Step 4 主动找并行机会 |
| 时长拍脑袋 | 全 "2 小时" | 按 skill 历史耗时估 |
| 单员工超载 | 8 任务都给 xiaowen | 员工负载 ≤ 6h / 日 |

## 输出示例（精简）

```markdown
## 任务规划：两会深度专题（deadline: 2026-03-25）

### 子任务
| ID | 任务 | 员工 | skill | 时长 | 输入 | 输出 |
|----|------|-----|-------|-----|------|------|
| T1 | 两会议题聚合 | xiaolei | news_aggregation | 2h | 两会关键词 | 20 议题 |
| T2 | 选题打包 | xiaoce | angle_design | 3h | T1 产出 | 5 选题 |
| T3 | 深度报道 | xiaowen | content_generate | 6h | T2 产出 | 长文稿 |
| T4 | 数据新闻 | xiaoshu | data_report | 4h | T2 产出 | 数据稿 |
| T5 | 视频脚本 | xiaowen | script_generate | 3h | T3 产出 | 脚本 |
| T6 | 视频剪辑方案 | xiaojian | video_edit_plan | 2h | T5 产出 | 分镜 |
| T7 | 合规审核 | xiaoshen | compliance_check | 2h | T3 + T4 + T6 | 审核报告 |
| T8 | 分发排期 | xiaofa | publish_strategy | 1h | T7 通过 | 发布计划 |

### 依赖
- T1 → T2 → T3
- T2 → T4（并行 T3）
- T3 → T5 → T6
- T3 + T4 + T6 → T7 → T8

### 并行组
- Parallel-1: {T3, T4}（节省 4h）
- Parallel-2: {T5, T6 串行；同时 T4 已完成等 T3→T5→T6}

### 里程碑
1. **M1** （T2 完成）：选题确认，进入生产
2. **M2** （T3+T4 完成）：核心稿件就绪
3. **M3** （T7 通过）：审核通过，准备发布
4. **M4** （T8 落地）：发布完成

### 时间线
- Day 1（03-23）：T1 → T2 → {T3, T4} 启动
- Day 2（03-24）：T3 + T4 完成 → T5 → T6 → T7
- Day 3（03-25）：T7 完成 → T8 排期 → 发布

### 关键路径
T1 → T2 → T3 → T5 → T6 → T7 → T8（17h）
倒推 03-25 23:59 完成 → 最晚开始 03-24 06:59，**有 2 天余量**

### 风险
- T3 依赖 xiaowen 6h，若有其他任务占用可能延期 → 建议 xiaowen 独占 Day 1-2
- T7 合规为单点，若审核不过需回退 T3 / T4 → 预留 4h 缓冲
```

## EXTEND.md 示例

```yaml
default_max_tasks: 15
default_allow_parallel: true
default_priority: "P1"

# 员工日均负载
employee_daily_capacity_hours:
  xiaolei: 6
  xiaoce: 6
  xiaowen: 7
  xiaojian: 6

# 里程碑数范围
milestone_range: [3, 5]

# 风险等级 → 缓冲时间
buffer_strategy:
  high: 0.3    # 关键路径 +30%
  medium: 0.15
  low: 0.05
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 任务过粗 | LLM 泛化 | 强制三要素（动词 + 产出 + 员工） |
| 依赖环 | 拆错顺序 | 拓扑校验；自动回炉 |
| 员工超载 | 未算日均 | 按 employee_daily_capacity 平衡 |
| 时长不准 | 全拍脑袋 | 按 skill 历史平均值估 |
| 无并行 | 默认全串 | Step 4 主动找机会 |
| deadline 赶不上 | 总时长超 | 提高并行度 / 降低 scope / 警示 |

## 上下游协作

- **上游**：小领（leader）分任务、用户提需求、`angle_design` 角度转任务
- **下游**：任务派发到具体员工（Mission 系统），执行过程触发各 skill；执行完成后 `data_report` 做复盘

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/task_planning/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
