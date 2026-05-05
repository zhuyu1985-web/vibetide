# A2 tikhub Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 接入 [tikhub.io](https://tikhub.io) 的统一 REST API 作为 Collection Hub 第 6 个 Adapter，覆盖抖音 / 微博 / 小红书 / 微信公众号 / 知乎 5 个主流社媒平台的关键词搜索抓取，定位"近期半年内增量数据通道"。

**Architecture:** 单 adapter 多平台拓扑 — 一个 `tikhub` adapter type 按 `config.platform` 区分 5 个平台。共用 `TIKHUB_API_KEY` Bearer auth + 进程级 8 RPS token bucket 限速 + per-source 月度预算（默认 $5）+ 5xx/429 重试熔断。各平台特化：endpoint 路径、参数构造、响应字段抽取（title/url/publishedAt/attachments）。RawItem 标准化后由 Collection Hub Writer（A1 已就绪）做 outlet 自动识别 + 入库。

**Tech Stack:** Next.js 16 / TypeScript strict / Drizzle ORM 0.45 + postgres / Supabase / Inngest / Vitest / Zod / iron-session。`tikhub` 平台直连 REST（不接 MCP gateway / AI gateway）。

**关联 sub-spec:** `/Users/zhuyu/dev/chinamcloud/vibetide/docs/superpowers/specs/2026-05-05-a2-tikhub-adapter-design.md`

**关联 main spec:** `/Users/zhuyu/dev/chinamcloud/vibetide/docs/superpowers/specs/2026-05-04-news-research-overhaul-design.md` §4.2

**总工期：4-6 工作日**（P0 3-4d / P1 1-2d / 集成测试+UI 0.5-1d / calculate_price 校准 0.5d）

---

## 全局约定

- **单分支约定**（CLAUDE.md）：所有 commit 直接落 `main`，不开 feature branch
- **Pre-commit hook**：husky 跑全套 vitest 含 flaky test，所有 commit 用 `--no-verify`（用户已授权本 Wave 1 全程）
- **绝对路径**：所有文件引用使用绝对路径
- **设计系统**（CLAUDE.md "Design System Rules"）：所有按钮/输入/下拉用 vibetide 共享组件 + 无边框 + sonner toast
- **API key 安全**：`TIKHUB_API_KEY` 已存在 `.env.local`（gitignored），代码引用 `process.env.TIKHUB_API_KEY`，**不要写到任何 spec / plan / 注释 / commit message**
- **TDD 节奏**：每个 Task 先写测试（红灯）→ 跑测试预期 fail → 实现 → 跑测试预期 pass
- **A1 已就绪基础**：collected_items 已加 contentType / attachments / outlet_id 字段；recognizer 已在 writer.ts 集成；media_outlet_dictionary 113 条 seed 已灌库

---

## File Structure

### 新建（17 个）

| 文件 | 责任 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/index.ts` | 主 adapter 导出（拼接 SourceAdapter 接口） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/config.ts` | zod configSchema + TIKHUB_PLATFORMS const |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/config-fields.ts` | UI configFields 定义 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/rate-limiter.ts` | TokenBucket 类 + 进程级单例 `tikhubRateLimiter` |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/time-parser.ts` | parseWeiboTime + 各平台 publishedAt fallback |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/attachment-mapper.ts` | 5 平台 attachments 映射 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/http-client.ts` | tikhub fetch 封装（auth header + rate limiter + 5xx/429 重试 + cost 累计） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/budget.ts` | 预算估算 + 累计 + 阈值检查 + auto-disable |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/pricing.json` | 各 endpoint 单价 hardcode 表（Day 1 占位 / Day 6 实测填充） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/platforms/douyin.ts` | 抖音 endpoint + mapper |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/platforms/weibo.ts` | 微博 endpoint + mapper |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/platforms/xiaohongshu.ts` | 小红书 endpoint + mapper |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/platforms/wechat-mp.ts` | 微信公众号 endpoint + mapper |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/platforms/zhihu.ts` | 知乎 endpoint + mapper |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/__fixtures__/<5 个 platform-search.json>` | mock 响应 fixtures |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/__tests__/<5 个 *.test.ts>` | 单测：rate-limiter / time-parser / attachment-mapper / 主 adapter / 5 平台 mapper |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/collection/tikhub-budget-reset.ts` | Inngest cron 月初累计重置 |

### 修改（6 个）

| 文件 | 改动 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/index.ts` | 注册 tikhubAdapter |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/types.ts` | 如需扩展 RawItem（A1 已加 contentType + attachments，确认无需进一步扩展） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/collection.ts` | collection_sources.config 加 tikhubMonthlyAccumulatedUsd 字段（jsonb 内）；如已用 jsonb config 则 schema 不动只看代码层 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/sources/new/new-source-wizard-client.tsx` | 加 tikhub adapter 选项 + platform 下拉 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/monitoring/monitoring-client.tsx` | 加"tikhub 月度费用"卡片 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/__tests__/writer.test.ts` | 加 tikhub 集成测试 case（attachments 入库 + outlet 识别） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/index.ts` | 注册 tikhubBudgetReset cron |

---

## Phase 1：Adapter 框架基础设施（Day 1，约 1 天）

### Task 1.1：探查 5 个平台 endpoint 路径

**目标：** 用 `.env.local` 的 `TIKHUB_API_KEY` 直接 curl 探测，敲定 5 平台真实可用 endpoint 路径（替换 sub-spec §4 中 4 个 ⚠️ 标记的预测值）。

- [ ] **Step 1：自检环境**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
test -f .env.local && grep -c "^TIKHUB_API_KEY=" .env.local
# 期望：1
```

- [ ] **Step 2：导出 key 到 shell**

```bash
export TIKHUB_API_KEY=$(grep "^TIKHUB_API_KEY=" /Users/zhuyu/dev/chinamcloud/vibetide/.env.local | cut -d= -f2-)
echo "key length: ${#TIKHUB_API_KEY}"
# 期望：长度 > 30
```

- [ ] **Step 3：探测 5 个 endpoint**

```bash
# 抖音
curl -sS -H "Authorization: Bearer $TIKHUB_API_KEY" \
  "https://api.tikhub.io/api/v1/douyin/web/fetch_general_search_result?keyword=test&offset=0&count=10" \
  | head -c 300
echo ""

# 微博
curl -sS -H "Authorization: Bearer $TIKHUB_API_KEY" \
  "https://api.tikhub.io/api/v1/weibo/web/fetch_search_articles?keyword=test&page=1" \
  | head -c 300
echo ""

# 小红书
curl -sS -H "Authorization: Bearer $TIKHUB_API_KEY" \
  "https://api.tikhub.io/api/v1/xiaohongshu/web/search_notes?keyword=test&page=1" \
  | head -c 300
echo ""

# 微信公众号
curl -sS -H "Authorization: Bearer $TIKHUB_API_KEY" \
  "https://api.tikhub.io/api/v1/wechat_mp/article_search?keyword=test&page=1" \
  | head -c 300
echo ""

# 知乎
curl -sS -H "Authorization: Bearer $TIKHUB_API_KEY" \
  "https://api.tikhub.io/api/v1/zhihu/web/search?keyword=test&page=1" \
  | head -c 300
echo ""
```

- [ ] **Step 4：记录每平台真实 endpoint 路径**

预期：每个 200 OK + JSON 响应。如 404/410：去 [docs.tikhub.io](https://docs.tikhub.io) 找替代品（注意 tikhub 中文文档：https://docs.tikhub.io/4579905m0）。

记录每平台 ✅ 路径到一份临时 markdown（或直接写入 Task 1.2 的 platforms/<name>.ts 文件 ENDPOINT 常量）。如某平台必须用 v2/v3 或别的 sub-route，记录在案。

- [ ] **Step 5：探测 calculate_price**

```bash
# 尝试两个候选路径
curl -sS -H "Authorization: Bearer $TIKHUB_API_KEY" \
  "https://api.tikhub.io/api/v1/tikhub/billing/calculate_price?endpoint=/api/v1/douyin/web/fetch_general_search_result&request_per_day=100" \
  | head -c 300
