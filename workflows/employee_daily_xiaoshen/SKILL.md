---
name: employee_daily_xiaoshen
displayName: 质量审核官·事实质量审核
description: xiaoshen 的日常工作流：稿件 → 事实核查 + 合规扫描 + 质量评分 + 修改建议。
category: custom
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 通用场景
  compatibleEmployees:
    - xiaoshen
  appChannelSlug: null
  legacyScenarioKey: employee_daily_xiaoshen
---

# 质量审核官·事实质量审核

> xiaoshen 的日常工作流：稿件 → 事实核查 + 合规扫描 + 质量评分 + 修改建议。

## 1. 使用条件

**触发方式**：所有内容生成工作流（content_generate）完成后自动触发；或手动审核指定稿件。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 4 个原子技能）
- `appChannelSlug` = null，不需要 CMS 绑定

**默认团队**：
- **xiaoshen**（质量审核官）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `articleText` | 待审稿件 | textarea | 是 | 粘贴稿件内容 |
| `reviewTier` | 审核档位 | select | 否 | standard |

### 系统指令（systemInstruction）

> 以质量审核官身份对稿件做全面审核。输出：1) 事实核查结果（真伪/出处）2) 合规扫描（政治/广告法/法律/伦理）3) 质量评分（结构/文字/深度/可读性 4 维 0-100）4) 具体修改建议。

### 典型输出

```
【审核报告】档位：strict

❌ 事实核查：3 处存疑
  - 第 2 段第 3 句：「MMLU 95 分」→ 实际 91.3 分

✅ 合规扫描：通过

📊 质量评分
  结构 88 / 文字 92 / 深度 85 / 可读性 90
  综合 89（strict 档不通过）

✏️ 修改建议（共 5 条）…
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：*不入 CMS*

## 3. 工作流 Checklist

按顺序执行以下 4 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 事实核查** — 调 `fact_check`（事实核查，management）
- [ ] **Step 2: 合规扫描** — 调 `compliance_check`（合规审核，management）
- [ ] **Step 3: 情感立场分析** — 调 `sentiment_analysis`（情感分析，analysis）
- [ ] **Step 4: 质量综合评分** — 调 `quality_review`（质量审核，management）

## 4. 子步骤详情

### Step 1: 事实核查

- **原子技能**：[`fact_check`](../../skills/fact_check/SKILL.md)（事实核查）
- **技能分类**：management
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 合规扫描

- **原子技能**：[`compliance_check`](../../skills/compliance_check/SKILL.md)（合规审核）
- **技能分类**：management
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 情感立场分析

- **原子技能**：[`sentiment_analysis`](../../skills/sentiment_analysis/SKILL.md)（情感分析）
- **技能分类**：analysis
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 质量综合评分

- **原子技能**：[`quality_review`](../../skills/quality_review/SKILL.md)（质量审核）
- **技能分类**：management
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **事实核查逐条**：所有具体数字、人名、时间、地点、引言逐条核查；不能抽样。

**2.** **合规扫描 4 大维度**：政治（领导人表述/敏感词/境外负面）+ 广告法（极限词/虚假宣传）+ 法律（隐私/侵权/诽谤）+ 伦理（歧视/未成年保护）。

**3.** **档位分明**：strict 档位只接受 95+ 分稿件；standard 85+；relaxed 75+。低于阈值自动拒。

**4.** **修改建议可执行**：具体指出「第 X 段第 Y 句」问题 + 建议修改版本，不能只说「需改进」。

### 失败模式

| 失败模式 | 检测方法 | 处理策略 |
|---------|---------|---------|
| 原子技能超时 | `skills.runtimeConfig.avgLatencyMs × 3` | 自动重试 → 写入失败 → 人工介入 |
| 输出不符合 systemInstruction | `quality_review` 评分 < 80 | 自动重写（最多 2 次）→ 改人工 |
| 合规未过 | `compliance_check` 命中负面词 | **直接拒发，不降档** |
| CMS 发布失败 | `publishArticleToCms` 抛错 | Inngest `cms-publish-retry` 重试 3 次（指数退避） |

### 自检清单（workflow 完成后）

- [ ] 所有 Step 都有对应 artifact 落库
- [ ] `mission.status = 'completed'`
- [ ] 最终 artifact 已序列化
- [ ] `mission_messages` 有完整的工作流日志

## 6. 输出模板

```
【审核报告】档位：strict

❌ 事实核查：3 处存疑
  - 第 2 段第 3 句：「MMLU 95 分」→ 实际 91.3 分

✅ 合规扫描：通过

📊 质量评分
  结构 88 / 文字 92 / 深度 85 / 可读性 90
  综合 89（strict 档不通过）

✏️ 修改建议（共 5 条）…
```

## 7. 上下游协作

### 读哪些数据
- `hot_topics` / `trending_topics` 热点池（如涉及）
- `employee_memories` （负责员工的 Top-10 记忆）
- `knowledge_bases` 绑定的知识库
- 用户输入的 `inputFields`

### 触发哪些副作用
- `missions` 新建一条 mission（source_module = 场景触发来源）
- `mission_tasks` / `mission_artifacts` 按 Step 数量写入
- *无 CMS 副作用*

### 下游监听
- `leader-consolidate` Inngest 函数（任务完成后触发自动入库）
- `employee-status-guard` （负责员工状态更新为 idle）
- `learning-engine` （从本次任务中提取经验写回员工记忆）

## 8. 常见问题

**Q1：为什么 workflow 跑了一半卡住？**
A：查 `missions/<id>` 详情页 → 看 `mission_tasks.status = 'running'` 但超时的任务 → 检查对应原子技能的 `runtimeConfig` 是否合理；Inngest cron `employee-status-guard` 会每 5 分钟自动清理 stuck 任务。

**Q2：可以修改 workflow 的步骤吗？**
A：可以。`/workflows/[id]` 页面「规格文档」Tab 编辑本 SKILL.md；步骤编排在「流程编辑」Tab（B.2 上线）。修改后 DB 和文件双向同步。

**Q3：如何禁用 workflow？**
A：`/workflows` 列表页切换「启用」开关，或 `workflow_templates.is_enabled = false`。Cron 触发会跳过禁用的 workflow。

## 9. EXTEND.md 示例

### 基础版（builtin，本文档）
- 默认团队：xiaoshen
- 默认 4 步流水线

### 扩展思路

- **自定义团队**：在 `/workflows/[id]/edit` 修改 `defaultTeam` 替换员工
- **加中间步骤**：如在 content_generate 前加 `knowledge_retrieval` 做知识库检索
- **替换发布目标**：改 `appChannelSlug` 指向其他 CMS 栏目
- **改 cron**：`/workflows/[id]/edit` → triggerConfig.cron 修改（如 `0 8 * * *` → `0 7 * * *`）

## 10. 参考资料

- 场景入口：[/home 「场景快捷启动」](../../src/components/home/scenario-grid.tsx) + [/employee/[id] 日常工作流](../../src/app/(dashboard)/employee/[id]/employee-profile-client.tsx)
- Mission 引擎：[src/inngest/functions/](../../src/inngest/functions/)
- CMS 发布：`publishArticleToCms` in [src/lib/cms/](../../src/lib/cms/)
- 原子技能：[skills/](../../skills/) 目录（fact_check）（compliance_check）（sentiment_analysis）（quality_review）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
