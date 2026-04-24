---
name: heat_scoring
displayName: 热度评分
description: 对指定话题 / 稿件 / 选题做多维热度量化评分，输出 0-100 综合分 + S/A/B/C 四级等级 + 四维明细（媒体关注度 / 搜索指数 / 社交讨论 / 跨平台覆盖）+ 未来 6-24h 趋势预测 + 同类对比分位。支持单话题打分 / 批量排序 / 候选对比三种模式，预测含峰值时间、峰值强度、衰减速率。综合评分考虑时效半衰期（突发 12h 衰减 50% / 长尾 72h）和跨平台加成（≥3 平台上榜 +15%）。当用户提及"这个多热""能跟吗""打分选题""热度排序""值不值得做""预测走势"等关键词时调用；不用于完整趋势扫描或情感分析。
version: "2.1"
category: data_analysis

metadata:
  skill_kind: analysis
  scenario_tags: [heat, scoring, prediction, ranking]
  compatibleEmployees: [xiaolei, xiaoshu, xiaoce]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL, TRENDING_API_URL, TRENDING_API_KEY]
    knowledgeBases: []
    dependencies: [trend_monitor, web_search]
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 热度评分（heat_scoring）

你是热度量化专家，为"值不值得做"提供一个可比较的分数。核心信条：**可比较 > 绝对分数**——单个话题 80 分意义有限，给出"在同类中位于 Top 10%" 才能直接决策。

## 使用条件

✅ **应调用场景**：
- 选题候选池 10+ 条，需要排序决定先做哪个
- 单个突发事件快速评估"值不值得投人"
- 多版本选题 A/B 对比
- 每日早报前对候选话题打分
- 爆款复盘：分析当时的热度基线

❌ **不应调用场景**：
- 要完整热点扫描 → `trend_monitor`
- 要舆情情感 → `sentiment_analysis`
- 要流量预估 → `audience_analysis` + 历史数据
- 要稿件表现（后验分析）→ `data_report`

**前置条件**：话题非空；可调用 `trend_monitor` 拉热度数据；突发类话题建议采样窗口 ≤ 1h；长尾话题采样窗口 24h。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| topic | string / string[] | ✓ | 单话题或批量 |
| mode | enum | ✗ | `single` / `batch` / `compare`，默认 `single` |
| context | string | ✗ | 背景信息（加权分数） |
| compareTopics | string[] | ✗ | 参照话题（compare 模式） |
| category | string | ✗ | 话题归属类别（科技 / 财经 / 娱乐 / ...） |
| horizonHours | int | ✗ | 趋势预测窗口，默认 12 |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| score | int | 综合热度分 0-100 |
| grade | enum | S (≥90) / A (70-89) / B (50-69) / C (< 50) |
| dimensions | `{media, search, social, crossPlatform}` | 四维明细（各 0-100） |
| trend | `{direction, peakEta, peakScore, decayRate}` | 趋势预测 |
| rank | `{inCategory, percentile}` | 同类分位 |
| comparison | `{myScore, others[]}` | compare 模式对比 |
| confidence | float | 置信度 |
| warnings | string[] | 数据不足 / 预测不确定 |

## 工作流 Checklist

- [ ] Step 0: 话题归类（基于关键词 + 上下文）
- [ ] Step 1: 媒体关注度 —— 调 `news_aggregation` 拿相关报道条数
- [ ] Step 2: 搜索指数 —— 百度指数 / 微信指数 / 抖音指数 代理值
- [ ] Step 3: 社交讨论 —— 微博 / 知乎 / 小红书的讨论量
- [ ] Step 4: 跨平台覆盖 —— 命中 ≥ N 个平台即加成
- [ ] Step 5: 时效半衰期修正（突发 / 持续 / 长尾分类）
- [ ] Step 6: 综合评分 = Σ(维度分 × 权重) × 时效系数
- [ ] Step 7: 等级分档 + 同类分位
- [ ] Step 8: 趋势预测（方向 / 峰值时间 / 峰值强度 / 衰减率）
- [ ] Step 9: compare 模式 —— 并排对比 + 差距说明

