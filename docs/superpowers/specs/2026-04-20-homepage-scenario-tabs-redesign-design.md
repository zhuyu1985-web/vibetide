# 首页"场景快捷启动" Tab 重构 + 主流场景 10 条落地

**日期：** 2026-04-20
**范围：** 首页 `/home` 场景快捷启动区域的分类体系 + 10 条"主流场景"预设落地
**阶段：** L3 MVP（差异化 prompt + 复用现有 skill 编排 + 绑定 CMS 一级频道；cron/AIGC 外链延后）

---

## 1. 背景与动机

当前 `/home` 页的"场景快捷启动"区域使用 8 个员工 slug 作为 tab 名（`小雷` / `小策` / `小子` / ...），用户调研反馈：这些内部代号对最终用户毫无指向性，无法表达"我现在想做什么"。同时老板层面提出的 10 个"常用主流场景"（每日 AI 资讯、科技周报、每日时政热点、每日热点播客、每日探店、每日川超战报、种草日更、精品内容、本地新闻、全国热点图文）在 DB 里绝大多数缺失，无法在首页一键启动。

**目标（本期）：**
1. Tab 分类从"员工视角"转为"场景职能视角"（主流场景 + 8 职能 + 我的工作流）
2. 把 10 条主流场景作为 builtin seed 落地，每个可在首页点击启动并走完 workflow（至少跑到稿件产出；CMS 入库靠手动触发）
3. 不破坏现有 26 条 builtin 模板的运行

**本期不做：**
- Inngest cron 定时触发（每日自动执行）
- AIGC 外链对接（播客 / 视频真实调用）
- CMS 栏目自动绑定二级 `cms_catalogs`（仍由运营在 `/settings/cms-mapping` 手动映射）
- `SCENARIO_CONFIG` / `channels/gateway.ts` 等 B.2 legacy 清理

---

## 2. 决策摘要

| 决策点 | 选择 | 理由 |
|---|---|---|
| 主流场景与职能 tab 关系 | **双重归类（方案 C）** | 10 个主流场景各自有 owner（出现在职能 tab），同时打 `is_featured=true`（汇入主流场景 tab）。保留现有数据结构，改动最小。 |
| 交付范围 | **L3 MVP** | 差异化 prompt + inputFields + 复用现有 skill steps + 绑定一级 `appChannelSlug`。cron 和真实 AIGC 外链留下一期。 |
| Tab 数量 | **10 个**：主流场景 + 8 职能 + 我的工作流 | 符合现有 UI 习惯，改动最小。 |
| 精品内容处理 | **合并到现有 `pub.feature_story_pipeline`** | 现有特稿生产线与"精品内容"高度重合，改名 + 补 featured + 换 appChannelSlug，不新增。 |
| featured 范围 | **仅新增 10 条** | 现有 26 条模板不追加 featured，保持"主流场景 tab = 老板指定 10 个场景"的语义纯净。 |

---

## 3. 数据模型变更

### 3.1 新增字段

```ts
// src/db/schema/workflows.ts
export const workflowTemplates = pgTable("workflow_templates", {
  // ... 现有字段保持不变
  isFeatured: boolean("is_featured").notNull().default(false), // 🆕
});
```

Migration 由 `npm run db:generate` 产出，非破坏性（新列 + 默认 false）。

### 3.2 Tab → 查询规则

| Tab key | 查询条件 |
|---|---|
| `featured` | `is_featured = true AND is_public = true` |
| `xiaolei` | `owner_employee_id = 'xiaolei' AND is_public = true` |
| `xiaoce` | `owner_employee_id = 'xiaoce' AND is_public = true` |
| `xiaozi` | `owner_employee_id = 'xiaozi' AND is_public = true` |
| `xiaowen` | `owner_employee_id = 'xiaowen' AND is_public = true` |
| `xiaojian` | `owner_employee_id = 'xiaojian' AND is_public = true` |
| `xiaoshen` | `owner_employee_id = 'xiaoshen' AND is_public = true` |
| `xiaofa` | `owner_employee_id = 'xiaofa' AND is_public = true` |
| `xiaoshu` | `owner_employee_id = 'xiaoshu' AND is_public = true` |
| `custom` | `is_builtin = false AND is_public = true` |

