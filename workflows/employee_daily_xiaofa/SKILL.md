---
name: employee_daily_xiaofa
displayName: 渠道运营师·多渠道分发策略
description: xiaofa 的日常工作流：稿件 → 平台适配改写 + 发布时机 + 渠道路由。
category: distribution
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 渠道分发
  compatibleEmployees:
    - xiaofa
    - xiaowen
  appChannelSlug: null
  legacyScenarioKey: employee_daily_xiaofa
---

# 渠道运营师·多渠道分发策略

> xiaofa 的日常工作流：稿件 → 平台适配改写 + 发布时机 + 渠道路由。

## 1. 使用条件

**触发方式**：稿件审核通过后自动触发；或员工详情页手动策划分发。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 4 个原子技能）
- `appChannelSlug` = null，不需要 CMS 绑定

**默认团队**：
- **xiaofa**（渠道运营师）
- **xiaowen**（内容创作师）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `articleId` | 稿件 ID | text | 否 | 可留空，从上下文读取 |
| `targetPlatforms` | 目标平台 | text | 否 | weibo, wechat, douyin |

### 系统指令（systemInstruction）

> 以渠道运营师身份制定多渠道分发策略。输出：1) 各平台适配版（微博/微信/抖音/小红书/视频号/APP）2) 最佳发布时机表 3) 标签/话题/@建议 4) 预期效果预估。

### 典型输出

```
【xiaofa 分发策略】

微博版（138 字）：🔥【数字】…
微信版（2500 字）：正文 + 图表 + 延伸阅读
抖音版（180 字）：强钩子 + 数据 + CTA

最佳发布时机：
  微博 18:30（下班高峰）
  微信 07:30（晨读高峰）
  抖音 21:30（夜间高峰）

预期：微博阅读 5-10W / 微信 5000-1W / 抖音播放 10-30W
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：*不入 CMS*

## 3. 工作流 Checklist

按顺序执行以下 4 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 平台特性分析** — 调 `audience_analysis`（受众分析，analysis）
- [ ] **Step 2: 多平台适配** — 调 `style_rewrite`（风格改写，generation）
- [ ] **Step 3: 时机与触达策略** — 调 `publish_strategy`（发布策略，management）
- [ ] **Step 4: 渠道路由编排** — 调 `publish_strategy`（发布策略，management）

## 4. 子步骤详情

### Step 1: 平台特性分析

- **原子技能**：[`audience_analysis`](../../skills/audience_analysis/SKILL.md)（受众分析）
- **技能分类**：analysis
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 多平台适配

- **原子技能**：[`style_rewrite`](../../skills/style_rewrite/SKILL.md)（风格改写）
- **技能分类**：generation
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 时机与触达策略

- **原子技能**：[`publish_strategy`](../../skills/publish_strategy/SKILL.md)（发布策略）
- **技能分类**：management
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 渠道路由编排

- **原子技能**：[`publish_strategy`](../../skills/publish_strategy/SKILL.md)（发布策略）
- **技能分类**：management
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **平台字数规范**：微博 ≤140 字（长文分段推送）；微信头条 ≥ 2000 字；抖音口播 ≤ 180 字；小红书 400-600 字。

**2.** **发布时机数据驱动**：给出的最佳时机必须基于过去 30 天同类内容的打开率数据，不能拍脑袋。

**3.** **话题 @ 合规**：@ 账号必须是已获授权或公开机构账号；话题选择不得使用禁用话题（网信办黑名单）。

**4.** **效果预估区间**：预估只给区间（如「微博阅读 5-10 万」），不给单点数字，避免过度承诺。

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
【xiaofa 分发策略】

微博版（138 字）：🔥【数字】…
微信版（2500 字）：正文 + 图表 + 延伸阅读
抖音版（180 字）：强钩子 + 数据 + CTA

最佳发布时机：
  微博 18:30（下班高峰）
  微信 07:30（晨读高峰）
  抖音 21:30（夜间高峰）

预期：微博阅读 5-10W / 微信 5000-1W / 抖音播放 10-30W
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
- 默认团队：xiaofa / xiaowen
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
- 原子技能：[skills/](../../skills/) 目录（audience_analysis）（style_rewrite）（publish_strategy）（publish_strategy）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
