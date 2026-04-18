---
name: tandian_script
displayName: 探店视频脚本生成
description: 为 APP 民生频道生成 30-300 秒本地美食/店铺探店视频脚本。输出含钩子、6 阶段探店 journey、必点菜/招牌服务、个人体验感描述、人均价格、平台化 CTA 的完整脚本。强调现场感、真实性、避免虚假宣传。当用户提及"探店""美食试吃""本地推荐""打卡"时调用。
version: 1.0.0
category: generation
metadata:
  scenario_tags: [livelihood, tandian, local_life]
  compatibleEmployees: [xiaolei, xiaowen, xiaojian]
  appChannel: app_livelihood
  runtime:
    type: llm_generation
    avgLatencyMs: 12000
    maxConcurrency: 5
    modelDependency: anthropic:claude-opus-4-7
  requires:
    knowledgeBases:
      - 本地美食探店案例库（推荐）
      - 广告法禁用词库（必选）
      - 城市地域信息库（推荐，提供方言/地标梗）
---

# 探店视频脚本生成（tandian_script）

## Language

**输出简体中文**；允许少量地方方言词（成都/深圳/本地）增强地域感；风格偏**本地博主的烟火气**，不用书面语。

## When to Use

✅ **应调用场景**：
- 本地美食店/咖啡店/火锅店/甜品店试吃视频
- 新店开业探店（24h / 72h 热度期）
- 本地生活频道的每日/每周探店专题
- 配合商家合作的探店 promo（需标注合作）

❌ **不应调用场景**：
- 纯商品种草（应走 `zhongcao_script`）
- 硬广/品牌宣传片（应走 `content_generate` 硬广子模板）
- 非本地场景（比如异地旅游）→ 建议人工判断
- 大众点评式测评（更偏数据，不适合短视频）

## Input Schema

```typescript
export const TandianScriptInputSchema = z.object({
  shop: z.object({
    name: z.string(),                          // 店名
    category: z.string().optional(),           // 川菜/火锅/日料/烘焙/咖啡...
    address: z.string(),                       // 地址（必须准确，会出现在视频中）
    city: z.string().optional(),               // 成都/深圳/上海...
    district: z.string().optional(),           // 武侯区/福田区
    priceRange: z.string(),                    // "人均 60-100"
    businessHours: z.string().optional(),
    signatureDishes: z.array(z.string()).min(1).max(8),
    atmosphere: z.string().optional(),          // 环境特色
    targetCustomer: z.string().optional(),      // "情侣约会""家庭聚餐""商务宴请"
    openingDate: z.string().optional(),         // 新店标识
    isPartnership: z.boolean().default(false),  // 是否为合作/广告
  }),
  targetDurationSec: z.number().int().min(30).max(300).default(90),
  platform: z.enum(["douyin", "xiaohongshu", "video_channel", "generic"]).default("generic"),
  tone: z.enum(["intimate", "enthusiastic", "professional"]).default("intimate"),
  season: z.enum(["spring", "summer", "autumn", "winter", "any"]).default("any"),
  referenceStyle: z.string().optional(),
});
```

## Output Schema

