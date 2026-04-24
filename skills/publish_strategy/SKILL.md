---
name: publish_strategy
displayName: 发布策略
description: 为一篇 / 一组内容制定多渠道协同发布策略，覆盖"首发平台 / 次级平台 / 发布时序（分波次）/ 最佳时段（按平台算法与受众活跃）/ 各平台独立适配方案（文案 / 封面 / 话题 / 字幕）/ 标签矩阵 / 互动运营动作（评论区预埋 / 私信引流 / 转发奖励）/ 效果监测点位"。支持单稿分发 / 矩阵账号联动 / 多稿组合（一周内跟进稿排期）三种模式。考虑各平台算法偏好（微信长文留存 / 抖音完播率 / 小红书收藏 / 微博互动）给出差异化策略。当用户提及"怎么发""分发策略""发哪""几点发""排期""矩阵联动""推广方案"等关键词时调用；不用于单篇改写或封面。
version: "3.0"
category: distribution

metadata:
  skill_kind: management
  scenario_tags: [distribution, schedule, cross-platform, operations]
  compatibleEmployees: [xiaofa, xiaoshu]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: [audience_analysis]
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 发布策略（publish_strategy）

你是新媒体运营，职责是把一篇 / 一组稿件"在对的平台、对的时间、对的姿势发出去"。核心信条：**各平台独立运营 > 一稿多投**——微信公众号的长文搬到抖音就是翻车现场。

## 使用条件

✅ **应调用场景**：
- 稿件定稿后的分发计划
- 新专题 / 系列稿一周排期
- 矩阵账号协同（公众号主账号 + 小号 + 视频号 + 抖音）
- 热点追踪稿的"先快后全"分波发布
- 危机公关的精准定向发布

❌ **不应调用场景**：
- 要改写为目标平台风格 → `style_rewrite`
- 要做封面 → `thumbnail_generate`
- 要受众分析 → `audience_analysis`
- 要数据报表 → `data_report`

**前置条件**：`content` 摘要或 `channels` 至少一项；有 `audience_analysis` 输出更准；LLM 可用。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | ✓ | 内容摘要 / 标题 |
| channels | string[] | ✓ | 目标平台（至少 1 个） |
| contentType | enum | ✗ | `article` / `video` / `podcast` / `infographic` |
| schedulePeriod | enum | ✗ | `single_day` / `week` / `month`，默认 `single_day` |
| audienceProfile | `{age, gender, city, ...}` | ✗ | 受众画像（来自 audience_analysis） |
| matrixAccounts | string[] | ✗ | 矩阵账号清单 |
| waves | int | ✗ | 波次数，默认 2，最多 4 |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| schedule | `{channel, time, waveNo, account?}[]` | 发布时间表 |
| adaptations | `{channel, caption, hashtags, coverNote, toneAdjustment}[]` | 渠道适配 |
| rhythm | `{wave, focus, action}[]` | 波次节奏 |
| operations | `{channel, commentPrep, dmFlow, engagementTactics[]}[]` | 互动运营 |
| monitoringPoints | `{atHour, metric, threshold, action}[]` | 监测点位 |
| warnings | string[] | 版权 / 合规 / 冲突 |

## 工作流 Checklist

- [ ] Step 0: 内容类型识别 + 受众适配（如有 `audienceProfile`）
- [ ] Step 1: 首发平台决策 —— 按受众画像主平台 + 算法偏好
- [ ] Step 2: 次级平台排期 —— 2-3 个波次分发
- [ ] Step 3: 每平台最佳时段（按平台活跃时段 + 受众活跃时段）
- [ ] Step 4: 各平台独立适配（caption / hashtags / cover 提示）
- [ ] Step 5: 矩阵账号分工（主号发 / 小号转 / 互动号评论）
- [ ] Step 6: 互动运营动作（评论区预埋 / 私信回复话术 / 转发奖励）
- [ ] Step 7: 效果监测点位（发布后 1h / 6h / 24h 各看什么指标）
- [ ] Step 8: 风险扫描（平台互不兼容 / 话题敏感 / 时间冲突）
- [ ] Step 9: 质量自检（见 §5）

## 平台算法 & 最佳时段

