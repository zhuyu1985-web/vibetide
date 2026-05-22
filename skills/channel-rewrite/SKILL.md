---
name: channel_rewrite
displayName: 跨渠道改写
description: 把一篇中文稿件按目标社媒平台的语气、长度、hashtag 习惯改写成对应版本。支持 8 个平台（微信公众号 / 微博 / 抖音 / 小红书 / 知乎 / 头条 / 快手 / B 站），每个平台有独立 prompt 模板（语气 / 标题长度 / 正文结构 / hashtag 风格 / extraFields 提示）。用于稿件编辑器右栏「多渠道改写」面板的「一键生成本平台版本」按钮。不做发布，只产出 article_channel_variants 行。
version: "1.0"
category: content_gen
metadata:
  skill_kind: generation
  scenario_tags: [channel, rewrite, multi_platform]
  compatibleEmployees: [xiaowen, xiaofa]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/skills/channel-rewrite.ts
    testPath: src/lib/agent/skills/__tests__/
  openclaw:
    referenceSpec: /Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md
---

# 跨渠道改写（channel_rewrite）

你是「跨渠道改写员」，把一篇中文稿件按目标社媒平台调性重新组织——不是翻译，是**重写**。每个平台的读者期待、内容长度、语气、hashtag 习惯都不同，必须按平台模板严格走。

## 使用条件

✅ **应调用场景**：
- 稿件编辑器右栏「多渠道改写」点击「一键生成本平台版本」
- 同一篇稿件需要发到多个社媒，每个平台的版本需要差异化
- xiaofa（渠道运营师）的多平台分发流程中，针对某 channel 产出内容
- 跨平台运营矩阵（一篇内容多端覆盖）

❌ **不应调用场景**：
- 翻译到外语 → 走 `cross_language_rewrite`
- 单纯润色同一平台 → 走 `/api/ai/edit` 的 polish 模式
- 标题党改写（同平台多版本） → 走 `headline_generate`
- 摘要生成 → 走 `/api/ai/edit` 的 summarize 模式

**前置条件**：article.title 或 article.body 至少有一个非空；LLM 可用；platform 字段在已支持列表内（不在列表会走通用 fallback）。

## 输入 / 输出

**输入：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `article.title` | string | 是 | 原稿标题 |
| `article.body` | string | 是 | 原稿正文 |
| `article.summary` | string | 否 | 原稿摘要（可选辅助信息） |
| `platform` | string | 是 | 目标平台 slug（见下） |

**支持的 platform 值：**
`wechat_oa` / `weibo` / `douyin` / `xiaohongshu` / `zhihu` / `toutiao` / `kuaishou` / `bilibili`。其他值走通用社媒 fallback。

**输出（严格 Zod schema）：**

```ts
{
  title: string,       // 平台版标题
  body: string,        // 平台版正文
  summary?: string,    // 平台版摘要（可选）
  hashtags: string[],  // 0-10 个，平台风格
  extraFields?: Record<string, unknown>, // 平台特定字段
}
```

## 工作流 Checklist

1. **校验入参**：`article.title` 或 `body` 必有其一
2. **选择平台模板**：`PLATFORM_PROFILES[platform]`，未匹配走通用 fallback
3. **拼 system prompt**：把平台 toneRules / titleConstraints / bodyConstraints / hashtagAdvice / extraFieldsHint 注入
4. **生成**：AI SDK v6 `generateText({ output: Output.object({ schema }) })`，temperature 0.7，max 4096
5. **校验输出**：Zod schema 自动校验，长度 / 数量都有约束
6. **不做兜底**：调用方（server action）负责处理失败并写入 status='failed'

## 平台改写要点（矩阵摘要）

| 平台 | 标题长度 | 正文结构 | hashtag | 特殊提示 |
|---|---|---|---|---|
| **wechat_oa** 微信公众号 | ≤32 字符，不夸张 | 长文 + 小标题，正式 | 0-3 个，无 # | authorOverride / coverType |
| **weibo** 微博 | 总长 ≤140 字 | 钩子 → 信息 → 钩子 | 3-5 个 #话题# | topics / replyStrategy |
| **douyin** 抖音 | ≤55 字符抓人 | hook + 正文 + CTA 三段 | 5-8 个流量标签 | challengeIds / bgmHint |
| **xiaohongshu** 小红书 | ≤30 字符 + emoji | 第一人称种草 + 短段 | 5-8 个品类 | noteType / geoTag |
| **zhihu** 知乎 | ≤50 字符提问体 | 论据 + 数据 + 分点 | 0-3 个话题词 | questionId / columnId |
| **toutiao** 头条 | ≤30 字符 + 数字 | 标题党节奏短段 | 0-3 个 | channelHint |
| **kuaishou** 快手 | ≤55 字符 | hook + 正文 + CTA 接地气 | 3-6 老铁圈 | locationHint |
| **bilibili** B 站 | ≤80 字符【】分类 | 钩子 → 要点 → 三连 | 0（用 tags） | tags / partition |