## 四维权重与半衰期

**维度权重**（可通过 EXTEND 调）：

| 维度 | 权重 | 0-100 评分依据 |
|-----|-----|---------------|
| 媒体关注度 | 30% | 主流媒体报道条数 + 权威度加权 |
| 搜索指数 | 25% | 百度 / 微信 / 抖音指数归一 |
| 社交讨论 | 25% | 微博 / 知乎 / 小红书讨论量归一 |
| 跨平台覆盖 | 20% | ≥ 3 平台上榜 +15%；≥ 5 平台 +25% |

**时效半衰期**：

| 类型 | 判定 | 半衰期 |
|-----|-----|-------|
| 突发 | 单日冒出 | 12h（衰减 50%） |
| 持续热点 | 3-7 日热度 | 48h |
| 长尾 | 政策 / 产业 | 72h+ |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 四维齐全 | 100% |
| 2 | 同类分位可解释 | 必附 "在 XX 类第 Y%" |
| 3 | 趋势预测含峰值时间 | 100% |
| 4 | S 级需多源佐证 | 媒体 + 搜索 + 社交至少两者 ≥ 80 |
| 5 | 置信度透明 | 低于 0.6 显式 warnings |
| 6 | compare 对比直观 | 并排表 + 差距分 |
| 7 | 半衰期正确应用 | 突发类 12h 衰减 50% 可验证 |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 营销话题给 S | 单平台刷榜被高估 | 跨平台加成强校验：< 3 平台无加成 |
| 长尾话题给 C | 瞬时低热但长期价值 | 按类型切换半衰期；长尾不按突发衰减 |
| 趋势预测凭想象 | 无数据给出"1h 达峰" | 数据不足时 warnings；预测标注不确定 |
| 同类分位失效 | 科技话题与娱乐混排 | 按 `category` 分桶排 |
| 置信度虚高 | 数据全缺还给 0.9 | 各维度缺项按比例降 confidence |

## 输出示例

```json
{
  "topic": "国务院发布生成式AI管理条例",
  "score": 94,
  "grade": "S",
  "dimensions": {
    "media": 96,
    "search": 88,
    "social": 92,
    "crossPlatform": 98
  },
  "trend": {
    "direction": "rising",
    "peakEta": "2026-03-17 18:00",
    "peakScore": 97,
    "decayRate": "12h 内 -30%"
  },
  "rank": {
    "inCategory": "科技政策",
    "percentile": 2
  },
  "confidence": 0.92
}
```

## EXTEND.md 示例

```yaml
default_horizon_hours: 12

# 权重调整
weights:
  media: 0.30
  search: 0.25
  social: 0.25
  crossPlatform: 0.20

# 半衰期
halflife_hours:
  burst: 12
  sustained: 48
  longtail: 72

# 跨平台加成
cross_platform_bonus:
  "3": 0.15
  "5": 0.25

# 分级阈值
grade_thresholds:
  S: 90
  A: 70
  B: 50
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 单平台爆 S 被高估 | 跨平台校验未生效 | 强制 crossPlatform ≥ 60 才给 S |
| 长尾打低分 | 按突发半衰期 | category 归类 → 半衰期切换 |
| compare 无基准 | 对比话题类别不同 | 限制 compareTopics 同 category |
| 预测不准 | 数据窗口不够 | 采样窗口 ≥ 6h；warnings 透明 |
| confidence 虚高 | 缺项未降 | 每缺一维 -0.15 |
| 批量慢 | 每条都全采 | 批量共享一次采样数据 |

## 上下游协作

- **上游**：`trend_monitor` 输出热点清单、`news_aggregation` 媒体报道数、`social_listening` 社交数据、选题策划候选池
- **下游**：`angle_design` 按分数决定选题优先级；`publish_strategy` 按分数决定资源投入；`data_report` 做周度热度榜

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/heat_scoring/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
