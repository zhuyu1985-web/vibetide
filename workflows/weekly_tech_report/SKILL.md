---
name: weekly_tech_report
displayName: 科技周报
description: 每周深度整理科技行业重点事件，生成 3000+ 字深度解读周报，发布到新闻 APP。
category: deep
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 深度内容
  compatibleEmployees:
    - xiaolei
    - xiaoce
    - xiaowen
    - xiaoshen
    - xiaofa
  appChannelSlug: app_news
  legacyScenarioKey: weekly_tech_report
---

# 科技周报

> 每周深度整理科技行业重点事件，生成 3000+ 字深度解读周报，发布到新闻 APP。

## 1. 使用条件

**触发方式**：Inngest cron 每周日 20:00 自动运行，或首页「场景快捷启动」手动触发。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 6 个原子技能）
- `appChannelSlug` = `app_news`，需在 `/settings/cms-mapping` 完成与华栖云 CMS 栏目的绑定

**默认团队**：
- **xiaolei**（热点分析师）
- **xiaoce**（选题策划师）
- **xiaowen**（内容创作师）
- **xiaoshen**（质量审核官）
- **xiaofa**（渠道运营师）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `weekRange` | 本周时间范围 | text | 否 | 2026-04-14 至 2026-04-20 |
| `focusSectors` | 重点细分领域 | text | 否 | AI, 新能源, 芯片 |

### 系统指令（systemInstruction）

> 过去 7 天科技行业重点事件深度解读。结构：1) 本周十大事件排名 2) 重点事件深度分析 (3-5 篇) 3) 数据洞察 4) 下周预告。每事件 500+ 字，总篇幅 3000-5000 字。风格：专业深度，有观点。

### 典型输出

```
标题：科技周报 2026 第 16 周（4.14-4.20）

一、本周十大事件
1. OpenAI 发布 GPT-5 Turbo（影响力 9.2）
2. 苹果 M5 芯片定档 2026H2（影响力 8.7）
…

二、深度解读
【事件 1 深度】GPT-5 Turbo 会否终结 Anthropic 优势？（800 字）
…
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：`publishArticleToCms({ appChannelSlug: "app_news" })` 写入华栖云

## 3. 工作流 Checklist

按顺序执行以下 6 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 全周科技事件抓取** — 调 `news_aggregation`（新闻聚合，perception）
- [ ] **Step 2: 事件筛选与排名** — 调 `topic_extraction`（选题提取，analysis）
- [ ] **Step 3: 数据洞察分析** — 调 `data_report`（数据报告，analysis）
- [ ] **Step 4: 深度周报撰写** — 调 `content_generate`（内容生成，generation）
- [ ] **Step 5: 质量与合规审核** — 调 `quality_review`（质量审核，management）
- [ ] **Step 6: 发布到新闻 APP** — 调 `publish_strategy`（发布策略，management）

## 4. 子步骤详情

### Step 1: 全周科技事件抓取

- **原子技能**：[`news_aggregation`](../../skills/news_aggregation/SKILL.md)（新闻聚合）
- **技能分类**：perception
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 事件筛选与排名

- **原子技能**：[`topic_extraction`](../../skills/topic_extraction/SKILL.md)（选题提取）
- **技能分类**：analysis
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 数据洞察分析

- **原子技能**：[`data_report`](../../skills/data_report/SKILL.md)（数据报告）
- **技能分类**：analysis
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 深度周报撰写

- **原子技能**：[`content_generate`](../../skills/content_generate/SKILL.md)（内容生成）
- **技能分类**：generation
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 5: 质量与合规审核

- **原子技能**：[`quality_review`](../../skills/quality_review/SKILL.md)（质量审核）
- **技能分类**：management
- **上游依赖**：Step 4
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 6: 发布到新闻 APP

- **原子技能**：[`publish_strategy`](../../skills/publish_strategy/SKILL.md)（发布策略）
- **技能分类**：management
- **上游依赖**：Step 5
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **周度覆盖完整**：抓取区间必须严格等于 [上周一 00:00, 本周日 23:59]，跨周事件按首次发生时间归档。

**2.** **排名可解释**：Top 10 事件排名必须给出打分矩阵（影响力 × 时效性 × 行业关注度），不能拍脑袋。

**3.** **深度分析有观点**：每篇 500+ 字深度分析必须包含一个明确的「编辑部观点」（用「本报观察」/「编辑部认为」标识）。

**4.** **数据可追溯**：引用的市场份额/营收数字必须给出一级信息源（财报 / 行业报告原文链接）。

**5.** **下周预告前瞻性**：至少点名 3 个下周确定发生的事件（发布会/财报/会议），禁止「据传」「可能」等猜测性表述。

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
标题：科技周报 2026 第 16 周（4.14-4.20）

一、本周十大事件
1. OpenAI 发布 GPT-5 Turbo（影响力 9.2）
2. 苹果 M5 芯片定档 2026H2（影响力 8.7）
…

二、深度解读
【事件 1 深度】GPT-5 Turbo 会否终结 Anthropic 优势？（800 字）
…
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
- 默认团队：xiaolei / xiaoce / xiaowen / xiaoshen / xiaofa
- 默认 6 步流水线

### 扩展思路

- **自定义团队**：在 `/workflows/[id]/edit` 修改 `defaultTeam` 替换员工
- **加中间步骤**：如在 content_generate 前加 `knowledge_retrieval` 做知识库检索
- **替换发布目标**：改 `appChannelSlug` 指向其他 CMS 栏目
- **改 cron**：`/workflows/[id]/edit` → triggerConfig.cron 修改（如 `0 8 * * *` → `0 7 * * *`）

## 10. 参考资料

- 场景入口：[/home 「场景快捷启动」](../../src/components/home/scenario-grid.tsx) + [/employee/[id] 日常工作流](../../src/app/(dashboard)/employee/[id]/employee-profile-client.tsx)
- Mission 引擎：[src/inngest/functions/](../../src/inngest/functions/)
- CMS 发布：`publishArticleToCms` in [src/lib/cms/](../../src/lib/cms/)
- 原子技能：[skills/](../../skills/) 目录（news_aggregation）（topic_extraction）（data_report）（content_generate）（quality_review）（publish_strategy）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
