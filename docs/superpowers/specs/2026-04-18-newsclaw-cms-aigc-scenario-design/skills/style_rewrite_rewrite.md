---
name: style_rewrite
displayName: 风格改写（场景化重写版）
description: 将一篇已有文章改写为另一种风格。支持 9 种目标风格（新华体 / 新闻标准 / 网感 / 口语 / 种草 / 探店 / 娱乐 / 深度 / 简报）。可用于：一次创作多平台分发、把外部稿件适配本台调性、A/B 测试多风格、改头换面二次创作。保留核心事实与数据，改变表达方式。
version: 5.0.0
category: generation
metadata:
  scenario_tags: [news, politics, sports, variety, livelihood, drama, daily_brief]
  compatibleEmployees: [xiaowen, xiaofa]
  runtime:
    type: llm_generation
    avgLatencyMs: 15000
    maxConcurrency: 5
    modelDependency: anthropic:claude-opus-4-7
---

# 风格改写（style_rewrite）

## Language

简体中文；按 targetStyle 切换语气与用词。

## When to Use

✅ **应调用场景**：
- 一篇新闻稿要同时适配 APP 多个栏目（新闻 严 / 社交 网感）
- 外部通稿改写为本台风格
- 同一主题生成多个风格版本供 A/B 测试
- 把"深度文"浓缩为"简报版"

❌ **不应调用场景**：
- 需要完全重写结构（应调用 `content_generate`）
- 跨语种翻译（走 `translation`）
- 仅调整标题（走 `headline_generate`）

## Input Schema

```typescript
export const StyleRewriteInputSchema = z.object({
  sourceContent: z.string().min(100),
  sourceStyle: z.enum([
    "unknown", "xinhua", "news_standard", "deep_analysis",
    "casual", "zhongcao", "tandian", "entertaining",
    "daily_brief_compact",
  ]).default("unknown"),
  targetStyle: z.enum([
    "xinhua",                // 新华体
    "news_standard",         // 新闻标准
    "deep_analysis",         // 深度分析
    "casual",                // 口语/网感
    "zhongcao",              // 种草
    "tandian",               // 探店
    "entertaining",          // 娱乐化
    "daily_brief_compact",   // 简报化
    "professional_commentary",  // 评论
  ]),
  targetLengthRatio: z.number().min(0.3).max(2.0).default(1.0),  // 相对于原文长度
  preserveFacts: z.boolean().default(true),      // 事实 100% 保留
  preserveQuotes: z.boolean().default(true),     // 引用保留原话
  targetAudience: z.string().optional(),
  customInstructions: z.string().optional(),
});
```

## Output Schema

```typescript
export const StyleRewriteOutputSchema = z.object({
  rewrittenContent: z.string(),
  transformations: z.array(z.object({            // 改写记录
    type: z.enum([
      "tone_shift", "length_adjust", "vocabulary_swap",
      "structure_reorganize", "quote_preserved", "fact_preserved",
    ]),
    description: z.string(),
    examples: z.array(z.object({
      before: z.string(),
      after: z.string(),
    })).optional(),
  })),
  preservationReport: z.object({
    factsPreserved: z.number(),
    factsDropped: z.number(),
    quotesPreserved: z.number(),
    quotesDropped: z.number(),
    keywordsMatched: z.number(),
  }),
  lengthChange: z.object({
    originalChars: z.number(),
    newChars: z.number(),
    ratio: z.number(),
  }),
  qualityScore: z.object({
    styleMatch: z.number(),
    contentFidelity: z.number(),                 // 事实忠实度
    readability: z.number(),
    overall: z.number(),
  }),
  complianceCheck: z.object({
    passed: z.boolean(),
    flagged: z.array(z.string()),
  }),
});
```

## 9 种目标风格详解

### xinhua（新华体）

**转换原则**：
- 严谨化：去感叹号、疑问句
- 规范化：用"表示""指出""强调"替代"说""讲"
- 客观化：第三人称
- 重引用：官方表述/数据带引号

**示例**：
- before: "深圳这次真的出手了！200 亿砸向 AI！"
- after: "深圳市政府近日表示，将在 2026-2030 年投入 200 亿元支持人工智能产业发展。"

### news_standard（新闻标准）

**转换原则**：
- 倒金字塔结构
- 5W1H 完整
- 客观平衡

### deep_analysis（深度分析）

**转换原则**：
- 补充背景 + 多方观点
- 引用专家分析
- 提出问题 → 剖析 → 展望
- 长度通常 ≥ 1.5 倍原文

### casual（口语/网感）

**转换原则**：
- 增加对话感（"你""我们"）
- 短句化（降长句）
- 加口语词（"然后""其实""说白了"）
- 减书面连词（"然而""综上"）

**示例**：
- before: "深圳市政府发布文件，明确政策方向。"
- after: "深圳昨天官宣了一个大新闻：接下来 5 年，要砸 200 亿搞 AI。"

### zhongcao（种草）

