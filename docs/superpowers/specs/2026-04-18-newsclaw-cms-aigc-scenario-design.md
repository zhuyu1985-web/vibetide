# NewsClaw 智媒工作空间 — CMS + AIGC 场景化生产流水线深化设计

> **版本**: 1.0
> **作者**: 系统架构组
> **日期**: 2026-04-18
> **状态**: Draft — 批次 1（架构骨干）已完成，批次 2/3 待撰写
> **目标**: 将 VibeTide 从可演示形态升级为**可生产运营**的全自动 AIGC 内容生产平台，产出物通过 CMS 发布到华栖云 APP

---

## 决策记录（Decision Log）

| ID | 决策 | 结论 |
|----|------|------|
| D1 | CMS 入稿类型范围 | 全类型：type 1(图文)/2(图集)/4(外链)/5(视频)/11(音频) |
| D2 | AIGC 视频 Provider | 多 provider 抽象架构；本期仅跑通华栖云自研 |
| D3 | 本期 VibeTide 视频边界 | 只生产脚本，不做渲染、不做拆条 |
| D4 | 每日专题机制 | 新增独立 `daily_content_plans` 模型 |
| D5 | 交付范围 | 一次全做 9 大场景 |
| D6 | 短剧形态 | 仅生成剧本，不做渲染 |
| D7 | 栏目映射 | 通过 CMS 三步同步接口（渠道→应用→栏目树） |
| D8 | AI 员工架构 | 保留 10 员工不变；场景专家作为**工作流模板预设人设** |
| D9 | 审核分档 | 两档（严/松）+ 栏目独立覆盖 |
| D10 | 文档深度 | 详细设计（可生产化运营） |
| D11 | 视频场景数据流 | 单向推送（方案 A）：推给华栖云 AIGC 即完成职责 |
| D12 | 拆条范围 | 本期整体撤掉，视频只输出脚本 |
| D13 | Skill MD 深度 | 生产级 15 要素标准，单个 skill MD 400-700 行 |

---

## 文档结构

本文档采用**主文档 + 子文档**结构：

```
docs/superpowers/specs/
├─ 2026-04-18-newsclaw-cms-aigc-scenario-design.md   (主文档，含全部章节)
└─ 2026-04-18-newsclaw-cms-aigc-scenario-design/      (子目录)
    └─ skills/
        ├─ cms_publish.md                  (批次 2)
        ├─ aigc_script_push.md             (批次 2)
        ├─ zhongcao_script.md              (批次 2)
        ├─ tandian_script.md               (批次 2)
        ├─ podcast_script.md               (批次 2)
        ├─ duanju_script.md                (批次 2)
        ├─ zongyi_highlight.md             (批次 2)
        ├─ content_generate_rewrite.md     (批次 2)
        ├─ headline_generate_rewrite.md    (批次 2)
        ├─ summary_generate_rewrite.md     (批次 2)
        ├─ style_rewrite_rewrite.md        (批次 2)
        └─ script_generate_rewrite.md      (批次 2)
```

---

# 第 1 章 · 全局架构总览

## 1.1 系统责任边界

VibeTide 在整个华栖云融媒体生产链条中的定位是「**生产大脑**」，上承台内热点与素材，下接 CMS 发布与 AIGC 渲染。

```
┌───────────────────────────────────────────────────────────────────┐
│                       VibeTide 职责边界                           │
│                                                                    │
│   [输入]                  [生产]                   [输出]          │
│   ┌─────────┐           ┌─────────┐            ┌───────────┐      │
│   │ 全网热点 │──────────▶│         │───────────▶│ CMS        │      │
│   │ 台内素材 │           │ AI 员工  │            │ /save      │──▶APP│
│   │ 每日指令 │           │ Workflow │            │  (图文/音) │      │
│   └─────────┘           │ Mission  │            └───────────┘      │
│                          │         │            ┌───────────┐      │
│                          │         │───────────▶│ AIGC       │      │
│                          └─────────┘            │ /script    │──▶AIGC渲染→APP│
│                                                 │ (视频脚本) │      │
│                                                 └───────────┘      │
└───────────────────────────────────────────────────────────────────┘

职责边界：
  ✔ VibeTide 对 CMS 入库全程负责（鉴权/字段映射/重试/入库确认）
  ✔ VibeTide 对视频脚本生成与推送到 AIGC 负责
  ✔ VibeTide 接收 AIGC 阶段性回调（渲染完成/已入 CMS/已发布/失败）
     用于任务中心的状态展示与闭环追踪（被动接收，不驱动业务动作）
  ✘ VibeTide 不直接执行视频渲染、VMS 入库、视频 CMS 入库、APP 分发
     （这些由 AIGC 平台负责）
  ✘ VibeTide 不做视频拆条（本期推迟）
```

## 1.2 三层架构

```
┌────────────────────────────────────────────────────────────┐
│ 第一层：生产层（Production Layer）                          │
│   已有模块：Mission 引擎、Workflow Templates、10 AI 员工、  │
│              32 Skills、Intent Recognition、Agent Assembly  │
│   本期扩展：                                                │
│   • 新增 7 个场景 skill（种草/探店/播客/短剧/综艺/CMS入库/AIGC推送）│
│   • 重写 5 个通用 skill（按 9 场景分化子模板）             │
│   • 10 AI 员工系统提示词增量（含场景化分支）                │
│   • 9 个场景化 Workflow Templates（新闻/时政/体育/综艺/种草/探店/播客/短剧/首页聚合）│
│   • daily_content_plans 每日 AIGC 专题引擎                   │
└────────────────────────────────────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────────┐
│ 第二层：适配层（Adapter Layer） — 本期核心新增               │
│   • CMS Adapter（src/lib/cms/）                             │
│       鉴权 / 5 接口客户端 / 5 type mapper / 栏目同步       │
│   • AIGC Video Adapter（src/lib/aigc-video/）               │
│       Provider 抽象 / 华栖云占位 / 5 脚本 schema / 状态追踪 │
│   • 审核分档引擎（src/lib/review-tier/）                    │
│       两档规则 + 栏目独立覆盖                               │
└────────────────────────────────────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────────┐
│ 第三层：出口层（Output Layer） — 外部系统                    │
│   • 华栖云 CMS（/web/article/save）→ APP（首页/新闻/时政/ │
│     体育/综艺/民生/短剧）                                   │
│   • 华栖云 AIGC 生产平台（接口待对接）                      │
└────────────────────────────────────────────────────────────┘
```

## 1.3 端到端数据流图（双通道）

### 通道 1：文字/图文/音频闭环（VibeTide 全程负责）

```
用户/热点触发 / cron / Mission 创建
        │
        ▼
  Leader 拆解 → 分派 AI 员工
        │
        ▼
  AI 员工执行 Skills（按场景）
        │
        ▼
  produce workflow_artifacts（articles 表）
        │
        ▼
  质量审核 Skill（按栏目审核档位）
        │
        ├─ 不通过 ── 打回重写
        │
        └─ 通过
             │
             ▼
  cms_publish Skill：
    1. 查 app_channels 拿 siteId / appId / catalogId / listStyleDto 默认值
    2. Article Mapper：VibeTide article → CMS ArticleSaveDTO
    3. POST CMS /web/article/save
    4. 记录 cms_publications（vibetide_id ↔ cms_article_id）
    5. 轮询 getMyArticleDetail 确认状态 30→发布 / 60→重新编辑
        │
        ▼
  CMS 内部流转 → APP 对应栏目展示
```

### 通道 2：视频脚本单向推送（VibeTide 只到脚本出厂）

```
用户/热点触发 / cron / Mission 创建
        │
        ▼
  AI 员工产出视频脚本（按场景：新闻脚本/种草脚本/探店脚本/短剧剧本...）
        │
        ▼
  脚本审核 Skill（合规检查）
        │
        ▼
  aigc_script_push Skill：
    1. 选 Provider（本期：huashengyun）
    2. Script Schema 校验（zod）
    3. POST {AIGC_HOST}/script/submit（接口契约见 §4.4）
    4. 收到 AIGC 返回的 jobId，记录 aigc_script_submissions
        │
        ▼
  VibeTide 脚本推送职责完成
        │
        │ （以下由华栖云 AIGC 执行，VibeTide 被动接收回调）
        │
        ▼
  AIGC 渲染完成 ──┐
  VMS 入库     ──┤
  CMS 视频入库  ──┼── 阶段性回调 ──▶ POST /api/aigc-video/callback
  APP 已发布    ──┘                          │
                                             ▼
                                  更新 aigc_submissions 状态
                                  （rendering / rendered / cms_published /
                                   app_published / failed）
                                             │
                                             ▼
                                  VibeTide 任务中心实时展示：
                                    • 当前状态 + 进度百分比
                                    • 预估完成时间
                                    • 最终视频预览（URL）
                                    • CMS 文章详情链接 + 预览
                                    • 失败原因（若 failed）
```

### 任务中心闭环可视化

所有通过 AIGC 推送的任务在 VibeTide 任务中心（Mission Detail + 新增 AIGC 任务列表）可查：

| 状态 | 含义 | VibeTide 可展示 |
|------|------|----------------|
| `submitting` | 正在推送脚本 | 进度环（旋转） |
| `submitted` | 脚本已接收，等待渲染 | 等待条 + 预估完成时间 |
| `rendering` | AIGC 正在渲染 | 进度条 + 已渲染百分比（如回调带） |
| `rendered` | 视频渲染完成，等待入 CMS | 视频预览按钮可点 |
| `cms_published` | CMS 稿件已入库 | CMS 文章链接（跳转预览） |
| `app_published` | APP 已可见 | APP 深链（若有） |
| `failed` | 任一环节失败 | 错误码 + 描述 + 重试按钮 |

## 1.4 关键外部依赖清单

| 系统 | 接口/资源 | 凭证 | 本期状态 |
|------|----------|------|----------|
| 华栖云 CMS | `POST /web/article/save` | `login_cmc_id` + `login_cmc_tid` | ✅ 已有接口文档 |
| 华栖云 CMS | `POST/GET /web/article/getMyArticleDetail` | 同上 | ✅ 已有 |
| 华栖云 CMS | `POST /web/catalog/getChannels` | 同上 | ✅ 已有 |
| 华栖云 CMS | `POST /web/application/getAppList` | 同上 | ✅ 已有 |
| 华栖云 CMS | `POST /web/catalog/getTree` | 同上 | ✅ 已有 |
| 华栖云 AIGC | `POST /script/submit`（占位） | TBD | ⏳ 待对接 |
| 华栖云 AIGC | `GET /script/status/:jobId`（占位） | TBD | ⏳ 待对接 |
| 华栖云 MMS/CMC | 鉴权刷新接口 | TBD | ⏳ 后续 Phase |

**本期凭证策略**：
- `.env.local` 存 `CMS_HOST` / `CMS_LOGIN_CMC_ID` / `CMS_LOGIN_CMC_TID`（使用用户提供的固定值）
- `AIGC_HOST` / `AIGC_TOKEN` 预留 env，值待对接
- 后续 Phase 2 接入 MMS/CMC 动态鉴权流程

## 1.5 目录结构 & 模块命名

```
src/
├── lib/
│   ├── cms/                                   [新增·批次 1]
│   │   ├── client.ts                          HTTP 客户端 + 鉴权 + 重试
│   │   ├── api-endpoints.ts                   5 接口封装
│   │   ├── types.ts                           CMS 请求/响应 DTO
│   │   ├── article-mapper/                    VibeTide → CMS 映射
│   │   │   ├── type1-article.ts               普通新闻
│   │   │   ├── type2-gallery.ts               图集
│   │   │   ├── type4-external.ts              外链
│   │   │   ├── type5-video.ts                 视频新闻
│   │   │   └── type11-audio.ts                点播音频
│   │   ├── catalog-sync.ts                    三步同步流程
│   │   ├── status-machine.ts                  入库状态机
│   │   ├── errors.ts                          错误类型
│   │   └── index.ts                           统一出口
│   │
│   ├── aigc-video/                            [新增·批次 1]
│   │   ├── types.ts                           Script Schema (zod)
│   │   ├── provider.ts                        Provider 抽象接口
│   │   ├── providers/
│   │   │   ├── huashengyun.ts                 华栖云 Provider（占位）
│   │   │   └── mock.ts                        测试 Mock Provider
│   │   ├── registry.ts                        Provider 注册表
│   │   ├── submission.ts                      推送 + 状态管理
│   │   └── index.ts
│   │
│   ├── review-tier/                           [新增·批次 2]
│   │   ├── rules.ts                           严/松规则
│   │   ├── catalog-override.ts                栏目独立覆盖
│   │   └── index.ts
│   │
│   ├── dal/
│   │   ├── cms-publications.ts                [新增]
│   │   ├── aigc-submissions.ts                [新增]
│   │   ├── cms-channels.ts                    [新增]
│   │   ├── cms-apps.ts                        [新增]
│   │   ├── cms-catalogs.ts                    [新增]
│   │   ├── app-channels.ts                    [新增]
│   │   ├── daily-content-plans.ts             [新增]
│   │   ├── review-rules.ts                    [新增]
│   │   └── ... (已有 DAL 保持)
│   │
│   └── agent/
│       └── tools/                             [已有，扩展]
│
├── app/
│   ├── actions/
│   │   ├── cms.ts                             [新增] CMS 相关 server actions
│   │   ├── aigc-video.ts                      [新增]
│   │   ├── daily-content.ts                   [新增]
│   │   └── ... (已有保持)
│   │
│   └── (dashboard)/
│       ├── daily-content/                     [新增] 每日专题编排中心
│       ├── settings/
│       │   ├── cms-mapping/                   [新增] CMS 栏目映射配置
│       │   └── review-rules/                  [新增] 审核规则配置
│       └── ... (已有保持)
│
├── db/
│   └── schema/
│       ├── cms-publications.ts                [新增]
│       ├── aigc-submissions.ts                [新增]
│       ├── cms-mapping.ts                     [新增：channels/apps/catalogs/app_channels]
│       ├── daily-content-plans.ts             [新增]
│       └── review-rules.ts                    [新增]
│
└── inngest/
    └── functions/
        ├── cms-publish.ts                     [新增] 异步入库
        ├── cms-status-poll.ts                 [新增] 入库状态轮询
        ├── aigc-script-push.ts                [新增] 异步推送
        ├── cms-catalog-sync.ts                [新增] 栏目同步 cron
        └── daily-content-trigger.ts           [新增] 每日专题触发器

skills/
├── cms_publish/SKILL.md                       [新增·批次 2]
├── aigc_script_push/SKILL.md                  [新增·批次 2]
├── zhongcao_script/SKILL.md                   [新增·批次 2 — 种草视频脚本]
├── tandian_script/SKILL.md                    [新增·批次 2 — 探店视频脚本]
├── podcast_script/SKILL.md                    [新增·批次 2 — 播客口播稿]
├── duanju_script/SKILL.md                     [新增·批次 2 — 短剧剧本]
├── zongyi_highlight/SKILL.md                  [新增·批次 2 — 综艺看点稿]
├── content_generate/SKILL.md                  [重写·批次 2 — 拆分 9 场景子模板]
├── headline_generate/SKILL.md                 [重写·批次 2]
├── summary_generate/SKILL.md                  [重写·批次 2]
├── style_rewrite/SKILL.md                     [重写·批次 2]
├── script_generate/SKILL.md                   [重写·批次 2]
└── ... (其他 20+ skill 保持)
```

**模块命名约定**：
- 新增目录一律用 kebab-case（`cms-publish` / `aigc-script-push`）
- Skill slug 用 snake_case（`zhongcao_script`，保持与现有 `content_generate` 一致）
- 中文场景名对应拼音 slug：种草→zhongcao / 探店→tandian / 播客→podcast / 短剧→duanju / 综艺→zongyi

## 1.6 非功能性要求

| 类别 | 要求 |
|------|------|
| 入库成功率 | ≥ 99%（异常自动重试 3 次，失败入告警队列） |
| 入库时延（P95） | ≤ 5 秒（从 AI 员工完成到 CMS 返回 article id） |
| 并发能力 | 单 organization 支持 ≥ 20 篇/分钟入库（Inngest 并发控制） |
| 幂等性 | 同一 VibeTide article 多次入库，CMS 端仅存在一篇（以 `articleId` 复用机制实现） |
| 鉴权失败降级 | 凭证过期时暂停入库队列，触发告警，不静默失败 |
| 审计可追溯 | 每次入库/推送留痕（请求体/响应/耗时/错误） |
| 栏目同步 | 每 24h 自动同步一次（可手动触发），变更写 audit 日志 |
| 视频脚本推送 | ≥ 95% 首次成功；失败可手动重试 |

