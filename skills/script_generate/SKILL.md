---
name: script_generate
displayName: 视频脚本生成（场景化重写版）
description: 生成视频脚本的核心 skill。按 5 大视频场景分化子模板（新闻视频 / 时政解读 / 赛事解说 / 综艺看点 / 纪录片）。每子模板有独立分镜节奏、镜头语言、配音风格。与 duanju_script（分集短剧）、zhongcao_script / tandian_script（民生专用）、podcast_script（音频）形成互补：script_generate 专注"非系列化、非民生专用、非音频"的通用视频场景。
version: 5.0.0
category: generation

metadata:
  skill_kind: generation
  scenario_tags: [news, politics, sports, variety, documentary]
  compatibleEmployees: [xiaowen, xiaojian]
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

# 视频脚本生成（script_generate）

## 使用条件

✅ **应调用场景**：
- APP 新闻栏目的新闻视频脚本（非拆条）
- 时政深度解读视频脚本
- 赛事（如川超）解说视频脚本
- 综艺看点视频脚本（可内部委托 `zongyi_highlight`）
- 短纪录片脚本（3-15 分钟）

❌ **不应调用场景**：
- 分集短剧（走 `duanju_script`）
- 种草视频（走 `zhongcao_script`）/ 探店视频（走 `tandian_script`）
- 播客音频（走 `podcast_script`）

**前置条件**：`topic` + `keyPoints ≥ 1`；`subtemplate` 必须是 5 个之一；LLM 可用；子模板对应 KB 已绑定（如可用）。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| topic | string | ✓ | 视频主题 |
| subtemplate | enum | ✓ | 5 个子模板之一（见 §3） |
| keyPoints | string[] | ✓ | 关键信息点（≥ 1） |
| sourceArticle | `{title, body}` | ✗ | 基于已有文章生成视频版 |
| targetDurationSec | int (30-1200) | ✗ | 默认 180 |
| aspectRatio | enum | ✗ | `16:9` / `9:16` / `1:1`，默认 `16:9` |
| style | enum | ✗ | `serious` / `casual` / `energetic` / `cinematic` |
| narrator | enum | ✗ | `anchor` / `documentary_voice` / `casual_host` / `field_reporter` |
| mustIncludeShots | string[] | ✗ | 必须出现的画面 |
| customInstructions | string | ✗ | 额外指令 |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| meta | object | `{scriptId, subtemplate, aspectRatio, targetDurationSec, totalWords, shotCount}` |
| hook | object | `{durationSec (≤10), visual, voiceover, subtitle?}` |
| shotList[] | array (≥3) | 每镜含 `sequence, timecodeStart, durationSec, sceneDescription, shotType, voiceover?, subtitle?, onScreenText?, transitionTo?, materialHints?, specialEffects?` |
| musicPlan[] | array | `{segment, timecodeRange, mood, volumePercent (0-100)}` |
| materialRequirements[] | array | `{description, type, duration?, priority ∈ must/should/nice}` |
| productionNotes[] | string[] | 制作提醒 |
| factsToVerify[] | string[] | 事实核查项 |
| complianceCheck | object | `{passed, reviewTier ∈ strict/relaxed, flaggedIssues[]}` |

完整 Zod Schema 见 [src/lib/agent/execution.ts](../../src/lib/agent/execution.ts) 内 skill IO 定义。

## 5 大子模板分化（摘要表）

详细子模板规范（分镜节奏百分比、24 项质量阈值、配音风格细则）可参考对应代码文件的常量（follow-up will extract）。以下为跨子模板的关键差异总览：

| 子模板 | 身份 / 定位 | 节奏 & 镜头要点 | 配音 / 风格 | 审核档位 & 核心红线 |
|--------|-----------|---------------|-----------|-------------------|
| **news_video**（新闻视频） | 新华社视频编导 / 3 分钟讲清一件事 | Hook 5-10s → 5W1H 主体 60-70% → 专家 15-20% → 背景数据 10-15% → 结尾 5-10%；分镜 15-25；数字必带贴字动画 | `anchor` 主播体，语速 1.0，客观三人称，避免感叹 | 中；5W1H 覆盖 ≥ 90%；关键数字有 source |
| **politics_explainer**（时政解读） | 时政深度团队总导演 / 央视政论体 | 政策背景 15% → 原文引用 35% → 学者解读 30% → 案例 15% → 升华 5%；稳定镜头 + 条文贴字；主持人/专家占显著位置 | `documentary_voice` + anchor，语速 0.95，权威严谨，无感叹 | **严**；禁娱乐元素 / 禁自行评价（"力度不够"）；原文引用 ≥ 3；所有数字必有来源 |
| **sports_commentary**（赛事解说） | 川超专属解说 / 熟悉战术 & 球员 | Hook 绝杀画面 5-10s → 赛前 20% → 上半场 25% → 下半场 30% → 赛后 15%；3-5s 切镜 + 慢动作回放 + 数据飞入动画；分镜 30-50 | `field_reporter` energetic，节奏「平→快→爆→缓」，允许感叹（"进啦！"） | **松**；比分/数据准确 100%；禁地域攻击 / 球员侮辱 |
| **variety_highlight_video**（综艺看点） | 综艺剪辑师 / 3 秒钩子 | Hook 金句 3-5s → Top N 盘点（每段 15-25s）→ CTA + 预告 5s；1-3s 快切 + 大量贴字 + 现场笑声；分镜 20-30 | `casual_host` / `field_reporter`，情绪丰富，有解说感 | 松；艺人名 100% 核查；禁艺人引战 / 伪造瓜；可内部委托 `zongyi_highlight` |
| **documentary_short**（短纪录片） | 纪录片导演 / 5-15 分钟人文 | 出场 10% → 起承 30% → 转 30% → 合 20% → 收尾 10%；5-10s 慢镜 + 空镜 + 特写 + 采访穿插 | `documentary_voice`（低沉磁性），语速 0.85-0.95，诗意感性 | 按内容定（民生松 / 涉政严）；情感起伏 ≥ 1 高点 + 1 低点 |