**转换原则**：
- 达人口吻（"姐妹们""宝子们"）
- 钩子开场
- 感官描述 + 情绪词
- 广告法严守

### tandian（探店）

**转换原则**：
- 本地博主口吻
- 现场感 + 个人体验
- 必含价格/地址
- 允许方言

### entertaining（娱乐化）

**转换原则**：
- 梗感 + 网感
- 允许夸张修辞（但不造谣）
- 调侃（在边界内）

### daily_brief_compact（简报化）

**转换原则**：
- 大幅精简（0.3-0.5 倍原长度）
- "要点清单" 结构
- 每点一句话

### professional_commentary（评论）

**转换原则**：
- 明确立场 + 论据
- 引用数据/案例
- 逻辑清晰（提出观点 → 论证 → 反驳 → 结论）

## CoT 工作流程

```
风格改写进度：
- [ ] Step 0: 识别 sourceStyle（如 unknown）+ 加载 targetStyle 规范
- [ ] Step 1: 抽取必须保留的事实和引用
- [ ] Step 2: 分析源文结构（段落/逻辑）
- [ ] Step 3: 重写各段（按 targetStyle）
- [ ] Step 4: 长度调整到 targetLengthRatio
- [ ] Step 5: 事实/引用 preservation 检查
- [ ] Step 6: 合规扫描（按 targetStyle 的场景档位）
- [ ] Step 7: 质量评分
```

## 保真原则

**preserveFacts=true 时**：
- 所有数据、人名、机构名、时间、地点 100% 保留
- 不添加未在源文中出现的事实

**preserveQuotes=true 时**：
- 直接引语（引号内内容）一字不改
- 间接引语可改写但不改变含义

## 典型失败模式

### 失败 1: 事实丢失

**表现**：改写后丢失了原文的关键数字
**修正**：Step 1 明确 must-preserve 清单 + Step 5 校验

### 失败 2: 风格过度

**表现**：把时政稿改成网感版（broken 场景语境）
**修正**：提示 targetStyle 与原内容场景兼容性检查

### 失败 3: 长度失控

**表现**：要求 1.0 比例，实际改成 1.5
**修正**：硬约束 ± 15%

### 失败 4: 虚构引用

**表现**：改写时"合理编造"专家引用
**修正**：只能改写原有引用，不能新增

## 质量自检

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 长度比 | 与目标 ±15% |
| 2 | 事实保留率 | ≥ 95% |
| 3 | 引用保留率 | ≥ 95% |
| 4 | 风格匹配度 | ≥ 75 |
| 5 | 合规 | passed |

## EXTEND.md

```yaml
default_target_style: casual
default_preserve_facts: true
default_preserve_quotes: true

style_compatibility_warnings:
  # 时政→网感 这种高风险组合给 warning
  politics_to_casual: warn
  politics_to_entertaining: block
  drama_to_news: warn
```

## Completion Report

```
✍️ 风格改写完成！

🔄 转换
   • 源风格：{sourceStyle}
   • 目标风格：{targetStyle}
   • 字数变化：{originalChars} → {newChars} (比例 {ratio})

📊 保真
   • 事实保留：{factsPreserved}/{factsPreserved + factsDropped} ({factRate}%)
   • 引用保留：{quotesPreserved}/{totalQuotes}
   • 关键词匹配：{keywordsMatched}

✅ 评分
   • 风格匹配：{styleMatch}/100
   • 内容忠实：{contentFidelity}/100
   • 可读性：{readability}/100
   • 综合：{overall}/100

📝 主要变化
{transformations.map(t => `  • ${t.type}: ${t.description}`).join("\n")}

✅ 合规：{complianceCheck.passed}
```

## Feature Comparison

| Feature | style_rewrite | content_generate | translation |
|---------|---------------|------------------|-------------|
| 保留原文事实 | ✓ | ✗（可能重写） | ✓ |
| 改变语种 | ✗ | ✗ | ✓ |
| 改变结构 | 部分 | ✓ | ✗ |
| 改变风格 | ✓ 核心 | 按 subtemplate | ✗ |

## Prerequisites

- ✅ LLM
- ✅ `sourceContent` ≥ 100 字

## Troubleshooting

| 问题 | 解决 |
|------|------|
| 事实丢失 | Step 1 强制 extract + Step 5 校验 |
| 风格不明显 | 加 few-shot 反例 |
| 超长/过短 | 硬约束长度 |
| 风格不兼容 | 检查 style_compatibility_warnings |

## 上下游协作

- 上游：任何已有文章 / 外部通稿
- 下游：`cms_publish`（多版本分发）/ `headline_generate`（新风格的新标题）

## Changelog

| Version | Date | 变更 |
|---------|------|------|
| 5.0.0 | 2026-04-18 | 重写：9 种目标风格 + 保真机制 + 兼容性警告 |

## 参考实现文件

| 文件 | 路径 |
|------|------|
| Skill Runtime | `src/lib/agent/tools/style-rewrite.ts` |
| 风格词典 | `src/lib/content/style-lexicon/` |
