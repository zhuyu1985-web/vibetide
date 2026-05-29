---
name: cross_language_rewrite
displayName: 中英本地化改写
description: 把中文稿件批量改写成发布在 X / Instagram / Facebook 等海外社交平台的英文版本。核心是"本地化改写，不是逐句直译"——调整文化引用（中文谚语 → 英文等价表达）、解释中国地名 / 品牌 / 名人（不假设西方读者认识）、语气适配海外受众（短句、emoji、有钩子）、保留事实数字。输出每篇含 id=`<source_id>-v<index>`、sourceTopicId、variantIndex、原样 echo 的 sourceUrl / category、title_en（≤140 字符）、body_en、3~7 个英文 hashtags、可选 cultural_notes。支持 variantsPerTopic（1-3，默认 1）一次为同一条 input 生成多个不同切入角度的英文 variant（0=headline-driven 短版 / 1=storytelling 中版 / 2=analytical 长版）。单条生成失败时跳过该条，在 failed/warning 元数据里记录，不把中文占位稿放入 articles。可选 categoryHint 任意字符串，内置 food/pets/domestic_tech 三种语气模板，其他值 fallback 到通用语气。当 workflow 走「海外热榜搬运」step 3、或编辑想把一篇中文稿快速改成英文发外站时调用。
version: "1.0"
category: content_gen

metadata:
  skill_kind: generation
  scenario_tags: [overseas, translation, localization, rewrite]
  compatibleEmployees: [xiaowen]
  modelDependency: openai:qwen3-max
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
- categoryHint 可选；任意字符串都接受，内置 3 种（food/pets/domestic_tech）走专属语气模板，其他值 fallback 到"保持简洁直白，无特定语气倾向"

## 步骤边界 (Step Boundary)

本 skill 在工作流里通常作为 **step 3 (跨语言改写)** —— **只对输入文章做翻译 + 本地化**。

禁止跨步:
- 不要替 step 4 (archive_to_drafts) 做入库决策 —— 输出稿件就行，状态/分类是下一步的事
- 不要新增训练数据里的事实 —— 只翻译/重写输入里的内容
- 不要凭空插入额外 hashtags/cultural_notes，跟输入相关才加

`sourceUrl` / `category` 必须从输入原样 echo 到输出，**绝对不许修改或编造**。

## 输入 / 输出

**输入：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `articles` | `{id, title, body, tags?, sourceUrl?, category?}[]` | ✓ | 待改写的中文稿件数组 |
| `articles[].id` | string | ✓ | 稿件唯一标识（输出会变成 `<id>-v<index>`） |
| `articles[].title` | string | ✓ | 中文标题 |
| `articles[].body` | string | ✓ | 中文正文 |
| `articles[].tags` | string[] | ✗ | 中文 tag（仅参考，不直接翻成 hashtag） |
| `articles[].sourceUrl` | string | ✗ | 原文链接，**透传字段**，输出每个 variant 都要原样回填 |
| `articles[].category` | string | ✗ | 上游 topic_classifier 输出的分类，**透传字段** |
| `targetLanguage` | `"en"` | ✓ | 当前仅支持 en |
| `categoryHint` | string | ✗ | 任意字符串。内置语气：`food` / `pets` / `domestic_tech`；其他值 fallback 到通用语气 |
| `variantsPerTopic` | `1 \| 2 \| 3` | ✗ | 默认 1。每条 input 生成 N 个不同切入角度的英文 variant：variant 0 = headline-driven 短版；variant 1 = storytelling 中版；variant 2 = analytical 长版 |

