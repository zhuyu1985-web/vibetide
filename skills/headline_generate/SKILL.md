---
name: headline_generate
displayName: 标题生成（场景化重写版）
description: 为各类稿件（图文 / 视频 / 短视频 / 播客 / 直播 / 专题）生成高质量标题，按 9 大 APP 栏目场景分化风格（新闻严肃 / 时政规范 / 体育情绪 / 综艺娱乐 / 民生亲切 / 种草接地气 / 探店生活化 / 播客悬念 / 短剧爆点 / 每日专题）。每个栏目有独立标题风格、字数限制、表情符号策略、数字与符号使用规范、禁用词表。支持主标题 + 副标题 + 短标题三形态同时输出（对应 CMS 的 title / subTitle / shortTitle 字段）。输出含 A/B/C 三版本对比、钩子强度 0-100 评分、SEO 关键词密度、合规扫描（政治 / 商业 / 法律敏感）、字符数限制校验（微信 ≤ 64 / 小红书 ≤ 20 / 微博 ≤ 32）。当用户提及"起标题""标题优化""取个名字""钩子""爆款标题""主副标题""SEO 标题"等关键词时调用；不用于正文生成或摘要生成。
version: 5.0.0
category: content_gen

metadata:
  skill_kind: generation
  scenario_tags: [news, politics, sports, variety, livelihood, drama, daily_brief]
  compatibleEmployees: [xiaowen, xiaoce]
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

# 标题生成（headline_generate）

## 使用条件

✅ **应调用场景**：
- 基于已生成的正文内容提取 / 优化标题
- 为未定稿内容先出标题方案（多版本 A/B）
- 旧标题重做（SEO 优化、改风格）
- CMS 入库前自动生成 listTitle / shortTitle

❌ **不应调用场景**：
- 没有任何 contentSummary 时（标题必须基于内容）
- 分集短剧标题（走 `duanju_script` 内建的分集标题）

**前置条件**：`contentSummary` 非空；`scenario` 必须是 9 个栏目之一；LLM 可用。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| contentSummary | string | ✓ | 正文或核心要点 |
| scenario | enum | ✓ | 9 个场景之一（见 §9 场景标题风格规范） |
| style | enum | ✗ | `declarative` / `question` / `numerical` / `reversal` / `emotional` / `suspense` |
| keywords | string[] | ✗ | SEO 关键词 |
| variantCount | int (1-5) | ✗ | A/B 多版本数量，默认 3 |
| generateSubtitles / generateShortTitle | boolean | ✗ | 默认均 true（CMS subTitle / shortTitle） |
| maxMainTitleLength / maxSubtitleLength / maxShortTitleLength | int | ✗ | 默认 28 / 40 / 15 |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| variants[] | array | 每版本含 `title/subtitle/shortTitle/style/scores/charCount/keywordsCovered/hookPattern/warnings`；`scores` = `{ attractiveness, clarity, seoScore, styleMatch, overall }` 0-100 |
| recommended | int | 推荐 variant 索引 |
| complianceCheck | object | `{ passed, flaggedVariants[] }` |

完整 Zod Schema 见 [src/lib/agent/execution.ts](../../src/lib/agent/execution.ts) 内 skill IO 定义。

## 9 场景标题风格规范

### news_standard（新闻标题）
- **原则**：事实先行 + 关键要素 + 简洁有力
- **模板**：`{主体} {动作} {客体/量级}` / `{事件}：{核心结果}`
- **示例**：> "深圳发布 AI 产业政策 5 年投 200 亿"
- **禁忌**：夸张感叹 / 标题党 / 模糊主体（"某人""有关方面"）

### politics_shenzhen（时政标题）| 审核档位：严
- **原则**：官方表述 + 权威感 + 严谨；会议 / 政策名 / 领导姓名完整规范
- **模板**：`{会议/领导} {动作/表述}` / `{政策名称}发布 {关键信息}`
- **示例**：> "《深圳 AI 产业若干措施》发布 5 年投 200 亿"
- **禁忌**：对政策评价（"重大""力度空前"）/ 口语化 / 网络用语

### sports_chuanchao（体育标题）
- **原则**：比分 / 关键球员 + 情绪张力 + 现场感
- **模板**：战报 `{比分} {关键动作}` / 预告 `{对阵} {看点}` / 球星 `{球员} {数据}`
- **示例**：> "2-1 绝杀！成都蓉城补时头球破门"
- **允许词**：绝杀、力克、完胜、险胜、惊天逆转、开门红
- **禁忌**：地域攻击 / 球员侮辱

### variety_highlight（综艺标题）
- **原则**：名场面 + 梗感 + 榜单 / 反转
- **模板**：榜单 `{数字} 大看点 {关键词}` / 名场面 `{艺人} 这段 {动作}` / 反转 `以为是 X 结果是 Y`
- **允许词**：炸场、封神、整活儿、出圈、顶流、翻车
- **禁忌**：艺人对比引战 / 恶意嘲讽 / 伪造瓜

### livelihood_zhongcao（种草标题）
- **原则**：痛点 / 反差 + 具象感官 + CTA 暗示
- **模板**：痛点 `{痛点}的姐妹必看 {产品}` / 反差 `我以为 {预期} 没想到 {实际}` / 数字 `{价格/对比}`
- **允许词**：宝子、冲、绝了、天花板、顶了
- **禁忌**：广告法极限词（最 / 第一 / 绝对 / 100%）/ 硬广腔

### livelihood_tandian（探店标题）
- **原则**：地点 + 品类 + 记忆点 + 人均
- **模板**：宝藏 `藏在 {地点} 的 {品类} {特色}` / 反差 `在 {城市} 吃 {异地美食}？` / 性价比 `人均 {金额} 吃 {品类}`
- **允许词**：宝藏、藏、巷子、烟火气、本地人、必打卡

