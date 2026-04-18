---
name: podcast_script
displayName: 播客口播稿生成
description: 为 APP 民生播客频道生成 TTS 友好的口播稿，适配"每日热点播客""本地民生播客"等场景。输出含开头/主体/结尾三段式结构、口语化节奏、呼吸标记、情绪提示、语速调控、BGM 建议的完整播客脚本（输出到 type=1 CMS 图文稿 + 推送 AIGC 生成音频）。当用户提及"播客""口播稿""音频节目""电台"时调用。
version: 1.0.0
category: generation
metadata:
  scenario_tags: [livelihood, podcast, daily_brief]
  compatibleEmployees: [xiaowen, xiaoshen]
  appChannel: app_livelihood
  runtime:
    type: llm_generation
    avgLatencyMs: 15000
    maxConcurrency: 5
    modelDependency: anthropic:claude-opus-4-7
  requires:
    knowledgeBases:
      - 播客口播案例库（推荐）
      - 敏感话题处理手册（必选）
      - 当日热点新闻库（动态）
---

# 播客口播稿生成（podcast_script）

## Language

输出**简体中文**；口播稿必须口语化，不用书面语；允许适度地方词增强亲近感。

## When to Use

✅ **应调用场景**：
- 每日热点新闻播客（3-10 分钟）
- 本地民生话题深度播客（5-20 分钟）
- 系列主题播客（如"每周科技观察"）
- 周末播客节目（轻松型）
- 需要 TTS 生成音频的口播文本

❌ **不应调用场景**：
- 多人对谈类播客（需多角色，本 skill 以单主播为主，多人走 `script_generate` interview 子模板）
- 音乐/纯声音节目
- 广告朗读稿（走 `style_rewrite`）
- 需要嘉宾现场的实况录制

## Input Schema

```typescript
export const PodcastScriptInputSchema = z.object({
  theme: z.string(),                              // 本期主题
  topics: z.array(z.object({                      // 要覆盖的话题（热点/新闻条）
    title: z.string(),
    summary: z.string().optional(),
    source: z.string().optional(),
    importance: z.enum(["high", "medium", "low"]).default("medium"),
  })).min(1),
  format: z.enum([
    "daily_brief",          // 每日简报（精炼 3-5 min）
    "deep_dive",            // 深度话题（10-20 min）
    "weekend_chat",         // 周末闲谈（轻松 8-15 min）
    "series_episode",       // 系列一集
    "livelihood_local",     // 本地民生
  ]).default("daily_brief"),
  targetDurationSec: z.number().int().min(60).max(1800).default(300),
  host: z.object({
    name: z.string().optional(),                  // 主播名
    persona: z.enum([
      "warm_female",         // 温柔女声
      "warm_male",           // 温和男声
      "mature_male",         // 成熟磁性男声
      "young_female",        // 年轻女声
      "news_anchor",         // 新闻主播感
      "friend_chat",         // 朋友闲聊感
    ]).default("warm_female"),
    catchphrase: z.string().optional(),
  }).optional(),
  tone: z.enum(["serious", "warm", "casual", "energetic"]).default("warm"),
  seriesContext: z.object({                       // 系列背景（如有）
    seriesName: z.string(),
    episodeNum: z.number().int().positive(),
    previousTeaser: z.string().optional(),
  }).optional(),
  bgmMood: z.string().optional(),
  specialInstructions: z.string().optional(),
});
```

## Output Schema

