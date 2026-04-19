---
name: national_daily_brief
displayName: 全国热点图文
description: 每日聚合全国性热点话题，生成全国热点图文稿，发布到首页 APP 头条位。
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
    - xiaoce
  appChannelSlug: app_home
  legacyScenarioKey: national_daily_brief
---

# 全国热点图文

> 每日聚合全国性热点话题，生成全国热点图文稿，发布到首页 APP 头条位。

## 1. 使用条件

**触发方式**：Inngest cron 每日 07:30（早报流量高峰前）+ 17:30（晚间刷新）两次自动运行。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 5 个原子技能）
- `appChannelSlug` = `app_home`，需在 `/settings/cms-mapping` 完成与华栖云 CMS 栏目的绑定

**默认团队**：
- **xiaolei**（热点分析师）
- **xiaowen**（内容创作师）
- **xiaofa**（渠道运营师）
- **xiaoce**（选题策划师）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `topNCount` | Top N | number | 否 | 10 |

### 系统指令（systemInstruction）

> 聚合今日全国性热点。结构：1) 今日头条（1 条最大）2) 十大热点排名（带一句摘要）3) 聚焦深度解读 1-2 条。字数 1500-2500。风格：权威聚合、高质量摘要。

### 典型输出

```
【今日头条】2026-04-20

🔥 头条：国务院常务会议决定 AI 产业 2026 扶持政策…

📊 Top 10 热点
1. [时政] 国务院 AI 扶持政策（热度 98）
2. [经济] 特斯拉 Q1 财报超预期（热度 92）
…

📖 聚焦深度：AI 政策深度解读（800 字）
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：`publishArticleToCms({ appChannelSlug: "app_home" })` 写入华栖云

## 3. 工作流 Checklist

按顺序执行以下 5 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 全网热榜聚合** — 调 `trending_topics`（热榜聚合，perception）
- [ ] **Step 2: 热点排名与筛选** — 调 `topic_extraction`（选题提取，analysis）
- [ ] **Step 3: 聚合图文生成** — 调 `content_generate`（内容生成，generation）
- [ ] **Step 4: 质量审核** — 调 `quality_review`（质量审核，management）
- [ ] **Step 5: 发布到首页头条** — 调 `publish_strategy`（发布策略，management）

## 4. 子步骤详情

### Step 1: 全网热榜聚合

- **原子技能**：[`trending_topics`](../../skills/trending_topics/SKILL.md)（热榜聚合）
- **技能分类**：perception
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 热点排名与筛选

- **原子技能**：[`topic_extraction`](../../skills/topic_extraction/SKILL.md)（选题提取）
- **技能分类**：analysis
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 聚合图文生成

- **原子技能**：[`content_generate`](../../skills/content_generate/SKILL.md)（内容生成）
- **技能分类**：generation
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 质量审核

- **原子技能**：[`quality_review`](../../skills/quality_review/SKILL.md)（质量审核）
- **技能分类**：management
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 5: 发布到首页头条

- **原子技能**：[`publish_strategy`](../../skills/publish_strategy/SKILL.md)（发布策略）
- **技能分类**：management
- **上游依赖**：Step 4
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **头条权威**：今日头条位选择必须是 24 小时内新华社/人民日报/央视同时报道的重大事件，否则降级到第二位。

**2.** **Top 10 多元**：十大热点必须覆盖至少 4 个领域（时政/经济/科技/社会/文体/国际），避免单领域霸榜。

**3.** **排名算法可解释**：每条附「热度分」（搜索量 × 互动量 × 媒体覆盖度），分数公式在页面底部脚注说明。

**4.** **摘要精炼**：每条热点一句摘要不超过 40 字，必须包含「谁、发生了什么、为什么重要」三要素。

**5.** **负面事件克制**：负面热点（事故/犯罪）必须使用中性客观表述，不得渲染细节。

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
【今日头条】2026-04-20

🔥 头条：国务院常务会议决定 AI 产业 2026 扶持政策…

📊 Top 10 热点
1. [时政] 国务院 AI 扶持政策（热度 98）
2. [经济] 特斯拉 Q1 财报超预期（热度 92）
…

📖 聚焦深度：AI 政策深度解读（800 字）
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
- 默认团队：xiaolei / xiaowen / xiaofa / xiaoce
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
- 原子技能：[skills/](../../skills/) 目录（trending_topics）（topic_extraction）（content_generate）（quality_review）（publish_strategy）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