---

# 第 2 章 · 9 大场景 × APP 栏目映射总览

## 2.1 场景映射总表

| ID | APP 栏目 | 场景 Slug | 本期落地产物 | CMS type | 推 AIGC | 默认员工团队 | Workflow 模板 ID | 审核档位 |
|----|---------|----------|-------------|----------|---------|------------|-----------------|---------|
| S1 | 首页 | `home_digest` | 首页推荐位聚合（从已发布稿件挑选，不独立生产） | — | ✗ | xiaofa + xiaoshu | `wt_home_digest_daily` | — |
| S2 | 新闻 | `news_standard` | 新闻图文稿 + 新闻视频脚本 | 1 | ✓ | xiaolei + xiaoce + xiaowen + xiaoshen + xiaofa | `wt_news_std` | 严 |
| S3 | 时政 | `politics_shenzhen` | 时政图文 + 解读视频脚本 | 1 | ✓ | xiaolei + xiaoce + xiaowen + xiaoshen | `wt_politics_sz` | 严 |
| S4 | 体育 | `sports_chuanchao` | 赛事战报图文 + 赛事解说视频脚本 | 1 | ✓ | xiaolei + xiaowen + xiaojian | `wt_sports_cc` | 松 |
| S5 | 综艺 | `variety_highlight` | 晚会盘点图文 + 综艺看点视频脚本 | 1 | ✓ | xiaoce + xiaowen + xiaojian | `wt_variety_hl` | 松 |
| S6 | 民生-种草 | `livelihood_zhongcao` | 种草视频脚本（必选）+ 种草图文（可选） | 1（可选） | ✓ | xiaowen + xiaojian + xiaofa | `wt_live_zhongcao` | 松 |
| S7 | 民生-探店 | `livelihood_tandian` | 探店视频脚本 + 探店图文稿 | 1 | ✓ | xiaolei + xiaowen + xiaojian | `wt_live_tandian` | 松 |
| S8 | 民生-播客 | `livelihood_podcast` | 播客口播稿（图文）+ 音频脚本（推 AIGC 生成音频） | 1 | ✓ | xiaowen + xiaoshen | `wt_live_podcast` | 严 |
| S9 | 短剧 | `drama_serial` | 短剧剧本（分集图文稿 type=1） | 1 | ✓ | xiaoce + xiaowen + xiaoshen | `wt_drama_serial` | 严（IP 连续性） |

## 2.2 每场景默认产物明细

### S2 新闻（news_standard）
- **图文稿**：800-2000 字，按新华体/央媒风格
  - 核心字段：title / summary / content(HTML) / keyword / tags / logo
  - 列表样式：`listStyleType=0 默认`（有图则带单图）
- **视频脚本**（推 AIGC）：3-5 分钟标准新闻解说稿
  - 分镜：8-15 镜 / 配音稿 / 画面提示

### S3 时政（politics_shenzhen）
- **图文稿**：深圳两会议题深度解读，1500-3500 字，严格引用官方表述
- **视频脚本**（推 AIGC）：5-10 分钟政策解读视频脚本
- 特别规则：必须引用"深圳市 X 届人大 X 次会议"、"XX 政府工作报告"等官方语;禁私自评论

### S4 体育（sports_chuanchao）
- **图文稿**：赛事战报 500-1500 字（赛前预告/赛后战报/球星特写）
  - 需含比分、关键球员、关键时刻、数据表
- **视频脚本**（推 AIGC）：2-4 分钟赛事解说脚本

### S5 综艺（variety_highlight）
- **图文稿**：晚会/综艺节目看点盘点，1000-2000 字（娱乐化风格）
- **视频脚本**（推 AIGC）：1-3 分钟综艺看点视频脚本

### S6 民生-种草（livelihood_zhongcao）
- **视频脚本**（必选）：30-60 秒小红书风种草视频脚本
  - 钩子开场 / 产品展示 / 使用场景 / 效果对比 / CTA
- **图文稿**（可选）：配套种草图文，可补充商品详情链接

### S7 民生-探店（livelihood_tandian）
- **视频脚本**（必选）：60-120 秒本地美食探店视频脚本
- **图文稿**：探店图文攻略 800-1500 字（地址/人均/必点/体验)

### S8 民生-播客（livelihood_podcast）
- **图文稿（口播稿）**：2-5 分钟口播稿 400-800 字（口语化、有呼吸节奏）
- **音频脚本**（推 AIGC）：TTS 提示 + 情绪标注 + BGM 提示

### S9 短剧（drama_serial）
- **剧本**（分集 type=1 图文稿）：每集 5-10 分钟剧本
  - 分场 / 对白 / 动作指示 / 钩子（每集开头 3 秒抓人）
  - 每个系列 5-12 集，支持系列元数据（角色表 / 剧情大纲）

## 2.3 员工团队默认组合

本期不新增员工，通过**工作流模板预设人设**让员工切换场景能力。

举例：`wt_sports_cc` 模板里 xiaowen 会被赋予"体育赛事官"人设（prompt 前缀 + 绑定 `script_generate[sports子模板]`）；到了 `wt_variety_hl` 模板里 xiaowen 变成"综艺看点官"（`script_generate[variety子模板]`）。

**人设注入机制**：
```typescript
// Workflow 模板 step config
{
  skillSlug: "script_generate",
  skillName: "脚本生成",
  personaPreset: "sports_commentator",  // ← 人设预设
  parameters: {
    sceneSlug: "sports_chuanchao",      // ← 场景 slug
    subtemplate: "sports",              // ← skill MD 子模板
  }
}

// Agent Assembly 阶段：
// 1. 加载 skill MD
// 2. 根据 subtemplate 读取对应子章节
// 3. 叠加 personaPreset 作为 prompt 前缀
// 4. 生成最终系统提示词
```

## 2.4 Workflow 模板编号规范

| 前缀 | 含义 | 示例 |
|------|------|------|
| `wt_` | workflow template | `wt_news_std` |
| `wt_*_daily` | 每日触发 | `wt_home_digest_daily` |
| `wt_*_weekly` | 每周触发 | `wt_ai_weekend` |
| `dp_` | daily plan（专题） | `dp_daily_ai_brief` |

## 2.5 审核分档归属

| 栏目 | 默认档位 | 可否覆盖 | 关键审核点 |
|------|---------|---------|----------|
| 新闻 | 严 | ✓ | 事实核查、敏感词、政治合规 |
| 时政 | 严 | ✗（强制严） | 官方表述、政治合规、数据准确 |
| 体育 | 松 | ✓ | 比分/球员名准确、避免地域对立 |
| 综艺 | 松 | ✓ | 艺人名错不得、低俗过滤 |
| 民生-种草 | 松 | ✓ | 广告法合规（禁"最""第一"）、真实性 |
| 民生-探店 | 松 | ✓ | 商家名准确、避虚假宣传 |
| 民生-播客 | 严 | ✓ | 口播顺畅、政策类口播需核查 |
| 短剧 | 严 | ✓ | 价值观导向、IP 连续性、敏感题材 |

详见 §10 审核分档章节。

---

# 第 3 章 · CMS 集成适配层（`src/lib/cms/`）

## 3.1 模块架构

```
src/lib/cms/
├── client.ts                      HTTP 客户端（鉴权/重试/超时/日志）
├── api-endpoints.ts               5 接口封装
├── types.ts                       CMS DTO
├── article-mapper/
│   ├── index.ts                   mapper 分发器（按 type 路由）
│   ├── common.ts                  公共字段映射（title/author/tags/...）
│   ├── type1-article.ts           普通新闻
│   ├── type2-gallery.ts           图集
│   ├── type4-external.ts          外链
│   ├── type5-video.ts             视频新闻（本期视频稿由外部入，预留）
│   └── type11-audio.ts            点播音频
├── catalog-sync.ts                三步栏目同步
├── status-machine.ts              入库状态机
├── errors.ts                      CmsError 子类
└── index.ts                       出口
```

## 3.2 HTTP 客户端（`client.ts`）

### 职责
- 统一处理 `login_cmc_id` / `login_cmc_tid` header
- 超时控制（默认 15s，可配）
- 自动重试（指数退避，1s/2s/4s，3 次封顶）
- 错误类型区分（鉴权失败/业务失败/网络超时/CMS 异常）
- 结构化日志（req_id / 耗时 / 状态码 / 错误码）

### 接口设计

```typescript
// src/lib/cms/client.ts
export interface CmsClientConfig {
  host: string;
  loginCmcId: string;
  loginCmcTid: string;
  timeoutMs?: number;        // default 15000
  maxRetries?: number;       // default 3
  retryBackoffMs?: number;   // default 1000, 指数增长
}

export class CmsClient {
  constructor(config: CmsClientConfig);

  post<TReq, TRes>(path: string, body: TReq, options?: CmsRequestOptions): Promise<CmsResponse<TRes>>;
  get<TRes>(path: string, query?: Record<string, string>, options?: CmsRequestOptions): Promise<CmsResponse<TRes>>;
}

export interface CmsResponse<T> {
  state: number;            // 200=成功
  message: string;
  success: boolean;
  data: T;
}

// 错误类型
export class CmsAuthError extends Error {}        // login_cmc_id / tid 失效
export class CmsBusinessError extends Error {}    // state != 200 的业务错误
export class CmsNetworkError extends Error {}     // 超时 / DNS / 连接拒绝
export class CmsSchemaError extends Error {}      // 返回结构与预期不符
```

### 鉴权失败处理
- 检测条件：`state=401 / 403` 或特定 message 关键字（如 "未登录"）
- 处理：抛 `CmsAuthError` + 入 Inngest dead-letter 队列 + 触发管理员告警
- **不静默重试**，因为重试只会加速 token 封禁

### 重试策略
```
try 1 (immediate) → fail →
  sleep 1000ms → try 2 → fail →
    sleep 2000ms → try 3 → fail →
      sleep 4000ms → try 4 → give up → dead-letter
```
仅对「网络错误 + 5xx」重试；4xx 与业务错误不重试。

## 3.3 接口客户端（`api-endpoints.ts`）

5 个接口统一通过 `CmsClient` 发送，每个封装为独立函数：

```typescript
// 文稿入库
export async function saveArticle(
  client: CmsClient,
  payload: CmsArticleSaveDTO
): Promise<CmsArticleSaveResponse>;

// 文稿详情
export async function getArticleDetail(
  client: CmsClient,
  articleId: string
): Promise<CmsArticleDetail>;

// 获取渠道列表
export async function getChannels(
  client: CmsClient,
  options?: { appAndWeb?: 0 | 1; privilegeFlag?: 0 | 1 }
): Promise<CmsChannelsResponse>;

// 获取应用列表
export async function getAppList(
  client: CmsClient,
  type: "1" | "2" | "3" | "4" | "5" | "6" | "13" | "21"
): Promise<CmsAppListResponse>;

// 获取栏目树
export async function getCatalogTree(
  client: CmsClient,
  options: {
    appId?: string;
    types?: string;          // "1" 新闻 / "4" 图片 / "19" 供稿库
    channelCode?: string;
    parentId?: string;
    catalogName?: string;
  }
): Promise<CmsCatalogTreeResponse>;
```

## 3.4 Article Mapper（`article-mapper/`）

### 通用字段映射（`common.ts`）

| CMS 字段 | VibeTide 来源 | 处理规则 |
|---------|---------------|---------|
| `title` | `article.title` | 保持原样；超长截断到 80 字 |
| `listTitle` | `article.title` | 同 title |
| `shortTitle` | `article.shortTitle` ?? 首 20 字 | 自动生成时取 summary 前 20 字 |
| `author` | `article.authorName` 或员工 nickname | 默认 "智媒编辑部" |
| `username` | ENV `CMS_USERNAME` | 固定账号名 |
| `summary` | `article.summary` | ≤ 200 字 |
| `keyword` | `article.tags.join(",")` | 取前 10 个 |
| `tags` | `article.tags.join(",")` | 同上 |
| `tagsFlag` | `"1"` | 开启 tag 展示 |
| `source` | `article.source ?? organization.brandName` | |
| `referType` | `9` | 固定（智媒 AI 自产） |
| `catalogId` | 来自 `app_channels.catalog_id` | 按场景映射 |
| `siteId` | 来自 `cms_apps.site_id` | 按场景映射 |
| `tenantId` | ENV `CMS_TENANT_ID` | 固定 |
| `loginId` | ENV `CMS_LOGIN_CMC_ID` | 固定 |
| `loginTid` | ENV `CMS_LOGIN_CMC_TID` | 固定 |
| `version` | `"cms2"` | 固定 |
| `publishDate` | `article.publishedAt?.getTime()` | 毫秒时间戳 |
| `addTime` | `Date.now()` | |
| `status` | `article.publishStatus` 映射 | 见下 |
| `docLabelsVo` | NER 抽取 | 批次 2 `cms_publish` skill |
| `appCustomParams` | 由场景决定 listStyle | 见下 |
| `logo` | `article.coverImageUrl` | 必填（有默认兜底图） |
| `commentFlag` | `"1"` | 默认允许评论 |
| `showReadingCountFlag` | `"1"` | |
| `tagsFlag` | `"1"` | |

### VibeTide `publishStatus` → CMS `status` 映射

| VibeTide | CMS status | 含义 |
|----------|-----------|------|
| `draft` | `"0"` | 初稿 |
| `pending` | `"20"` | 待发布 |
| `published` | `"30"` | 发布 |
| `rejected` | `"60"` | 重新编辑 |

### Type 1 普通新闻（`type1-article.ts`）

```typescript
export function mapToType1(
  article: Article,
  ctx: MapperContext
): CmsArticleSaveDTO {
  return {
    ...mapCommonFields(article, ctx),
    type: "1",
    content: ensureHtmlWrapper(article.body),    // body 包装成 <div id="editWrap">
    articleContentDto: {
      htmlContent: ensureHtmlWrapper(article.body),
      videoDtoList: [],
      imageDtoList: extractImagesFromHtml(article.body),
    },
    appCustomParams: {
      customStyle: {
        imgPath: [article.coverImageUrl],
        type: "0",                                // 0-默认单图
      },
      movie: { AppCustomParams: "默认" },
    },
    listStyleDto: {
      imageUrlList: [article.coverImageUrl],
      listStyleName: "默认",
      listStyleType: "0",
    },
  };
}

// body 包装规范（CMS 要求）
function ensureHtmlWrapper(body: string): string {
  if (body.includes('id="editWrap"')) return body;
  return `<div style="font-family:宋体;font-size:16px;letter-spacing:1.75px;line-height:1.75em;margin-top:5px;margin-bottom:15px;color:#000000;text-align:justify;text-indent:2em" id="editWrap">${body}</div>`;
}
```

### Type 2 图集（`type2-gallery.ts`）

```typescript
export function mapToType2(article: Article, ctx: MapperContext): CmsArticleSaveDTO {
  const images = article.galleryImages ?? [];
  return {
    ...mapCommonFields(article, ctx),
    type: "2",
    articleContentDto: {
      htmlContent: "",
      imageDtoList: images.map((img, i) => ({
        description: img.caption ?? `图片说明${i + 1}`,
        imageName: img.name ?? uuid(),
        imageUrl: img.url,
        sImageUrl: img.url,
        linkText: "",
        linkUrl: "",
      })),
      videoDtoList: [],
    },
    images: images.map((img, i) => ({
      contentSourceId: img.sourceId ?? uuid(),
      image: img.url,
      imageName: img.name ?? uuid(),
      note: img.caption ?? `图片说明${i + 1}`,
      linkText: "",
      linkUrl: "",
    })),
    appCustomParams: {
      customStyle: {
        imgPath: images.slice(0, 3).map(img => img.url),
        type: "2",                                // 2-多图
      },
      movie: { AppCustomParams: "默认" },
    },
    listStyleDto: {
      imageUrlList: images.slice(0, 3).map(img => img.url),
      listStyleName: "默认",
      listStyleType: "2",
    },
  };
}
```

### Type 4 外链（`type4-external.ts`）

```typescript
export function mapToType4(article: Article, ctx: MapperContext): CmsArticleSaveDTO {
  if (!article.externalUrl) {
    throw new CmsSchemaError("type=4 requires externalUrl");
  }
  return {
    ...mapCommonFields(article, ctx),
    type: "4",
    redirectUrl: article.externalUrl,
    content: "",
    articleContentDto: { htmlContent: "" },
    // type=4 通常不需要 listStyle 但保留默认避免前端渲染异常
    appCustomParams: { customStyle: { imgPath: [article.coverImageUrl], type: "3" } },  // 3-标题无图
    listStyleDto: { imageUrlList: [], listStyleName: "默认", listStyleType: "3" },
  };
}
```

