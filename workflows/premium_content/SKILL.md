---
name: premium_content
displayName: 精品内容
description: 精心策划的高质量深度稿件：长文深度 + 多维度调研 + 数据图表，发布到新闻 APP 头条。
category: deep
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 深度内容
  compatibleEmployees:
    - xiaolei
    - xiaoce
    - xiaozi
    - xiaowen
    - xiaoshen
    - xiaofa
  appChannelSlug: app_news
  legacyScenarioKey: premium_content
---

# 精品内容

> 精心策划的高质量深度稿件：长文深度 + 多维度调研 + 数据图表，发布到新闻 APP 头条。

## 1. 使用条件

**触发方式**：首页「场景快捷启动」手动触发（精品内容不走 cron，编辑策划驱动）。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 7 个原子技能）
- `appChannelSlug` = `app_news`，需在 `/settings/cms-mapping` 完成与华栖云 CMS 栏目的绑定

**默认团队**：
- **xiaolei**（热点分析师）
- **xiaoce**（选题策划师）
- **xiaozi**（素材研究员）
- **xiaowen**（内容创作师）
- **xiaoshen**（质量审核官）
- **xiaofa**（渠道运营师）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `topic` | 精品选题 | text | 是 | 深圳 AI 产业新政 200 亿解读 |
| `angles` | 分析角度 | text | 否 | 政策/市场/从业者三视角 |
| `targetWordCount` | 目标字数 | number | 否 | 3500 |

### 系统指令（systemInstruction）

> 围绕用户指定的精品主题，生成 3000+ 字的深度稿件。结构：1) 悬念开头 2) 事件全景回顾 3) 多方观点（至少 3 方）4) 数据支撑 5) 深度洞察与展望。配 3-5 张图表。风格：高质量长文，有思辨深度。

### 典型输出

```
标题：深圳 AI 产业新政：200 亿能否复刻「基因工程奇迹」？

（悬念开头 500 字）
2026 年 4 月，深圳再次祭出「大手笔」…

（全景回顾 800 字）
（多方观点 800 字 - 政策制定者 / 企业家 / 学者）
（数据支撑 600 字 + 3 图表）
（深度洞察 500 字）
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：`publishArticleToCms({ appChannelSlug: "app_news" })` 写入华栖云

## 3. 工作流 Checklist

按顺序执行以下 7 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 多维度背景调研** — 调 `news_aggregation`（新闻聚合，perception）
- [ ] **Step 2: 核心观点萃取** — 调 `topic_extraction`（选题提取，analysis）
- [ ] **Step 3: 数据支撑分析** — 调 `data_report`（数据报告，analysis）
- [ ] **Step 4: 多角度深度撰写** — 调 `content_generate`（内容生成，generation）
- [ ] **Step 5: 事实核查** — 调 `fact_check`（事实核查，management）
- [ ] **Step 6: 高级质量审核** — 调 `quality_review`（质量审核，management）
- [ ] **Step 7: 发布到头条** — 调 `publish_strategy`（发布策略，management）

## 4. 子步骤详情

### Step 1: 多维度背景调研

- **原子技能**：[`news_aggregation`](../../skills/news_aggregation/SKILL.md)（新闻聚合）
- **技能分类**：perception
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 核心观点萃取

- **原子技能**：[`topic_extraction`](../../skills/topic_extraction/SKILL.md)（选题提取）
- **技能分类**：analysis
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 数据支撑分析

- **原子技能**：[`data_report`](../../skills/data_report/SKILL.md)（数据报告）
- **技能分类**：analysis
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 多角度深度撰写

- **原子技能**：[`content_generate`](../../skills/content_generate/SKILL.md)（内容生成）
- **技能分类**：generation
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 5: 事实核查

- **原子技能**：[`fact_check`](../../skills/fact_check/SKILL.md)（事实核查）
- **技能分类**：management
- **上游依赖**：Step 4
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 6: 高级质量审核

- **原子技能**：[`quality_review`](../../skills/quality_review/SKILL.md)（质量审核）
- **技能分类**：management
- **上游依赖**：Step 5
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 7: 发布到头条

- **原子技能**：[`publish_strategy`](../../skills/publish_strategy/SKILL.md)（发布策略）
- **技能分类**：management
- **上游依赖**：Step 6
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **多方观点真实性**：至少采访（或引用）3 个不同立场当事人观点；不得全文使用同一立场信源。

**2.** **事实核查必过**：所有具体数字、人名、时间、地点必须通过 fact_check 核验；未核验一律改为「相关」「约」等模糊表达。

**3.** **引文合规**：直接引语必须完整保留原文含义，不得断章取义；间接引语必须注明出处。

**4.** **数据图表标注**：每张图表必须有数据来源、统计口径、时间范围三要素。

**5.** **专家引用资格**：专家观点必须标注职务单位 + 相关领域经验，不得匿名引用。

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
标题：深圳 AI 产业新政：200 亿能否复刻「基因工程奇迹」？

（悬念开头 500 字）
2026 年 4 月，深圳再次祭出「大手笔」…

（全景回顾 800 字）
（多方观点 800 字 - 政策制定者 / 企业家 / 学者）
（数据支撑 600 字 + 3 图表）
（深度洞察 500 字）
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
- 默认团队：xiaolei / xiaoce / xiaozi / xiaowen / xiaoshen / xiaofa
- 默认 7 步流水线

### 扩展思路

- **自定义团队**：在 `/workflows/[id]/edit` 修改 `defaultTeam` 替换员工
- **加中间步骤**：如在 content_generate 前加 `knowledge_retrieval` 做知识库检索
- **替换发布目标**：改 `appChannelSlug` 指向其他 CMS 栏目
- **改 cron**：`/workflows/[id]/edit` → triggerConfig.cron 修改（如 `0 8 * * *` → `0 7 * * *`）

## 10. 参考资料

- 场景入口：[/home 「场景快捷启动」](../../src/components/home/scenario-grid.tsx) + [/employee/[id] 日常工作流](../../src/app/(dashboard)/employee/[id]/employee-profile-client.tsx)
- Mission 引擎：[src/inngest/functions/](../../src/inngest/functions/)
- CMS 发布：`publishArticleToCms` in [src/lib/cms/](../../src/lib/cms/)
- 原子技能：[skills/](../../skills/) 目录（news_aggregation）（topic_extraction）（data_report）（content_generate）（fact_check）（quality_review）（publish_strategy）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
