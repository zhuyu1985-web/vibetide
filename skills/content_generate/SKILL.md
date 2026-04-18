---
name: content_generate
displayName: 内容生成（场景化重写版）
description: 生成高质量文章/稿件内容的核心 skill。按 APP 栏目 9 大场景（新闻/时政/体育/综艺/民生种草/民生探店/民生播客/短剧/每日专题）分化子模板，每场景有独立人设、风格规范、质量阈值。替代现有简单版 content_generate。当员工需要产出正式文章（图文稿、深度报道、评论、解读等）时调用。
version: 5.0.0
category: generation
metadata:
  # ★ tags 为 skill 元信息检索标签（自由文本），不是 scenario enum
  # 详见主文档 §2.0 规范化术语表
  tags: [news, politics, sports, variety, livelihood, daily_brief, deep_analysis]
  compatibleEmployees: [xiaowen, xiaoce, xiaotan]
  runtime:
    type: llm_generation
    avgLatencyMs: 20000
    maxConcurrency: 3
    modelDependency: anthropic:claude-opus-4-7
  requires:
    knowledgeBases:
      - 新闻行业知识库（必选）
      - 频道风格指南（推荐）
      - 敏感话题处理手册（必选）
  subtemplates:
    - news_standard
    - politics_shenzhen
    - sports_chuanchao
    - variety_highlight
    - livelihood_zhongcao
    - livelihood_tandian
    - livelihood_podcast
    - drama_serial
    - daily_brief
---

# 内容生成（content_generate）

## Language

输出**简体中文**；每个子模板按对应场景的语言规范。

## When to Use

✅ **应调用场景**：
- 需要产出完整文章、稿件、深度报道的所有场景
- 已确定目标栏目（可映射到 9 个子模板之一）
- 素材充足（热点 + 背景资料 + 观点）

❌ **不应调用场景**：
- 纯视频脚本（走 `script_generate` 或场景特定的 `*_script`）
- 标题/摘要单独生成（走 `headline_generate` / `summary_generate`）
- 风格改写（走 `style_rewrite`）
- 分集短剧剧本（走 `duanju_script`）

## Input Schema

```typescript
export const ContentGenerateInputSchema = z.object({
  topic: z.string(),                               // 内容主题
  // ★ scenario 必填，严格使用主文档 §2.0.2 的 9 个枚举值
  scenario: z.enum([
    "home_digest",
    "news_standard",
    "politics_shenzhen",
    "sports_chuanchao",
    "variety_highlight",
    "livelihood_zhongcao",
    "livelihood_tandian",
    "livelihood_podcast",
    "drama_serial",
  ]),
  // subtemplate 为 content_generate 内部维度（9 个，同名 8 场景 + daily_brief）
  subtemplate: z.enum([
    "news_standard",
    "politics_shenzhen",
    "sports_chuanchao",
    "variety_highlight",
    "livelihood_zhongcao",
    "livelihood_tandian",
    "livelihood_podcast",
    "drama_serial",
    "daily_brief",
  ]),
  outline: z.string().optional(),                  // 大纲（可选）
  references: z.array(z.object({                   // 参考素材
    type: z.enum(["article", "data", "quote", "interview", "fact"]),
    content: z.string(),
    source: z.string().optional(),
  })).optional(),
  targetWordCount: z.number().int().min(100).max(5000).default(1500),
  style: z.enum([
    "formal",          // 正式（新闻体）
    "xinhua",          // 新华体（时政首选）
    "deep_analysis",   // 深度分析
    "casual",          // 口语化
    "personal",        // 个人体验型
    "entertaining",    // 娱乐化
  ]).default("formal"),
  keywords: z.array(z.string()).optional(),        // SEO 关键词
  targetCatalog: z.string().optional(),            // CMS 目标栏目 slug
  customInstructions: z.string().optional(),       // 额外指令
});
```

## Output Schema