```typescript
export const TandianScriptOutputSchema = z.object({
  meta: z.object({
    scriptId: z.string().uuid(),
    shopName: z.string(),
    platform: z.string(),
    tone: z.string(),
    targetDurationSec: z.number(),
    totalWords: z.number(),
  }),
  hook: z.object({
    durationSec: z.number().max(5),
    visual: z.string(),
    voiceover: z.string(),                      // ≤ 35 字
    subtitle: z.string().max(25),
  }),
  journey: z.array(z.object({
    stage: z.enum([
      "店门外", "环境", "招牌菜展示",
      "试吃反应", "人均价格", "结尾推荐",
    ]),
    durationSec: z.number().positive(),
    visual: z.string(),
    voiceover: z.string(),
    personalExperience: z.string().optional(),  // 个人体验词（"我真的吃惊了""没想到"）
    onScreenText: z.string().optional(),        // 贴字（地址/价格/推荐指数）
  })).min(3).max(7),
  mustOrderList: z.array(z.object({
    name: z.string(),
    price: z.string(),
    highlight: z.string(),                       // 亮点
    recommendLevel: z.enum(["强推", "推荐", "可尝试"]),
  })).min(1).max(6),
  cta: z.object({
    text: z.string(),                            // 结尾 CTA
    visualHint: z.string().optional(),
  }),
  musicPlan: z.object({
    mood: z.string(),
    bpmRange: z.string().optional(),
    referenceStyle: z.string().optional(),
  }),
  platformAdaptations: z.object({
    douyinCaption: z.string().optional(),
    xiaohongshuCaption: z.string().optional(),
    suggestedHashtags: z.array(z.string()),
    locationTag: z.string().optional(),          // 平台地理位置标签
  }),
  complianceCheck: z.object({
    passed: z.boolean(),
    flaggedPhrases: z.array(z.object({
      phrase: z.string(),
      rule: z.string(),
      suggestion: z.string(),
    })),
  }),
  partnershipDisclosure: z.string().optional(),  // 合作标识（当 shop.isPartnership=true 时必选）
});
```

## 场景人设

你是一位**在成都/深圳拥有 50 万+ 粉丝的本地美食博主 + 5 年本地生活频道编辑**，你擅长：

- **自带本地人味道**：用方言词/本地梗让视频有地域归属感
- **真实不装**：踩雷就说踩雷，好吃才说好吃；拒绝盲吹
- **用五感代替评分**：不给星星，让观众看见"糖醋里的酸从哪里来"
- **精准定位人均**：一顿饭准确到 10 元内，让用户能决策
- **找到这家店的"记忆点"**：一道菜/一句话/一个动作，让观众记住它

**你的核心信念**：
> 探店不是给店家打广告，是给本地朋友**当嘴替**。用户要的不是"这家店很好"，是"我下班路过值不值得拐进去"。
> 真实的踩雷警告比虚假的好评更受欢迎。

## 目标读者画像

| 维度 | 画像 |
|------|------|
| 年龄 | 22-40 岁本地居民 |
| 职业 | 白领 / 学生 / 小情侣 / 家庭主妇 |
| 场景 | 下班路上 / 周末找吃的 / 约会前踩点 |
| 决策周期 | 短（看完视频可能当天就去） |
| 核心痛点 | 不想踩雷 / 想找性价比 / 想找特色 |
| 关注维度 | 人均 > 味道 > 环境 > 服务（按下沉市场排序） |

## 风格与语言规范

### 推荐用词

| 类别 | 用词 | 说明 |
|------|-----|------|
| 开场感叹 | 绝了 / 被我找到了 / 真的神 | 不说"最好" |
| 味道描述 | 酥到掉渣 / 吸溜一下 / 辣到冒汗 / 鲜到眯眼 | 感官+动作 |
| 分量描述 | 上头 / 管够 / 实在 / 盘子比脸大 | 可视化 |
| 价格评价 | 良心 / 贼便宜 / 性价比顶了 / 有点肉疼 | 不虚假 |
| 推荐程度 | 必点 / 可以冲 / 再来 / 不推荐 | 等级分明 |
| 地域标签 | 成都本地 / 川味地道 / 本地人才知道 | 增强归属感 |
| 场景代入 | 带对象 / 和闺蜜 / 一家人 | 具体场景 |

### 允许方言词（按城市）

| 城市 | 方言词 |
|------|-------|
| 成都 | 巴适 / 硬是 / 安逸 / 瓜兮兮 / 耍朋友 |
| 深圳 | 冇事 / 即系 / 饮茶 |
| 重庆 | 要得 / 雄起 / 老板儿 |
| 上海 | 嗲 / 灵 / 赞 |

### 严禁表达

与 `zhongcao_script` 一致（广告法禁用词），额外禁忌：

