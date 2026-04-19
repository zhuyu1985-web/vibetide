---
name: daily_ai_brief
displayName: 每日 AI 资讯
description: 每天聚合全网 AI / 大模型领域最新资讯，生成每日 AI 简报图文稿，发布到新闻 APP。
category: daily_brief
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 日常简报
  compatibleEmployees:
    - xiaolei
    - xiaowen
    - xiaofa
  appChannelSlug: app_news
  legacyScenarioKey: daily_ai_brief
---

# 每日 AI 资讯

> 每天聚合全网 AI / 大模型领域最新资讯，生成每日 AI 简报图文稿，发布到新闻 APP。

## 1. 使用条件

**触发方式**：① Inngest cron 每日 08:30 自动运行（推荐）② 首页「场景快捷启动」卡片手动触发 ③ 员工详情页「日常工作流」启用后由员工自主调度。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 5 个原子技能）
- `appChannelSlug` = `app_news`，需在 `/settings/cms-mapping` 完成与华栖云 CMS 栏目的绑定

**默认团队**：
- **xiaolei**（热点分析师）
- **xiaowen**（内容创作师）
- **xiaofa**（渠道运营师）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `topicTag` | 话题标签 | text | 否 | AI |
| `targetWordCount` | 目标字数 | number | 否 | 1500 |

### 系统指令（systemInstruction）

> 围绕 AI / 大模型领域，聚合今日全网热点，生成一份每日 AI 资讯简报。结构：1) 今日头条 AI 事件（3-5 条）2) 技术突破 3) 商业动态 4) 监管政策 5) 行业观察。字数 1200-2000。风格：专业快讯，面向技术关注者。

### 典型输出

```
标题：每日 AI 资讯 · 2026-04-20

1️⃣ 今日头条（3-5 条）
   • OpenAI 发布 GPT-5 Turbo，MMLU 91.3 分（提升 1.8 分）…

2️⃣ 技术突破
   • Anthropic Claude 4.7 发布 1M 上下文版本…

3️⃣ 商业动态
4️⃣ 监管政策
5️⃣ 行业观察
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：`publishArticleToCms({ appChannelSlug: "app_news" })` 写入华栖云

## 3. 工作流 Checklist

按顺序执行以下 5 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 全网 AI 资讯聚合** — 调 `news_aggregation`（新闻聚合，perception）
- [ ] **Step 2: 热点价值评估** — 调 `topic_extraction`（选题提取，analysis）
- [ ] **Step 3: AI 简报生成** — 调 `content_generate`（内容生成，generation）
- [ ] **Step 4: 质量审核** — 调 `quality_review`（质量审核，management）
- [ ] **Step 5: 发布到新闻 APP** — 调 `publish_strategy`（发布策略，management）

## 4. 子步骤详情

### Step 1: 全网 AI 资讯聚合

- **原子技能**：[`news_aggregation`](../../skills/news_aggregation/SKILL.md)（新闻聚合）
- **技能分类**：perception
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 热点价值评估

- **原子技能**：[`topic_extraction`](../../skills/topic_extraction/SKILL.md)（选题提取）
- **技能分类**：analysis
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: AI 简报生成

- **原子技能**：[`content_generate`](../../skills/content_generate/SKILL.md)（内容生成）
- **技能分类**：generation
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 质量审核

- **原子技能**：[`quality_review`](../../skills/quality_review/SKILL.md)（质量审核）
- **技能分类**：management
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 5: 发布到新闻 APP

- **原子技能**：[`publish_strategy`](../../skills/publish_strategy/SKILL.md)（发布策略）
- **技能分类**：management
- **上游依赖**：Step 4
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **信源权威性**：优先采信 OpenAI / Anthropic / DeepMind 官方博客、arXiv 论文、The Information / Bloomberg / 36Kr / 量子位等一级媒体；对 Twitter 转述、未署名自媒体报道标注「待验证」。

**2.** **技术深度要求**：涉及模型参数 / 基准分数 / 论文作者时必须给出具体数字和来源链接，不能模糊表述（如「提升很大」→「在 MMLU 上提升 3.2 分」）。

**3.** **时效性**：所有事件时间戳必须精确到小时（UTC 或 CST 明确标注），跨时区事件用 CST 统一表达。

**4.** **避免过度炒作**：禁用「颠覆」「吊打」「碾压」等情绪词；用「显著超越」「相较提升 X%」等中性表达。

**5.** **政策解读合规**：涉及中美 AI 监管动态必须客观陈述政策原文，不加主观立场评论。

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
标题：每日 AI 资讯 · 2026-04-20

1️⃣ 今日头条（3-5 条）
   • OpenAI 发布 GPT-5 Turbo，MMLU 91.3 分（提升 1.8 分）…

2️⃣ 技术突破
   • Anthropic Claude 4.7 发布 1M 上下文版本…

3️⃣ 商业动态
4️⃣ 监管政策
5️⃣ 行业观察
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
- 默认团队：xiaolei / xiaowen / xiaofa
- 默认 5 步流水线

### 扩展思路

- **自定义团队**：在 `/workflows/[id]/edit` 修改 `defaultTeam` 替换员工
- **加中间步骤**：如在 content_generate 前加 `knowledge_retrieval` 做知识库检索
- **替换发布目标**：改 `appChannelSlug` 指向其他 CMS 栏目
- **改 cron**：`/workflows/[id]/edit` → triggerConfig.cron 修改（如 `0 8 * * *` → `0 7 * * *`）

## 10. 参考资料

- 场景入口：[/home 「场景快捷启动」](../../src/components/home/scenario-grid.tsx) + [/employee/[id] 日常工作流](../../src/app/(dashboard)/employee/[id]/employee-profile-client.tsx)
- Mission 引擎：[src/inngest/functions/](../../src/inngest/functions/)
- CMS 发布：`publishArticleToCms` in [src/lib/cms/](../../src/lib/cms/)
- 原子技能：[skills/](../../skills/) 目录（news_aggregation）（topic_extraction）（content_generate）（quality_review）（publish_strategy）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
