---
name: summary_generate
displayName: 摘要生成（场景化重写版）
description: 为文章/稿件生成摘要。输出 CMS summary 字段（≤ 200 字）、分享摘要（≤ 80 字）、APP 列表页展示摘要（≤ 50 字）三种形态。按 9 大场景分化摘要风格。支持从正文自动抽取 + LLM 润色 + 多版本 A/B。
version: 5.0.0
category: generation
metadata:
  scenario_tags: [news, politics, sports, variety, livelihood, drama, daily_brief]
  compatibleEmployees: [xiaowen, xiaoce]
  runtime:
    type: llm_generation
    avgLatencyMs: 4000
    maxConcurrency: 10
    modelDependency: anthropic:claude-opus-4-7
---

# 摘要生成（summary_generate）

## Language

简体中文；每场景按对应风格（严谨/网感/口语等）。

## When to Use

✅ **应调用场景**：
- 文章已生成，需要配套摘要（CMS 入库时的 summary 字段）
- 社交分享时的短摘要（微博/朋友圈）
- APP 列表页展示摘要（≤ 50 字）
- 重新润色旧文章的摘要

❌ **不应调用场景**：
- 正文不足 200 字（直接用首段即可）
- 视频脚本（视频用钩子，不用摘要）

## Input Schema

```typescript
export const SummaryGenerateInputSchema = z.object({
  articleBody: z.string().min(100),          // 正文
  title: z.string().optional(),
  scenario: z.enum([
    "news_standard", "politics_shenzhen", "sports_chuanchao",
    "variety_highlight", "livelihood_zhongcao", "livelihood_tandian",
    "livelihood_podcast", "drama_serial", "daily_brief",
  ]),
  summaryTypes: z.array(z.enum([
    "cms_summary",           // ≤ 200 字，CMS summary 字段
    "share_summary",         // ≤ 80 字，社交分享
    "list_summary",          // ≤ 50 字，APP 列表
  ])).default(["cms_summary"]),
  variantCount: z.number().int().min(1).max(3).default(1),
});
```

## Output Schema

```typescript
export const SummaryGenerateOutputSchema = z.object({
  summaries: z.object({
    cms_summary: z.array(z.object({
      content: z.string(),
      charCount: z.number(),
      keyPoints: z.array(z.string()),         // 抽取到的 key points
      score: z.number().min(0).max(100),
    })).optional(),
    share_summary: z.array(z.object({
      content: z.string(),
      charCount: z.number(),
      hookStyle: z.string().optional(),
      score: z.number().min(0).max(100),
    })).optional(),
    list_summary: z.array(z.object({
      content: z.string(),
      charCount: z.number(),
      score: z.number().min(0).max(100),
    })).optional(),
  }),
  recommendedPerType: z.object({
    cms_summary: z.number().int().optional(),
    share_summary: z.number().int().optional(),
    list_summary: z.number().int().optional(),
  }),
  complianceCheck: z.object({
    passed: z.boolean(),
    flagged: z.array(z.string()),
  }),
});
```

## 9 场景摘要风格规范

### news_standard（新闻摘要）
- **风格**：事实提炼 + 5W1H 浓缩
- **CMS 摘要示例**：
  > "4 月 17 日，深圳发布《促进人工智能产业高质量发展若干措施》，明确 5 年内投入 200 亿元专项基金，建设三个国家级 AI 产业园，对符合条件的 AI 企业最高补贴 5000 万元。"（105 字）

### politics_shenzhen（时政摘要）
- **风格**：官方化 + 规范用语
- 必含政策全称、会议主体、关键数字
- **CMS 摘要示例**：
  > "《深圳市促进人工智能产业高质量发展若干措施》正式发布。该措施明确，深圳将在 2026-2030 年投入 200 亿元支持 AI 产业，重点涵盖产业园区建设、企业扶持、人才引进三方面。"（约 120 字）

### sports_chuanchao（体育摘要）
- **风格**：比分先行 + 关键时刻
- 必含比分、关键球员、时间
- **CMS 摘要示例**：
  > "凤凰山体育场，成都蓉城 2-1 绝杀四川 FC。第 89 分钟，冯潇霆头球破门锁定胜局。本轮过后，蓉城积 18 分升至第二。"（70 字）

### variety_highlight（综艺摘要）
- **风格**：看点聚焦 + 话题感
- 必含艺人名、节目名
- **CMS 摘要示例**：
  > "2026 春晚昨晚举行，沈腾贾玲合作的小品《脱不了干系》成为全场最大看点。盘点本届春晚 5 大名场面，从开场歌舞到压轴小品，每一个都值得回味。"（95 字）