### Type 5 视频（`type5-video.ts`）

**本期说明**：VibeTide 本期不直接入视频稿（视频由华栖云 AIGC 入库），但 mapper 函数实现保留，用于：
1. 未来需要 VibeTide 入库视频稿（如转载已有视频）
2. 脚本推送时记录配套元数据

```typescript
export function mapToType5(article: Article, ctx: MapperContext): CmsArticleSaveDTO {
  if (!article.videoId) {
    throw new CmsSchemaError("type=5 requires videoId from VMS");
  }
  return {
    ...mapCommonFields(article, ctx),
    type: "5",
    videoId: article.videoId,
    videoType: article.videoTypeCode ?? "5",  // 5-视频, 6-音频, 8-直播
    content: "",
    articleContentDto: {
      htmlContent: "",
      videoDtoList: [{ videoId: article.videoId }],
    },
    appCustomParams: {
      customStyle: { imgPath: [article.coverImageUrl], type: "0" },
      movie: { AppCustomParams: "默认" },
    },
    listStyleDto: { imageUrlList: [article.coverImageUrl], listStyleName: "默认", listStyleType: "0" },
  };
}
```

### Type 11 点播音频（`type11-audio.ts`）

```typescript
export function mapToType11(article: Article, ctx: MapperContext): CmsArticleSaveDTO {
  if (!article.audioId) {
    throw new CmsSchemaError("type=11 requires audioId from VMS");
  }
  return {
    ...mapCommonFields(article, ctx),
    type: "11",
    audioId: article.audioId,
    audioUrl: article.audioUrl,
    articleContentDto: {
      htmlContent: "",
      audioDtoList: [{ audioId: article.audioId }],
      imageDtoList: [],
      videoDtoList: [],
    },
    appCustomParams: {
      customStyle: { imgPath: [article.coverImageUrl], type: "0" },
      movie: { AppCustomParams: "默认" },
    },
    listStyleDto: { imageUrlList: [article.coverImageUrl], listStyleName: "默认", listStyleType: "0" },
  };
}
```

### Mapper 分发器（`article-mapper/index.ts`）

```typescript
export async function mapArticleToCms(
  article: Article,
  appChannelSlug: string
): Promise<CmsArticleSaveDTO> {
  const ctx = await loadMapperContext(appChannelSlug);
  const type = determineType(article);  // 基于 article.mediaType + 场景推导
  switch (type) {
    case "1":  return mapToType1(article, ctx);
    case "2":  return mapToType2(article, ctx);
    case "4":  return mapToType4(article, ctx);
    case "5":  return mapToType5(article, ctx);
    case "11": return mapToType11(article, ctx);
    default:   throw new CmsSchemaError(`Unsupported type: ${type}`);
  }
}

interface MapperContext {
  siteId: number;
  appId: number;
  catalogId: number;
  tenantId: string;
  loginId: string;
  loginTid: string;
  username: string;
  source: string;
  listStyleDefault: CmsListStyleDto;     // 从 app_channels 读取
  coverImageDefault: string;             // 兜底图 URL
}
```

## 3.5 栏目三步同步流程（`catalog-sync.ts`）

```typescript
export async function syncCmsCatalogs(organizationId: string): Promise<SyncResult> {
  const client = await buildCmsClient(organizationId);

  // Step 1: 拉渠道列表
  const channelsRes = await getChannels(client, { appAndWeb: 1 });
  const appChannel = channelsRes.data.CHANNEL_APP;
  if (!appChannel) throw new Error("CMS 未返回 CHANNEL_APP 渠道");

  // 落库 cms_channels
  await upsertCmsChannel(organizationId, {
    channelKey: "CHANNEL_APP",
    code: appChannel.code,
    name: appChannel.name,
    pickValue: appChannel.pickValue,
  });

  // Step 2: 拉应用列表（type=1 代表 APP 渠道）
  const appsRes = await getAppList(client, "1");
  const apps = appsRes.data;

  // 落库 cms_apps
  for (const app of apps) {
    await upsertCmsApp(organizationId, {
      cmsAppId: String(app.id),
      siteId: app.siteid,
      name: app.name,
      appkey: app.appkey,
      appsecret: app.appsecret,       // 加密存储
    });
  }

  // Step 3: 对每个应用拉栏目树
  const allCatalogs: CatalogRow[] = [];
  for (const app of apps) {
    const treeRes = await getCatalogTree(client, {
      appId: String(app.id),
      types: "1",                     // 新闻栏目
    });
    flattenTree(treeRes.data, app.id, allCatalogs);
  }

  // 落库 cms_catalogs（差量对比）
  const syncStats = await reconcileCmsCatalogs(organizationId, allCatalogs);

  return {
    channelsCount: 1,
    appsCount: apps.length,
    catalogsCount: allCatalogs.length,
    inserted: syncStats.inserted,
    updated: syncStats.updated,
    deleted: syncStats.deleted,
    durationMs: /* ... */,
  };
}

function flattenTree(nodes: CmsCatalogNode[], appId: number, out: CatalogRow[]) {
  for (const node of nodes) {
    out.push({
      cmsCatalogId: node.id,
      appId,
      siteId: node.siteId,
      name: node.name,
      parentId: node.parentId,
      innerCode: node.innerCode,
      alias: node.alias,
      treeLevel: node.treeLevel,
      isLeaf: node.isLeaf === 1,
      type: node.type,
      videoPlayer: node.videoPlayer,
      audioPlayer: node.audioPlayer,
      livePlayer: node.livePlayer,
      vlivePlayer: node.vlivePlayer,
      h5Preview: node.h5Preview,
      pcPreview: node.pcPreview,
      url: node.url,
    });
    if (node.childCatalog?.length) {
      flattenTree(node.childCatalog, appId, out);
    }
  }
}
```

### 触发机制
- **手动**：`/settings/cms-mapping` 点"立即同步"
- **定时**：Inngest `cms-catalog-sync` 函数每天 02:00 执行
- **首次启动**：organization 首次配置 CMS 凭证后自动触发一次

### 增量对比规则
- 按 `(organization_id, cmsCatalogId)` 查找：
  - 不存在 → insert
  - 存在且字段有变更 → update + 写 audit
  - 本地有但 CMS 返回没有 → 标记 `deleted_at`（软删除，不物理删除以避免引用失败）

## 3.6 入库状态机（`status-machine.ts`）

```
      ┌──────────┐
      │ pending  │ VibeTide 触发入库
      └────┬─────┘
           │ cms_publish skill
           ▼
      ┌──────────┐     5xx/超时/网络     ┌──────────┐
      │submitting├────────────────────▶│ retrying │
      └────┬─────┘                     └────┬─────┘
           │ CMS 返回 state=200              │
           │                                │ 3 次失败
           ▼                                ▼
      ┌──────────┐                    ┌──────────┐
      │ submitted│                    │  failed  │──▶ 告警 + 人工处理
      └────┬─────┘                    └──────────┘
           │ 轮询 getMyArticleDetail
           ▼
      ┌──────────┐
      │  synced  │ CMS.status=30 发布 → 终态
      └──────────┘
      ┌──────────┐
      │rejected_  │ CMS.status=60 重新编辑 → 回 VibeTide 审核台
      │by_cms    │
      └──────────┘
```

**记录表 `cms_publications`**：
```
id | article_id | cms_article_id | state | last_req | last_res | attempts | scheduled_at | submitted_at | synced_at | error_code | error_message
```

## 3.7 幂等策略

| 情况 | 策略 |
|------|------|
| 同一 article 多次触发入库 | 以 `cms_publications.article_id` 唯一约束保证；后续触发走 CMS `articleId` 复用（CMS 逻辑：带 articleId 走修改，不带走新增） |
| 重试时网络成功但 CMS 已入库 | 比对 `last_req_hash`，若与已成功的一致则跳过 |
| 多个 worker 同时执行 | 数据库行级锁 `SELECT FOR UPDATE SKIP LOCKED` |

## 3.8 配置项 & 环境变量

```bash
# .env.local

# CMS
CMS_HOST=https://console.demo.chinamcloud.cn/cmsback
CMS_LOGIN_CMC_ID=ac51d9649c03fa148b0a6d150e29de12
CMS_LOGIN_CMC_TID=267afa81ecd99962ef229c4bdcc1b33f
CMS_TENANT_ID=ca37d5448dbf436626c4333df819ec6d
CMS_USERNAME=superAdmin
CMS_DEFAULT_COVER_URL=https://.../default-cover.jpg
CMS_TIMEOUT_MS=15000
CMS_MAX_RETRIES=3

# AIGC（批次 1 预留，值待对接）
AIGC_HOST=<待华栖云提供>
AIGC_TOKEN=<待华栖云提供>
AIGC_CALLBACK_URL=<VibeTide 回调地址，若需>
AIGC_PROVIDER=huashengyun              # huashengyun | mock
```

---

# 第 4 章 · AIGC 脚本推送适配层（`src/lib/aigc-video/`）

## 4.1 模块架构

```
src/lib/aigc-video/
├── types.ts                           Script Schema (zod)
├── provider.ts                        Provider 抽象接口
├── providers/
│   ├── huashengyun.ts                 华栖云 Provider（占位）
│   ├── mock.ts                        本地测试 Provider
│   └── index.ts
├── registry.ts                        Provider 注册表
├── submission.ts                      推送主流程
├── script-schemas/                    5 种脚本 schema
│   ├── news-video.ts
│   ├── zhongcao.ts
│   ├── tandian.ts
│   ├── podcast-audio.ts
│   └── duanju.ts
└── index.ts
```

## 4.2 Provider 抽象接口（`provider.ts`）

```typescript
import type { ScriptPayload, ScriptSubmissionResult, ScriptStatusResult } from "./types";

export interface AigcVideoProvider {
  /** Provider 唯一标识 */
  readonly id: "huashengyun" | "kie" | "keling" | "runway" | "sora" | "mock";

  /** 显示名 */
  readonly displayName: string;

  /** 支持的脚本类型 */
  readonly supportedScriptTypes: ScriptType[];

  /** 推送脚本。必须幂等：相同 idempotencyKey 必须返回相同 jobId */
  submit(
    payload: ScriptPayload,
    options: SubmitOptions
  ): Promise<ScriptSubmissionResult>;

  /** 查询状态（可选，provider 不支持时返回 null） */
  getStatus(jobId: string): Promise<ScriptStatusResult | null>;

  /** 健康检查 */
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; message?: string }>;
}

export interface SubmitOptions {
  idempotencyKey: string;        // VibeTide 保证唯一
  callbackUrl?: string;          // 可选回调
  metadata?: Record<string, string>;  // 追溯用
}

export interface ScriptSubmissionResult {
  jobId: string;                 // Provider 返回的任务 ID
  acceptedAt: Date;
  estimatedCompleteAt?: Date;
  rawResponse: unknown;          // 原始响应存档
}

export type ScriptType =
  | "news_video"
  | "zhongcao_video"
  | "tandian_video"
  | "podcast_audio"
  | "duanju_video"
  | "zongyi_video";
```

## 4.3 华栖云 Provider（占位实现）

```typescript
// src/lib/aigc-video/providers/huashengyun.ts
export class HuashengyunProvider implements AigcVideoProvider {
  readonly id = "huashengyun" as const;
  readonly displayName = "华栖云自研 AIGC";
  readonly supportedScriptTypes: ScriptType[] = [
    "news_video", "zhongcao_video", "tandian_video",
    "podcast_audio", "duanju_video", "zongyi_video",
  ];

  constructor(private config: HuashengyunConfig) {}

  async submit(payload: ScriptPayload, options: SubmitOptions): Promise<ScriptSubmissionResult> {
    // ⚠️ 接口契约待对接 — 当前为占位实现
    const res = await fetch(`${this.config.host}/script/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.token}`,
        "X-Idempotency-Key": options.idempotencyKey,
      },
      body: JSON.stringify({
        scriptType: payload.type,
        scriptBody: payload.body,
        metadata: options.metadata ?? {},
        callbackUrl: options.callbackUrl,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new AigcProviderError(
        `Huashengyun submit failed: ${res.status}`,
        { status: res.status, body: await res.text() }
      );
    }

    const data = await res.json() as { jobId: string; estimatedSeconds?: number };
    return {
      jobId: data.jobId,
      acceptedAt: new Date(),
      estimatedCompleteAt: data.estimatedSeconds
        ? new Date(Date.now() + data.estimatedSeconds * 1000)
        : undefined,
      rawResponse: data,
    };
  }

  async getStatus(jobId: string): Promise<ScriptStatusResult | null> {
    // 接口契约待对接
    return null;
  }

  async healthCheck() {
    const t0 = performance.now();
    try {
      const res = await fetch(`${this.config.host}/health`, { signal: AbortSignal.timeout(3_000) });
      return { ok: res.ok, latencyMs: performance.now() - t0 };
    } catch (e) {
      return { ok: false, latencyMs: performance.now() - t0, message: String(e) };
    }
  }
}

interface HuashengyunConfig {
  host: string;
  token: string;
}
```

## 4.4 脚本 JSON Schema（5 种脚本契约）

### 4.4.1 共同字段（`types.ts`）

```typescript
import { z } from "zod";

export const CommonScriptFieldsSchema = z.object({
  scriptId: z.string().uuid(),            // VibeTide 内部 ID
  scenario: z.enum([                      // 场景标识
    "news_standard", "politics_shenzhen", "sports_chuanchao",
    "variety_highlight", "livelihood_zhongcao", "livelihood_tandian",
    "livelihood_podcast", "drama_serial",
  ]),
  organizationId: z.string().uuid(),
  producedByEmployeeId: z.string(),       // 产出员工 slug
  title: z.string().min(1).max(150),
  summary: z.string().max(500).optional(),
  tags: z.array(z.string()).max(20).optional(),
  targetDurationSec: z.number().int().positive().optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3"]).optional(),   // 推荐而非强制
  coverHint: z.string().optional(),        // 封面提示词
  bgmMood: z.string().optional(),          // BGM 情绪提示（自由文本）
});

// ★ Schema 宽松策略说明：
// 1) 大多数字段改为 optional，允许最小化脚本推送
// 2) 枚举字段允许自由文本扩展（如 bgmMood）
// 3) 数量约束统一放宽（min/max 不卡死）
// 4) 宽松的 schema 负责结构，内容质量由 skill MD 的 prompt 层保证
//    （schema 不挡门，但 skill 的 few-shot + 质量标准要求产出高质量）
```

### 4.4.2 新闻视频脚本（`news-video.ts`）

```typescript
export const NewsVideoScriptSchema = CommonScriptFieldsSchema.extend({
  type: z.literal("news_video"),
  body: z.object({
    narrationScript: z.string(),          // 完整配音稿（必选）
    shotList: z.array(z.object({
      sequence: z.number().int().positive().optional(),
      timecodeStart: z.string().optional(),
      durationSec: z.number().positive().optional(),
      sceneDescription: z.string(),       // 画面描述（必选）
      voiceover: z.string().optional(),   // 本镜配音
      subtitle: z.string().optional(),
      transitionTo: z.string().optional(),
      materialHints: z.array(z.string()).optional(),
    })).min(1).optional(),                // 至少 1 镜，可整体缺省
    musicPlan: z.array(z.object({
      segment: z.string(),
      timecodeRange: z.string().optional(),
      mood: z.string().optional(),
      volumePercent: z.number().int().min(0).max(100).optional(),
    })).optional(),
    factsToVerify: z.array(z.string()).optional(),
  }),
});

export type NewsVideoScript = z.infer<typeof NewsVideoScriptSchema>;
```

### 4.4.3 种草视频脚本（`zhongcao.ts`）

```typescript
export const ZhongcaoScriptSchema = CommonScriptFieldsSchema.extend({
  type: z.literal("zhongcao_video"),
  targetDurationSec: z.number().int().min(10).max(180).optional(),   // 10-180 秒
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16").optional(),
  body: z.object({
    product: z.object({
      name: z.string(),
      category: z.string().optional(),
      priceRange: z.string().optional(),
      keySellingPoints: z.array(z.string()).min(1).optional(),
    }),
    hook: z.object({
      durationSec: z.number().optional(),
      visual: z.string().optional(),
      voiceover: z.string(),              // 钩子台词必选
      subtitle: z.string().optional(),
    }).optional(),
    storyBeats: z.array(z.object({
      stage: z.string(),                  // 自由阶段名（不再强制枚举）
      durationSec: z.number().positive().optional(),
      visual: z.string().optional(),
      voiceover: z.string(),              // 配音必选
      subtitle: z.string().optional(),
      emphasisWord: z.string().optional(),
    })).min(1),                           // 放宽：最少 1 段
    cta: z.object({
      text: z.string(),
      visualHint: z.string().optional(),
    }).optional(),
    platformAdaptation: z.object({
      xiaohongshuVersion: z.string().optional(),
      douyinVersion: z.string().optional(),
    }).optional(),
  }),
});
```