```typescript
export const ContentGenerateOutputSchema = z.object({
  meta: z.object({
    contentId: z.string().uuid(),
    subtemplate: z.string(),
    style: z.string(),
    wordCount: z.number(),
    estimatedReadTimeSec: z.number(),
  }),
  title: z.string(),
  subtitle: z.string().optional(),
  summary: z.string(),                              // 用于 CMS summary 字段
  leadParagraph: z.string(),                        // 导语
  bodyHtml: z.string(),                             // HTML 格式正文
  bodyMarkdown: z.string(),                         // Markdown 备份
  sections: z.array(z.object({
    heading: z.string(),
    body: z.string(),
  })),
  keywordsExtracted: z.array(z.string()),
  tagsSuggested: z.array(z.string()),
  coverImagePrompt: z.string().optional(),
  factsUsed: z.array(z.object({
    fact: z.string(),
    source: z.string().optional(),
    verified: z.boolean(),
  })),
  qualityScore: z.object({
    overall: z.number().min(0).max(100),
    dimensions: z.object({
      fluency: z.number(),
      accuracy: z.number(),
      relevance: z.number(),
      style_match: z.number(),
      compliance: z.number(),
    }),
  }),
  complianceCheck: z.object({
    passed: z.boolean(),
    reviewTier: z.enum(["strict", "relaxed"]),
    flaggedIssues: z.array(z.object({
      paragraph: z.number(),
      issue: z.string(),
      suggestion: z.string(),
    })),
  }),
});
```

## Pre-flight Check

- `subtemplate` 有效且已加载对应风格指南
- `references` 若有必须能解析（防 prompt injection）
- 时政类必须绑定"敏感话题处理手册" KB

## Workflow Checklist

```
内容生成进度：
- [ ] Step 0: 加载子模板风格指南
- [ ] Step 1: 理解主题 + 素材整合
- [ ] Step 2: 按子模板生成大纲
- [ ] Step 3: 逐段撰写正文
- [ ] Step 4: 生成标题 + 副标题 + 导语
- [ ] Step 5: 生成摘要 + 关键词 + 标签
- [ ] Step 6: 质量自检（按子模板阈值）
- [ ] Step 7: 合规扫描（按 review tier）
- [ ] Step 8: 转换为 HTML 适配 CMS
```

## 9 个子模板详细规范

### 子模板 1: news_standard（新闻标准图文）

**适用**：APP 新闻栏目常规稿

**身份锚定**：
> 你是有 10 年经验的新华社驻站记者，习惯"事实先行 + 关键引用 + 专业剖析"的新闻写作。

**风格规范**：
- 句式：客观第三人称；主谓宾清晰；避免"你""我"
- 体裁：消息体 / 通讯体 / 述评
- 结构：**导语（倒金字塔）→ 主体（5W1H）→ 引述 → 背景 → 观察**
- 字数：800-2000

**允许词汇**：
- 宣布、表示、指出、强调、回应、披露、披露
- "相关人士""官方通报""据悉"
- "分析认为""专家指出"

**禁用词**：
- 情绪化（XX 令人愤怒）
- 主观判断（"错得离谱""愚蠢"）
- 广告化（"绝对""最好"）

**质量阈值**：
- 事实核查通过率 100%
- 引述数 ≥ 2（官方来源）
- 5W1H 覆盖率 ≥ 90%
- 导语 ≤ 100 字

**正例（片段）**：
```markdown
## 深圳发布 AI 产业新政策 设立 200 亿专项基金

4 月 17 日，深圳市政府发布《关于促进人工智能产业高质量发展的若干措施》，明确在未来五年内设立 200 亿元专项基金，支持 AI 产业基础设施建设和核心技术研发。

据深圳市发改委相关负责人介绍，本次政策重点涵盖三个方面：一是建设三个国家级 AI 产业园区；二是对符合条件的 AI 企业给予最高 5000 万元补贴；三是引进 100 名海内外顶尖 AI 人才。

"这将有效激活深圳 AI 产业生态。" 深圳 AI 产业协会会长王某某在新闻发布会上表示……

## 背景
深圳 AI 产业产值已连续三年保持 30% 以上年增长，目前已聚集超过 3000 家 AI 相关企业……

## 观察
分析人士指出，本次政策的力度是近年来最大的一次……
```

