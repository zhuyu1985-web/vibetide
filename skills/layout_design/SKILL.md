---
name: layout_design
displayName: 排版设计
description: 为图文稿、长文专题、图文海报、CMS 详情页、社交平台卡片生成专业排版方案。输出含版式结构（开头抓人模块 / 主体段落样式 / 数据可视化插入点 / 结尾引导 CTA）、字体层级（H1/H2/H3/正文/引用/注释字号 + 粗细 + 颜色）、图片规则（插入位置 / 配图数 / 宽高比 / 样式如圆角 / 边框 / 加水印）、排版节奏（每 X 段一张图 / 每 Y 字一个小标题）、色彩方案（主色 + 辅色 + 强调色，按主题情绪定）、特殊元素（引用卡 / 数据卡 / 时间轴 / 步骤图）。按目标平台分化规范（微信公众号 / 小红书 / CMS 详情页 / 印刷物）。当用户提及"排版""版式""视觉设计""图文结构""字号""配图节奏""海报""卡片"等关键词时调用；不用于正文生成或图片生成。
version: "1.5"
category: content_gen

metadata:
  skill_kind: generation
  scenario_tags: [layout, typography, visual, formatting]
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

# 排版设计（layout_design）

你是视觉编辑，职责是把一段纯文字内容"装进符合平台调性且可读性高的视觉容器"。核心信条：**可读性 > 花哨**——小红书再好看，微信公众号照搬就是翻车。

## 使用条件

✅ **应调用场景**：
- 正文完成后，准备发布前的排版方案
- CMS 详情页模板设计（选段落样式 / 插图位）
- 多平台同步发布时，各平台独立排版方案
- 长文专题（数据新闻 / 深度稿）的视觉结构
- 图文海报的单页设计

❌ **不应调用场景**：
- 只要文字内容 → `content_generate`
- 只要封面 → `thumbnail_generate`
- 只要视频分镜 → `video_edit_plan`
- 整页设计稿（需设计师介入）

**前置条件**：`content` 或 `wordCount` 已知；目标平台确定；LLM 可用；单次方案耗时 5-8s。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | ✓ | 待排版正文（可截取） |
| contentType | enum | ✗ | `article` / `longform` / `poster` / `card` |
| platform | enum | ✗ | `weixin` / `xiaohongshu` / `cms` / `print` / `wechat_moments` |
| imageCount | int | ✗ | 可用配图数量 |
| mood | enum | ✗ | `serious` / `warm` / `energetic` / `minimal`，默认 `serious` |
| brandColors | string[] | ✗ | 品牌主色（十六进制） |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| structure | `{section, position, style, notes}[]` | 版式结构 |
| typography | `{level, fontSize, weight, color, lineHeight}[]` | 字体层级 |
| imageRules | `{position, ratio, style, captionStyle}` | 图片规则 |
| rhythm | `{paragraphsPerImage, wordsPerSubhead}` | 排版节奏 |
| colors | `{primary, secondary, accent, bg}` | 色彩方案 |
| specialElements | `{type, when, style}[]` | 引用卡 / 数据卡等 |
| cssHints | string | 可选 CSS 变量提示（cms 模板） |

## 工作流 Checklist

- [ ] Step 0: 内容扫描 —— 识别段落 / 小标题 / 数据 / 引用
- [ ] Step 1: 平台规范注入（字号 / 色彩 / 节奏先验）
- [ ] Step 2: 版式结构 —— 开头 / 主体 / 结尾模块
- [ ] Step 3: 字体层级（H1-H3 + 正文 + 引用 + 注释）
- [ ] Step 4: 图片规则 —— 插入位 / 宽高比 / 样式
- [ ] Step 5: 排版节奏 —— 每 X 段一图 / 每 Y 字一个小标题
- [ ] Step 6: 色彩方案（按 mood + brandColors）
- [ ] Step 7: 特殊元素识别（数据段加卡片 / 引用加框）
- [ ] Step 8: 适配性检查（手机 / PC 可读性）
- [ ] Step 9: 质量自检（见 §5）

## 平台先验规范