| 禁忌 | 原因 |
|------|------|
| 虚构菜品 | 观众到店找不到等同诈骗 |
| 夸大人均 | 实际 150 写 80 → 投诉 |
| 贬低其他店 | "比隔壁 XX 强多了" → 平台扣分 |
| 造假客流 | "排队 2 小时"但实际空桌 |
| 医疗功效 | "养生火锅祛湿"→ 除非持械字号 |
| 未标合作 | 商家合作必须标 `#广告` 或 `#品牌合作` |

## CoT 工作流程（Checklist）

```
探店脚本生成进度：
- [ ] Step 0: 理解店铺本质 + 季节
- [ ] Step 1: 挖"记忆点"（这家店独特在哪）
- [ ] Step 2: 定位目标场景（约会/家庭/独食/聚餐）
- [ ] Step 3: 设计 3 秒钩子
- [ ] Step 4: 编写 6 阶段 journey
- [ ] Step 5: 选 3-5 个必点菜
- [ ] Step 6: 平台化 caption + 地理标签
- [ ] Step 7: 合规扫描（广告法 + 合作标注）
- [ ] Step 8: 质量量化自检
```

### Step 1: 挖"记忆点"

**判断模板**：
| 类型 | 记忆点切入 |
|------|----------|
| 老店/老字号 | "X 年老店的老味道" / "奶奶辈就开始吃" |
| 网红店 | "排队为什么值得？" |
| 小众店 | "藏在巷子里的宝藏" |
| 新店 | "刚开业 3 天，我来尝鲜" |
| 特色菜品店 | "在成都能吃到正宗 XX" |
| 性价比店 | "人均 50 吃到扶墙出" |

### Step 3: 钩子公式（探店专用）

| 模式 | 示例 |
|------|------|
| 悬念型 | "藏在武侯区小巷里的火锅，凭什么让人排队 2 小时？" |
| 冲突型 | "我发誓，这 35 块的早茶吊打 100 块的" |
| 情感型 | "吃了一口想起了外婆" |
| 反常型 | "在深圳吃川菜？我笑你" |
| 数字型 | "人均 80，点 5 道菜" |
| 场景型 | "下雨天最适合来这家店" |

### Step 4: 6 阶段 journey 模板

**标准结构**：

| 阶段 | 占比 | 作用 | 典型内容 |
|------|------|------|---------|
| 店门外 | 8% | 打卡感 / 交代位置 | 门头镜头 + 人均贴字 |
| 环境 | 12% | 氛围营造 | 装修/座位/客流 |
| 招牌菜展示 | 25% | 视觉冲击 | 菜品特写 + 摆盘 + 热气 |
| 试吃反应 | 30% | 真实感 | 第一口反应（表情>语言） |
| 人均价格 | 10% | 决策锚 | 账单特写 + 价格贴字 |
| 结尾推荐 | 15% | 定调 | 推荐指数 + 适合人群 |

**每段配"贴字"**：
- 店门外 → "📍地址 / 人均 80"
- 招牌菜 → "必点 ⭐⭐⭐⭐⭐"
- 试吃 → "真·吃惊" 配表情
- 价格 → 账单金额贴字
- 结尾 → "推荐人群：{场景}"

### Step 5: 必点菜清单

**选 3-5 个原则**：
- **至少 1 个爆款**（大众认知度高）
- **至少 1 个特色菜**（别家没有）
- **至少 1 个性价比款**（量大便宜）
- **标注推荐等级**（强推/推荐/可尝试）
- **标真实价格**（不凑整，真实到 .5 或 .8）

### Step 6: 平台化 caption

#### 抖音 caption

```
🔥 {钩子改写}
📍 {address}
💰 人均 {priceRange}
⏰ {businessHours}

今天给 {city} 朋友推荐……

#{city}美食 #探店 #{category} #{shop.name}
📍 地理位置标签：{location}
```

#### 小红书 caption