---

### 子模板 2: politics_shenzhen（深圳时政深度解读）

**适用**：APP 时政栏目 / 两会报道 / 政策解读

**身份锚定**：
> 你是党政机关文稿写作专家 + 时政观察员，深度熟悉深圳市委市政府工作文件、两会报告、政策文件的表述规范。

**风格规范**：
- 体裁：**新华体**（规范、严谨、权威）
- 结构：**引用原文 → 政策要点 → 深度解读 → 意义影响**
- 禁止私自评论/表态

**必须引用**：
- 官方文件/会议名称准确（"深圳市第 X 届人民代表大会第 X 次会议"）
- 政策表述原词原句（引号包住）
- 领导讲话必引用可查来源
- 数据必有出处

**允许词汇**：
- 贯彻落实、全面推进、扎实开展、高质量发展、高水平开放
- "坚持以……为指导""深入学习贯彻……精神"
- "重要意义""重大意义""重大成效"

**严格禁忌**：
- 擅自评价政策（"这很好""力度不够"）
- 领导人称谓错（必须准确到全名或规范简称）
- 政治敏感话题私自延伸
- 把"会议"写成"开会"
- 把"召开"写成"举行"的随意替换

**质量阈值**：
- 官方表述准确度 100%
- 引用数 ≥ 3
- 字数 1500-3500
- 审核档位：**严**

**正例（片段）**：
```markdown
## 深圳部署 2026 年国民经济和社会发展计划

4 月 17 日，深圳市第 X 届人民代表大会常务委员会第 XX 次会议审议通过了《深圳市 2026 年国民经济和社会发展计划》。

根据计划，深圳将"坚持创新驱动发展战略，深入推进粤港澳大湾区建设，高质量构建现代化产业体系"。

计划明确提出五大重点任务：

**一是加快构建现代化产业体系**。重点发展人工智能、生物医药、新能源等战略性新兴产业……

**二是深入推进粤港澳大湾区建设**。进一步扩大与港澳的规则衔接，推动前海、河套等重大平台建设……

（依次列出五大任务原文）

## 解读

市政府相关负责人在新闻发布会上表示，本次计划的制定"充分体现了新发展理念"。

深圳市委党校副教授李某某认为，本次计划"在高质量发展方面体现了更加精细化的路径设计"……
```

---

### 子模板 3: sports_chuanchao（川超赛事战报）

**适用**：APP 体育栏目 / 川超联赛

**身份锚定**：
> 你是 15 年四川体育记者 + 川超联赛从头跟到现在的专属解说，对成都蓉城、四川 FC 等球队队员、战术、历史如数家珍。

**风格规范**：
- 体裁：**赛前预告 / 赛后战报 / 球星特写 / 深度复盘**
- 结构：
  - 预告：双方状态 → 历史交手 → 关键看点 → 预测
  - 战报：比分开头 → 上半场 → 下半场 → 关键时刻 → 数据
- 语言：**专业 + 情绪** 兼顾（不死板）

**必备元素**：
- 比分（精确到节奏）
- 关键球员（带数据：进球/助攻/传球成功率）
- 战术点评（高位逼抢 / 边路传中 / 定位球）
- 现场氛围（球迷人数 / 关键瞬间）

**允许词汇**：
- 传控、反击、高位逼抢、边路突破、定位球、绝杀、补时
- "XX 号球衣""XX 前锋""国脚级"
- 情绪词：扳回、力克、险胜、完败、逆转

**禁忌**：
- 地域攻击（"四川队就是菜"）
- 球员人身攻击
- 比分/球员名错误（核实后再写）
- 裁判判罚主观定性（"黑哨"）

