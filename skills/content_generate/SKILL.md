---
name: content_generate
displayName: 内容生成（场景化重写版）
description: 生成高质量文章 / 稿件 / 深度报道 / 评论 / 解读的核心写作能力。按 APP 栏目 9 大场景（新闻 / 时政 / 体育 / 综艺 / 种草 / 探店 / 播客 / 短剧 / 每日专题）分化子模板，每个场景有独立人设（主笔设定 + 行业背景 + 写作信条）、风格规范（tone / 人称 / 句式 / 用词禁区）、字数结构（章节 / 段落 / 小标题范式）、合规档位（政治 / 商业 / 法律红线）、质量阈值（事实密度 / 观点占比 / 可读性）。产出含正文、副标题、导语、主体分段、关键数据点、引语、结语、栏目标签、SEO keywords、配图提示词。支持指定原素材（`materials`）+ 目标字数 + 目标受众 + 情感基调四维入参。当用户提及"写一篇""生成文章""出稿""深度报道""评论""解读""长文""图文稿"等关键词时调用；不用于标题 / 摘要单独生成或风格改写。
version: 5.0.0
category: content_gen

metadata:
  skill_kind: generation
  scenario_tags: [news, politics, sports, variety, livelihood, drama, daily_brief]
  compatibleEmployees: [xiaowen, xiaoce, xiaotan]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/tools/content-generate.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md
---

# 内容生成（content_generate）

## 使用条件

**应调用场景**：
- 需要产出完整文章、稿件、深度报道（图文稿、评论、解读）
- 已确定目标栏目（可映射到 9 个子模板之一）
- 素材充足（热点 + 背景资料 + 观点）

**不应调用场景**：
- 纯视频脚本（走 `script_generate` 或场景专用 `*_script`）
- 标题 / 摘要单独生成（走 `headline_generate` / `summary_generate`）
- 风格改写（走 `style_rewrite`）
- 分集短剧剧本（走 `duanju_script`）

**前置条件**：`topic` 明确；`subtemplate` 为 9 个合法值之一；对应风格 KB 可加载；时政类必须绑定"敏感话题处理手册"。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| topic | string | ✓ | 内容主题 |
| scenario | enum | ✓ | 9 个规范化 scenario 之一（见主文档 §2.0.2） |
| subtemplate | enum | ✓ | 9 个子模板之一（见 §9 场景规范） |
| outline | string | ✗ | 大纲 |
| references | array | ✗ | 参考素材 `{type, content, source?}`，type ∈ `article/data/quote/interview/fact` |
| targetWordCount | int (100-5000) | ✗ | 默认 1500 |
| style | enum | ✗ | `formal/xinhua/deep_analysis/casual/personal/entertaining`，默认 `formal` |
| keywords | string[] | ✗ | SEO 关键词 |
| targetCatalog | string | ✗ | CMS 目标栏目 slug |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| meta | object | `{contentId, subtemplate, style, wordCount, estimatedReadTimeSec}` |
| title / subtitle / summary / leadParagraph | string | 标题 / 副标题 / CMS summary / 导语 |
| bodyHtml / bodyMarkdown | string | HTML（CMS 入库）+ Markdown 备份 |
| sections[] | array | `{heading, body}` |
| keywordsExtracted / tagsSuggested | string[] | 提取关键词 + 建议标签 |
| factsUsed[] | array | `{fact, source?, verified}` |
| qualityScore | object | `overall + {fluency, accuracy, relevance, style_match, compliance}` 0-100 |
| complianceCheck | object | `{passed, reviewTier ∈ strict/relaxed, flaggedIssues[]}` |

完整 Zod Schema 见 [src/lib/agent/tools/content-generate.ts](../../src/lib/agent/tools/content-generate.ts)。

## 9 场景内容风格规范

### news_standard（新闻标准图文）
- **身份**：10 年经验新华社驻站记者，事实先行 + 关键引用 + 专业剖析
- **结构**：导语（倒金字塔）→ 主体（5W1H）→ 引述 → 背景 → 观察
- **允许词**：宣布 / 表示 / 指出 / 强调 / 据悉 / 分析认为 / 专家指出
- **禁忌**：情绪化、主观判断（"错得离谱"）、广告化（"绝对""最好"）
- **阈值**：事实核查 100%；官方引述 ≥ 2；5W1H 覆盖 ≥ 90%；导语 ≤ 100 字；审核档位：严

### politics_shenzhen（深圳时政深度解读）
- **身份**：党政机关文稿专家 + 时政观察员，熟悉深圳市委市政府文件规范
- **结构**：新华体；引用原文 → 政策要点 → 深度解读 → 意义影响
- **必须引用**：会议全称（"深圳市第 X 届人代会第 X 次会议"）、政策原词（引号包住）、领导讲话带可查来源、数据必有出处
- **严格禁忌**：擅自评价政策（"力度不够"）/ 领导称谓错 / 政治敏感私自延伸 / "会议"写成"开会"
- **阈值**：官方表述准确 100%；引用数 ≥ 3；1500-3500 字；审核档位：**严**