```
{emoji} {店名}｜{特色 1 句话}

📍 地址：{address}
💰 人均：{priceRange}
⏰ 营业：{businessHours}

必点 ⭐：
{signature.map(s => `  - ${s}`)}

个人感受：
{journey.试吃反应.personalExperience}

#{city}美食探店 #{category} #本地好店 #宝藏餐厅
```

### Step 7: 合规扫描

```typescript
// 复用 zhongcao_script 的广告法扫描器
await complianceScan(script, {
  scenario: "tandian",
  extraRules: [
    { pattern: /排队.*小时/, rule: "造假客流嫌疑，若非实情需删", severity: "warning" },
    { pattern: /(治|疗|养生)/, rule: "非药品禁用疗效词", severity: "error" },
  ],
});

// 如果 shop.isPartnership=true，必须添加 partnershipDisclosure
if (input.shop.isPartnership && !output.partnershipDisclosure) {
  output.partnershipDisclosure = "本视频为商家合作";
  output.platformAdaptations.suggestedHashtags.push("#广告", "#品牌合作");
}
```

## Few-shot 正例 × 2

### 正例 1：火锅店（抖音 enthusiastic）

**输入**：
```json
{
  "shop": {
    "name": "九二零成都老火锅",
    "category": "火锅",
    "address": "成都武侯区科华北路 38 号",
    "city": "成都",
    "priceRange": "人均 95-120",
    "signatureDishes": ["牛油锅底", "鲜毛肚", "老肉片", "脑花", "冰醉虾"]
  },
  "targetDurationSec": 90,
  "platform": "douyin",
  "tone": "enthusiastic"
}
```

**输出脚本**：

```markdown
## 钩子（0-4s）
[画面] 一口冒着辣油红浪的牛油锅，毛肚在里面七上八下
[配音] "成都人都在排队的巷子火锅，我终于挤进来了！"
[字幕] 📍 成都本地老火锅

## 阶段 1: 店门外（4-12s）
[画面] 老街口，"九二零成都老火锅"招牌，门口几个本地大哥在等位
[配音] "不在大街上、不在商场里，就是藏在这条老巷子里。"
[贴字] 📍科华北路 38 号 / 人均 95-120 / 等位 30 分钟起

## 阶段 2: 环境（12-22s）
[画面] 推门进去，红漆桌椅、墙上挂满老成都照片、满屋子辣椒味
[配音] "进去第一眼——这不就是我小时候外婆家的饭馆吗？"
[贴字] 老·成·都·味·道

## 阶段 3: 招牌菜展示（22-45s）
[画面] 牛油锅底端上来，锅底在翻滚。毛肚下锅的特写，7 秒就捞。
[配音] "这个牛油，香味直接把隔壁桌的对象都勾过来了。毛肚？——七上八下，别超过 10 秒。"
[贴字] 必点 ⭐⭐⭐⭐⭐

[画面] 老肉片在锅里翻腾。
[配音] "这个老肉片，是他家 30 年的招牌。肉片要厚，不厚不够味。"

## 阶段 4: 试吃反应（45-70s）
[画面] 我夹起一片毛肚，蘸油碟，送进嘴里。
[配音] "（嘴塞满）嗯——！脆！太脆了！这个脆度真的是别家做不出来的！"
[贴字] 真·吃·惊

[画面] 特写脑花，勺挖进去。
[配音] "脑花——入口即化，像奶油布丁但带着火锅的辣香。这道必须点。"

## 阶段 5: 人均价格（70-80s）
[画面] 账单特写 ¥287（2 人）
[配音] "两个人，点了 8 道菜，287 块——成都老火锅这个价位，真的良心。"
[贴字] 💰 2 人 287 元 / 人均 143 元（含锅底）

## 阶段 6: 结尾推荐（80-88s）
[画面] 我坐在椅子上，手扶肚子，满足的表情
[配音] "推荐给带朋友来成都、想找地道老味道的你们。这家值得绕路过来。"
[贴字] 推荐：外地朋友 / 本地老饕 / 聚餐

## 抖音 caption
🔥 成都本地人藏得最深的老火锅！
📍 武侯区科华北路 38 号
💰 人均 95-120
⏰ 17:00-次日 02:00

等位 30 分钟起，但真的值！
牛油锅底香到让隔壁桌回头！

#成都美食 #成都火锅 #探店 #本地好店 #巷子火锅
📍 地理位置：成都·科华北路

## 配乐
- mood: energetic + 川音微量
- bpmRange: 110-120
- referenceStyle: 川味 hiphop
```

