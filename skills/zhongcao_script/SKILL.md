---
name: zhongcao_script
displayName: 种草视频脚本生成
description: 为民生种草场景生成 15-60 秒竖屏短视频脚本（小红书/抖音/视频号风格）。输入商品信息或场景描述，输出含钩子、5 段式故事板、平台化 CTA 的完整脚本。严格遵守《广告法》禁用词规则。当用户提及"种草""安利""带货""好物推荐""商品视频脚本"时调用。
version: 2.0.0
category: av_script

metadata:
  skill_kind: generation
  scenario_tags: [livelihood, zhongcao]
  compatibleEmployees: [xiaowen, xiaojian]
  appChannel: app_livelihood_zhongcao
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases:
      - 种草内容案例库（推荐绑定）
      - 广告法禁用词库（必选绑定）
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    subtemplatesPath: src/lib/agent/skills/zhongcao-subtemplates.ts
    referenceSpec: docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md
---

# 种草视频脚本生成（zhongcao_script）

## 使用条件

✅ **应调用场景**：
- 本地民生频道的带货种草短视频（商品/品牌/店铺推荐）
- 运营配置的"每日种草"专题日历任务触发
- 商家合作投放（签约/贴牌型种草）
- 短视频平台（抖音/小红书/视频号）投放物料

❌ **不应调用场景**：
- 硬广/品牌 TVC（走 `style_rewrite` + 硬广风格）
- 纯测评/对比（走 `script_generate` 测评子模板）
- 新闻类视频（走 `script_generate` news 子模板）
- 探店类视频（走 `tandian_script`）
- 非商品场景的生活分享（需人工写作）

**前置条件**：`product.name` + `product.keySellingPoints ≥ 1`；LLM 可用；`广告法禁用词库` KB 已绑定；输出**简体中文**；文案风格以**小红书达人口吻**为主（姐妹/冲/回购/宝子们），可兼顾抖音直白风格。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| product | object | ✓ | `{name, category?, priceRange?, keySellingPoints[] (≥1), painPoints?, targetUser?, brandNotes?, productImages?}` |
| targetDurationSec | int (10-180) | ✗ | 默认 45 |
| platform | enum | ✗ | `xiaohongshu` / `douyin` / `video_channel` / `generic`，默认 `generic` |
| tone | enum | ✗ | `enthusiastic` / `intimate` / `professional` / `funny`，默认 `intimate` |
| referenceStyle | string | ✗ | 参考案例链接或文字描述 |
| bannedKeywords | string[] | ✗ | 业务方额外禁忌词 |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| meta | object | `{scriptId, productName, platform, tone, targetDurationSec, estimatedReadTimeSec}` |
| hook | object | `{durationSec (≤5), visual, voiceover (≤25 字), subtitle (≤20 字), emphasisWord?}` |
| storyBeats[] | array (3-6) | 每条 `{stage, durationSec, visual, voiceover, subtitle?, props?}`；stage ∈ `痛点/产品登场/使用场景/效果对比/CTA` |
| cta | object | `{text, visualHint?}` |
| musicPlan | object | `{mood, bpmRange?, referenceStyle?}` |
| platformAdaptations | object | `{xiaohongshuCaption?, douyinCaption?, suggestedHashtags[]}` |
| complianceCheck | object | `{passed, flaggedPhrases[]}`；每条 flagged `{phrase, rule, suggestion}` |

完整 Zod Schema 见 [src/lib/agent/execution.ts](../../src/lib/agent/execution.ts) 内 skill IO 定义。

## 平台分化（platform 摘要表）

4 种投放平台的跨项差异总览。**详细规范请见外置文件**。