**输出（zod schema）：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `articles[].id` | string | 格式 `<source_id>-v<index>`（如 `t1-v0` / `t1-v1`）—— 唯一标识单个 variant |
| `articles[].sourceTopicId` | string | **必填**，echo 自 input.id（同一 source 的所有 variant 共用） |
| `articles[].variantIndex` | `0 \| 1 \| 2` | **必填**，该 variant 在同 source 内的索引（从 0 起） |
| `articles[].sourceUrl` | string? | **必须从 input.sourceUrl 原样 echo**（不许编造、不许修改） |
| `articles[].category` | string? | **必须从 input.category 原样 echo** |
| `articles[].title_en` | string | 英文标题（≤ 140 字符，适配 X / IG caption 开头） |
| `articles[].body_en` | string | 英文正文（≥ 10 字符；段落短，每段 1-3 句） |
| `articles[].hashtags` | string[] | 3~7 个英文 hashtag |
| `articles[].cultural_notes` | string? | ≤ 400 字，记录本地化决策（编辑复核用） |
| `failed[]` | `{sourceTopicId,title,sourceUrl?,category?,reason}` | 可选。单条未生成英文稿时记录源稿信息，reason 固定为 `rewrite_unavailable` |
| `warning` | `{code,message}` | 可选。部分源稿未生成英文稿时返回，code 为 `partial_rewrite_unavailable` |

## 工作流 Checklist

- [ ] Step 0：input 校验（targetLanguage='en' / articles 非空 / id 不重）
- [ ] Step 1：按 categoryHint 注入对应语气提示（内置 3 种走专属模板，其他值走通用语气 fallback）
- [ ] Step 2：序列化 articles 为 user payload（含 sourceUrl / category 透传字段 + variants_per_topic）
- [ ] Step 3：调 LLM（qwen3-max，temperature=0.7，maxTokens=8192）—— content_gen 类别允许更高发挥
- [ ] Step 4：用 `generateText({ output: Output.object({ schema }) })` 拿强 schema 输出
- [ ] Step 5：对每条 input 按 variantsPerTopic 生成 N 个 variant，id = `<input_id>-v<index>`
- [ ] Step 6：检查返回数量；缺失条目写入 `failed[]` 并跳过，禁止把中文占位稿放进 `articles`
- [ ] Step 7：sourceUrl 兜底回填 —— LLM 漏返时从 input 找 sourceTopicId 对应原文的 sourceUrl
- [ ] Step 8：返回 `{ articles: [...] }`

## 改写原则（5 条铁律）

| # | 原则 | 反例 → 正例 |
|---|---|---|
| 1 | **文化适配**：中文谚语 → 英文等价 | "打铁还需自身硬" → "You can't pour from an empty cup" |
| 2 | **解释专有名词**：中国地名/品牌/人名第一次出现加注 | "成都" → "Chengdu, the spicy-food capital of southwest China" |
| 3 | **海外社交语气**：短句、钩子前置、适度 emoji | "近日有不少网友反映..." → "Folks online are asking 👀..." |
| 4 | **保留事实**：数字 / 时间 / 地点必须准确 | "很多人" 不要瞎写成 "millions" |
| 5 | **去 chinglish**：不要中式英语堆砌 | "Hot to give the thumbs up" → "Worth a thumbs-up" |

## categoryHint 语气模板

内置 3 个 key 享受专属语气模板；其他任意字符串（如用户在工作流编辑器加的 `auto` / `travel`）会 fallback 到通用语气"保持简洁直白，无特定语气倾向"。

> CATEGORY_TONE_DEFAULTS 这 3 个 key 必须跟 `seed-builtin-workflows` 里 hot_topics_overseas_en 的默认 categories 保持同步。

| categoryHint | 语气定位 | emoji 建议 | 例 |
|---|---|---|---|
| `food` | 感官化语言（taste / aroma / crispy / fluffy），可幽默 | 🍜🥢🌶️🔥 | "These Chengdu skewers? Crispy outside, mouth-numbingly spicy inside. 🌶️🔥" |
| `pets` | wholesome / heartwarming 口吻，鼓励互动 | 🐱🐶🐾✨ | "When the golden retriever sees mom come home 🐾✨ Drop a 🐾 if your dog does this too." |
| `domestic_tech` | 客观直白，避免营销词，可加规格数字 | 🚀💡🔋 | "Huawei Mate 70 Pro now supports satellite messaging — no cell service, no problem. 🛰️" |
| 其他（任意字符串） | 通用语气：保持简洁直白，无特定语气倾向 | 按 body 内容自然取舍 | —— |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|---|---|
| 1 | 每篇成功生成的 input 都有对应 output；未生成的 input 只进入 `failed[]` | 100% |
| 2 | id 格式为 `<source_id>-v<index>` | 100%（schema 强校验） |
| 3 | sourceTopicId 等于 input.id | 100%（schema 强校验） |
| 4 | variantIndex 为 0 / 1 / 2 | 100%（schema 强校验） |
| 5 | sourceUrl 从 input 原样 echo（不许编造、不许修改） | 100% |
| 6 | category 从 input 原样 echo | 100% |
| 7 | title_en 长度 1~140 字符 | 100%（schema 强校验） |
| 8 | body_en ≥ 10 字符 | 100%（schema 强校验） |
| 9 | hashtags 数量 3~7 | 100%（schema 强校验） |
| 10 | hashtags 全英文，无拼音 | 抽查 |
| 11 | 中国专有名词首次出现已加注 | 人工抽查 ≥ 90% |
| 12 | 数字 / 时间 / 地点与原文一致 | 100%（严禁编造） |
| 13 | variantsPerTopic = N 时，同 source 的 N 个 variant 切入角度明显不同 | 抽查 |

