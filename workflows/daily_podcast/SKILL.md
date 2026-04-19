---
name: daily_podcast
displayName: 每日热点播客
description: 每日把今日全网热点整理成播客脚本（音频稿），推送到 AIGC 渲染后发布到播客 APP。
category: podcast
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 播客音频
  compatibleEmployees:
    - xiaoce
    - xiaowen
    - xiaofa
    - xiaojian
  appChannelSlug: app_livelihood_podcast
  legacyScenarioKey: daily_podcast
---

# 每日热点播客

> 每日把今日全网热点整理成播客脚本（音频稿），推送到 AIGC 渲染后发布到播客 APP。

## 1. 使用条件

**触发方式**：Inngest cron 每日 21:00（日终汇总）自动运行。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 6 个原子技能）
- `appChannelSlug` = `app_livelihood_podcast`，需在 `/settings/cms-mapping` 完成与华栖云 CMS 栏目的绑定

**默认团队**：
- **xiaoce**（选题策划师）
- **xiaowen**（内容创作师）
- **xiaofa**（渠道运营师）
- **xiaojian**（视频制片人）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `format` | 播客格式 | select | 否 | daily_brief |
| `targetMinutes` | 目标时长（分钟） | number | 否 | 10 |

### 系统指令（systemInstruction）

> 把今日 5-7 条全网热点整理成 8-12 分钟的对话体播客脚本。结构：1) 开场白 30s 2) 热点逐条点评（每条 1-2 分钟）3) 结尾互动 30s。双主持对话，自然、有网感、口语化。

### 典型输出

```
【开场】
主持A：大家好，欢迎收听每日热点…
主持B：今天我们聊五件大事…

【热点 1】OpenAI 发布 GPT-5 Turbo（1.5 分钟）
主持A：先说最硬核的…
主持B：你说我最关心哪个指标你猜？
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：`publishArticleToCms({ appChannelSlug: "app_livelihood_podcast" })` 写入华栖云

## 3. 工作流 Checklist

按顺序执行以下 6 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 今日热点聚合** — 调 `news_aggregation`（新闻聚合，perception）
- [ ] **Step 2: 热点筛选** — 调 `topic_extraction`（选题提取，analysis）
- [ ] **Step 3: 播客脚本生成** — 调 `podcast_script`（播客脚本，generation）
- [ ] **Step 4: TTS 合成（AIGC）** — 调 `audio_plan`（音频规划，production）
- [ ] **Step 5: 质量审核** — 调 `quality_review`（质量审核，management）
- [ ] **Step 6: 发布到播客 APP** — 调 `publish_strategy`（发布策略，management）

## 4. 子步骤详情

### Step 1: 今日热点聚合

- **原子技能**：[`news_aggregation`](../../skills/news_aggregation/SKILL.md)（新闻聚合）
- **技能分类**：perception
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 热点筛选

- **原子技能**：[`topic_extraction`](../../skills/topic_extraction/SKILL.md)（选题提取）
- **技能分类**：analysis
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 播客脚本生成

- **原子技能**：[`podcast_script`](../../skills/podcast_script/SKILL.md)（播客脚本）
- **技能分类**：generation
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: TTS 合成（AIGC）

- **原子技能**：[`audio_plan`](../../skills/audio_plan/SKILL.md)（音频规划）
- **技能分类**：production
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 5: 质量审核

- **原子技能**：[`quality_review`](../../skills/quality_review/SKILL.md)（质量审核）
- **技能分类**：management
- **上游依赖**：Step 4
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 6: 发布到播客 APP

- **原子技能**：[`publish_strategy`](../../skills/publish_strategy/SKILL.md)（发布策略）
- **技能分类**：management
- **上游依赖**：Step 5
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **口语化不失专业**：脚本句长不超过 20 字（便于 TTS 停顿自然）；避免复杂从句和书面语（如「因此」→「所以」、「进行」→省略）。

**2.** **双主持人设稳定**：主持 A 理性派（偏分析）、B 感性派（偏共情），两人名字/口头禅保持一致性（全季度不变）。

**3.** **时长精控**：按 180 字/分钟 TTS 语速计算字数上限（8 分钟 = 1440 字，10 分钟 = 1800 字）。超时自动截断或跳过热点。

**4.** **版权合规**：禁止完整朗读他人原创文章；引用他人观点必须说明「据 XX 媒体报道」。

**5.** **TTS 友好**：避免生僻多音字（用拼音标注提醒）、避免长数字（「一千两百」比「1200」自然）。

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
【开场】
主持A：大家好，欢迎收听每日热点…
主持B：今天我们聊五件大事…

【热点 1】OpenAI 发布 GPT-5 Turbo（1.5 分钟）
主持A：先说最硬核的…
主持B：你说我最关心哪个指标你猜？
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
- 默认团队：xiaoce / xiaowen / xiaofa / xiaojian
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
- 原子技能：[skills/](../../skills/) 目录（news_aggregation）（topic_extraction）（podcast_script）（audio_plan）（quality_review）（publish_strategy）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
