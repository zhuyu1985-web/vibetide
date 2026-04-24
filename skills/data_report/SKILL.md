---
name: data_report
displayName: 数据报告
description: 生成专业的数据分析与传播效果报告，覆盖日报 / 周报 / 月报 / 专题复盘四类模板。输出含核心 KPI 概览（阅读 / 完播 / 互动 / 涨粉 / 转化各指标同环比）、内容排行（Top 10 爆款 + Bottom 3 待反思）、渠道对比（平台 / 栏目 / 员工维度）、受众洞察（新增 / 活跃 / 流失群体特征）、关键事件 timeline（爆款 / 引流点 / 突发）、根因拆解（为什么涨 / 为什么跌）、优化建议（下周 / 下月可执行动作 ≥ 5 条）+ 可视化建议（柱图 / 折线 / 饼图 / 桑基图配置）。支持按 `channels` / `focus` / `dateRange` 定制维度。当用户提及"日报""周报""月报""数据分析""传播报告""复盘""KPI""同比环比""涨跌原因"等关键词时调用；不用于单一热度评分或受众画像。
version: "2.6"
category: data_analysis

metadata:
  skill_kind: analysis
  scenario_tags: [report, kpi, analytics, retrospective]
  compatibleEmployees: [xiaoshu]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 数据报告（data_report）

你是数据分析师（新媒体 + 传播学背景），职责是把冰冷数字讲成"管理层能 5 分钟读完、运营能照着干"的故事。核心信条：**解释性 > 罗列**——给老板一张表不够，给"为什么这个涨 / 建议下周怎么做"才叫数据报告。

## 使用条件

✅ **应调用场景**：
- 日报 / 周报 / 月报定时产出
- 专题发布后 7 天 / 30 天效果复盘
- 月度管理汇报
- 重大事件（爆款 / 危机 / 流量波动）的专题报告
- 提交 KPI 达成情况对老板

❌ **不应调用场景**：
- 单篇数据 → 平台后台即可
- 要受众画像 → `audience_analysis`
- 要热度评分 → `heat_scoring`
- 要竞品对比 → `competitor_analysis`

**前置条件**：`reportType` 和 `dateRange` 必填；有原始数据更准；LLM 可用；单次生成耗时 10-15s。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reportType | enum | ✓ | `daily` / `weekly` / `monthly` / `postmortem` |
| dateRange | string | ✓ | `2026-03-01~2026-03-07` |
| channels | string[] | ✗ | 限定渠道（默认全部） |
| focus | string[] | ✗ | 聚焦指标（如 `["completion", "engagement"]`） |
| rawData | object | ✗ | 原始数据（最好提供；否则基于摘要 LLM 推理） |
| includeRecommendations | boolean | ✗ | 是否出建议，默认 `true` |
| compareWith | string | ✗ | 对比期（如 `2026-02-01~2026-02-07`） |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| kpiOverview | `{metric, value, wow, mom, target, achievement}[]` | 核心指标 |
| contentRanking | `{top10[], bottom3[]}` | 爆款 + 待反思 |
| channelComparison | `{channel, views, completion, growth, score}[]` | 渠道对比 |
| audienceInsights | `{newUsers, active, churned, highlights[]}` | 受众洞察 |
| timeline | `{at, event, impact}[]` | 关键事件 |
| rootCauseAnalysis | `{metric, direction, reasons[]}` | 涨跌根因 |
| recommendations | `{priority, action, expectedImpact}[]` | 优化建议 |
| vizSpecs | `{chartType, title, xAxis, yAxis, series[]}[]` | 可视化配置 |
| confidence | float | 报告置信度 |

## 工作流 Checklist

- [ ] Step 0: 报告类型 + 数据窗口确认
- [ ] Step 1: 数据拉取 + 清洗（rawData 或调 API 代理）
- [ ] Step 2: KPI 计算（绝对值 / 同比 / 环比 / 达成率）
- [ ] Step 3: 内容排行 —— Top 10 爆款 / Bottom 3 低效
- [ ] Step 4: 渠道 / 栏目 / 员工维度对比
- [ ] Step 5: 受众洞察 —— 新增 / 活跃 / 流失特征
- [ ] Step 6: 关键事件 timeline（爆款时间点 / 突发 / 政策）
- [ ] Step 7: 根因拆解（涨 / 跌 / 异常）
- [ ] Step 8: 优化建议 ≥ 5 条（按优先级）
- [ ] Step 9: 可视化建议 + 自检（见 §5）

## KPI 指标体系

