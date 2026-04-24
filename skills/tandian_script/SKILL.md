---
name: tandian_script
displayName: 探店视频脚本生成
description: 为 APP 民生频道生成 30-300 秒本地美食/店铺探店视频脚本。输出含钩子、6 阶段探店 journey（店门外 → 环境 → 招牌菜 → 试吃反应 → 人均 → 结尾推荐）、必点菜清单、个人体验感描述、平台化 CTA。强调现场感 / 真实性 / 地域感，强制合作披露与广告法扫描。与 zhongcao_script（纯种草）、content_generate（图文探店攻略）互补。
version: 5.0.0
category: av_script

metadata:
  skill_kind: generation
  scenario_tags: [livelihood, tandian, local_life]
  compatibleEmployees: [xiaolei, xiaowen, xiaojian]
  appChannel: app_livelihood_tandian
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

# 探店视频脚本生成（tandian_script）

## 使用条件

✅ **应调用场景**：
- 本地美食店 / 咖啡店 / 火锅店 / 甜品店试吃视频
- 新店开业探店（24h / 72h 热度期）
- 本地生活频道每日 / 每周探店专题
- 商家合作探店 promo（必须标注合作）

❌ **不应调用场景**：
- 纯商品种草（走 `zhongcao_script`）
- 硬广 / 品牌宣传片（走 `content_generate` 硬广子模板）
- 图文探店攻略（走 `content_generate` type=1）
- 异地旅游美食（非本地生活范畴，建议人工判断）

**前置条件**：`shop.name / address / priceRange` 必填；`shop.signatureDishes ≥ 1`;LLM 可用;广告法扫描器可用。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shop.name | string | ✓ | 店名 |
| shop.category | string | ✗ | 川菜 / 火锅 / 日料 / 咖啡…… |
| shop.address | string | ✓ | 精确到城市+区+街道+门牌 |
| shop.city / district | string | ✗ | 用于方言 / 地标梗匹配 |
| shop.priceRange | string | ✓ | 如"人均 60-100" |
| shop.businessHours | string | ✗ | 营业时间 |
| shop.signatureDishes | string[] (1-8) | ✓ | 招牌菜（必点菜仅能从此清单选） |
| shop.atmosphere / targetCustomer | string | ✗ | 环境 / 适合人群 |
| shop.openingDate | string | ✗ | 新店标识 |
| shop.isPartnership | boolean | ✗ | 商家合作,默认 false |
| targetDurationSec | int (30-300) | ✗ | 默认 90 |
| platform | enum | ✗ | `douyin` / `xiaohongshu` / `video_channel` / `generic`,默认 `generic` |
| tone | enum | ✗ | `intimate` / `enthusiastic` / `professional`,默认 `intimate` |
| season | enum | ✗ | `spring` / `summer` / `autumn` / `winter` / `any` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| meta | object | `{scriptId, shopName, platform, tone, targetDurationSec, totalWords}` |
| hook | object | `{durationSec (≤5), visual, voiceover (≤35字), subtitle (≤25字)}` |
| journey[] | array (3-7) | 每段含 `{stage, durationSec, visual, voiceover, personalExperience?, onScreenText?}`;stage ∈ 6 个标准阶段（见 §4） |
| mustOrderList[] | array (1-6) | `{name, price, highlight, recommendLevel ∈ 强推/推荐/可尝试}`;name 只能从 `signatureDishes` 选 |
| cta | object | `{text, visualHint?}` |
| musicPlan | object | `{mood, bpmRange?, referenceStyle?}` |
| platformAdaptations | object | `{douyinCaption?, xiaohongshuCaption?, suggestedHashtags[], locationTag?}` |
| complianceCheck | object | `{passed, flaggedPhrases[]}`;含广告法 + 场景禁忌扫描结果 |
| partnershipDisclosure | string | 当 `shop.isPartnership=true` 时必选 |

