---
name: audience_analysis
displayName: 受众分析
description: 围绕指定主题 / 栏目 / 渠道生成目标受众画像，含人口学五维（年龄段 / 性别比 / 地域分布 / 职业 / 收入段）、内容偏好（题材 / 时长 / 风格）、消费行为（活跃时段 / 互动习惯 / 付费意愿）、平台使用特征（主力平台 / 次级平台 / 交叉使用）、3-5 类受众分群（核心 / 扩展 / 流失风险）和针对各群的内容适配建议。结合历史数据（阅读 / 完播 / 互动率）做校准；缺数据时给出"假设画像"并标注。当用户提及"用户画像""目标人群""谁在看""受众""读者群体""观众分层"等关键词时调用；不用于纯热度监测或竞品分析。
version: "1.9"
category: data_analysis

metadata:
  skill_kind: analysis
  scenario_tags: [audience, persona, segmentation, strategy]
  compatibleEmployees: [xiaoshu, xiaoce, xiaofa]
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

# 受众分析（audience_analysis）

你是受众研究专家，职责是把"某个话题 / 栏目 / 稿件"的潜在读者画出来、分出层、给出"对谁说、怎么说、在哪儿说"的策略。核心信条：**画像要可行动 > 数据堆砌**——"25-35 岁一线城市中产" 必须配"在通勤时段刷 15-30s 短视频"才算合格。

## 使用条件

✅ **应调用场景**：
- 选题策划前锁定目标人群（给谁看这篇）
- 渠道分发前决定首发平台和投放时段
- 新栏目定位 / 新产品冷启动
- 稿件效果不及预期后的画像复盘
- 竞品账号目标人群拆解

❌ **不应调用场景**：
- 单纯要热度走势 → `heat_scoring`
- 要情感分析 → `sentiment_analysis`
- 要竞品策略 → `competitor_analysis`
- 要数据报表 → `data_report`

**前置条件**：`topic` 或 `platform` 至少提供一个；有历史数据（阅读 / 完播 / 互动）时结果更准；无数据时走 LLM 假设画像并标注。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| topic | string | ✓ | 分析主题 / 栏目名 / 稿件标题 |
| platform | string | ✗ | 目标平台（微信 / 抖音 / 小红书 / 微博 / 头条） |
| existingData | `{views, completion, interactions, comments}` | ✗ | 历史表现数据 |
| channelSlug | string | ✗ | 内部 APP 栏目 slug（映射受众偏好） |
| segmentCount | int | ✗ | 分群数，默认 3，最大 5 |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| profile | `{age, gender, city, occupation, income}` | 主画像 |
| contentPref | `{topics[], formats[], duration, tone}` | 内容偏好 |
| behaviors | `{activeHours[], devices[], interactionHabits}` | 行为模式 |
| platformUsage | `{primary, secondary[], crossUsage}` | 平台使用 |
| segments | `{label, size, traits, recommendation}[]` | 3-5 类受众分群 |
| recommendations | string[] | 5-8 条内容 / 渠道 / 时段适配建议 |
| confidence | float | 置信度（有数据 / 纯假设） |

## 工作流 Checklist

- [ ] Step 0: 主题归类（政治 / 科技 / 娱乐 / 民生 / ...）+ 栏目匹配
- [ ] Step 1: 基线画像 —— 按主题类型取默认人群基线
- [ ] Step 2: 数据校准 —— 有 `existingData` 时按完播 / 互动率调整
- [ ] Step 3: 平台特性注入 —— 抖音偏年轻、小红书偏女性、微博偏都市等
- [ ] Step 4: 人口学五维输出
- [ ] Step 5: 内容偏好（题材 / 时长 / 风格）
- [ ] Step 6: 行为模式（活跃时段 / 设备 / 互动习惯）
- [ ] Step 7: 受众分群（核心 / 扩展 / 流失）
- [ ] Step 8: 可行动建议（首发平台 / 最佳时段 / tone / 标题风格）
- [ ] Step 9: 置信度评估 + 自检（见 §5）

## 平台画像先验

