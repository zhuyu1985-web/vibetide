---
name: duanju_script
displayName: 短剧剧本生成
description: 为 APP 短剧频道生成竖屏分集短剧剧本（本期只产剧本文本，不做视频渲染）。支持 6 大类型（甜宠/逆袭/悬疑/穿越/古装/都市）+ 12+ 子类型系列化编剧，含角色一致性管理、每集 3 秒钩子、反转节奏、cliffhanger 设计、广电/价值观合规。当用户提及"短剧""剧本""分集""系列剧""小短剧"时调用。
version: 2.0.0
category: generation

metadata:
  skill_kind: generation
  scenario_tags: [drama, serial_content]
  compatibleEmployees: [xiaoce, xiaowen, xiaoshen]
  appChannel: app_drama
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases:
      - 短剧爆款案例库（强推荐）
      - 广电合规红线库（必选）
      - 短剧类型范式库（强推荐）
    dependencies: []
    context:
      - series_bible（系列圣经：角色表/世界观/剧情大纲）
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/
  openclaw:
    subtemplatesPath: src/lib/agent/skills/duanju-subtemplates.ts
    referenceSpec: docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md
---

# 短剧剧本生成（duanju_script）

## 使用条件

✅ **应调用场景**：
- 系列短剧的分集剧本生成（已有 series bible）
- 新系列第 1 集的试水剧本（需先生成 series bible 或并行）
- 基于热点/IP 改编的短剧（舆情驱动）
- 每日 AIGC 专题里的"每日短剧"任务

❌ **不应调用场景**：
- 非分集类单集故事（走 `content_generate[drama_serial]` 输出单篇剧本文字稿）
- 长剧集（>12 集，本期不支持；建议拆为多个短系列）
- 纪录片剧本（走 `script_generate` 的 `documentary_short` 子模板）
- 非剧本的文案创作（走 `content_generate`）

**前置条件**：LLM 可用（`deepseek-chat` 默认，Claude Opus 进阶）；`广电合规红线库` KB 已绑定；`generate_episode` 模式必须有完整 `seriesBible`；输出简体中文；剧本格式遵循行业标准（场景 → 动作 → 对白）。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| mode | enum | ✓ | `generate_episode` / `generate_series_bible` / `continue_series` |
| seriesBrief | object | ✗ | mode=generate_series_bible 时：`{concept, genre, targetEpisodes(3-12), perEpisodeDurationSec(120-600), coreConflict?, protagonist?, tone, targetAudience?}` |
| seriesBible | object | ✗ | mode=generate_episode 时：`{seriesId, name, genre, totalEpisodes, worldSetup, characters[≥2], storyOutline[], globalRules[]}` |
| episodeNum | int | ✗ | 生成第几集 |
| episodeInstructions | string | ✗ | 运营附加要求 |
| mustInclude | string[] | ✗ | 必须出现的元素（道具/地点/台词） |
| targetDurationSec | int (60-1200) | ✗ | 默认 300 |
| targetDialoguePairs | int (10-80) | ✗ | 默认 30 |

`genre` ∈ `sweet_romance` / `counter_attack` / `suspense` / `time_travel` / `period_drama` / `urban_life`
`tone` ∈ `reversed_high_energy` / `warm_tugging` / `suspense_dark` / `comedic`

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| mode | enum | `series_bible` / `episode_script` / `continuation` |
| seriesBible | object? | `{seriesId, name, tagline, genre, worldSetup, characters[], storyOutline[], globalRules[]}` |
| episode | object? | `{seriesId, episodeNum, episodeTitle, synopsis, targetDurationSec, estimatedReadTimeSec, hook, scenes[≥3], reversals[≥1], cliffhanger, nextEpisodePreview?, complianceCheck, ipConsistencyCheck}` |
| episode.hook | object | `{durationSec(≤5), sceneDescription, dialogue, visualImpact, hookPattern}` |
| episode.scenes[] | array | 每场 `{sceneNum, slugline, location, timeOfDay(日/夜/黄昏/清晨), durationSec, characters[], actionDescription, dialogues[], subtext?, musicCue?, transitionOut?}` |
| episode.reversals[] | array | `{atScene, description, intensity: minor/major/final}` |
| episode.cliffhanger | object | `{sceneNum, description, dialogue?, visualFreezeFrame}` |
| complianceCheck | object | `{passed, valueAlignment: positive/neutral/warning, flaggedIssues[]}` |
| ipConsistencyCheck | object | `{passed, violations[]}` |