完整 Zod Schema 见 [src/lib/agent/execution.ts](../../src/lib/agent/execution.ts) 内 skill IO 定义。

## 6 阶段探店 Journey（核心结构）

**标准结构**（90s 视频为基准,时长按比例缩放）：

| 阶段 | 占比 | 作用 | 典型内容 | 必带贴字 |
|------|:---:|------|---------|---------|
| 店门外 | 8% | 打卡感 / 交代位置 | 门头镜头、本地客流 | 📍地址 / 人均 |
| 环境 | 12% | 氛围营造 | 装修 / 座位 / 客流 | 氛围关键词 |
| 招牌菜展示 | 25% | 视觉冲击 | 菜品特写 + 摆盘 + 热气 | 必点 ⭐⭐⭐⭐⭐ |
| 试吃反应 | 30% | 真实感（**核心**） | 第一口反应（表情>语言）+ `personalExperience` | 真·吃·惊 / 感官词 |
| 人均价格 | 10% | 决策锚 | 账单特写 | 账单金额 |
| 结尾推荐 | 15% | 定调 | 推荐指数 + 适合人群 | 推荐：{场景/人群} |

**记忆点模板**（Step 1 必做）：

| 店型 | 切入角度 |
|------|---------|
| 老店 / 老字号 | "X 年老店的老味道" / "奶奶辈就开始吃" |
| 网红店 | "排队为什么值得？" |
| 小众店 | "藏在巷子里的宝藏" |
| 新店（openingDate 近 30 天） | "刚开业 3 天,我来尝鲜" |
| 特色菜品店 | "在成都能吃到正宗 XX" |
| 性价比店 | "人均 50 吃到扶墙出" |

**钩子公式**（≤5s,≤35 字）：悬念型 / 冲突型 / 情感型 / 反常型 / 数字型 / 场景型任选其一。

## 平台差异 & 风格语言

**人设 + 核心信念**：本地 50 万+ 粉丝的美食博主 + 本地生活频道编辑;自带烟火气、真实不装、用五感代替评分、精准到 10 元内、找得"记忆点"。> 探店不是给店家打广告,是给本地朋友**当嘴替**。真实的踩雷警告比虚假的好评更受欢迎。

**平台差异对照：**

| 维度 | douyin | xiaohongshu | video_channel | generic |
|------|--------|-------------|---------------|---------|
| 钩子节奏 | 3s 内爆点 / 大特写 | 氛围先行,轻量化 | 正片式开场 + 地点露出 | 折中 |
| 语速 / tone | 快,情绪张力 (`enthusiastic`) | 缓,贴心 (`intimate`) | 稳,偏播报 (`professional`) | 按 `tone` |
| 分段 | 6 阶段紧凑,每段 ≤15s | 4-5 阶段,环境段拉长 | 6 阶段,结尾段加长 | 6 阶段 |
| 贴字 / Hashtag | 高 / 4-6 | 中 / 6-10 | 中 / 3-5 | 按抖音 / 4 |
| 地理位置标签 | 必带（POI） | 必带 | 必带 | 建议带 |
| caption 基本型 | 🔥钩子 + 📍地址 + 💰人均 + #话题 | emoji + 必点 ⭐ + 个人感受 + 6-10 hashtag | 长 caption + 地点标签 | 基础四要素 |

**caption 模板**（抖音）：`🔥 {钩子改写} / 📍 {address} · 💰 {priceRange} · ⏰ {businessHours} / #{city}美食 #探店 #{category} #{shop.name}`;（小红书）emoji + 店名 + 一句话特色 + 地址 / 人均 / 营业 + 必点 ⭐ 列表 + 个人感受 + 6-10 hashtag。

**推荐用词**（禁"最 / 第一"极限词）：开场"绝了 / 被我找到了 / 真的神";味道"酥到掉渣 / 吸溜一下 / 辣到冒汗 / 鲜到眯眼";分量"上头 / 管够 / 盘子比脸大";价格"良心 / 贼便宜 / 性价比顶了 / 有点肉疼";推荐分级"必点 / 可以冲 / 再来 / 不推荐"。方言词（按 `shop.city`）：成都（巴适 / 硬是 / 安逸）/ 深圳（冇事 / 饮茶）/ 重庆（要得 / 雄起）/ 上海（嗲 / 灵）。

