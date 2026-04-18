---
name: headline_generate
displayName: 标题生成（场景化重写版）
description: 为各类稿件生成高质量标题，按 9 大 APP 栏目场景分化风格（新闻严肃 / 时政规范 / 体育情绪 / 综艺娱乐 / 民生亲切 / 短剧悬念 / 每日专题 / 首页推荐）。支持主标题+副标题+短标题三种形态（对应 CMS title/subTitle/shortTitle）。输出含 A/B 多版本、SEO 优化、钩子强度评分、合规扫描。
version: 5.0.0
category: generation
metadata:
  scenario_tags: [news, politics, sports, variety, livelihood, drama, daily_brief]
  compatibleEmployees: [xiaowen, xiaoce]
  runtime:
    type: llm_generation
    avgLatencyMs: 5000
    maxConcurrency: 10
    modelDependency: anthropic:claude-opus-4-7
---

# 标题生成（headline_generate）

## Language

简体中文；按场景匹配风格（新华体 / 网感 / 正式 / 娱乐化等）。

## When to Use

✅ **应调用场景**：
- 基于已生成的正文内容提取/优化标题
- 为未定稿内容先出标题方案（多版本 A/B）
- 旧标题重做（如 SEO 优化、改风格）
- CMS 入库前自动生成 listTitle / shortTitle

❌ **不应调用场景**：
- 没有任何内容 brief 时（标题应基于内容写）
- 分集短剧标题（走 `duanju_script` 内建的分集标题）

## Input Schema

```typescript
export const HeadlineGenerateInputSchema = z.object({
  contentSummary: z.string(),               // 正文或核心要点
  scenario: z.enum([
    "news_standard", "politics_shenzhen", "sports_chuanchao",
    "variety_highlight", "livelihood_zhongcao", "livelihood_tandian",
    "livelihood_podcast", "drama_serial", "daily_brief",
  ]),
  style: z.enum([
    "declarative",       // 陈述型（新闻/时政）
    "question",          // 疑问型（民生/娱乐）
    "numerical",         // 数字型（榜单/盘点）
    "reversal",          // 反转型（综艺/娱乐）
    "emotional",         // 情感型（体育/民生）
    "suspense",          // 悬念型（短剧/综艺）
  ]).optional(),
  keywords: z.array(z.string()).optional(),  // SEO 关键词
  variantCount: z.number().int().min(1).max(5).default(3),  // 生成几个版本
  generateSubtitles: z.boolean().default(true),
  generateShortTitle: z.boolean().default(true),  // CMS 短标题
  maxMainTitleLength: z.number().int().default(28),
  maxSubtitleLength: z.number().int().default(40),
  maxShortTitleLength: z.number().int().default(15),
});
```

## Output Schema

```typescript
export const HeadlineGenerateOutputSchema = z.object({
  variants: z.array(z.object({
    title: z.string(),                        // 主标题
    subtitle: z.string().optional(),          // 副标题
    shortTitle: z.string().optional(),        // 短标题（CMS listTitle）
    style: z.string(),                         // 命中风格
    scores: z.object({
      attractiveness: z.number().min(0).max(100),  // 吸引力
      clarity: z.number().min(0).max(100),         // 清晰度
      seoScore: z.number().min(0).max(100),        // SEO 分
      styleMatch: z.number().min(0).max(100),      // 风格匹配
      overall: z.number().min(0).max(100),
    }),
    charCount: z.number(),
    keywordsCovered: z.array(z.string()),
    hookPattern: z.string().optional(),       // 命中钩子模式
    warnings: z.array(z.string()),
  })),
  recommended: z.number().int(),              // 推荐 variant 的 index
  complianceCheck: z.object({
    passed: z.boolean(),
    flaggedVariants: z.array(z.number()),     // 被 flag 的 variant index
  }),
});
```

## 9 场景标题风格规范

### 场景 1: news_standard（新闻标题）

**原则**：**事实先行 + 关键要素 + 简洁有力**

**模板**：
- "{主体} {动作} {客体/量级}" → 深圳发布 AI 产业政策 5 年投 200 亿
- "{事件}：{核心结果}" → 深圳两会闭幕：9 大民生举措落地

**禁忌**：
- ❌ 夸张感叹（"震惊！""惊现！"）
- ❌ 标题党（"你绝对想不到……"）
- ❌ 模糊主体（"某人""有关方面"）

**长度**：主 16-25 字 / 副 25-40 字 / 短 8-12 字

---

### 场景 2: politics_shenzhen（时政标题）

**原则**：**官方表述 + 权威感 + 严谨**

**模板**：
- "{会议/领导} {动作/表述}" → 深圳市委常委会召开会议 研究部署 AI 产业发展
- "{政策名称}发布 {关键信息}" → 《深圳 AI 产业若干措施》发布 5 年投 200 亿

**要求**：
- 会议/政策名完整
- 领导姓名完整规范
- 不用情感色彩词

**禁忌**：
- ❌ 对政策评价（"重大政策""力度空前"）
- ❌ 口语化（"聊聊""说说"）
- ❌ 网络用语