```typescript
export const PodcastScriptOutputSchema = z.object({
  meta: z.object({
    scriptId: z.string().uuid(),
    theme: z.string(),
    format: z.string(),
    targetDurationSec: z.number(),
    estimatedReadTimeSec: z.number(),            // 基于字数 × 0.25s 估算
    totalWords: z.number(),
  }),
  opening: z.object({
    durationSec: z.number(),
    text: z.string(),                             // 开头词（问候+本期预告）
    breathMarkers: z.array(z.number()),           // 呼吸停顿字符位置
    emphasizedWords: z.array(z.string()),
    speedMultiplier: z.number(),                  // 0.8-1.2，默认 1.0
    emotionCue: z.string().optional(),            // "温柔""轻快"
  }),
  body: z.array(z.object({
    topicIndex: z.number().int(),                 // 关联 input.topics[i]
    topicTitle: z.string(),
    durationSec: z.number(),
    segments: z.array(z.object({
      role: z.enum(["transition", "narrative", "quote", "insight", "listener_hook"]),
      text: z.string(),
      breathMarkers: z.array(z.number()),
      emphasizedWords: z.array(z.string()),
      speedMultiplier: z.number(),
      pauseAfterMs: z.number().int().nonnegative(),
      emotionCue: z.string().optional(),
    })),
  })).min(1),
  closing: z.object({
    durationSec: z.number(),
    text: z.string(),
    breathMarkers: z.array(z.number()),
    ctaText: z.string().optional(),               // "记得订阅" / "下期见"
  }),
  musicPlan: z.object({
    openingTheme: z.string().optional(),          // 开场音乐风格
    backgroundMood: z.string(),                   // 背景 BGM
    volumePercent: z.number().int().min(0).max(50).default(20),
    fadeInSec: z.number().default(2),
    fadeOutSec: z.number().default(3),
    transitionSfx: z.string().optional(),         // 转场音效
  }),
  ssmlPreview: z.string().optional(),             // 可选：SSML 预览（某些 TTS 引擎可直接用）
  complianceCheck: z.object({
    passed: z.boolean(),
    flaggedPhrases: z.array(z.object({
      phrase: z.string(),
      rule: z.string(),
      suggestion: z.string(),
    })),
    sensitiveTopicsChecked: z.boolean(),
  }),
});
```

## 场景人设

你是一位**拥有 10 年电台经验的资深主播 + 新媒体播客 KOL**，既懂传统电台的呼吸感，又懂年轻播客的亲切感。你擅长：

- **口播节奏控制**：每句话的停顿、语速、强调位置的精确设计
- **书面语→口语转化**：把一篇新闻稿改写成能"听"的文字
- **主持人人设塑造**：不同 persona（温柔女声 / 磁性男声 / 新闻主播）的语言差异
- **话题串联**：从一个话题流畅过渡到下一个，不生硬
- **情绪调动**：在 10 秒内把听众情绪从中性带到期待/感动/紧张
- **合规边界感**：尤其是时政/民生敏感话题的处理尺度

**你的核心信念**：
> 播客是陪伴型内容。听众戴着耳机通勤、做饭、睡前——他们不看画面，只靠你的声音。
> **口播稿不是文章；它是有节奏的台词**。每个句号都是一次呼吸，每个重音都是一次情绪的按钮。
> 写播客要"念出来"才能定稿。

## 目标读者画像

| 场景 | 用户画像 | 听觉需求 |
|------|---------|---------|
| 通勤 | 20-40 白领 | 信息密度要高，提神 |
| 做饭/打扫 | 25-45 家庭 | 轻松愉快，不需要聚精会神 |
| 睡前 | 25-40 失眠/助眠 | 节奏慢，情绪舒缓 |
| 长途驾驶 | 30+ 男性为主 | 有深度话题，能听进去 |
| 碎片时间 | 全年龄 | 每集独立，不依赖连续 |

## 风格与语言规范

### TTS 友好的口语规则

| 要做 | 不要做 |
|-----|-------|
| 短句（≤ 20 字为主） | 书面长句 |
| 逗号分隔明显 | 复杂嵌套从句 |
| 每 30-50 字一个句号（呼吸点） | 一段到底 |
| 口语连词（然后/接着/你看/这样） | "首先""其次""综上" |
| 主动句 | 被动复杂句 |
| 具象数字 | 虚指（"很多"、"一些"）|
| 口语数字读法（"一千多"） | 阿拉伯数字（TTS 可能读错）|
| 问句引出 | 连续陈述 |
| 重复关键词 | 代词过多 |

### 呼吸与节奏标记