## 合规红线（强制扫描）

**复用 zhongcao_script 广告法扫描器**,在 Step 7 执行:

| 禁忌 | 规则 | 处置 |
|------|------|------|
| 极限词 | 最好吃 / 第一 / 绝对 / 100% / 世界级 | 广告法§9(3),重写 |
| 虚构菜品 | 写了 signatureDishes 之外的菜 | 诈骗风险,重写 |
| 夸大 / 虚标人均 | 实际 150 写"人均 80" | 与 `shop.priceRange` 强校验 |
| 贬低其他店 | "比隔壁 XX 强多了" | 平台扣分,删 |
| 造假客流 | "排队 2 小时"但实际空桌 | `/排队.*小时/` 命中需人工确认 |
| 医疗功效 | "养生祛湿"/"治 XX" | `/(治|疗|养生)/` 命中即 error |
| 未授权肖像 | 出现未签约的食客正脸 | 素材需模糊 / 授权 |
| **合作未披露** | `isPartnership=true` 但无 `partnershipDisclosure` | **硬拦截**,自动补标"本视频为商家合作" + `#广告` / `#品牌合作` |

命中极限词 / 医疗词 / 未披露合作 → `complianceCheck.passed=false`,LLM 重写。

## 工作流 Checklist

- [ ] Step 0: 理解 shop 本质 + 季节 + platform
- [ ] Step 1: 挖"记忆点"（按店型选切入）
- [ ] Step 2: 定位目标场景（约会 / 家庭 / 独食 / 聚餐）
- [ ] Step 3: 设计 ≤5s 钩子（6 种公式任选）
- [ ] Step 4: 编写 6 阶段 journey（时长占比 §4）
- [ ] Step 5: 选 3-5 个必点菜（名只能从 signatureDishes 取）
- [ ] Step 6: 平台化 caption + 地理位置标签（§5 差异表）
- [ ] Step 7: 合规扫描（广告法 + 合作披露 + 场景禁忌）
- [ ] Step 8: 质量量化自检（§8 阈值表）

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 钩子字数 | ≤ 35 字,≤ 5s |
| 2 | 地址完整 | 含"城市+区+街道+门牌" |
| 3 | 人均真实 | 与 `shop.priceRange` 一致 |
| 4 | 必点菜数量 | 3-5 个;名在 `signatureDishes` 内 |
| 5 | 阶段数 | 4-7 个（默认 6） |
| 6 | 试吃反应段占比 | ≥ 25% 时长 |
| 7 | 感官词密度 | 每 10s ≥ 2 个 |
| 8 | 合作披露 | `isPartnership=true` → `partnershipDisclosure` 必填 |
| 9 | 广告法扫描 | passed |
| 10 | 推荐人群 | 结尾段必写"推荐：X 人群 / Y 场景" |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|---------|
| 像念菜单 | 依次念菜名 + 价格,无个人视角 | 强制试吃反应段 ≥ 25%;`personalExperience` 必写 |
| 盲吹过度 | 所有菜"绝绝子 / 必点 / 5 星" | 推荐等级分级,必有 1 个"可尝试" |
| 地域感缺失 | 脚本放哪个城市都一样 | Step 1 记忆点 + `shop.city` 方言梗 |
| 价格虚 | 说"人均 50"但账单 200+ | Step 5 账单与 `priceRange` 强校验 |
| 缺场景 | 没告诉"适合和谁来" | 结尾段硬模板"推荐：X 人群 / Y 场景" |

## 输出模板 / 示例

