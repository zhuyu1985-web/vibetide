---
name: audio_plan
displayName: 音频方案
description: 为视频 / 广播 / 播客 / 有声 / 纯音频内容生成完整音频制作方案，含配音方案（人声 / AI 合成的语气参数 / 分段时长 / 气口标记 / 强调字词 / 多人声分工）、配乐方案（风格 / BPM / 调性 / 情绪曲线 / 各段落起止点 / 节拍拐点）、音效设计（环境音 / 点音 / 过渡音 / 空间感提示）、混音参考（人声 / 配乐 / 音效的电平比例 / 立体声左右分布 / 压缩 / EQ 建议）。支持 TTS 合成所需参数（voice_id / style / speed / pitch）直出，可直接喂腾讯 / 阿里 / Azure / ElevenLabs 云端 TTS。当用户提及"配音""旁白""配乐方案""音效""混音""TTS""语音合成""播客音频""广播稿"等关键词时调用；不用于视频分镜或脚本生成。
version: "1.3"
category: av_script

metadata:
  skill_kind: generation
  scenario_tags: [audio, voice, music, tts, podcast]
  compatibleEmployees: [xiaojian]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: [script_generate]
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 音频方案（audio_plan）

你是音频制作导演，职责是把一段文字脚本变成"配音 + 配乐 + 音效 + 混音"完整可执行的音频方案。核心信条：**听感情绪一致 > 单项精致**——再好的配音如果跟配乐撞了节奏，也是翻车。

## 使用条件

✅ **应调用场景**：
- 视频成片前的配音 + 音效 + 配乐方案
- 播客 / 有声书 / 广播节目制作
- 纯音频内容（音频课程 / 音频新闻）
- AI TTS 合成参数准备
- 直播前的音频流规划

❌ **不应调用场景**：
- 要文字脚本 → `script_generate`
- 要视频分镜 → `video_edit_plan`
- 要播客脚本（有专 skill）→ `podcast_script`

**前置条件**：`script` 非空；`duration` 明确；LLM 可用；如有品牌音频库（片头 / 片尾 / 专属音效）更好。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| script | string | ✓ | 旁白 / 对白脚本 |
| duration | int | ✓ | 总时长秒 |
| mood | enum | ✗ | `serious` / `warm` / `energetic` / `mystery` / `melancholy` |
| voiceType | enum | ✗ | `male_deep` / `male_warm` / `female_warm` / `female_clear` / `neutral` / `ai_xiaoyi` |
| useTTS | boolean | ✗ | 是否走 AI 合成，默认 `false` |
| ttsProvider | enum | ✗ | `tencent` / `aliyun` / `azure` / `elevenlabs` |
| hasDialogue | boolean | ✗ | 是否多人对白，默认 `false` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| voicePlan | `{segments[{start, end, text, voiceId, style, speed, pitch, breath[], emphasis[]}]}` | 配音脚本 |
| musicPlan | `{sections[{start, end, style, bpm, key, emotion, cueType}]}` | 配乐方案 |
| sfxPlan | `{effects[{atSec, type, duration, spatial}]}` | 音效设计 |
| mixGuide | `{voiceDb, musicDb, sfxDb, stereoWidth, eqHints}` | 混音参考 |
| ttsParams | `{provider, voice, style, speed, pitch}` | TTS 合成参数（useTTS=true 时） |
| warnings | string[] | 时长不匹 / 情绪冲突 |

## 工作流 Checklist

- [ ] Step 0: 脚本切段 + 时长分配（按自然句 / 段落）
- [ ] Step 1: 情绪曲线规划（开场 / 铺垫 / 高潮 / 收尾）
- [ ] Step 2: 配音方案 —— voice 选型 + 语气参数（速度 / 音高 / 停顿）
- [ ] Step 3: 气口 / 强调 / 情绪标记 —— 重点词用 `<emphasis>` 标
- [ ] Step 4: 配乐分段 —— 每段的 style / BPM / 调性 / 情绪
- [ ] Step 5: 音效点 —— 开场 whoosh / 转场 whoosh / 重点 hit / 收尾
- [ ] Step 6: 混音参考 —— 人声主导 / 配乐降噪 / 音效点缀
- [ ] Step 7: TTS 参数生成（useTTS 时）
- [ ] Step 8: 时长合规校验（误差 ≤ ±3%）
- [ ] Step 9: 质量自检（见 §5）

## 情绪曲线范式