完整 Zod Schema 见 [src/lib/agent/execution.ts](../../src/lib/agent/execution.ts) 内 skill IO 定义。

## 子类型矩阵（12+ 子模板摘要表）

6 大 genre × 子变体跨项差异总览。**详细规范请见外置文件**。

| 父类型 | 子变体 | 触发条件 / 主观众 | 节奏特征 | 音画风格 | 时长 / 集数 | 审核档位 |
|--------|-------|------------------|---------|---------|-----------|---------|
| 甜宠 | `sweet_ceo`（霸总宠溺） | 25-35 女性 / 男神冷面反差 | 温柔中突刺，反差制造萌感 | 暖色调 + 轻电子/弦乐 | 5-8min × 8-12 集 | 中档 |
| 甜宠 | `sweet_campus`（校园甜宠） | 18-28 女性 / 初恋怦然 | 轻快跳动，少冲突多糖点 | 日系小清新 + 钢琴/木吉他 | 3-5min × 8-10 集 | 中档 |
| 逆袭 | `counter_female_revenge`（离婚重生/打脸前夫） | 30-45 女性 / 憋屈后爽点 | 憋屈 → 爆发 → 打脸循环 | 冷色切暖，打脸配电子鼓点 | 5-8min × 10-12 集 | 严档（复仇尺度） |
| 逆袭 | `counter_male_rise`（屌丝崛起/战神归来） | 25-45 男性 / 身份爆响 | 慢铺垫 + 身份揭示爆点 | 深色 + 英雄交响 | 5-10min × 10-12 集 | 严档（以暴制暴） |
| 悬疑 | `suspense_criminal`（刑侦推理） | 25-40 混合 / 烧脑反转 | 线索铺设 + 怀疑切换 + 真相反转 | 低饱和 + 弦乐悬疑 | 6-12min × 6-10 集 | 严档（暴力/真实案件） |
| 悬疑 | `suspense_psych`（心理悬疑） | 28-45 混合 / 心理战 | 缓慢压迫 + 信息差 | 冷灰蓝 + 氛围 pad | 5-8min × 6-8 集 | 严档（精神病简化） |
| 穿越 | `time_ancient_female`（现代女穿古） | 25-40 女性 / 金手指爽 | 现代知识降维打脸 | 古装 + 电子混合 | 5-8min × 10-12 集 | 中档（历史人物改写） |
| 穿越 | `time_reborn`（重生复仇） | 28-45 女性 / 预知爽感 | 预言铺垫 + 反杀循环 | 前世冷 / 今生暖对比 | 5-8min × 10-12 集 | 中档 |
| 古装 | `period_palace`（宫斗/宅斗） | 30-50 女性 / 权谋阴谋 | 阴谋节奏，缓中有急 | 暗调红金 + 古乐 | 6-10min × 10-12 集 | 严档（朝代/礼仪/民族） |
| 古装 | `period_wuxia`（仙侠/玄幻） | 20-40 混合 / 奇幻修真 | 打斗 + 情劫交织 | 高饱和 + 大编制交响 | 6-12min × 10-12 集 | 中档（封建迷信边界） |
| 都市 | `urban_marriage`（闪婚豪门/家庭伦理） | 28-45 女性 / 情感纠纷 | 生活流 + 戏剧事件 | 日常写实 + 抒情 | 5-8min × 10-12 集 | 中档（三观/出轨洗白） |
| 都市 | `urban_career`（职场逆袭） | 25-40 混合 / 职场打怪 | 职场冲突 + 情感支线 | 都市冷调 + 节奏打击 | 5-8min × 10-12 集 | 中档 |

**tone × hookPattern 速查：**

| tone | hookPattern 偏好 | 句式偏好 | 代表起手 |
|------|----------------|---------|---------|
| `reversed_high_energy` | conflict_first / reversal | 强语气 + 短爆 | "你给我出去！" |
| `warm_tugging` | emotional_peak / prequel_callback | 温柔短句 + 气口 | "5 年前的那个下午……" |
| `suspense_dark` | mystery / cliff_dangling | 断续疑问 | "你注意到那个瓶子了吗？" |
| `comedic` | conflict_first（荒诞） | 古今混搭 / 反差 | "小的该死……等等我明天要直播" |