所有查询统一附加 `organization_id = <org>`，由 DAL 注入。

### 3.3 不变动

- `category` 枚举（12 值）—— 描述内容类型，与"职能 tab"是正交维度
- `ownerEmployeeId` —— 8 员工 tab 的过滤依据
- `legacyScenarioKey` / `slug` —— 新增 10 条沿用，下游消费者按 slug 分发不受影响
- Missions 表 / Workflow Steps 表 / 所有 skill 定义 —— 完全不动

---

## 4. 10 个新场景的 Owner / Team / CMS 映射

| # | slug | 场景名 | Owner（所在职能 tab） | Default Team | appChannelSlug | category |
|---|---|---|---|---|---|---|
| 1 | `daily_ai_news` | 每日 AI 资讯 | xiaolei / 热点分析 | xiaolei, xiaozi, xiaofa | `app_news` | news |
| 2 | `tech_weekly` | 科技周报（深度长文） | xiaowen / 内容创作 | xiaowen, xiaoce, xiaozi | `app_news` | deep |
| 3 | `daily_politics` | 每日时政热点 | xiaolei / 热点分析 | xiaolei, xiaowen, xiaoshen | `app_politics` | news |
| 4 | `daily_podcast` | 每日热点播客 | xiaowen / 内容创作 | xiaowen, xiaolei, xiaojian | `app_livelihood_podcast` | podcast |
| 5 | `daily_tandian` | 每日探店 | xiaojian / 视频脚本 | xiaojian, xiaowen, xiaoshen | `app_livelihood_tandian` | livelihood |
| 6 | `daily_chuanchao` | 每日川超战报 | xiaolei / 热点分析 | xiaolei, xiaozi, xiaowen | `app_sports` | news |
| 7 | `zhongcao_daily` | 种草日更 | xiaowen / 内容创作 | xiaowen, xiaoshen, xiaofa | `app_livelihood_zhongcao` | social |
| 8 | `pub.feature_story_pipeline`（改名） | 精品内容（深度大稿） | xiaowen / 内容创作 | xiaowen, xiaolei, xiaoce, xiaozi, xiaoshen, xiaofa | `app_home` | deep |
| 9 | `local_news` | 本地新闻 | xiaoce / 选题策划 | xiaoce, xiaolei, xiaowen | `app_news` | news |
| 10 | `national_hotspot` | 全国热点图文 | xiaolei / 热点分析 | xiaolei, xiaozi, xiaowen | `app_news` | news |

CMS 二级栏目（"每日 AI 资讯栏目" / "每日探店栏目" / ...）由运营在 `/settings/cms-mapping` 后台映射 `appChannelSlug → cms_catalogs`，不在本期 pre-seed。

---

## 5. 10 条 Seed 完整定义

追加到 `src/db/seed-builtin-workflows.ts` 的 `BUILTIN_WORKFLOWS` 数组末尾。所有 `step()` 复用已有 skill（不新造 skill）。

### 5.1 `daily_ai_news` — 每日 AI 资讯

```ts
{
  slug: "daily_ai_news",
  name: "每日 AI 资讯",
  description: "从热点发现匹配今日 AI 资讯，聚合多源、逐条摘要，合并成稿，发布到 APP 每日 AI 资讯栏目。",
  icon: "sparkles",
  category: "news",
  ownerEmployeeId: "xiaolei",
  defaultTeam: ["xiaolei", "xiaozi", "xiaofa"],
  appChannelSlug: "app_news",
  isFeatured: true,
  launchMode: "form",
  inputFields: [
    { name: "focus_subdomain", label: "AI 子方向", type: "select", required: false, defaultValue: "all",
      options: [
        { value: "all", label: "全部 AI" },
        { value: "llm", label: "大模型" },
        { value: "agent", label: "智能体" },
        { value: "hardware", label: "AI 硬件" },
        { value: "policy", label: "AI 政策" },
      ]},
    { name: "item_count", label: "条目数", type: "number", required: false,
      defaultValue: 8, validation: { min: 3, max: 20 } },
  ],
  systemInstruction:
    "聚焦今日 AI ({{focus_subdomain}}) 资讯，挑选 Top {{item_count}} 条代表性新闻，每条产出 80-120 字概要（事实 + 影响），最后合并为一篇《每日 AI 资讯》稿件，含导语 / 分条目列表 / 收尾观察。",
  promptTemplate:
    "检索并聚合今日 AI 资讯（聚焦 {{focus_subdomain}}），挑选 Top {{item_count}} 条，每条 80-120 字摘要，合并为可直发稿件。",
  steps: [
    step(1, "AI 热榜扫描", "trending_topics", "热榜聚合", "perception", "fetch"),
    step(2, "多源 AI 资讯聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
    step(3, "全网深度搜索", "web_search", "全网搜索", "perception", "search"),
    step(4, "逐条摘要生成", "summary_generate", "摘要生成", "generation", "summary"),
    step(5, "合并成稿", "content_generate", "内容生成", "generation", "write"),
  ],
}
```