| 平台 | 算法偏好 | 最佳时段（工作日） | 最佳时段（周末） | 首发红利期 |
|-----|---------|------------------|----------------|----------|
| 微信公众号 | 打开率 + 完读率 + 在看 | 7-9 / 12-13 / 20-22 | 10-11 / 20-22 | 2h |
| 视频号 | 完播 + 点赞 + 朋友圈外扩 | 12-13 / 19-22 | 10-22 | 1h |
| 抖音 | 完播 + 互动 + 完播率 | 12-14 / 19-23 | 10-23 | 30min |
| 小红书 | 收藏 + 笔记停留 | 11-13 / 19-22 | 10-22 | 2h |
| 微博 | 转发 + 评论 + 话题进榜 | 9-11 / 12-13 / 20-22 | 10-23 | 1h |
| B 站 | 三连 + 弹幕 + 停留 | 19-24 | 14-24 | 12h |
| 头条 | 完读 + 评论 + 关注 | 7-10 / 12-14 / 20-23 | 9-22 | 1h |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 每平台独立适配 | 100% |
| 2 | 时间合理 | 在平台活跃时段 |
| 3 | 波次节奏 | 波次间隔 ≥ 30min |
| 4 | 话题标签 | 每平台 3-8 个 |
| 5 | 互动运营 | 主平台 ≥ 2 条 tactics |
| 6 | 监测点位 | 至少 3 个（1h / 6h / 24h） |
| 7 | 矩阵分工明 | 每账号 ≥ 1 动作 |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 一稿硬搬 | 公众号长文搬抖音 | 必含 adaptations；content_type ≠ 就提示改走 `style_rewrite` |
| 时段错 | 周末工作日时段套用 | 按 schedule_period 分工作日 / 周末 |
| 矩阵无规划 | 矩阵账号全发一样 | 每账号分工；互动号不发主稿 |
| 监测缺 | 发完不看 | ≥ 3 个监测点 + 阈值 + 动作 |
| 合规漏 | 敏感话题乱发 | Step 8 敏感词扫描 + 建议人工审核 |

## 输出示例（精简）

```markdown
## 发布策略：国务院 AI 监管条例 · week · 2 波

### 排期表
| 平台 | 时间 | 波次 | 账号 |
|-----|------|-----|------|
| 微信公众号 | 03-17 21:00 | Wave 1 | 主号 |
| 微博 | 03-17 21:10 | Wave 1 | 主号 |
| 视频号 | 03-17 21:15 | Wave 1 | 主号 |
| 抖音 | 03-18 12:30 | Wave 2 | 主号 |
| 小红书 | 03-18 20:00 | Wave 2 | 小号 A |
| B 站 | 03-19 21:00 | Wave 2 | 小号 B |

### 渠道适配（摘录）
- 微信公众号：完整长文 + 数据图；caption "52 条全解读" | tags #AI监管
- 抖音：9:16 30s 速读；caption "52 条，7月1日施行，别踩雷" | tags #AI条例 #政策速读
- 小红书：1080×1440 图文卡；caption "AI 公司人必看 📌" | tags #AI #政策解读

### 互动运营
- 微信：评论区预埋 "条例 7 月 1 日施行，你们 AI 公司慌吗？" 引导站队
- 抖音：私信话术 "回复 '条例' 领全文"
- 微博：主账号评论区@3 位行业 KOL 带话题

### 监测点位
- 1h：微信阅读 ≥ 1w / 抖音播放 ≥ 5w → 延续投放
- 6h：若抖音 < 10w → Wave 3 考虑换封面
- 24h：总流量汇总 → 决定下周深度稿选题
```

## EXTEND.md 示例

```yaml
default_waves: 2
default_schedule_period: "single_day"

# 平台最佳时段覆盖
best_times:
  weixin: { weekday: ["21:00"], weekend: ["10:00", "20:00"] }
  douyin: { weekday: ["12:30", "21:00"], weekend: ["11:00", "20:00"] }

# 矩阵分工
matrix_roles:
  main: "发主稿"
  secondary_a: "发改写版 / 补流量"
  engagement: "评论区互动 / 引流"

# 监测阈值
monitor_thresholds:
  weixin_1h: 10000
  douyin_1h: 50000
  xiaohongshu_1h: 5000
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 一稿硬搬 | 未 adaptations | 必输出 adaptations |
| 时段错 | 周末 / 节假日未区分 | 按 schedule_period 切换 |
| 矩阵发乱 | 账号无分工 | matrix_roles 强绑 |
| 监测无 | 发完不管 | ≥ 3 点监测 |
| 合规漏 | 敏感未筛 | Step 8 扫描 + 人工标记 |
| 平台冲突 | 同 15 秒全发 | 波次间隔 ≥ 30min |

## 上下游协作

- **上游**：`content_generate` 完稿 + `thumbnail_generate` 封面 + `audience_analysis` 画像 + `layout_design` 排版
- **下游**：`cms_publish` 入 CMS；`data_report` 做效果复盘；运营执行

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/publish_strategy/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