> 每个子类型的完整规范（完整分镜模板 / 24 项质量阈值 / 配音风格 / 画面色调 / 配乐 BPM 与引子 / 每平台（抖音/快手/红果）投放偏好 / 各子变体 few-shot 正反例全集 / 人物关系图谱 / 中段反转公式库）
> 见 [src/lib/agent/skills/duanju-subtemplates.ts](../../src/lib/agent/skills/duanju-subtemplates.ts)
> （当前为 stub，12 子模板的 detailed specs 将由 follow-up issue 填充）

## 工作流 Checklist

**Mode A：generate_series_bible（生成系列圣经）**

- [ ] Step 0: 理解概念定位 + `genre` 主类型
- [ ] Step 1: 确定核心冲突与戏剧张力
- [ ] Step 2: 设计主要角色（3-6 个，含 personalityKeywords + catchphrase）
- [ ] Step 3: 规划世界观 + 不变原则（`globalRules`）
- [ ] Step 4: 分集故事大纲（按 `targetEpisodes` 起承转合）
- [ ] Step 5: 宣发 tagline + 合规预检（整体调性）

**Mode B：generate_episode（生成分集剧本）**

- [ ] Step 0: 加载 series bible + 前 1 集 cliffhanger + 关键台词/动作
- [ ] Step 1: 明确本集定位（开篇 / 承接 / 中段推进 / 大反转 / 收线 / 终集）
- [ ] Step 2: 本集核心事件与冲突（外部 / 内部 / 关系）
- [ ] Step 3: 角色动态更新（哪些出场 / 心理状态变化 / 关系微妙变化）
- [ ] Step 4: 设计 3 秒钩子（选 6 种 hookPattern 之一）
- [ ] Step 5: 分场写作（3-6 场，起 15-20% / 承 25-30% / 转 25-30% / 合 20-25%）
- [ ] Step 6: 埋反转点 ≥ 1 次 major（反转前必埋 1 明 1 暗 2 条线索）
- [ ] Step 7: 写 cliffhanger（定格画面 + 未知感）
- [ ] Step 8: 下集预告（可选，2-4 句 + 1 悬画 + 1 金句）
- [ ] Step 9: IP 一致性自检（台词风格 / globalRules / catchphrase / 世界观）
- [ ] Step 10: 广电 + 价值观合规扫描
- [ ] Step 11: 节奏质检（见下节 10 项阈值）

**场景格式规范（行业标准）：**

```
场 3 - 内 - 顾总办公室 - 夜

[动作]
暴雨敲窗。顾总独自坐在办公桌前，手机屏幕亮起——"她已读不回"。

顾总
（自语，拳头握紧）
江眠……你到底想怎样？
```

## 质量把关

**自检阈值表（10 项核心，完整 24 项见外置）：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | 钩子时长 / 字数 | ≤ 5s / ≤ 30 字（口播+字幕合计） |
| 2 | 钩子命中 hookPattern | ≥ 1 种（conflict_first / reversal / cliff_dangling / prequel_callback / mystery / emotional_peak） |
| 3 | 场次数 | 3-6 场，单场占比 ≤ 35% |
| 4 | 反转点数量 | ≥ 1 次 major；5+ 集系列建议 2 次 |
| 5 | cliffhanger 完整性 | 画面定格 + 未知感 + `visualFreezeFrame` 非空 |
| 6 | 本集字数 × 0.5 ≈ targetDurationSec | ±15% 偏差 |
| 7 | 对白 ≤ 20 字占比 | ≥ 70% |
| 8 | 口语化程度 | 无"您将/我们来/让我们/综上所述"等书面词 |
| 9 | 潜台词比例 | ≥ 20% 对白含 subtext |
| 10 | `ipConsistencyCheck.passed` + `complianceCheck.passed` | 双 true（valueAlignment ≥ neutral） |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 角色性格跳脱 | 冷漠总裁本集突然温柔啰嗦 | Step 0 强制读 series bible + 前集；Step 9 对比 `personalityKeywords` |
| 钩子太慢 / 平淡 | 前 10 秒还在交代背景；书面配音 | Step 4 强制 3s 内进冲突；禁"今天又是美好的一天"类开头 |
| 反转突兀无铺垫 | 第 3 场突变身份，前面毫无线索 | Step 6 强制反转前 1 明 1 暗 2 条伏笔 |
| cliff 虚假 / 普通收尾 | 下集开头跳过悬念；"今天就到这里了" | Step 7 强制 `visualFreezeFrame` 字段；下集 Step 0 必须承接 |
| 废戏冗长 / 类型混乱 | 一场戏 90s 没推进；甜宠写出悬疑氛围 | Step 5 "每场必推进剧情 ≥ 1 次"；每类型锁定专属 style guide |