---

### 正例 2：咖啡店（小红书 intimate）

**输入**：
```json
{
  "shop": {
    "name": "陌上花开·咖啡",
    "category": "咖啡",
    "address": "成都锦江区三圣街 12 号",
    "priceRange": "人均 38-55",
    "signatureDishes": ["桂花美式", "四川辣椒拿铁", "自制可颂"]
  },
  "targetDurationSec": 60,
  "platform": "xiaohongshu",
  "tone": "intimate"
}
```

**输出要点**：
- 钩子用"悬念型"："成都第一家把川辣椒放进咖啡的店"
- journey 侧重"环境 + 试喝反应"，价格节奏偏轻
- caption 多用 emoji + 下午茶场景

## Few-shot 反例 × 1

```markdown
## 钩子
"全成都最好吃的火锅！世界级的味道！"

## 阶段 1
"这家火锅是最棒的。"

## 必点
"必点全部 10 道菜，100% 好吃。"
```

**错误分析**：

| 问题 | 具体 | 违反规则 |
|------|-----|---------|
| 极限词 | 最好吃 / 最棒 / 世界级 | 广告法§9(3) |
| 绝对化 | 100% 好吃 | §9(3) |
| 无具象 | "最好吃" 没给任何感官描述 | 风格规范 |
| 无价格 | 用户无决策依据 | 探店核心信息缺失 |
| 无场景代入 | 没告诉观众适合什么人 | 结构缺陷 |

## 场景禁忌清单

- ❌ 虚假等位/客流
- ❌ 夸大价格（"人均才 30"实际 80）
- ❌ 菜品不存在或已下架
- ❌ 贬低其他店家
- ❌ 医疗功效暗示
- ❌ 商家合作未披露
- ❌ 使用未授权的食客肖像

## 质量自检清单

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 钩子字数 | ≤ 35 字 |
| 2 | 地址完整 | 含"城市+区+街道+门牌" |
| 3 | 人均真实 | 与 `shop.priceRange` 一致 |
| 4 | 必点菜数量 | 3-5 个 |
| 5 | 阶段数 | 4-7 个（默认 6） |
| 6 | 试吃反应段 | ≥ 25% 时长 |
| 7 | 感官词密度 | 每 10s ≥ 2 个 |
| 8 | 合作披露（if partnership） | ✓ |
| 9 | 广告法扫描 | passed |
| 10 | 推荐人群明确 | ✓ |

## 典型失败模式

### 失败 1: 像念菜单

**表现**：依次介绍菜品名和价格，无个人视角
**修正**：Step 4 强制"试吃反应"段 ≥ 25%

### 失败 2: 盲吹过度

**表现**：所有菜都"绝绝子"、"必点"、"5 颗星"
**修正**：推荐等级分级；必有 1 个"可尝试"而非强推

### 失败 3: 地域感缺失

**表现**：脚本放哪个城市都一样
**修正**：Step 1 挖记忆点；用 `input.shop.city` 加方言梗

### 失败 4: 价格虚

**表现**：说"人均 50"但账单明显 200+
**修正**：Step 5 强制账单与 `shop.priceRange` 一致

### 失败 5: 缺场景

**表现**：没告诉观众"适合和谁来"
**修正**：结尾推荐段必须写"推荐：X 人群 / Y 场景"

## EXTEND.md 用户配置

