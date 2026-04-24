---
name: podcast_script
displayName: 播客口播稿生成
description: 为 APP 民生播客频道生成 TTS 友好的口播稿，适配"每日热点播客""本地民生播客"等场景。输出含开头/主体/结尾三段式结构、口语化节奏、呼吸标记、情绪提示、语速调控、BGM 建议的完整播客脚本（输出到 type=1 CMS 图文稿 + 推送 AIGC 生成音频）。当用户提及"播客""口播稿""音频节目""电台"时调用。
version: 2.0.0
category: av_script

metadata:
  skill_kind: generation
  scenario_tags: [livelihood, podcast, daily_brief]
  compatibleEmployees: [xiaowen, xiaoshen]
  appChannel: app_livelihood_podcast
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases:
      - 播客口播案例库（推荐）
      - 敏感话题处理手册（必选）
      - 当日热点新闻库（动态）
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    subtemplatesPath: src/lib/agent/skills/podcast-subtemplates.ts
    referenceSpec: docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md
---

# 播客口播稿生成（podcast_script）

## 使用条件

✅ **应调用场景**：
- 每日热点新闻播客（3-10 分钟）
- 本地民生话题深度播客（5-20 分钟）
- 系列主题播客（如"每周科技观察"）
- 周末播客节目（轻松型）
- 需要 TTS 生成音频的口播文本

❌ **不应调用场景**：
- 多人对谈（走 `script_generate` interview 子模板）
- 音乐/纯声音节目
- 广告朗读稿（走 `style_rewrite`）
- 需嘉宾现场的实况录制

**前置条件**：`theme` + `topics ≥ 1`；LLM 可用；`敏感话题处理手册` KB 已绑定；输出简体中文；风格**口语化、有陪伴感**，允许适度地方词增强亲近感。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| theme | string | ✓ | 本期主题 |
| topics[] | `{title, summary?, source?, importance}` | ✓ (≥1) | 要覆盖的话题；importance ∈ `high/medium/low` |
| format | enum | ✗ | `daily_brief` / `deep_dive` / `weekend_chat` / `series_episode` / `livelihood_local`，默认 `daily_brief` |
| targetDurationSec | int (60-1800) | ✗ | 默认 300 |
| host | `{name?, persona, catchphrase?}` | ✗ | persona ∈ `warm_female/warm_male/mature_male/young_female/news_anchor/friend_chat`，默认 `warm_female` |
| tone | enum | ✗ | `serious/warm/casual/energetic`，默认 `warm` |
| seriesContext | `{seriesName, episodeNum, previousTeaser?}` | ✗ | 系列背景 |
| bgmMood | string | ✗ | BGM 风格偏好 |
| specialInstructions | string | ✗ | 额外指令 |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| meta | object | `{scriptId, theme, format, targetDurationSec, estimatedReadTimeSec, totalWords}` |
| opening | object | `{durationSec, text, breathMarkers[], emphasizedWords[], speedMultiplier, emotionCue?}` |
| body[] | array (≥1) | 每条 `{topicIndex, topicTitle, durationSec, segments[]}`；segment.role ∈ `transition/narrative/quote/insight/listener_hook` |
| closing | object | `{durationSec, text, breathMarkers[], ctaText?}` |
| musicPlan | object | `{openingTheme?, backgroundMood, volumePercent (0-50), fadeInSec, fadeOutSec, transitionSfx?}` |
| ssmlPreview | string? | 可选 SSML 预览（Azure/科大讯飞/火山引擎支持） |
| complianceCheck | object | `{passed, flaggedPhrases[], sensitiveTopicsChecked}` |

完整 Zod Schema 见 [src/lib/agent/execution.ts](../../src/lib/agent/execution.ts) 内 skill IO 定义。

## 子模板分化（format 摘要表）

5 种 format 子类型的跨项差异总览。**详细规范请见外置文件**。

| Format | 触发条件 / 最佳场景 | 核心特征（时长 / 话题密度 / 节奏） |
|--------|-------------------|---------------------------------|
| `daily_brief` | 每日早 / 晚快速简报 | 3-5 min；3-5 条 / 集；节奏紧凑，每条 40-80s；开头 30s + 结尾 30s |
| `deep_dive` | 单议题深度播客 | 10-20 min；1 个主话题 + 多维拆解；节奏舒缓，主播观点占比高，故事开场 |
| `weekend_chat` | 周末轻松聊天 | 8-15 min；2-3 个软话题；聊天感强，允许跑题 / 玩梗，BGM 偏轻松 |
| `series_episode` | 系列节目单集 | 依系列标准；需 `seriesContext` 保证衔接；开头 / 结尾带系列预告钩子 |
| `livelihood_local` | 本地民生议题 | 4-12 min；1-3 个民生话题；地域感强，allow 方言词，强调"与你有关" |

**persona 语言差异（概要）：**