### livelihood_zhongcao（种草摘要）
- **风格**：钩子 + 痛点 + CTA 暗示
- **CMS 摘要示例**：
  > "大牌都刺痛的敏感肌姐妹看这篇。这款薇诺娜舒敏特护霜，用完两周，泛红肉眼可见变淡，皮肤科医生都推荐。128 到 168 元，敏感肌值得一试。"（92 字）

### livelihood_tandian（探店摘要）
- **风格**：地点 + 品类 + 特色 + 人均
- **CMS 摘要示例**：
  > "藏在成都武侯区巷子里的"九二零成都老火锅"，30 年老店，牛油锅底香到隔壁桌回头。人均 95-120 元，推荐给想吃地道老火锅的朋友。"（72 字）

### livelihood_podcast（播客摘要）
- **风格**：主题 + 节奏 + 期待感
- **CMS 摘要示例**：
  > "《深圳晨间 4 分钟》第 18 期：今天聊深圳 AI 200 亿新政、川超开赛、油价下调这 3 件事。4 分钟，带你了解早上该知道的。"（75 字）

### drama_serial（短剧摘要）
- **风格**：人物悬念 + 本集钩子
- **CMS 摘要示例**：
  > "《裴总的掌心梨》第 1 集：设计师江嘉月误入裴氏集团总裁办公室。裴淮恩一句"一周后来上班"，让她陷入一场不知名的邂逅。她以为是面试错了公司，却不知道更大的秘密等着她。"（约 115 字）

### daily_brief（每日专题摘要）
- **风格**：日期 + 话题数 + 亮点
- **CMS 摘要示例**：
  > "4 月 17 日科技早资讯：深圳 AI 产业 200 亿新政出台、川超第 7 轮今晚开赛、本地 95 号汽油下调 0.3 元/升。4 分钟，带你把握今天最该知道的事。"（90 字）

## Workflow Checklist

```
摘要生成进度：
- [ ] Step 0: 抽取正文 key points（LLM 提炼 3-7 个）
- [ ] Step 1: 按 scenario 确定风格模板
- [ ] Step 2: 按 summaryType 分别生成
- [ ] Step 3: 字数控制（硬裁剪或重生）
- [ ] Step 4: 评分 + 选推荐
- [ ] Step 5: 合规扫描
```

## 字数控制

| Type | max | 推荐 |
|------|-----|-----|
| cms_summary | 200 | 80-140 |
| share_summary | 80 | 40-60 |
| list_summary | 50 | 20-40 |

## 质量自检

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 字数在目标范围内 | 硬 |
| 2 | 关键事实包含 | ≥ 3 个 |
| 3 | 场景风格匹配 | ≥ 70 |
| 4 | 合规 | passed |
| 5 | 无剧透（短剧/悬疑） | ✓ |

## 典型失败模式

### 失败 1: 摘要 ≈ 标题

**表现**：摘要和标题基本一样
**修正**：要求信息增量，摘要必含标题未提的细节

### 失败 2: 超字数

**表现**：CMS 摘要 250 字
**修正**：硬裁剪 + 重生

### 失败 3: 场景错配

**表现**：新闻摘要写成娱乐风
**修正**：按 scenario 锁定

### 失败 4: 短剧剧透

**表现**：摘要直接剧透本集反转
**修正**：仅提到悬念入口

## EXTEND.md

```yaml
default_summary_types: [cms_summary, share_summary]
default_variant_count: 1

lengths:
  cms_summary:
    max: 200
    target_range: [80, 140]
  share_summary:
    max: 80
    target_range: [40, 60]
  list_summary:
    max: 50
    target_range: [20, 40]

scenario_weights:
  drama_serial:
    no_spoiler: true
  sports_chuanchao:
    require_score: true
```

## Troubleshooting

| 问题 | 解决 |
|------|------|
| 摘要空洞 | 强制包含 ≥ 3 key facts |
| 摘要过于文绉绉 | 按 scenario 风格调整 |
| 短剧剧透 | Step 2 加 `no_spoiler` 检查 |
| 字数超限 | 硬裁剪 + LLM 重生 |

## Completion Report

```
📝 摘要生成完成！

🎯 场景：{scenario}
📋 生成 Types：{summaryTypes.join("、")}

{summaryTypes.map(type => `
  【${type}】 推荐 #${recommendedPerType[type]}
    内容：${summaries[type][recommended].content}
    字数：${charCount}
    评分：${score}/100
`).join("\n")}

✅ 合规：{complianceCheck.passed}
```

## 上下游协作

- 上游：`content_generate` 输出 → summary_generate 产出摘要
- 下游：`cms_publish` 的 summary 字段

## Changelog

| Version | Date | 变更 |
|---------|------|------|
| 5.0.0 | 2026-04-18 | 重写：9 场景 + 3 种摘要类型 + A/B 多版本 |

## 参考实现文件

| 文件 | 路径 |
|------|------|
| Skill Runtime | `src/lib/agent/tools/summary-generate.ts` |