| 曲线类型 | 走向 | 适用场景 |
|---------|------|---------|
| 平稳走 | 全程一色 | 新闻快讯 / 简报 |
| 上扬抛物 | 先低后高 | 励志 / 人物特写 |
| 波浪起伏 | 多峰多谷 | 综艺 / 纪录片 |
| 悬念→释放 | 低 → 高峰 → 中 | 悬念类报道 |
| 情感下沉 | 高 → 低 | 致敬 / 告别 |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 时长误差 | ≤ ±3% |
| 2 | 语速合理 | 中文 4.5-5.5 字/秒 |
| 3 | 配乐情绪 ≠ 人声 | 无情绪冲突 |
| 4 | 气口标记 | 长段 ≥ 30s 必有气口 |
| 5 | 音效不喧宾夺主 | -12dB 以下 |
| 6 | 混音比例 | 人声 -6dB / 配乐 -18dB / 音效 -12dB（基准） |
| 7 | TTS 参数齐 | useTTS 时 voice/speed/pitch 100% 必填 |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 语速过快 | 6+ 字/秒 | 按基准 5 字/秒；超时则缩短文本 |
| 配乐盖人声 | 音乐 BPM 不避人声 | Step 4 选人声段调低配乐 |
| 情绪冲突 | 悲伤脚本用激昂配乐 | Step 1 情绪曲线先定调 |
| TTS 生硬 | 机器感强 | 加气口 / emphasis / 适当语调波动 |
| 音效滥用 | 每 2s 一个 whoosh | 关键点才加；默认 ≥ 10s 一个 |

## 输出示例

```json
{
  "voicePlan": {
    "segments": [
      {
        "start": 0,
        "end": 8,
        "text": "国务院刚刚颁布生成式人工智能管理条例",
        "voiceId": "xiaoyi_female_news",
        "style": "professional",
        "speed": 1.0,
        "pitch": 0,
        "breath": [3.2],
        "emphasis": ["刚刚", "管理条例"]
      },
      {
        "start": 8,
        "end": 18,
        "text": "8章52条，7月1日起正式施行",
        "voiceId": "xiaoyi_female_news",
        "style": "emphatic",
        "speed": 0.95,
        "pitch": 2,
        "emphasis": ["8章52条", "7月1日"]
      }
    ]
  },
  "musicPlan": {
    "sections": [
      { "start": 0, "end": 2, "style": "suspense_electronic", "bpm": 90, "key": "Am", "emotion": "tension", "cueType": "pre_hook" },
      { "start": 2, "end": 22, "style": "serious_newsroom", "bpm": 110, "key": "Cm", "emotion": "authority", "cueType": "main" },
      { "start": 22, "end": 30, "style": "soft_pad", "bpm": 85, "key": "C", "emotion": "trust", "cueType": "outro" }
    ]
  },
  "sfxPlan": {
    "effects": [
      { "atSec": 0, "type": "whoosh_in", "duration": 0.5, "spatial": "L→C" },
      { "atSec": 16, "type": "data_hit", "duration": 0.3, "spatial": "C" },
      { "atSec": 28, "type": "soft_bell", "duration": 1.0, "spatial": "C" }
    ]
  },
  "mixGuide": {
    "voiceDb": -6,
    "musicDb": -18,
    "sfxDb": -12,
    "stereoWidth": "mid",
    "eqHints": "人声 200Hz -2dB 去浊；4kHz +2dB 提亮"
  },
  "ttsParams": {
    "provider": "tencent",
    "voice": "zhiyu_news_female",
    "style": "news",
    "speed": 1.0,
    "pitch": 0
  }
}
```

## EXTEND.md 示例

```yaml
default_mood: "serious"
default_voice_type: "female_clear"
default_use_tts: false

# TTS 供应商默认
tts_provider: "tencent"
tts_default_voice: "zhiyu_news_female"

# 基准语速（字 / 秒）
baseline_speed_zh: 5.0
baseline_speed_en: 2.5

# 混音基准电平
mix_baseline:
  voice_db: -6
  music_db: -18
  sfx_db: -12

# 品牌音效库
brand_sfx:
  intro_whoosh: "whoosh_brand_v2"
  outro_bell: "soft_bell_brand"
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 时长超支 | 文本 / 语速不匹 | 按 baseline_speed 推算；超时缩文本 |
| TTS 僵硬 | 无 emphasis / breath | Step 3 强制标记 |
| 配乐撞人声 | BPM 相近 | 调 BPM ≥ 10 差异 |
| 情绪冲突 | 曲线未先定 | 先 Step 1 画曲线 |
| 音效打扰 | 密度过高 | 默认 ≥ 10s 一个；关键点才加 |
| 混音电平不匹 | 无参考 | 按 mix_baseline 基准输出 |

## 上下游协作

- **上游**：`script_generate` 脚本、`video_edit_plan` 视频分镜、`podcast_script` 播客稿
- **下游**：TTS 服务（按 ttsParams）合成 / 配音录制、后期混音师按 mixGuide、`video_edit_plan` 音画对齐

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/audio_plan/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