### 5.2 `tech_weekly` — 科技周报（深度长文）

```ts
{
  slug: "tech_weekly",
  name: "科技周报（深度长文）",
  description: "围绕指定科技主题范围产出一篇深度长文周报，含趋势洞察、数据支撑与多方观点。",
  icon: "newspaper",
  category: "deep",
  ownerEmployeeId: "xiaowen",
  defaultTeam: ["xiaowen", "xiaoce", "xiaozi"],
  appChannelSlug: "app_news",
  isFeatured: true,
  launchMode: "form",
  inputFields: [
    { name: "topic_scope", label: "主题范围", type: "text", required: true,
      placeholder: "如：大模型应用 / 半导体产业链 / 机器人产业" },
    { name: "week_range", label: "周期范围", type: "daterange", required: false },
    { name: "word_count", label: "目标字数", type: "number", required: false,
      defaultValue: 4500, validation: { min: 2500, max: 10000 } },
    { name: "depth_level", label: "深度档位", type: "select", required: false, defaultValue: "standard",
      options: [
        { value: "light", label: "轻度速览" },
        { value: "standard", label: "标准深度" },
        { value: "heavy", label: "重度研报" },
      ]},
  ],
  systemInstruction:
    "产出一篇围绕「{{topic_scope}}」（覆盖周期 {{week_range}}）的科技周报深度长文，目标 {{word_count}} 字，档位 {{depth_level}}。结构：1) 本周关键事件速览 2) 趋势主题归纳（2-3 条）3) 多方观点 4) 数据支撑 5) 下周看点。",
  promptTemplate:
    "写一篇「{{topic_scope}}」科技周报深度长文（{{week_range}}，{{word_count}} 字，{{depth_level}}）。",
  steps: [
    step(1, "主题背景调研", "web_search", "全网搜索", "perception", "research"),
    step(2, "周度热点聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
    step(3, "同业对标参考", "case_reference", "案例参考", "analysis", "case"),
    step(4, "深度周报撰写", "content_generate", "内容生成", "generation", "write"),
    step(5, "成稿质量复核", "quality_review", "质量审核", "management", "review"),
  ],
}
```

### 5.3 `daily_politics` — 每日时政热点

```ts
{
  slug: "daily_politics",
  name: "每日时政热点",
  description: "按区域 / 紧急程度聚合每日时政热点，经事实核查与合规扫描后产出可发布的时政稿件。",
  icon: "landmark",
  category: "news",
  ownerEmployeeId: "xiaolei",
  defaultTeam: ["xiaolei", "xiaowen", "xiaoshen"],
  appChannelSlug: "app_politics",
  isFeatured: true,
  launchMode: "form",
  inputFields: [
    { name: "region", label: "关注区域", type: "select", required: true, defaultValue: "national",
      options: [
        { value: "national", label: "全国" },
        { value: "sichuan", label: "四川" },
        { value: "chengdu", label: "成都" },
        { value: "international", label: "国际" },
      ]},
    { name: "urgency_level", label: "紧急程度", type: "select", required: false, defaultValue: "normal",
      options: [
        { value: "urgent", label: "紧急（优先发布）" },
        { value: "normal", label: "常规" },
      ]},
    { name: "item_count", label: "条目数", type: "number", required: false,
      defaultValue: 5, validation: { min: 1, max: 10 } },
  ],
  systemInstruction:
    "产出 {{region}} 区域的每日时政热点（紧急程度 {{urgency_level}}），{{item_count}} 条。每条含：1) 100 字内事实摘要 2) 政策背景一句话 3) 影响与走向。全文必经事实核查与合规扫描。",
  promptTemplate:
    "为 {{region}} 产出 {{item_count}} 条每日时政热点（{{urgency_level}}），含核查与合规。",
  steps: [
    step(1, "时政信源聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
    step(2, "多源全网搜索", "web_search", "全网搜索", "perception", "search"),
    step(3, "事实核查", "fact_check", "事实核查", "management", "verify"),
    step(4, "时政稿件撰写", "content_generate", "内容生成", "generation", "write"),
    step(5, "合规审查", "compliance_check", "合规审核", "management", "compliance"),
  ],
}
```

