---
name: script_generate
displayName: 视频脚本生成（场景化重写版）
description: 生成视频/音频脚本的核心 skill。按 5 大视频场景分化子模板（新闻视频 / 时政解读 / 赛事解说 / 综艺看点 / 纪录片）。每个子模板有独立分镜节奏、镜头语言、配音风格。与 duanju_script（短剧分集）、zhongcao_script/tandian_script（民生专用）形成互补：script_generate 专注"非系列化、非民生专用"视频场景。替代现有简单版 script_generate。
version: 5.0.0
category: generation
metadata:
  scenario_tags: [news, politics, sports, variety, documentary]
  compatibleEmployees: [xiaowen, xiaojian]
  runtime:
    type: llm_generation
    avgLatencyMs: 18000
    maxConcurrency: 3
    modelDependency: anthropic:claude-opus-4-7
  requires:
    knowledgeBases:
      - 视频分镜案例库（推荐）
      - 镜头语言手册（推荐）
      - 场景配乐参考库（推荐）
  subtemplates:
    - news_video
    - politics_explainer
    - sports_commentary
    - variety_highlight_video
    - documentary_short
---

# 视频脚本生成（script_generate）

## Language

简体中文；配音稿口语化；分镜描述简洁专业。

## When to Use

✅ **应调用场景**：
- APP 新闻栏目的新闻视频脚本（非拆条）
- 时政深度解读视频脚本
- 川超等赛事的解说视频脚本
- 综艺看点视频脚本（委托给 `zongyi_highlight` 也可）
- 短纪录片脚本（3-15 分钟）

❌ **不应调用场景**：
- 分集短剧（走 `duanju_script`）
- 种草视频（走 `zhongcao_script`）
- 探店视频（走 `tandian_script`）
- 播客音频（走 `podcast_script`）

## Input Schema

```typescript
export const ScriptGenerateInputSchema = z.object({
  topic: z.string(),
  subtemplate: z.enum([
    "news_video",              // 新闻视频
    "politics_explainer",      // 时政解读
    "sports_commentary",       // 赛事解说
    "variety_highlight_video", // 综艺看点
    "documentary_short",       // 短纪录片
  ]),
  sourceArticle: z.object({                  // 可选：基于已有文章生成视频脚本
    title: z.string(),
    body: z.string(),
  }).optional(),
  keyPoints: z.array(z.string()).min(1),     // 关键信息点
  targetDurationSec: z.number().int().min(30).max(1200).default(180),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  style: z.enum(["serious", "casual", "energetic", "cinematic"]).default("serious"),
  narrator: z.enum(["anchor", "documentary_voice", "casual_host", "field_reporter"]).default("anchor"),
  mustIncludeShots: z.array(z.string()).optional(),   // 必须出现的画面
  customInstructions: z.string().optional(),
});
```

## Output Schema

```typescript
export const ScriptGenerateOutputSchema = z.object({
  meta: z.object({
    scriptId: z.string().uuid(),
    subtemplate: z.string(),
    aspectRatio: z.string(),
    targetDurationSec: z.number(),
    totalWords: z.number(),
    shotCount: z.number(),
  }),
  hook: z.object({
    durationSec: z.number().max(10),
    visual: z.string(),
    voiceover: z.string(),
    subtitle: z.string().optional(),
  }),
  shotList: z.array(z.object({
    sequence: z.number().int().positive(),
    timecodeStart: z.string(),                // "MM:SS"
    durationSec: z.number().positive(),
    sceneDescription: z.string(),
    shotType: z.enum([
      "wide", "medium", "close_up",
      "over_shoulder", "pov", "establishing",
      "aerial", "tracking", "animated",
    ]).optional(),
    voiceover: z.string().optional(),
    subtitle: z.string().optional(),
    onScreenText: z.string().optional(),
    transitionTo: z.string().optional(),
    materialHints: z.array(z.string()).optional(),
    specialEffects: z.string().optional(),
  })).min(3),
  musicPlan: z.array(z.object({
    segment: z.string(),
    timecodeRange: z.string(),
    mood: z.string(),
    volumePercent: z.number().int().min(0).max(100),
  })),
  materialRequirements: z.array(z.object({
    description: z.string(),
    type: z.enum(["footage", "photo", "graphic", "animation", "voiceover", "interview"]),
    duration: z.string().optional(),
    priority: z.enum(["must", "should", "nice"]),
  })),
  productionNotes: z.array(z.string()),       // 制作提醒
  factsToVerify: z.array(z.string()),         // 事实核查项
  complianceCheck: z.object({
    passed: z.boolean(),
    reviewTier: z.enum(["strict", "relaxed"]),
    flaggedIssues: z.array(z.any()),
  }),
});
```

