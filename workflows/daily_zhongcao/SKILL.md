---
name: daily_zhongcao
displayName: 种草日更
description: 每天从全网热门商品/趋势中提取素材生成种草文案，推送到民生-种草 APP。
category: livelihood
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 民生内容
  compatibleEmployees:
    - xiaoce
    - xiaowen
    - xiaofa
    - xiaoshu
  appChannelSlug: app_livelihood_zhongcao
  legacyScenarioKey: daily_zhongcao
---

# 种草日更

> 每天从全网热门商品/趋势中提取素材生成种草文案，推送到民生-种草 APP。

## 1. 使用条件

**触发方式**：Inngest cron 每日 10:00（平台流量低谷期发布）。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 5 个原子技能）
- `appChannelSlug` = `app_livelihood_zhongcao`，需在 `/settings/cms-mapping` 完成与华栖云 CMS 栏目的绑定

**默认团队**：
- **xiaoce**（选题策划师）
- **xiaowen**（内容创作师）
- **xiaofa**（渠道运营师）
- **xiaoshu**（数据分析师）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `platform` | 目标平台 | select | 是 | xiaohongshu |
| `productCategory` | 品类 | select | 否 | 美妆 |

### 系统指令（systemInstruction）

> 每日生成 1 篇种草文案，平台差异化（小红书 / 抖音 / B 站 / 视频号）。结构：钩子 → 痛点 → 解决方案（产品）→ 细节展示 → CTA。字数按平台 400-1200 浮动。**合规**：广告法极限词严禁；合作披露按《互联网广告管理办法》执行。

### 典型输出

```
【小红书·美妆】姐妹们！这款粉底绝了（个人体验）

最近一直油皮卡粉到怀疑人生…
直到遇见 XX 持妆粉底液…

（以上为个人使用感受，不代表普适性）
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：`publishArticleToCms({ appChannelSlug: "app_livelihood_zhongcao" })` 写入华栖云

## 3. 工作流 Checklist

按顺序执行以下 5 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 热门商品/趋势聚合** — 调 `trending_topics`（热榜聚合，perception）
- [ ] **Step 2: 品类筛选** — 调 `topic_extraction`（选题提取，analysis）
- [ ] **Step 3: 种草脚本生成** — 调 `zhongcao_script`（种草脚本，generation）
- [ ] **Step 4: 广告法合规扫描** — 调 `compliance_check`（合规审核，management）
- [ ] **Step 5: 发布到种草 APP** — 调 `publish_strategy`（发布策略，management）

## 4. 子步骤详情

### Step 1: 热门商品/趋势聚合

- **原子技能**：[`trending_topics`](../../skills/trending_topics/SKILL.md)（热榜聚合）
- **技能分类**：perception
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 品类筛选

- **原子技能**：[`topic_extraction`](../../skills/topic_extraction/SKILL.md)（选题提取）
- **技能分类**：analysis
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 种草脚本生成

- **原子技能**：[`zhongcao_script`](../../skills/zhongcao_script/SKILL.md)（种草脚本）
- **技能分类**：generation
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 广告法合规扫描

- **原子技能**：[`compliance_check`](../../skills/compliance_check/SKILL.md)（合规审核）
- **技能分类**：management
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 5: 发布到种草 APP

- **原子技能**：[`publish_strategy`](../../skills/publish_strategy/SKILL.md)（发布策略）
- **技能分类**：management
- **上游依赖**：Step 4
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **广告法极限词**：严禁「最」「第一」「顶级」「国家级」「独家」等；改用「我的最爱」「让人惊喜」等个人化表达。

**2.** **合作披露强制**：所有商业合作内容必须在开头声明「本文由 XX 赞助提供」，否则触发合规拒发。

**3.** **平台差异化**：小红书 400-600 字 + emoji；抖音 60 秒口播脚本；B 站 5-8 分钟解说；视频号 1 分钟短视频。

**4.** **功效声明合规**：美妆/食品不得声称医疗功效；医疗器械/药品一律不种草。

**5.** **敏感品类禁区**：烟酒、处方药、金融理财产品、成人用品不得种草。

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
【小红书·美妆】姐妹们！这款粉底绝了（个人体验）

最近一直油皮卡粉到怀疑人生…
直到遇见 XX 持妆粉底液…

（以上为个人使用感受，不代表普适性）
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
- 默认团队：xiaoce / xiaowen / xiaofa / xiaoshu
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
- 原子技能：[skills/](../../skills/) 目录（trending_topics）（topic_extraction）（zhongcao_script）（compliance_check）（publish_strategy）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