| 平台 | 性别偏向 | 年龄主力 | 内容偏好 | 最佳时段 |
|-----|---------|---------|---------|---------|
| 抖音 | 女略多 | 18-35 | 短视频 / 情绪 / 爽感 | 12-14 / 20-23 |
| 小红书 | 女 70%+ | 20-35 | 图文 / 种草 / 生活 | 20-23 |
| 微博 | 均衡 | 20-40 | 热点 / 明星 / 评论 | 9-11 / 19-22 |
| 微信公众号 | 均衡 | 25-45 | 深度 / 长文 | 7-9 / 12-13 / 19-22 |
| 头条 | 男略多 | 30-50 | 硬新闻 / 政经 | 7-10 / 20-22 |
| B 站 | 男略多 | 18-28 | 硬核 / 娱乐 / 考据 | 20-24 |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 五维画像齐 | 100% |
| 2 | 分群数 | 3-5 |
| 3 | 建议可行动 | 含具体平台 / 时段 / 风格 |
| 4 | 有数据必校准 | existingData 非空时反映到画像里 |
| 5 | 平台先验命中 | platform 指定时应用对应先验 |
| 6 | 置信度透明 | 100% 返回 + 说明数据支持度 |
| 7 | 纯假设必标注 | confidence < 0.6 明确 warning |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 画像套话 | "25-45 岁关注社会话题人群" | 必须含职业 / 收入 / 地域 |
| 建议不可行动 | "建议扩大影响" | 每条含平台 / 时段 / 风格三要素 |
| 忽略数据 | 有数据没用 | Step 2 强制校准 |
| 分群重叠 | 3 群都是都市中产 | 分群维度要正交（年龄 / 收入 / 使用场景） |
| 平台混淆 | 小红书给 70% 男性 | 平台先验表硬校验 |

## 输出示例

```markdown
## 受众分析：新能源汽车补贴政策

### 主画像
- 年龄：28-42 岁为主（占比 68%）
- 性别：男 62% / 女 38%
- 城市：一二线为主（北上广深 + 成渝杭苏）
- 职业：白领 / 企业中层 / 自由职业
- 收入：月入 1.5-4 万

### 内容偏好
- 题材：政策解读 > 车型对比 > 用户体验
- 格式：图文 > 短视频（3-5min）
- 风格：理性 / 数据驱动 / 有观点

### 行为模式
- 活跃时段：工作日 7-9 通勤 / 12-13 午休 / 21-23 睡前
- 互动：转发 > 评论 > 点赞
- 平台：主微信公众号 / 次知乎 + 微博

### 受众分群
1. **核心群（45%）**：正在或半年内考虑购车的一线城市白领  
   建议：政策对比 + 车型推荐深度长文，首发公众号
2. **扩展群（35%）**：关注政策但暂无购车计划的泛科技人群  
   建议：抖音短视频 3min 政策速解，时段 12-13 / 21-22
3. **流失风险（20%）**：对补贴下调敏感的观望派  
   建议：横向对比稿（油电 / 换购 / 二手）降低购车门槛感知

### 行动建议
1. 首发公众号长文（政策 + 3 款车对比）
2. 同步微博话题 #新能源补贴 短评 + 微博客户端推
3. 抖音剪 3 条竖屏 45s 解读短片
4. 知乎专栏沉淀长文 SEO 长尾流量
5. 最佳发布时段 周三 21:00

置信度：0.85（基于过往 10 篇同主题 existingData 校准）
```

## EXTEND.md 示例

```yaml
default_segment_count: 3
default_platform: "weixin"

# 栏目先验（命中自动注入画像基线）
channel_prior:
  app_politics: { age: "30-55", gender: "M-biased" }
  app_variety: { age: "18-32", gender: "F-biased" }
  app_livelihood_zhongcao: { age: "20-35", gender: "F70%" }

# 低数据时置信度下限
min_confidence_with_data: 0.8
min_confidence_no_data: 0.5
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 画像空泛 | 模型吐套话 | 强制五维细化；给举例 few-shot |
| 建议落不下去 | 未含时段 / 平台 | 每条强制三要素 |
| 分群重叠 | 维度单一 | 分群至少 2 个正交维度 |
| 平台先验失效 | 未传 platform | 默认 weixin；或要求必填 |
| 置信度虚高 | 纯假设给 0.9 | 无 existingData 上限 0.6 |
| 跨栏目混淆 | 通用栏目不明 | channelSlug 强制绑定 |

## 上下游协作

- **上游**：选题策划输入、`competitor_analysis` 竞品受众参考、历史稿件数据
- **下游**：`publish_strategy` 基于画像选平台和时段；`headline_generate` 按受众偏好定标题风格；`content_generate` 按偏好选 tone 和时长；`data_report` 做画像 vs 实际对比

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/audience_analysis/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