| persona | 句尾语气 | 句式偏好 | 代表起手句 |
|---------|---------|---------|----------|
| `warm_female` | 温柔上扬 / 轻声 | 短句 + 感叹 | "嗨大家好，我是……" |
| `warm_male` | 平稳低沉 | 中句 + 停顿 | "你好，欢迎来到……" |
| `mature_male` | 磁性沉稳 | 长句可接受 | "各位听众晚上好，我是……" |
| `young_female` | 活泼轻快 | 短句 + 连词 | "Hi 宝子们，我又来啦" |
| `news_anchor` | 标准规范 | 正式短句 | "欢迎收听……本期为您播报" |
| `friend_chat` | 随意自然 | 口语化 | "最近有件事，想跟你们聊聊" |

> 每个子模板的完整规范（开场白模板 / 话题串联过渡词库 / 音效音量阈值 / 分段时长分配 / 嘉宾问答节奏 / persona 详细语言模板 / 每分钟呼吸密度差异）
> 见 [src/lib/agent/skills/podcast-subtemplates.ts](../../src/lib/agent/skills/podcast-subtemplates.ts)
> （当前为 stub，detailed specs 将由 follow-up issue 填充）

## 工作流 Checklist

- [ ] Step 0: 理解主题 + 受众（通勤 / 做饭 / 睡前 / 碎片时间）+ format
- [ ] Step 1: 按 format 规划节目结构（开头/主体/结尾时长比 ~10%/80%/10%）
- [ ] Step 2: 写开头（问候 + 本期预告钩子，匹配 `host.persona`）
- [ ] Step 3: 话题串联设计（过渡词规划，详见外置子模板）
- [ ] Step 4: 逐话题撰写主体（单话题五段式：过渡 → 背景 → 核心事实 → insight → 与你相关）
- [ ] Step 5: 写结尾（回顾 + 情绪收束 + CTA + 下期预告钩子）
- [ ] Step 6: 标呼吸点 / 强调词 / 语速（每 15-25 字一个 short break 300ms；段末 medium 600ms；情绪切换 long 1000ms+）
- [ ] Step 7: 敏感话题合规扫描（政治 / 医疗 / 金融 / 社会热点四类）
- [ ] Step 8: 口播测试（数字转汉字 / 专业术语读音 / 同音字冲突）+ 量化自检

**SSML / 节奏标记速查：**

| 标记 | 用途 |
|------|------|
| `<break time="300ms"/>` | 短停（句内） |
| `<break time="600ms"/>` | 中停（段末） |
| `<break time="1000ms"/>` | 段落停 / 情绪切换 |
| `<emphasis level="strong">` | 强调关键词 / 数字 / 人名 / 地名 |
| `<prosody rate="0.9"/1.1">` | 减速 / 加速（情感段 0.9，快速过渡 1.1，严肃话题 0.95） |
| `<prosody pitch="+5%">` | 升调（可用于疑问语气 / 专业术语读音提示） |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 最长单句字数 | ≤ 40（避免 TTS 断句错位） |
| 2 | 平均句长 | ≤ 22 字 |
| 3 | 每分钟呼吸标记 | ≥ 8（`<break>` 数量） |
| 4 | 每分钟强调 | 3-8（`<emphasis>`，多了失效） |
| 5 | 开头/主体/结尾时长比 | ~10% / 80% / 10% |
| 6 | 数字全部转汉字 | 100%（如"二零二六年"，非"2026 年"） |
| 7 | 专业术语读音标注 | 专业词 ≥ 1 处时必须 ✓ |
| 8 | 话题过渡词存在 | 每话题前 ≥ 1（串联词库见外置） |
| 9 | CTA 明确 | 结尾有订阅/关注/下期预告 |
| 10 | 敏感话题扫描 | passed + `sensitiveTopicsChecked=true` |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| TTS 断句错位 | 合成后在错位置停顿 | Step 6 强制加呼吸标记；阈值#1-3 硬卡 |
| 书面语痕迹 | 出现"首先""其次""综上所述" | Step 4 prompt 加"不用书面连词"；用反例对比 |
| 主播人设错位 | `warm_female` 却用老派主播词汇 | 按 persona 加载对应模板（见外置子模板） |
| 信息密度失衡 | `daily_brief` 4 min 塞 10 条 | Step 1 按 format 严格控话题数（见摘要表） |
| 时政踩线 | 私自下"好/坏"定论 | Step 7 严档扫描 + KB 绑定；只陈述事实 + 相关性 |

**严禁表达（硬红线）**：时政敏感擅自评论；医疗功效保证；金融投资建议；种族/地域歧视；未核实信息当事实播报；长句超 40 字；数字连续（`1234` 容易读错，改"一千两百三十四"）。

**敏感话题扫描维度（Step 7 四档）：**

