---
name: employee_daily_xiaowen
displayName: 内容创作师·多版本内容
description: xiaowen 的日常工作流：主题 → 多风格标题/正文/摘要 → A/B 备选方案。
category: news
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 新闻资讯
  compatibleEmployees:
    - xiaowen
  appChannelSlug: app_news
  legacyScenarioKey: employee_daily_xiaowen
---

# 内容创作师·多版本内容

> xiaowen 的日常工作流：主题 → 多风格标题/正文/摘要 → A/B 备选方案。

## 1. 使用条件

**触发方式**：员工详情页手动触发（主题驱动，非定时）。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 5 个原子技能）
- `appChannelSlug` = `app_news`，需在 `/settings/cms-mapping` 完成与华栖云 CMS 栏目的绑定

**默认团队**：
- **xiaowen**（内容创作师）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `topic` | 创作主题 | text | 是 | 主题或选题 ID |
| `style` | 主风格 | select | 否 | news_standard |
| `targetWordCount` | 目标字数 | number | 否 | 1500 |

### 系统指令（systemInstruction）

> 以内容创作师身份产出多版本稿件。结构：1) 3 个标题（专业/网感/悬念）2) 完整正文（1 个主版本 + 2 个风格变体）3) 分享摘要（≤80 字）4) 社交媒体版（≤ 200 字）。

### 典型输出

```
【xiaowen 多版本输出】

标题 A（专业）：GPT-5 Turbo MMLU 91.3 背后的架构改进
标题 B（网感）：AI 界又地震了？OpenAI 这次放了核弹
标题 C（悬念）：它能写代码、能聊天，现在连高考都能满分？

主版本（1500 字）…
风格变体 1（深度分析）…
风格变体 2（口语轻松）…

分享摘要（80 字）…
社交版（200 字）…
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：`publishArticleToCms({ appChannelSlug: "app_news" })` 写入华栖云

## 3. 工作流 Checklist

按顺序执行以下 5 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 主题素材梳理** — 调 `topic_extraction`（选题提取，analysis）
- [ ] **Step 2: 多风格标题生成** — 调 `headline_generate`（标题生成，generation）
- [ ] **Step 3: 主版本正文撰写** — 调 `content_generate`（内容生成，generation）
- [ ] **Step 4: 风格变体生成** — 调 `style_rewrite`（风格改写，generation）
- [ ] **Step 5: 摘要与分享版** — 调 `summary_generate`（摘要生成，generation）

## 4. 子步骤详情

### Step 1: 主题素材梳理

- **原子技能**：[`topic_extraction`](../../skills/topic_extraction/SKILL.md)（选题提取）
- **技能分类**：analysis
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 多风格标题生成

- **原子技能**：[`headline_generate`](../../skills/headline_generate/SKILL.md)（标题生成）
- **技能分类**：generation
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 主版本正文撰写

- **原子技能**：[`content_generate`](../../skills/content_generate/SKILL.md)（内容生成）
- **技能分类**：generation
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 风格变体生成

- **原子技能**：[`style_rewrite`](../../skills/style_rewrite/SKILL.md)（风格改写）
- **技能分类**：generation
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 5: 摘要与分享版

- **原子技能**：[`summary_generate`](../../skills/summary_generate/SKILL.md)（摘要生成）
- **技能分类**：generation
- **上游依赖**：Step 4
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **标题 A/B/C 真差异**：专业版（专业术语 + 数字）/ 网感版（网梗 + 悬念）/ 悬念版（疑问句 + 反转）必须明显区分，不能都是同一套路。

**2.** **风格变体保留事实**：变体改风格不改事实，所有人物/数据/时间保持一致。

**3.** **分享摘要可独立阅读**：80 字摘要必须包含「谁/发生了什么」核心信息，不依赖正文上下文。

**4.** **社交版平台适配**：微博版加话题标签；朋友圈版去话题加情绪词；抖音口播版用短句。

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
【xiaowen 多版本输出】

标题 A（专业）：GPT-5 Turbo MMLU 91.3 背后的架构改进
标题 B（网感）：AI 界又地震了？OpenAI 这次放了核弹
标题 C（悬念）：它能写代码、能聊天，现在连高考都能满分？

主版本（1500 字）…
风格变体 1（深度分析）…
风格变体 2（口语轻松）…

分享摘要（80 字）…
社交版（200 字）…
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
- 默认团队：xiaowen
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
- 原子技能：[skills/](../../skills/) 目录（topic_extraction）（headline_generate）（content_generate）（style_rewrite）（summary_generate）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