### 4.4.4 探店视频脚本（`tandian.ts`）

```typescript
export const TandianScriptSchema = CommonScriptFieldsSchema.extend({
  type: z.literal("tandian_video"),
  targetDurationSec: z.number().int().min(30).max(300).optional(),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16").optional(),
  body: z.object({
    shop: z.object({
      name: z.string(),
      category: z.string().optional(),
      address: z.string().optional(),
      priceRange: z.string().optional(),
      businessHours: z.string().optional(),
    }),
    hook: z.object({
      durationSec: z.number().optional(),
      voiceover: z.string(),            // 必选
      visual: z.string().optional(),
    }).optional(),
    journey: z.array(z.object({
      stage: z.string(),                // 自由阶段名
      durationSec: z.number().positive().optional(),
      visual: z.string().optional(),
      voiceover: z.string(),            // 必选
      personalExperience: z.string().optional(),
    })).min(1),                         // 至少 1 段
    mustOrderDishes: z.array(z.object({
      name: z.string(),
      price: z.string().optional(),
      highlight: z.string().optional(),
    })).optional(),
    cta: z.string().optional(),
  }),
});
```

### 4.4.5 播客音频脚本（`podcast-audio.ts`）

```typescript
export const PodcastAudioScriptSchema = CommonScriptFieldsSchema.extend({
  type: z.literal("podcast_audio"),
  targetDurationSec: z.number().int().min(30).max(1800).optional(),   // 30 秒~30 分钟
  body: z.object({
    voicePreference: z.object({
      gender: z.enum(["male", "female", "any"]).optional(),
      ageStyle: z.string().optional(),
      emotionBase: z.string().optional(),
      regionalAccent: z.string().optional(),
    }).optional(),
    segments: z.array(z.object({
      role: z.string().optional(),       // opening/body/transition/closing 或自由
      text: z.string(),                  // 文本必选
      breathMarkers: z.array(z.number()).optional(),
      emphasizedWords: z.array(z.string()).optional(),
      speedMultiplier: z.number().min(0.5).max(2.0).optional(),
      pauseAfterMs: z.number().int().nonnegative().optional(),
    })).min(1),
    bgmTrack: z.object({
      mood: z.string().optional(),
      volumePercent: z.number().int().min(0).max(100).optional(),
      fadeInSec: z.number().optional(),
      fadeOutSec: z.number().optional(),
    }).optional(),
  }),
});
```

### 4.4.6 短剧视频脚本（`duanju.ts`）

```typescript
export const DuanjuScriptSchema = CommonScriptFieldsSchema.extend({
  type: z.literal("duanju_video"),
  targetDurationSec: z.number().int().min(60).max(1200).optional(),   // 1-20 分钟弹性
  body: z.object({
    series: z.object({
      name: z.string(),
      genre: z.string().optional(),              // 自由文本
      totalEpisodes: z.number().int().positive().optional(),
      currentEpisode: z.number().int().positive().optional(),
    }),
    characters: z.array(z.object({
      name: z.string(),
      role: z.string().optional(),               // 主角/反派/配角 或自由
      ageRange: z.string().optional(),
      personalityKeywords: z.array(z.string()).optional(),
      visualHint: z.string().optional(),
    })).min(1),
    hook: z.object({
      durationSec: z.number().optional(),
      text: z.string(),                          // 钩子文本必选
      visualHint: z.string().optional(),
    }).optional(),
    scenes: z.array(z.object({
      sceneNum: z.number().int().positive().optional(),
      location: z.string().optional(),
      timeOfDay: z.string().optional(),
      durationSec: z.number().positive().optional(),
      characters: z.array(z.string()).optional(),
      actions: z.string().optional(),
      dialogues: z.array(z.object({
        speaker: z.string(),
        line: z.string(),
        tone: z.string().optional(),
      })).optional(),
      mood: z.string().optional(),
    })).min(1),                                  // 至少 1 场
    cliffhanger: z.object({
      text: z.string(),
      visualHint: z.string().optional(),
    }).optional(),
    nextEpisodePreview: z.string().optional(),
  }),
});
```

### 4.4.7 综艺看点脚本（继承 news-video.ts）

综艺看点视频脚本复用 `NewsVideoScriptSchema`，在 metadata 里加 `scenario: "variety_highlight"`，在 skill MD 中通过 prompt 差异化输出风格。

## 4.5 推送主流程 + 状态机（`submission.ts`）

### 状态机

```
               ┌─ submit 失败 ─┐
               │               ▼
   ┌────────────┐          ┌────────┐
   │ submitting │          │ failed │ ◀── 任一阶段失败
   └─────┬──────┘          └────────┘
         │ submit 成功            ▲
         ▼                        │
   ┌────────────┐                 │
   │ submitted  │─── 超时且无回调 ┤ （超过 estimatedCompleteAt + 容忍期）
   └─────┬──────┘                 │
         │ 回调：渲染开始           │
         ▼                        │
   ┌────────────┐                 │
   │ rendering  │─────────────────┤
   └─────┬──────┘                 │
         │ 回调：渲染完成           │
         ▼                        │
   ┌────────────┐                 │
   │ rendered   │─────────────────┤
   └─────┬──────┘                 │
         │ 回调：CMS 已入库         │
         ▼                        │
   ┌────────────────┐             │
   │ cms_published  │─────────────┤
   └─────┬──────────┘             │
         │ 回调：APP 已发布         │
         ▼                        │
   ┌────────────────┐             │
   │ app_published  │ ─── 终态     │
   └────────────────┘             │
                                  │
                                  │
   所有非 submitted 前的阶段如回调 failure/timeout
   → 进入 failed（可人工重试）
```

### 推送主流程代码

```typescript
export async function submitScript(params: {
  scriptPayload: ScriptPayload;
  providerId?: string;             // 默认 env AIGC_PROVIDER
  missionId?: string;              // 关联的 mission，便于任务中心展示
  metadata?: Record<string, string>;
}): Promise<AigcSubmissionRecord> {
  // 1. 选 Provider
  const providerId = params.providerId ?? process.env.AIGC_PROVIDER ?? "huashengyun";
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Unknown AIGC provider: ${providerId}`);

  // 2. Schema 校验（zod）—— 宽松 schema 保结构，不卡内容
  const schema = getSchemaFor(params.scriptPayload.type);
  const parsed = schema.parse(params.scriptPayload);

  // 3. 落库 aigc_submissions（state=submitting）
  const idempotencyKey = `${parsed.scriptId}-${provider.id}`;
  const callbackUrl = buildCallbackUrl(idempotencyKey);

  const [record] = await db.insert(aigcSubmissions).values({
    scriptId: parsed.scriptId,
    missionId: params.missionId ?? null,
    providerId: provider.id,
    scenario: parsed.scenario,
    state: "submitting",
    scriptPayload: parsed,
    idempotencyKey,
    callbackUrl,
  }).returning();

  // 4. 调 provider.submit
  try {
    const result = await provider.submit(parsed, {
      idempotencyKey,
      callbackUrl,
      metadata: params.metadata,
    });

    await db.update(aigcSubmissions).set({
      state: "submitted",
      providerJobId: result.jobId,
      submittedAt: result.acceptedAt,
      estimatedCompleteAt: result.estimatedCompleteAt,
      rawResponse: result.rawResponse,
    }).where(eq(aigcSubmissions.id, record.id));

    // 发 Inngest 事件，触发超时监控（防止回调永不到达）
    await inngest.send({
      name: "aigc/submission.submitted",
      data: { submissionId: record.id, estimatedCompleteAt: result.estimatedCompleteAt },
    });

    return { ...record, ...result, state: "submitted" };
  } catch (err) {
    await db.update(aigcSubmissions).set({
      state: "failed",
      errorMessage: String(err),
      failedAt: new Date(),
    }).where(eq(aigcSubmissions.id, record.id));
    throw err;
  }
}

function buildCallbackUrl(idempotencyKey: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://vibetide.local";
  return `${base}/api/aigc-video/callback?key=${encodeURIComponent(idempotencyKey)}`;
}
```

### 超时监控（Inngest）

```typescript
// src/inngest/functions/aigc-submission-timeout.ts
export const aigcSubmissionTimeout = inngest.createFunction(
  { id: "aigc-submission-timeout" },
  { event: "aigc/submission.submitted" },
  async ({ event, step }) => {
    const eta = event.data.estimatedCompleteAt
      ? new Date(event.data.estimatedCompleteAt)
      : new Date(Date.now() + 30 * 60 * 1000);  // 默认 30 分钟
    const tolerance = 2 * 60 * 60 * 1000;       // 额外容忍 2 小时

    await step.sleepUntil("wait-eta", new Date(eta.getTime() + tolerance));

    const submission = await step.run("check-state", async () => {
      return await getAigcSubmission(event.data.submissionId);
    });

    // 如仍处于 submitted/rendering 中 —— 标记 failed 并告警
    if (["submitted", "rendering"].includes(submission.state)) {
      await markAigcSubmissionFailed(
        submission.id,
        "timeout-no-callback",
        "AIGC 回调超时未到达"
      );
      await notifyAdmin({
        type: "aigc_timeout",
        submissionId: submission.id,
      });
    }
  }
);
```

## 4.6 Provider 注册与切换

```typescript
// src/lib/aigc-video/registry.ts
const registry = new Map<string, AigcVideoProvider>();

export function registerProvider(p: AigcVideoProvider) {
  registry.set(p.id, p);
}

export function getProvider(id: string): AigcVideoProvider | undefined {
  return registry.get(id);
}