| 领域 | 扫描规则 | 处置 |
|------|---------|------|
| 政治 / 时政 | 不擅自评论政策；对领导人 / 政府部门仅陈述事实 | 命中即 `flaggedPhrases` + 重写；`strictness=high` 时硬拦截 |
| 医疗 / 健康 | 不下诊断、不推荐药品、不说"治疗""治愈" | `/(治|疗|诊断|推荐.*药)/` 命中即 error |
| 金融 / 投资 | 不给具体投资建议、不推荐产品、不暗示收益 | `/(买入|卖出|推荐.*基金|保证.*收益)/` 命中即重写 |
| 社会 / 热点 | 不火上浇油、不引战、不贬低群体 | 助眠 / 晨间节目额外过滤"紧张 / 惊悚"关键词 |

## 输出模板 / 示例

**daily_brief 片段（240s，3 话题）：**

```markdown
### 开头（0-30s）
[开场音乐 fade in 2s]

嗨，大家早上好，<break 300ms/> 我是 <emphasis>小暖</emphasis>。
今天是 <emphasis>四月十八号</emphasis>，星期四。<break 500ms/>

泡杯咖啡的时间，<break 300ms/> 跟我花 <emphasis>四分钟</emphasis>，<break 300ms/> 把今天最该知道的事，<break 300ms/> 听一遍。<break 1000ms/>

今天我们要聊 <emphasis>三件事</emphasis>——
深圳的 AI 新政策，<break 400ms/> 川超联赛的开打，<break 400ms/> 还有本地油价又降了。<break 800ms/>

走，开始吧。

### 主体 / 话题 1（30-110s）
好，第一件事。<break 500ms/>

昨天，<break 300ms/> 深圳官方发布了一份关于 <emphasis>人工智能产业</emphasis> 的新政策文件。<break 500ms/>
简单说，<break 300ms/> 有三个点你可以记住。<break 500ms/>

第一，<break 300ms/> 未来五年，<break 300ms/> 投入 <emphasis>两百亿</emphasis> 支持 AI 基础设施。<break 500ms/>
...

### 结尾（220-240s）
[BGM 提升到 30%]

好，今天就这三件事。<break 500ms/>
<emphasis>AI 新政</emphasis>、<emphasis>川超开赛</emphasis>、<emphasis>油价下调</emphasis>。<break 500ms/>

我是小暖，<break 400ms/> 明天早上，<break 300ms/> 我们还是这个时间，<break 300ms/> 不见不散。<break 800ms/>

[BGM fade out 3s]
```

**反例（禁止）**：`"大家好，今天的内容非常丰富，我们将会为您播报多条新闻，首先第一条新闻是关于深圳市政府发布了关于人工智能产业发展的最新政策文件的相关内容……"` —— 长句 > 40 字、书面语（"根据""所发布"）、无呼吸点、代词冗余、数字书面（"人民币两百亿元整"）全踩雷。

## EXTEND.md 示例

```yaml
default_host: "小暖"
default_persona: warm_female
default_format: daily_brief
default_duration: 300

# 节目品牌
program_name: "深圳晨间 4 分钟"
brand_bgm: "warm_pop_ambient"

# 呼吸与节奏
breath_density: medium                   # low / medium / high
avg_sentence_length_target: 18

# Persona 锁定（运营想固定主播调性）
persona_lock: true

# 合规
compliance_strictness: high
skip_politics_commentary: true

# TTS 引擎偏好（SSML 支持差异见外置子模板）
tts_engine: azure                        # azure / xfyun / volcengine
enable_ssml: true
```

## 上下游协作

- **上游**：热点收集（`trending_topics` / `news_aggregation`）；每日专题（`daily_content_plans`）触发；编辑手动派单
- **下游**：`aigc_script_push`（type=podcast_audio）→ TTS 合成音频；`cms_publish`（type=1）→ 文本稿留档供编辑/搜索；`quality_review`（严档，敏感话题复核）

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| TTS 合成后有明显断句错 | 未加呼吸标记 | Step 6 强制；阈值#1 最长句 ≤ 40 字 |
| 听起来像新闻联播 | persona 未激活 | prompt 指定 `host.persona`，加载对应语言模板（见外置） |
| 深度话题跳跃太快 | 信息密度过高 | `format=deep_dive` 时话题数 ≤ 1；摘要表密度列 |
| 结尾突然 | 缺 CTA / 下期预告 | Step 5 硬要求，阈值#9 |
| 时政评论超线 | 模型自我发挥 | KB 绑定 + `compliance_strictness=high`；Step 7 |
| 数字被 TTS 读错 | 未转汉字 | Step 8 自检正则；阈值#6 |
| 与姊妹 skill 选错 | 多人对谈走 `script_generate`；朗读广告走 `style_rewrite` |

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)（通用 agent 执行入口；skill 逻辑通过 prompt 驱动）
- 子模板规范：[src/lib/agent/skills/podcast-subtemplates.ts](../../src/lib/agent/skills/podcast-subtemplates.ts)（stub，待 follow-up 填充）
- 参考 Spec：[docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md](../../docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md) · 历史：`git log --follow skills/podcast_script/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)