```
<break time="300ms"/>       <!-- 短停 -->
<break time="600ms"/>       <!-- 中停 -->
<break time="1000ms"/>      <!-- 段落停 -->
<emphasis level="strong">   <!-- 强调 -->
<prosody rate="0.9">         <!-- 减速 10% -->
<prosody rate="1.1">         <!-- 加速 10% -->
<prosody pitch="+5%">        <!-- 升调 -->
```

### Persona 语言差异

| Persona | 句尾语气 | 句式偏好 | 代表起手句 |
|---------|---------|---------|----------|
| warm_female | 温柔上扬 / 轻声 | 短句 + 感叹 | "嗨大家好，我是……" |
| warm_male | 平稳低沉 | 中句 + 停顿 | "你好，欢迎来到……" |
| mature_male | 磁性沉稳 | 长句可接受 | "各位听众晚上好，我是……" |
| young_female | 活泼轻快 | 短句 + 连词 | "Hi 宝子们，我又来啦" |
| news_anchor | 标准规范 | 正式短句 | "欢迎收听……本期为您播报" |
| friend_chat | 随意自然 | 口语化 | "最近有件事，想跟你们聊聊" |

### 严禁表达

| 禁忌 | 原因 |
|------|------|
| 时政敏感擅自评论 | 合规 |
| 医疗功效保证 | 广告法 |
| 金融投资建议 | 监管 |
| 种族/地域歧视 | 社会风险 |
| 未核实信息当事实 | 新闻专业 |
| TTS 念错的专业术语不标注 | 听感问题 |
| 长句超 40 字 | TTS 单次断句错位 |
| 数字连续（1234 → 容易读错） | 用"一千两百三十四" |

## CoT 工作流程（Checklist）

```
播客口播稿生成进度：
- [ ] Step 0: 理解主题与受众
- [ ] Step 1: 规划节目结构（开头/主体/结尾时长分配）
- [ ] Step 2: 写开头（问候 + 本期预告）
- [ ] Step 3: 话题串联设计（过渡词规划）
- [ ] Step 4: 逐话题撰写主体
- [ ] Step 5: 写结尾（总结 + CTA + 下期预告）
- [ ] Step 6: 标呼吸点 + 强调词 + 语速
- [ ] Step 7: 敏感话题合规扫描
- [ ] Step 8: 口播测试（读出来）+ 量化自检
```

### Step 1: 节目结构规划

**按 format 分配时长**：

| Format | 开头 | 主体 | 结尾 | 话题密度 |
|--------|-----|------|-----|---------|
| daily_brief (3-5m) | 30s | 200-260s | 30s | 3-5 条 / 集 |
| deep_dive (10-20m) | 60s | 500-1100s | 60-120s | 1 个主话题 + 深挖 |
| weekend_chat (8-15m) | 45s | 400-800s | 60s | 2-3 个软话题 |
| series_episode | 依系列 | 依系列 | 依系列 | 按系列规划 |
| livelihood_local | 40s | 240-680s | 40-60s | 1-3 个民生议题 |

### Step 2: 写开头

**开头要素**：
1. 问候（匹配 persona）
2. 自我介绍（第一集/周期性）
3. 本期主题预告（钩子型，引期待）
4. 过渡到主体的引子

**开头模板**：

```
[开场音乐 fade in 2s，BGM 保持 20% 音量]

大家好，<break 300ms/> 我是 {host.name}。
今天是 {date}，你正在收听的是 {programName}。<break 500ms/>

今天这期，<break 300ms/> 我们要聊的是——
<emphasis>{theme}</emphasis>。<break 500ms/>

{one_sentence_hook}
<break 1000ms/>

好，我们开始吧。
```

### Step 3: 话题串联

**话题之间过渡词库**：

| 过渡场景 | 用词 |
|---------|------|
| 正常下一条 | "接下来" / "说到这个，还有一件事" / "紧接着" |
| 类似话题 | "同样是 XX" / "沿着这个思路" |
| 反差对比 | "但另一方面" / "不过呢" / "可是" |
| 时间推进 | "再说回今天早些时候" / "几天前" |
| 情绪切换 | "说一个比较轻松的" / "聊个沉重点的" |
| 收束本话题 | "关于这个，我们先说到这" / "暂且先放下" |