**长度**：主 20-30 字 / 副 30-45 字 / 短 10-15 字

**审核档位**：严

---

### 场景 3: sports_chuanchao（体育标题）

**原则**：**比分/关键球员 + 情绪张力 + 现场感**

**模板**：
- 战报："{比分} {关键动作}" → 2-1 绝杀！成都蓉城补时头球破门
- 预告："{对阵} {看点}" → 蓉城 VS 四川 FC 今晚打响德比战
- 球星："{球员} {数据/表现}" → 冯潇霆补时头球绝杀 生涯第 50 球

**允许词**：绝杀、力克、完胜、险胜、惊天逆转、致命一击、开门红

**禁忌**：
- ❌ 地域攻击（"川超就是水")
- ❌ 球员侮辱（"XX 就是水")

**长度**：主 14-25 字（越冲击越好）

---

### 场景 4: variety_highlight（综艺标题）

**原则**：**名场面 + 梗感 + 榜单/反转**

**模板**：
- 榜单："{数字} 大看点 {关键词}" → 春晚 5 大看点 第 3 个让人破防
- 名场面："{艺人} 这段 {动作}" → 沈腾贾玲这段 真的整活儿了
- 反转："以为是 X 结果是 Y" → 以为是催泪戏 结果演成了搞笑 Top1

**允许词**：炸场、封神、整活儿、出圈、YYDS（谨慎）、顶流、翻车、绝绝子（谨慎）

**禁忌**：
- ❌ 艺人对比引战
- ❌ 恶意嘲讽
- ❌ 伪造瓜

**长度**：主 14-25 字

---

### 场景 5: livelihood_zhongcao（种草标题）

**原则**：**痛点/反差 + 具象感官 + CTA 暗示**

**模板**：
- 痛点："{用户痛点}的姐妹必看 这款……"
- 反差："我以为 {预期} 没想到 {实际}"
- 数字："{价格/时长/对比}" → "89 块的粉底 凭什么吊打大牌"

**允许词**：宝子、冲、绝了、天花板、顶了、真的爱

**禁忌**：
- ❌ 广告法极限词（最/第一/绝对/100%）
- ❌ 硬广腔

**长度**：主 12-25 字（短红书式）

---

### 场景 6: livelihood_tandian（探店标题）

**原则**：**地点 + 品类 + 记忆点 + 人均**

**模板**：
- 宝藏型："藏在 {地点} 的 {品类} {特色}"
- 反差型："在 {城市} 吃 {异地美食}？这家真的行"
- 性价比型："人均 {金额} 吃 {品类} 我服了"

**允许词**：宝藏、藏、巷子、烟火气、本地人、必打卡

**长度**：主 14-25 字

---

### 场景 7: livelihood_podcast（播客标题）

**原则**：**主题 + 亲切感 + 可听性**

**模板**：
- 早间型："{日期} 早资讯：{3 个关键词}"
- 主题型："今天聊聊 {主题}"
- 系列型："{节目名} 第 {X} 期：{副题}"

**允许**：口语化、亲切称呼（朋友/你们）

**长度**：主 15-25 字 / 副 25-35 字

---

### 场景 8: drama_serial（短剧标题）

**原则**：**悬念 + 钩子 + 分集标识**

**模板**：
- 系列名 + 集数 + 集副标题
  - "裴总的掌心梨｜第 3 集：她发现了"
- 集副标题独立有悬念
  - "离婚后，前夫悔断肠｜第 1 集：她穿着婚纱，摔在他脚下"

**允许词**：悬念词（她发现了、他的秘密、原来如此、反转）

**长度**：主 20-35 字（含系列名）

**审核档位**：严

---

### 场景 9: daily_brief（每日专题标题）

**原则**：**日期 + 主题 + 亮点预告**

**模板**：
- "{日期} {主题}：{1 句亮点}"
- 例：4 月 17 日科技早资讯：深圳 AI 200 亿新政上线

**长度**：主 18-30 字

---

## CoT 工作流程

```
标题生成：
- [ ] Step 0: 理解 contentSummary + scenario + style
- [ ] Step 1: 识别核心要素（5W1H / 金句 / 数字 / 对比）
- [ ] Step 2: 选择模板（按场景风格规范）
- [ ] Step 3: 生成 variantCount 个主标题
- [ ] Step 4: 为每个主标题生成副标题 + 短标题
- [ ] Step 5: 评分（吸引力/清晰度/SEO/风格匹配）
- [ ] Step 6: 合规扫描（广告法/敏感词/场景禁忌）
- [ ] Step 7: 选出推荐 variant
```

## 评分规则

```typescript
function scoreHeadline(title: string, scenario: string, keywords: string[]): Scores {
  return {
    attractiveness: calcAttractiveness(title),   // 钩子模式命中 + 情绪词 + 数字
    clarity: calcClarity(title),                  // 主体清晰 + 动词强 + 无歧义
    seoScore: calcSeoScore(title, keywords),      // 关键词覆盖 + 密度
    styleMatch: calcStyleMatch(title, scenario),  // 场景风格词典命中
    overall: weightedAvg(...)                     // 加权
  };
}
```