**质量阈值**：
- 比分/球员名准确 100%
- 数据引用 ≥ 5 条
- 字数 500-1500（战报）/ 1500-2500（深度复盘）
- 审核档位：**松**

**正例（片段）**：
```markdown
## 川超第 7 轮｜成都蓉城 2-1 绝杀四川 FC，冯潇霆第 89 分钟头球建功

今晚凤凰山体育场，3.8 万球迷见证了一场荡气回肠的德比大战。成都蓉城在第 89 分钟由老将冯潇霆头球破门，以 2-1 的比分逆转击败四川 FC。

## 上半场

开场 8 分钟，四川 FC 就凭借外援罗德里戈的一记远射率先破门。蓉城在随后的 30 分钟里始终未能打破僵局。上半场 0-1 落后。

## 下半场

换帅之后，主帅徐正源做出大胆调整：61 分钟用韦世豪换下艾克森，加强进攻强度。韦世豪登场仅 7 分钟便打入关键扳平球。

## 绝杀

第 89 分钟，蓉城获得前场任意球机会。冯潇霆高高跃起，头球破门！凤凰山瞬间爆发！

## 数据

| 项 | 蓉城 | 四川 FC |
|----|------|--------|
| 控球率 | 58% | 42% |
| 射门 | 16 | 11 |
| 射正 | 7 | 4 |
| 角球 | 8 | 5 |

## 下轮预告

下周末，蓉城将客场挑战大连人，四川 FC 主场迎战山东泰山。
```

---

### 子模板 4: variety_highlight（综艺盘点图文）

**适用**：APP 综艺栏目盘点

**职能**：复用 `zongyi_highlight` skill 生成的 article 部分。本子模板作为"前端入口"，内部可直接委托 `zongyi_highlight`。

**质量阈值**：
- 艺人名 100% 核查
- 审核档位：松

---

### 子模板 5-7: livelihood_* （民生 3 子场景）

**分别对应**：种草图文 / 探店攻略图文 / 播客口播稿（文本）

**职能**：
- livelihood_zhongcao → 种草图文稿（配合 `zhongcao_script` 的 video）
- livelihood_tandian → 探店攻略图文（配合 `tandian_script` 的 video）
- livelihood_podcast → 播客文字稿（配合 `podcast_script` 的 audio）

**委托关系**：
图文版本由 content_generate 生成，视频/音频脚本由对应的 `*_script` skill 生成。两者配套发布。

**子模板 livelihood_zhongcao 独立要点**：
- 小红书/抖音风格图文
- 字数 300-800
- 可读性 > 严谨性
- 广告法严扫
- 审核档位：松

**子模板 livelihood_tandian 独立要点**：
- 攻略感 + 地图感
- 地址/人均必含
- 字数 500-1500
- 审核档位：松

**子模板 livelihood_podcast 独立要点**：
- 文字稿是"看得见的听觉内容"
- 可读性 + 口语化
- 字数跟随 podcast_script 的 total words
- 审核档位：严

---

### 子模板 8: drama_serial（短剧剧本文字稿）

**适用**：作为短剧文字稿档案（type=1 入库供编辑查阅）。实际剧本生成由 `duanju_script` 负责，本子模板作为"格式规范 + 入库适配"。

**委托**：调用 `duanju_script` 生成剧本；本子模板做 CMS 适配（正文结构化、标签、元信息）。

**审核档位**：严。

---

### 子模板 9: daily_brief（每日简报图文）

**适用**：daily_content_plans 中的每日 AI 资讯 / 每日时政 / 每日娱乐等简报

**身份锚定**：
> 你是"每天给用户泡一杯信息咖啡"的编辑，要在 1000 字内覆盖当日 3-5 条热点，每条重点清晰、有观点但不冗长。

**风格规范**：
- 结构：**开篇一句话 → 3-5 条热点（每条 100-200 字） → 一句话结语**
- 每条热点格式：标题 + 背景 + 影响/观点
- 总字数 600-1500

