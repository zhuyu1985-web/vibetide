---
name: thumbnail_generate
displayName: 封面生成
description: 为图文 / 视频 / 专题生成封面设计方案（方案级，含 AI 出图 prompt），不是做出图直出。输出 3-5 套封面设计方案，每套含视觉结构（大字主标 / 配图布局 / 装饰元素）、色彩搭配（主 / 辅 / 强调）、字体建议、AI 出图 prompt（可直接喂 Midjourney / DALL-E / 通义 / 文心）、点击率预估、风险提示。按目标平台分化尺寸（微信公众号 900×500 / 小红书 1080×1440 / 抖音 720×1280 / 视频号 16:9 / CMS 16:9），一稿多尺寸自动适配（主视觉不变 / 文字重排）。当用户提及"封面""配图""Thumbnail""海报""主视觉""首图""封面方案"等关键词时调用；不用于完整排版或正文生成。
version: "1.6"
category: content_gen

metadata:
  skill_kind: generation
  scenario_tags: [thumbnail, cover, visual, poster]
  compatibleEmployees: [xiaojian, xiaowen]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 封面生成（thumbnail_generate）

你是封面设计师，职责是为稿件 / 视频生成"一眼抓人 + 契合调性 + 多平台适配"的封面方案。核心信条：**主视觉一眼看懂 > 花哨堆砌**——滑手机 1.5s 内抓不住，再精致也白搭。

## 使用条件

✅ **应调用场景**：
- 正文定稿后，需要多版本封面候选
- 多平台分发，每平台独立尺寸
- 视频 / 播客 / 专题的主视觉方案
- A/B 测试不同封面点击率
- 海报 / 活动图快速出方案

❌ **不应调用场景**：
- 要完整正文排版 → `layout_design`
- 直接要出图文件（本技能出方案 + prompt，不出图）
- 只要找素材 → `media_search`
- 视频分镜 → `video_edit_plan`

**前置条件**：`title` 非空；`platform` 建议明确（否则默认生成通用 16:9 + 多尺寸适配）；如有品牌色与字体库最好。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | ✓ | 内容标题 |
| content | string | ✗ | 内容摘要（用于主视觉构思） |
| platform | enum | ✗ | `weixin` / `xiaohongshu` / `douyin` / `wechat_video` / `cms` |
| brandColor | string | ✗ | 品牌色（hex） |
| mood | enum | ✗ | `serious` / `warm` / `energetic` / `mystery`，默认 `serious` |
| variants | int | ✗ | 方案数，默认 3，最多 5 |
| allowFaceImage | boolean | ✗ | 是否允许人脸图，默认 `true` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| designs | `{id, mainText, subText?, visualStructure, colors, fonts, aiPrompt, ctrEstimate, risks[]}[]` | 方案清单 |
| sizeAdaptation | `{platform, ratio, px, adjustedDesignId}[]` | 尺寸适配 |
| warnings | string[] | 涉名人 / 版权风险等 |

## 工作流 Checklist

- [ ] Step 0: 标题拆解 —— 抓主 noun + 动作 + 情绪
- [ ] Step 1: 主视觉构思 —— 人物 / 物体 / 场景 / 抽象
- [ ] Step 2: 平台先验 —— 按 platform 选尺寸与风格
- [ ] Step 3: 生成 3-5 套差异化方案（不同视觉切入）
- [ ] Step 4: 每套方案补充字体 / 色彩 / 装饰
- [ ] Step 5: AI 出图 prompt 生成（可直接喂 MJ / DALL-E）
- [ ] Step 6: 尺寸适配 —— 主视觉不变 / 文字重排
- [ ] Step 7: CTR 预估（基于历史同类平均）
- [ ] Step 8: 风险扫描（涉政 / 名人肖像 / 版权）
- [ ] Step 9: 质量自检（见 §5）

## 平台尺寸与风格