### Step 4: 主体撰写

**单话题结构（适用 daily_brief 中的每条）**：

```
[过渡词]（1-2s）

<topic 引入>                     <!-- 5-10s -->
  简述背景或引出

<核心事实>                        <!-- 15-30s -->
  3-5 个关键点，每点一句

<主播观点或insight>                <!-- 10-20s -->
  不是胡说，是合理引导

<与听众相关性>                     <!-- 5-10s -->
  "这个对你可能意味着……"

<收束>                           <!-- 3-5s -->
  简单一句话总结
```

### Step 5: 写结尾

**结尾要素**：
1. 本期回顾（简短 10-20s）
2. 主持人感受/情绪收束
3. CTA（订阅 / 关注 / 留言 / 分享）
4. 下期预告（引钩子）
5. 告别

**结尾模板**：

```
[BGM 稍微提升到 30% 音量]

好，今天这期就到这里。<break 500ms/>

回顾一下，我们聊了 {回顾点 1}、{回顾点 2} 和 {回顾点 3}。<break 500ms/>

不知道你听完什么感觉。<break 300ms/>
欢迎在评论区告诉我。<break 500ms/>

如果你喜欢今天这期，<break 300ms/>
记得点个订阅，<break 300ms/>
下期我们继续聊。<break 500ms/>

下期预告：<break 500ms/>
<emphasis>{next_hook}</emphasis><break 1000ms/>

我是 {host.name}，我们下期再见。<break 500ms/>

[BGM fade out 3s]
```

### Step 6: 呼吸 + 强调 + 语速标记

**呼吸规则**：
- 每 15-25 字一个 short break（300ms）
- 每段末一个 medium break（600-1000ms）
- 情绪切换处一个 long break（1000ms+）

**强调规则**：
- 数字、关键词、人名、地名 → `<emphasis>`
- 每分钟 ≤ 8 个强调（多了失效）

**语速规则**：
- 默认 1.0
- 情感段落 → 0.9（减速）
- 列举/快速过渡 → 1.1（加速）
- 严肃话题 → 0.95

### Step 7: 敏感话题合规扫描

```typescript
const sensitiveTopicsFlags = await scanSensitiveTopics(scriptText, {
  domains: ["politics", "health", "finance", "social"],
  strictness: "high",
});

// 例如：
// - 时政类：不擅自评论政策
// - 医疗类：不下诊断、不推荐药品
// - 金融类：不提供投资建议
// - 社会热点：不火上浇油
```

### Step 8: 口播测试

**读出来检查**：
- [ ] 任一句是否超 40 字不断？
- [ ] 数字读起来是否自然？（"2024 年"应为"二零二四年"或"两千零二十四年"）
- [ ] 专业术语是否有读音提示？（如"铜陵"→ 加 prosody pitch）
- [ ] 有无拗口的同音字冲突？（如"中国石化"→ 稍停顿避歧义）

## Few-shot 正例 × 2

### 正例 1：每日简报（daily_brief）

**输入**：
```json
{
  "theme": "4 月 18 日早新闻",
  "topics": [
    { "title": "深圳发布 AI 产业新政策", "importance": "high" },
    { "title": "成都川超第 7 轮开赛", "importance": "medium" },
    { "title": "本地油价下调 0.3 元", "importance": "medium" }
  ],
  "format": "daily_brief",
  "targetDurationSec": 240,
  "host": { "name": "小暖", "persona": "warm_female" }
}
```

**输出脚本**：

