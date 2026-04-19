---
name: daily_tandian
displayName: 每日探店
description: 每天从本地热门探店话题中选出 1 个生成探店脚本，推送到 AIGC 生成视频后发布到民生-探店 APP。
category: livelihood
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 民生内容
  compatibleEmployees:
    - xiaoce
    - xiaowen
    - xiaojian
    - xiaofa
  appChannelSlug: app_livelihood_tandian
  legacyScenarioKey: daily_tandian
---

# 每日探店

> 每天从本地热门探店话题中选出 1 个生成探店脚本，推送到 AIGC 生成视频后发布到民生-探店 APP。

## 1. 使用条件

**触发方式**：Inngest cron 每日 11:30（午餐前发布），或首页「场景快捷启动」手动。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 6 个原子技能）
- `appChannelSlug` = `app_livelihood_tandian`，需在 `/settings/cms-mapping` 完成与华栖云 CMS 栏目的绑定

**默认团队**：
- **xiaoce**（选题策划师）
- **xiaowen**（内容创作师）
- **xiaojian**（视频制片人）
- **xiaofa**（渠道运营师）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `city` | 城市 | select | 是 | 成都 |
| `category` | 店型 | select | 否 | 餐饮 |

### 系统指令（systemInstruction）

> 生成一份探店脚本。6 阶段流程：店门外 → 环境氛围 → 招牌菜品 → 试吃反应 → 人均消费 → 结尾推荐。每段配镜头/贴字/配音建议。字数 600-900。风格：真实、有人情味、有画面感。**合规**：广告法禁极限词；合作类内容必须声明。

### 典型输出

```
【镜头 1：店门外】镜头从街口推进…
贴字：春熙路 / 营业中 / 今天探秘 XX
配音：听说这家店在小红书上火了一周…
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：`publishArticleToCms({ appChannelSlug: "app_livelihood_tandian" })` 写入华栖云

## 3. 工作流 Checklist

按顺序执行以下 6 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 本地探店话题聚合** — 调 `trending_topics`（热榜聚合，perception）
- [ ] **Step 2: 热门店铺筛选** — 调 `topic_extraction`（选题提取，analysis）
- [ ] **Step 3: 探店脚本生成** — 调 `tandian_script`（探店脚本，generation）
- [ ] **Step 4: 合规扫描** — 调 `compliance_check`（合规审核，management）
- [ ] **Step 5: AIGC 视频生成** — 调 `video_edit_plan`（视频剪辑方案，production）
- [ ] **Step 6: 发布到探店 APP** — 调 `publish_strategy`（发布策略，management）

## 4. 子步骤详情

### Step 1: 本地探店话题聚合

- **原子技能**：[`trending_topics`](../../skills/trending_topics/SKILL.md)（热榜聚合）
- **技能分类**：perception
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 热门店铺筛选

- **原子技能**：[`topic_extraction`](../../skills/topic_extraction/SKILL.md)（选题提取）
- **技能分类**：analysis
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 探店脚本生成

- **原子技能**：[`tandian_script`](../../skills/tandian_script/SKILL.md)（探店脚本）
- **技能分类**：generation
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 合规扫描

- **原子技能**：[`compliance_check`](../../skills/compliance_check/SKILL.md)（合规审核）
- **技能分类**：management
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 5: AIGC 视频生成

- **原子技能**：[`video_edit_plan`](../../skills/video_edit_plan/SKILL.md)（视频剪辑方案）
- **技能分类**：production
- **上游依赖**：Step 4
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 6: 发布到探店 APP

- **原子技能**：[`publish_strategy`](../../skills/publish_strategy/SKILL.md)（发布策略）
- **技能分类**：management
- **上游依赖**：Step 5
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **广告法极限词**：严禁「最好吃」「第一」「唯一」「顶级」「绝味」等极限用语；改用「很有特色」「让人印象深刻」等。

**2.** **合作类强制披露**：凡接受商家提供的餐食/住宿/礼品，标题末尾必须标注「#合作」；描述段第一句加「本次探店由 XX 邀请」。

**3.** **真实性承诺**：不得虚构试吃体验；镜头脚本与实际拍摄必须一致，不得使用 stock 素材冒充现场。

**4.** **价格透明**：人均消费必须精确到元（不含推广优惠），标注「（2026 年 4 月价格，以店内实际为准）」。

**5.** **评价客观**：差评不用极端词（「难吃到吐」），用「个人不太适应」等中性表达。

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
【镜头 1：店门外】镜头从街口推进…
贴字：春熙路 / 营业中 / 今天探秘 XX
配音：听说这家店在小红书上火了一周…
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
- 默认团队：xiaoce / xiaowen / xiaojian / xiaofa
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
- 原子技能：[skills/](../../skills/) 目录（trending_topics）（topic_extraction）（tandian_script）（compliance_check）（video_edit_plan）（publish_strategy）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
