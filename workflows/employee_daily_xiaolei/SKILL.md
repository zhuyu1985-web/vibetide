---
name: employee_daily_xiaolei
displayName: 热点分析师·每日全网热点
description: xiaolei 的日常工作流：全网热点监控 → 深度趋势分析 → 输出每日热点洞察简报。
category: news
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 新闻资讯
  compatibleEmployees:
    - xiaolei
  appChannelSlug: app_news
  legacyScenarioKey: employee_daily_xiaolei
---

# 热点分析师·每日全网热点

> xiaolei 的日常工作流：全网热点监控 → 深度趋势分析 → 输出每日热点洞察简报。

## 1. 使用条件

**触发方式**：员工详情页「日常工作流」启用后由 xiaolei 每日 08:00 自主调度；或手动点击卡片即时运行。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 4 个原子技能）
- `appChannelSlug` = `app_news`，需在 `/settings/cms-mapping` 完成与华栖云 CMS 栏目的绑定

**默认团队**：
- **xiaolei**（热点分析师）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `domain` | 关注领域 | select | 否 | 全部 |

### 系统指令（systemInstruction）

> 以热点分析师身份产出每日热点洞察。结构：1) 今日 Top 10 热点榜（含热度/趋势）2) 3 条值得追踪的深度选题 3) 舆情风向 4) 建议跟进动作。字数 800-1500。

### 典型输出

```
【xiaolei 每日热点简报 · 4.20】

一、今日 Top 10
1. 🔥 新上榜：XXX（热度 95）
…

二、值得追踪
• 选题 A（未来 3 天关注指标：…）
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：`publishArticleToCms({ appChannelSlug: "app_news" })` 写入华栖云

## 3. 工作流 Checklist

按顺序执行以下 4 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 全网热点采集** — 调 `news_aggregation`（新闻聚合，perception）
- [ ] **Step 2: 热度趋势分析** — 调 `trend_monitor`（趋势监控，perception）
- [ ] **Step 3: 深度洞察提取** — 调 `topic_extraction`（选题提取，analysis）
- [ ] **Step 4: 热点简报生成** — 调 `content_generate`（内容生成，generation）

## 4. 子步骤详情

### Step 1: 全网热点采集

- **原子技能**：[`news_aggregation`](../../skills/news_aggregation/SKILL.md)（新闻聚合）
- **技能分类**：perception
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 热度趋势分析

- **原子技能**：[`trend_monitor`](../../skills/trend_monitor/SKILL.md)（趋势监控）
- **技能分类**：perception
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 深度洞察提取

- **原子技能**：[`topic_extraction`](../../skills/topic_extraction/SKILL.md)（选题提取）
- **技能分类**：analysis
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 热点简报生成

- **原子技能**：[`content_generate`](../../skills/content_generate/SKILL.md)（内容生成）
- **技能分类**：generation
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **多平台覆盖**：至少覆盖微博热搜、百度热搜、抖音热榜、头条、36Kr 五个主流平台。

**2.** **趋势而非快照**：Top 10 必须标注「新上榜」/「持续上升」/「回落中」趋势标签。

**3.** **深度选题可追踪**：每条深度选题必须给出后续 3 天可追踪的数据指标（搜索量/讨论量）。

**4.** **舆情客观**：舆情风向用「讨论集中在 A/B/C 三点」陈述，不做好坏判断。

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
【xiaolei 每日热点简报 · 4.20】

一、今日 Top 10
1. 🔥 新上榜：XXX（热度 95）
…

二、值得追踪
• 选题 A（未来 3 天关注指标：…）
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
- 默认团队：xiaolei
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
- 原子技能：[skills/](../../skills/) 目录（news_aggregation）（trend_monitor）（topic_extraction）（content_generate）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