### 5.4 `daily_podcast` — 每日热点播客

```ts
{
  slug: "daily_podcast",
  name: "每日热点播客",
  description: "自动锁定今日热点，输出 1-3 集播客脚本（开场 / 主讲 / 互动 / 收尾），可发送至 AIGC 播客加工。",
  icon: "mic",
  category: "podcast",
  ownerEmployeeId: "xiaowen",
  defaultTeam: ["xiaowen", "xiaolei", "xiaojian"],
  appChannelSlug: "app_livelihood_podcast",
  isFeatured: true,
  launchMode: "direct",
  inputFields: [],
  systemInstruction:
    "从今日热榜挑选 1-3 个适合播客节奏的选题，每个输出一集播客脚本。结构：开场钩子（30 秒）/ 主讲（6-8 分钟，口语化）/ 互动问答（2-3 个）/ 收尾金句。末尾给出音频节奏建议（BPM / 音乐风格）。",
  promptTemplate:
    "基于今日热榜生成 1-3 集每日热点播客脚本，含 4 段结构与音频节奏建议。",
  steps: [
    step(1, "今日热榜扫描", "trending_topics", "热榜聚合", "perception", "fetch"),
    step(2, "选题价值评分", "heat_scoring", "热度评分", "analysis", "score"),
    step(3, "播客脚本撰写", "content_generate", "内容生成", "generation", "write"),
    step(4, "音频节奏规划", "audio_plan", "音频规划", "generation", "audio"),
  ],
}
```

### 5.5 `daily_tandian` — 每日探店

```ts
{
  slug: "daily_tandian",
  name: "每日探店",
  description: "按城市 + 店型生成 6 阶段探店脚本 + 图文稿件，含广告法合规扫描。",
  icon: "map-pin",
  category: "livelihood",
  ownerEmployeeId: "xiaojian",
  defaultTeam: ["xiaojian", "xiaowen", "xiaoshen"],
  appChannelSlug: "app_livelihood_tandian",
  isFeatured: true,
  launchMode: "form",
  inputFields: [
    { name: "city", label: "城市", type: "select", required: true, defaultValue: "成都",
      options: ["成都", "重庆", "深圳", "广州", "上海", "北京", "杭州", "武汉"] },
    { name: "shop_type", label: "店型", type: "select", required: true, defaultValue: "餐饮",
      options: ["餐饮", "茶饮", "咖啡", "烘焙", "美妆", "亲子", "夜生活"] },
    { name: "shop_name", label: "具体门店", type: "text", required: false,
      placeholder: "留空则由系统在该城市 × 店型中挑选热门店" },
  ],
  systemInstruction:
    "为 {{city}} 的 {{shop_type}}（具体门店：{{shop_name}}）产出"每日探店"。视频脚本必须含 6 阶段：到店 / 环境 / 招牌菜 / 试吃 / 服务 / 回味，每段标注时长与景别。配套图文稿 600-900 字。全文经广告法极限词扫描。",
  promptTemplate:
    "为 {{city}} 的 {{shop_type}}（{{shop_name}}）产出 6 阶段探店脚本 + 图文 + 合规扫描。",
  steps: [
    step(1, "门店信息检索", "web_search", "全网搜索", "perception", "search"),
    step(2, "本地口碑聚合", "social_listening", "社交舆情", "perception", "listen"),
    step(3, "探店脚本生成（6 阶段）", "video_edit_plan", "视频剪辑规划", "generation", "plan"),
    step(4, "图文稿撰写", "content_generate", "内容生成", "generation", "write"),
    step(5, "广告法合规扫描", "compliance_check", "合规审核", "management", "compliance"),
  ],
}
```