```json
{
  "meta": {
    "scriptId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "shopName": "九二零成都老火锅",
    "platform": "douyin",
    "tone": "enthusiastic",
    "targetDurationSec": 90,
    "totalWords": 340
  },
  "hook": {
    "durationSec": 4,
    "visual": "一口冒着辣油红浪的牛油锅,毛肚在里面七上八下",
    "voiceover": "成都人都在排队的巷子火锅,我终于挤进来了！",
    "subtitle": "📍 成都本地老火锅"
  },
  "journey": [
    { "stage": "店门外", "durationSec": 8, "visual": "老街口招牌,门口大哥等位",
      "voiceover": "不在大街、不在商场,就藏在这条老巷子里。",
      "onScreenText": "📍 科华北路 38 号 / 人均 95-120 / 等位 30 分钟起" },
    { "stage": "试吃反应", "durationSec": 25, "visual": "夹毛肚蘸油碟送入口",
      "voiceover": "嗯——！脆！别家做不出来的脆度！",
      "personalExperience": "我真的被这个脆度惊到了",
      "onScreenText": "真·吃·惊" }
  ],
  "mustOrderList": [
    { "name": "鲜毛肚", "price": "¥38", "highlight": "七上八下,脆到惊艳", "recommendLevel": "强推" },
    { "name": "脑花", "price": "¥22", "highlight": "入口即化如奶油布丁", "recommendLevel": "强推" }
  ],
  "cta": { "text": "推荐给想吃地道老味道的朋友,值得绕路过来", "visualHint": "推荐：外地朋友 / 本地老饕 / 聚餐" },
  "musicPlan": { "mood": "energetic", "bpmRange": "110-120", "referenceStyle": "川味 hiphop" },
  "platformAdaptations": {
    "douyinCaption": "🔥 成都本地人藏得最深的老火锅！📍 武侯区科华北路 38 号 · 💰 人均 95-120\n#成都美食 #成都火锅 #探店 #本地好店",
    "suggestedHashtags": ["成都美食", "成都火锅", "探店", "本地好店", "巷子火锅"],
    "locationTag": "成都·科华北路"
  },
  "complianceCheck": { "passed": true, "flaggedPhrases": [] }
}
```

## EXTEND.md 示例

```yaml
default_city: 成都
default_platform: douyin
default_tone: intimate
default_duration: 90

# 结构控制
journey_stages_default: 6
personal_experience_required: true            # 试吃反应段必须有个人感受
must_include_price_shot: true

# 方言
use_dialect: true
dialect_density: low                          # low / medium / high

# 合规
compliance_strictness: high
require_partnership_disclosure: true
auto_append_partnership_hashtags: ["#广告", "#品牌合作"]

# 平台
auto_location_tag: true
douyin_caption_style: fast
```

## 上下游协作

- **上游**：热点 / 运营触发 → Leader 派单给 xiaowen;商家合作信息（`isPartnership`）来自 CRM;店铺基础信息由本地生活库 / 人工录入
- **下游**：`aigc_script_push` 推 AIGC 渲染视频;`cms_publish` 配套图文攻略入 CMS（type=1 探店攻略,`app_livelihood_tandian` 栏目）;`quality_review`（松档）合规检查

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 脚本没有地域感 | `shop.city` 未传 | 必填;或从 `address` 抽取 |
| 人均数字不统一 | 模型编造 | prompt 强制引用 `shop.priceRange` |
| 必点菜超出 signatureDishes 范围 | 模型联想 | prompt 加"只能从 signatureDishes 选" |
| 合作披露遗漏 | `isPartnership` 未检查 | Step 7 硬规则 + 自动补标 |
| 试吃反应段太少 | 模型偷懒 | 强制 ≥ 25% 时长;`personalExperience` 必写 |
| 与姊妹 skill 选错 | 种草走 `zhongcao_script`;图文走 `content_generate` |

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)（通用 agent 执行入口;skill 逻辑通过 prompt 驱动）
- 参考 Spec：[docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md](../../docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md) · 历史：`git log --follow skills/tandian_script/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)