## Pre-flight Check

- `subtemplate` 匹配对应身份 + KB
- 时政类必须严格合规扫描
- 赛事类必须数据源可查

## Workflow Checklist

```
视频脚本生成：
- [ ] Step 0: 加载子模板风格指南 + 镜头语言手册
- [ ] Step 1: 拆解 topic + keyPoints 为叙事弧
- [ ] Step 2: 设计 hook（按子模板）
- [ ] Step 3: 分镜编排（起承转合）
- [ ] Step 4: 写配音稿 + 字幕 + 贴字
- [ ] Step 5: 配乐规划
- [ ] Step 6: 素材需求清单
- [ ] Step 7: 质量自检（按阈值）
- [ ] Step 8: 合规扫描
```

## 5 个子模板详细规范

### 子模板 1: news_video（新闻视频）

**身份锚定**：新华社视频部资深编导，擅长 3 分钟讲清楚一件事。

**分镜节奏**：
- 开场 Hook：5-10s（事件现场/关键画面/冲击画面）
- 主体（5W1H）：60-70% 时长
- 专家/当事人采访：15-20% 时长
- 背景/数据可视化：10-15% 时长
- 结尾（意义/展望）：5-10% 时长

**镜头语言**：
- 现场画面 + 人物采访 + 数据动态图
- 避免过多 B-roll 空镜
- 关键数字必有**数字动画贴字**

**配音风格**：
- 主播体（anchor），语速 1.0
- 客观第三人称
- 避免感叹

**正例（片段）**：
```markdown
## 新闻视频：深圳发布 AI 产业 200 亿新政
时长：3 分钟 | 比例：16:9 | Style：serious

### Hook（0-8s）
[镜头] 无人机航拍深圳湾夜景，镜头缓推到市民中心大楼
[配音] "4 月 17 日，深圳推出又一项重磅产业政策。"
[贴字] 📍 深圳市民中心

### 分镜表

| 镜 | 时间 | 画面 | 配音 | 时长 | 转场 | 备注 |
|----|------|------|------|------|------|------|
| 01 | 00:08 | 新闻发布会现场，官员宣读政策 | "当天上午，深圳市政府发布《促进人工智能产业高质量发展若干措施》。" | 8s | cut | 现场声保留 10% |
| 02 | 00:16 | 政策文件特写，镜头扫过关键数字 | "5 年投入 200 亿元，支持三大方向。" | 6s | 数字放大 | 动画强化 |
| 03 | 00:22 | 信息图：三大方向（基础设施 / 企业扶持 / 人才引进） | "一是建设三个国家级 AI 产业园……" | 12s | 翻页 | 信息图需预制 |
| 04 | 00:34 | 深圳 AI 企业办公环境 | "二是对符合条件的企业给予最高 5000 万元补贴。" | 10s | 淡入 | 可用合作企业素材 |
| 05 | 00:44 | 专家采访 | [专家]"这项政策力度是近年最大的一次" | 15s | cut | 需提前录制 |
| 06 | 00:59 | 深圳 AI 产业发展数据图（3 年 30% 年增长） | "深圳 AI 产业产值已连续三年保持 30% 以上增长。" | 12s | 动态图表 | 数据可视化 |
| 07 | 01:11 | 园区规划效果图 | "三个国家级 AI 产业园已确定选址。" | 10s | 3D 动画 | 合作设计 |
| ... | ... | ... | ... | ... | ... | ... |
| 18 | 02:50 | 航拍回归深圳湾 | "深圳，正在用 AI 书写新的产业故事。" | 10s | fade out | 品牌结尾 |

### 配乐
- 00:00-00:10：科技感开场音乐
- 00:10-02:40：轻快新闻 BGM（40%）
- 02:40-03:00：情感收尾

### 素材需求
- [ ] must: 新闻发布会现场画面（来自台内素材库）
- [ ] must: 政策文件特写
- [ ] must: 专家采访（需联系录制）
- [ ] should: 深圳 AI 企业办公画面
- [ ] should: 航拍深圳湾
- [ ] nice: 3D 产业园效果图
```

