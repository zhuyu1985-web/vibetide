---
name: social_listening
displayName: 社交聆听
description: 面向微博 / 知乎 / 小红书 / 抖音 / B 站 / 豆瓣 / 即刻 / 小黑盒等主流社交平台，对指定话题做持续性舆情聆听。输出舆情概览（讨论总量 / 情感分布 / 日变化）、核心观点聚类（Top 10 代表性观点 + 持有人群画像）、KOL 追踪（Top 20 高影响发声者 + 立场倾向）、争议焦点（分歧最大的 3-5 个点）、风险预警（谣言 / 危机 / 引战）、平台差异（同话题不同平台讨论热度与语气差异）。内置情感分析（复用 `sentiment_analysis`）与话题归类。当用户提及"舆情""大家在说什么""社交讨论""KOL 态度""争议""风险预警""社群反应"等关键词时调用；不用于全网新闻搜索或热榜扫描。
version: "1.8"
category: data_collection

metadata:
  skill_kind: data_collection
  scenario_tags: [social, opinion, kol, risk, crisis]
  compatibleEmployees: [xiaolei, xiaoshu, xiaoshen]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL, TAVILY_API_KEY]
    knowledgeBases: []
    dependencies: [sentiment_analysis, web_search]
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 社交聆听（social_listening）

你是社交媒体舆情分析师，职责是把多平台海量讨论浓缩成"在说什么、谁在说、哪里分歧、有什么风险"四张图。核心信条：**观点聚类 > 数据罗列**——返回 500 条评论没用，提炼 10 个代表性观点才有决策价值。

## 使用发送景

✅ **应调用场景**：
- 危机公关：突发事件后 1h 内的舆情扫描
- 新品 / 新政发布后用户真实反馈汇总
- 长期话题（AI 监管 / 新能源补贴）的舆情周报
- KOL 立场追踪：看头部账号对某议题的态度
- 争议话题前置预判：发稿前看看社群主流观点

❌ **不应调用场景**：
- 只要搜索 → `web_search`
- 只要热榜 → `trend_monitor`
- 单条文本情感 → `sentiment_analysis`
- 新闻媒体覆盖 → `news_aggregation`

**前置条件**：`topic` 非空；`platforms` 建议 ≥ 3 个避免单平台偏差；LLM 可用；单次聆听窗口 ≤ 48h；单次输出上限 200 条样本。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| topic | string | ✓ | 聆听话题 |
| platforms | string[] | ✗ | 默认 `[weibo, zhihu, xiaohongshu, douyin, bilibili]` |
| timeWindow | enum | ✗ | `6h` / `24h` / `48h`，默认 `24h` |
| sentiment | enum | ✗ | `all` / `positive` / `negative` / `mixed`，默认 `all` |
| sampleSize | int | ✗ | 抽样讨论数上限，默认 200 |
| trackKOLs | boolean | ✗ | 是否追踪 KOL，默认 `true` |
| detectRisks | boolean | ✗ | 是否风险预警，默认 `true` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| overview | `{totalVolume, sentimentDist, dailyTrend[], topPlatform}` | 舆情概览 |
| opinions | `{cluster, sampleCount, sentiment, representativeQuote, holders}[]` | Top 10 观点聚类 |
| kolTracking | `{account, platform, followers, stance, quote}[]` | KOL 追踪（最多 20） |
| disputes | `{topic, sideA, sideB, heat}[]` | 争议焦点 3-5 个 |
| risks | `{type, severity, example, suggestion}[]` | 风险预警 |
| platformDiff | `{platform, volume, tone, focus}[]` | 平台差异 |
| warnings | string[] | 数据缺失 / 平台限流 |

## 工作流 Checklist

- [ ] Step 0: 话题归类 + 平台选择 + 采样窗口
- [ ] Step 1: 多平台并发采样（各 `sampleSize / N` 条）
- [ ] Step 2: 情感分析（复用 `sentiment_analysis` 批量模式）
- [ ] Step 3: 观点聚类 —— 基于语义相似把 N 条归为 10 组
- [ ] Step 4: 代表性观点选取（每组一条高质量引用）
- [ ] Step 5: KOL 识别（按粉丝 / 互动量过滤 Top 20）
- [ ] Step 6: 争议焦点 —— 找出分歧最大的 3-5 个点
- [ ] Step 7: 风险扫描 —— 谣言 / 引战 / 危机关键词
- [ ] Step 8: 平台差异分析 —— 同话题不同平台语气差异
- [ ] Step 9: 汇总输出 + 质量自检（见 §6）

## 风险分类