| Platform | 钩子字数 | 语气基调 | 平均段长 | hashtag 数 | 典型 CTA |
|----------|---------|---------|---------|-----------|---------|
| `xiaohongshu` | ≤ 20 字 | 闺蜜分享，emoji 中密度 | 8-12s / 段 | 5-7 个 | "评论说肤质/场景，我给建议" |
| `douyin` | ≤ 15 字，强冲击 | 直白热情，节奏快 | 5-8s / 段 | 2-3 个（话题+挑战） | "双击点赞，下次出什么" |
| `video_channel` | ≤ 25 字，正经 | 专业客观 | 10-15s / 段 | 1-2 个（无 # 前缀） | "收藏 + 查链接" |
| `generic` | ≤ 25 字 | 中性 | 8-10s / 段 | 3-5 个 | "链接在评论区" |

**tone × 语言库（概要）：**

| tone | 句尾语气 | 情绪词示例 | 代表起手句 |
|------|---------|----------|----------|
| `enthusiastic` | 上扬感叹 | 绝了 / 太顶了 / 冲！ | "我真的不骗你们" |
| `intimate` | 温柔日常 | 爱住了 / 真的爱 | "姐妹们我跟你说" |
| `professional` | 客观克制 | 数据亮眼 / 性价比可以 | "客观讲一下" |
| `funny` | 反转跳脱 | 笑死 / 我不理解 | "你听我说" |

> 每个子模板的完整规范（每平台完整 caption 模板 / 6 种品类 × 4 平台完整文案矩阵 / 各平台分段细则 / 情绪词详细话术库 / emoji 密度表 / 下沉市场 vs 一二线表达差异）
> 见 [src/lib/agent/skills/zhongcao-subtemplates.ts](../../src/lib/agent/skills/zhongcao-subtemplates.ts)
> （当前为 stub，detailed specs 将由 follow-up issue 填充）

## 工作流 Checklist

- [ ] Step 0: 理解产品本质（美妆/家电/食品/服饰/本地服务/数码 → 对应种草角度）
- [ ] Step 1: 挖掘核心卖点 ≤ 3 个（优先可视化 / 可对比 / 有数字）
- [ ] Step 2: 定位目标读者 + 场景 + 选 `platform` × `tone` 组合
- [ ] Step 3: 设计 3 秒钩子（6 种公式择一：反常识 / 强对比 / 痛点共鸣 / 悬念 / 数字冲击 / 价格反转）
- [ ] Step 4: 编写 5 段式故事板（痛点 15% → 产品登场 15% → 使用场景 25% → 效果对比 25% → CTA 10%；开头留 5s 钩子，结尾留 3s CTA）
- [ ] Step 5: 平台化改写 + 生成 caption（详见外置子模板；按 platform 字段严格差异化，禁止合并写）
- [ ] Step 6: 广告法合规自检（详见下节红线清单，命中即替换或拦截）
- [ ] Step 7: 质量量化自检（见下节阈值表）

**卖点具象化公式示例**：

| 抽象卖点 | 具象表达 |
|---------|---------|
| 持久 | "涂完早饭到晚饭不用补" |
| 显白 | "黄皮直接变冷白皮" |
| 大容量 | "装下全家一周的饭" |
| 静音 | "宝宝睡觉旁边开着不吵" |

## 合规红线（广告法 + 种草特有）

**广告法极限词（《中华人民共和国广告法》硬红线，命中必替换）：**

| 禁用词 | 依据 | 建议替换 |
|-------|------|---------|
| 最 X（最好/最强/最佳/最低价/最优/最高） | §9 (3) | "我很爱" / "个人觉得很顶" |
| 第一、唯一、顶级、顶尖、独家 | §9 (3) | "绝了" / "目前我心中的 Top" |
| 国家级、世界级、最高级、全网最低 | §9 (3) | "大牌同款" / "这个价位真的香" |
| 100% / 百分百 / 绝对 / 永久 | §9 (3) / §9 (4) | "个人亲测很明显" |
| 治疗 / 治愈 / 根治 / 疗效（非药品） | §17 / §16 | "舒缓" / "改善感受" |
| 特供 / 专供 / 指定 | §9 (4) | "XX 合作款"（如属实） |