### sports_chuanchao（川超赛事战报）
- **身份**：15 年四川体育记者 + 川超专属解说，熟悉成都蓉城 / 四川 FC 队员战术
- **结构**：预告（双方状态 → 交手 → 看点 → 预测）/ 战报（比分开头 → 上半场 → 下半场 → 关键时刻 → 数据）
- **必备**：比分（精确节奏）、关键球员（进球 / 助攻 / 传球成功率）、战术点评、现场氛围
- **允许词**：传控 / 反击 / 高位逼抢 / 绝杀 / 补时 / 扳回 / 力克 / 险胜 / 完败 / 逆转
- **禁忌**：地域攻击、球员人身攻击、比分 / 球员名错、裁判黑哨定性
- **阈值**：比分 / 球员名准确 100%；数据引用 ≥ 5；战报 500-1500 / 复盘 1500-2500；审核档位：松

### variety_highlight（综艺盘点图文）
- **委托**：复用 `zongyi_highlight` 的 article 部分
- **阈值**：艺人名 KB 核查 100%；审核档位：松

### livelihood_zhongcao（种草图文）
- **风格**：小红书 / 抖音体；钩子 + 痛点 + CTA；可读性 > 严谨性
- **阈值**：广告法严扫（禁极限词）；300-800 字；审核档位：松

### livelihood_tandian（探店图文）
- **风格**：攻略感 + 地图感；地址 / 人均必含；本地博主口吻
- **阈值**：地址 / 价格真实性 100%；500-1500 字；审核档位：松

### livelihood_podcast（播客文字稿）
- **定位**：与 `podcast_script` 音频配套的"看得见的听觉内容"
- **风格**：可读性 + 口语化；字数跟随 podcast_script 的 total words
- **阈值**：审核档位：**严**

### drama_serial（短剧文字稿）
- **委托**：剧本生成由 `duanju_script` 负责；本子模板做 CMS 适配（正文结构化、标签、元信息）；type=1 入库供编辑查阅
- **阈值**：审核档位：**严**

### daily_brief（每日简报图文）
- **身份**：每天给用户泡一杯信息咖啡的编辑；1000 字覆盖 3-5 条热点
- **结构**：开篇一句话 → 3-5 条（每条标题 + 背景 + 影响 / 观点，100-200 字）→ 一句话结语
- **阈值**：600-1500 字；审核档位：松

## 工作流 Checklist

- [ ] Step 0: 按 subtemplate 加载风格指南 + KB
- [ ] Step 1: 理解 topic + 整合 references
- [ ] Step 2: 按子模板生成大纲
- [ ] Step 3: 逐段撰写正文（按段落字数比例预算 token）
- [ ] Step 4: 生成标题 + 副标题 + 导语
- [ ] Step 5: 生成摘要 + 关键词 + 标签
- [ ] Step 6: 质量自检（按子模板阈值）
- [ ] Step 7: 合规扫描（按 review tier：严 / 松）
- [ ] Step 8: 转 HTML 适配 CMS

## 字数 / 结构约束表

| Subtemplate | 字数范围 | 导语 max | 核心结构硬性要求 |
|-------------|---------|---------|----------------|
| news_standard | 800-2000 | 100 字 | 倒金字塔 + 5W1H 覆盖 ≥ 90% |
| politics_shenzhen | 1500-3500 | 150 字 | 原文引用 ≥ 3；会议 / 政策全称规范 |
| sports_chuanchao | 战报 500-1500 / 复盘 1500-2500 | 80 字 | 比分 + 数据表 + 关键球员 |
| variety_highlight | 800-2000 | 60 字 | Top N 盘点 + 艺人名核查 |
| livelihood_zhongcao | 300-800 | 50 字 | 钩子 + 痛点 + CTA |
| livelihood_tandian | 500-1500 | 50 字 | 地址 + 人均 + 特色记忆点 |
| livelihood_podcast | 跟随 podcast_script | 50 字 | 口语化可读 |
| drama_serial | 委托 duanju_script | — | CMS 适配结构化 |
| daily_brief | 600-1500 | 40 字 | 3-5 条 × 100-200 字 |

超限硬裁剪 + LLM 按目标范围重生；段落平均 100-200 字。

## 合规红线

- **全场景通用（广告法极限词）**：最 / 第一 / 绝对 / 100% / 顶级 / 独家首发（未授权）/ 国家级（未授权）
- **政治敏感**：党和国家领导人姓名不完整 / 不规范 / 加戏称 / 调侃；涉外对齐《新华社发稿规范》；民族宗教非中立表述
- **法律红线**：未判决称"罪犯"；披露未成年当事人真实姓名；对未定性案件下结论；医疗 / 金融 / 教育夸大承诺
- **场景专项**：`politics_shenzhen` 禁私自评价政策 / 领导称谓错 / 延伸敏感话题；`sports_chuanchao` 禁地域攻击 / 球员人身攻击 / 裁判黑哨定性；`variety_highlight` 禁艺人引战 / 伪造瓜；`drama_serial` 不剧透关键反转；`livelihood_zhongcao` 广告法严守；`livelihood_podcast` 审核严档