// 初始化（应用启动时）
export function initAigcProviders() {
  if (process.env.AIGC_PROVIDER === "mock" || process.env.NODE_ENV === "test") {
    registerProvider(new MockProvider());
  }
  if (process.env.AIGC_HOST && process.env.AIGC_TOKEN) {
    registerProvider(new HuashengyunProvider({
      host: process.env.AIGC_HOST,
      token: process.env.AIGC_TOKEN,
    }));
  }
  // 后续扩展：kie.ai / 可灵 / Runway / Sora 等
}
```

### 后续扩展路径（非本期）
- **独立模块「AIGC 模型配置中心」**：允许在 UI 配置多 provider、切换默认、按场景选 provider
- **Provider 能力表**：每个 provider 声明能力（分辨率/时长/风格/成本/速度），系统按需求自动选择最优
- **成本追踪**：每次推送记录预估成本，按 organization 聚合

## 4.7 回调处理（本期必选，用于任务中心闭环可视化）

### 设计目标
VibeTide 虽不直接驱动渲染和入 CMS，但需**全链路可观测**：
- 用户/运营在任务中心能看到"AIGC 已渲染完成"、"已入 CMS"、"已 APP 发布"
- 失败原因定位（哪一步挂了）
- 最终成品可预览（视频链接 + CMS 文章链接）

### 回调 endpoint

```typescript
// src/app/api/aigc-video/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAigcSignature } from "@/lib/aigc-video/signature";
import { handleAigcCallback } from "@/lib/aigc-video/callback-handler";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-aigc-signature") ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";

  // 1. 签名校验
  if (!verifyAigcSignature(rawBody, signature, process.env.AIGC_CALLBACK_SECRET!)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  // 2. 解析 payload
  let payload: AigcCallbackPayload;
  try {
    payload = AigcCallbackPayloadSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    return NextResponse.json({ error: "invalid_payload", detail: String(err) }, { status: 400 });
  }

  // 3. 处理回调（幂等）
  try {
    const result = await handleAigcCallback({ idempotencyKey: key, payload });
    return NextResponse.json({
      received: true,
      submissionId: result.submissionId,
      newState: result.newState,
    });
  } catch (err) {
    // 业务处理失败 → 返 5xx 让 AIGC 端重试
    console.error("AIGC callback handling failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
```

### 回调 Payload Schema

```typescript
// src/lib/aigc-video/callback-types.ts
import { z } from "zod";

export const AigcCallbackEventSchema = z.enum([
  "rendering_started",      // 渲染开始 → rendering
  "rendering_completed",    // 渲染完成（有视频 URL） → rendered
  "cms_saved",              // 已调用 CMS /web/article/save → cms_published
  "app_published",          // APP 端已可见 → app_published
  "failed",                 // 任一阶段失败
]);

export const AigcCallbackPayloadSchema = z.object({
  event: AigcCallbackEventSchema,
  jobId: z.string(),
  occurredAt: z.string(),          // ISO 8601
  progress: z.number().min(0).max(100).optional(),   // 百分比（渲染中可带）

  // rendering_completed 携带
  videoUrl: z.string().url().optional(),
  videoId: z.string().optional(),       // VMS id（若已入 VMS）
  durationSec: z.number().positive().optional(),
  coverUrl: z.string().url().optional(),

  // cms_saved 携带
  cmsArticleId: z.string().optional(),
  cmsArticleUrl: z.string().url().optional(),
  cmsCatalogId: z.string().optional(),
  cmsPreviewUrl: z.string().url().optional(),

  // app_published 携带
  appDeepLink: z.string().optional(),

  // failed 携带
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  failedStage: z.enum(["rendering", "vms", "cms", "app"]).optional(),

  // 可选：原始信息
  rawMeta: z.record(z.unknown()).optional(),
});

export type AigcCallbackPayload = z.infer<typeof AigcCallbackPayloadSchema>;
```

### 回调处理器（幂等 + 状态迁移）

```typescript
// src/lib/aigc-video/callback-handler.ts
export async function handleAigcCallback(params: {
  idempotencyKey: string;
  payload: AigcCallbackPayload;
}): Promise<{ submissionId: string; newState: string }> {
  const { idempotencyKey, payload } = params;

  return await db.transaction(async (tx) => {
    // 1. 找到 submission（锁行，避免并发）
    const submission = await tx
      .select()
      .from(aigcSubmissions)
      .where(eq(aigcSubmissions.idempotencyKey, idempotencyKey))
      .for("update")
      .limit(1)
      .then(r => r[0]);

    if (!submission) {
      throw new Error(`submission not found for key: ${idempotencyKey}`);
    }

    // 2. 幂等检查：如同一 event 已记录（按 event + occurredAt 判重）
    const alreadyRecorded = (submission.callbackHistory ?? []).some(
      (h) => h.event === payload.event && h.occurredAt === payload.occurredAt
    );
    if (alreadyRecorded) {
      return { submissionId: submission.id, newState: submission.state };
    }

    // 3. 计算新状态
    const newState = mapEventToState(payload.event, submission.state);

    // 4. 更新字段（按 event 增量填充）
    const updates: Partial<AigcSubmission> = {
      state: newState,
      lastCallbackAt: new Date(),
      callbackHistory: [
        ...(submission.callbackHistory ?? []),
        { event: payload.event, occurredAt: payload.occurredAt, progress: payload.progress },
      ],
    };

    if (payload.event === "rendering_completed") {
      updates.finalVideoUrl = payload.videoUrl;
      updates.finalVideoId = payload.videoId;
      updates.finalCoverUrl = payload.coverUrl;
      updates.finalDurationSec = payload.durationSec;
      updates.renderedAt = new Date();
    }
    if (payload.event === "cms_saved") {
      updates.cmsArticleId = payload.cmsArticleId;
      updates.cmsArticleUrl = payload.cmsArticleUrl;
      updates.cmsCatalogId = payload.cmsCatalogId;
      updates.cmsPublishedAt = new Date();
    }
    if (payload.event === "app_published") {
      updates.appDeepLink = payload.appDeepLink;
      updates.appPublishedAt = new Date();
    }
    if (payload.event === "failed") {
      updates.errorCode = payload.errorCode;
      updates.errorMessage = payload.errorMessage;
      updates.failedStage = payload.failedStage;
      updates.failedAt = new Date();
    }

    await tx.update(aigcSubmissions).set(updates).where(eq(aigcSubmissions.id, submission.id));

    // 5. 若有 mission 关联，广播给任务中心 SSE
    if (submission.missionId) {
      await notifyMissionChannel(submission.missionId, {
        type: "aigc_state_changed",
        submissionId: submission.id,
        newState,
        payload,
      });
    }

    return { submissionId: submission.id, newState };
  });
}

function mapEventToState(event: AigcCallbackEvent, currentState: string): string {
  const transitions: Record<string, string> = {
    rendering_started:   "rendering",
    rendering_completed: "rendered",
    cms_saved:           "cms_published",
    app_published:       "app_published",
    failed:              "failed",
  };
  return transitions[event] ?? currentState;
}
```

### 签名验证

```typescript
// src/lib/aigc-video/signature.ts
import { createHmac } from "node:crypto";

export function verifyAigcSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  // 常量时间比较
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}
```

### 任务中心 SSE 实时更新

回调处理完成后，通过 Server-Sent Events 通知任务中心前端，实现"AIGC 任务状态实时跳动"的体验。

```typescript
// src/app/api/mission/[id]/stream/route.ts （已有 SSE 基础设施时复用）
// 发送事件类型：aigc_state_changed { submissionId, newState, progress? }
```

### 配置

```bash
# .env.local 追加
AIGC_CALLBACK_SECRET=<与华栖云约定的 HMAC 密钥>
```

### 回调端到端测试清单（不是生产代码，是 QA 项）

| 场景 | 预期 |
|------|------|
| 同一 event 重复回调 | 只处理一次，返 200 |
| 签名错误 | 返 401，不更新状态 |
| payload schema 不合法 | 返 400，不更新状态 |
| submission 不存在 | 返 500 让 AIGC 重试（可能是时序问题） |
| 状态倒退（如 rendered 后又收到 rendering_started） | 忽略，保持当前状态 |
| AIGC 超过 ETA + 2h 仍未回调 | Inngest timeout 兜底，标记 failed + 告警 |

---

---

# 第 5-8 章 · Skill 体系（见 skills/ 子目录）

**批次 2 已完成**。13 个生产级 Skill MD 文件独立存放于 `skills/` 子目录，共 **7764 行**。

## 5. Skill MD 深度标准（融合 baoyu-skills + 15 要素）

每个 Skill MD 按**双轨标准**交付：

### 共享底座（10 章，A/B 类型都必须）

| 章节 | 内容 |
|------|------|
| Frontmatter | name / description / version / metadata.scenario_tags / compatibleEmployees / runtime / requires |
| Language | 输出语言与场景语言规范 |
| When to Use / Not | 应调用 / 不应调用场景表 |
| Input / Output Schema | zod 类型 + 示例 |
| Pre-flight Check | 环境/权限/依赖检查 + 失败处理表 |
| Workflow Checklist | Step 0~N 可勾选清单 + 每步决策表 |
| Feature Comparison | 能力矩阵对比表 |
| Troubleshooting | 常见问题 + 解决方案表 |
| Prerequisites | 依赖清单 |
| Completion Report | 输出格式模板 |
| EXTEND.md | 用户配置文件 |
| Changelog | 版本变更 |
| 参考实现文件 | 代码文件路径 |

### A 类（创作/生成）扩展（10 章）

| 章节 | 核心 |
|------|------|
| 场景人设 & 身份锚定 | 精准到行业深度的角色设定 |
| 目标读者画像 | 用户场景 × 需求细分 |
| 风格与语言规范 | 推荐 / 禁用词汇锁定表 |
| CoT 工作流程 | 含决策点的思维链 |
| Few-shot 正例 × 2-3 | 不同场景真实示例 |
| Few-shot 反例 × 1 | 带错误分析表 |
| 场景禁忌清单 | Hard Constraints |
| 合规与敏感词 | 按场景档位 |
| 质量自检清单 | 量化阈值 |
| 典型失败模式 | 5+ 种常见翻车 + 修正 |

### B 类（操作/API）扩展（6 章）

| 章节 | 核心 |
|------|------|
| HTTP / CLI 接口签名 | curl 示例 + 响应结构 |
| 幂等性 & 重试策略 | 退避表 + 错误分类 |
| 状态机 | mermaid 风格图 + 事件表 |
| 回调处理 | endpoint + 签名 + 幂等 |
| 多账号 / 多实例 | 复用 baoyu 模式 |
| Quality Self-Eval | 执行后自检 |

## 6. 13 个 Skill 索引

| Slug | 类型 | 行数 | 覆盖场景 | 审核档位 |
|------|------|------|---------|---------|
| `cms_publish` | B | 668 | 全场景入库 | — |
| `aigc_script_push` | B | 520 | 全场景脚本推送 | — |
| `cms_catalog_sync` | B | 518 | 配置层 | — |
| `duanju_script` | A | 1211 | S9 短剧 | 严 |
| `zhongcao_script` | A | 782 | S6 种草 | 松 |
| `podcast_script` | A | 714 | S8 播客 | 严 |
| `zongyi_highlight` | A | 623 | S5 综艺 | 松 |
| `tandian_script` | A | 620 | S7 探店 | 松 |
| `content_generate` (v5 重写) | A | 628 | 9 场景子模板 | 按场景 |
| `script_generate` (v5 重写) | A | 476 | 5 场景子模板 | 按场景 |
| `headline_generate` (v5 重写) | A | 426 | 9 场景标题风格 | 按场景 |
| `style_rewrite` (v5 重写) | A | 320 | 9 目标风格切换 | — |
| `summary_generate` (v5 重写) | A | 258 | 3 类 × 9 场景 | — |

## 7. Skill 路由与场景分配（scenario × employee × skill 链）

| 场景 | 员工团队 | Skill 链 |
|------|---------|---------|
| S2 新闻 | xiaolei → xiaoce → xiaowen → xiaoshen → xiaofa | `trend_monitor` → `topic_extraction` → `content_generate[news_standard]` + `script_generate[news_video]` → `quality_review` → `cms_publish` + `aigc_script_push` |
| S3 时政 | xiaolei → xiaoce → xiaowen → xiaoshen | `trending_topics` → `content_generate[politics_shenzhen]` + `script_generate[politics_explainer]` → `quality_review`(严) → `cms_publish` |
| S4 体育 | xiaolei → xiaowen → xiaojian | `news_aggregation` → `content_generate[sports_chuanchao]` + `script_generate[sports_commentary]` → `cms_publish` + `aigc_script_push` |
| S5 综艺 | xiaoce → xiaowen → xiaojian | `zongyi_highlight` → `cms_publish` + `aigc_script_push` |
| S6 种草 | xiaowen → xiaojian → xiaofa | `zhongcao_script` → `content_generate[livelihood_zhongcao]`(可选配套图文) → `aigc_script_push` + `cms_publish` |
| S7 探店 | xiaolei → xiaowen → xiaojian | `web_search` → `tandian_script` + `content_generate[livelihood_tandian]` → `aigc_script_push` + `cms_publish` |
| S8 播客 | xiaowen → xiaoshen | `trending_topics` → `podcast_script` + `content_generate[livelihood_podcast]` → `quality_review`(严) → `aigc_script_push` + `cms_publish` |
| S9 短剧 | xiaoce → xiaowen → xiaoshen | `duanju_script[generate_episode]` → `quality_review`(严, IP 一致性) → `cms_publish` + `aigc_script_push` |
| S1 首页 | xiaofa + xiaoshu | 读 `cms_publications` + `data_report` → 聚合推荐算法 → 写 `home_recommendation` 表（非独立生产） |

## 8. AI 员工能力扩展映射

| 员工 | 原定位 | 本期新增子能力 | 新绑定 Skill |
|------|-------|-------------|------------|
| xiaolei (热点分析师) | 全网热点监控 | +本地生活线索挖掘（探店） | `web_search`, `trending_topics`, `social_listening`（加场景 tag） |
| xiaoce (选题策划师) | 选题策划 | +综艺看点策划 / 短剧系列策划 | `zongyi_highlight`, `duanju_script[bible]` |
| xiaowen (内容创作师) | 文字生产 | +7 种新场景子能力（种草/探店/播客/短剧剧本/综艺看点/新闻重写/每日专题） | 全部 A 类 13 个 skill |
| xiaojian (视频制片人) | 视频剪辑方案 | +视频脚本推送能力 | `aigc_script_push`, `script_generate`, `zhongcao_script`, `tandian_script` |
| xiaoshen (质量审核官) | 质量审核 | +分档审核（严/松 + 栏目覆盖）/ 广电合规 / 广告法扫描 / IP 一致性检查 | `quality_review`（按档位升级） |
| xiaofa (渠道运营师) | 渠道分发 | +CMS 入库主职责 / 栏目映射管理 | `cms_publish`, `cms_catalog_sync` |
| xiaoshu (数据分析师) | 数据洞察 | +CMS 发布统计 / AIGC 成本统计 | 读 `cms_publications` / `aigc_submissions` |
| xiaozi (素材研究员) | 素材整合 | +本地美食库 / 艺人信息库管理 | `knowledge_retrieval` |
| xiaotan (深度调查员) | 深度调查 | +时政深度解读 | `content_generate[politics_shenzhen]` |
| advisor (频道顾问) | 频道策略 | +APP 栏目策略咨询 | 保持 |
| leader (任务总监) | 任务调度 | +场景化 workflow 派单 | 保持 |

**注**：员工人数保持 10+1；能力扩展通过 **Workflow 模板预设人设** 注入，不改员工基础定义。

---

# 第 9 章 · APP 栏目 ↔ CMS 栏目映射

## 9.1 映射架构总览

```
     ┌────────────────────┐        ┌─────────────────┐
     │  APP 栏目（9 slug）  │        │ 华栖云 CMS       │
     │  app_home           │        │  ├─ 渠道(Channels)│
     │  app_news           │        │  ├─ 应用(Apps)    │
     │  app_politics       │        │  └─ 栏目(Catalogs)│
     │  app_sports         │        └────────┬─────────┘
     │  app_variety        │                 │
     │  app_livelihood     │                 │ cms_catalog_sync
     │  app_livelihood_... │                 │ （每日 cron + 手动）
     │  app_drama          │                 ▼
     │  app_daily_brief    │        ┌─────────────────┐
     └────────┬───────────┘         │ 本地映射表       │
              │ 运营绑定             │ cms_channels    │
              │（app_channels 表）    │ cms_apps        │
              └─────────────────────▶│ cms_catalogs    │
                                     └─────────────────┘
                                              │
                                              ▼
                                     cms_publish 使用
                                     （查 siteId/catalogId/listStyle）
```

## 9.2 APP 9 个固定栏目 Slug

| Slug | APP 栏目 | 主要内容类型 | 审核档位 |
|------|---------|------------|---------|
| `app_home` | 首页 | 聚合推荐（不独立生产） | — |
| `app_news` | 新闻 | 图文稿 + 视频脚本 | 严 |
| `app_politics` | 时政 | 政策解读图文 + 视频 | 严 |
| `app_sports` | 体育 | 赛事战报 + 解说视频 | 松 |
| `app_variety` | 综艺 | 看点盘点 + 视频 | 松 |
| `app_livelihood_zhongcao` | 民生-种草 | 种草视频 + 图文 | 松 |
| `app_livelihood_tandian` | 民生-探店 | 探店视频 + 图文 | 松 |
| `app_livelihood_podcast` | 民生-播客 | 播客口播稿 + 音频 | 严 |
| `app_drama` | 短剧 | 短剧剧本（图文） | 严 |

**约定**：
- `app_` 前缀 = 产品侧 slug（稳定、不随 CMS 变动）
- `cms_` 前缀 = CMS 侧标识（随 CMS 同步变动）
- 两者通过 `app_channels` 表关联

## 9.3 数据模型（DDL 详见 §11）

### `cms_channels`（从 CMS 同步，映射渠道类型）
字段：`id` / `organization_id` / `channel_key`（CHANNEL_APP 等） / `channel_code`（1=APP） / `name` / `pick_value` / `third_flag` / `last_synced_at`

### `cms_apps`（从 CMS 同步，映射应用）
字段：`id` / `organization_id` / `channel_key` / `cms_app_id` / `site_id` / `name` / `appkey` / `appsecret`（加密存储） / `last_synced_at`

### `cms_catalogs`（从 CMS 同步，映射栏目树）
字段：`id` / `organization_id` / `cms_catalog_id` / `app_id` / `site_id` / `name` / `parent_id` / `inner_code` / `alias` / `tree_level` / `is_leaf` / `catalog_type`（1=新闻） / `video_player` / `audio_player` / `live_player` / `vlive_player` / `h5_preview` / `pc_preview` / `url` / `deleted_at`（软删） / `last_synced_at`

### `app_channels`（运营配置，绑定关系）
字段：`id` / `organization_id` / `slug`（app_news 等） / `display_name` / `review_tier`（strict/relaxed） / `default_catalog_id`（关联 cms_catalogs） / `default_list_style`（jsonb） / `default_cover_url` / `icon` / `sort_order` / `is_enabled`

### `cms_sync_logs`（同步历史）
字段：`id` / `organization_id` / `state`（running/done/failed） / `stats`（jsonb） / `warnings`（jsonb） / `trigger_source` / `started_at` / `completed_at` / `duration_ms` / `error_message`

## 9.4 三步同步流程（详见 `cms_catalog_sync` skill）

```
Step 1: getChannels       → upsert cms_channels
Step 2: getAppList(type=1) → upsert cms_apps
Step 3: getCatalogTree(appId, types=1)
        → flatten tree
        → reconcile cms_catalogs (insert/update/soft-delete)

触发：
  - 手动（管理 UI 按钮）
  - 每日 cron（02:00）
  - 首次配置完成
  - cms_publish 遇 catalog_not_found 自动触发
```

## 9.5 运营配置 UI 流程

**路径**：`/settings/cms-mapping`

### Tab 1: CMS 栏目树（只读）
展示从 CMS 同步到的完整栏目树，支持按 app / site 过滤、搜索。

### Tab 2: APP 栏目映射（可配置）
每个 app_channel slug 一行：
- 显示名称
- 绑定的 CMS 栏目（下拉选择 cms_catalogs）
- 默认列表样式（单图 / 多图 / 标题无图 / 窄图）
- 默认封面 URL
- 审核档位（下拉：严 / 松）
- 启用开关

**保存规则**：必须有 default_catalog_id；不允许绑定已 soft_deleted 的 catalog。

### Tab 3: 同步日志（只读）
分页展示 `cms_sync_logs`，显示：时间 / 状态 / 统计（新增 X / 更新 Y / 软删 Z） / 耗时 / 警告数。

## 9.6 异常处理

| 异常 | 处理 |
|------|------|
| CMS 栏目被删除 | cms_catalogs.deleted_at = now；若有 app_channels 绑定 → 警告运营重新映射；暂停对应场景入库 |
| CMS 栏目重命名 | 自动跟随更新；audit log 记录 |
| CMS 凭证失效 | 同步失败；告警；暂停 cms_publish |
| CMS 接口变更（字段名变动等） | 需人工介入适配 mapper |
| 同步任务并发 | advisory lock `SELECT FOR UPDATE SKIP LOCKED` |
| 栏目权限变更（CMS 回收某账号权限） | 表现为返回 0 栏目；保留本地数据不删（保护） |

## 9.7 API 端点清单

| 路径 | 方法 | 用途 |
|------|-----|------|
| `/api/cms/catalog-sync` | POST | 手动触发同步 |
| `/api/cms/catalog-sync/:logId` | GET | 查看同步进度 |
| `/api/cms/channels` | GET | 列出本地 cms_channels |
| `/api/cms/apps` | GET | 列出本地 cms_apps |
| `/api/cms/catalogs` | GET | 列出本地 cms_catalogs（含树结构） |
| `/api/app-channels` | GET/PUT | 读写 app_channels 映射 |
| `/actions/publish-article-to-cms` | POST (Server Action) | cms_publish skill 入口 |

---

# 第 10 章 · 分档审核机制

## 10.1 设计目标

- **两档默认**（严 strict / 松 relaxed）覆盖 80% 场景
- **栏目级独立覆盖**：运营可按 app_channel 微调
- **规则引擎**：多层规则组合（全局 + 档位 + 栏目）
- **自动 + 人工混合**：高分自动过、低分转人工、中段 flag 待定

## 10.2 两档规则清单

| 维度 | 严（strict） | 松（relaxed） |
|------|-----------|-------------|
| **合规扫描严格度** | maximum（全规则） | high（核心规则） |
| **事实核查** | 每个数字必须有 source | 抽样校验 |
| **敏感词库** | 全库（5000+ 词） | 核心库（1500 词） |
| **艺人/人名/机构名核查** | 必须 KB 100% 命中 | 允许 fuzzy match |
| **官方表述核查（时政）** | 必须 | — |
| **自动通过阈值** | qualityScore ≥ 95 | ≥ 80 |
| **Flag 阈值** | < 90 即 flag 人工 | < 70 即 flag |
| **审核员介入** | 必经人工 | 仅 flag 经人工 |
| **SLA** | 无（等人工完成） | 30 分钟（自动或抢单） |
| **IP 一致性（短剧）** | ✓ | — |
| **价值观审查** | ✓ | — |

**默认归属**：

| APP 栏目 | 档位 | 可覆盖 |
|---------|-----|-------|
| app_news | 严 | ✓ |
| app_politics | 严 | ✗（强制严） |
| app_sports | 松 | ✓ |
| app_variety | 松 | ✓ |
| app_livelihood_zhongcao | 松 | ✓ |
| app_livelihood_tandian | 松 | ✓ |
| app_livelihood_podcast | 严 | ✓ |
| app_drama | 严 | ✓ |
| app_daily_brief | 依内容而定 | ✓ |

## 10.3 栏目独立覆盖机制

### 数据模型：`review_rules`

| 字段 | 类型 | 说明 |
|-----|-----|------|
| id | uuid | |
| organization_id | uuid | |
| scope | enum | global / tier / app_channel |
| tier | enum | strict / relaxed（scope=tier 时使用） |
| app_channel_slug | text | scope=app_channel 时使用 |
| rule_type | enum | banned_word / fact_check / compliance / ip_consistency / value_alignment |
| rule_config | jsonb | 规则具体配置 |
| priority | int | 优先级（数字越大越优先） |
| is_enabled | bool | |
| created_by / updated_by / ... | | |

### 覆盖优先级（由高到低）

1. **app_channel scope** 的规则（针对某栏目）
2. **tier scope** 的规则（针对 strict 或 relaxed）
3. **global scope** 的规则（全局兜底）

### 覆盖示例

```
默认档位 strict 的广告法扫描规则（tier rule）：
  - banned_words: [最好, 第一, 100%, ...]

app_news 栏目覆盖（app_channel rule）：
  - banned_words 添加 [爆款]（这个词在新闻稿里也不想用）

最终执行时：
  - app_news 合并规则 = tier rules ∪ app_channel rules
  - 以 app_channel 优先级覆盖（若字段冲突）
```

## 10.4 规则引擎（三层架构）

```
┌────────────────────────────────────────────────────┐
│  Layer 1: 全局规则（global）                       │
│   - 广告法极限词（全场景必禁）                     │
│   - 政治敏感词（全场景必禁）                       │
│   - 个人信息脱敏（手机号/身份证）                  │
└────────────────────────────────────────────────────┘
                       ▼
┌────────────────────────────────────────────────────┐
│  Layer 2: 档位规则（tier）                         │
│   - strict：事实核查严、KB 校验严、官方表述校验    │
│   - relaxed：基础扫描 + 抽样                        │
└────────────────────────────────────────────────────┘
                       ▼
┌────────────────────────────────────────────────────┐
│  Layer 3: 栏目规则（app_channel）                  │
│   - 运营自定义（按业务需求追加/覆盖）              │
└────────────────────────────────────────────────────┘
                       ▼
              合并后的 effectiveRules
                       ▼
              RulesEngine.scan(content)
                       ▼
              ScanResult { passed, score, flagged }
```

### 规则类型矩阵

| 规则类型 | 全局 | 档位 | 栏目 | 用途 |
|---------|-----|------|------|------|
| banned_word | ✓ | ✓ | ✓ | 敏感词黑名单 |
| required_source | — | ✓ | ✓ | 数据/引用必须有 source |
| kb_verify | — | ✓ | ✓ | 从 KB 核查 entity（人名/机构/艺人） |
| official_expression | — | ✓ | ✓ | 时政官方表述核查 |
| ip_consistency | — | ✓ | ✓ | 短剧 IP 一致性（对照 series bible） |
| value_alignment | ✓ | ✓ | ✓ | 价值观扫描（过激/歧视/偏激） |
| ad_law_strict | ✓ | ✓ | ✓ | 广告法极限词/绝对化用语 |
| platform_compliance | — | — | ✓ | 平台特殊规则（小红书/抖音） |

## 10.5 审核流程状态机

```
     稿件生成完成
          │
          ▼
   ┌──────────┐
   │submitted │
   └────┬─────┘
        │ quality_review + compliance_check skills
        ▼
   ┌──────────────┐
   │ auto_scanning│  执行规则引擎
   └────┬─────────┘
        │
        ▼
   ┌──────────────────────────────────┐
   │ 分流决策（按档位阈值）             │
   └─┬──────────┬──────────┬─────────┘
     │          │          │
  高分↓      中分↓       低分↓
  ≥ 95/80  80-95 /70-80  < 80/70
     │          │          │
     ▼          ▼          ▼
  ┌──────┐ ┌──────┐ ┌──────┐
  │auto_ │ │flag_ │ │auto_ │
  │passed│ │for_  │ │reject│
  │      │ │review│ │      │
  └──┬───┘ └──┬───┘ └──┬───┘
     │        │         │
     │        ▼         │
     │  ┌────────────┐  │
     │  │manual_     │  │
     │  │review      │  │
     │  └──┬──────┬──┘  │
     │ pass│     reject │
     │     ▼        ▼  │
     └────▶ approved ◀─┘
                │
                ▼
         ┌──────────┐
         │rejected  │→ 回退稿件，员工改写
         └──────────┘
                │
                ▼
         ┌──────────┐
         │approved  │→ 触发 cms_publish / aigc_script_push
         └──────────┘
```

## 10.6 人工审核工作台

**路径**：`/review-workbench`（已有，在本期扩展）

新增字段：
- flag_reason（规则引擎标红的原因）
- suggested_fixes（建议修改）
- tier_used（当时的档位）
- rules_triggered（命中规则列表）

人工决策：approve / reject / send_back_with_comment

## 10.7 合规扫描器集成

### 调用链

```typescript
// src/lib/agent/tools/quality-review.ts
async function qualityReview(input): Promise<ReviewResult> {
  // 1. 加载 effective rules
  const rules = await loadEffectiveRules({
    organizationId,
    appChannelSlug,
    tier: input.tier ?? resolveTierForChannel(input.appChannelSlug),
  });

  // 2. 执行规则引擎
  const scanResult = await rulesEngine.scan(input.content, rules);

  // 3. 质量评分（LLM 评估）
  const qualityScore = await llmQualityScore(input.content, {
    scenario: input.scenario,
    criteria: getCriteriaForTier(tier),
  });

  // 4. 决策
  const decision = decide({
    scanResult,
    qualityScore,
    tier,
    thresholds: getThresholdsForTier(tier),
  });

  return {
    decision,              // auto_passed / flag_for_review / auto_reject
    scanResult,
    qualityScore,
    effectiveRules: rules,
  };
}
```

## 10.8 运营配置 UI

**路径**：`/settings/review-rules`

Tab 1: **档位规则**（只读展示默认规则）
Tab 2: **栏目覆盖**（按栏目配置 review_rules）
Tab 3: **敏感词库管理**（全局词库维护）
Tab 4: **审核统计**（通过率 / 失败率 / 平均耗时）

---

# 第 11 章 · 数据模型变更

## 11.1 新增表清单（10 张）

| 表名 | 用途 | 估计数据量（月） |
|-----|------|--------------|
| `cms_publications` | VibeTide article → CMS article 映射与状态 | 万级 |
| `cms_channels` | CMS 渠道字典（同步来自 CMS） | 数条 |
| `cms_apps` | CMS 应用列表（同步） | 十条 |
| `cms_catalogs` | CMS 栏目树（同步） | 千级 |
| `cms_sync_logs` | 栏目同步历史 | 每天 1 条（cron） |
| `app_channels` | APP 栏目 ↔ CMS 栏目映射（运营配置） | 9-20 条 |
| `aigc_submissions` | AIGC 脚本推送记录 | 万级 |
| `aigc_callback_logs` | AIGC 回调历史（审计用） | 几万条 |
| `daily_content_plans` | 每日 AIGC 专题编排 | 几十条 |
| `review_rules` | 审核规则（档位/栏目覆盖） | 百级 |

## 11.2 DDL 代码（Drizzle Schema）

### `cms_publications`

```typescript
// src/db/schema/cms-publications.ts
import { pgTable, uuid, text, timestamp, jsonb, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

export const cmsPublications = pgTable(
  "cms_publications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    articleId: uuid("article_id").references(() => articles.id).notNull(),
    appChannelSlug: text("app_channel_slug").notNull(),

    cmsArticleId: text("cms_article_id"),
    cmsCatalogId: text("cms_catalog_id"),
    cmsSiteId: integer("cms_site_id"),

    cmsState: cmsPublicationStateEnum("cms_state").notNull().default("submitting"),
    cmsType: integer("cms_type"), // 1/2/4/5/11

    requestHash: text("request_hash"),
    requestPayload: jsonb("request_payload"),
    responsePayload: jsonb("response_payload"),

    previewUrl: text("preview_url"),
    publishedUrl: text("published_url"),

    attempts: integer("attempts").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    operatorId: text("operator_id"),
    triggerSource: text("trigger_source"),

    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    articleIdx: index("cms_pub_article_idx").on(table.articleId),
    cmsArticleIdIdx: index("cms_pub_cms_article_idx").on(table.cmsArticleId),
    stateIdx: index("cms_pub_state_idx").on(table.appChannelSlug, table.cmsState),
    orgStateIdx: index("cms_pub_org_state_idx").on(table.organizationId, table.cmsState),
  })
);
```

### `cms_channels / cms_apps / cms_catalogs / cms_sync_logs`

```typescript
// src/db/schema/cms-mapping.ts
export const cmsChannels = pgTable(
  "cms_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    channelKey: text("channel_key").notNull(),       // CHANNEL_APP / CHANNEL_WECHAT
    channelCode: integer("channel_code").notNull(),
    name: text("name").notNull(),
    pickValue: text("pick_value"),
    thirdFlag: text("third_flag"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqOrgKey: uniqueIndex("cms_channels_org_key_uniq").on(table.organizationId, table.channelKey),
  })
);