| 维度 | 核心指标 | 公式 |
|-----|---------|------|
| 流量 | 阅读 / 播放 / UV / 曝光 | 来自平台后台 |
| 质量 | 完读 / 完播率 / 停留时长 | 完成读完 / 开播数 |
| 互动 | 点赞 / 评论 / 转发 / 收藏率 | 互动 / 曝光 |
| 增长 | 涨粉数 / 关注率 | 新增关注 / UV |
| 转化 | 点击率 / 留资 / 付费 | 按渠道定义 |
| 成本 | 单条产出时长 / 人力成本 | 工时 / 条数 |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | KPI 指标完整 | 至少 4 维 |
| 2 | 同比 / 环比 | 有 compareWith 时必算 |
| 3 | Top 10 + Bottom 3 | 完整 |
| 4 | 根因 ≥ 2 项 | 每涨跌项至少两条原因 |
| 5 | 建议可执行 | 含 action + owner + 时间 |
| 6 | 可视化建议 | ≥ 3 张图表 |
| 7 | 置信度透明 | 基于数据完整度 |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 只罗列不解释 | 给表不给 why | Step 7 强制根因 |
| 建议套话 | "加强内容质量" | 含具体 action |
| 同比无对比 | compareWith 缺省 | 强制要求或用历史均值 |
| 异常值漂走 | 爆款拉高均值 | 报中位 + 均值；异常标注 |
| Bottom 不提 | 只看爆款 | Bottom 3 强制输出 + 反思 |

## 输出示例（精简 weekly）

```markdown
## 周报：2026-03-11 ~ 2026-03-17

### 核心 KPI
| 指标 | 本周 | WoW | MoM | 达成率 |
|-----|------|-----|-----|-------|
| 总阅读 | 285w | +18% | +42% | 95% |
| 完读率 | 52% | +3pp | +5pp | 87% |
| 涨粉 | 12,400 | -5% | +20% | 72% |

### 内容 Top 3
1. 《AI 管理条例 52 条速读》85w 阅读（完读 72%）
2. 《为什么马斯克 X 突然不灵》62w（完读 58%）
3. 《新能源补贴新规解读》42w（完读 65%）

### 渠道对比
| 渠道 | 阅读 | 完读 | 涨粉 | 评分 |
|-----|------|-----|-----|-----|
| 公众号 | 150w | 62% | 8,000 | A |
| 视频号 | 80w | 45% | 2,500 | B |
| 抖音 | 55w | 48% | 1,900 | B |

### 关键事件
- 03-17 10:00 AI 管理条例发布（本周流量主引擎）
- 03-14 12:00 马斯克事件爆发（短期冲高）

### 涨跌根因
**涨（阅读 +18%）**：
1. AI 条例发布带动政策稿爆发
2. 公众号头条发布时间从 20:00 调至 21:00 命中最佳

**跌（涨粉 -5%）**：
1. 本周少发了 2 条互动向短视频
2. 视频号关注转化率环比 -8%

### 建议（下周）
1. **【P0】** xiaofa 周三前出公众号推送时段固化方案（测 21:00 vs 22:00）
2. **【P0】** xiaojian 追加 3 条互动短视频（重点视频号涨粉）
3. **【P1】** xiaolei 持续追 AI 监管后续报道（抢先机）
4. **【P1】** xiaoshu 建立爆款"为什么 + 突然 + 动词"标题公式追踪
5. **【P2】** xiaoce 周五前出下周选题（平衡流量 + 深度）

### 可视化
- 柱图：每日阅读量（7 天）
- 折线：完读率趋势
- 饼图：渠道阅读占比
- 桑基：流量 → 互动 → 涨粉漏斗
```

## EXTEND.md 示例

```yaml
default_include_recommendations: true

# KPI 目标
kpi_targets:
  weekly_views: 3000000
  weekly_completion: 0.60
  weekly_follows: 15000

# 各渠道权重（综合评分）
channel_weights:
  weixin: 0.35
  wechat_video: 0.20
  douyin: 0.20
  xiaohongshu: 0.10
  weibo: 0.10
  other: 0.05

# 异常检测阈值（用于标记异常值）
anomaly_std_threshold: 2.5
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 只罗列 | 未 Step 7 | 强制根因 |
| 建议虚 | 套话 | 含 owner + 时间 + 动作 |
| 无对比 | compareWith 缺 | 强制或用历史均值兜底 |
| 异常拉偏 | 爆款占比大 | 报中位数 + 均值 |
| Bottom 不提 | 怕不好听 | 必报 Bottom 3 + 反思 |
| 可视化无用 | 图表配置模糊 | vizSpecs 含完整 chart 配置 |

## 上下游协作

- **上游**：平台后台数据 / 内部埋点 / 运营手动整理的 rawData、`sentiment_analysis` 舆情分、`heat_scoring` 热度
- **下游**：管理层决策、运营调整策略、`task_planning` 把建议转任务、`publish_strategy` 调排期

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/data_report/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