echo "---"
curl -sS -H "Authorization: Bearer $TIKHUB_API_KEY" \
  "https://api.tikhub.io/api/v1/billing/calculate_price?endpoint=/api/v1/douyin/web/fetch_general_search_result&request_per_day=100" \
  | head -c 300
echo ""
```

如返回 200：记录正确路径，Day 6 用。
如全部 404：去 [docs.tikhub.io/186826052e0](https://docs.tikhub.io/186826052e0) 查实际路径。

---

### Task 1.2：types + configSchema + configFields

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/config.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/config-fields.ts`

- [ ] **Step 1：read 现有 ConfigField type**

```bash
grep -n "ConfigField\|configFields" /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/types.ts
```

记录 ConfigField 接口字段（key / label / type / required / options / help / validation）。

- [ ] **Step 2：写 config.ts**

```ts
import { z } from "zod";

export const TIKHUB_PLATFORMS = ["douyin", "weibo", "xiaohongshu", "wechat_mp", "zhihu"] as const;
export type TikhubPlatform = (typeof TIKHUB_PLATFORMS)[number];

export const TIKHUB_PLATFORM_LABELS: Record<TikhubPlatform, string> = {
  douyin: "抖音",
  weibo: "微博",
  xiaohongshu: "小红书",
  wechat_mp: "微信公众号",
  zhihu: "知乎",
};

export const tikhubConfigSchema = z.object({
  platform: z.enum(TIKHUB_PLATFORMS),
  searchType: z.literal("keyword").default("keyword"),
  keywords: z.array(z.string().min(1)).min(1, "至少一个关键词").max(20, "最多 20 个关键词"),
  timeWindow: z.enum(["day", "week", "halfYear", "all"]).default("halfYear"),
  contentTypes: z.array(z.enum(["video", "image_text", "short_video", "image_set"])).optional(),
  maxPagesPerRun: z.number().int().min(1).max(10).default(5),
  resultsPerPage: z.number().int().min(10).max(50).default(20),
  monthlyBudgetUsd: z.number().min(0).max(1000).default(5),
});

export type TikhubConfig = z.infer<typeof tikhubConfigSchema>;
```

- [ ] **Step 3：写 config-fields.ts**

```ts
import type { ConfigField } from "../../types";  // 按 Step 1 探查的实际 import 路径调整
import { TIKHUB_PLATFORMS, TIKHUB_PLATFORM_LABELS } from "./config";

export const tikhubConfigFields: ConfigField[] = [
  {
    key: "platform",
    label: "平台",
    type: "select",
    required: true,
    options: TIKHUB_PLATFORMS.map((p) => ({ value: p, label: TIKHUB_PLATFORM_LABELS[p] })),
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

- [ ] **Step 4：tsc 通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

---

### Task 1.3：rate-limiter + 单测（TDD）

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/rate-limiter.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/__tests__/rate-limiter.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, expect, it, vi } from "vitest";
import { TokenBucket } from "../rate-limiter";

describe("TokenBucket", () => {
  it("初始有 capacity 个 token，可立即获取", async () => {
    const bucket = new TokenBucket(3, 1);
    const start = Date.now();
    await bucket.acquire();
    await bucket.acquire();
    await bucket.acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);  // 立即返回
  });

  it("token 用尽后等待 refill", async () => {
    const bucket = new TokenBucket(2, 10);  // 每秒 10 个
    await bucket.acquire();
    await bucket.acquire();
    const start = Date.now();
    await bucket.acquire();  // 第 3 个要等 100ms
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(80);
    expect(elapsed).toBeLessThan(200);
  });

  it("8 RPS 限速实测：8 个调用 1 秒内完成，第 9-16 个第二秒完成", async () => {
    const bucket = new TokenBucket(8, 8);
    const start = Date.now();
    await Promise.all(Array.from({ length: 8 }, () => bucket.acquire()));
    const phase1 = Date.now() - start;
    expect(phase1).toBeLessThan(100);  // 首批立即返回

    await Promise.all(Array.from({ length: 8 }, () => bucket.acquire()));
    const phase2 = Date.now() - start;
    expect(phase2).toBeGreaterThanOrEqual(900);  // 第二批等约 1 秒
    expect(phase2).toBeLessThan(1500);
  }, 5000);
});
```

- [ ] **Step 2：跑测试预期失败**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/collection/adapters/tikhub/__tests__/rate-limiter.test.ts
# 期望：模块 not found
```

- [ ] **Step 3：写实现**

```ts
export class TokenBucket {
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
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  private refill() {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillMs;
    this.tokens = Math.min(this.capacity, this.tokens + (elapsedMs / 1000) * this.refillPerSec);
    this.lastRefillMs = now;
  }
}

// 进程级单例（V1 局限：多 worker 部署会突破 8 RPS，详见 sub-spec §7.1）
export const tikhubRateLimiter = new TokenBucket(8, 8);
```

- [ ] **Step 4：跑测试预期通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/collection/adapters/tikhub/__tests__/rate-limiter.test.ts
# 期望：3/3 pass
```

---

### Task 1.4：time-parser + 完整单测

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/time-parser.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/__tests__/time-parser.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, expect, it } from "vitest";
import { parseWeiboTime, parseTimestampMs, parseTimestampSec } from "../time-parser";

describe("parseWeiboTime", () => {
  const ref = new Date("2026-05-05T12:00:00.000Z");

  it("刚刚 → 当前时间", () => {
    expect(parseWeiboTime("刚刚", ref)?.getTime()).toBe(ref.getTime());
  });

  it("5 分钟前", () => {
    const result = parseWeiboTime("5 分钟前", ref);
    expect(result?.getTime()).toBe(ref.getTime() - 5 * 60 * 1000);
  });

  it("3 小时前", () => {
    const result = parseWeiboTime("3 小时前", ref);
    expect(result?.getTime()).toBe(ref.getTime() - 3 * 60 * 60 * 1000);
  });

  it("今天 14:30", () => {
    const result = parseWeiboTime("今天 14:30", ref);
    expect(result?.getHours()).toBe(14);
    expect(result?.getMinutes()).toBe(30);
  });

  it("12-01（无年份，用 ref 年）", () => {
    const result = parseWeiboTime("12-01", ref);
    expect(result?.getFullYear()).toBe(2026);
    expect(result?.getMonth()).toBe(11);  // 0-indexed
    expect(result?.getDate()).toBe(1);
  });

  it("12-01 10:23（带时间）", () => {
    const result = parseWeiboTime("12-01 10:23", ref);
    expect(result?.getMonth()).toBe(11);
    expect(result?.getHours()).toBe(10);
  });

  it("ISO 字符串 2025-06-15", () => {
    const result = parseWeiboTime("2025-06-15", ref);
    expect(result?.getFullYear()).toBe(2025);
    expect(result?.getMonth()).toBe(5);  // 6 月 → 5
  });

  it("无效字符串返回 undefined", () => {
    expect(parseWeiboTime("aaa", ref)).toBeUndefined();
    expect(parseWeiboTime("", ref)).toBeUndefined();
  });
});

describe("parseTimestampMs / parseTimestampSec", () => {
  it("毫秒 timestamp", () => {
    expect(parseTimestampMs(1733059200000)?.toISOString()).toBe("2024-12-01T12:00:00.000Z");
  });
  it("秒 timestamp", () => {
    expect(parseTimestampSec(1733059200)?.toISOString()).toBe("2024-12-01T12:00:00.000Z");
  });
  it("0 / null / 非法值", () => {
    expect(parseTimestampMs(0)).toBeUndefined();
    expect(parseTimestampMs(null as never)).toBeUndefined();
    expect(parseTimestampSec(undefined as never)).toBeUndefined();
  });
});
```

- [ ] **Step 2：跑测试预期失败**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/collection/adapters/tikhub/__tests__/time-parser.test.ts
```

- [ ] **Step 3：写实现**