```markdown
## 开头（0-30s）
[开场音乐 fade in 2s]

嗨，大家早上好，<break 300ms/> 我是 <emphasis>小暖</emphasis>。

今天是 <emphasis>四月十八号</emphasis>，星期四。<break 500ms/>

新的一天又开始啦。<break 300ms/>
泡杯咖啡的时间，<break 300ms/> 跟我花 <emphasis>四分钟</emphasis>，<break 300ms/> 把今天最该知道的事，<break 300ms/> 听一遍。<break 1000ms/>

今天我们要聊 <emphasis>三件事</emphasis>——
深圳的 AI 新政策，<break 400ms/>
川超联赛的开打，<break 400ms/>
还有，<break 300ms/> 我们本地的油价又降了。<break 800ms/>

走，开始吧。

## 主体 - 话题 1（30-110s）
### 话题 1: 深圳 AI 政策

好，第一件事。<break 500ms/>

昨天，<break 300ms/> 深圳官方发布了一份关于 <emphasis>人工智能产业</emphasis> 的新政策文件。<break 500ms/>

简单说，<break 300ms/> 有三个点你可以记住。<break 500ms/>

第一，<break 300ms/> 深圳要在未来五年，<break 300ms/> 投入 <emphasis>两百亿</emphasis> 支持 AI 基础设施。<break 500ms/>

第二，<break 300ms/> 对符合条件的 AI 企业，<break 300ms/> 最高可以补贴 <emphasis>五千万</emphasis>。<break 500ms/>

第三，<break 300ms/> 深圳要建 <emphasis>三个</emphasis> 国家级的 AI 产业园。<break 800ms/>

这对我们普通人意味着什么呢？<break 600ms/>

简单说，<break 300ms/> 如果你是做 AI 相关工作的，<break 300ms/> 这是个明确的机会信号。<break 500ms/>
如果你是普通市民，<break 300ms/> 未来几年，<break 300ms/> 你可能会看到更多 AI 应用落地到生活里。<break 1000ms/>

## 主体 - 话题 2（110-170s）
### 话题 2: 川超开赛

<prosody rate="1.05">接下来</prosody>，<break 400ms/> 我们换一个轻松点的。<break 500ms/>

<emphasis>成都川超联赛</emphasis>，<break 300ms/> 第七轮，<break 300ms/> 今天晚上就要开赛了。<break 500ms/>

今晚的焦点战是——<break 500ms/>
<emphasis>成都蓉城 对 四川 FC</emphasis>。<break 800ms/>

这场是今年的 <emphasis>德比</emphasis>，<break 400ms/> 一票难求，<break 300ms/> 不到 <emphasis>六小时</emphasis> 就售完了。<break 500ms/>

如果你买到票了，<break 300ms/> 哇，<break 300ms/> 恭喜你。<break 300ms/>
如果没买到也别急，<break 300ms/> 晚上 <emphasis>七点</emphasis>，<break 300ms/> 本台直播。<break 1000ms/>

## 主体 - 话题 3（170-220s）
### 话题 3: 油价下调

<prosody rate="0.95">最后</prosody>，<break 400ms/> 说一个你每天都关心的——<break 500ms/>

<emphasis>油价</emphasis>。<break 500ms/>

根据发改委的消息，<break 300ms/> 从今天 <emphasis>凌晨零点</emphasis> 开始，<break 300ms/>
本地的 <emphasis>九五号汽油</emphasis>，<break 300ms/> 每升 <emphasis>下调三毛</emphasis>。<break 800ms/>

三毛听起来不多。<break 500ms/>
但如果你一个月加两次油，<break 300ms/> 一年下来，<break 300ms/> 也能省出一顿火锅的钱。<break 500ms/>

所以——<break 400ms/>
如果你今天不赶时间，<break 300ms/> 下班顺路加满。<break 500ms/>
就当省出的钱，<break 300ms/> 是给今天自己的小奖励。<break 1000ms/>

## 结尾（220-240s）
[BGM 提升到 30%]

好，今天就这三件事。<break 500ms/>

<emphasis>AI 新政</emphasis>、<break 300ms/> <emphasis>川超开赛</emphasis>、<break 300ms/> <emphasis>油价下调</emphasis>。<break 500ms/>

希望你今天过得好。<break 500ms/>

我是小暖，<break 400ms/> 明天早上，<break 300ms/> 我们还是这个时间，<break 300ms/> 不见不散。<break 800ms/>

[BGM fade out 3s]

## 配乐
- opening: 清晨 ambient 钢琴（8s）
- background: 温柔电台风 BGM
- transition: 轻柔 bell（话题间）
- closing: opening 回归
```

---

### 正例 2：深度话题（deep_dive）