## Few-shot 正例（多场景对比）

### 输入：相同主题，不同场景输出

**contentSummary**: "深圳发布人工智能产业新政策，5 年投 200 亿，设立 3 个产业园，最高补贴 5000 万"

| scenario | 主标题 | 副标题 | shortTitle |
|----------|-------|--------|-----------|
| news_standard | 深圳发布 AI 产业新政策 5 年投入 200 亿元 | 设立 3 个产业园 最高补贴 5000 万 | 深圳 AI 新政 |
| politics_shenzhen | 《深圳市促进人工智能产业高质量发展若干措施》发布 | 明确 5 年投入 200 亿元 重点建设三大国家级产业园 | AI 产业若干措施 |
| sports_chuanchao | —（不适用） | — | — |
| daily_brief | 4 月 17 日科技资讯：深圳 200 亿押注 AI | 最高补贴 5000 万 3 个产业园启动 | 深圳 AI 200 亿 |

## 合规扫描

```typescript
// 按场景走对应的扫描器
const compliance = scanHeadline(title, {
  scenario: input.scenario,
  rules: [
    ...commonRules,           // 广告法极限词（全场景通用）
    ...scenarioRules[scenario],
  ],
});
```

## 质量自检

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 主标题字数 | ≤ maxMainTitleLength |
| 2 | 副标题字数 | ≤ maxSubtitleLength |
| 3 | 短标题字数 | ≤ maxShortTitleLength |
| 4 | 关键词覆盖 | ≥ 60% |
| 5 | 场景风格匹配 | styleMatch ≥ 70 |
| 6 | 合规 | passed |
| 7 | variant 间差异度 | 不雷同（编辑距离 ≥ 5） |

## 典型失败模式

### 失败 1: 标题党

**表现**：用夸张感叹（"震惊！"）
**修正**：场景合规扫描禁用词

### 失败 2: 场景错配

**表现**：时政用了娱乐风格
**修正**：Step 0 按 scenario 锁定模板

### 失败 3: 关键词堆砌

**表现**：关键词全塞进去，读起来很怪
**修正**：SEO 密度 ≤ 30%

### 失败 4: 多个 variant 雷同

**表现**：3 个版本只差一个字
**修正**：variant 间强制差异度校验

## EXTEND.md 用户配置

```yaml
default_variant_count: 3
default_generate_subtitles: true
default_generate_short_title: true

scenario_length_overrides:
  politics_shenzhen:
    max_main: 32
  livelihood_zhongcao:
    max_main: 25

brand_prefix:
  app_news: "【新闻】"          # 不启用时为空
  app_politics: ""

seo_keyword_weight: 0.3         # SEO 分在 overall 中的权重
```

## Feature Comparison

| Feature | headline_generate v5 | content_generate 内部标题 |
|---------|----------------------|--------------------------|
| 独立 A/B 多版本 | ✓ | ✗ |
| 副 + 短标题 | ✓ | 单标题 |
| 评分系统 | ✓ | ✗ |
| 场景差异化 | 9 场景 | 9 场景 |
| 合规扫描 | ✓ | ✓ |

## Prerequisites

- ✅ LLM
- ✅ `contentSummary` + `scenario`

## Troubleshooting

| 问题 | 解决 |
|------|------|
| 标题党命中 | 合规扫描强制，LLM 重写 |
| 字数超限 | maxTitle 硬裁剪 + 重生成 |
| 场景匹配度低 | 加载场景词典 |
| variant 雷同 | 强制差异度 |

## Completion Report

```
📰 标题生成完成！

🎯 场景：{scenario}
📋 Variants（{variants.length}）

{variants.map((v, i) => `
  #${i + 1}{i === recommended ? " 👑 推荐" : ""}
    主：${v.title}
    副：${v.subtitle ?? "—"}
    短：${v.shortTitle ?? "—"}
    评分：${v.scores.overall}/100（吸引力 ${v.scores.attractiveness} / 清晰度 ${v.scores.clarity} / SEO ${v.scores.seoScore}）
`).join("\n")}

✅ 合规：{complianceCheck.passed}
📝 关键词覆盖：{avgKeywordCoverage}%
```

## 上下游协作

### 上游
- `content_generate` 产生的文章 → 优化标题
- 运营手动指定主题 → 出 A/B 方案

### 下游
- `cms_publish`：选定版本入 CMS（title / subTitle / shortTitle）
- A/B 测试框架（未来）

## Changelog

| Version | Date | 变更 |
|---------|------|------|
| 5.0.0 | 2026-04-18 | 重写：9 场景分化风格 + 评分系统 + A/B 多版本 |

## 参考实现文件

| 文件 | 路径 |
|------|------|
| Skill Runtime | `src/lib/agent/tools/headline-generate.ts` |
| 评分器 | `src/lib/content/headline-scorer.ts` |