## 工作流 Checklist

- [ ] Step 0: 加载子模板风格指南 + 镜头语言 KB
- [ ] Step 1: 拆解 topic + keyPoints 为叙事弧
- [ ] Step 2: 按子模板设计 hook（≤ 10s）
- [ ] Step 3: 分镜编排（起承转合）+ 匹配子模板分镜数区间
- [ ] Step 4: 逐镜写配音稿 + 字幕 + 贴字（字幕覆盖率 ≥ 95%）
- [ ] Step 5: 配乐规划（分段 mood + volume）
- [ ] Step 6: 素材需求清单（must / should / nice 分级）
- [ ] Step 7: 质量自检（通用阈值表 §5）
- [ ] Step 8: 合规扫描（按子模板审核档位）

## 质量把关

**通用自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| G1 | 分镜数量 | news 15-25 / politics 20-35 / sports 30-50 / variety 20-30 / doc 按时长 |
| G2 | 每镜时长 | 最短 3s（避免过碎）/ 最长 25s（避免拖沓） |
| G3 | hook 时长 | ≤ 10s |
| G4 | 字幕覆盖率 | ≥ 95%（静音观看适配） |
| G5 | 转场多样性 | ≥ 3 种不同转场 |
| G6 | 配音字数 / 时长匹配 | 字数 × 0.25s ≈ 配音时长 ±10% |
| G7 | 关键数字有贴字 | 100% |
| G8 | 事实核查项标注 | 有数据 → 必有 source 或 `factsToVerify` |

> 子模板扩展阈值（5W1H 覆盖 / 原文引用数 / 比分准确 / 艺人名核查 / 情感起伏）见 §3 摘要表最右列与代码常量。

**Top-4 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 子模板错配 | 时政用了 sports 的情绪感 | Step 0 强制按 subtemplate 加载风格指南 |
| 分镜数过少 | 3 分钟视频只有 5 镜 | 按子模板最低分镜数区间校验（G1） |
| 无字幕 | 只有配音，没贴字 | Step 4 字幕必填；覆盖率 ≥ 95%（G4） |
| 配音与时长不匹配 | 3 分钟视频配音稿 2000 字（塞不下） | Step 4 按 4 字/秒（0.25s/字）估算；字数 × 0.25s ≈ 时长 ±10%（G6） |

## 输出模板 / 示例

```json
{
  "meta": {
    "scriptId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "subtemplate": "news_video",
    "aspectRatio": "16:9",
    "targetDurationSec": 180,
    "totalWords": 640,
    "shotCount": 18
  },
  "hook": {
    "durationSec": 8,
    "visual": "无人机航拍深圳湾夜景，镜头缓推到市民中心大楼",
    "voiceover": "4 月 17 日，深圳推出又一项重磅产业政策。",
    "subtitle": "深圳市民中心"
  },
  "shotList": [
    {
      "sequence": 1,
      "timecodeStart": "00:08",
      "durationSec": 8,
      "sceneDescription": "新闻发布会现场，官员宣读政策",
      "shotType": "medium",
      "voiceover": "深圳市政府发布《促进人工智能产业高质量发展若干措施》。",
      "subtitle": "5 年投入 200 亿元",
      "transitionTo": "cut",
      "materialHints": ["台内素材库-发布会画面"]
    }
  ],
  "musicPlan": [
    { "segment": "开场", "timecodeRange": "00:00-00:10", "mood": "科技感", "volumePercent": 60 }
  ],
  "materialRequirements": [
    { "description": "新闻发布会现场画面", "type": "footage", "priority": "must" },
    { "description": "专家采访", "type": "interview", "priority": "must" }
  ],
  "productionNotes": ["现场声保留 10%", "数字需做放大动画"],
  "factsToVerify": ["5 年投入 200 亿 - 来源：政策文件原文"],
  "complianceCheck": { "passed": true, "reviewTier": "relaxed", "flaggedIssues": [] }
}
```

## EXTEND.md 示例

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

## 上下游协作

- **上游**：`content_generate` 基于已有图文稿产出视频版；选题/热点触发；素材研究员（xiaozi）提供参考
- **下游**：`aigc_script_push` 推送 AIGC；`cms_publish` 图文脚本档案；人工拍摄（导出分镜表 PDF）

## 常见问题

| 问题 | 解决 |
|------|------|
| 分镜数不足（不到子模板最低区间） | 按 G1 阈值重新生成；Step 3 明确要求补足 |
| 时政脚本含私人评论 / 感叹 | `subtemplate=politics_explainer` + EXTEND `strictness=maximum`；Step 8 合规严档扫描 |
| 赛事解说"无感"无情绪 | `narrator=field_reporter` + `style=energetic`；允许感叹词词典 |
| 配音稿与分镜脱节 | Step 4 要求逐镜写对应配音，不允许整段独立配音 |
| 与姊妹 skill 选错 | 分集走 `duanju_script`；种草 / 探店 / 播客各有专用 skill；本 skill 只做"非系列化通用视频" |

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)（通用 agent 执行入口；skill 逻辑通过 prompt 驱动）
- 参考 Spec：[docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md](../../docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md) · 历史：`git log --follow skills/script_generate/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)