```ts
export function parseWeiboTime(raw: string, refDate = new Date()): Date | undefined {
  if (!raw) return undefined;
  if (raw === "刚刚") return new Date(refDate);

  const minMatch = raw.match(/^(\d+)\s*分钟前$/);
  if (minMatch) return new Date(refDate.getTime() - parseInt(minMatch[1]!) * 60 * 1000);

  const hourMatch = raw.match(/^(\d+)\s*小时前$/);
  if (hourMatch) return new Date(refDate.getTime() - parseInt(hourMatch[1]!) * 60 * 60 * 1000);

  const todayMatch = raw.match(/^今天\s+(\d{2}):(\d{2})$/);
  if (todayMatch) {
    const d = new Date(refDate);
    d.setHours(parseInt(todayMatch[1]!), parseInt(todayMatch[2]!), 0, 0);
    return d;
  }

  const mdMatch = raw.match(/^(\d{1,2})-(\d{1,2})(?:\s+(\d{2}):(\d{2}))?$/);
  if (mdMatch) {
    const d = new Date(refDate.getFullYear(), parseInt(mdMatch[1]!) - 1, parseInt(mdMatch[2]!));
    if (mdMatch[3]) d.setHours(parseInt(mdMatch[3]!), parseInt(mdMatch[4]!));
    return d;
  }

  const iso = new Date(raw);
  return isNaN(iso.getTime()) ? undefined : iso;
}

export function parseTimestampMs(ms: number | null | undefined): Date | undefined {
  if (!ms || typeof ms !== "number" || ms <= 0) return undefined;
  return new Date(ms);
}

export function parseTimestampSec(s: number | null | undefined): Date | undefined {
  if (!s || typeof s !== "number" || s <= 0) return undefined;
  return new Date(s * 1000);
}
```

- [ ] **Step 4：跑测试预期通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/collection/adapters/tikhub/__tests__/time-parser.test.ts
# 期望：11/11 pass
```

---

### Task 1.5：http-client + budget + pricing.json 占位 + AdapterResult 扩展

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/http-client.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/budget.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/pricing.json`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/types.ts`（AdapterResult 加 runMetadata）
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/writer.ts`（消费 runMetadata 写到 collection_runs.metadata）

- [ ] **Step 1：pricing.json 占位**（Day 6 实测后填）

```json
{
  "_comment": "Day 6 用 calculate_price 实测填充。占位用 $0.005 保守估计（搜索类高于基础 $0.001）。",
  "/api/v1/douyin/web/fetch_general_search_result": { "basePrice": 0.005 },
  "/api/v1/weibo/web/fetch_search_articles": { "basePrice": 0.005 },
  "/api/v1/xiaohongshu/web/search_notes": { "basePrice": 0.005 },
  "/api/v1/wechat_mp/article_search": { "basePrice": 0.005 },
  "/api/v1/zhihu/web/search": { "basePrice": 0.005 }
}
```

注意路径按 Task 1.1 探测结果调整。

- [ ] **Step 2：http-client.ts 写完整封装**

```ts
import { tikhubRateLimiter } from "./rate-limiter";
import pricingJson from "./pricing.json";

const TIKHUB_BASE_URL = process.env.TIKHUB_API_BASE_URL ?? "https://api.tikhub.io";

interface FetchOptions {
  endpoint: string;
  params?: Record<string, string | number | boolean | undefined>;
  retryOn5xx?: boolean;
}

export interface TikhubFetchResult<T = unknown> {
  data: T;
  costUsd: number;
  endpoint: string;
}

export async function tikhubFetch<T = unknown>(opts: FetchOptions): Promise<TikhubFetchResult<T>> {
  const apiKey = process.env.TIKHUB_API_KEY;
  if (!apiKey) throw new Error("TIKHUB_API_KEY not set in env");

  const url = new URL(opts.endpoint, TIKHUB_BASE_URL);
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  await tikhubRateLimiter.acquire();
  const cost = (pricingJson as Record<string, { basePrice: number }>)[opts.endpoint]?.basePrice ?? 0.005;

  const fetchOnce = () => fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  let response = await fetchOnce();

  if (response.status === 429) {
    await new Promise((r) => setTimeout(r, 5 * 60 * 1000));  // 5 min backoff
    response = await fetchOnce();
  }

  if (response.status >= 500 && opts.retryOn5xx !== false) {
    await new Promise((r) => setTimeout(r, 5000));  // 5s backoff
    response = await fetchOnce();
  }

  if (!response.ok) {
    throw new Error(`tikhub ${opts.endpoint} returned ${response.status}: ${await response.text().catch(() => "")}`);
  }

  const data = await response.json() as T;
  return { data, costUsd: cost, endpoint: opts.endpoint };
}
```

- [ ] **Step 3：budget.ts**

```ts
import type { TikhubConfig } from "./config";
import pricingJson from "./pricing.json";

const PRICING = pricingJson as Record<string, { basePrice: number }>;

export function estimateCost(config: TikhubConfig, endpoint: string): number {
  const pricePerCall = PRICING[endpoint]?.basePrice ?? 0.005;
  return config.keywords.length * config.maxPagesPerRun * pricePerCall;
}

export interface BudgetCheckResult {
  ok: boolean;
  reason?: "monthly_budget_exceeded";
  warnAt80Percent?: boolean;
  newAccumulated: number;
}

export function checkBudget(currentAccumulated: number, addCost: number, monthlyBudget: number): BudgetCheckResult {
  const newAccumulated = currentAccumulated + addCost;
  if (newAccumulated > monthlyBudget) {
    return { ok: false, reason: "monthly_budget_exceeded", newAccumulated };
  }
  const warnAt80Percent = currentAccumulated < monthlyBudget * 0.8 && newAccumulated >= monthlyBudget * 0.8;
  return { ok: true, warnAt80Percent, newAccumulated };
}
```

- [ ] **Step 4：扩展 AdapterResult + writer 写 runMetadata**

修改 `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/types.ts:42-45`，给 `AdapterResult` 加可选 `runMetadata` 字段：

```ts
export interface AdapterResult {
  items: RawItem[];
  partialFailures?: { message: string; meta?: Record<string, unknown> }[];
  runMetadata?: Record<string, unknown>;  // ← 新增：让 adapter 把额外指标（如 tikhubCostUsd）回报给 writer
}
```

修改 `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/writer.ts`：找到 `writeItems` 写入 `collection_runs.metadata` 的位置（如无则在 run insert/update 处加），把 `result.runMetadata` 合并到 metadata。模式：

```ts
// 在 writer 接收 AdapterResult 后：
const runMetadata: Record<string, unknown> = {
  ...(args.runMetadataExtra ?? {}),
  ...(args.adapterResult.runMetadata ?? {}),
};
// runMetadata 写入 collection_runs.metadata jsonb 字段
```

实际改动按现有 writer 结构调整。原则：runMetadata 是 optional，旧 adapter（5 个现有）不返回此字段时不影响行为。

- [ ] **Step 5：tsc 通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

预期：零错（现有 5 adapter 不受影响 — runMetadata 是 optional）。

---

### Task 1.6：Phase 1 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add src/lib/collection/adapters/tikhub/ && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a2): tikhub Adapter 基础设施 — config / rate-limiter (8 RPS) / time-parser / http-client / budget / pricing 占位

- configSchema 5 platform + keyword search + halfYear timeWindow + budget 字段
- TokenBucket 进程级单例 + 11/11 单测覆盖（V1 单 worker 假设）
- parseWeiboTime + parseTimestampMs/Sec + 11/11 单测
- http-client 封装 (auth / rate limiter / 5xx 重试 / 429 5min backoff)
- budget 估算 + 80% warn / 100% exceeded 检查
- pricing.json 占位（Day 6 实测填）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2：P0 平台抖音 + 微博（Day 2，约 1 天）

### Task 2.1：抖音 platform mapper + fixture + 单测

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/platforms/douyin.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/__fixtures__/douyin-search.json`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/__tests__/platforms-douyin.test.ts`

- [ ] **Step 1：抓一份真实响应 fixture**

```bash
export TIKHUB_API_KEY=$(grep "^TIKHUB_API_KEY=" /Users/zhuyu/dev/chinamcloud/vibetide/.env.local | cut -d= -f2-)
curl -sS -H "Authorization: Bearer $TIKHUB_API_KEY" \
  "https://api.tikhub.io/api/v1/douyin/web/fetch_general_search_result?keyword=%E9%95%BF%E6%B1%9F%E7%94%9F%E6%80%81&offset=0&count=10" \
  > /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/__fixtures__/douyin-search.json
```

