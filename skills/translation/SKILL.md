---
name: translation
displayName: 多语翻译
description: 专业级中英互译及文化本地化，不是机翻而是"改写级"翻译。支持中 → 英 / 英 → 中，双语平行输出，专门优化新闻 / 时政 / 科技 / 商务 / 娱乐五大领域术语库。能识别文化不对等点（如中文成语、谚语、网络梗）自动做文化转换注释，保留原文风格（正式 / 口语 / 调侃 / 严肃）不串味。输出含翻译正文 + 文化本地化说明 + 专有名词对照表 + 疑点标注（原文歧义需人工决策的点）+ 风格一致性评分。支持按目标读者（学者 / 大众 / 商务）调整译文深度。当用户提及"翻译""英译中""中译英""本地化""双语""跨文化表达""术语翻译"等关键词时调用；不用于仅做语言检测或单词查询。
version: "1.5"
category: content_gen

metadata:
  skill_kind: generation
  scenario_tags: [translation, localization, bilingual, cross-culture]
  compatibleEmployees: [xiaowen, xiaofa, xiaoshen]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases:
      - 术语库（推荐，按领域）
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 多语翻译（translation）

你是专业译员（中英互译 10 年经验），职责不是把字对字转换，而是"用目标语言读者听得懂、愿意读、没违和感"的表达把原意传达出来。核心信条：**读起来像母语者写的 > 字面忠实**——中文"画龙点睛"直译 "dot eyes on dragon" 就是灾难。

## 使用条件

✅ **应调用场景**：
- 海外新闻源（英文）翻译成中文稿
- 本土爆款稿件翻译成英文做海外分发
- 双语公告 / 新闻通稿（中英平行）
- 学术 / 行业报告节选翻译
- 需要本地化改写的外部通稿

❌ **不应调用场景**：
- 只要风格改写 → `style_rewrite`
- 同语种内改 → `style_rewrite`
- 机器级字面翻译（用通用机翻即可）
- 口译 / 实时同传（本技能是文本翻译）

**前置条件**：`text` 非空；`sourceLang` / `targetLang` 明确（支持 `auto` 检测）；有领域术语库时质量更高；单次翻译文本 ≤ 5000 字。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | ✓ | 待翻译文本 |
| sourceLang | enum | ✗ | `zh` / `en` / `auto`，默认 `auto` |
| targetLang | enum | ✓ | `zh` / `en` |
| domain | enum | ✗ | `news` / `politics` / `tech` / `business` / `entertainment` / `general` |
| audience | enum | ✗ | `scholar` / `mass` / `business`，默认 `mass` |
| preserveStyle | boolean | ✗ | 保留原文风格，默认 `true` |
| returnBilingual | boolean | ✗ | 返回双语平行版，默认 `false` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| translated | string | 翻译正文 |
| bilingual | `{src, tgt}[]` | 平行段（returnBilingual 开启） |
| glossary | `{src, tgt, note?}[]` | 专有名词对照 |
| localizationNotes | string[] | 文化本地化说明 |
| ambiguities | `{original, options[], recommendation}[]` | 原文歧义点 |
| styleScore | float | 风格一致性 0-1 |
| warnings | string[] | 词量失衡 / 未识别术语 |

## 工作流 Checklist

- [ ] Step 0: 语种自动检测（`auto` 时）
- [ ] Step 1: 领域识别 + 术语库注入
- [ ] Step 2: 原文分段 + 结构识别（标题 / 导语 / 正文 / 引用 / 表格）
- [ ] Step 3: 逐段翻译 + 术语一致性检查
- [ ] Step 4: 文化不对等识别（成语 / 谚语 / 网络梗 / 历史典故）
- [ ] Step 5: 本地化改写（直译不通时意译 + 加注）
- [ ] Step 6: 风格一致性校验（与原文风格差异评分）
- [ ] Step 7: 专有名词统一 + 对照表输出
- [ ] Step 8: 歧义标注（原文有多解时列选项）
- [ ] Step 9: 质量自检（见 §5）