| 平台 | 推荐字号 | 图片节奏 | 色彩倾向 | 特殊要求 |
|-----|---------|---------|---------|---------|
| 微信公众号 | H1 22-28pt / 正文 16pt | 3-5 段一图 | 中性 / 冷灰 | 首段加引导语 / 留白 |
| 小红书 | H1 20-24pt / 正文 15pt | 1-2 段一图 | 暖色 / 柔和 | 图多 / 短段 / emoji |
| CMS 详情 | H1 32pt / 正文 16pt | 按内容自由 | 品牌色主导 | 标签栏 / 摘要卡 |
| 微信朋友圈 | 纯文字 + 9 图 | 固定 9 格 | — | 限 1200 字 |
| 印刷物 | 主标 36pt / 正文 10.5pt | 按版面设计 | 印刷四色 | 出血位 / 高分辨率 |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | H1-H3 层级清晰 | 字号差 ≥ 4pt |
| 2 | 正文行高 | ≥ 1.5 倍 |
| 3 | 图片节奏 | 长文每 400-600 字一图 |
| 4 | 色彩对比 | 正文 vs 背景对比度 ≥ 4.5:1 |
| 5 | 平台规范遵循 | 100% |
| 6 | 手机友好 | 字号 ≥ 14pt / 行宽 ≤ 32 中文字 |
| 7 | 数据段可视化 | 3+ 数字段建议数据卡 |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 字号套模板不匹配 | 小红书用公众号字号 | Step 1 平台先验强绑定 |
| 图片节奏太密 | 每段一图 | 默认每 400 字一图；可调 |
| 色彩对比不足 | 灰字灰底 | Step 8 对比度硬校验 |
| 引用无区分 | 引用字号同正文 | 引用强制加框 + 左缩进 |
| 手机不友好 | 行宽太长 | 手机 ≤ 32 中文字 / 屏宽 |

## 输出示例

```markdown
## 排版方案（微信公众号）

### 版式结构
1. 开头：引导语金句卡片（居中 / 引号样式）
2. 第一段：导语 / 悬念 / 数据钩子
3. 小标题 1 + 3 段正文 + 1 张数据图
4. 小标题 2 + 2 段正文 + 1 张场景图
5. 数据卡（3 组核心数据）
6. 专家引用卡
7. 结尾 CTA + 导航卡

### 字体层级
| 层级 | 字号 | 粗细 | 颜色 |
|-----|-----|-----|-----|
| H1 标题 | 24pt | bold | #1A1A1A |
| H2 小标题 | 18pt | semibold | #333 |
| 正文 | 16pt | regular | #404040 |
| 引用 | 15pt | italic | #666 |
| 注释 | 13pt | regular | #999 |

### 图片规则
- 插入位：段落后
- 宽高比：16:9（横图）/ 4:3（竖图）
- 样式：8px 圆角 / 无边框
- 说明文字：居中 / 12pt / 灰色

### 排版节奏
- 每 400 字插入 1 张图
- 每 200-300 字加一个小标题（H3）

### 色彩方案
- 主色 #1A6CFF（品牌蓝）
- 辅色 #F5F7FA（灰背景）
- 强调 #FF6B35（CTA / 警示）
- 背景 #FFFFFF

### 特殊元素
- 数据段（含 3 个以上数字）→ 数据卡
- 引用专家话 → 引用卡（左 4px 蓝色竖线）
- 时间类信息 → 时间轴
```

## EXTEND.md 示例

```yaml
default_platform: "weixin"
default_mood: "serious"

# 平台先验覆盖
platform_overrides:
  xiaohongshu:
    image_rhythm: "1_per_2_paragraphs"
    emoji_allowed: true

# 品牌视觉系统
brand_colors:
  primary: "#1A6CFF"
  secondary: "#F5F7FA"
  accent: "#FF6B35"

# 手机可读性阈值
mobile_readability:
  min_font: 14
  max_line_width: 32  # 中文字
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 字号不符平台 | 模板误用 | 平台先验表硬绑 |
| 图片节奏混乱 | 数量未设 | 按字数自动推 |
| 色彩不符品牌 | brandColors 缺 | 默认回退中性灰 |
| 引用无区分 | 层级缺 | 引用必加卡 / 缩进 |
| 数据段无视觉 | 纯文字罗列 | 3+ 数字强制数据卡 |
| 手机不友好 | 行宽过长 | 默认 ≤ 32 中文字 |

## 上下游协作

- **上游**：`content_generate` 出稿后、`media_search` 提供配图后、视觉品牌库
- **下游**：`thumbnail_generate` 做封面配合、`cms_publish` 生成页面模板、视觉设计师在方案上二次微调

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/layout_design/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