注：URL 编码"长江生态"。如真实 endpoint 路径不同（Task 1.1 探测结果），用对的路径。

**脱敏**：检查 fixture 是否含 access_token / 私有信息（默认不会，因为 API 只返回公开数据）。如有，手工删除。

- [ ] **Step 2：写测试**

```ts
import { describe, expect, it } from "vitest";
import { mapDouyinResponse } from "../platforms/douyin";
import fixture from "../__fixtures__/douyin-search.json";

describe("mapDouyinResponse", () => {
  const items = mapDouyinResponse(fixture);

  it("返回 RawItem 数组（应有 ≥ 5 条）", () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it("每个 item 都有 title + url + channel = tikhub_douyin", () => {
    for (const item of items) {
      expect(item.title).toBeTruthy();
      expect(item.url).toMatch(/^https?:\/\//);
      expect(item.channel).toBe("tikhub_douyin");
    }
  });

  it("contentType = short_video", () => {
    expect(items.every((i) => i.contentType === "short_video")).toBe(true);
  });

  it("attachments 含 video + thumbnail", () => {
    const first = items[0]!;
    expect(first.attachments?.length).toBeGreaterThanOrEqual(1);
    const kinds = first.attachments!.map((a) => a.kind);
    expect(kinds).toContain("video");
  });

  it("publishedAt 是 Date 实例", () => {
    expect(items[0]!.publishedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 3：跑测试预期失败 + 看 fixture 实际结构**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/collection/adapters/tikhub/__tests__/platforms-douyin.test.ts
# 模块 not found

# 看 fixture 真实结构再写 mapper
head -50 /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/__fixtures__/douyin-search.json | python3 -m json.tool 2>/dev/null | head -60
```

- [ ] **Step 4：根据真实 fixture 结构写 douyin.ts**

```ts
import type { RawItem } from "../../../types";
import { parseTimestampSec } from "../time-parser";

const ENDPOINT = "/api/v1/douyin/web/fetch_general_search_result";

export interface DouyinSearchResponse {
  data?: { data?: Array<DouyinItem> } | Array<DouyinItem>;
  // 实际响应结构按 fixture 调整
}

interface DouyinItem {
  aweme_info?: {
    aweme_id?: string;
    desc?: string;
    create_time?: number;
    share_url?: string;
    video?: {
      play_addr?: { url_list?: string[] };
      cover?: { url_list?: string[] };
      duration?: number;
      width?: number;
      height?: number;
    };
    statistics?: {
      digg_count?: number;
      comment_count?: number;
      share_count?: number;
    };
    author?: { nickname?: string; sec_uid?: string };
  };
}

export function mapDouyinResponse(response: DouyinSearchResponse): RawItem[] {
  const list = (Array.isArray(response.data) ? response.data : (response.data?.data ?? []));
  const items: RawItem[] = [];

  for (const entry of list) {
    const aweme = entry.aweme_info;
    if (!aweme || !aweme.aweme_id) continue;

    const videoUrl = aweme.video?.play_addr?.url_list?.[0];
    const thumbUrl = aweme.video?.cover?.url_list?.[0];

    items.push({
      title: aweme.desc || "(无标题)",
      url: aweme.share_url ?? `https://www.douyin.com/video/${aweme.aweme_id}`,
      summary: aweme.desc?.slice(0, 200),
      publishedAt: parseTimestampSec(aweme.create_time),
      channel: "tikhub_douyin",
      contentType: "short_video",
      attachments: [
        ...(videoUrl ? [{
          kind: "video" as const,
          url: videoUrl,
          durationMs: aweme.video?.duration,
          width: aweme.video?.width,
          height: aweme.video?.height,
        }] : []),
        ...(thumbUrl ? [{ kind: "thumbnail" as const, url: thumbUrl }] : []),
      ],
      rawMetadata: {
        platform: "douyin",
        aweme_id: aweme.aweme_id,
        likes: aweme.statistics?.digg_count,
        comments: aweme.statistics?.comment_count,
        shares: aweme.statistics?.share_count,
        author: aweme.author?.nickname,
        author_uid: aweme.author?.sec_uid,
      },
    });
  }

  return items;
}

export const DOUYIN_ENDPOINT = ENDPOINT;
```

注意：`response.data?.data` 这种路径按 fixture 实际结构调整。

- [ ] **Step 5：跑测试预期通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/collection/adapters/tikhub/__tests__/platforms-douyin.test.ts
# 期望：5/5 pass
```

如失败：根据 fixture 结构微调 DouyinItem 接口 + mapDouyinResponse。

---

### Task 2.2：微博 platform mapper + fixture + 单测

**Files:**
- Create: `platforms/weibo.ts` + `__fixtures__/weibo-search.json` + `__tests__/platforms-weibo.test.ts`

参考 Task 2.1 模式。重点：

- 抓 fixture：`curl ... weibo/web/fetch_search_articles?keyword=...`
- 写测试：≥ 3 条；channel = `tikhub_weibo`；attachments 视情况（图文 = []，视频 = video+thumbnail，图集 = N image）
- 写 mapper：用 `parseWeiboTime` 处理 `created_at`；`mblog.pic_urls.length > 1` 标 image_set；`mblog.page_info.type === "video"` 标 video

测试模板：

```ts
describe("mapWeiboResponse", () => {
  const items = mapWeiboResponse(fixture);
  it("返回 RawItem 数组", () => expect(items.length).toBeGreaterThanOrEqual(3));
  it("contentType 按内容类型正确分布", () => {
    const types = items.map((i) => i.contentType);
    // 至少有 image_text 或 image_set 或 video 之一
    expect(types.some((t) => ["image_text", "image_set", "video"].includes(t!))).toBe(true);
  });
  it("publishedAt parsed", () => expect(items[0]!.publishedAt).toBeInstanceOf(Date));
  it("channel = tikhub_weibo", () => items.forEach((i) => expect(i.channel).toBe("tikhub_weibo")));
});
```

mapper 框架：

```ts
import type { RawItem } from "../../../types";
import { parseWeiboTime } from "../time-parser";

const ENDPOINT = "/api/v1/weibo/web/fetch_search_articles";

interface WeiboItem {
  mblog?: {
    id?: string;
    text?: string;
    text_raw?: string;
    created_at?: string;
    pic_urls?: Array<{ url?: string; thumbnail_pic?: string }>;
    page_info?: { type?: string; media_info?: { mp4_hd_url?: string } };
    user?: { screen_name?: string; id?: string };
    reposts_count?: number;
    comments_count?: number;
    attitudes_count?: number;
  };
}

export function mapWeiboResponse(response: { data?: WeiboItem[] }): RawItem[] {
  const list = response.data ?? [];
  const items: RawItem[] = [];

  for (const entry of list) {
    const m = entry.mblog;
    if (!m || !m.id) continue;

    const isVideo = m.page_info?.type === "video";
    const pics = m.pic_urls ?? [];
    const isImageSet = pics.length > 1;
    const contentType = isVideo ? "video" : isImageSet ? "image_set" : "image_text";

    const attachments = isVideo
      ? [{ kind: "video" as const, url: m.page_info?.media_info?.mp4_hd_url ?? "" }].filter((a) => a.url)
      : pics.map((p) => ({ kind: "image" as const, url: p.url ?? p.thumbnail_pic ?? "" })).filter((a) => a.url);

    items.push({
      title: (m.text_raw || m.text || "").slice(0, 100) || "(无标题)",
      url: `https://weibo.com/${m.user?.id}/${m.id}`,
      summary: (m.text_raw || m.text)?.slice(0, 200),
      publishedAt: m.created_at ? parseWeiboTime(m.created_at) : undefined,
      channel: "tikhub_weibo",
      contentType,
      attachments,
      rawMetadata: {
        platform: "weibo",
        mblog_id: m.id,
        author: m.user?.screen_name,
        likes: m.attitudes_count,
        comments: m.comments_count,
        reposts: m.reposts_count,
      },
    });
  }
  return items;
}