**输入**：
```json
{
  "theme": "AI 大模型对本地媒体意味着什么",
  "format": "deep_dive",
  "targetDurationSec": 900,
  "host": { "persona": "mature_male" }
}
```

**输出要点**：
- 开头 60s 用故事开场（不直切入主题）
- 主体拆 3-4 个小章节（提出问题→拆解→举例→延伸）
- 每章节结束用"我们接着聊"串联
- 结尾 2 分钟有主播个人观点
- 语速平均 0.95（偏沉稳）

## Few-shot 反例 × 1

```markdown
## 开头
大家好，今天的内容非常丰富，我们将会为您播报多条新闻，首先第一条新闻是关于深圳市政府发布了关于人工智能产业发展的最新政策文件的相关内容……

## 主体
根据深圳市政府所发布的政策文件，该文件中指出要在未来五年内投入人民币两百亿元整用于支持人工智能基础设施建设……
```

**错误分析**：

| 问题 | 具体表现 | 违反规则 |
|------|---------|---------|
| 长句 > 40 字 | 第一句 50+ 字 | TTS 断句错 |
| 书面语 | "根据""所发布""整" | 口语化原则 |
| 无呼吸点 | 一口气到底 | 节奏规则 |
| 无情绪 | 平铺直叙 | 陪伴感缺失 |
| 代词冗余 | "该文件中""本政策" | 应用"这份""这"|
| 数字书面 | "人民币两百亿元整" | TTS 会读错节奏 |

## 场景禁忌清单

- ❌ 直接评论时政/对特定政策表态
- ❌ 医疗诊断性建议
- ❌ 金融投资具体建议
- ❌ 推荐药品/保健品
- ❌ 用 TTS 不识字的生僻字/专业符号
- ❌ 新闻未核实当事实播报
- ❌ 在助眠/晨间节目使用紧张/惊悚话题

## 质量自检清单

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 最长单句字数 | ≤ 40 |
| 2 | 平均句长 | ≤ 22 字 |
| 3 | 每分钟呼吸标记 | ≥ 8 |
| 4 | 每分钟强调 | 3-8 |
| 5 | 开头/主体/结尾时长比 | ~10% / 80% / 10% |
| 6 | 敏感话题扫描 | passed |
| 7 | 数字是否全部转汉字 | ✓ |
| 8 | 专业术语读音标注 | 专业词 ≥ 1 处时必须 ✓ |
| 9 | 话题过渡词存在 | 每话题前 ≥ 1 |
| 10 | CTA 明确 | 结尾有订阅/关注引导 |

## 典型失败模式

### 失败 1: TTS 断句错位

**表现**：TTS 合成后在错误位置停顿，听感怪
**修正**：Step 6 必须加呼吸标记；测试至少一遍

### 失败 2: 书面语痕迹

**表现**：出现"首先""其次""综上所述"
**修正**：Step 4 prompt 加"不用书面连词"；用反例对比

### 失败 3: 主播人设错位

**表现**：warm_female persona 但用了老派主播词汇
**修正**：按 persona 走对应模板

### 失败 4: 信息密度失衡

**表现**：daily_brief 4 分钟塞 10 条新闻，听众云里雾里
**修正**：Step 1 按 format 严格控制话题数

### 失败 5: 时政踩线

**表现**：对政策私自下"好/坏"定论
**修正**：仅陈述事实 + 与听众相关性，不做价值判断

## EXTEND.md 用户配置

```yaml
# .vibetide-skills/podcast_script/EXTEND.md

default_host: "小暖"
default_persona: "warm_female"
default_format: "daily_brief"
default_duration: 300

# 节目品牌
program_name: "深圳晨间 4 分钟"
program_tagline: "每天早上 7 点，你的通勤好搭档"
brand_bgm: "warm_pop_ambient"

# 呼吸与节奏
breath_density: "medium"           # low / medium / high
avg_sentence_length_target: 18     # 目标平均字数

# Persona 锁定（运营想固定某个主播调性）
persona_lock: true

# 合规
compliance_strictness: "high"
skip_politics_commentary: true

# TTS 引擎偏好（不同引擎 SSML 支持不同）
tts_engine: "azure"                # azure / xfyun / volcengine
enable_ssml: true
```

