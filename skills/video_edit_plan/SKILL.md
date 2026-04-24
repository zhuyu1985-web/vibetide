---
name: video_edit_plan
displayName: 视频剪辑方案
description: 基于已有脚本生成专业视频剪辑方案，输出完整分镜表（镜头序号 / 时长 / 景别 / 画面内容 / 旁白 / 配乐 / 转场 / 特效 / 字幕样式）、素材清单（自有 / 待拍 / 公域图库 / 需外购）、配乐方案（风格 / 节拍点 / 情绪曲线）、转场策略、字幕规范、成片节奏控制点。按目标平台分化（抖音 9:16 快节奏 / 视频号 16:9 稳节奏 / B 站弹幕友好 / 长视频纪录片式）。支持输入原始脚本或大纲两种模式，可指定关键情绪拐点。适配"有素材剪 / 零素材出方案待拍"两种工作流。当用户提及"分镜""剪辑方案""视频计划""镜头表""素材清单""配乐""转场""字幕样式"等关键词时调用；不用于脚本生成（走 `script_generate`）或纯音频（走 `audio_plan`）。
version: "2.8"
category: av_script

metadata:
  skill_kind: generation
  scenario_tags: [video, editing, storyboard, postproduction]
  compatibleEmployees: [xiaojian]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: [script_generate, media_search]
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 视频剪辑方案（video_edit_plan）

你是视频剪辑导演（5 年+ 经验），职责是把脚本转成"剪辑师看就能动手"的分镜方案。核心信条：**节奏服务情绪 > 炫技堆镜头**——每一个切点、每一段配乐都要有它存在的理由。

## 使用条件

✅ **应调用场景**：
- 脚本定稿后，下厂前给剪辑师的工作方案
- 有 raw 素材库，需要匹配 → 成片的剪辑计划
- 零素材规划阶段，先出方案再拍摄
- 多平台出片（同内容适配抖音 / 视频号 / B 站 多尺寸）
- 长视频（10 min+）的节奏控制规划

❌ **不应调用场景**：
- 要生成脚本 → `script_generate`
- 纯配音方案 → `audio_plan`
- 封面 → `thumbnail_generate`
- 仅找素材 → `media_search`

**前置条件**：`script` 或 `outline` 非空；`duration` 明确；`platform` 明确（影响尺寸 / 节奏）；建议 `availableAssets` 提供（否则方案会标"待拍"）。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| script | string | ✓* | 视频脚本（与 outline 二选一） |
| outline | string[] | ✓* | 大纲分段（与 script 二选一） |
| duration | int | ✓ | 目标成片秒数 |
| platform | enum | ✓ | `douyin` / `wechat_video` / `bilibili` / `documentary` / `cms` |
| ratio | enum | ✗ | `16:9` / `9:16` / `1:1`，默认按 platform 推 |
| availableAssets | `{id, type, duration, tags[]}[]` | ✗ | 可用素材清单 |
| mood | enum | ✗ | `energetic` / `serious` / `warm` / `mystery`，默认 `serious` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| storyboard | `{no, start, end, shot, visual, voiceover, music, transition, subtitle, fx}[]` | 完整分镜表 |
| materialList | `{assetId?, description, source, status, duration, acquisition}[]` | 素材清单 |
| musicPlan | `{section, style, bpm, key, emotionalArc}[]` | 配乐方案 |
| transitions | `{from, to, type, duration}[]` | 转场清单 |
| subtitleStyle | `{font, size, color, position, outline}` | 字幕规范 |
| rhythmCheckpoints | `{atSec, intent}[]` | 节奏拐点 |
| warnings | string[] | 素材缺 / 时长超支 / 版权 |

## 工作流 Checklist

- [ ] Step 0: 脚本 / 大纲切段 + 时间分配
- [ ] Step 1: 平台先验注入（节奏 / 尺寸 / 字幕）
- [ ] Step 2: 分镜生成 —— 每段 2-8 个镜头
- [ ] Step 3: 景别编排（远 / 中 / 近 / 特写按节奏循环）
- [ ] Step 4: 素材匹配 —— `availableAssets` 优先；缺的标"待拍 / 外购"
- [ ] Step 5: 配乐方案（风格 / BPM / 情绪曲线）
- [ ] Step 6: 转场 + 字幕规范
- [ ] Step 7: 节奏拐点（开场钩子 5s / 中段反转 / 高潮前 3s / CTA）
- [ ] Step 8: 时长合规校验（误差 ≤ ±5%）
- [ ] Step 9: 质量自检（见 §5）

## 平台节奏先验