---

### 子模板 2: politics_explainer（时政解读）

**身份锚定**：时政深度视频团队总导演，曾为央视政论节目撰稿。

**分镜节奏**：
- 开场：**政策背景 + 问题提出** 15%
- 政策梳理：**原文引用 + 要点拆解** 35%
- 深度解读：**专家/学者观点** 30%
- 实践/影响：**具体案例** 15%
- 收尾：**意义升华** 5%

**镜头语言**：
- 庄重感：稳定镜头、低机位少
- 多用数据动效、政策条文贴字
- 主持人/专家占镜头显著位置

**配音风格**：
- 权威感（news_anchor + documentary_voice）
- 语速 0.95
- 严谨用词（不感叹、不夸张）

**严格禁忌**：
- 视觉上不能出现与政策无关的娱乐元素
- 不能自己总结"这很好""力度不够"
- 所有数字/引用必有来源

**质量阈值**：审核档位 **严**

---

### 子模板 3: sports_commentary（赛事解说）

**身份锚定**：川超专属解说，熟悉所有队伍战术、球员、历史。

**分镜节奏**：
- Hook：**绝杀瞬间 / 关键画面** 5-10s
- 赛前：**双方状态 / 历史 / 看点** 20%
- 上半场：**重点镜头 + 数据** 25%
- 下半场：**关键进攻 + 战术解读** 30%
- 赛后：**数据总结 + 球星访谈** 15%

**镜头语言**：
- 高速度：每 3-5s 切镜
- 慢动作回放关键时刻
- 数据飞入动画
- 现场球迷镜头点缀

**配音风格**：
- 情绪拉满（energetic）
- 解说节奏：**平 → 快 → 爆 → 缓**
- 允许感叹（"进啦！""太精彩了！"）

**必备元素**：
- 比分与时间戳
- 关键球员数据贴字
- 战术关键点的分析
- 现场氛围音保留

**质量阈值**：审核档位 **松**

---

### 子模板 4: variety_highlight_video（综艺看点视频）

**身份锚定**：综艺剪辑师，经验丰富，熟悉 3 秒钩子。

**分镜节奏**：
- Hook：**金句/高光 3-5s**
- 盘点段：**Top N 结构**（每段 15-25s）
- 收尾：**CTA + 下期预告 5s**

**镜头语言**：
- 快切（1-3s 一个镜头）
- 大量贴字（榜单号码、金句、艺人名）
- 搭配现场观众笑声/欢呼
- 梗图穿插（谨慎）

**配音风格**：
- casual_host 或 field_reporter
- 情绪丰富，有"解说感"

**委托**：可内部调用 `zongyi_highlight` 的 videoScript 部分，此子模板做"格式规范化包装"。

**质量阈值**：松，艺人名 100% 核查。

---

### 子模板 5: documentary_short（短纪录片）

**身份锚定**：纪录片导演，擅长 5-15 分钟人文/社会纪录片。

**分镜节奏**：
- 开场：**人物出场 / 场景建立** 10%
- 故事铺陈：**起承** 30%
- 冲突/矛盾：**转** 30%
- 反思/升华：**合** 20%
- 收尾：**情绪收束** 10%

**镜头语言**：
- 慢节奏（5-10s 一镜）
- 大量空镜、特写、情绪镜头
- 人物采访与 B-roll 穿插

**配音风格**：
- documentary_voice（低沉磁性）
- 语速 0.85-0.95
- 诗意化、感性

**质量阈值**：不限，按内容定档位（民生类松，涉政严）。

---

## 质量自检清单

### 通用

| # | 检查点 | 阈值 |
|---|-------|-----|
| G1 | 分镜数量 | news: 15-25 / politics: 20-35 / sports: 30-50 / variety: 20-30 / doc: 按时长 |
| G2 | 每镜时长 | 最短 3s（避免过碎） / 最长 25s（避免拖沓） |
| G3 | hook 时长 | ≤ 10s |
| G4 | 字幕覆盖率 | ≥ 95%（静音观看适配） |
| G5 | 转场多样性 | 至少 3 种不同转场方式 |
| G6 | 配音字数与时长匹配 | 字数 × 0.25s ≈ 配音时长 ±10% |
| G7 | 关键数字有贴字 | 100% |
| G8 | 事实核查项标注 | 有数据 → 必有 source 或 `factsToVerify` |