## 合规红线（广电 + 短剧特有）

**全类型共同硬红线（《广告法》《网络视听节目内容审核通则》《英雄烈士保护法》）：**

| 禁忌类别 | 具体禁 | 依据 |
|---------|-------|------|
| 低俗 / 软色情 | 色情擦边 / 露骨性暗示 / 强制情节 | 《审核通则》§6 |
| 暴力血腥 | 血腥特写 / 残忍虐待 / 自杀细节（割腕/跳楼）/ 自残方式 | 《审核通则》§6 |
| 未成年人保护 | 学生早恋（未成年）/ 早孕 / 校园暴力美化 / 未成年性暗示 | 《未成年人保护法》+ 《审核通则》§6 |
| 价值观扭曲 | 炫富拜金 / 物化女性 / 仇恨全剧无消解 / 三观扭曲（出轨被洗白） | 《审核通则》§9 |
| 违法犯罪美化 | 洗钱 / 诈骗 / 赌博 / 吸毒作为主角手段且未被惩处 | 《审核通则》§6 |
| 低劣恶搞 | 调侃英烈 / 历史人物 / 民族英雄 | 《英雄烈士保护法》 |
| 国家 / 地域歧视 | 地域黑 / 民族冲突 / 丑化特定朝代 | 《审核通则》§9 |
| 特殊群体调侃 | 残疾人 / 特殊职业 / 精神病（作为反转"解谜"） | 《审核通则》§9 |
| 敏感职业负面 | 国家机关工作人员大面积负面 / 医生/教师/警察群体丑化 | 《审核通则》§6 |
| 封建迷信 | 宣扬阴阳术 / 算命作为核心解决方案 | 《审核通则》§10 |
| 政治敏感 | 政党/领导人+负面词搭配 / 台独港独藏独 | 宪法 + 广电红线 |

**仅允许在明确反派 / 戏剧冲突需要 + 最终惩处 + 不美化的前提下涉及。**

**类型特殊禁忌：**

| 类型 | 特殊禁忌 |
|------|---------|
| 甜宠 | 男主暴力 / 精神控制 / 胖辱 / PUA 被浪漫化 |
| 逆袭 | 过度炫富 / 复仇无底线（害人全家）/ 私刑正义 |
| 悬疑 | 凶手动机是"精神病"（简化心理）/ 真实案件过度还原 |
| 穿越 | 随意改写真实历史 / 丑化特定朝代 / 民族主义极端 |
| 古装 | 称谓 / 礼仪常识性错误 / 朝代乱串 |
| 都市 | 医生/教师/警察群体负面 / 出轨被洗白 / 三观扭曲 |

**合规扫描实现**：Step 10 调用合规扫描；命中红：不交付；黄：交付但标注；绿：可用。`complianceCheck.passed = false` 时必修重写。

## 输出模板 / 示例

**甜宠第 1 集开篇片段（裴总的掌心梨）：**

```markdown
### 钩子（0-3s，hookPattern: conflict_first）
[画面] 江嘉月紧张推开厚重的黑胡桃木门。门后，裴总正在签字，头也没抬。
[字幕] 我以为这只是一次面试。

### 场 1 - 内 - 裴氏集团总裁办公室 - 日
江嘉月手里攥着作品集，站在门口不敢进。

裴淮恩（头都不抬）关门。
江嘉月赶紧关门，屏住呼吸。
裴淮恩（签完字，抬眼）坐。
（翻作品集，停在某一页）这是你设计的？
江嘉月（点头）……嗯，大学毕业作品。
裴淮恩（合上）一周后来上班。

### 反转（场 2）
江嘉月走出大楼，打开手机——发现自己投简历的公司说：
"江小姐，您好，您的面试时间改为下周一。"
（镜头拉远，大楼外墙：裴氏集团，总裁：裴淮恩。）
江嘉月（自语，瞳孔地震）……我刚才面试错公司了？！

### Cliffhanger
[画面] 手机又震动。屏幕显示："来电：裴淮恩"。江嘉月的手抖了。画面定格。
```