**正例（片段）**：
```markdown
## 4 月 17 日科技早资讯｜AI 大模型加速落地本地政务

今天 3 个值得关注的事。

### 1. 深圳发布 AI 产业政策，200 亿基金在路上

昨日，深圳官方公布了《AI 产业若干措施》，未来 5 年投入 200 亿。**这对深圳 AI 企业是明确利好**，但也对监管和配套提出了更高要求。

### 2. GPT-6 开放申请，国内 API 尚无消息

OpenAI 宣布 GPT-6 开放内部测试，但国内 API 尚未放开。**对国内开发者意味着**：短期仍需借助国产大模型生态。

### 3. 国产大模型"XX"推出多模态版本

国产大模型"XX"发布 8B 参数的多模态版本，主打本地化部署。**这是一个信号**：国产大模型开始真正走向"企业私有化"场景。

---

今天的内容就这些。我们明天见。
```

---

## 合规扫描（按子模板档位）

```typescript
const reviewTier = getTierForSubtemplate(input.subtemplate);
// news_standard, politics_shenzhen, livelihood_podcast, drama_serial → 严
// sports_chuanchao, variety_highlight, livelihood_zhongcao, livelihood_tandian, daily_brief → 松

const flagged = await scanByTier(draft, {
  tier: reviewTier,
  scenario: input.scenario,              // 规范化 scenario（§2.0.2 枚举）
  subtemplate: input.subtemplate,        // 子模板维度，规则引擎可单独匹配
  catalog: input.targetCatalog,
});
```

## 质量自检清单（全子模板通用 + 子模板扩展）

### 通用（全场景）

| # | 检查点 | 阈值 |
|---|-------|-----|
| G1 | 字数与目标匹配 | ±15% |
| G2 | 标题吸引力 | 含数字/金句/反差/疑问一种 |
| G3 | 导语抓手 | ≤ 100 字（新闻/时政）/ ≤ 50 字（民生） |
| G4 | 段落长度 | 平均 100-200 字 |
| G5 | 关键词覆盖 | 输入 keywords 覆盖率 ≥ 80% |
| G6 | 事实核查 | references 使用率 ≥ 80% |
| G7 | 合规扫描 | 按 tier 通过 |

### 子模板扩展

- 时政：引用数 ≥ 3 / 官方表述准确 100%
- 体育：比分/球员名准确 100%
- 综艺：艺人名 KB 验证 100%
- 民生：地址/价格真实性 100%

## Few-shot 正例 × N

每个子模板正例已在对应章节展示（见上文）。

## 典型失败模式

### 失败 1: 子模板混淆

**表现**：时政稿写成了新闻稿（少官方表述）
**修正**：强制按 subtemplate 加载对应 system prompt

### 失败 2: 字数失控

**表现**：目标 1500 写了 3000 或 500
**修正**：Step 3 分段控制；末段调整

### 失败 3: 事实编造

**表现**：没 references 时模型"合理编造"数据
**修正**：无 references 时不输出数字具体数值，只输出"显著增长"等定性描述

### 失败 4: 风格漂移

**表现**：新闻体里混入网络用语
**修正**：Step 0 加载风格指南锁定

## EXTEND.md 用户配置

```yaml
# .vibetide-skills/content_generate/EXTEND.md

default_subtemplate: news_standard
default_style: formal
default_word_count: 1500

# 子模板差异化配置
subtemplate_configs:
  politics_shenzhen:
    strictness: maximum
    kb_bind: [政策文件库, 领导讲话库]
    require_official_quote: true
    quote_count_min: 3

  sports_chuanchao:
    require_stats_table: true
    tone: balanced         # 不过度情绪化

  daily_brief:
    max_items: 5
    one_line_takeaway_per_item: true

# 品牌配置
organization_brand:
  name: "深圳广电智媒"
  tagline: "更快、更新、更本地"
  default_author: "智媒编辑部"

# 合规
strict_catalogs: [app_politics, app_drama, app_livelihood_podcast]
```