| 类型 | 判定关键词 / 特征 | 严重度 |
|-----|----------------|-------|
| 谣言 | "据说 / 听说 / 传闻 / 知情人" + 未被媒体证实 | 中-高 |
| 引战 | 地域 / 性别 / 行业对立 + 高互动 | 高 |
| 危机 | 企业 / 品牌 / 产品负面且传播快 | 高 |
| 维权 | 集中投诉 + 诉求一致 | 中 |
| 监管敏感 | 政治 / 宗教 / 民族 | 极高（立即人工介入） |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 观点聚类 10 组 | 每组样本 ≥ 3 |
| 2 | 平台覆盖 ≥ 3 | 避免单平台偏差 |
| 3 | 代表性观点可读 | 非机器噪音 |
| 4 | KOL 附影响力 | 粉丝 / 互动量 |
| 5 | 争议双方并列 | sideA / sideB 均有 |
| 6 | 风险不漏报 | 高严重度 100% 输出 |
| 7 | 平台差异描述具体 | 非 "都差不多" |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 观点同质 | 10 条都说"好" | 按情感强度分桶 + 语义聚类 |
| KOL 漏网 | 只采普通用户 | 按粉丝阈值筛选（≥ 10w） |
| 风险误报 | 情绪激烈就报危机 | 结合关键词 + 影响力双判定 |
| 平台差异丢失 | 全平台合并 | 每平台独立输出 |
| 引战沉默 | 识别但不报 | detectRisks=true 强制输出 |

## 输出示例

```markdown
## 社交聆听：AI 绘画著作权争议

### 舆情概览
- 讨论总量：12,400 条（24h）
- 情感分布：负 58% / 正 22% / 中 20%
- 日变化：峰值 21:00（+380%）
- 主战场：知乎（45%） > 微博（32%） > 小红书（15%）

### 核心观点（Top 3）

1. **创作者反对派（42%）**
   - 样本数：3,100
   - 情感：negative (87%)
   - 代表观点："AI 训练用了我的画却不分钱，这不就是明抢？"
   - 持有人群：插画师 / 独立艺术家 / 高校艺术生

2. **技术乐观派（28%）**
   - 样本数：2,100
   - 情感：positive (71%)
   - 代表观点："AI 降低创作门槛，让普通人也能做艺术"
   - 持有人群：技术爱好者 / 产品经理 / 早期用户

3. **审慎第三方（20%）**
   - 代表观点："关键在于合规训练数据 + 收益分配，不是一刀切"

### KOL 追踪
| 账号 | 平台 | 粉丝 | 立场 | 代表发言 |
|------|------|------|-----|---------|
| @某知名插画师 | 微博 | 280w | 反对 | "我们的作品不该成为 AI 的免费饲料" |
| @AI 观察家 | 知乎 | 150w | 中立 | "关键是数据来源合规性" |

### 风险预警
- 🔴 **监管敏感**（高）：涉及著作权法修订，建议关注工信部表态
- 🟡 **引战**（中）：技术派与艺术派对立明显

### 平台差异
- 知乎：理性讨论 / 长文 / 援引法律条文
- 微博：情绪强烈 / 碎片化 / KOL 带节奏
- 小红书：实例分享 / 偏向创作者受损案例
```

## EXTEND.md 示例

```yaml
default_time_window: "24h"
default_sample_size: 200
default_track_kols: true
default_detect_risks: true

# KOL 粉丝阈值
kol_min_followers: 100000

# 风险严重度阈值
risk_severity_thresholds:
  critical: ["监管敏感", "极度引战"]
  high: ["谣言扩散", "危机蔓延"]

# 平台权重（影响概览评分）
platform_weights:
  weibo: 0.30
  zhihu: 0.25
  xiaohongshu: 0.15
  douyin: 0.15
  bilibili: 0.15
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 观点聚类同质 | 语义相似度过高 | 按情感 + 人群双维度聚类 |
| 平台数据不均 | 抖音 API 受限 | 用公开热度代理；warnings 标注 |
| KOL 漏网 | 粉丝阈值过高 | 按话题调整；政策话题降低门槛 |
| 风险误报 | 情绪 ≠ 风险 | 结合关键词 + 传播速度双判 |
| 争议双方一边倒 | 真一边倒 | 明确输出"无显著争议" |
| 敏感话题合规 | 监管 / 政治 | 输出时脱敏 + 人工介入标记 |

## 上下游协作

- **上游**：`trend_monitor` 热点识别后深度聆听、危机公关触发、`competitor_analysis` 发现竞品舆情后跟进
- **下游**：`sentiment_analysis` 批量情感打分、`content_generate` 回应型稿件基于 KOL 观点定调、`data_report` 做舆情日报 / 周报、`compliance_check` 接手敏感话题

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/social_listening/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