**合规扫描实现**：Step 6 调用 `src/lib/compliance/ad-law-scanner.ts` 的 `scanChineseBannedWords(scriptText, { scenario: "zhongcao", productCategory })`；命中优先自动替换，无法替换的入 `complianceCheck.flaggedPhrases`，关键处无法替换则 `complianceCheck.passed = false`，不交付。

**种草特有红线（软硬兼有）：**

| 类别 | 禁忌 | 说明 |
|------|------|------|
| 医疗健康 | 非药品不可说"治愈/药效"；美妆不可说"医用级"（除非械字号） | 硬红线 |
| 食品 | 不可声称"无任何添加"；不可渲染"降三高/排毒"等功能；进口食品不可虚构产地 | 硬红线 |
| 母婴 | 不可用"第一口奶/最安全"；奶粉受《母乳代用品销售管理办法》规制 | 硬红线 |
| 竞品对比 | 不可直接点名说"XX 品牌不如" | 平台规则 |
| 制造焦虑 | 不用"你再不用就 OUT 了" | 种草调性 |
| 硬广强求 | 前 10 秒不可直接喊"下单" | 种草调性 |
| 性别刻板 | 避免"女人就该/男人必须" | 价值观 |
| 虚假对比 | 对比场景必须真实可复现 | 硬红线 |

**合作披露（《互联网广告管理办法》）**：签约/贴牌型种草需显著标注"广告"或"@合作方"，不得掩饰广告身份。

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 | 未通过 |
|---|-------|-----|-------|
| 1 | 钩子字数 | ≤ 25 字 | 压缩 |
| 2 | 钩子命中 6 种公式之一 | 是 | 重写 |
| 3 | 总字数与时长匹配 | 总字数 ≈ `targetDurationSec × 3~4` | 调整 |
| 4 | 故事板段数 | 3-6 段 | 调整 |
| 5 | 单段时长占比 | 无超 30% 总时长 | 切分 |
| 6 | 卖点数量 | 2-4 个 | 精简 |
| 7 | 广告法扫描通过 | `complianceCheck.passed = true` | 必修 |
| 8 | 平台 caption 非空 | 对应 `platform` 字段有值 | 补齐 |
| 9 | CTA 可执行 | 有动词（冲/点/看/评论/收藏） | 改写 |
| 10 | 具象化比例 | ≥ 60% 段落含具象画面/数字 | 提升 |

**信息密度**：平均每 10 秒 ≥ 2 个信息点；画面转换 ≥ 1 次 / 5 秒；至少 1 个数字/对比；至少 1 处情绪反转。

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 产品介绍冗长 | 前 15 秒还没露产品，一直铺垫痛点 | 痛点段 ≤ 15% 总时长；钩子后 6 秒内让产品露面 |
| 过度营销 / 硬广化 | 全文"必买/最好/绝对"，丢了博主人设 | 每段 ≥ 1 句个人感受型（我觉得/我发现/我试了） |
| 平台错位 | 小红书视频用抖音爆款台词 | Step 5 严格按 platform 差异化改写（见外置） |
| CTA 弱 / 缺 | 结尾戛然而止 | 至少 1 个引导动作（评论/点赞/收藏/看主页） |
| 同质化 / 模板感 | 和其他种草视频高度雷同 | Step 1 产出"这个产品只有它能做到的事" |

## 输出模板 / 示例

**小红书 intimate 美妆类片段（45s）：**

