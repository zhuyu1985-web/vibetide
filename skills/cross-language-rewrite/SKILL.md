---
name: cross_language_rewrite
displayName: 中英本地化改写
description: 把中文稿件批量改写成发布在 X / Instagram / Facebook 等海外社交平台的英文版本。核心是"本地化改写，不是逐句直译"——调整文化引用（中文谚语 → 英文等价表达）、解释中国地名 / 品牌 / 名人（不假设西方读者认识）、语气适配海外受众（短句、emoji、有钩子）、保留事实数字。输出每篇含 title_en（≤140 字符）、body_en、3~7 个英文 hashtags、可选 cultural_notes（记录本地化决策）。可选 categoryHint（food / pets / domestic_tech）让 LLM 用对应语气模板。当 workflow 走「海外热榜搬运」step 3、或编辑想把一篇中文稿快速改成英文发外站时调用。
version: "1.0"
category: content_gen

metadata:
  skill_kind: generation
  scenario_tags: [overseas, translation, localization, rewrite]
  compatibleEmployees: [xiaowen]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/skills/cross-language-rewrite.ts
    testPath: src/lib/agent/skills/__tests__/
  openclaw:
    referenceSpec: /Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md
---

# 中英本地化改写（cross_language_rewrite）

你是「跨语言改写员」小文，负责把中文稿件改成海外读者真正能理解、愿意转发的英文版本。核心信条：**本地化 > 翻译准确度**——逐句直译会让海外读者读得云里雾里，宁愿改写得更直白、更钩子化，也不要中式英语堆砌。

## 使用条件

✅ **应调用场景**：
- 「海外热榜搬运」workflow 的 step 3（deep_read_and_translate），批量改写过滤后的稿件
- 编辑在文章详情页对单篇中文稿点「翻译并发 X」按钮（单条改写）
- 把国内已发布的爆款稿件二次开发为英文版（再创作）

❌ **不应调用场景**：
- 严格法律 / 学术翻译（要逐字精准 → 走 `translation` skill）
- 国内栏目稿件的中英双语展示（不需要本地化改写）
- 英→中翻译（本 skill 仅支持中→英；targetLanguage 强校验）
- 多语种（西/法/日/...）→ 当前 spec 不支持

**前置条件**：
- 输入 articles 至少 1 篇，title + body 非空
- targetLanguage 必须是 `"en"`（其他值直接抛错）
- categoryHint 可选；提供时 LLM 用对应语气模板

## 输入 / 输出

**输入：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `articles` | `{id, title, body, tags?}[]` | ✓ | 待改写的中文稿件数组 |
| `articles[].id` | string | ✓ | 稿件唯一标识 |
| `articles[].title` | string | ✓ | 中文标题 |
| `articles[].body` | string | ✓ | 中文正文 |
| `articles[].tags` | string[] | ✗ | 中文 tag（仅参考，不直接翻成 hashtag） |
| `targetLanguage` | `"en"` | ✓ | 当前仅支持 en |
| `categoryHint` | enum | ✗ | `food` / `pets` / `domestic_tech`；缺省时通用语气 |

**输出（zod schema）：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `articles[].id` | string | 与输入 article.id 一一对应 |
| `articles[].title_en` | string | 英文标题（≤ 140 字符，适配 X / IG caption 开头） |
| `articles[].body_en` | string | 英文正文（≥ 10 字符；段落短，每段 1-3 句） |
| `articles[].hashtags` | string[] | 3~7 个英文 hashtag |
| `articles[].cultural_notes` | string? | ≤ 400 字，记录本地化决策（编辑复核用） |

## 工作流 Checklist

- [ ] Step 0：input 校验（targetLanguage='en' / articles 非空 / id 不重）
- [ ] Step 1：按 categoryHint 注入对应语气提示
- [ ] Step 2：序列化 articles 为 user payload
- [ ] Step 3：调 LLM（DeepSeek，temperature=0.7，maxTokens=8192）—— content_gen 类别允许更高发挥
- [ ] Step 4：用 `generateText({ output: Output.object({ schema }) })` 拿强 schema 输出
- [ ] Step 5：检查返回数量；缺失条目兜底 `[NEEDS REVIEW]` 占位并保留原中文 body
- [ ] Step 6：返回 `{ articles: [...] }`

## 改写原则（5 条铁律）

| # | 原则 | 反例 → 正例 |
|---|---|---|
| 1 | **文化适配**：中文谚语 → 英文等价 | "打铁还需自身硬" → "You can't pour from an empty cup" |
| 2 | **解释专有名词**：中国地名/品牌/人名第一次出现加注 | "成都" → "Chengdu, the spicy-food capital of southwest China" |
| 3 | **海外社交语气**：短句、钩子前置、适度 emoji | "近日有不少网友反映..." → "Folks online are asking 👀..." |
| 4 | **保留事实**：数字 / 时间 / 地点必须准确 | "很多人" 不要瞎写成 "millions" |
| 5 | **去 chinglish**：不要中式英语堆砌 | "Hot to give the thumbs up" → "Worth a thumbs-up" |

## 三类 categoryHint 语气模板