export const cmsApps = pgTable(
  "cms_apps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    channelKey: text("channel_key").notNull(),
    cmsAppId: text("cms_app_id").notNull(),
    siteId: integer("site_id").notNull(),
    name: text("name").notNull(),
    appkey: text("appkey"),
    appsecret: text("appsecret"),                    // KMS 加密存储
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqOrgAppId: uniqueIndex("cms_apps_org_appid_uniq").on(table.organizationId, table.cmsAppId),
  })
);

export const cmsCatalogs = pgTable(
  "cms_catalogs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    cmsCatalogId: integer("cms_catalog_id").notNull(),
    appId: integer("app_id").notNull(),
    siteId: integer("site_id").notNull(),
    name: text("name").notNull(),
    parentId: integer("parent_id").default(0),
    innerCode: text("inner_code"),
    alias: text("alias"),
    treeLevel: integer("tree_level"),
    isLeaf: boolean("is_leaf").default(true),
    catalogType: integer("catalog_type").default(1),
    videoPlayer: text("video_player"),
    audioPlayer: text("audio_player"),
    livePlayer: text("live_player"),
    vlivePlayer: text("vlive_player"),
    h5Preview: text("h5_preview"),
    pcPreview: text("pc_preview"),
    url: text("url"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqOrgCatalogId: uniqueIndex("cms_catalogs_org_catid_uniq").on(table.organizationId, table.cmsCatalogId),
    treeIdx: index("cms_catalogs_tree_idx").on(table.organizationId, table.parentId, table.deletedAt),
  })
);

export const cmsSyncLogs = pgTable(
  "cms_sync_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    state: text("state").notNull(),                  // running / done / failed
    stats: jsonb("stats"),
    warnings: jsonb("warnings"),
    triggerSource: text("trigger_source"),
    operatorId: text("operator_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
  },
  (table) => ({
    orgTimeIdx: index("cms_sync_logs_org_time_idx").on(table.organizationId, table.startedAt),
  })
);
```

### `app_channels`

```typescript
// src/db/schema/app-channels.ts
export const appChannels = pgTable(
  "app_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    slug: text("slug").notNull(),                    // app_news / app_politics / ...
    displayName: text("display_name").notNull(),
    reviewTier: reviewTierEnum("review_tier").notNull().default("relaxed"),
    defaultCatalogId: uuid("default_catalog_id").references(() => cmsCatalogs.id),
    defaultListStyle: jsonb("default_list_style").$type<{
      imageUrlList?: string[];
      listStyleName?: string;
      listStyleType?: string;
    }>(),
    defaultCoverUrl: text("default_cover_url"),
    icon: text("icon"),
    sortOrder: integer("sort_order").default(0),
    isEnabled: boolean("is_enabled").default(true),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqOrgSlug: uniqueIndex("app_channels_org_slug_uniq").on(table.organizationId, table.slug),
  })
);
```

### `aigc_submissions` + `aigc_callback_logs`

```typescript
// src/db/schema/aigc-submissions.ts
export const aigcSubmissions = pgTable(
  "aigc_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    missionId: uuid("mission_id").references(() => missions.id),
    articleId: uuid("article_id").references(() => articles.id),
    scriptId: uuid("script_id").notNull(),

    providerId: text("provider_id").notNull(),       // huashengyun / kie / ...
    providerJobId: text("provider_job_id"),
    scenario: text("scenario").notNull(),
    scriptType: text("script_type").notNull(),       // news_video / zhongcao_video / ...

    state: aigcSubmissionStateEnum("state").notNull().default("submitting"),
    scriptPayload: jsonb("script_payload").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    callbackUrl: text("callback_url"),

    // 推送阶段
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    estimatedCompleteAt: timestamp("estimated_complete_at", { withTimezone: true }),
    rawResponse: jsonb("raw_response"),

    // 渲染回调阶段
    renderedAt: timestamp("rendered_at", { withTimezone: true }),
    finalVideoUrl: text("final_video_url"),
    finalVideoId: text("final_video_id"),            // VMS id
    finalCoverUrl: text("final_cover_url"),
    finalDurationSec: integer("final_duration_sec"),

    // CMS 发布回调阶段
    cmsPublishedAt: timestamp("cms_published_at", { withTimezone: true }),
    cmsArticleId: text("cms_article_id"),
    cmsArticleUrl: text("cms_article_url"),
    cmsCatalogId: text("cms_catalog_id"),

    // APP 发布回调阶段
    appPublishedAt: timestamp("app_published_at", { withTimezone: true }),
    appDeepLink: text("app_deep_link"),

    // 失败
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failedStage: text("failed_stage"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    // 元信息
    callbackHistory: jsonb("callback_history").$type<Array<{
      event: string;
      occurredAt: string;
      progress?: number;
    }>>(),
    lastCallbackAt: timestamp("last_callback_at", { withTimezone: true }),
    operatorId: text("operator_id"),
    triggerSource: text("trigger_source"),
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqIdempotency: uniqueIndex("aigc_subs_idempotency_uniq").on(table.idempotencyKey),
    missionStateIdx: index("aigc_subs_mission_state_idx").on(table.missionId, table.state),
    providerJobIdx: index("aigc_subs_provider_job_idx").on(table.providerId, table.providerJobId),
  })
);

export const aigcCallbackLogs = pgTable(
  "aigc_callback_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id").references(() => aigcSubmissions.id).notNull(),
    event: text("event").notNull(),                  // rendering_started / rendering_completed / cms_saved / app_published / failed
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    rawPayload: jsonb("raw_payload"),
    signatureValid: boolean("signature_valid").notNull(),
    processedState: text("processed_state"),
    processingError: text("processing_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    submissionTimeIdx: index("aigc_callback_sub_time_idx").on(table.submissionId, table.occurredAt),
  })
);
```

### `daily_content_plans`

```typescript
// src/db/schema/daily-content-plans.ts
export const dailyContentPlans = pgTable(
  "daily_content_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    slug: text("slug").notNull(),                    // dp_daily_ai_brief / dp_weekend_ai / ...
    name: text("name").notNull(),
    description: text("description"),

    scenario: text("scenario").notNull(),            // 对应 9 个场景 slug
    appChannelSlug: text("app_channel_slug").notNull(),
    workflowTemplateId: uuid("workflow_template_id").references(() => workflowTemplates.id),

    frequency: text("frequency").notNull(),          // daily / weekly / custom
    cronExpression: text("cron_expression").notNull(),
    timezone: text("timezone").default("Asia/Shanghai"),

    inputParams: jsonb("input_params"),              // 固定参数（如种草 default_brand）
    dynamicParamsSource: text("dynamic_params_source"),  // 动态取数源（如每日热点）

    isEnabled: boolean("is_enabled").default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    runCount: integer("run_count").default(0),
    successCount: integer("success_count").default(0),
    failCount: integer("fail_count").default(0),

    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqOrgSlug: uniqueIndex("daily_plans_org_slug_uniq").on(table.organizationId, table.slug),
    nextRunIdx: index("daily_plans_next_run_idx").on(table.nextRunAt, table.isEnabled),
  })
);
```

### `review_rules`

```typescript
// src/db/schema/review-rules.ts
export const reviewRules = pgTable(
  "review_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    scope: text("scope").notNull(),                  // global / tier / app_channel
    tier: reviewTierEnum("tier"),                    // 当 scope=tier 时使用
    appChannelSlug: text("app_channel_slug"),        // 当 scope=app_channel 时使用
    ruleType: text("rule_type").notNull(),           // banned_word / fact_check / compliance / ...
    ruleConfig: jsonb("rule_config").notNull(),
    priority: integer("priority").default(0),
    isEnabled: boolean("is_enabled").default(true),
    description: text("description"),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    scopeIdx: index("review_rules_scope_idx").on(table.organizationId, table.scope, table.isEnabled),
    tierChannelIdx: index("review_rules_tier_channel_idx").on(table.tier, table.appChannelSlug),
  })
);
```

## 11.3 枚举扩展（`src/db/schema/enums.ts`）

```typescript
export const cmsPublicationStateEnum = pgEnum("cms_publication_state", [
  "submitting", "submitted", "synced",
  "rejected_by_cms", "failed", "retrying",
]);