命中即 `complianceCheck.passed = false` 进入 `flaggedIssues`，必须 LLM 重写。严档子模板（news / politics / podcast / drama）一切存疑默认 block。

## 质量把关

**通用自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| G1 | 字数与目标匹配 | ±15% |
| G2 | 标题吸引力 | 含数字 / 金句 / 反差 / 疑问 ≥ 1 种 |
| G3 | 导语抓手 | ≤ 规范上限（见字数表） |
| G4 | 段落长度 | 平均 100-200 字 |
| G5 | 关键词覆盖 | 输入 keywords 覆盖率 ≥ 80% |
| G6 | 事实核查 | references 使用率 ≥ 80% |
| G7 | 合规扫描 | 按 tier 通过 |

> 子模板扩展阈值（政治引用 ≥ 3 / 体育比分准确 / 综艺艺人名核查 / 民生地址价格真实）见 §9 场景规范各条末行。

**Top-3 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 子模板混淆 | 时政稿写成新闻稿（少官方表述） | Step 0 强制按 subtemplate 加载 system prompt |
| 字数失控 | 目标 1500 写了 3000 或 500 | Step 3 分段 token 预算；末段调整（G1 ±15%） |
| 事实编造 | 无 references 时模型"合理编造"数据 | 无 references 时禁写具体数字；只输出"显著增长"等定性 |

## 输出模板 / 示例

```json
{
  "meta": {
    "contentId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "subtemplate": "news_standard",
    "style": "formal",
    "wordCount": 1180,
    "estimatedReadTimeSec": 295
  },
  "title": "深圳发布 AI 产业新政策 设立 200 亿专项基金",
  "subtitle": "5 年内建三个国家级产业园 单企最高补贴 5000 万",
  "summary": "4 月 17 日，深圳发布《促进人工智能产业高质量发展若干措施》……",
  "leadParagraph": "4 月 17 日，深圳市政府发布《关于促进人工智能产业高质量发展的若干措施》……",
  "bodyHtml": "<h2>深圳发布 AI 产业新政策</h2>…",
  "bodyMarkdown": "## 深圳发布 AI 产业新政策\n\n4 月 17 日…",
  "sections": [{ "heading": "政策要点", "body": "…" }, { "heading": "背景", "body": "…" }],
  "keywordsExtracted": ["深圳", "AI 产业", "200 亿", "专项基金"],
  "tagsSuggested": ["AI 产业政策", "深圳"],
  "factsUsed": [{ "fact": "200 亿元专项基金", "source": "政策文件原文", "verified": true }],
  "qualityScore": {
    "overall": 89,
    "dimensions": { "fluency": 92, "accuracy": 94, "relevance": 88, "style_match": 90, "compliance": 85 }
  },
  "complianceCheck": { "passed": true, "reviewTier": "strict", "flaggedIssues": [] }
}
```

## EXTEND.md 示例

```yaml
default_subtemplate: news_standard
default_style: formal
default_word_count: 1500

subtemplate_configs:
  politics_shenzhen:
    strictness: maximum
    kb_bind: [政策文件库, 领导讲话库]
    require_official_quote: true
    quote_count_min: 3
  sports_chuanchao:
    require_stats_table: true
    tone: balanced
  daily_brief:
    max_items: 5
    one_line_takeaway_per_item: true

organization_brand:
  name: "深圳广电智媒"
  tagline: "更快、更新、更本地"
  default_author: "智媒编辑部"

strict_catalogs: [app_politics, app_drama, app_livelihood_podcast]
```

## 上下游协作

- **上游**：选题策划（xiaoce）/ 热点分析（xiaolei）提供 topic + references；素材研究（xiaozi）提供参考素材；每日专题触发
- **下游**：`cms_publish` 入 CMS（type=1）；`headline_generate` 独立生成替代标题；`summary_generate` 生成摘要；`style_rewrite` 多风格 A/B；`quality_review`（按档位）人审

## 常见问题

| 问题 | 解决 |
|------|------|
| 子模板风格不生效 | Step 0 强制加载对应风格指南；system prompt 锁定 |
| 时政稿擅自评论 | `subtemplate=politics_shenzhen` + EXTEND `strictness=maximum`；Step 7 严档扫描 |
| 体育比分错 | 必须传入官方数据 references；Step 6 按 "比分 / 球员名 100%" 校验 |
| 艺人名错 | 综艺场景必须 KB 校验；无法核查则不出稿 |
| 字数失控 | Step 3 按段落字数比例预算 token；G1 ±15% 校验 |
| 广告法词命中 | 种草场景必加扫描器；命中必重写 |

## 参考资料

- **详细评分 Rubric**：[references/scenario-rubric-detailed.md](./references/scenario-rubric-detailed.md)（9 场景子模板详细打分标准 + 加减分项）
- **媒体行业规范**：[docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)（广告法 / 新华社规范 / 时政红线 / 未成年人保护 / AIGC 合规）
- 代码实现：[src/lib/agent/tools/content-generate.ts](../../src/lib/agent/tools/content-generate.ts)
- 参考 Spec：[docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md](../../docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md)
- 历史版本：`git log --follow skills/content_generate/SKILL.md`