export const WEIBO_ENDPOINT = ENDPOINT;
```

- [ ] Step 1: 抓 fixture
- [ ] Step 2: 写测试
- [ ] Step 3: 跑测试预期失败
- [ ] Step 4: 写 mapper
- [ ] Step 5: 跑测试预期通过

---

### Task 2.3：Phase 2 tsc + 测试集子集回归

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
npx tsc --noEmit && \
npx vitest run src/lib/collection/adapters/tikhub/__tests__/
# 期望：tsc 0 错 + Phase 1+2 全部测试 pass
```

不 commit（Phase 2-4 都是平台 mapper，集中到 Phase 4 末尾一起 commit）。

---

## Phase 3：P0 平台小红书 + attachment-mapper（Day 3，约 1 天）

### Task 3.1：attachment-mapper 提取（如有重复逻辑）

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/attachment-mapper.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/__tests__/attachment-mapper.test.ts`

如 Task 2.1 / 2.2 写 mapper 时发现 attachment 构造逻辑可以复用（如"视频 + thumbnail" / "图集"模式），抽 helper。

否则 skip Task 3.1 直接进 Task 3.2（小红书）。

参考 helper 框架：

```ts
export function buildVideoAttachments(videoUrl: string | undefined, thumbUrl: string | undefined, opts?: {
  durationMs?: number; width?: number; height?: number;
}) { /* ... */ }

export function buildImageSetAttachments(urls: string[]) { /* ... */ }
```

如抽出，Task 2.1 / 2.2 mapper 用 helper 重写并跑回归。

---

### Task 3.2：小红书 platform mapper + fixture + 单测

**Files:**
- Create: `platforms/xiaohongshu.ts` + `__fixtures__/xiaohongshu-search.json` + `__tests__/platforms-xiaohongshu.test.ts`

抓 fixture（注意 noteTime 参数取"半年内"）：

```bash
export TIKHUB_API_KEY=$(grep "^TIKHUB_API_KEY=" /Users/zhuyu/dev/chinamcloud/vibetide/.env.local | cut -d= -f2-)
curl -sS -H "Authorization: Bearer $TIKHUB_API_KEY" \
  "https://api.tikhub.io/api/v1/xiaohongshu/web/search_notes?keyword=%E9%95%BF%E6%B1%9F%E7%94%9F%E6%80%81&page=1&sort=general&noteType=_0&noteTime=%E5%8D%8A%E5%B9%B4%E5%86%85" \
  > /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/__fixtures__/xiaohongshu-search.json
```

写测试 + mapper（按 fixture 实际结构）：

```ts
import type { RawItem } from "../../../types";
import { parseTimestampMs } from "../time-parser";

const ENDPOINT = "/api/v1/xiaohongshu/web/search_notes";

interface XhsNote {
  id?: string;
  display_title?: string;
  desc?: string;
  type?: number | string;  // 1 video, 2 normal/image
  time?: number;
  create_time?: number;
  user?: { nickname?: string; user_id?: string };
  image_list?: Array<{ url?: string; trace_id?: string }>;
  video_info?: { master_url?: string; cover_url?: string; duration_ms?: number };
  interact_info?: { liked_count?: string; collected_count?: string; comment_count?: string };
}

export function mapXiaohongshuResponse(response: { data?: XhsNote[] }): RawItem[] {
  const list = response.data ?? [];
  const items: RawItem[] = [];

  for (const note of list) {
    if (!note.id) continue;

    const isVideo = String(note.type) === "1" || !!note.video_info?.master_url;
    const images = note.image_list ?? [];

    let contentType: "video" | "image_set";
    let attachments: RawItem["attachments"];

    if (isVideo) {
      contentType = "video";
      attachments = [
        ...(note.video_info?.master_url ? [{
          kind: "video" as const,
          url: note.video_info.master_url,
          durationMs: note.video_info?.duration_ms,
        }] : []),
        ...(note.video_info?.cover_url ? [{ kind: "thumbnail" as const, url: note.video_info.cover_url }] : []),
      ];
    } else {
      contentType = "image_set";
      attachments = images
        .filter((img) => img.url)
        .map((img) => ({ kind: "image" as const, url: img.url! }));
    }

    items.push({
      title: note.display_title || (note.desc ?? "").slice(0, 50) || "(无标题)",
      url: `https://www.xiaohongshu.com/explore/${note.id}`,
      summary: note.desc?.slice(0, 200),
      publishedAt: parseTimestampMs(note.time ?? (note.create_time ? note.create_time * 1000 : undefined)),
      channel: "tikhub_xiaohongshu",
      contentType,
      attachments,
      rawMetadata: {
        platform: "xiaohongshu",
        note_id: note.id,
        author: note.user?.nickname,
        likes: note.interact_info?.liked_count,
        comments: note.interact_info?.comment_count,
        collects: note.interact_info?.collected_count,
      },
    });
  }
  return items;
}

export const XHS_ENDPOINT = ENDPOINT;
```

测试 5 case 同 douyin 风格（数量 ≥ 3 / channel / contentType / attachments / publishedAt）。

- [ ] Step 1-5 同 Task 2.1

---

## Phase 4：P1 平台 + 主 adapter（Day 4，约 1.5 天）

### Task 4.1：微信公众号 mapper + fixture + 单测

参考 Task 2.1 模式。

- 抓 fixture：`wechat_mp/article_search?keyword=...`
- mapper：`contentType = image_text`，`attachments = []`（封面图存 rawMetadata.cover_url）
- 测试：channel = `tikhub_wechat_mp`，publishedAt parsed

mapper 框架：

```ts
const ENDPOINT = "/api/v1/wechat_mp/article_search";

interface WechatArticle {
  id?: string;
  title?: string;
  content?: string;
  publish_time?: number | string;
  cover_url?: string;
  author?: string;
  url?: string;
  account_name?: string;
}

export function mapWechatMpResponse(response: { data?: WechatArticle[] }): RawItem[] {
  const list = response.data ?? [];
  return list
    .filter((a) => a.id && a.title)
    .map((a) => ({
      title: a.title!,
      url: a.url ?? "",
      summary: (a.content ?? "").slice(0, 200),
      publishedAt: typeof a.publish_time === "number"
        ? parseTimestampSec(a.publish_time)
        : a.publish_time ? new Date(a.publish_time) : undefined,
      channel: "tikhub_wechat_mp",
      contentType: "image_text" as const,
      attachments: [],
      rawMetadata: {
        platform: "wechat_mp",
        article_id: a.id,
        cover_url: a.cover_url,
        author: a.author,
        publicAccountName: a.account_name,  // ← 让 outlet recognizer 通过 publicAccountNames 命中字典！
      },
    }));
}

export const WECHAT_MP_ENDPOINT = ENDPOINT;
```

注意：`rawMetadata.publicAccountName` 字段对 A1 的 outlet recognizer 至关重要 — 让"涪陵生态环境"等公众号文章能被识别为 government_self_media tier。

---

### Task 4.2：知乎 mapper + fixture + 单测

参考同样模式。`contentType = image_text`，`attachments = []`，channel = `tikhub_zhihu`。

```ts
const ENDPOINT = "/api/v1/zhihu/web/search";

interface ZhihuItem {
  id?: string;
  type?: string;  // answer / article / question
  title?: string;
  excerpt?: string;
  content?: string;
  url?: string;
  created_time?: number;
  updated_time?: number;
  author?: { name?: string; id?: string };
  voteup_count?: number;
  comment_count?: number;
}

export function mapZhihuResponse(response: { data?: ZhihuItem[] }): RawItem[] {
  return (response.data ?? [])
    .filter((i) => i.id && i.title)
    .map((i) => ({
      title: i.title!,
      url: i.url ?? `https://www.zhihu.com/${i.type}/${i.id}`,
      summary: (i.excerpt ?? i.content ?? "").slice(0, 200),
      publishedAt: parseTimestampSec(i.created_time ?? i.updated_time),
      channel: "tikhub_zhihu",
      contentType: "image_text" as const,
      attachments: [],
      rawMetadata: {
        platform: "zhihu",
        item_id: i.id,
        item_type: i.type,
        author: i.author?.name,
        upvotes: i.voteup_count,
        comments: i.comment_count,
      },
    }));
}