### 5.6 `daily_chuanchao` — 每日川超战报

```ts
{
  slug: "daily_chuanchao",
  name: "每日川超战报",
  description: "通过热点检索匹配近期川超热门比赛，输出赛事简介 / 进球集锦 / 赛前花絮 / 赛后影响的图文新闻。",
  icon: "trophy",
  category: "news",
  ownerEmployeeId: "xiaolei",
  defaultTeam: ["xiaolei", "xiaozi", "xiaowen"],
  appChannelSlug: "app_sports",
  isFeatured: true,
  launchMode: "direct",
  inputFields: [],
  systemInstruction:
    "检索近期川超热门比赛（优先最近 3 天），挑选 1-2 场重点赛事。每场产出：1) 赛事简介（对阵 / 比分 / 关键时刻）2) 进球集锦要点（含时间点）3) 赛前准备 / 花絮 4) 赛后影响（积分 / 舆情）。图文可直发体育频道。",
  promptTemplate:
    "检索近期川超热门比赛，产出每日川超战报（4 段结构图文）。",
  steps: [
    step(1, "川超赛事热点扫描", "trending_topics", "热榜聚合", "perception", "fetch"),
    step(2, "赛事信息深读", "web_deep_read", "网页深读", "perception", "crawl"),
    step(3, "同类赛事案例参考", "case_reference", "案例参考", "analysis", "case"),
    step(4, "战报图文撰写", "content_generate", "内容生成", "generation", "write"),
  ],
}
```

### 5.7 `zhongcao_daily` — 种草日更

```ts
{
  slug: "zhongcao_daily",
  name: "种草日更",
  description: "针对指定平台产出种草内容（含广告法极限词扫描），经合规审核后可一键分发到 APP 种草栏目。",
  icon: "sprout",
  category: "social",
  ownerEmployeeId: "xiaowen",
  defaultTeam: ["xiaowen", "xiaoshen", "xiaofa"],
  appChannelSlug: "app_livelihood_zhongcao",
  isFeatured: true,
  launchMode: "form",
  inputFields: [
    { name: "platform", label: "目标平台", type: "select", required: true, defaultValue: "xiaohongshu",
      options: [
        { value: "xiaohongshu", label: "小红书" },
        { value: "douyin", label: "抖音" },
        { value: "bilibili", label: "B 站" },
        { value: "video_channel", label: "视频号" },
      ]},
    { name: "product_type", label: "种草品类", type: "text", required: true,
      placeholder: "如：平价彩妆 / 3C 数码 / 儿童图书" },
    { name: "post_count", label: "条目数", type: "number", required: false,
      defaultValue: 3, validation: { min: 1, max: 8 } },
  ],
  systemInstruction:
    "为 {{platform}} 产出 {{post_count}} 条关于「{{product_type}}」的种草内容。每条含：1) 钩子标题 2) 3-5 段种草正文（痛点 / 体验 / 对比 / 推荐理由）3) 推荐 tag 4) 发布时段建议。全文经广告法极限词扫描。",
  promptTemplate:
    "为 {{platform}} 产出 {{post_count}} 条「{{product_type}}」种草，含合规扫描与发布策略。",
  steps: [
    step(1, "平台趋势扫描", "trending_topics", "热榜聚合", "perception", "fetch"),
    step(2, "种草脚本生成", "zhongcao_script", "种草脚本", "generation", "script"),
    step(3, "广告法合规扫描", "compliance_check", "合规审核", "management", "compliance"),
    step(4, "发布策略生成", "publish_strategy", "发布策略", "management", "strategy"),
  ],
}
```

### 5.8 `pub.feature_story_pipeline` — 精品内容（深度大稿）（合并改名）