| 平台 | 典型时长 | 镜头平均时长 | 节奏特征 | 字幕 |
|-----|---------|------------|---------|-----|
| 抖音 9:16 | 15-60s | 1.5-3s | 快切 / 开场 1s 钩 | 大字 / 居下 |
| 视频号 16:9 | 60-180s | 3-5s | 稳 / 段落感 | 中字 / 居下 |
| B 站 16:9 | 5-15min | 4-8s | 有节奏起伏 / 可慢 | 中字 / 弹幕兼容 |
| 纪录片 16:9 | 15-60min | 8-15s | 叙事 / 慢 | 小字 / 可隐 |
| CMS 16:9 | 1-5min | 4-6s | 稳 / 专业 | 中字 |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 时长误差 | ≤ ±5% |
| 2 | 景别多样 | 至少 3 种景别循环 |
| 3 | 开场钩子 | ≤ 5s / 抖音 ≤ 1s |
| 4 | 每镜头含 5 要素 | 画面 + 旁白 + 配乐 + 时长 + 景别 |
| 5 | 素材状态清晰 | 100% 标 "已有 / 待拍 / 外购" |
| 6 | 配乐情绪曲线 | 含 2+ 拐点 |
| 7 | 字幕规范统一 | 字体 / 字号 / 颜色固定 |
| 8 | 节奏拐点 | ≥ 3 个（开 / 中 / 尾） |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 景别单一 | 全中景 | Step 3 强制远 / 中 / 近循环 |
| 素材匹配错 | availableAssets 不用 | Step 4 必先查 availableAssets |
| 时长超支 | 120s 塞 30 个 2s 镜头 | Step 0 按段分配时长 |
| 配乐一陈到底 | 整片一首 | 至少 2 段情绪切换 |
| 字幕不规范 | 各段字号不一 | Step 6 全片统一风格 |

## 输出示例（抖音 30s 示例）

```markdown
## 视频剪辑方案 · 抖音 9:16 · 30s

### 分镜表
| # | 区间 | 景别 | 画面 | 旁白 | 配乐 | 转场 | 字幕 | 特效 |
|---|------|-----|------|------|------|------|------|------|
| 1 | 0-2 | 特写 | 手机屏幕刷 AI 条例新闻 | 空 | 悬念前摇 | 开场黑切 | "52 条" 大字闪 | 屏闪 |
| 2 | 2-8 | 中景 | 主讲人出镜 | "国务院刚刚颁布……" | 上情绪层 | J-cut | 字幕 A 版 | 无 |
| 3 | 8-16 | 近景 + 插图 | 条例 8 章文字翻页 | "8 章 52 条全覆盖……" | 继续 | 硬切 | 章节条 | 卷轴翻动 |
| 4 | 16-22 | 特写 | 3 组核心数据 | "最高罚 5% 年营收……" | 节拍强化 | 硬切 | 数字放大 | 数字动画 |
| 5 | 22-28 | 中景 | 主讲人收尾 | "7 月 1 日起施行" | 回落 | 溶解 | 字幕 B 版 | 无 |
| 6 | 28-30 | 全屏 | CTA 关注卡 | "关注我获取全文解读" | 静止 | 无 | 白底黑字 | 弹性进入 |

### 素材清单
| ID | 描述 | 来源 | 状态 | 时长 | 获取 |
|----|------|------|------|------|------|
| A1 | 手机刷 AI 新闻画面 | 媒资库 | 已有 | 3s | 直接调用 |
| A2 | 主讲人中景镜头 | 待拍 | 待拍 | 8s | 明日演播室 |
| A3 | 条例文字翻页动效 | AE 生成 | 待制作 | 8s | 后期 |
| A4 | 数据卡片动画 | 模板 | 已有 | 6s | 调用模板 |

### 配乐方案
| 段 | 区间 | 风格 | BPM | 情绪 |
|---|------|-----|-----|------|
| 前摇 | 0-2s | 悬念电子 | 90 | 紧张 |
| 主体 | 2-22s | 严肃鼓点 | 110 | 推进 |
| 收尾 | 22-30s | 稳定弦乐 | 90 | 信任 |

### 字幕规范
- 字体：思源黑体 Heavy
- 字号：90px
- 颜色：白 + 黑描边 3px
- 位置：画面下 1/4

### 节奏拐点
- 0-1s：钩子闪字 "52 条"
- 16s：数据段高潮
- 28s：CTA 出现

### 告警
- A2 主讲人镜头需明日完成拍摄
```

## EXTEND.md 示例

```yaml
default_platform: "douyin"
default_mood: "serious"

# 平台节奏覆盖
platform_overrides:
  douyin:
    hook_window_sec: 1
    avg_shot_sec: 2
  bilibili:
    hook_window_sec: 3
    avg_shot_sec: 6

# 字幕品牌规范
subtitle_style:
  font: "思源黑体 Heavy"
  size_douyin: 90
  size_cms: 48
  color: "#FFFFFF"
  outline: "3px #000"

# 素材采购上限
max_external_purchase_count: 3
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 时长超支 | 每段时长累加超 | Step 0 按比例分配；超 +5% 重压 |
| 素材不够 | availableAssets 薄 | 标"待拍 / 外购"；给采购建议 |
| 景别单一 | 大部分中景 | ≥ 3 种景别循环 |
| 节奏无起伏 | 配乐 BPM 一致 | 开 / 中 / 尾至少 2 段 BPM 差异 |
| 字幕乱 | 各段字号不同 | 全片统一规范 |
| 版权风险 | 直接用竞品镜头 | 明确标注 "需版权" |

## 上下游协作

- **上游**：`script_generate` 脚本、`media_search` 素材清单、`audio_plan` 配音方案
- **下游**：剪辑师（Pr / 剪映）按分镜出片、`thumbnail_generate` 做封面、`publish_strategy` 选平台首发

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/video_edit_plan/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
