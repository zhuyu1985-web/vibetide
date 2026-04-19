---
name: style_rewrite
displayName: 风格改写（场景化重写版）
description: 将一篇已有文章改写为另一种风格。支持 9 种目标风格（新华体 / 新闻标准 / 深度 / 网感 / 种草 / 探店 / 娱乐 / 简报 / 评论）。用于一次创作多平台分发、外部通稿适配本台调性、多风格 A/B、改头换面二次创作。保留核心事实与引用，改变表达方式。
version: 5.0.0
category: generation

metadata:
  skill_kind: generation
  scenario_tags: [news, politics, sports, variety, livelihood, drama, daily_brief]
  compatibleEmployees: [xiaowen, xiaofa]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md
---

# 风格改写（style_rewrite）

## 使用条件

✅ **应调用场景**：
- 一篇新闻稿要同时适配 APP 多个栏目（新闻严 / 社交网感）
- 外部通稿改写为本台风格
- 同一主题生成多个风格版本供 A/B 测试
- 把"深度文"浓缩为"简报版"

❌ **不应调用场景**：
- 需要完全重写结构（应调用 `content_generate`）
- 跨语种翻译（走 `translation`）
- 仅调整标题（走 `headline_generate`）

**前置条件**：`sourceContent` ≥ 100 字；LLM 可用；`targetStyle` 与原内容场景兼容（见 §EXTEND.md 的 `style_compatibility_warnings`）。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sourceContent | string (≥100) | ✓ | 原文 |
| sourceStyle | enum | ✗ | 源风格，默认 `unknown`（Step 0 自动识别） |
| targetStyle | enum | ✓ | 9 种目标风格之一（见 §9 种目标风格规范） |
| targetLengthRatio | number (0.3-2.0) | ✗ | 相对原文长度比例，默认 1.0 |
| preserveFacts | boolean | ✗ | 事实 100% 保留，默认 true |
| preserveQuotes | boolean | ✗ | 引语保留原话，默认 true |
| targetAudience | string | ✗ | 目标受众提示 |
| customInstructions | string | ✗ | 自定义改写指令 |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| rewrittenContent | string | 改写后正文 |
| transformations[] | array | 改写记录 `{ type, description, examples[] }` |
| preservationReport | object | `{ factsPreserved, factsDropped, quotesPreserved, quotesDropped, keywordsMatched }` |
| lengthChange | object | `{ originalChars, newChars, ratio }` |
| qualityScore | object | `{ styleMatch, contentFidelity, readability, overall }` |
| complianceCheck | object | `{ passed, flagged[] }` |

完整 Zod Schema 见 [src/lib/agent/execution.ts](../../src/lib/agent/execution.ts) 内 skill IO 定义。

## 9 种目标风格规范

### xinhua（新华体）
- **转换原则**：严谨化（去感叹/疑问）、规范化（"表示""指出""强调"替代"说""讲"）、客观化（第三人称）、重引用（官方表述带引号）
- **示例**：
  - before: "深圳这次真的出手了！200 亿砸向 AI！"
  - after: "深圳市政府近日表示，将在 2026-2030 年投入 200 亿元支持人工智能产业发展。"

### news_standard（新闻标准）
- **转换原则**：倒金字塔结构；5W1H 完整；客观平衡

### deep_analysis（深度分析）
- **转换原则**：补充背景 + 多方观点；引用专家；提出问题 → 剖析 → 展望；长度通常 ≥ 1.5 倍原文

### casual（口语/网感）
- **转换原则**：增加对话感（"你""我们"）；短句化；加口语词（"然后""其实""说白了"）；减书面连词（"然而""综上"）
- **示例**：
  - before: "深圳市政府发布文件，明确政策方向。"
  - after: "深圳昨天官宣了一个大新闻：接下来 5 年，要砸 200 亿搞 AI。"

### zhongcao（种草）
- **转换原则**：达人口吻（"姐妹们""宝子们"）；钩子开场；感官描述 + 情绪词；广告法严守

### tandian（探店）
- **转换原则**：本地博主口吻；现场感 + 个人体验；必含价格/地址；允许方言

### entertaining（娱乐化）
- **转换原则**：梗感 + 网感；允许夸张修辞（但不造谣）；调侃在边界内

