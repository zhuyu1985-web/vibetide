# A2 — tikhub Adapter sub-spec

- **版本**：v1.0
- **日期**：2026-05-05
- **作者**：Zhuyu（产品） + Claude（技术方案）
- **关联 main spec**：`/Users/zhuyu/dev/chinamcloud/vibetide/docs/superpowers/specs/2026-05-04-news-research-overhaul-design.md` §4.2
- **关联 plan v2**（main spec 的 plan）：`/Users/zhuyu/dev/chinamcloud/vibetide/docs/superpowers/plans/2026-05-05-a1-collection-hub-upgrade-plan.md` 的 A2 Recommendations
- **状态**：Brainstorming 完成，待 implementation plan
- **工期估算**：4-6 天（P0 3-4d / P1 1-2d / 测试 + commit 0.5-1d / calculate_price 校准 0.5d）

---

## 1. 范围与目标

### 1.1 一句话定义

> 给 Collection Hub 增加第 6 个 Adapter `tikhub`，对接 [tikhub.io](https://tikhub.io) 的统一 REST API，让 vibetide 能从抖音 / 微博 / 小红书 / 微信公众号 / 知乎 5 个平台抓取近期半年内主题相关内容（图文 + 视频 + 短视频 + 图集），定位"主流社媒增量数据通道"。

### 1.2 范围（4-6 天工期内必交付）

- 单个 `tikhub` Adapter（按 `config.platform` 区分 5 个平台）
- 5 个平台 endpoint 选型 + 实施：抖音 web 综合搜索 / 微博搜索 / 小红书 web 笔记搜索 / 微信公众号文章搜索 / 知乎搜索
- configSchema（zod） + configFields（UI 表单条件渲染）
- 入库适配：tikhub 响应 → `NormalizedItem` (含 contentType / attachments / rawMetadata) → Collection Hub Writer → outlet 自动识别（A1 已就绪）
- publishedAt 抽取（各平台 fallback：相对时间 / unix ts / ISO 字符串）
- Rate Limiter token bucket（8 RPS，留 2 RPS buffer 在 tikhub 默认 10 RPS 上限内）
- 月度预算控制：source.config 设阈值 → run 累计 → 80% warn / 100% auto-disable source
- calculate_price 实测：A2 收尾阶段（拿到 key 后）跑一次脚本生成 `pricing.json` hardcoded 表
- 失败/熔断：5xx 重试 1 次后 partial / 429 backoff 5min 重试 / 单 source 30 天错误率 > 50% warn 告警
- mock fixtures（5 个 JSON）+ 单测 + 集成测试（writer 入库带 attachments）
- UI：sources/new 向导加 tikhub Adapter 入口 + platform 下拉 + 平台特定字段条件显示

### 1.3 非目标（YAGNI / 推迟到 V2）

- ❌ P2 三平台（B 站 / 快手 / 今日头条）—— 对生态文明研究权重低，留 backlog
- ❌ 视频 / 音频 / 图集**文件下载到 COS**（main spec Wave 2 W2.1）——只存外链 URL + 缩略图
- ❌ user_profile / hashtag 模式抓取——V1 仅 keyword search（最常用 + 最对齐研究场景）
- ❌ 实时 webhook / push 模式——V1 仅 cron + 手工触发
- ❌ Web Crawler（爬虫绕过反爬）—— tikhub 内置反爬，本侧不做
- ❌ MCP gateway / AI gateway 集成 —— tikhub 提供这些能力但 vibetide 用 REST 直连即可
- ❌ 跨 org 共享预算池 —— 每 source 独立预算
- ❌ 实时计费回写（消费记录返写到 vibetide DB）—— V1 用 calculate_price 估算，事后从 tikhub 控制台对账即可

### 1.4 与 main spec §4.2 对应关系

main spec §4.2 给了 8 平台 P0/P1/P2 切分 + Adapter 配置 schema 草稿 + 计费控制要求。本 sub-spec：
1. **平台范围敲定** P0+P1 = 5 平台（不接 P2）
2. **Adapter 拓扑敲定** 单 adapter 多平台
3. **测试策略敲定** d 混合（先 mock 后真实校准）
4. **限流策略敲定** 8 RPS token bucket
5. **预算阈值默认值敲定** $5/source/月
6. **熔断阈值敲定** 5xx 1 次重试 / 429 5min backoff / 30 天错误率 50%

---

## 2. 已确认决策（来自 A2 brainstorming）

| ID | 问题 | 决策 |
|---|---|---|
| A2-Q1 | API key + 测试策略 | d 混合：先做框架 + mock + 测试通过；后期一次性用真实 key 做 calculate_price 实测 + 各平台 endpoint 行为校准 + 微调 |
| A2-Q2 | Adapter 拓扑 | a 单个 `tikhub` Adapter，按 config.platform 区分（5 个平台共用 auth + rate limiter + budget + 错误处理） |
| A2-Q3 | V1 平台范围 | b P0+P1 = 5 平台（抖音 / 微博 / 小红书 / 微信公众号 / 知乎）；不接 P2（B 站 / 快手 / 今日头条） |
| A2-Q4 | 限流 + 预算 + 熔断 | 8 RPS token bucket / $5 默认月度预算 / 80% warn 100% auto-disable / 5xx 重试 1 次 / 429 backoff 5min / 30 天错误率 > 50% warn |

---

## 3. Adapter 设计

### 3.1 拓扑

单个 `tikhub` Adapter 注册到 `src/lib/collection/registry.ts`：

```ts
// src/lib/collection/adapters/index.ts（修改）
import { tikhubAdapter } from "./tikhub";
registerAdapter(tikhubAdapter);
```

5 个平台共用：
- 同一份 `Authorization: Bearer ${TIKHUB_API_KEY}` 调用
- 同一份 token bucket rate limiter
- 同一份预算估算 + 累计逻辑
- 同一份重试 / 熔断策略
- 同一份 RawItem 标准化路径

每平台特化：
- endpoint 路径
- query 参数构造
- 响应字段抽取（title / url / content / publishedAt / attachments）

### 3.2 configSchema

文件：`src/lib/collection/adapters/tikhub/config.ts`

```ts
import { z } from "zod";

export const TIKHUB_PLATFORMS = ["douyin", "weibo", "xiaohongshu", "wechat_mp", "zhihu"] as const;
export type TikhubPlatform = (typeof TIKHUB_PLATFORMS)[number];

export const tikhubConfigSchema = z.object({
  platform: z.enum(TIKHUB_PLATFORMS),
  searchType: z.literal("keyword").default("keyword"),  // V1 仅 keyword
  keywords: z.array(z.string().min(1)).min(1, "至少一个关键词").max(20, "最多 20 个关键词"),
  timeWindow: z.enum(["day", "week", "halfYear", "all"]).default("halfYear"),
  contentTypes: z.array(z.enum(["video", "image_text", "short_video", "image_set"])).optional(),  // 平台特化默认值
  maxPagesPerRun: z.number().int().min(1).max(10).default(5),
  resultsPerPage: z.number().int().min(10).max(50).default(20),
  monthlyBudgetUsd: z.number().min(0).max(1000).default(5),
});

export type TikhubConfig = z.infer<typeof tikhubConfigSchema>;
```

### 3.3 configFields（UI 向导）

文件：`src/lib/collection/adapters/tikhub/config-fields.ts`

```ts
import type { ConfigField } from "../../types";

export const tikhubConfigFields: ConfigField[] = [
  {
    key: "platform",
    label: "平台",
    type: "select",
    required: true,
    options: [
      { value: "douyin", label: "抖音" },
      { value: "weibo", label: "微博" },
      { value: "xiaohongshu", label: "小红书" },
      { value: "wechat_mp", label: "微信公众号" },
      { value: "zhihu", label: "知乎" },
    ],
  },
  { key: "keywords", label: "关键词", type: "multiselect", required: true, help: "1-20 个关键词" },
  {
    key: "timeWindow",
    label: "时间窗",
    type: "select",
    options: [
      { value: "day", label: "一天内" },
      { value: "week", label: "一周内" },
      { value: "halfYear", label: "半年内" },
      { value: "all", label: "全部（如平台支持）" },
    ],
    help: "tikhub 时间窗最长仅半年内",
  },
  { key: "maxPagesPerRun", label: "每次最大页数", type: "number", validation: { min: 1, max: 10 } },
  { key: "resultsPerPage", label: "每页条数", type: "number", validation: { min: 10, max: 50 } },
  { key: "monthlyBudgetUsd", label: "月度预算（USD）", type: "number", validation: { min: 0 }, help: "默认 $5；超 80% 告警，100% 自动停用" },
];
```

注：`contentTypes` 不在 configFields 显式暴露——按 platform 默认值（如 douyin 默认 short_video，wechat_mp 默认 image_text）。如运营有特殊诉求，V2 再开放。

### 3.4 NormalizedItem 入库映射

入库 `RawItem`（A1 Phase 3 已加 contentType + attachments）：

| RawItem 字段 | tikhub 响应来源 | 备注 |
|---|---|---|
| `title` | response.title / response.desc / response.content_text(微博) | fallback 链 |
| `url` | response.share_url / response.full_url / `https://www.douyin.com/video/{aweme_id}` 拼接 | 各平台特化 |
| `summary` | response.desc / response.content（截 200 字） | optional |
| `publishedAt` | 见 §5 抽取规则 | Date |
| `channel` | `tikhub_${platform}` | 一致前缀 |
| `contentType` | 按平台默认 + content type 推断（详见 §6） | image_text / video / short_video / image_set |
| `attachments` | 详见 §6 | 数组 |
| `rawMetadata` | 全量 tikhub 响应（保留 likes / comments / shares / author / tags 等） | jsonb |

---

## 4. 5 个平台 endpoint 选型

具体 endpoint 路径在 plan 阶段从 tikhub Swagger UI 实测确认（V1 用户授权 scope 已含全部 5 平台）。下表为预计选型（标 ⚠️ 的需 implementer 在 plan Day 1 实测确认）：

| 平台 | 推荐 endpoint | 主要参数 | 备注 |
|---|---|---|---|
| 抖音 | `/api/v1/douyin/web/fetch_general_search_result` ⚠️ | keyword, sort, publish_time, count | sort = 综合 / 时间 / 点赞；publish_time = day/week/halfYear |
| 微博 | `/api/v1/weibo/web/fetch_search_articles` ⚠️ | keyword, page, time_filter | 微博搜索 |
| 小红书 | `/api/v1/xiaohongshu/web/search_notes` | keyword, page, sort, noteType, noteTime | sub-spec 段已实测：noteTime 仅 `""/一天内/一周内/半年内` |
| 微信公众号 | `/api/v1/wechat_mp/article_search` ⚠️ | keyword, page | 时间窗预计仅 `recent_30d` |
| 知乎 | `/api/v1/zhihu/web/search` ⚠️ | keyword, type=content, page | type 可能是 content / answer / article |

**⚠️ 标记的 endpoint 在 plan Day 1 验证。两种探测路径（Swagger UI 阻塞时降级到第 2 种）**：

1. **首选**：访问 https://api.tikhub.io 的 Swagger UI 浏览 endpoint 文档
2. **备用**（推荐 plan Day 1 直接走）：用 `.env.local` 已存的 `TIKHUB_API_KEY` 直接 `curl -H "Authorization: Bearer $KEY" "https://api.tikhub.io/<endpoint_path>?keyword=test&page=1"` 探测，返回 200 + 合理 JSON 即确认可用，返回 404/410/deprecated 则查 [tikhub 文档](https://docs.tikhub.io) 找替代品

如发现某 endpoint 已 deprecated，按 tikhub 文档替代品。

---

## 5. publishedAt 抽取规则

各平台返回的 publishedAt 格式不同，统一规范为 `Date | undefined`：

| 平台 | 字段名候选 | 格式 | 解析方式 |
|---|---|---|---|
| 抖音 | `create_time` / `aweme.create_time` | unix timestamp（秒） | `new Date(ts * 1000)` |
| 微博 | `created_at` | "5 分钟前" / "1 小时前" / "2025-12-01" / "12-01" | 相对时间解析器（自定义） |
| 小红书 | `time` / `create_time` | unix timestamp（毫秒） | `new Date(ts)` |
| 微信公众号 | `publish_time` / `update_time` | unix timestamp（秒） / ISO | 双 fallback |
| 知乎 | `created_time` / `published_time` | unix timestamp（秒） | `new Date(ts * 1000)` |

**微博相对时间解析器**（`src/lib/collection/adapters/tikhub/time-parser.ts`）：

```ts
export function parseWeiboTime(raw: string, refDate = new Date()): Date | undefined {
  if (!raw) return undefined;

  // "5 分钟前" / "刚刚"
  const minMatch = raw.match(/^(\d+)\s*分钟前$/);
  if (minMatch) return new Date(refDate.getTime() - parseInt(minMatch[1]!) * 60 * 1000);
  if (raw === "刚刚") return refDate;

  // "1 小时前"
  const hourMatch = raw.match(/^(\d+)\s*小时前$/);
  if (hourMatch) return new Date(refDate.getTime() - parseInt(hourMatch[1]!) * 60 * 60 * 1000);

  // "今天 12:34"
  const todayMatch = raw.match(/^今天\s+(\d{2}):(\d{2})$/);
  if (todayMatch) {
    const d = new Date(refDate);
    d.setHours(parseInt(todayMatch[1]!), parseInt(todayMatch[2]!), 0, 0);
    return d;
  }

  // "12-01" / "12-01 10:23"
  const mdMatch = raw.match(/^(\d{1,2})-(\d{1,2})(?:\s+(\d{2}):(\d{2}))?$/);
  if (mdMatch) {
    const d = new Date(refDate.getFullYear(), parseInt(mdMatch[1]!) - 1, parseInt(mdMatch[2]!));
    if (mdMatch[3]) d.setHours(parseInt(mdMatch[3]!), parseInt(mdMatch[4]!));
    return d;
  }

  // ISO / "2025-12-01" / "2025-12-01 10:23:00"
  const iso = new Date(raw);
  return isNaN(iso.getTime()) ? undefined : iso;
}
```

---

## 6. attachments 字段映射

按 platform + 内容类型拆分填充规则：

### 6.1 抖音（短视频）

```ts
contentType = "short_video"
attachments = [
  { kind: "video", url: video.play_addr.url_list[0], durationMs: video.duration, width: video.width, height: video.height },
  { kind: "thumbnail", url: video.cover.url_list[0], width: video.cover.width, height: video.cover.height },
]
```

### 6.2 微博（图文 / 图集 / 视频）

```ts
// 图文：仅 1 条 thumbnail（如果有），attachments = []
// 图集（pic_num > 1）：N 条 image
// 视频：1 条 video + 1 条 thumbnail
```

按响应中 `mblog.pic_urls.length` / `mblog.page_info.type` 判断。

### 6.3 小红书

```ts
// noteType=1 视频笔记
contentType = "video"  // 或 "short_video" by duration
attachments = [{ kind: "video", url: ... }, { kind: "thumbnail", ... }]

// noteType=2 图文笔记
contentType = "image_set"  // 多图
attachments = [{ kind: "image", url: img1 }, { kind: "image", url: img2 }, ...]
```

### 6.4 微信公众号

```ts
contentType = "image_text"
attachments = []  // 文章正文里的图不下载，仅存 URL 在 rawMetadata.cover_url + content
```

### 6.5 知乎

```ts
contentType = "image_text"
attachments = []  // 同微信
```

---

## 7. Rate Limiter + 预算 + 熔断

### 7.1 Rate Limiter（8 RPS token bucket）

文件：`src/lib/collection/adapters/tikhub/rate-limiter.ts`

```ts
class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;
  constructor(private readonly capacity: number, private readonly refillPerSec: number) {
    this.tokens = capacity;
    this.lastRefillMs = Date.now();
  }
  async acquire(): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= 1) { this.tokens -= 1; return; }
      const waitMs = Math.ceil((1 - this.tokens) / this.refillPerSec * 1000);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  private refill() {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillMs;
    this.tokens = Math.min(this.capacity, this.tokens + (elapsedMs / 1000) * this.refillPerSec);
    this.lastRefillMs = now;
  }
}

// 进程级单例（所有 tikhub source 共用一个池）
export const tikhubRateLimiter = new TokenBucket(8, 8);
```

每次 fetch 前 `await tikhubRateLimiter.acquire()`。

**⚠️ V1 进程级单例局限性**：`tikhubRateLimiter` 是 module-level `const`，每个 Node.js 进程有独立 token bucket。Inngest 多 worker 部署时实际并发会达到 `8 RPS × worker 数`，突破 tikhub 10 RPS 上限。

**V1 处理策略**：
- 假设 vibetide dev/staging 部署是单 worker（与 Phase 0 / Phase 1 现实一致）
- 在 production 单进程环境下风险可控
- 如未来扩到多 worker，V2 改造为"基于 `collection_runs` 调用时间戳的 DB 级滑动窗口"或者"Redis 级 token bucket 共享"

**预防措施**：监控面板（§8.4）展示当月 429 错误率；如高于 5% → 触发架构评估改 DB 级。

### 7.2 预算控制（calculate_price + threshold + auto-disable）

**Pricing 实测**（A2 收尾阶段）：

```ts
// scripts/dev-tikhub-pricing-probe.ts（一次性脚本）
const ENDPOINTS = [
  "/api/v1/douyin/web/fetch_general_search_result",
  "/api/v1/weibo/web/fetch_search_articles",
  // ...
];
for (const endpoint of ENDPOINTS) {
  const result = await fetch(`${TIKHUB_API_BASE_URL}${CALCULATE_PRICE_PATH}?endpoint=${endpoint}&request_per_day=100`, {
    headers: { Authorization: `Bearer ${TIKHUB_API_KEY}` },
  }).then(r => r.json());
  console.log(endpoint, result);
}
// 输出 → 写入 src/lib/collection/adapters/tikhub/pricing.json
```

**pricing.json 结构**：

```json
{
  "/api/v1/douyin/web/fetch_general_search_result": { "basePrice": 0.005, "tier1Discount": 0.0045 },
  "/api/v1/weibo/web/fetch_search_articles": { "basePrice": 0.003 },
  "...": "..."
}
```

**run 估算**：

```ts
function estimateCost(config: TikhubConfig): number {
  const expectedCalls = config.keywords.length * config.maxPagesPerRun;
  const endpoint = pickEndpoint(config.platform);
  const price = pricing[endpoint]?.basePrice ?? 0.005;
  return expectedCalls * price;
}
```

**累计 + 阈值**：

- 每次 fetch 完成在 `collection_runs.metadata.tikhubCostUsd += <call_cost>`
- 月初 cron 任务（每月 1 号 00:00 重置 `collection_sources.config.tikhubMonthlyAccumulatedUsd = 0`）
- 单 run 完成后检查：累计 ≥ 80% budget → log warn；≥ 100% → auto-disable source（`enabled = false`，`disabled_reason = "monthly_budget_exceeded"`）

### 7.3 熔断（5xx / 429）

**5xx**：

```ts
async function fetchWithRetry(url: string, options): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {  // 最多 2 次（首次 + 重试 1 次）
    const r = await fetch(url, options);
    if (r.status < 500) return r;  // 4xx 不重试（业务错）
    if (attempt === 0) await new Promise(r => setTimeout(r, 5000));  // 5 秒 backoff
  }
  throw new Error("5xx after retry");
}
```

**429**：

```ts
// rateLimiter 会先拦截大部分；如果实际 server 端返回 429（说明 rateLimiter 估算不准）
if (r.status === 429) {
  await new Promise(r => setTimeout(r, 5 * 60 * 1000));  // 5 min backoff
  return fetchWithRetry(url, options);  // 重试 1 次
}
```

**30 天错误率 > 50%**：

通过查询 `collection_logs WHERE source_id=? AND level='error' AND logged_at > now() - 30 days` 计算。每次 run 完成时计算并写 warn 日志（不自动 disable，让运营决定）。

---

## 8. UI 改动

### 8.1 sources/new 向导

`/data-collection/sources/new` 新建源向导现有 4 步：基本信息 → 选 Adapter → 配置 Adapter → 确认。

A2 改 Step 2（选 Adapter）：在现有 5 个 Adapter 选项后追加 `tikhub`：

```
名称：tikhub.io 社媒搜索
描述：抖音 / 微博 / 小红书 / 微信公众号 / 知乎 关键词搜索
分类：search
```

A2 改 Step 3（配置 Adapter）：当 type=tikhub，渲染 `tikhubConfigFields` 字段。Platform 下拉是核心字段，其它字段都按 platform 通用。

### 8.2 sources 详情页

无需改动 — A1 已加 outlet 字段，本 Adapter 沿用。

### 8.3 内容浏览页

无需改动 — Adapter 写入 `content_type / attachments` 后，DataTable 用现有 outlet 列（A1 加的）。**视频/图集预览 V2 再做**（W2.3 互动钻取里加 thumbnail 预览）。

### 8.4 监控面板

新增"tikhub 月度费用"卡片（V1 简版）：
- 当月累计 USD（所有 tikhub source 加总）
- 当月调用次数
- 高消耗源 Top 5

V1 仅展示，不做趋势图。

---

## 9. 测试策略

### 9.1 mock fixtures

`src/lib/collection/adapters/tikhub/__fixtures__/`：

```
douyin-search.json       — 抖音 web search 真实响应 sample（10 条 short_video）
weibo-search.json         — 微博搜索真实响应 sample（5 图文 + 3 视频 + 2 图集）
xiaohongshu-search.json   — 小红书 search_notes 真实响应（5 视频 + 5 图文）
wechat-mp-search.json     — 微信公众号文章搜索 sample（10 image_text）
zhihu-search.json         — 知乎 search 真实响应（10 image_text）
```

每个 fixture 通过：A2 收尾阶段拿真实 key 调一次 endpoint，把响应保存为 fixture（脱敏处理：删掉 access_token / 用户 ID 改为假值）。

### 9.2 单测

`src/lib/collection/adapters/tikhub/__tests__/`：

| 测试文件 | 测试范围 |
|---|---|
| `time-parser.test.ts` | parseWeiboTime 各种格式（10+ case） |
| `attachment-mapper.test.ts` | 5 个平台的 attachments 映射规则 |
| `rate-limiter.test.ts` | TokenBucket 的 acquire 排队 + refill |
| `tikhub.test.ts` | execute 接收 fixture mock → 返回 RawItem[]（5 个平台各 1 case） |

### 9.3 集成测试

`src/lib/collection/__tests__/writer.test.ts`（修改加 case）：

- writer 接收 tikhub 输出的 RawItem（带 attachments）→ 写入 collected_items.attachments jsonb
- 验证 contentType 字段正确（image_text / short_video / image_set）
- 验证 outlet 自动识别正常（A1 recognizer 通过 publicAccountName 识别公众号）

### 9.4 真实 API 校准（A2 收尾阶段）

在所有 mock 测试通过后，跑一次集成验证：
1. 调 calculate_price 实测 5 个 endpoint → 写 pricing.json
2. 各平台用 1 关键词调一次真实 search → 用 1 个 fixture 比对响应结构（看 mock 是否准确）
3. 如响应结构与 mock 不符 → 微调 mapper + 重跑单测
4. 全部通过 → commit pricing.json + 更新 fixtures

---

## 10. 工期分解（4-6 天）

| Day | 任务 | 产出 |
|---|---|---|
| Day 1 | Adapter 框架（configSchema / configFields） + RateLimiter + 预算字段（schema 改动）+ 接入 registry + Swagger UI 实测 5 个 endpoint 路径 | tikhub adapter type 注册 / 4 个 ⚠️ endpoint 路径敲定 |
| Day 2 | P0 平台：抖音 + 微博 endpoint 实施（mapper / publishedAt / attachments）+ time-parser 单测 | 2 平台抓取链路通 + 微博相对时间解析通过 |
| Day 3 | P0 平台：小红书 endpoint 实施（noteType + 图集 attachments） + 5 个 fixture 编写（基于现有 tavily fixture 风格） | 3 P0 平台 mock 测试全过 |
| Day 4 | P1 平台：微信公众号 + 知乎 endpoint 实施 + execute 主函数集成 + 错误处理 / 熔断 | 5 平台 mock 测试全过 |
| Day 5 | 集成测试（writer + tikhub）+ UI 改动（sources/new 加 tikhub Adapter 选项 + platform 下拉）+ 监控面板 tikhub 费用卡片 + **Inngest cron 月初累计重置**（每月 1 号 00:00 把所有 tikhub source 的 `tikhubMonthlyAccumulatedUsd = 0`）| UI 跑通 + 集成测试通过 + cron 注册 |
| Day 6（可选）| calculate_price 实测（拿 key 后） + pricing.json 落地 + 真实 API 校准 + commit | A2 第二块完工 |

---

## 11. 验收标准

### 11.1 功能验收

- [ ] tikhub Adapter 注册成功（registry 含第 6 个 type）
- [ ] sources/new 向导能新建 tikhub 源（5 个 platform 选项）
- [ ] 5 平台 endpoint 各自抓取（mock fixture）通过：抖音/微博/小红书/微信/知乎
- [ ] 抓取入库后 collected_items.contentType / attachments 字段正确填充
- [ ] outlet 自动识别（A1 recognizer）通过 publicAccountName 识别命中（如"涪陵发布"匹配 chongqing-eco-gov 字典）
- [ ] 月度预算阈值生效：达 80% 写 warn 日志；达 100% auto-disable source

### 11.2 性能验收

- [ ] Rate Limiter 8 RPS 严格限速（实测调用 100 次耗时 ≥ 12.5 秒）
- [ ] 单 run 5 个平台并发不会撞 RPS 上限（无 429）

### 11.3 数据正确性

- [ ] tsc --noEmit 零错
- [ ] npm run build 通过
- [ ] A2 单测全过（time-parser / attachment-mapper / rate-limiter / tikhub adapter）
- [ ] writer.test.ts 集成 case 通过（tikhub item 入库后 attachments 字段正确）

### 11.4 真实 API 校准（Day 6）

- [ ] calculate_price 实测 5 个 endpoint 价格 → pricing.json 落地
- [ ] 真实 API 响应结构与 mock fixture 对齐（如不齐则 fixture 升级）
- [ ] 真实抓取一条人民日报微信公众号文章 → outlet_tier 自动识别为 central

---

## 12. 留待 plan 阶段细化的开放问题

| # | 问题 | 解决时机 |
|---|---|---|
| 1 | 5 个平台具体 endpoint 路径（4 个 ⚠️ 标记的） | Day 1 Swagger UI 实测 |
| 2 | calculate_price endpoint 的实际路径（前面 sub-spec 探查时 404） | Day 1 同上 |
| 3 | 微博相对时间格式覆盖（除"5 分钟前"还有什么变体） | Day 2 实测时补充 case |
| 4 | 小红书 noteType 的实际枚举值（plan v2 写的是 _0/_1/_2/_3） | Day 3 实测确认 |
| 5 | 知乎 search type 的实际值（content / answer / article） | Day 4 实测确认 |
| 6 | mock fixture 的真实数据（拿真实 key 调一次后脱敏保存） | Day 6 |
| 7 | UI 向导第 3 步的字段条件渲染（platform-specific defaults） | Day 5 |
| 8 | 监控面板"tikhub 月度费用"卡片的具体设计 | Day 5 |

---

## 13. 进入下一步

本 sub-spec 通过后：

1. **本 sub-spec → spec-document-reviewer 审查**（最多 3 轮）
2. **审查通过 → 用户最终 approve**
3. **进入 A2 implementation plan**（用 `superpowers:writing-plans` 写 Day 1-6 任务级计划）
4. **plan 通过 review → 用 subagent-driven-development 执行**（同 A1 模式）
5. **commit + 整 A2 final review → 进 A2.5 Excel 导入 Adapter sub-brainstorm**