export const ZHIHU_ENDPOINT = ENDPOINT;
```

---

### Task 4.3：主 adapter execute

**File:** Create `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/index.ts`

```ts
import type { SourceAdapter, RawItem } from "../../types";
import { tikhubConfigSchema, type TikhubConfig, type TikhubPlatform } from "./config";
import { tikhubConfigFields } from "./config-fields";
import { tikhubFetch } from "./http-client";
import { estimateCost, checkBudget } from "./budget";

import { mapDouyinResponse, DOUYIN_ENDPOINT } from "./platforms/douyin";
import { mapWeiboResponse, WEIBO_ENDPOINT } from "./platforms/weibo";
import { mapXiaohongshuResponse, XHS_ENDPOINT } from "./platforms/xiaohongshu";
import { mapWechatMpResponse, WECHAT_MP_ENDPOINT } from "./platforms/wechat-mp";
import { mapZhihuResponse, ZHIHU_ENDPOINT } from "./platforms/zhihu";

const PLATFORM_ENDPOINTS: Record<TikhubPlatform, string> = {
  douyin: DOUYIN_ENDPOINT,
  weibo: WEIBO_ENDPOINT,
  xiaohongshu: XHS_ENDPOINT,
  wechat_mp: WECHAT_MP_ENDPOINT,
  zhihu: ZHIHU_ENDPOINT,
};

const PLATFORM_MAPPERS: Record<TikhubPlatform, (resp: unknown) => RawItem[]> = {
  douyin: mapDouyinResponse as never,
  weibo: mapWeiboResponse as never,
  xiaohongshu: mapXiaohongshuResponse as never,
  wechat_mp: mapWechatMpResponse as never,
  zhihu: mapZhihuResponse as never,
};

function buildPageParams(config: TikhubConfig, keyword: string, pageIndex: number): Record<string, string | number> {
  const base: Record<string, string | number> = {
    keyword,
    page: pageIndex + 1,
  };
  switch (config.platform) {
    case "douyin":
      return { keyword, offset: pageIndex * config.resultsPerPage, count: config.resultsPerPage };
    case "xiaohongshu":
      return {
        ...base,
        sort: "general",
        noteType: "_0",
        noteTime: { day: "一天内", week: "一周内", halfYear: "半年内", all: "" }[config.timeWindow] ?? "半年内",
      };
    default:
      return base;
  }
}

export const tikhubAdapter: SourceAdapter<TikhubConfig> = {
  type: "tikhub",
  displayName: "tikhub.io 社媒搜索",
  description: "对接 tikhub.io 抓取抖音/微博/小红书/微信公众号/知乎 关键词搜索（半年内）",
  category: "search",
  configSchema: tikhubConfigSchema,
  configFields: tikhubConfigFields,

  async execute({ config, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];
    let totalCost = 0;

    const endpoint = PLATFORM_ENDPOINTS[config.platform];
    const mapper = PLATFORM_MAPPERS[config.platform];

    // 预算硬阈值（按 estimate 提前检查）
    const estimated = estimateCost(config, endpoint);
    log("info", `tikhub estimated cost: $${estimated.toFixed(4)} for ${config.keywords.length} keywords × ${config.maxPagesPerRun} pages`);
    if (estimated > config.monthlyBudgetUsd) {
      throw new Error(`estimated cost ($${estimated.toFixed(2)}) exceeds monthly budget ($${config.monthlyBudgetUsd})`);
    }

    for (const keyword of config.keywords) {
      for (let p = 0; p < config.maxPagesPerRun; p++) {
        try {
          const params = buildPageParams(config, keyword, p);
          const result = await tikhubFetch({ endpoint, params });
          totalCost += result.costUsd;
          const mapped = mapper(result.data);
          items.push(...mapped);

          log("info", `tikhub ${config.platform} keyword="${keyword}" page=${p + 1} → ${mapped.length} items`);

          // 早停：当本页结果 < resultsPerPage 时（说明已抓完）
          if (mapped.length < config.resultsPerPage * 0.5) break;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          partialFailures.push({ message, meta: { keyword, page: p + 1 } });
          log("error", `tikhub ${config.platform} keyword="${keyword}" page=${p + 1} failed: ${message}`);
          break;  // 同一关键词当前页失败，跳过余下页
        }
      }
    }

    log("info", `tikhub run complete. items: ${items.length}, totalCost: $${totalCost.toFixed(4)}`);

    // 累加到 source.config.tikhubMonthlyAccumulatedUsd（adapter 自治预算）
    if (totalCost > 0 && organizationId && sourceId) {
      await db.update(collectionSources).set({
        config: sql`config || jsonb_build_object('tikhubMonthlyAccumulatedUsd', COALESCE((config->>'tikhubMonthlyAccumulatedUsd')::numeric, 0) + ${totalCost})`,
        updatedAt: new Date(),
      }).where(and(eq(collectionSources.id, sourceId), eq(collectionSources.organizationId, organizationId)));

      // 检查累计是否超阈值，超 100% 则 disable source
      const [updated] = await db.select().from(collectionSources)
        .where(eq(collectionSources.id, sourceId)).limit(1);
      const accumulated = Number((updated?.config as { tikhubMonthlyAccumulatedUsd?: number })?.tikhubMonthlyAccumulatedUsd ?? 0);
      if (accumulated >= config.monthlyBudgetUsd) {
        await db.update(collectionSources).set({
          enabled: false,
          config: sql`config || jsonb_build_object('disabled_reason', 'monthly_budget_exceeded')`,
        }).where(eq(collectionSources.id, sourceId));
        log("warn", `tikhub source ${sourceId} auto-disabled: accumulated $${accumulated.toFixed(4)} >= budget $${config.monthlyBudgetUsd}`);
      } else if (accumulated >= config.monthlyBudgetUsd * 0.8) {
        log("warn", `tikhub source ${sourceId} reached 80% budget: $${accumulated.toFixed(4)} / $${config.monthlyBudgetUsd}`);
      }
    }

    return {
      items,
      partialFailures,
      runMetadata: { tikhubCostUsd: totalCost, tikhubPlatform: config.platform },
    };
  },
};
```

注：`organizationId / sourceId` 通过 `AdapterContext` 传入（execute 第一参数解构）。需要 import `db` / `collectionSources` / `eq` / `and` / `sql`。

- [ ] **Step 1：写测试**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { tikhubAdapter } from "..";
import * as httpClient from "../http-client";

vi.mock("../http-client");

describe("tikhubAdapter.execute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("douyin: 多关键词多页，正确累计 cost + items", async () => {
    const mockFetch = vi.spyOn(httpClient, "tikhubFetch").mockResolvedValue({
      data: { data: [] }, costUsd: 0.005, endpoint: "/api/v1/douyin/web/fetch_general_search_result"
    });
    const result = await tikhubAdapter.execute({
      config: {
        platform: "douyin", searchType: "keyword", keywords: ["a", "b"], timeWindow: "halfYear",
        maxPagesPerRun: 2, resultsPerPage: 20, monthlyBudgetUsd: 1,
      },
      log: vi.fn(),
      runId: "test", sourceId: "test", organizationId: "test",
    } as any);
    // 早停：每页返回 0 < 20 * 0.5，第 1 页就停 → 调用 = 关键词数 = 2
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("超预算抛错", async () => {
    await expect(tikhubAdapter.execute({
      config: {
        platform: "douyin", searchType: "keyword", keywords: Array(20).fill("a"),
        timeWindow: "halfYear", maxPagesPerRun: 10, resultsPerPage: 20, monthlyBudgetUsd: 0.1,
      },
      log: vi.fn(),
    } as any)).rejects.toThrow(/exceeds monthly budget/);
  });
});
```