| 平台 | 尺寸 px | 宽高比 | 文字 | 风格倾向 |
|-----|--------|-------|-----|---------|
| 微信公众号 | 900×500 | 16:9 | 主标 ≤ 12 字 | 简洁 / 大字 |
| 小红书 | 1080×1440 | 3:4 | 3-5 行堆叠 | 温暖 / 手写 / 图多 |
| 抖音 | 720×1280 | 9:16 | 大字 + 对比 | 爆点 / 情绪 |
| 视频号 | 1920×1080 | 16:9 | 主标 + 副标 | 稳 / 专业 |
| CMS 详情 | 1600×900 | 16:9 | 主标居中 | 品牌 / 统一 |
| 印刷海报 | 1200×1600 | 3:4 | 多层信息 | 信息密度大 |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 方案差异度 | 任两方案视觉主轴不同 |
| 2 | 主文字可读 | 手机预览 1.5s 内能读完 |
| 3 | AI prompt 可执行 | 含主体 + 场景 + 风格 + 色彩 |
| 4 | 尺寸适配完整 | 所有 platform 都有版本 |
| 5 | 色彩对比 | 文字 vs 背景对比度 ≥ 4.5:1 |
| 6 | 合规扫描 | 涉政 / 名人 / 版权显式 warnings |
| 7 | CTR 预估有依据 | 含 "基于同类平均 X%" |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 方案同质 | 3 版都是大字 | 强制不同视觉切入（人 / 物 / 场景 / 抽象） |
| 文字太多 | 20+ 字堆在封面 | 主标 ≤ 12 字；副标 ≤ 20 字 |
| prompt 太空 | "生成一张好看的图" | 含主体 + 场景 + 风格 + 色调 + 构图 |
| 尺寸适配错 | 16:9 硬裁成 9:16 | 主视觉重构；文字重排 |
| 名人肖像未警示 | 直接用明星照 | 涉名人必标 `需版权确认` |

## 输出示例

```json
{
  "designs": [
    {
      "id": "A",
      "mainText": "AI 监管条例",
      "subText": "8 章 52 条 · 7月施行",
      "visualStructure": "大字居中 + 背景抽象科技纹",
      "colors": { "primary": "#1A6CFF", "bg": "#0A0E27", "accent": "#FFD700" },
      "fonts": "思源黑体 Bold 主标 / 苹方 Regular 副标",
      "aiPrompt": "Abstract tech pattern, deep blue gradient background, subtle AI circuit lines, minimalist futuristic, space for large Chinese typography, 16:9",
      "ctrEstimate": "预估 3.8%（同类政策科技稿均值 3.2%）",
      "risks": []
    },
    {
      "id": "B",
      "mainText": "AI 要被管了",
      "visualStructure": "情绪大字 + 机器人轮廓剪影",
      "colors": { "primary": "#FFF", "bg": "#1A1A1A", "accent": "#FF6B35" },
      "aiPrompt": "Silhouette of a robot viewed from behind, standing before a grand regulatory document, dramatic lighting, black background, 16:9",
      "ctrEstimate": "预估 4.5%（情绪+人物剪影通常 +40%）",
      "risks": []
    },
    {
      "id": "C",
      "mainText": "52 条",
      "subText": "一文读懂 AI 新规",
      "visualStructure": "超大数字 + 文档插图",
      "colors": { "primary": "#000", "bg": "#FFD700", "accent": "#000" },
      "aiPrompt": "Massive number 52 filling the frame, yellow background, document icon overlay, bold editorial style, 16:9",
      "ctrEstimate": "预估 4.1%（数字型封面历史数据 +25%）",
      "risks": []
    }
  ],
  "sizeAdaptation": [
    { "platform": "weixin", "ratio": "16:9", "px": "900x500", "adjustedDesignId": "A" },
    { "platform": "xiaohongshu", "ratio": "3:4", "px": "1080x1440", "adjustedDesignId": "C" },
    { "platform": "douyin", "ratio": "9:16", "px": "720x1280", "adjustedDesignId": "B" }
  ]
}
```

## EXTEND.md 示例

```yaml
default_variants: 3
default_mood: "serious"
default_allow_face_image: true

# 品牌视觉库
brand_colors:
  primary: "#1A6CFF"
  secondary: "#F5F7FA"
brand_fonts:
  main: "思源黑体"
  secondary: "苹方"

# 各平台 CTR 基线（用于预估）
ctr_baseline:
  weixin: 0.032
  xiaohongshu: 0.058
  douyin: 0.042
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 方案同质 | 未强制视觉多样 | ≥ 3 种视觉主轴 |
| 文字太多 | 主标失控 | 主标 ≤ 12 字硬截 |
| AI prompt 不好用 | 要素不全 | 含 5 要素：主体 / 场景 / 风格 / 色彩 / 构图 |
| 名人版权 | 肖像权 | 涉名人强制 warnings + 用剪影 / 抽象 |
| 尺寸硬裁 | 未重构 | 文字重排；主视觉保持 |
| CTR 预估虚高 | 无基线 | 必基于 ctr_baseline |

## 上下游协作

- **上游**：`content_generate` / `headline_generate` 出标题后、`media_search` 有候选配图、`layout_design` 提供视觉系统
- **下游**：视觉设计师按 prompt 出图或精修、`cms_publish` 写 cover 字段、`publish_strategy` 按平台选对应 adjustedDesign

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/thumbnail_generate/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