## Feature Comparison（vs 现有简单版）

| Feature | content_generate v5.0（场景化） | content_generate v4.0（通用版） |
|---------|--------------------------------|-------------------------------|
| 子模板数 | 9 | 0 |
| 身份锚定 | 每场景独立 | 单一通用 |
| Few-shot | 每场景 2+ | 1 |
| 合规扫描 | 按场景档位 | 通用扫描 |
| 质量阈值 | 按场景差异化 | 通用 |
| 字数范围 | 100-5000 | 500-3000 |
| 格式输出 | HTML + Markdown + 结构化 | Markdown |
| KB 绑定 | 按子模板推荐 | 手动 |
| CMS 适配 | 原生 | 后处理 |

## Prerequisites

- ✅ LLM（claude-opus-4-7 强推荐）
- ✅ 对应子模板的 KB 已绑定
- ✅ `topic` 明确
- ✅ `subtemplate` 合法值

## Troubleshooting

| 问题 | 原因 | 解决 |
|------|------|------|
| 子模板风格不生效 | system prompt 未加载指南 | Step 0 强制加载 |
| 时政稿私自评论 | strictness 未到 maximum | EXTEND 调整 |
| 体育比分错 | references 缺失 | 必须传入比赛官方数据 |
| 艺人名错 | 未校验 | 综艺场景必须 KB 校验 |
| 字数失控 | 分段 token 预算不当 | 按段落字数比例预算 |
| 广告法词频繁命中 | 种草场景未加过滤 | 加载扫描器 |

## Completion Report

```
📝 内容生成完成！

📑 元信息
   • 子模板：{subtemplate}
   • 风格：{style}
   • 字数：{wordCount} / 目标 {targetWordCount}
   • 预估阅读：{estimatedReadTimeSec}s

📰 内容
   • 标题：{title}
   • 副标题：{subtitle ?? "—"}
   • 章节数：{sections.length}
   • 使用 references：{factsUsed.length}/{referencesInput.length}

✅ 质量评分
   • 综合：{qualityScore.overall}/100
   • 流畅：{fluency}
   • 准确：{accuracy}
   • 相关：{relevance}
   • 风格匹配：{style_match}
   • 合规：{compliance}

📌 建议标签：{tagsSuggested.join("、")}
📌 建议关键词：{keywordsExtracted.join("、")}

✅ 合规
   • 审核档位：{reviewTier}
   • 扫描：{complianceCheck.passed ? "通过" : `⚠️ ${flaggedIssues.length} 处`}

📝 下一步
   → `cms_publish` 入 CMS（对应栏目）
   → 或 `style_rewrite` 切换风格生成多版本
   → 或 `summary_generate` 单独生成摘要
```

## 上下游协作

### 上游
- 选题策划（xiaoce）/ 热点分析（xiaolei）提供 topic + references
- 素材研究（xiaozi）提供参考素材
- 每日专题触发

### 下游
- `cms_publish`：入 CMS（type=1）
- `headline_generate`：独立生成替代标题
- `summary_generate`：生成摘要
- `style_rewrite`：多风格改写
- `quality_review`（按档位）：审核

## Changelog

| Version | Date | 变更 |
|---------|------|------|
| 5.0.0 | 2026-04-18 | 重写：9 场景子模板，每场景独立身份/风格/合规/质量阈值 |
| 4.0.0 | 2026-03 | 通用版（旧） |

## 参考实现文件

| 文件 | 路径 |
|------|------|
| Skill Runtime | `src/lib/agent/tools/content-generate.ts` |
| 子模板注册 | `src/lib/agent/subtemplates/content/` |
| 风格指南加载器 | `src/lib/agent/style-guide-loader.ts` |
| KB | `knowledge-bases/news-standards/`, `knowledge-bases/official-terminology/` |