### 子模板扩展

- 新闻：5W1H 覆盖 ≥ 90%
- 时政：原文引用数 ≥ 3
- 赛事：比分/数据准确 100%
- 综艺：艺人名 100%
- 纪录片：情感起伏设计 ≥ 1 个高点 + 1 个低点

## 典型失败模式

### 失败 1: 子模板错配

**表现**：时政用了 sports_commentary 的情绪感
**修正**：Step 0 强制加载对应风格指南

### 失败 2: 分镜数过少

**表现**：3 分钟视频只有 5 镜
**修正**：按子模板最低分镜数校验

### 失败 3: 无字幕

**表现**：只有配音，没贴字
**修正**：Step 4 字幕必填

### 失败 4: 配音与时长不匹配

**表现**：3 分钟视频配音稿 2000 字（塞不下）
**修正**：Step 4 按 4 字/秒估算

## EXTEND.md 用户配置

```yaml
default_subtemplate: news_video
default_aspect_ratio: 16:9
default_style: serious

subtemplate_configs:
  news_video:
    shot_count_range: [15, 25]
    must_have_expert_interview: true

  politics_explainer:
    strictness: maximum
    quote_count_min: 3

  sports_commentary:
    allow_emotional_voiceover: true
    data_animation_required: true

subtitle_coverage_min: 0.95
auto_add_brand_intro: true
brand_intro_duration_sec: 3
```

## Feature Comparison

| Feature | script_generate v5 | duanju_script | zhongcao_script | tandian_script |
|---------|---------------------|----------------|-----------------|-----------------|
| 定位 | 非系列化视频 | 分集短剧 | 种草 | 探店 |
| 子模板数 | 5 | 2 mode × 6 类型 | 1 | 1 |
| 时长 | 30-1200s | 60-1200s | 10-180s | 30-300s |
| IP 管理 | ✗ | ✓ | ✗ | ✗ |
| 合规档位 | 按子模板 | 严（广电） | 严（广告法） | 中 |

## Prerequisites

- ✅ LLM
- ✅ `topic` + `keyPoints` ≥ 1
- ✅ 子模板对应 KB 已绑定

## Troubleshooting

| 问题 | 解决 |
|------|------|
| 分镜数不足 | 按子模板阈值重新生成 |
| 时政脚本含私人评论 | strictness=maximum |
| 赛事解说"无感"无情绪 | narrator=field_reporter + energetic style |
| 配音稿与镜头脱节 | 分镜逐镜写对应配音 |

## Completion Report

```
🎞 视频脚本生成完成！

📺 基础
   • 子模板：{subtemplate}
   • 比例：{aspectRatio}
   • 时长：{targetDurationSec}s
   • 分镜：{shotCount}

🪝 Hook（{hookDur}s）
   {hook.voiceover}

✅ 自检
   ✓ 分镜数符合范围
   ✓ 字幕覆盖率：{subtitleCoverage}%
   ✓ 事实核查项：{factsToVerify.length}
   ✓ 合规：{complianceCheck.passed}

🎬 素材需求
   • must: {mustCount}
   • should: {shouldCount}
   • nice: {niceCount}

📝 下一步
   → `aigc_script_push` 推送
   → 或导出 PDF 分镜表给拍摄团队
```

## 上下游协作

### 上游
- `content_generate`：基于已有图文稿产出视频版
- 选题/热点触发
- 素材研究员（xiaozi）提供参考

### 下游
- `aigc_script_push`：推送 AIGC
- `cms_publish`：图文脚本档案
- 人工拍摄（导出分镜表）

## Changelog

| Version | Date | 变更 |
|---------|------|------|
| 5.0.0 | 2026-04-18 | 重写：5 场景子模板，与 duanju_script/zhongcao_script/tandian_script/podcast_script 分工 |

## 参考实现文件

| 文件 | 路径 |
|------|------|
| Skill Runtime | `src/lib/agent/tools/script-generate.ts` |
| 子模板注册 | `src/lib/agent/subtemplates/script/` |