**不新增**，改现有 `pub.feature_story_pipeline`：

```ts
// 修改点（其他字段保持不变）
{
  slug: "pub.feature_story_pipeline",
  name: "精品内容（深度大稿）",                    // 🔧 原："特稿生产线"
  description: "重大热点或指定选题的 6 人协同深度大稿生产，覆盖调研 → 撰写 → 核查 → 合规全链路，产出发布到 APP 首页精品内容栏目。", // 🔧 微调
  icon: "pen-tool",
  category: "deep",
  ownerEmployeeId: "xiaowen",                      // 🔧 原：null
  defaultTeam: ["xiaowen","xiaolei","xiaoce","xiaozi","xiaoshen","xiaofa"], // 🔧 固定 6 人（owner 首位，遵循项目约定）
  appChannelSlug: "app_home",                      // 🔧 原：app_news
  isFeatured: true,                                // 🆕
  // launchMode / inputFields / systemInstruction / promptTemplate / steps：全部保留
}
```

### 5.9 `local_news` — 本地新闻

```ts
{
  slug: "local_news",
  name: "本地新闻",
  description: "按本地区域 + 范围匹配全网与内部数据源内容，多篇改写后产出本地新闻稿件。",
  icon: "map",
  category: "news",
  ownerEmployeeId: "xiaoce",
  defaultTeam: ["xiaoce", "xiaolei", "xiaowen"],
  appChannelSlug: "app_news",
  isFeatured: true,
  launchMode: "form",
  inputFields: [
    { name: "region", label: "本地区域", type: "text", required: true, defaultValue: "成都",
      placeholder: "如：成都 / 成都·武侯区" },
    { name: "topic_scope", label: "新闻范围", type: "multiselect", required: true,
      options: [
        { value: "food", label: "美食" },
        { value: "travel", label: "旅游" },
        { value: "livelihood", label: "民生" },
        { value: "culture", label: "文化" },
        { value: "transport", label: "交通" },
      ]},
    { name: "article_count", label: "产出条数", type: "number", required: false,
      defaultValue: 3, validation: { min: 1, max: 6 } },
  ],
  systemInstruction:
    "围绕 {{region}} 在 {{topic_scope}} 范围的本地新闻，通过全网检索 + 内部数据源匹配素材，产出 {{article_count}} 篇改写稿件。每篇：1) 本地化标题 2) 800-1500 字正文（含本地视角）3) 引用信源标注。",
  promptTemplate:
    "为 {{region}} 产出 {{article_count}} 篇 {{topic_scope}} 范围的本地新闻改写稿。",
  steps: [
    step(1, "本地新闻聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
    step(2, "全网搜索补充", "web_search", "全网搜索", "perception", "search"),
    step(3, "多源素材改写", "style_rewrite", "风格改写", "generation", "rewrite"),
    step(4, "本地新闻成稿", "content_generate", "内容生成", "generation", "write"),
  ],
}
```

### 5.10 `national_hotspot` — 全国热点图文

```ts
{
  slug: "national_hotspot",
  name: "全国热点图文",
  description: "输入关注的热点范围（苏超 / AI 发展 / ...），通过全网检索 + 数据源匹配，多篇内容改写输出全国热点图文。",
  icon: "flame",
  category: "news",
  ownerEmployeeId: "xiaolei",
  defaultTeam: ["xiaolei", "xiaozi", "xiaowen"],
  appChannelSlug: "app_news",
  isFeatured: true,
  launchMode: "form",
  inputFields: [
    { name: "topic_range", label: "热点范围", type: "text", required: true,
      placeholder: "如：苏超 / AI 发展 / 新能源政策" },
    { name: "article_count", label: "产出条数", type: "number", required: false,
      defaultValue: 3, validation: { min: 1, max: 6 } },
    { name: "rewrite_tone", label: "改写风格", type: "select", required: false, defaultValue: "news_standard",
      options: [
        { value: "news_standard", label: "标准新闻" },
        { value: "serious", label: "严肃权威" },
        { value: "casual", label: "轻松叙事" },
      ]},
  ],
  systemInstruction:
    "围绕「{{topic_range}}」做全网热点匹配（外网检索 + 内部数据源），产出 {{article_count}} 篇 {{rewrite_tone}} 风格的改写稿件，每篇 600-1200 字。含：钩子标题 / 事实回顾 / 多方观点 / 延伸阅读。",
  promptTemplate:
    "为「{{topic_range}}」产出 {{article_count}} 篇全国热点图文（{{rewrite_tone}}）。",
  steps: [
    step(1, "全网热点扫描", "trending_topics", "热榜聚合", "perception", "fetch"),
    step(2, "多源新闻聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
    step(3, "多篇素材改写", "style_rewrite", "风格改写", "generation", "rewrite"),
    step(4, "热点图文成稿", "content_generate", "内容生成", "generation", "write"),
  ],
}
```