**变体（variant）三档定位：**

| variantIndex | 定位 | 长度建议 |
|---|---|---|
| 0 | headline-driven 短版（最钩子化，X 短帖适配） | ~60-120 字 |
| 1 | storytelling 中版（带场景叙事，IG caption 适配） | ~150-300 字 |
| 2 | analytical 长版（带数据 / 上下文 / 评论） | ~300-500 字 |

铁律：同 source 的 N 个 variant 必须**明显不同**——不同切入角度、不同钩子、不同长度，绝不是改几个字。

**关键透传契约（Phase 4 起强制）：**
- `sourceUrl` 必须从输入原样 echo 到输出（每个 variant 都带上），方便下游 `archive_to_drafts` 按 sourceUrl 去重
- `category` 必须从输入原样 echo（含 variant 间）
- `sourceTopicId` 必须等于 input.id；`variantIndex` 必须从 0 起递增
- `id` 必须按 `<source_id>-v<index>` 格式（如 `t1-v0`, `t1-v1`）

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---|---|---|
| 逐句直译 | "拼多多砍一刀" → "Pinduoduo cut one knife" | prompt 强调 localization > literal；加例 |
| 假设西方读者认识 | "BYD 销量超过 Tesla" 不加注 BYD | prompt 强制首次出现加 1 句定位 |
| chinglish | "Welcome to taste" / "no zuo no die" | 加反例字典；让 LLM 自检"是否像 native 英文" |
| 编造数字 | 原文"很多人" → 英文"millions" | prompt 已禁；输出后做数字 diff 校验 |
| 拼音 hashtag | `#ChuanChuanXiang` | 改成 `#ChineseStreetFood` 或音译+注解 |
| 失败占位稿流入下游 | `articles[]` 中出现中文标题或占位正文 | 不生成占位稿；失败源稿只进入 `failed[]`，由 UI 显示 warning |

## 输出示例

输入（variantsPerTopic = 2，含 sourceUrl + category 透传）：

```json
{
  "targetLanguage": "en",
  "categoryHint": "food",
  "variantsPerTopic": 2,
  "articles": [
    {
      "id": "a1",
      "title": "成都串串香夜市排队3小时，网友：值！",
      "body": "据网友反映，成都春熙路的老牌串串香小店王婆串串，最近成了打卡圣地。晚上 7 点开始排队，最长等了 3 小时。麻辣牛肉、脑花、鸭肠是必点，人均 80 元。",
      "tags": ["美食", "成都", "排队"],
      "sourceUrl": "https://example.com/news/a1",
      "category": "food"
    }
  ]
}
```

输出（同一 source 输出 2 个 variant，每个都 echo sourceUrl + category）：