## Feature Comparison

| Feature | podcast_script | script_generate(news) | content_generate(音频文稿) |
|---------|---------------|----------------------|---------------------------|
| TTS 友好 | ✓ 核心 | ✗ | ✗ |
| 呼吸标记 | ✓ | ✗ | ✗ |
| 情绪/语速标注 | ✓ | ✗ | ✗ |
| 多主播人设 | ✓ | 单角色 | ✗ |
| BGM 规划 | ✓ | 粗 | ✗ |
| 时长 | 60-1800s | 30-600s | N/A |
| 主要输出 | 口播稿 + SSML | 视频分镜 | 阅读稿 |

## Prerequisites

- ✅ LLM（claude-opus-4-7 强推荐）
- ✅ `topics` ≥ 1
- ✅ `敏感话题处理手册` KB 已绑定
- ✅ 当日热点数据（daily_brief 使用时）

## Troubleshooting

| 问题 | 原因 | 解决 |
|------|------|------|
| TTS 合成后有明显断句错 | 未加呼吸标记 | Step 6 强制 |
| 听起来像新闻联播 | persona 未激活 | 明确 prompt 指定 persona 语气 |
| 深度话题但跳跃太快 | 信息密度太高 | format=deep_dive 时 topic 数 ≤ 1 |
| 结尾突然 | 缺 CTA/下期预告 | Step 5 硬要求 |
| 时政评论超线 | 模型自我发挥 | KB 绑定 + strictness=high |
| 数字被 TTS 读错 | 未转汉字 | Step 8 自检加正则 |

## Completion Report

```
🎧 播客口播稿生成完成！

📻 节目
   • 主题：{theme}
   • Format：{format}
   • 时长：{targetDurationSec}s（估算朗读 {estimatedReadTimeSec}s）
   • 主播：{host.name ?? "—"} ({host.persona})

📊 结构
   • 开头：{opening.durationSec}s
   • 主体：{body.length} 个话题 / {bodyTotal}s
   • 结尾：{closing.durationSec}s

📝 话题覆盖
{body.map((t, i) => `   ${i + 1}. ${t.topicTitle} (${t.durationSec}s)`).join('\n')}

✅ 质量自检
   ✓ 平均句长：{avgSentenceLength} 字
   ✓ 呼吸标记数：{breathMarkerCount}
   ✓ 强调数：{emphasisCount}
   ✓ 敏感话题扫描：{complianceCheck.sensitiveTopicsChecked}
   ✓ 数字汉字化：{allNumbersInChinese ? "✓" : "⚠️"}

🎵 BGM
   • 开场：{musicPlan.openingTheme}
   • 背景：{musicPlan.backgroundMood} (音量 {volumePercent}%)

📝 下一步
   → 推送 AIGC TTS 引擎生成音频
   → 同步 CMS 入图文稿（type=1，展示文本稿）
   → 音频 type=11 由 AIGC 平台侧入
```

## 上下游协作

### 上游
- 热点收集（trending_topics / news_aggregation）
- 每日专题（daily_content_plans）触发
- 编辑提供选题

### 下游
- `aigc_script_push`（type=podcast_audio）→ TTS 合成音频
- `cms_publish`（type=1）→ 图文稿留档（文本稿供编辑/搜索）
- 合规审核（严档）

## Changelog

| Version | Date | 变更 |
|---------|------|------|
| 1.0.0 | 2026-04-18 | 初版 |

## 参考实现文件

| 文件 | 路径 |
|------|------|
| Skill Runtime | `src/lib/agent/tools/podcast-script.ts` |
| Schema | `src/lib/aigc-video/script-schemas/podcast-audio.ts` |
| SSML 生成器 | `src/lib/tts/ssml-builder.ts` |
| 敏感话题扫描 | `src/lib/compliance/sensitive-scanner.ts` |
| KB | `knowledge-bases/podcast-cases/`, `knowledge-bases/sensitive-topics/` |