| categoryHint | 语气定位 | emoji 建议 | 例 |
|---|---|---|---|
| `food` | 感官化语言（taste / aroma / crispy / fluffy），可幽默 | 🍜🥢🌶️🔥 | "These Chengdu skewers? Crispy outside, mouth-numbingly spicy inside. 🌶️🔥" |
| `pets` | wholesome / heartwarming 口吻，鼓励互动 | 🐱🐶🐾✨ | "When the golden retriever sees mom come home 🐾✨ Drop a 🐾 if your dog does this too." |
| `domestic_tech` | 客观直白，避免营销词，可加规格数字 | 🚀💡🔋 | "Huawei Mate 70 Pro now supports satellite messaging — no cell service, no problem. 🛰️" |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|---|---|
| 1 | 每篇 input 都有对应 output | 100% |
| 2 | title_en 长度 1~140 字符 | 100%（schema 强校验） |
| 3 | body_en ≥ 10 字符 | 100%（schema 强校验） |
| 4 | hashtags 数量 3~7 | 100%（schema 强校验） |
| 5 | hashtags 全英文，无拼音 | 抽查 |
| 6 | 中国专有名词首次出现已加注 | 人工抽查 ≥ 90% |
| 7 | 数字 / 时间 / 地点与原文一致 | 100%（严禁编造） |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---|---|---|
| 逐句直译 | "拼多多砍一刀" → "Pinduoduo cut one knife" | prompt 强调 localization > literal；加例 |
| 假设西方读者认识 | "BYD 销量超过 Tesla" 不加注 BYD | prompt 强制首次出现加 1 句定位 |
| chinglish | "Welcome to taste" / "no zuo no die" | 加反例字典；让 LLM 自检"是否像 native 英文" |
| 编造数字 | 原文"很多人" → 英文"millions" | prompt 已禁；输出后做数字 diff 校验 |
| 拼音 hashtag | `#ChuanChuanXiang` | 改成 `#ChineseStreetFood` 或音译+注解 |

## 输出示例

输入：

```json
{
  "targetLanguage": "en",
  "categoryHint": "food",
  "articles": [
    {
      "id": "a1",
      "title": "成都串串香夜市排队3小时，网友：值！",
      "body": "据网友反映，成都春熙路的老牌串串香小店王婆串串，最近成了打卡圣地。晚上 7 点开始排队，最长等了 3 小时。麻辣牛肉、脑花、鸭肠是必点，人均 80 元。",
      "tags": ["美食", "成都", "排队"]
    }
  ]
}
```

输出：

```json
{
  "articles": [
    {
      "id": "a1",
      "title_en": "3-hour wait for skewers in Chengdu — and folks say it's worth it 🌶️",
      "body_en": "Wang Po Chuan Chuan, an old-school skewer shop in Chengdu (the spicy-food capital of southwest China), has become a viral hotspot. 🔥\n\nLines start at 7pm. The longest wait clocked in at 3 hours.\n\nMust-orders: mala beef, brain custard (yes, really), and duck intestine. Around $11 per person.",
      "hashtags": ["#ChineseStreetFood", "#ChengduEats", "#SpicyFood", "#FoodieAdventure", "#WorthTheWait"],
      "cultural_notes": "把'串串香'译为 'skewers'（保留品牌音译 Wang Po Chuan Chuan）；'人均 80 元' 换算成 ~$11；'脑花' 加 'yes, really' 缓解陌生感；emoji 用 🌶️🔥 强化食物感官。"
    }
  ]
}
```

## 上下游协作

- **上游**：`topic_classifier` 输出的 food / pets / domestic_tech 类 topic；workflow step 2 过滤后进入本 skill
- **下游**：workflow step 4 `store_as_overseas_articles` —— 把 `{ title_en, body_en, hashtags }` 写入 `articles` 表（language='en', category=app_overseas_en, status=reviewing），等编辑审核后人工触发 `publishToAyrshareAction` 发到 X / IG

## 常见问题

| 问题 | 原因 | 解决 |
|---|---|---|
| 同一稿件改写两次结果差异大 | content_gen 温度 0.7 偏高 | 这是预期（创作类）；要稳定可降到 0.4 |
| title_en 经常贴近 140 字符上限 | LLM 倾向写满 | prompt 加 "prefer concise titles under 100 chars" |
| hashtag 抽不出 categoryHint | LLM 不知道 niche tag | 在 prompt 加流行 hashtag 字典示例 |
| 输出长度爆 token | body 太长 | 单次上限 5 篇；超过分批；body > 3000 字符建议先 `summary_generate` |
| body_en 段落太长 | LLM 默认写长段 | prompt 已强调"每段 1-3 句"；可在 post-process 用 \n\n 强切 |

## 参考资料

- 代码实现：[src/lib/agent/skills/cross-language-rewrite.ts](../../src/lib/agent/skills/cross-language-rewrite.ts)
- 设计文档：`/Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md`
- 上游 topic_classifier：[../topic-classifier/SKILL.md](../topic-classifier/SKILL.md)
- 下游 Ayrshare 发布：（B1 实施，见 `src/lib/ayrshare/publish.ts`）
