---
name: employee_daily_xiaozi
displayName: 素材研究员·素材库归集
description: xiaozi 的日常工作流：指定主题 → 多源素材搜索 → 整合打标入库构建可检索媒资。
category: analytics
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 数据分析
  compatibleEmployees:
    - xiaozi
  appChannelSlug: null
  legacyScenarioKey: employee_daily_xiaozi
---

# 素材研究员·素材库归集

> xiaozi 的日常工作流：指定主题 → 多源素材搜索 → 整合打标入库构建可检索媒资。

## 1. 使用条件

**触发方式**：按需手动触发（主题驱动）；或 xiaoce 选题会输出后自动触发归集。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 4 个原子技能）
- `appChannelSlug` = null，不需要 CMS 绑定

**默认团队**：
- **xiaozi**（素材研究员）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `topic` | 主题关键词 | text | 是 | 深圳 AI 产业新政 |
| `sourceScope` | 素材范围 | select | 否 | 全网 |

### 系统指令（systemInstruction）

> 以素材研究员身份为指定主题归集素材库。输出：1) 素材清单（文/图/视/音 分类）2) 每条素材的来源/时效/版权状态 3) 相关性评分 4) 建议用法。字段结构化便于检索。

### 典型输出

```
【素材库 · 深圳 AI 产业新政】

条目 1：
  title: 深圳市 AI 产业发展条例（全文）
  source: 深圳市政府官网
  type: 政策原文
  copyright: 政府公开信息（可引用）
  relevance: 98
  summary: 200 亿专项基金 + 12 条支持措施…
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：*不入 CMS*

## 3. 工作流 Checklist

按顺序执行以下 4 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 主题背景分析** — 调 `topic_extraction`（选题提取，analysis）
- [ ] **Step 2: 多源素材搜索** — 调 `web_search`（全网搜索，perception）
- [ ] **Step 3: 网页深度抓取** — 调 `web_deep_read`（网页深读，perception）
- [ ] **Step 4: 素材打标入库** — 调 `media_search`（媒资搜索，knowledge）

## 4. 子步骤详情

### Step 1: 主题背景分析

- **原子技能**：[`topic_extraction`](../../skills/topic_extraction/SKILL.md)（选题提取）
- **技能分类**：analysis
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 多源素材搜索

- **原子技能**：[`web_search`](../../skills/web_search/SKILL.md)（全网搜索）
- **技能分类**：perception
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 网页深度抓取

- **原子技能**：[`web_deep_read`](../../skills/web_deep_read/SKILL.md)（网页深读）
- **技能分类**：perception
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 素材打标入库

- **原子技能**：[`media_search`](../../skills/media_search/SKILL.md)（媒资搜索）
- **技能分类**：knowledge
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **版权状态必标**：每条素材必须标注版权状态（CC0 / CC-BY / 仅引用 / 禁止转载），禁止归档版权不明素材。

**2.** **来源可追溯**：所有素材保存原始 URL + 抓取时间戳 + 页面备份（web.archive.org 链接）。

**3.** **相关性定量**：相关性评分 0-100，给出打分依据（关键词匹配/主题覆盖/权威度）。

**4.** **入库字段标准化**：至少包含 title / source / url / type / publishedAt / copyright / relevance / summary 8 字段。

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
【素材库 · 深圳 AI 产业新政】

条目 1：
  title: 深圳市 AI 产业发展条例（全文）
  source: 深圳市政府官网
  type: 政策原文
  copyright: 政府公开信息（可引用）
  relevance: 98
  summary: 200 亿专项基金 + 12 条支持措施…
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
- 默认团队：xiaozi
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
- 原子技能：[skills/](../../skills/) 目录（topic_extraction）（web_search）（web_deep_read）（media_search）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