- [ ] **Step 2：跑测试预期失败**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/collection/adapters/tikhub/__tests__/
```

- [ ] **Step 3：实现 + 跑测试预期通过**

如有 RawItem 接口字段不匹配（runMetadata 不存在）→ 改为通过 RunResult 的别的字段返回，或者忽略此字段。

---

### Task 4.4：注册 adapter

**File:** Modify `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/index.ts`

```ts
// 现有 5 个 adapter import + register
import { tikhubAdapter } from "./tikhub";
registerAdapter(tikhubAdapter);

export { tikhubAdapter };
```

- [ ] tsc 通过 + 全套 tikhub 测试 pass

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit && \
npx vitest run src/lib/collection/adapters/tikhub/
```

---

### Task 4.5：Phase 2-4 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add src/lib/collection/adapters/tikhub/ src/lib/collection/adapters/index.ts && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a2): tikhub Adapter 5 平台 mapper + 主 adapter execute + 注册

- 抖音 / 微博 / 小红书 / 微信公众号 / 知乎 平台 mapper 各自完整测试通过
- 5 个 fixture 真实抓取保留（脱敏后）
- 主 adapter execute：按 platform 路由 + 早停 + 关键词跨页错误隔离 + 预算硬阈值
- 注册到 Collection Hub registry（第 6 个 adapter）

tsc 0 错 / Phase 1-4 全套测试 pass

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5：UI + 集成测试 + Inngest cron（Day 5，约 1 天）

### Task 5.1：sources/new 向导加 tikhub Adapter 选项

**File:** Modify `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/sources/new/new-source-wizard-client.tsx`

向导现有 5 个 Adapter 选项；加第 6 个：

- [ ] **Step 1：read 现有向导**

```bash
grep -n "adapter\|tavily\|tophub\|configFields" /Users/zhuyu/dev/chinamcloud/vibetide/src/app/\(dashboard\)/data-collection/sources/new/new-source-wizard-client.tsx | head -30
```

- [ ] **Step 2：找到 Adapter 选项数组，加 tikhub**

向导里通常是从 `listAdapters()` 渲染，所以注册了就自动出现。但如果是硬编码列表，加：

```tsx
{ value: "tikhub", label: "tikhub.io 社媒搜索", description: "抖音/微博/小红书/微信/知乎 关键词搜索" }
```

- [ ] **Step 3：configFields 渲染**

如果向导按 `getAdapter(type).configFields` 渲染，自动可用。否则确认 platform 下拉 + keywords 多输入 + timeWindow 等都正常显示。

- [ ] **Step 4：浏览器手动**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run dev &
# 浏览器 /data-collection/sources/new
# 选 tikhub adapter → platform 下拉显示 5 个 → 字段渲染正常
```

---

### Task 5.2：监控面板 tikhub 月度费用卡片

**File:** Modify `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/monitoring/monitoring-client.tsx`

- [ ] **Step 1：read 现有监控页结构**

```bash
head -150 /Users/zhuyu/dev/chinamcloud/vibetide/src/app/\(dashboard\)/data-collection/monitoring/monitoring-client.tsx
```

- [ ] **Step 2：写 server query**

在 page.tsx（server component）加：

```ts
import { sql } from "drizzle-orm";

const tikhubCostQuery = await db.execute(sql`
  SELECT 
    SUM((metadata->>'tikhubCostUsd')::numeric) AS total_cost_usd,
    COUNT(*) AS run_count
  FROM collection_runs cr
  JOIN collection_sources cs ON cr.source_id = cs.id
  WHERE cs.organization_id = ${orgId}
    AND cs.source_type = 'tikhub'
    AND cr.started_at >= date_trunc('month', now())
`);
```

- [ ] **Step 3：在 monitoring-client.tsx 加卡片**

```tsx
<Card>
  <CardHeader>
    <CardTitle>tikhub 月度费用</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-medium">${tikhubCost.totalCostUsd.toFixed(2)}</div>
    <div className="text-xs text-muted-foreground">本月共 {tikhubCost.runCount} 次抓取</div>
  </CardContent>
</Card>
```

按现有监控页 Card 样式适配。

- [ ] **Step 4：tsc + 浏览器手动**

---

### Task 5.3：writer.test.ts 集成测试加 tikhub case

**File:** Modify `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/__tests__/writer.test.ts`

**Step 1：探查现有 writer.test.ts setup**

```bash
head -120 /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/__tests__/writer.test.ts
```

记录现有命名 — writer 函数是 `writeItems(args: WriteArgs)`（不是 `writeCollectedItem`），WriteArgs 含 `runId / sourceId / organizationId / items: RawItem[] / source`，runId 通过 `makeRun(orgId, sourceId)` 创建。

**Step 2：append 集成测试 describe 块**（按真实接口适配）

```ts
describe("writer + tikhub adapter 集成", () => {
  let outletId: string;

  beforeAll(async () => {
    // 灌一条字典 outlet 让 recognizer 命中
    const [o] = await db.insert(mediaOutletDictionary).values({
      organizationId: orgId,  // 复用 setup 的 orgId
      outletName: "TEST_重庆生态环境",
      outletTier: "government_self_media",
      outletRegion: "重庆",
      publicAccountNames: ["TEST_重庆生态环境"],
    }).returning();
    outletId = o!.id;
    await bumpDictionaryVersion(orgId);
  });

  it("微信公众号文章入库后 outlet 自动识别", async () => {
    const runId = await makeRun();  // 现有 helper
    const result = await writeItems({
      runId, sourceId, organizationId: orgId,
      source: { id: sourceId, organizationId: orgId, sourceType: "tikhub", outletId: null,
                defaultOutletTier: null, defaultOutletRegion: null } as any,
      items: [{
        title: "test wechat 1",
        url: "https://mp.weixin.qq.com/s/test1",
        channel: "tikhub_wechat_mp",
        contentType: "image_text",
        attachments: [],
        contentFingerprint: "fp-tikhub-1",
        rawMetadata: { platform: "wechat_mp", publicAccountName: "TEST_重庆生态环境" },
      }],
    });
    expect(result.itemsInserted).toBeGreaterThanOrEqual(1);

    const [row] = await db.select().from(collectedItems)
      .where(eq(collectedItems.contentFingerprint, "fp-tikhub-1")).limit(1);
    expect(row?.outletTier).toBe("government_self_media");
    expect(row?.contentType).toBe("image_text");
  });

  it("抖音视频入库带 attachments", async () => {
    const runId = await makeRun();
    await writeItems({
      runId, sourceId, organizationId: orgId,
      source: { id: sourceId, organizationId: orgId, sourceType: "tikhub", outletId: null,
                defaultOutletTier: null, defaultOutletRegion: null } as any,
      items: [{
        title: "test douyin",
        url: "https://www.douyin.com/video/test123",
        channel: "tikhub_douyin",
        contentType: "short_video",
        attachments: [
          { kind: "video", url: "https://example.com/v.mp4", durationMs: 30000 },
          { kind: "thumbnail", url: "https://example.com/t.jpg" },
        ],
        contentFingerprint: "fp-tikhub-2",
        rawMetadata: { platform: "douyin" },
      }],
    });

    const [row] = await db.select().from(collectedItems)
      .where(eq(collectedItems.contentFingerprint, "fp-tikhub-2")).limit(1);
    expect(row?.contentType).toBe("short_video");
    expect((row?.attachments as unknown[])?.length).toBe(2);
  });
});
```

注意：`makeRun()` / `sourceId` / `orgId` 都是现有 setup 已经提供的变量，按实际 writer.test.ts 内的命名调整。`writeItems` 的 source 参数实际类型按现有签名 import。

- [ ] tsc + 测试通过

---

### Task 5.4：Inngest 月初累计重置 cron

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/collection/tikhub-budget-reset.ts`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/index.ts`

```ts
// tikhub-budget-reset.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectionSources } from "@/db/schema/collection";
import { eq, sql } from "drizzle-orm";

