---
name: employee_daily_xiaoshu
displayName: 数据分析师·数据复盘报告
description: xiaoshu 的日常工作流：稿件/项目 → 数据洞察 + 效果追踪 + 下一步建议。
category: analytics
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 数据分析
  compatibleEmployees:
    - xiaoshu
  appChannelSlug: app_home
  legacyScenarioKey: employee_daily_xiaoshu
---

# 数据分析师·数据复盘报告

> xiaoshu 的日常工作流：稿件/项目 → 数据洞察 + 效果追踪 + 下一步建议。

## 1. 使用条件

**触发方式**：Inngest cron 每周一 09:00 自动跑上周复盘；或员工详情页手动触发单稿件复盘。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 4 个原子技能）
- `appChannelSlug` = `app_home`，需在 `/settings/cms-mapping` 完成与华栖云 CMS 栏目的绑定

**默认团队**：
- **xiaoshu**（数据分析师）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `targetType` | 复盘对象 | select | 是 | article |
| `targetId` | 对象 ID（可选） | text | 否 | — |

### 系统指令（systemInstruction）

> 以数据分析师身份产出复盘报告。结构：1) 核心指标摘要（阅读/互动/转化）2) 趋势分析（日/周/月）3) 渠道对比 4) 用户画像 5) 优化建议。用图表描述（文本形式）。

### 典型输出

```
【xiaoshu 复盘报告 · 每日 AI 资讯 - 4.20】

一、核心指标
  阅读 8.5W（MoM +12% / YoY +45%）
  互动率 3.2%（高于日常平均 2.1%）
  转化率 0.8%

二、趋势：阅读量过去 7 天呈 +15% / 天上升

三、渠道对比：微信 CPM 最低（¥8），抖音最高（¥45）

四、用户画像：25-35 男 67% / 一线 45% / 移动 89%

五、优化建议
1. 标题加数字可提升打开率（历史 +30%）
2. 图表密度 3 张/千字最佳
3. 抖音投放建议降为每周 2 条
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：`publishArticleToCms({ appChannelSlug: "app_home" })` 写入华栖云

## 3. 工作流 Checklist

按顺序执行以下 4 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 数据拉取** — 调 `data_report`（数据报告，analysis）
- [ ] **Step 2: 趋势对比分析** — 调 `data_report`（数据报告，analysis）
- [ ] **Step 3: 受众画像分析** — 调 `audience_analysis`（受众分析，analysis）
- [ ] **Step 4: 复盘报告撰写** — 调 `content_generate`（内容生成，generation）

## 4. 子步骤详情

### Step 1: 数据拉取

- **原子技能**：[`data_report`](../../skills/data_report/SKILL.md)（数据报告）
- **技能分类**：analysis
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 趋势对比分析

- **原子技能**：[`data_report`](../../skills/data_report/SKILL.md)（数据报告）
- **技能分类**：analysis
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 受众画像分析

- **原子技能**：[`audience_analysis`](../../skills/audience_analysis/SKILL.md)（受众分析）
- **技能分类**：analysis
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 复盘报告撰写

- **原子技能**：[`content_generate`](../../skills/content_generate/SKILL.md)（内容生成）
- **技能分类**：generation
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **指标可比较**：日/周/月趋势必须同期比较（MoM / YoY），不只看绝对值。

**2.** **渠道对比标准化**：不同平台流量换算成「千人阅读成本 CPM」或「互动率」可比较指标。

**3.** **用户画像 3 维**：年龄分布 / 地域分布 / 设备分布，三维都出。

**4.** **优化建议可执行**：建议必须落到「下次同类稿件改进点 1/2/3」，不能说「加强质量」等空话。

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
- [ ] `articles` 表有新稿件，`cms_publications` 表有 `status='submitted'` 记录
- [ ] `mission_messages` 有完整的工作流日志

## 6. 输出模板

```
【xiaoshu 复盘报告 · 每日 AI 资讯 - 4.20】

一、核心指标
  阅读 8.5W（MoM +12% / YoY +45%）
  互动率 3.2%（高于日常平均 2.1%）
  转化率 0.8%

二、趋势：阅读量过去 7 天呈 +15% / 天上升

三、渠道对比：微信 CPM 最低（¥8），抖音最高（¥45）

四、用户画像：25-35 男 67% / 一线 45% / 移动 89%

五、优化建议
1. 标题加数字可提升打开率（历史 +30%）
2. 图表密度 3 张/千字最佳
3. 抖音投放建议降为每周 2 条
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
- `cms_publications` 新建入库记录 + Inngest `cms-status-poll` 5 次轮询

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
- 默认团队：xiaoshu
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
- 原子技能：[skills/](../../skills/) 目录（data_report）（data_report）（audience_analysis）（content_generate）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