### daily_brief_compact（简报化）
- **转换原则**：大幅精简（0.3-0.5 倍原长度）；"要点清单"结构；每点一句话

### professional_commentary（评论）
- **转换原则**：明确立场 + 论据；引用数据/案例；逻辑清晰（观点 → 论证 → 反驳 → 结论）

## 工作流 Checklist

- [ ] Step 0: 识别 sourceStyle（如 unknown）+ 加载 targetStyle 规范
- [ ] Step 1: 抽取 must-preserve 清单（事实 + 引用）
- [ ] Step 2: 分析源文结构（段落 / 逻辑）
- [ ] Step 3: 按 targetStyle 重写各段
- [ ] Step 4: 长度调整到 targetLengthRatio（硬约束 ±15%）
- [ ] Step 5: 事实 / 引用 preservation 校验
- [ ] Step 6: 合规扫描（按 targetStyle 的场景档位）
- [ ] Step 7: 质量评分

## 保真原则

**`preserveFacts=true` 时**：
- 所有数据、人名、机构名、时间、地点 100% 保留
- 不添加未在源文中出现的事实

**`preserveQuotes=true` 时**：
- 直接引语（引号内内容）一字不改
- 间接引语可改写但不改变含义

## 字数 / 长度约束

| 维度 | 硬约束 | 备注 |
|------|-------|------|
| targetLengthRatio | ±15% | 超出即触发重生或硬裁剪 |
| daily_brief_compact | 0.3-0.5 倍 | 强制精简 |
| deep_analysis | ≥ 1.5 倍 | 需补充背景/观点 |
| 其它风格 | 默认 1.0 倍 | 可通过 targetLengthRatio 调整 |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 长度比 | 与目标 ±15% |
| 2 | 事实保留率 | ≥ 95% |
| 3 | 引用保留率 | ≥ 95% |
| 4 | 风格匹配度 | ≥ 75 |
| 5 | 合规 | passed |

**Top-3 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 事实丢失 | 改写后丢失关键数字 / 人名 / 机构 | Step 1 强制抽取 must-preserve 清单 + Step 5 校验 |
| 风格过度 | 时政稿改成网感版，场景错配 | 按 `style_compatibility_warnings` block/warn；targetStyle 与原场景匹配 |
| 虚构引用 | 改写时"合理编造"专家引用或新数据 | 只能改写原有引用；严禁新增未在源文出现的事实 |

## 输出模板 / 示例

```json
{
  "rewrittenContent": "深圳昨天官宣了一个大新闻：接下来 5 年，要砸 200 亿搞 AI……",
  "transformations": [
    { "type": "tone_shift", "description": "严肃→口语；去掉被动句" },
    { "type": "vocabulary_swap", "description": "'发布文件'→'官宣'；'明确政策方向'→'砸 200 亿搞 AI'" }
  ],
  "preservationReport": {
    "factsPreserved": 5, "factsDropped": 0,
    "quotesPreserved": 2, "quotesDropped": 0,
    "keywordsMatched": 7
  },
  "lengthChange": { "originalChars": 420, "newChars": 438, "ratio": 1.04 },
  "qualityScore": { "styleMatch": 82, "contentFidelity": 98, "readability": 88, "overall": 89 },
  "complianceCheck": { "passed": true, "flagged": [] }
}
```

## EXTEND.md 示例

```yaml
default_target_style: casual
default_preserve_facts: true
default_preserve_quotes: true
length_tolerance: 0.15         # 长度比容差 ±15%

style_compatibility_warnings:
  politics_to_casual: warn     # 时政→网感 给 warning
  politics_to_entertaining: block
  drama_to_news: warn
```

## 上下游协作

- **上游**：任何已有文章 / 外部通稿 / `content_generate` 产出
- **下游**：`cms_publish`（多版本分发）/ `headline_generate`（新风格的新标题）/ `summary_generate`（新风格对应新摘要）

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)（通用 agent 执行入口；skill 逻辑通过 prompt 驱动）
- 参考 Spec：[docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md](../../docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md)
- 历史版本：`git log --follow skills/style_rewrite/SKILL.md`