export const aigcSubmissionStateEnum = pgEnum("aigc_submission_state", [
  "submitting", "submitted", "rendering", "rendered",
  "cms_published", "app_published", "failed",
]);

export const reviewTierEnum = pgEnum("review_tier", ["strict", "relaxed"]);

export const dailyPlanFrequencyEnum = pgEnum("daily_plan_frequency", [
  "daily", "weekly", "custom",
]);

// 扩展现有 artifactTypeEnum
export const artifactTypeEnum = pgEnum("artifact_type", [
  "article", "video_script", "audio_script", "image",
  "data_report", "chart",
  "cms_publication",             // 新增
  "aigc_submission",             // 新增
]);
```

## 11.4 迁移步骤

```bash
# Step 1: 开发环境
npm run db:push                   # Drizzle push schema

# Step 2: 填充基础 seed 数据
npx tsx src/db/seed.ts --only=app_channels,skills,workflow_templates,review_rules

# Step 3: 跑首次 CMS 栏目同步
# （需先确保 env 已配置 CMS_LOGIN_CMC_ID/TID）
# 通过 UI `/settings/cms-mapping` 点"立即同步"
# 或 CLI：
# curl -X POST https://vibetide.local/api/cms/catalog-sync -d '{"triggerSource":"first_time_setup"}'

# Step 4: 运营配置 app_channels.defaultCatalogId
# 通过 UI `/settings/cms-mapping` 进行绑定

# Step 5: 预置 daily_content_plans
npx tsx scripts/seed-daily-plans.ts

# Step 6: 灰度到测试 organization
# env VIBETIDE_CMS_PUBLISH_ENABLED=true
# env VIBETIDE_AIGC_PUSH_ENABLED=true

# Step 7: 生产 migrate
npm run db:generate               # 生成 SQL
# 审核 SQL 文件
npm run db:migrate                # 应用
```

## 11.5 Seed 数据改造（`src/db/seed.ts`）

### 追加内容

```typescript
// 1. 9 个 APP 栏目（app_channels）
const appChannelsData = [
  { slug: "app_home", displayName: "首页", reviewTier: "relaxed", icon: "🏠", sortOrder: 0 },
  { slug: "app_news", displayName: "新闻", reviewTier: "strict", icon: "📰", sortOrder: 1 },
  { slug: "app_politics", displayName: "时政", reviewTier: "strict", icon: "🏛️", sortOrder: 2 },
  { slug: "app_sports", displayName: "体育", reviewTier: "relaxed", icon: "⚽", sortOrder: 3 },
  { slug: "app_variety", displayName: "综艺", reviewTier: "relaxed", icon: "🎭", sortOrder: 4 },
  { slug: "app_livelihood_zhongcao", displayName: "民生-种草", reviewTier: "relaxed", icon: "🌱", sortOrder: 5 },
  { slug: "app_livelihood_tandian", displayName: "民生-探店", reviewTier: "relaxed", icon: "🍜", sortOrder: 6 },
  { slug: "app_livelihood_podcast", displayName: "民生-播客", reviewTier: "strict", icon: "🎧", sortOrder: 7 },
  { slug: "app_drama", displayName: "短剧", reviewTier: "strict", icon: "🎬", sortOrder: 8 },
];

// 2. 13 个新 skill（skills 表，指向 skills/ 目录下的 MD）
const newSkills = [
  { slug: "cms_publish", name: "CMS 文稿入库发布", category: "action", version: "1.0.0" },
  { slug: "aigc_script_push", name: "AIGC 脚本推送", category: "action", version: "1.0.0" },
  { slug: "cms_catalog_sync", name: "CMS 栏目同步", category: "action", version: "1.0.0" },
  { slug: "zhongcao_script", name: "种草视频脚本", category: "generation", version: "1.0.0" },
  { slug: "tandian_script", name: "探店视频脚本", category: "generation", version: "1.0.0" },
  { slug: "podcast_script", name: "播客口播稿", category: "generation", version: "1.0.0" },
  { slug: "duanju_script", name: "短剧剧本生成", category: "generation", version: "1.0.0" },
  { slug: "zongyi_highlight", name: "综艺看点盘点", category: "generation", version: "1.0.0" },
  // 重写版的 4 个以 version=5.0.0 更新现有记录
  { slug: "content_generate", name: "内容生成", category: "generation", version: "5.0.0" },
  { slug: "script_generate", name: "视频脚本生成", category: "generation", version: "5.0.0" },
  { slug: "headline_generate", name: "标题生成", category: "generation", version: "5.0.0" },
  { slug: "style_rewrite", name: "风格改写", category: "generation", version: "5.0.0" },
  { slug: "summary_generate", name: "摘要生成", category: "generation", version: "5.0.0" },
];

// 3. 9 个场景化 workflow_templates（wt_news_std / wt_politics_sz 等）
const scenarioWorkflows = [
  {
    slug: "wt_news_std",
    name: "新闻图文+视频脚本工作流",
    category: "news",
    steps: [
      { skill: "trend_monitor" },
      { skill: "topic_extraction" },
      { skill: "content_generate", params: { subtemplate: "news_standard" } },
      { skill: "script_generate", params: { subtemplate: "news_video" } },
      { skill: "quality_review", params: { tier: "strict" } },
      { skill: "cms_publish", params: { appChannelSlug: "app_news" } },
      { skill: "aigc_script_push", params: { providerId: "huashengyun" } },
    ],
  },
  // ... 类似定义 wt_politics_sz / wt_sports_cc / wt_variety_hl / wt_live_zhongcao /
  //                 wt_live_tandian / wt_live_podcast / wt_drama_serial / wt_home_digest_daily
];

// 4. 预置 daily_content_plans
const dailyPlans = [
  { slug: "dp_daily_ai_brief", name: "每日 AI 资讯", scenario: "daily_brief",
    appChannelSlug: "app_news", cron: "0 7 * * *" },
  { slug: "dp_weekend_ai_deep", name: "AI 大模型周末", scenario: "deep_report",
    appChannelSlug: "app_news", cron: "0 10 * * 6" },
  { slug: "dp_daily_politics", name: "每日时政热点", scenario: "politics_shenzhen",
    appChannelSlug: "app_politics", cron: "0 8 * * *" },
  { slug: "dp_daily_podcast", name: "每日热点播客", scenario: "livelihood_podcast",
    appChannelSlug: "app_livelihood_podcast", cron: "0 6 * * *" },
  { slug: "dp_daily_tandian", name: "每日探店", scenario: "livelihood_tandian",
    appChannelSlug: "app_livelihood_tandian", cron: "0 18 * * *" },
  { slug: "dp_daily_sports_report", name: "每日川超战报", scenario: "sports_chuanchao",
    appChannelSlug: "app_sports", cron: "30 22 * * *" },  // 赛后 22:30
];

// 5. 默认 review_rules
const defaultReviewRules = [
  // 全局
  { scope: "global", ruleType: "banned_word",
    ruleConfig: { words: ["最好", "第一", "100%", "绝对", "唯一", "永久"] } },
  { scope: "global", ruleType: "value_alignment",
    ruleConfig: { strictness: "high", categories: ["政治", "暴力", "色情"] } },
  // 严档
  { scope: "tier", tier: "strict", ruleType: "fact_check",
    ruleConfig: { requireSource: true } },
  { scope: "tier", tier: "strict", ruleType: "kb_verify",
    ruleConfig: { kbs: ["artist-info", "official-terminology"] } },
  // 松档
  { scope: "tier", tier: "relaxed", ruleType: "banned_word",
    ruleConfig: { words: [/* 松档仅用核心词库 */] } },
  // 栏目级覆盖（时政最严）
  { scope: "app_channel", appChannelSlug: "app_politics", ruleType: "official_expression",
    ruleConfig: { required: true, kbs: ["policy-docs"] } },
];
```

## 11.6 索引策略

| 表 | 索引 | 用途 |
|----|------|------|
| cms_publications | (article_id) | cms_publish 查重 |
| cms_publications | (cms_article_id) | 回调/轮询查询 |
| cms_publications | (organization_id, cms_state) | 状态列表 |
| cms_publications | (app_channel_slug, cms_state) | 按场景统计 |
| aigc_submissions | (idempotency_key) uniq | 幂等 |
| aigc_submissions | (mission_id, state) | 任务中心查询 |
| aigc_submissions | (provider_id, provider_job_id) | 回调查找 |
| aigc_callback_logs | (submission_id, occurred_at) | 回调历史 |
| cms_catalogs | (organization_id, cms_catalog_id) uniq | upsert |
| cms_catalogs | (organization_id, parent_id, deleted_at) | 树结构查询 |
| app_channels | (organization_id, slug) uniq | 映射查 |
| daily_content_plans | (next_run_at, is_enabled) | cron 调度 |
| review_rules | (organization_id, scope, is_enabled) | 规则加载 |

## 11.7 数据保留与归档

| 表 | 保留 | 归档策略 |
|----|-----|---------|
| cms_publications | 永久 | — |
| aigc_submissions | 永久 | — |
| cms_sync_logs | 90 天 | 超过转 cold storage |
| aigc_callback_logs | 30 天 | 删除原始 payload，保留元信息 |
| review_rules | 永久 | — |
| daily_content_plans | 永久 | — |
| audit logs（未新增表，复用现有） | 1 年 | 超过归档 |

---

# 第 12 章 · UI 改造

## 12.1 首页 9 场景网格

**路径**：`/home`
**组件**：`src/components/home/scenario-grid.tsx`（已有，本期重做 9 场景）

### 布局

```
┌──────────────────────────────────────────────────────┐
│ 欢迎回来，{username}                                 │
│                                                      │
│  [场景网格 3×3]                                      │
│  ┌────┐  ┌────┐  ┌────┐                             │
│  │首页│  │新闻│  │时政│                             │
│  │🏠  │  │📰  │  │🏛️  │                             │
│  │12  │  │45  │  │23  │  ← 本周产出数               │
│  └────┘  └────┘  └────┘                             │
│  ┌────┐  ┌────┐  ┌────┐                             │
│  │体育│  │综艺│  │种草│                             │
│  │⚽  │  │🎭  │  │🌱  │                             │
│  └────┘  └────┘  └────┘                             │
│  ┌────┐  ┌────┐  ┌────┐                             │
│  │探店│  │播客│  │短剧│                             │
│  │🍜  │  │🎧  │  │🎬  │                             │
│  └────┘  └────┘  └────┘                             │
│                                                      │
│  [今日任务] [AIGC 专题] [审核队列]                    │
└──────────────────────────────────────────────────────┘
```

### 卡片交互

- **Hover**：展示本周产出、成功率、告警状态
- **点击**：跳转到对应场景工作流页 `/workflows/:slug` 或 mission 创建页
- **右上角徽章**：⚠️ 告警 / 🔥 热度 / 📈 近期表现

### 按钮规范

**全局约束**：所有按钮、tabs、lab、触发元素**一律不带边框**（符合 CLAUDE.md）
- 用 `variant="ghost"` 或自定义 `variant="borderless"` 的 shadcn Button
- Hover 用背景色区分（bg-muted）
- 图标按钮优先

## 12.2 每日 AIGC 专题编排中心

**路径**：`/daily-content`

### 界面结构

Tab 1: **日历视图**
- 月视图显示每个专题的运行时间
- 点击时间格查看当日任务列表
- 绿色 / 黄色 / 红色 标记成功 / 运行中 / 失败

Tab 2: **专题列表**
- 表格显示所有 daily_content_plans
- 列：slug / 名称 / 场景 / 目标栏目 / 频率 / cron / 上次运行 / 启用

Tab 3: **新建专题**
- 表单：
  - 基础信息（slug / 名称 / 描述）
  - 选场景（下拉 9 个）
  - 选 APP 栏目
  - 绑定 workflow_template
  - 频率（daily / weekly / custom cron）
  - 时区
  - 动态参数源（可选，如"当日热点"）
- 预览下次运行时间

Tab 4: **运行记录**
- 查看每次运行的 mission / article / cms_publication / aigc_submission

### 本期预置 6 个专题

| Slug | 名称 | 场景 | 频率 |
|-----|------|------|-----|
| dp_daily_ai_brief | 每日 AI 资讯 | news_standard | 每天 07:00 |
| dp_weekend_ai_deep | AI 大模型周末 | deep_report | 每周六 10:00 |
| dp_daily_politics | 每日时政热点 | politics_shenzhen | 每天 08:00 |
| dp_daily_podcast | 每日热点播客 | livelihood_podcast | 每天 06:00 |
| dp_daily_tandian | 每日探店 | livelihood_tandian | 每天 18:00 |
| dp_daily_sports_report | 每日川超战报 | sports_chuanchao | 每赛后 22:30 |

## 12.3 栏目映射配置页

**路径**：`/settings/cms-mapping`

详见 §9.5。**所有按钮无边框**。

## 12.4 审核规则配置页

**路径**：`/settings/review-rules`

### Tab 1: 档位规则（只读）

```
┌─────────────────────────────────────────┐
│ 严档（strict）                           │
│  • 事实核查：必须提供 source             │
│  • KB 核查：全库                         │
│  • 自动通过阈值：≥ 95 分                 │
│  • 必经人工审核：是                      │
│                                          │
│ 松档（relaxed）                          │
│  • 自动扫描 + 抽样                       │
│  • 自动通过阈值：≥ 80 分                 │
│  • 必经人工审核：否                      │
└─────────────────────────────────────────┘
```

### Tab 2: 栏目覆盖（可编辑）

表格：
- app_channel slug
- 继承档位
- 额外规则数量
- [编辑] [新增规则]

### Tab 3: 敏感词库管理

- 全局词库（分类：广告法 / 政治 / 医疗 / 暴力 / ...）
- 词库导入（csv / 批量）
- 版本控制（修改历史）

### Tab 4: 审核统计

- 各栏目通过率 / 失败率 / 平均耗时
- 规则命中热点（哪些规则触发次数最多）

## 12.5 任务中心 AIGC 展示

**路径**：`/missions/:id`（在现有 Mission Detail 里扩展）

### 新增 Tab: "AIGC 推送任务"

```
┌─────────────────────────────────────────────────┐
│ AIGC 推送任务（3）                               │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📹 新闻视频 · 深圳 AI 新政解读                │ │
│ │ Provider: 华栖云                              │ │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 85% rendering │ │
│ │ 预计完成：4 分 21 秒后                         │ │
│ │ [查看脚本] [预览]（渲染完后可点）              │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🎵 播客音频 · 每日 AI 资讯                    │ │
│ │ ✅ app_published                              │ │
│ │ [播放音频] [CMS 文章] [APP 深链]               │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🌱 种草视频 · 薇诺娜舒敏霜                    │ │
│ │ ❌ failed（failedStage: rendering）           │ │
│ │ 错误：视频源素材解析失败                        │ │
│ │ [查看详情] [重新推送]                          │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 状态徽章

```typescript
const stateLabel: Record<AigcSubmissionState, { label: string; color: string }> = {
  submitting:    { label: "推送中", color: "gray" },
  submitted:     { label: "已接收", color: "blue" },
  rendering:     { label: "渲染中", color: "cyan" },
  rendered:      { label: "已渲染", color: "indigo" },
  cms_published: { label: "已入 CMS", color: "violet" },
  app_published: { label: "已发布", color: "green" },
  failed:        { label: "失败", color: "red" },
};
```

### 实时更新

通过现有 SSE 通道（`/api/mission/:id/stream`）监听 `aigc_state_changed` 事件。

## 12.6 按钮/交互规范（全局）

严格遵循项目约束（CLAUDE.md 已明确）：