export const tikhubBudgetReset = inngest.createFunction(
  { id: "collection-tikhub-budget-reset" },
  { cron: "0 0 1 * *" },  // 每月 1 号 00:00 UTC
  async ({ step }) => {
    const result = await step.run("reset-accumulated", async () => {
      // 把所有 source_type=tikhub 的 source.config.tikhubMonthlyAccumulatedUsd = 0
      return await db.execute(sql`
        UPDATE collection_sources
        SET config = jsonb_set(config, '{tikhubMonthlyAccumulatedUsd}', '0'::jsonb),
            updated_at = NOW()
        WHERE source_type = 'tikhub'
          AND enabled = true
        RETURNING id
      `);
    });

    return { resetCount: (result as { rowCount?: number }).rowCount ?? 0 };
  },
);
```

注：如有因 `monthly_budget_exceeded` 被 disabled 的 source，cron 也应该重新 enable 它们。增加：

```ts
// 同时重新 enable 上月被 budget exceeded disabled 的 source
await db.execute(sql`
  UPDATE collection_sources
  SET enabled = true, config = jsonb_set(config, '{disabled_reason}', 'null'::jsonb)
  WHERE source_type = 'tikhub'
    AND enabled = false
    AND config->>'disabled_reason' = 'monthly_budget_exceeded'
`);
```

**注册到 inngest functions 数组**（精确步骤）：

```bash
grep -n "outletBatchRecognize\|^export const functions\|^];" /Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/index.ts
```

记录 `outletBatchRecognize` 的两处出现行号（import 区 + functions 数组）。在两处都加 `tikhubBudgetReset`：

```ts
// 顶部 import 区（在 outletBatchRecognize 同一行附近加）
import { tikhubBudgetReset } from "./collection/tikhub-budget-reset";

// functions 数组（在 outletBatchRecognize 同一行附近加，紧邻保持顺序）
export const functions = [
  // ... 现有 16 个函数
  outletBatchRecognize,
  tikhubBudgetReset,  // ← 新增
];
```

- [ ] tsc 通过

---

### Task 5.5：Phase 5 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add "src/app/(dashboard)/data-collection/sources/new/new-source-wizard-client.tsx" \
        "src/app/(dashboard)/data-collection/monitoring/" \
        "src/lib/collection/__tests__/writer.test.ts" \
        "src/inngest/functions/collection/tikhub-budget-reset.ts" \
        "src/inngest/functions/" && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a2): tikhub Adapter UI 集成 + writer 测试 + 月初累计 cron

- 新建源向导加 tikhub Adapter 选项（platform 下拉 5 选）
- 监控面板加"tikhub 月度费用"卡片（本月累计 + 抓取次数）
- writer.test.ts 加 2 集成 case（公众号入库 outlet 识别 + 抖音视频 attachments）
- Inngest cron 每月 1 号 00:00 UTC 重置累计 + 重启 budget_exceeded source

tsc 0 错 / 集成测试通过 / 浏览器 dev 验证向导/监控面板渲染

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6：calculate_price 实测 + fixture 校准 + final commit（Day 6，约 0.5 天）

### Task 6.1：calculate_price 实测

- [ ] **Step 1：跑 5 个 endpoint 实测**

```bash
export TIKHUB_API_KEY=$(grep "^TIKHUB_API_KEY=" /Users/zhuyu/dev/chinamcloud/vibetide/.env.local | cut -d= -f2-)
# CALC_URL 用 Task 1.1 Step 5 探测的真实路径
CALC_URL="https://api.tikhub.io/api/v1/tikhub/billing/calculate_price"  # 或正确路径

for ENDPOINT in \
  "/api/v1/douyin/web/fetch_general_search_result" \
  "/api/v1/weibo/web/fetch_search_articles" \
  "/api/v1/xiaohongshu/web/search_notes" \
  "/api/v1/wechat_mp/article_search" \
  "/api/v1/zhihu/web/search"; do
  echo "=== $ENDPOINT ==="
  curl -sS -H "Authorization: Bearer $TIKHUB_API_KEY" \
    "$CALC_URL?endpoint=$ENDPOINT&request_per_day=100"
  echo ""
done
```

- [ ] **Step 2：解析输出，写入 pricing.json**

```json
{
  "/api/v1/douyin/web/fetch_general_search_result": { "basePrice": <实测值> },
  ...
}
```

- [ ] **Step 3：回归测试**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/collection/adapters/tikhub/
# 期望：全部 pass（pricing.json 改了不影响测试，因为测试 mock 了 fetch）
```

---

### Task 6.2：真实 API 1 关键词调用 → fixture 校准

- [ ] **Step 1：5 平台各跑一次真实关键词搜索**

```bash
# 抖音
curl -sS -H "Authorization: Bearer $TIKHUB_API_KEY" \
  "https://api.tikhub.io/api/v1/douyin/web/fetch_general_search_result?keyword=test&offset=0&count=5" \
  > /tmp/douyin-real.json

# diff 与 fixture
diff <(python3 -c "import json; d=json.load(open('/tmp/douyin-real.json')); print(json.dumps(list(d.keys()), indent=2))") \
     <(python3 -c "import json; d=json.load(open('/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/adapters/tikhub/__fixtures__/douyin-search.json')); print(json.dumps(list(d.keys()), indent=2))")
```

如响应顶层 keys 一致，fixture 仍准确。如不同（比如 API 改了响应格式），更新 fixture + 重跑测试。

5 平台都跑一遍。

- [ ] **Step 2：对识别到的差异修 mapper / fixture / 测试**

如必要 → 更新 mapper → 重跑测试。

---

### Task 6.3：tsc + lint + build + 最终 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
npx tsc --noEmit && \
npm run lint 2>&1 | tail -5 && \
npm run build 2>&1 | tail -10 && \
npx vitest run src/lib/collection/adapters/tikhub/ src/lib/collection/__tests__/writer.test.ts 2>&1 | tail -10
```

期望：tsc 0 / lint pass / build pass / 测试 pass。

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add src/lib/collection/adapters/tikhub/pricing.json src/lib/collection/adapters/tikhub/__fixtures__/ && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a2): pricing.json 实测填充 + fixture 真实 API 校准 — A2 Wave 1 第二块完工

- calculate_price 实测 5 platform endpoint 单价
- 5 个 fixture 用真实抓取数据校准（响应结构对齐）
- tsc 0 错 / lint pass / build pass / Phase 1-6 全套测试通过

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 验收 Checklist 总表（A2 整体交付，对照 sub-spec §11）

### 功能

- [ ] tikhub adapter 注册成功（registry 第 6 type）
- [ ] sources/new 向导能新建 tikhub 源（5 platform 选）
- [ ] 5 平台 endpoint 抓取（fixture mock）通过
- [ ] 抓取入库后 collected_items.contentType / attachments / outletTier 字段正确
- [ ] outlet 自动识别（A1 recognizer）通过 publicAccountName 命中（如"重庆生态环境"匹配 government_self_media）
- [ ] 月度预算阈值生效：达 80% warn / 达 100% throw（拒绝 run）
- [ ] Inngest cron 每月 1 号重置累计

### 性能

- [ ] Rate Limiter 8 RPS 严格限速（实测调用 100 次耗时 ≥ 12.5 秒）
- [ ] 单 run 5 个平台并发不会撞 RPS 上限（无 429）

### 数据正确性

- [ ] tsc --noEmit 零错
- [ ] npm run build 通过
- [ ] A2 单测全过（rate-limiter / time-parser / 5 个平台 mapper / 主 adapter）
- [ ] writer.test.ts 集成 case 通过

### 真实 API 校准（Day 6）

- [ ] calculate_price 实测 5 endpoint → pricing.json 落地
- [ ] 真实 API 响应与 fixture 对齐（不齐则 fixture 升级）

---

## 备注

- 所有 commit 用 `--no-verify`（用户已授权本任务全程）
- 测试在 plan 内 step 单独跑，不依赖 pre-commit hook
- 文件路径全部用绝对路径
- 不开 feature branch，直接 commit 到 main（CLAUDE.md 单分支约定）
- API key 引用 `process.env.TIKHUB_API_KEY`，**不写到任何 spec / plan / 注释 / commit message / 测试代码**
- V1 Rate Limiter 是进程级单例（多 worker 部署需 V2 评估，详见 sub-spec §7.1）
- A2 完工后进入 A2.5 Excel 导入 Adapter sub-brainstorm
