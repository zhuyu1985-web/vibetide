---
name: employee_daily_xiaojian
displayName: 视频制片人·视频制作方案
description: xiaojian 的日常工作流：脚本 → 分镜方案 + 封面 + 音频 + 剪辑指导一体化。
category: video
version: "1.0"
metadata:
  skill_kind: workflow
  scenario_tags:
    - 视频制作
  compatibleEmployees:
    - xiaojian
    - xiaowen
  appChannelSlug: app_variety
  legacyScenarioKey: employee_daily_xiaojian
---

# 视频制片人·视频制作方案

> xiaojian 的日常工作流：脚本 → 分镜方案 + 封面 + 音频 + 剪辑指导一体化。

## 1. 使用条件

**触发方式**：xiaowen 脚本输出后自动触发；或员工详情页手动启动（脚本驱动）。

**前置条件 / Prereq**：
- 组织（organization）已启用该 workflow（`workflow_templates.is_enabled = true`）
- 涉及的原子技能已在 `skills/` 目录存在（本工作流调用 5 个原子技能）
- `appChannelSlug` = `app_variety`，需在 `/settings/cms-mapping` 完成与华栖云 CMS 栏目的绑定

**默认团队**：
- **xiaojian**（视频制片人）
- **xiaowen**（内容创作师）

## 2. 输入 / 输出

### 输入字段

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| `script` | 脚本 / 主题 | textarea | 是 | 粘贴脚本或输入视频主题 |
| `duration` | 目标时长 | select | 否 | 90s |

### 系统指令（systemInstruction）

> 以视频制片人身份为指定脚本产出制作方案。结构：1) 完整分镜表（镜头号/时长/内容/贴字/配音/音效）2) 封面设计思路（3 版）3) 音频方案（BGM+配音风格）4) 剪辑节奏建议。

### 典型输出

```
【分镜表】30s 抖音版
| # | 时长 | 画面 | 贴字 | 配音 | 音效 |
| 1 | 3s | 特写镜头 | 震惊开场 | … | 钟声 |
| 2 | 5s | 全景展示 | 具体数字 | … | — |
…

【封面】
版 1：数字+产品（理性）
版 2：人物表情+大字(情绪)
版 3：对比图（反差）
```

### 输出落地

- **mission_artifacts**：每个 Step 产出物序列化为 artifact（`artifact_type`）
- **articles**：最后一个 Step 若为发布类，触发 `articles` 表入库
- **CMS 发布**：`publishArticleToCms({ appChannelSlug: "app_variety" })` 写入华栖云

## 3. 工作流 Checklist

按顺序执行以下 5 步（Mission Engine 按 `dependsOn` 拓扑排序）：

- [ ] **Step 1: 脚本结构分析** — 调 `topic_extraction`（选题提取，analysis）
- [ ] **Step 2: 分镜方案设计** — 调 `video_edit_plan`（视频剪辑方案，production）
- [ ] **Step 3: 封面设计** — 调 `layout_design`（版式设计，production）
- [ ] **Step 4: 音频配乐规划** — 调 `audio_plan`（音频规划，production）
- [ ] **Step 5: 缩略图生成** — 调 `thumbnail_generate`（封面生成，generation）

## 4. 子步骤详情

### Step 1: 脚本结构分析

- **原子技能**：[`topic_extraction`](../../skills/topic_extraction/SKILL.md)（选题提取）
- **技能分类**：analysis
- **上游依赖**：（无 — 流水线入口）
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 2: 分镜方案设计

- **原子技能**：[`video_edit_plan`](../../skills/video_edit_plan/SKILL.md)（视频剪辑方案）
- **技能分类**：production
- **上游依赖**：Step 1
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 3: 封面设计

- **原子技能**：[`layout_design`](../../skills/layout_design/SKILL.md)（版式设计）
- **技能分类**：production
- **上游依赖**：Step 2
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 4: 音频配乐规划

- **原子技能**：[`audio_plan`](../../skills/audio_plan/SKILL.md)（音频规划）
- **技能分类**：production
- **上游依赖**：Step 3
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

### Step 5: 缩略图生成

- **原子技能**：[`thumbnail_generate`](../../skills/thumbnail_generate/SKILL.md)（封面生成）
- **技能分类**：generation
- **上游依赖**：Step 4
- **失败降级**：重试 3 次（2s / 5s / 10s backoff）；仍失败则中断整个 workflow 并写入 `mission_messages`。

## 5. 质量把关

### 媒体行业专业要求

**1.** **分镜时长精确到秒**：每个镜头时长之和必须 = 目标时长 ± 5%，不能随意拉伸压缩。

**2.** **贴字不超过 15 字**：每条贴字不超过 15 个汉字（移动端 1.5 秒可读完）。

**3.** **BGM 版权合规**：必须使用版权库（版权信 / 爱给网 / Artlist）或原创音乐，禁用未授权商业歌曲。

**4.** **封面 3 版有梯度**：版 1 保守可靠、版 2 吸睛大胆、版 3 情绪化共鸣，分别适配不同分发场景。

**5.** **剪辑节奏匹配平台**：抖音节奏 2-3 秒切一镜；B 站可以 5-8 秒长镜；视频号 3-5 秒。

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
【分镜表】30s 抖音版
| # | 时长 | 画面 | 贴字 | 配音 | 音效 |
| 1 | 3s | 特写镜头 | 震惊开场 | … | 钟声 |
| 2 | 5s | 全景展示 | 具体数字 | … | — |
…

【封面】
版 1：数字+产品（理性）
版 2：人物表情+大字(情绪)
版 3：对比图（反差）
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
- 默认团队：xiaojian / xiaowen
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
- 原子技能：[skills/](../../skills/) 目录（topic_extraction）（video_edit_plan）（layout_design）（audio_plan）（thumbnail_generate）
- 架构 Spec：[docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](../../docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md)