```markdown
### 钩子（0-4s）
[画面] 一张泛红痘印的脸部特写
[配音] "大牌都用到敏感的姐妹，看我最后一条"
[字幕] 敏感肌救星真被我找到了

### 故事板（4-42s）
段 1 痛点（4-10s）：换季一来，大牌通通刺痛 → 字幕"大牌 ≠ 适合敏感肌"
段 2 产品登场（10-16s）：皮肤科闺蜜推的薇诺娜舒敏特护霜
段 3 使用场景（16-28s）：涂上去没感觉 + 用一周泛红肉眼可见变淡
段 4 效果对比（28-38s）：左用前 vs 右用后（坚持 7 天）
段 5 CTA（38-42s）：评论区说说你的肤质，我告诉你怎么搭

### 配乐
mood: warm_pop，bpmRange: 95-110，referenceStyle: 日系治愈轻音乐

### 小红书 caption
✨ 大牌都敏感的姐妹，这篇真心推荐
📌 换季泛红刺痛的必看  📌 用前后对比明显  📌 修护屏障真的有感
💰 128-168  📍 屈臣氏 / 京东旗舰店
#敏感肌 #舒敏特护霜 #薇诺娜 #护肤实测 #换季护肤
```

**反例（广告法翻车，禁止）**：
> "这是 **全网最低价**、**治愈**敏感肌 **最有效** 的护肤霜，**100%** 无刺激！我用了一堆大牌都没效果，试了 XX 品牌之后，我的敏感肌**彻底治愈**！姐妹们**绝对要买**，这是**世界级顶尖**的敏感肌救星！"
>
> —— 踩雷点：极限词（最低价 / 最有效 / 世界级顶尖）违反 §9(3)；绝对化（100%）违反 §9(3)；"治愈"非药品违反 §17；贬低同行（"大牌都没效果"）违反平台规则；硬广感（绝对要买）不符种草调性。

## EXTEND.md 示例

```yaml
default_brand_voice: "温柔治愈型"
default_platform: "xiaohongshu"
default_tone: "intimate"

# 运营者默认人设
default_persona:
  age: "28"
  occupation: "本地生活博主"
  style: "真实不装，爱分享"

# 业务方额外禁用词
extra_banned_keywords: ["加盟", "投资"]

# 合规严格度
compliance_strictness: high         # high / medium / low

# 平台风格参数
xiaohongshu_style:
  emoji_density: medium             # low / medium / high
  tag_count: 5
  include_pricing: true
  include_location: true

douyin_style:
  pace: fast                        # fast / medium / slow
  challenge_tag: true
```

## 上下游协作

- **上游**：热点/需求触发 → Leader 派单 → xiaowen/xiaojian 选 `zhongcao_script`；小红书/抖音爆款监控（未来）→ 模仿对标
- **下游**：`aigc_script_push`（推华栖云 AIGC 生成视频）；`cms_publish`（配套图文稿同步入 CMS type=1）；`quality_review`（松档，敏感品类严档）

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 脚本频繁命中广告法 | 模型未正确理解禁用词 / 冷启动 | 1) 增加 few-shot 反例；2) Step 6 前置 prompt "以下词坚决不用……" |
| 输出总字数远低于目标 | prompt 未限定下限 | input schema 加 `minWordCount` 提示 |
| 故事板段数偏少 | 模型偷懒 | prompt 强制"必须 5 段"并给模板 |
| 钩子太书面 | tone 没生效 | 明确示例；加"像朋友聊天"反复提示 |
| 平台 caption 雷同 | 未按平台差异化 | Step 5 分开调模型，不合并写（见外置子模板） |
| 小红书 caption 无标签 | 模型忽略 | 强制 `suggestedHashtags ≥ 5` |
| 产品信息少时输出空洞 | 输入不足 | 调用前让员工追问补全 `keySellingPoints` |
| 与姊妹 skill 选错 | 探店走 `tandian_script`；硬广走 `style_rewrite`；测评走 `script_generate` |

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)（通用 agent 执行入口；skill 逻辑通过 prompt 驱动）
- 子模板规范：[src/lib/agent/skills/zhongcao-subtemplates.ts](../../src/lib/agent/skills/zhongcao-subtemplates.ts)（stub，待 follow-up 填充）
- 合规扫描：[src/lib/compliance/ad-law-scanner.ts](../../src/lib/compliance/ad-law-scanner.ts)
- 参考 Spec：[docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md](../../docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md) · 历史：`git log --follow skills/zhongcao_script/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)