## 质量把关

**LLM 自检规则（在 prompt 里硬编码）：**
- ✅ 不许新增原稿没有的事实
- ✅ 数字 / 时间 / 地点 保留准确
- ✅ 模糊词（很多人 / 最近）不要瞎写成具体数字
- ✅ 严格按 schema 输出 JSON，不附加解释文字

**常见失败模式：**
- LLM 返回数字 hashtag 数超出限制 → Zod schema `.max(10)` 拦截 → throw → action 写入 status=failed
- 标题超长 → Zod `.max(120)` 拦截
- LLM 中英混杂 → prompt 强调「中文社媒」可缓解；如果是 douyin/小红书等中文平台依然出英文，重试
- LLM 编造数据 → 这部分靠 prompt + 后期人工审核兜底（一键生成 ≠ 不审核）

## 输出示例

**输入（wechat_oa）：**
```json
{
  "platform": "wechat_oa",
  "article": {
    "title": "成都串串香排队 3 小时",
    "body": "国庆假期成都 XX 店出现 3 小时排队…顾客称…"
  }
}
```

**输出：**
```json
{
  "title": "成都美食又火了：这家串串香凭什么排队 3 小时？",
  "body": "## 现场\n国庆假期，成都某老字号串串香门前出现 3 小时排队的盛况…\n\n## 顾客怎么说\n…\n\n## 背后的逻辑\n…",
  "summary": "国庆期间成都某串串香排队 3 小时，反映本地美食消费持续升温。",
  "hashtags": ["成都美食", "国庆"],
  "extraFields": {
    "coverType": "image",
    "recommendedTags": ["美食探店", "本地生活"]
  }
}
```

**输入（weibo）：** 同样的原稿  
**输出（weibo）：**
```json
{
  "title": "🌶️ 国庆成都，又被一家串串香封神了！排队 3 小时啥概念？",
  "body": "🌶️ 国庆成都，又被一家串串香封神了！排队 3 小时啥概念？现场视频流出，顾客直呼「值了」👇 #成都美食# #国庆出游# #串串香#",
  "hashtags": ["#成都美食#", "#国庆出游#", "#串串香#"],
  "extraFields": {
    "topics": ["#成都美食#", "#国庆出游#"]
  }
}
```

## 上下游协作

**上游：**
- 编辑器右栏「多渠道改写」面板 → 调 `generateVariantAction(articleId, platform)`
- xiaofa 的「多平台分发」mission step

**下游：**
- 结果写入 `article_channel_variants` 表（status=ready）
- 后续可对接 channel gateway 完成实际发布（phase 3）
- 与 Ayrshare 海外发布（`external_publications`）平行，互不干扰

## 常见问题

**Q1：为什么不直接复用 cross_language_rewrite？**
A：cross_language_rewrite 是**跨语种**（中→英本地化），目标是海外读者。channel_rewrite 是**同语种跨平台**（都是中文），目标是国内不同社媒受众。语气模板完全不同。

**Q2：八个平台 prompt 模板写死，将来扩展怎么办？**
A：`PLATFORM_PROFILES` 是字典，加新平台只要加一条 entry + 加进 `CHANNEL_PLATFORMS` 元组。对 LLM 来说每次只关心一个平台的 prompt，不会膨胀。

**Q3：会不会编造数据？**
A：会，所以**一键生成必须配人工审核**。`article_channel_variants.status` 字段就是为此设计的：`ready` 只代表 LLM 完成了，不代表可以发布。发布前编辑必须切到对应渠道 tab 核对每个字段。

**Q4：失败重试怎么做？**
A：当前不在 skill 层重试。server action `generateVariantAction` 捕获异常写 status=failed，UI 显示「失败，重新生成」按钮供用户手动重试。

## 参考资料

- AI SDK v6 docs: <https://sdk.vercel.ai/docs>
- 同范式参考：`src/lib/agent/skills/cross-language-rewrite.ts`
- 设计文档：`/Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md`
- Server action 调用入口：`src/app/actions/article-channel-variants.ts::generateVariantAction`