---

## 6. UI / DAL 层变更

### 6.1 `src/lib/dal/workflow-templates-listing.ts` — 扩展查询

新增统一接口 `listTemplatesForHomepageByTab(orgId, tab)`，支持 10 种 tab key。旧函数 `listTemplatesForHomepageByEmployee` 保留为 deprecated 别名（转发到新函数），避免其他调用点爆炸。

```ts
export type HomepageTabKey =
  | "featured"
  | EmployeeId
  | "custom";

export async function listTemplatesForHomepageByTab(
  orgId: string,
  tab: HomepageTabKey,
): Promise<WorkflowTemplateRow[]>;
```

分支逻辑：
- `featured` → `isFeatured = true AND isPublic = true`
- `custom` → `isBuiltin = false AND isPublic = true`
- EmployeeId → `ownerEmployeeId = tab AND isPublic = true`

全部附加 `organizationId = orgId` 和 `orderBy(asc(createdAt))`。

### 6.2 `src/app/(dashboard)/home/page.tsx` — 并行 10 路加载

```ts
const [
  featured, xiaolei, xiaoce, xiaozi, xiaowen,
  xiaojian, xiaoshen, xiaofa, xiaoshu, custom,
] = await Promise.all([
  listTemplatesForHomepageByTab(orgId, "featured"),
  listTemplatesForHomepageByTab(orgId, "xiaolei"),
  listTemplatesForHomepageByTab(orgId, "xiaoce"),
  listTemplatesForHomepageByTab(orgId, "xiaozi"),
  listTemplatesForHomepageByTab(orgId, "xiaowen"),
  listTemplatesForHomepageByTab(orgId, "xiaojian"),
  listTemplatesForHomepageByTab(orgId, "xiaoshen"),
  listTemplatesForHomepageByTab(orgId, "xiaofa"),
  listTemplatesForHomepageByTab(orgId, "xiaoshu"),
  listTemplatesForHomepageByTab(orgId, "custom"),
]);

const templatesByTab = {
  featured, xiaolei, xiaoce, xiaozi, xiaowen,
  xiaojian, xiaoshen, xiaofa, xiaoshu, custom,
};
```

### 6.3 `src/components/home/scenario-grid.tsx` — 改 TAB_ORDER

```ts
const TAB_ORDER: Array<{ key: HomepageTabKey; label: string }> = [
  { key: "featured",  label: "主流场景" },
  { key: "xiaolei",   label: "热点分析" },
  { key: "xiaoce",    label: "选题策划" },
  { key: "xiaozi",    label: "素材研究" },
  { key: "xiaowen",   label: "内容创作" },
  { key: "xiaojian",  label: "视频脚本" },
  { key: "xiaoshen",  label: "质量审核" },
  { key: "xiaofa",    label: "渠道运营" },
  { key: "xiaoshu",   label: "数据分析" },
  { key: "custom",    label: "我的工作流" },
];
```

默认选中 `featured`。卡片 UI（icon + name + description + team 头像 + 启动按钮）不变。

### 6.4 `src/db/seed-builtin-workflows.ts` — 追加 10 条 + 改精品内容

- 在 `BUILTIN_WORKFLOWS` 数组末尾追加 `daily_ai_news` / `tech_weekly` / `daily_politics` / `daily_podcast` / `daily_tandian` / `daily_chuanchao` / `zhongcao_daily` / `local_news` / `national_hotspot`（9 条新增）
- 修改现有 `pub.feature_story_pipeline` 的 name / description / ownerEmployeeId / defaultTeam / appChannelSlug / isFeatured 6 个字段