- ✅ **所有按钮、Tab、Lab 一律无边框**
- ✅ 使用 `Button variant="ghost"` 或自定义 `borderless` 变体
- ✅ Hover 用 `bg-muted` 区分
- ✅ 图标按钮（lucide-react）为主
- ✅ 主按钮用背景色区分（bg-primary）
- ❌ 不用 outline / secondary 带边框变体
- ❌ 不用单独的 border 属性

```tsx
// 正确
<Button variant="ghost" onClick={...}>
  <IconPlus className="mr-2" /> 新建
</Button>

// 错误
<Button variant="outline" className="border">新建</Button>
```

---

# 第 13 章 · 生产化保障

## 13.1 灰度策略

### 三阶段发布

| 阶段 | 范围 | 启动条件 | 观察指标 |
|------|-----|---------|---------|
| α 内部灰度 | 1-2 个测试 organization | DDL 成功 + 首次 seed 成功 + 冒烟测试 | 入库成功率 / 无严重错误 |
| β 小流量灰度 | 10% 的 organization | α 阶段 24h 无严重问题 | 成功率 ≥ 95% / P95 ≤ 5s |
| γ 全量 | 全部 organization | β 阶段 48h 无严重问题 | 稳定 |

### Feature Flag

```bash
# .env.local
VIBETIDE_CMS_PUBLISH_ENABLED=true       # CMS 入库总开关
VIBETIDE_AIGC_PUSH_ENABLED=true         # AIGC 推送总开关
VIBETIDE_DAILY_PLANS_ENABLED=true       # 每日专题总开关
VIBETIDE_CATALOG_SYNC_ENABLED=true      # 栏目同步 cron
VIBETIDE_REVIEW_TIER_ENFORCE=true       # 分档审核强制
```

**按 organization 灰度**：数据库标志位 `organizations.feature_flags` 存 jsonb，支持单独启停。

## 13.2 监控指标

### 关键指标（Metrics）

```typescript
// 入库相关
cms_publish_total{state, app_channel, org}
cms_publish_duration_p95
cms_publish_retry_count
cms_publish_auth_failures

// AIGC 推送相关
aigc_submit_total{provider, scenario, state, org}
aigc_submit_duration_p95
aigc_callback_received_total{event, org}
aigc_callback_timeout_total
aigc_submission_state_distribution

// 栏目同步
cms_catalog_sync_duration
cms_catalog_sync_diff_count{type}  // inserted / updated / deleted
cms_catalog_sync_failures

// 审核
review_scan_total{tier, decision, app_channel}
review_rules_triggered_total{rule_type}
review_manual_queue_depth
review_auto_pass_rate{app_channel}

// 业务指标
daily_plans_triggered_total
daily_plans_success_rate{plan_slug}
articles_published_total{app_channel, date}
aigc_renders_completed_total{scenario, date}
```

### Dashboard 面板

- **CMS 入库总览**：成功率曲线 / P95 延迟 / 失败分布
- **AIGC 渲染管道**：状态分布 / 从 submitted 到 app_published 的漏斗
- **审核表现**：自动通过率 / 人工队列长度 / 规则命中 TOP
- **每日专题**：各专题执行成功率 / 产出内容数
- **栏目映射健康度**：栏目同步频率 / 异常告警次数

## 13.3 告警机制

| 告警 | 阈值 | 级别 | 通道 |
|------|------|------|------|
| CMS 入库失败率 > 5% / 5m | ≥ 5% | P1 | 邮件 + IM |
| CMS 鉴权错误 | 任一次 | P0 | 立即 IM |
| CMS 栏目同步失败 | 连续 2 次 | P1 | IM |
| AIGC 推送失败率 > 10% / 5m | ≥ 10% | P1 | IM |
| AIGC 回调超时率 > 20% / 1h | ≥ 20% | P1 | IM |
| Provider 健康检查失败 | 连续 3 次 | P2 | 邮件 |
| 审核人工队列 > 100 条 | ≥ 100 | P2 | IM |
| daily_plan 执行失败 | 连续 2 次 | P2 | 邮件 |
| Inngest 函数超时 | 单次 | P3 | 日志 |

### 告警配置

用现有 Vercel Observability Drains + 自定义 webhook 到企业 IM（钉钉 / 企业微信）。

```typescript
// src/lib/monitoring/alerts.ts
export async function emitAlert(alert: AlertPayload) {
  // 1. 写 audit
  await logAuditAlert(alert);
  // 2. 发 IM
  if (alert.level === "P0" || alert.level === "P1") {
    await sendDingtalkAlert(alert);
  }
  // 3. 邮件（P1/P2）
  if (["P1", "P2"].includes(alert.level)) {
    await sendEmail(alert);
  }
}
```

## 13.4 重试与幂等（汇总）

| 场景 | 幂等保证 | 重试策略 |
|------|---------|---------|
| CMS 入库 | `cms_publications` + request_hash + articleId 复用 | 3 次退避 1s/2s/4s |
| AIGC 推送 | `aigc_submissions.idempotency_key` 唯一索引 | 3 次退避 2s/4s/8s |
| 栏目同步 | advisory lock 防并发 | 30s 后重试 1 次 |
| 审核扫描 | 查询式无副作用 | 不重试（失败直接人工） |

## 13.5 审计日志

### 需审计的操作

- CMS 入库 / 更新 / 软删
- AIGC 推送 / 回调处理
- 栏目同步（insert / update / soft-delete）
- 审核决定（approve / reject / send_back）
- 规则变更（new / modified / disabled）
- app_channels 绑定变更
- daily_content_plans 创建 / 修改 / 启停
- 凭证变更（env 修改）

### Audit 表结构（复用现有 `audit.ts`，扩展字段）

```typescript
// 扩展现有 audit 表
{
  action: "cms_publication_submitted" | "aigc_submission_pushed" | "catalog_synced" |
          "review_decided" | "rule_changed" | "app_channel_bound" | ...,
  targetType: "article" | "submission" | "catalog" | "rule" | ...,
  targetId: uuid,
  beforeState: jsonb | null,
  afterState: jsonb | null,
  operatorId: text,
  triggerSource: "manual" | "scheduled" | "workflow" | "auto",
  metadata: jsonb,
  createdAt: timestamp,
}
```

## 13.6 降级预案

### CMS 不可用

```typescript
async function publishArticleToCmsWithFallback(args) {
  try {
    return await publishArticleToCms(args);
  } catch (err) {
    if (err instanceof CmsNetworkError || err instanceof CmsBusinessError) {
      // 1. 写入 cms_publish_queue（等 CMS 恢复后补）
      await enqueueCmsPublish(args);
      // 2. 稿件仍保留在 VibeTide 侧
      await markArticleAsPending(args.articleId);
      // 3. 告警
      await emitAlert({ level: "P1", type: "cms_unavailable" });
      return { success: false, fallback: true };
    }
    throw err;
  }
}
```

### AIGC 不可用

```typescript
async function pushAigcWithFallback(args) {
  const provider = getProvider(args.providerId);
  const health = await provider.healthCheck();
  if (!health.ok) {
    // 1. 切 mock provider（脚本仍存库 + 明确标注"待人工介入"）
    const mockResult = await submitScript({ ...args, providerId: "mock" });
    await emitAlert({
      level: "P1",
      type: "aigc_degraded",
      message: "Provider ${args.providerId} unavailable, switched to mock",
    });
    return mockResult;
  }
  return submitScript(args);
}
```

### Inngest 不可用

- daily_content_plans cron 暂停
- 栏目同步延迟（下次 cron 恢复）
- aigc-submission-timeout 兜底失效（需手动清理僵尸 submission）
- 暂停自动审核队列推进

## 13.7 数据一致性

### 双写场景

**cms_publish 成功 + article.publishStatus 更新**

```typescript
await db.transaction(async (tx) => {
  // 1. 更新 article 状态
  await tx.update(articles).set({ publishStatus: "published" }).where(...);
  // 2. 记录 cms_publications
  await tx.insert(cmsPublications).values({ ... });
});
```

**aigc_submission 更新 + workflow_artifacts 关联**

同样用事务。

### 跨系统一致性

与 CMS 的一致性通过**轮询 + 回调**验证，不做强一致（EventSourcing 思路）。

## 13.8 性能基准（压测目标）

| 场景 | 目标 |
|------|------|
| 单 organization 入库 | 100 篇/分钟 |
| 单 organization AIGC 推送 | 50 条/分钟 |
| CMS 栏目同步（1000 栏目） | ≤ 30 秒 |
| 审核扫描 | 单篇 ≤ 2 秒 |
| 回调处理 | ≤ 500ms |
| 并发度 | 500 并发 AIGC 推送 |

## 13.9 应急 Runbook（简版）

| 问题 | 紧急处理 |
|------|---------|
| CMS 鉴权全失效 | 1) 停 cms_publish 队列；2) 人工更新 env；3) 重启服务；4) 清理失败重试 |
| AIGC 大量超时 | 1) 切 mock provider；2) 停新推送；3) 核查 provider 健康；4) 恢复后清理僵尸 |
| 栏目映射大规模失效 | 1) 停 cms_publish；2) 手动 catalog sync；3) 运营重新配置 app_channels |
| 敏感词误伤 | 1) 临时 disable 特定 rule；2) 修规则；3) 重跑审核队列 |
| daily_plans 连续失败 | 1) 停对应 plan；2) 查错因；3) 修复后手动触发补跑 |

---

# 第 14 章 · 开放问题 & 后续迭代

## 14.1 本期已知待解决

| # | 问题 | 影响 | 计划解决时间 |
|---|------|------|------------|
| Q1 | 华栖云 AIGC 接口正式文档未到 | `aigc-video/providers/huashengyun.ts` 按占位实现，正式文档到位后需调整请求/响应字段 | 接口文档到位 ≤ 1 周 |
| Q2 | login_cmc_id / tid 固定值 | 长期安全风险（凭证泄露则全系统受影响） | Phase 2 |
| Q3 | appsecret 未走 KMS | 使用对称加密，密钥在 env | Phase 2 |
| Q4 | AIGC 回调签名密钥轮换 | 无自动轮换机制 | Phase 2 |
| Q5 | TTS 引擎未实际接入 | podcast_script 输出的 SSML 暂无法实际合成音频 | Phase 2 |
| Q6 | 视频拆条能力缺失 | 新闻/时政/体育/综艺的"台内视频拆条"在本期由华栖云 AIGC 自取自拆，VibeTide 不介入 | Phase 3 |
| Q7 | 多 AIGC Provider 切换 UI | 本期仅 env 配置，不支持 UI 切换 | Phase 3 |
| Q8 | CMS type=5（视频）本期 VibeTide 不直接入 | type=5 mapper 已实现但未走主路径 | Phase 4 视频闭环时 |
| Q9 | 艺人信息库 / 官方表述库 / 本地方言库 等 KB | 本期为空；需运营逐步填充 | 持续迭代 |
| Q10 | 性能压测未做 | 生产压力未知 | β 阶段前必须完成 |

## 14.2 后续迭代路径

### Phase 2（本期后 1-2 个月）

- **MMS/CMC 鉴权对接**：替代固定 login_cmc_id/tid，支持 token 自动刷新
- **TTS 引擎接入**：接 Azure / 讯飞 / 火山引擎 TTS，打通 podcast 真实音频产出
- **appsecret KMS 存储**：用 KMS 托管密钥
- **AIGC 回调密钥轮换**：定期自动轮换
- **多 organization 权限管理完善**：跨租户隔离、资源配额

### Phase 3（本期后 3-6 个月）

- **多 AIGC Provider 切换中心**：UI 配置 + 按场景路由
- **视频拆条能力**：接入台内 VMS / 台内媒资接口，VibeTide 参与拆条策划
- **AI 视频审核**：视频内容合规自动扫描
- **短剧视频渲染**：短剧从"仅剧本"升级到"推 AIGC 渲染"
- **A/B 测试框架**：多版本标题 / 摘要 / 脚本的数据驱动选优

### Phase 4（本期后 6-12 个月）

- **平台化 SaaS**：VibeTide 可独立部署到其他广电台
- **多租户更完备**：组织/团队/角色/权限全维度
- **AI 编辑助手**：支持人工编辑时的 AI 实时协助
- **数据分析深度**：基于 CMS/APP 侧反馈优化内容生产（闭环学习）

## 14.3 技术债

| 技术债 | 优先级 | 备注 |
|-------|-------|------|
| appsecret 改 KMS | 高 | Phase 2 |
| AIGC callback secret 轮换 | 高 | Phase 2 |
| audit log 分区存储（按月） | 中 | 数据量大后做 |
| cms_publications 归档策略 | 中 | 超 1 年数据可归档 |
| workflow_templates 版本化 | 中 | 变更历史追溯 |
| skill MD 热加载（不重启） | 低 | 开发体验优化 |
| 敏感词库版本控制 | 低 | 便于回滚 |

## 14.4 生产化上线 Checklist

```
[ ] 所有 env 变量配齐
    [ ] CMS_HOST / CMS_LOGIN_CMC_ID / CMS_LOGIN_CMC_TID
    [ ] CMS_TENANT_ID / CMS_USERNAME
    [ ] AIGC_HOST / AIGC_TOKEN / AIGC_PROVIDER / AIGC_CALLBACK_SECRET
    [ ] NEXT_PUBLIC_APP_URL（回调用）
    [ ] Feature Flags

[ ] 数据库迁移
    [ ] 10 张新表 DDL 应用
    [ ] 枚举扩展
    [ ] 索引建立
    [ ] Seed 数据导入
      [ ] 9 APP 栏目
      [ ] 13 skills
      [ ] 9 场景化 workflow_templates
      [ ] 6 预置 daily_content_plans
      [ ] 默认 review_rules

[ ] 外部依赖
    [ ] CMS 接口连通（5 个接口）
    [ ] AIGC 接口（至少 mock 就绪）
    [ ] Inngest 部署
    [ ] 回调 endpoint 可访问

[ ] 首次运行
    [ ] 跑 cms_catalog_sync
    [ ] 运营配置 app_channels.defaultCatalogId
    [ ] 冒烟测试：每个场景至少 1 次端到端

[ ] 监控 & 告警
    [ ] Dashboard 上线
    [ ] 告警通道打通（IM / 邮件）
    [ ] Runbook 文档上线

[ ] 灰度
    [ ] α：内部测试 organization 开启
    [ ] β：10% 灰度（24h 后）
    [ ] γ：全量（48h 后）
```

## 14.5 度量成功的标准

**短期（Phase 1 验收）**：
- 每个 APP 栏目每周至少产出 1 条内容
- CMS 入库成功率 ≥ 99%
- AIGC 推送成功率 ≥ 95%
- 自动审核通过率 ≥ 70%（严档） / ≥ 90%（松档）
- 人工审核人均处理时间 ≤ 10 分钟

**中期（Phase 1 稳定运行 1 个月）**：
- 日均产出 ≥ 50 条（跨所有栏目）
- 每日专题 100% 准时执行
- 内容质量主观评分 ≥ 4.0 / 5（运营打分）

**长期（Phase 2 完成）**：
- 月均产出 ≥ 2000 条
- 真实部署在 1-3 个广电台生产环境
- 具备独立 SaaS 化能力

---

# 附录

## A. 术语表

| 术语 | 解释 |
|------|------|
| VibeTide / newsclaw | 本产品中文名"智媒工作空间"；英文 VibeTide |
| CMS | 华栖云内容管理系统，APP 内容的发布源 |
| VMS | 华栖云媒资系统（Video Management System） |
| AIGC | AI Generated Content，本文件特指视频/音频渲染平台 |
| Skill | VibeTide Agent 的能力单元，MD 定义 + TS 运行时 |
| Mission | 任务实例，可能涉及多个 Skill 和员工 |
| Workflow Template | 可复用的工作流模板（seed 到 db） |
| APP 栏目 | 用户在 APP 看到的栏目，9 个固定 slug |
| CMS 栏目 | CMS 内部栏目树，同步到本地 cms_catalogs |
| 档位 | 审核严格度分档（strict / relaxed） |
| 每日专题 | daily_content_plans 记录的定时内容产出任务 |

## B. 本文档交付清单

| 产物 | 路径 | 行数 |
|------|-----|------|
| 主设计文档 | `docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md` | ~4500 |
| Skill MD × 13 | `docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design/skills/*.md` | 7764 |
| **合计** | | **≥ 12000 行** |

## C. 下一步

**本设计文档 approve 后**：
1. git commit 保存到仓库
2. 调用 `spec-document-reviewer` 做独立 review（修改→再 review 循环）
3. 最终用户 review 通过
4. 调用 `writing-plans` skill 产出实施计划（按 Phase 切分）
5. 按计划进入编码实现阶段