**反例（禁止）**：
> `[画面]` 女主站在窗前看天空 / `[配音]` "今天又是美好的一天，让我们继续昨天的故事……" / 涨薪太顺利无反转 / 结尾"今天真是美好的一天"
>
> —— 踩雷点：钩子零冲突；零反转（起承转合缺失）；书面化（"让我们"）；cliff 为零；废戏；无情绪点。

完整正反例集（每子类型 ≥ 3 正例 + ≥ 1 反例）见外置 subtemplates 文件。

## EXTEND.md 示例

```yaml
# 默认类型与风格
default_genre: sweet_romance
default_tone: reversed_high_energy
default_episode_duration: 300
default_episode_count: 8

# 平台偏好
platform_preference: douyin                 # douyin / kuaishou / redfruit
douyin_style:
  hook_impact: high
  reversal_count_per_episode: 2
  cliff_intensity: peak                     # peak / strong / medium

# 合规严格度
compliance_strictness: high                 # high / medium / low

# 角色模板（可复用，跨系列）
reusable_characters:
  - name: 顾总模板
    role: 男主角
    personalityKeywords: [冷漠, 霸道, 反差萌, 占有欲]
    catchphrase: "过来。"
  - name: 女主社畜模板
    role: 女主角
    personalityKeywords: [外表柔弱, 内心坚韧, 逆袭潜质]

# 全局禁忌扩展
extra_banned_elements:
  - 学生早恋（未成年）
  - 宗教题材
  - 台独/港独/藏独

# 类型默认参数
genre_defaults:
  sweet_romance:
    sweet_moment_frequency: 每 90s 一次
  counter_attack:
    face_slap_count_per_episode: ">= 2"
  suspense:
    red_herring_per_episode: ">= 1"
```

## 上下游协作

- **上游**：运营/策划提供 concept brief 或 series bible；热点分析（`trending_topics`）影响剧本题材；`knowledge_retrieval` 从案例库捞相似爆款；leader/xiaoce 派单
- **下游**：`aigc_script_push`（推华栖云 AIGC 做视频渲染，本期占位）；`cms_publish`（type=1 图文稿入 CMS 供编辑审阅）；`quality_review`（严档，政治/价值观/广电三道审）；下一集 `duanju_script`（用本集作为前序上下文）
- **员工协作**：发起 xiaoce → 执行 xiaowen → 审核 xiaoshen（严档）

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 角色性格前后不一致 | 前集剧本未作为上下文 | 确保 `seriesBible.characters` + 前集关键台词明列；Step 9 严格校验 |
| 钩子平淡 / 书面化 | tone/genre 未激活 / LLM 默认偏书面 | 明确写入 prompt；加 few-shot 参照；严格字数限制 |
| 反转太弱 / 突兀 | 未按公式设计 / 无铺垫 | Step 6 强制选择 reversal pattern + 1 明 1 暗 2 条伏笔 |
| cliff 不悬 / 虚假 | 未用定格画面 / 下集不接 | Step 7 强制 `visualFreezeFrame`；下集 Step 0 必接 |
| 合规误伤 | 扫描规则过严 | EXTEND.md 调低 `compliance_strictness` |
| 类型混搭 | genre 模糊 | 只允许一个主类型；sub-genre 做次要调性 |
| 系列跳脱 | 全局规则未定义 | 第 1 集必写 `globalRules`；后续集严格校验 |
| 反派扁平 / 女性物化 | 反派只有恶没有动机 / 角色工具人化 | Step 3 反派也要有动态；女主必须有独立目标，冲突不只是"男主拯救" |
| 与姊妹 skill 选错 | 非分集走 `content_generate[drama_serial]`；纪录片走 `script_generate[documentary_short]` |

## 参考资料

- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)（通用 agent 执行入口；skill 逻辑通过 prompt 驱动）
- 子模板规范：[src/lib/agent/skills/duanju-subtemplates.ts](../../src/lib/agent/skills/duanju-subtemplates.ts)（stub，12 子模板 detailed specs 待 follow-up 填充）
- 参考 Spec：[docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md](../../docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md) · 历史：`git log --follow skills/duanju_script/SKILL.md`