### 6.5 `toBuiltinSeedInput` 透传 `isFeatured`

```ts
function toBuiltinSeedInput(w: BuiltinWorkflowSeed): BuiltinSeedInput {
  return {
    // ... 现有字段
    isFeatured: w.isFeatured ?? false,  // 🆕
  };
}
```

`BuiltinSeedInput` 类型（`src/lib/dal/workflow-templates.ts`）同步增加 `isFeatured?: boolean`，`seedBuiltinTemplatesForOrg` 写入 DB 时使用。

---

## 7. 不变动的部分

- ✅ `startMissionFromTemplate` server action — 按 template.id 驱动，不关心分类
- ✅ `WorkflowLaunchDialog` — 按 inputFields 渲染表单，不关心 tab
- ✅ Mission executor / Inngest 函数 / CMS publishing — 全靠 `mission.scenario`（slug）分发，新增 10 个 slug 只要能匹配到 template.id 即可，不改 executor 本身
- ✅ `channels/gateway.ts` / `SCENARIO_CONFIG` / `ADVANCED_SCENARIO_CONFIG` 等 B.2 legacy 代码 —— 本期完全不碰（留给 scenario-legacy-cleanup spec）
- ✅ `employees` 表 / `skills` 表 / `employee_skills` 表 —— 不动
- ✅ 现有 26 条 builtin 模板的 DB 数据（除 `pub.feature_story_pipeline` 外）—— 完全不动
- ✅ 首页其他区域（"今日工作流"、"活动流"等）—— 不动

---

## 8. 验收门槛

1. `npx tsc --noEmit` 通过
2. `npm run build` 通过
3. `npm run db:generate && npm run db:migrate` 应用 `is_featured` 列 migration
4. `npm run db:seed` 重新运行后：
   - `workflow_templates` 多出 9 条新 builtin（`daily_ai_news` ... `national_hotspot`）
   - `pub.feature_story_pipeline` 被 upsert 为新字段组合
   - 10 条 featured（9 新增 + 1 合并）都有 `is_featured = true`
5. 首页 `/home` 手工验证：
   - 10 个 tab 按"主流场景 / 热点分析 / ... / 我的工作流"顺序显示
   - 默认选中"主流场景"，显示 10 张卡片
   - 切换到"内容创作"显示 xiaowen 下所有 owner 模板（含 `analysis` / `data_journalism` + `tech_weekly` / `daily_podcast` / `zhongcao_daily` / `pub.feature_story_pipeline` 共 6 条）
   - 切换到"视频脚本"显示 xiaojian 4 条（3 原有 + `daily_tandian`）
6. 随机点一张新卡片（如 `daily_tandian`）→ 表单填成都/餐饮 → 提交 → 创建 mission 并能走到稿件产出步骤（不要求 CMS 真实入库）

---

## 9. 遗留 & 后续

下一期独立 spec 处理：

- **Cron 定时触发**：在现有 Inngest 架构上为 6 个"每日"场景加 cron，每日早晨自动启动 mission
- **AIGC 外链对接**：播客 / 视频脚本产出后调用真实 AIGC 工具（当前仅产出脚本文本）
- **二级 CMS 栏目自动映射**：为新增的 10 个场景预配 `app_channels → cms_catalogs` 默认绑定，减少运营手工工作
- **B.2 legacy 清理**：`SCENARIO_CONFIG` / `ADVANCED_SCENARIO_CONFIG` 常量删除、`channels/gateway.ts` 迁到 DB 读

这些不阻塞本期上线。

---

## 10. 风险与回滚

**风险低**：新增列默认 false、10 条 seed 幂等 upsert、旧 DAL 函数保留别名。

**回滚策略**：
- 代码：revert commit
- DB：`ALTER TABLE workflow_templates DROP COLUMN is_featured;` + 把 `pub.feature_story_pipeline` 的字段手工改回原值（如需要）
- 新增的 9 条 seed 可用 `DELETE FROM workflow_templates WHERE legacy_scenario_key IN (...)` 清理