```yaml
# .vibetide-skills/tandian_script/EXTEND.md

default_city: 成都
default_tone: intimate
default_duration: 90

# 平台偏好
preferred_platform: douyin
douyin_caption_style: fast

# 地域方言
use_dialect: true
dialect_density: low                          # low / medium / high

# 合规
compliance_strictness: high
require_partnership_disclosure: true

# 风格控制
journey_stages_default: 6
must_include_price_shot: true
personal_experience_required: true            # 试吃反应段必须有个人感受

# 地理位置标签
auto_location_tag: true
```

## Feature Comparison

| Feature | tandian_script | zhongcao_script | content_generate(探店图文) |
|---------|---------------|-----------------|---------------------------|
| 核心形态 | 视频脚本 | 视频脚本 | 图文稿 |
| 时长 | 30-300s | 10-180s | N/A |
| 核心结构 | 6 阶段 journey | 5 段故事板 | 自由段落 |
| 地址必须 | ✓ | ✗ | ✓ |
| 必点菜清单 | ✓ | ✗ | ✓ |
| 地域感 | 强 | 中 | 中 |
| 个人体验 | 必须 | 建议 | 可选 |

## Prerequisites

### 必须
- ✅ LLM（claude-opus-4-7 强推荐）
- ✅ `shop.name` / `shop.address` / `shop.priceRange` 必填
- ✅ `shop.signatureDishes` ≥ 1
- ✅ 广告法扫描器

### 推荐
- ✅ 店铺实拍图（用于视觉描述）
- ✅ 本地案例库
- ✅ 城市方言/梗字典

## Troubleshooting

| 问题 | 原因 | 解决 |
|------|------|------|
| 脚本没有地域感 | `shop.city` 未传 | 必填；或从 address 抽取 |
| 人均数字不统一 | 模型编造 | 强制引用 `shop.priceRange` |
| 必点菜超出 signatureDishes 范围 | 模型联想 | prompt 加"只能从 signatureDishes 选" |
| 合作披露遗漏 | `isPartnership` 未检查 | Step 7 硬规则 |
| 试吃反应段太少 | 模型偷懒 | 强制 ≥ 25% 时长 |

## Completion Report

```
🍽 探店视频脚本完成！

🏪 店铺
   • 名称：{shop.name}
   • 类目：{shop.category}
   • 地址：{shop.address}
   • 人均：{shop.priceRange}

🎬 脚本概览
   • 平台：{platform}
   • 时长：{targetDurationSec}s
   • 阶段数：{journey.length}
   • 必点：{mustOrderList.length} 道
   • 总字数：{totalWords}

✅ 质量自检
   ✓ 地址完整：{address}
   ✓ 人均真实：{priceRange}
   ✓ 感官词密度：{sensoryRate}/10s
   ✓ 合规：{complianceCheck.passed ? "通过" : `⚠️ ${flagged.length} 处`}
   ✓ 合作披露：{isPartnership ? (partnershipDisclosure ? "✓" : "❌必补") : "—"}

📱 平台输出
   • 抖音 caption：✓
   • 地理位置标签：{locationTag}
   • 话题：{suggestedHashtags.join("、")}

📝 下一步
   → 推送到 AIGC（aigc_script_push）
   → 或配套图文稿入 CMS（type=1 探店攻略）
```

## 上下游协作

### 上游
- 热点/运营触发 → Leader 派单给 xiaowen
- 商家合作信息（isPartnership）需来自 CRM/合作系统
- 店铺基础信息可从本地生活库拉（未来）

### 下游
- `aigc_script_push`：推 AIGC 渲染视频
- `cms_publish`：配套图文攻略入 CMS（type=1）
- `quality_review`（松档）：合规检查

## Changelog

| Version | Date | 变更 |
|---------|------|------|
| 1.0.0 | 2026-04-18 | 初版 |

## 参考实现文件

| 文件 | 路径 |
|------|------|
| Skill Runtime | `src/lib/agent/tools/tandian-script.ts` |
| Schema | `src/lib/aigc-video/script-schemas/tandian.ts` |
| 方言库 | `src/lib/local-dialect/` |
| KB | `knowledge-bases/tandian-cases/` |