```json
{
  "articles": [
    {
      "id": "a1-v0",
      "sourceTopicId": "a1",
      "variantIndex": 0,
      "sourceUrl": "https://example.com/news/a1",
      "category": "food",
      "title_en": "3-hour wait for skewers in Chengdu — and folks say it's worth it 🌶️",
      "body_en": "Wang Po Chuan Chuan, an old-school skewer shop in Chengdu (the spicy-food capital of southwest China), has become a viral hotspot. 🔥\n\nLines start at 7pm. The longest wait? 3 hours.\n\nMust-orders: mala beef, brain custard, duck intestine. ~$11 a head.",
      "hashtags": ["#ChineseStreetFood", "#ChengduEats", "#SpicyFood", "#FoodieAdventure", "#WorthTheWait"],
      "cultural_notes": "headline-driven 短版；'串串香' → 'skewers'（保留 Wang Po Chuan Chuan 音译）；'人均 80 元' → ~$11。"
    },
    {
      "id": "a1-v1",
      "sourceTopicId": "a1",
      "variantIndex": 1,
      "sourceUrl": "https://example.com/news/a1",
      "category": "food",
      "title_en": "Why thousands queue 3 hours for one bowl of skewers in Chengdu",
      "body_en": "It's 6:55pm on Chunxi Road, Chengdu — the spicy-food capital of southwest China. The line outside Wang Po Chuan Chuan, a decades-old skewer joint, already stretches around the block.\n\nBy 9pm, the longest wait is clocking in at 3 hours. Nobody is leaving.\n\nWhat are they queueing for? Mouth-numbing mala beef. Brain custard (yes, really). Duck intestine grilled crisp. The check averages around $11.\n\nIn a city famous for spicy hotpot, even the side-street stalls now pull TikTok-grade crowds. 🌶️",
      "hashtags": ["#ChengduFood", "#ChineseStreetFood", "#MalaMagic", "#SpicyEats", "#FoodTok"],
      "cultural_notes": "storytelling 中版，开场设场景；'人均' 用 'check averages'；保留 'mala' 不译（已是英文 foodie 圈通用词）。"
    }
  ]
}
```

## 上下游协作

- **上游**：`topic_classifier` 输出的分类（含 food / pets / domestic_tech，以及用户在工作流编辑器加的任意自定义分类）；workflow step 2 过滤后把 `sourceUrl + category` 透传字段一并送入本 skill
- **下游**：workflow step 4 `archive_to_drafts` —— 把 N 个 variant 批量入 articles 表，按 sourceUrl 去重。**注意**：同一 source 的多个 variant 共用 sourceUrl，如果开了 `dedupBySourceUrl`，N>1 时除第 1 个 variant 入库，其余会被 skip（设计如此：海外搬运按 source 去重，避免反复污染稿件库）

## 常见问题

| 问题 | 原因 | 解决 |
|---|---|---|
| 同一稿件改写两次结果差异大 | content_gen 温度 0.7 偏高 | 这是预期（创作类）；要稳定可降到 0.4 |
| title_en 经常贴近 140 字符上限 | LLM 倾向写满 | prompt 加 "prefer concise titles under 100 chars" |
| hashtag 抽不出 categoryHint | LLM 不知道 niche tag | 在 prompt 加流行 hashtag 字典示例 |
| 输出长度爆 token | body 太长 / variantsPerTopic 偏大 | 单次上限 5 篇；超过分批；body > 3000 字符建议先 `summary_generate`；variantsPerTopic 临时降到 1 |
| body_en 段落太长 | LLM 默认写长段 | prompt 已强调"每段 1-3 句"；可在 post-process 用 \n\n 强切 |
| 同 source 的多个 variant 雷同 | LLM 没拉开切入角度 | prompt 已强制"明显不同"；temperature 0.7 已留发挥空间；个别 case 可重跑该 source |
| 输出缺 sourceUrl | LLM 漏返了透传字段 | skill 已做兜底回填（从 input.id 反查 sourceUrl）；监控里仍能看到漏返率 |

## 参考资料

- 代码实现：[src/lib/agent/skills/cross-language-rewrite.ts](../../src/lib/agent/skills/cross-language-rewrite.ts)
- Phase 3 categoryHint enum → string：commit `b47ec08` / `364b9a2`
- Phase 4 variants + sourceUrl 透传：commit `9a3fc35`
- 设计文档：`/Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md`
- 上游 topic_classifier：[../topic-classifier/SKILL.md](../topic-classifier/SKILL.md)
- 下游 archive_to_drafts：[../archive-to-drafts/SKILL.md](../archive-to-drafts/SKILL.md)
