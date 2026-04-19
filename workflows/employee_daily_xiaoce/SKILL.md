---
name: employee_daily_xiaoce
displayName: 选题策划师·每日选题会
description: xiaoce 的日常工作流：挖掘用户需求 → 多角度选题策划 → 输出可落地选题清单。
category: deep
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 深度内容
  compatibleEmployees:
    - xiaoce
    - xiaolei
  appChannelSlug: app_news
  legacyScenarioKey: employee_daily_xiaoce
---

# 选题策划师·每日选题会

> xiaoce 的日常工作流：挖掘用户需求 → 多角度选题策划 → 输出可落地选题清单。

## 1. 使用条件

**触发方式**：员工详情页每日 09:30 自主运行，配合晨会使用。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 5 个原子技能）
- `appChannelSlug` = `app_news`，需在 `/settings/cms-mapping` 完成与华栖云 CMS 栏目的绑定

**默认团队**：
- **xiaoce**（选题策划师）
- **xiaolei**（热点分析师）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `focusArea` | 聚焦领域 | text | 否 | 可留空，自动从热点推导 |
| `targetCount` | 期望选题数 | number | 否 | 5 |

### 系统指令（systemInstruction）

> 以选题策划师身份产出每日选题会内容。结构：1) 3-5 个核心候选选题（含背景/价值/受众）2) 每个选题的 3 个差异化角度 3) 推荐形态（图文/视频/播客）4) 预估完成周期。

### 典型输出

```
【xiaoce 选题会 · 4.20】

候选 1：GPT-5 Turbo 对国产大模型的连锁冲击
  角度 A：技术视角（差距量化）
  角度 B：产业视角（投资风向）
  角度 C：从业者视角（技能焦虑）
  推荐形态：图文深度（5000 字）
  完成周期：3 天
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：`publishArticleToCms({ appChannelSlug: "app_news" })` 写入华栖云

## 3. 工作流 Checklist

按顺序执行以下 5 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 热点背景调研** — 调 `news_aggregation`（新闻聚合，perception）
- [ ] **Step 2: 用户需求洞察** — 调 `audience_analysis`（受众分析，analysis）
- [ ] **Step 3: 多角度选题生成** — 调 `topic_extraction`（选题提取，analysis）
- [ ] **Step 4: 选题价值评估** — 调 `heat_scoring`（热度评分，analysis）
- [ ] **Step 5: 选题清单输出** — 调 `content_generate`（内容生成，generation）

## 4. 子步骤详情

### Step 1: 热点背景调研

- **原子技能**：[`news_aggregation`](../../skills/news_aggregation/SKILL.md)（新闻聚合）
- **技能分类**：perception
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 用户需求洞察

- **原子技能**：[`audience_analysis`](../../skills/audience_analysis/SKILL.md)（受众分析）
- **技能分类**：analysis
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 多角度选题生成

- **原子技能**：[`topic_extraction`](../../skills/topic_extraction/SKILL.md)（选题提取）
- **技能分类**：analysis
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 选题价值评估

- **原子技能**：[`heat_scoring`](../../skills/heat_scoring/SKILL.md)（热度评分）
- **技能分类**：analysis
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 5: 选题清单输出

- **原子技能**：[`content_generate`](../../skills/content_generate/SKILL.md)（内容生成）
- **技能分类**：generation
- **上游依赖**：Step 4
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **差异化必须明显**：三个角度必须分别覆盖「事件层/原因层/影响层」或「专业/大众/业内」不同维度，避免「三个角度其实一个视角」。

**2.** **可落地性评估**：每个选题给出可落地评分（素材可获取性 × 审核通过难度 × 受众匹配度），不能空想。

**3.** **形态推荐有依据**：图文 / 视频 / 播客推荐必须结合选题特性（如数据密集型 → 图文；情绪驱动 → 视频；长解读 → 播客）。

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
【xiaoce 选题会 · 4.20】

候选 1：GPT-5 Turbo 对国产大模型的连锁冲击
  角度 A：技术视角（差距量化）
  角度 B：产业视角（投资风向）
  角度 C：从业者视角（技能焦虑）
  推荐形态：图文深度（5000 字）
  完成周期：3 天
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
- 默认团队：xiaoce / xiaolei
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
- 原子技能：[skills/](../../skills/) 目录（news_aggregation）（audience_analysis）（topic_extraction）（heat_scoring）（content_generate）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