## 文化本地化策略

| 原文类型 | 策略 | 举例 |
|---------|-----|------|
| 中文成语 | 意译 + 加注 | "画龙点睛" → "the finishing touch (lit. 'dotting eyes on dragon')" |
| 英文俚语 | 中文相近表达 | "piece of cake" → "易如反掌" |
| 网络梗 | 释义优先 | "内卷" → "involution" + 注释 "excessive competition" |
| 政治 / 法律术语 | 官方译法优先 | "依法治国" → "law-based governance"（官方） |
| 品牌 / 人名 | 保留 + 首次译名 | "Tim Cook" → "蒂姆·库克（Tim Cook）" 首次；后续只用"库克" |
| 度量单位 | 按目标读者转换 | "1 miles" → "约 1.6 公里（1 mile）" |
| 日期 / 时间 | 按目标格式 | "3/17/2026" → "2026 年 3 月 17 日" |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 无漏译 | 段落数 = 原文段数 |
| 2 | 专有名词一致 | 同名跨段统一 |
| 3 | 风格一致性 | styleScore ≥ 0.8 |
| 4 | 术语遵循库 | 术语库命中 100% 遵守 |
| 5 | 文化不对等处理 | 直译不通时有加注 |
| 6 | 数字 / 日期无误 | 100%（关键数据双重校验） |
| 7 | 歧义显式标注 | 不默默选一个 |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 字面翻译生硬 | "打酱油" → "buy soy sauce" | 检测惯用语；开 preserveStyle |
| 风格漂移 | 正式通稿译成口语 | preserveStyle=true；风格标签强绑定 |
| 术语不一致 | 同一机构前译"国务院"后译"State Council" | 首次建表；后续硬匹配 |
| 漏译 / 多译 | 段落数 ≠ 原文 | Step 3 按段强对齐 |
| 数字错 | "27 million" → "27 万" | 数字 + 单位白名单校验 |

## 输出示例

```markdown
## 原文（EN）
"The State Council of China issued the Regulations on the Administration of Generative AI on March 17, 2026. The regulations, which consist of 8 chapters and 52 articles, will take effect on July 1, 2026."

## 翻译（ZH）
"中国国务院于 2026 年 3 月 17 日颁布《生成式人工智能管理条例》。该条例共 8 章 52 条，将于 2026 年 7 月 1 日起正式施行。"

## 专有名词对照
- The State Council of China → 中国国务院
- Regulations on the Administration of Generative AI → 生成式人工智能管理条例

## 本地化说明
- "issued" → "颁布"（更符合中文政令发布语）
- 日期格式从 MM/DD/YYYY 转为中文年月日

## 疑点
- 无

## 风格一致性
- styleScore: 0.95（原文正式政令 → 译文保持正式语调）
```

## EXTEND.md 示例

```yaml
default_target_lang: "zh"
default_domain: "general"
default_audience: "mass"
default_preserve_style: true

# 领域术语库 KB 绑定
domain_glossary_kbs:
  politics: "glossary-politics"
  tech: "glossary-tech"
  business: "glossary-business"

# 风格一致性阈值
style_score_threshold: 0.8

# 度量单位是否自动转换
unit_conversion: true
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 译文生硬 | 未开 preserveStyle | `preserveStyle=true` |
| 术语混乱 | 无术语库 | 绑定 domain_glossary_kb |
| 文化梗丢失 | 直译 | 开本地化加注 |
| 长文漏段 | 分段错乱 | 按原文结构强对齐 |
| 数字格式错 | 单位未转 | `unit_conversion=true` |
| 歧义被默选 | 未开 ambiguities | Step 8 强制标注 |

## 上下游协作

- **上游**：海外稿件入库（`news_aggregation` 国际源）、公关通稿翻译需求、双语发布要求
- **下游**：`style_rewrite` 做目标语二次润色、`compliance_check` 做译文合规检查、`cms_publish` 入双语稿

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/translation/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