### livelihood_podcast（播客标题）
- **原则**：主题 + 亲切感 + 可听性
- **模板**：早间 `{日期} 早资讯：{3 个关键词}` / 主题 `今天聊聊 {主题}` / 系列 `{节目名} 第 {X} 期：{副题}`
- **允许**：口语化、亲切称呼（朋友 / 你们）

### drama_serial（短剧标题）| 审核档位：严
- **原则**：悬念 + 钩子 + 分集标识（系列名 + 集数 + 集副标题）
- **示例**：> "裴总的掌心梨｜第 3 集：她发现了" / "离婚后，前夫悔断肠｜第 1 集：她穿着婚纱，摔在他脚下"
- **允许词**：悬念词（她发现了、他的秘密、原来如此、反转）

### daily_brief（每日专题标题）
- **原则**：日期 + 主题 + 亮点预告
- **模板**：`{日期} {主题}：{1 句亮点}`
- **示例**：> "4 月 17 日科技早资讯：深圳 AI 200 亿新政上线"

## 工作流 Checklist

- [ ] Step 0: 理解 contentSummary + scenario + style
- [ ] Step 1: 识别核心要素（5W1H / 金句 / 数字 / 对比）
- [ ] Step 2: 按 scenario 锁定模板 + 风格词典
- [ ] Step 3: 生成 variantCount 个主标题
- [ ] Step 4: 为每个主标题生成副标题 + 短标题
- [ ] Step 5: 评分（吸引力 / 清晰度 / SEO / 风格匹配）
- [ ] Step 6: 合规扫描（广告法 + 场景禁忌 + 政治敏感 + 法律红线）
- [ ] Step 7: variant 间差异度校验（编辑距离 ≥ 5），选出推荐

## 字数约束

| Scenario | 主标题 max | 副标题 max | 短标题 max |
|----------|:---:|:---:|:---:|
| news_standard / sports / variety / livelihood_* | 25 | 40 | 12 |
| livelihood_podcast | 25 | 35 | 12 |
| politics_shenzhen | 30 | 45 | 15 |
| daily_brief | 30 | 40 | 15 |
| drama_serial | 35 | 40 | 15 |

超限硬裁剪 + LLM 按目标范围重生。默认 `maxMainTitleLength=28` 时覆盖各场景上限。

## 合规红线（禁止词清单）

- **全场景通用（广告法极限词）**：最 / 第一 / 绝对 / 100% / 顶级 / 独家首发（未授权）/ 国家级（未授权）
- **政治敏感**：党和国家领导人姓名不完整 / 不规范 / 加戏称 / 调侃；涉外表述对齐《新华社发稿规范》；民族宗教非中立表述
- **法律红线**：未判决称"罪犯"；披露未成年当事人真实姓名；对未定性案件下结论；医疗 / 金融 / 教育夸大承诺
- **场景专项**：`politics_shenzhen` 禁情感色彩词；`sports_chuanchao` 禁地域攻击 / 球员侮辱；`variety_highlight` 禁艺人引战 / 伪造瓜；`drama_serial` 禁剧透关键反转；`livelihood_zhongcao` 广告法严守

命中即 `complianceCheck.passed = false` 并进入 `flaggedVariants`，必须 LLM 重写。

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 主 / 副 / 短标题字数 | ≤ max* |
| 2 | 关键词覆盖 | ≥ 60% |
| 3 | 场景风格匹配 | styleMatch ≥ 70 |
| 4 | 合规 | passed |
| 5 | variant 间差异度 | 编辑距离 ≥ 5 |

**Top-3 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 标题党 | 夸张感叹、"震惊！你绝对想不到……" | 合规扫描禁用词；LLM 重写 |
| 场景错配 | 时政写成娱乐风 / 种草触广告法极限词 | Step 2 按 scenario 锁定模板与词典 |
| variant 雷同 | 3 个版本只差一字 | Step 7 强制差异度校验（编辑距离 ≥ 5） |

## 输出模板 / 示例

```json
{
  "variants": [
    {
      "title": "深圳发布 AI 产业新政策 5 年投入 200 亿元",
      "subtitle": "设立 3 个产业园 最高补贴 5000 万",
      "shortTitle": "深圳 AI 新政",
      "style": "declarative",
      "scores": { "attractiveness": 82, "clarity": 92, "seoScore": 85, "styleMatch": 90, "overall": 87 },
      "charCount": 22,
      "keywordsCovered": ["深圳", "AI 产业", "200 亿"],
      "hookPattern": "数字冲击",
      "warnings": []
    }
  ],
  "recommended": 0,
  "complianceCheck": { "passed": true, "flaggedVariants": [] }
}
```

## EXTEND.md 示例

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
  app_news: "【新闻】"
  app_politics: ""

seo_keyword_weight: 0.3         # SEO 分在 overall 中的权重
variant_diff_min_edit: 5        # variant 间最小编辑距离
```

## 上下游协作

- **上游**：`content_generate` 产出正文 → 优化标题；运营手动指定主题 → 出 A/B 方案
- **下游**：`cms_publish` 消费选定 variant（title / subTitle / shortTitle）入 CMS；未来接入 A/B 测试框架

## 参考资料

- **场景 × 句式模式库**：[references/headline-patterns-by-scenario.md](./references/headline-patterns-by-scenario.md)（9 场景推荐句式 + 反面案例 + 合规红线）
- **媒体行业规范**：[docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)（广告法极限词 / 中央媒体用语白黑名单 / 政治红线）
- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)（通用 agent 执行入口；skill 逻辑通过 prompt 驱动）
- 参考 Spec：[docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md](../../docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md) · 历史：`git log --follow skills/headline_generate/SKILL.md`
