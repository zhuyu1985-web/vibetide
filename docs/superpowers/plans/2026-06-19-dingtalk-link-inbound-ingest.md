# 钉钉机器人入站收链接存稿 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 钉钉群里 @企业内部应用机器人并发链接时，后台抓取网页正文、存为 `articles` 草稿，并用钉钉 `sessionWebhook` 把"已收录"回执推回群。

**Architecture:** 复用已有入站 webhook 管道。`handleInboundMessage` 在 `#命令` 之后、自由识别之前新增一条"检测链接 → 派 Inngest 事件 → 同步秒回 ⏳"分支；Inngest 函数 `channelLinkIngest` 用 `fetchViaJinaReader` 抓正文、按 `sourceUrl` 查重后 `db.insert(articles)` 存草稿，再 `postToSessionWebhook` 推回执。验签用新增的 `inboundSecret`（企业内部机器人 AppSecret）。

**Tech Stack:** Next.js 16 App Router、Drizzle ORM、Inngest 3.54、Vitest、AI SDK v6（不涉及）、`fetchViaJinaReader`（Jina Reader）。

**Spec:** `docs/superpowers/specs/2026-06-19-dingtalk-link-inbound-ingest-design.md`

---

## Preflight（开工前必读）

- **Node 22**：dev/构建用 node 22（node 24 会让 Turbopack 崩）。
- **本地库要起来才能提交**：`.husky/pre-commit` 跑 `npm test`（全量 vitest），其中 DB 集成测试连 `127.0.0.1:5433`。提交前确认本地库在跑，否则钩子失败。**禁止 `--no-verify`**——库没起就先起库（项目纪律）。
- **新增测试必须 DB-free**：本计划所有新测试都 `vi.mock("@/db")` / `vi.mock("@/lib/web-fetch")` / `vi.mock("@/inngest/client")`，不依赖真实库，任何环境都能过。
- **schema 迁移分环境**：本地 `127.0.0.1:5433` 改 schema 后直接 `npm run db:push`（journal 空）；生产走 `db:generate` → `db:migrate`。
- **设计系统硬规则**：UI 用 `<Input>`（`@/components/ui/input`），不要裸 `<input>`；可点击元素不带边框。

## File Structure

新建：
- `src/lib/channels/link-extract.ts` — `extractUrls(text)`，纯函数。
- `src/lib/channels/ingest-link-to-article.ts` — `ingestLinkToArticle()`，server-only，无 `requireAuth`，去重 + 抓取 + 直插。
- `src/lib/channels/session-webhook.ts` — `postToSessionWebhook()`，对 sessionWebhook 发一次钉钉消息。
- `src/inngest/functions/channel-link-ingest.ts` — Inngest 函数 `channelLinkIngest`。
- 测试：`src/lib/channels/__tests__/{link-extract,ingest-link-to-article,session-webhook}.test.ts`、`src/lib/channels/__tests__/gateway-link-branch.test.ts`、`src/inngest/functions/__tests__/channel-link-ingest.test.ts`。

修改：
- `src/db/schema/channels.ts`（加 `inbound_secret`）
- `src/db/schema/articles.ts`（扩 `metadata.$type`）
- `src/lib/dal/channels.ts`（`ChannelConfigRow` + mapper）
- `src/app/actions/channels.ts`（create/update 透传）
- `src/inngest/events.ts`（事件类型）
- `src/inngest/functions/index.ts`（注册函数）
- `src/lib/channels/gateway.ts`（`replyWebhook` 字段 + 链接分支）
- `src/app/api/channels/dingtalk/webhook/[configId]/route.ts`（`inboundSecret` 验签 + 透传 `sessionWebhook`）
- `src/app/(dashboard)/settings/channels/channels-client.tsx`（表单加栏）

---

## Task 1: Schema —— inbound_secret 字段 + articles.metadata 类型扩展

**Files:**
- Modify: `src/db/schema/channels.ts`
- Modify: `src/db/schema/articles.ts:99-107`

- [ ] **Step 1: 加 `inbound_secret` 列**

`src/db/schema/channels.ts` 在 `robotSecret` 行后加：

```ts
  robotSecret: text("robot_secret"),  // DingTalk robot sign secret（出站自定义机器人加签）
  inboundSecret: text("inbound_secret"), // DingTalk 企业内部机器人 AppSecret（入站回调验签）
```

- [ ] **Step 2: 扩 `articles.metadata` 的 `$type`**

`src/db/schema/articles.ts` 的 `metadata` `$type` 加可选字段：

```ts
  metadata: jsonb("metadata").$type<{
    sourceTopicId?: string;
    variantIndex?: number;
    language?: string;
    category?: string;
    culturalNotes?: string;
    workflowTaskId?: string;
    createdByWorkflow?: boolean;
    ingestedFromChannel?: {
      platform: string;
      configId: string;
      chatId: string;
      externalUserId: string;
      externalMessageId: string;
    };
  }>(),
```

- [ ] **Step 3: 推到本地库**

Run: `npm run db:push`
Expected: 提示新增 `channel_configs.inbound_secret` 列，确认应用成功。

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 0 errors。

- [ ] **Step 5: Commit**

```bash
git add src/db/schema/channels.ts src/db/schema/articles.ts
git commit -m "feat(channel): channel_configs 加 inbound_secret + articles.metadata 加 ingestedFromChannel 类型"
```

---

## Task 2: DAL + Server Actions 透传 inboundSecret

**Files:**
- Modify: `src/lib/dal/channels.ts:13-27`（类型）、`:66-79`（mapper）
- Modify: `src/app/actions/channels.ts:26-51`（create）、`:66-97`（update）

- [ ] **Step 1: `ChannelConfigRow` 加字段**

`src/lib/dal/channels.ts` 的 `ChannelConfigRow` 在 `robotSecret: string | null;` 后加：

```ts
  inboundSecret: string | null;
```

mapper（约 :77 附近，`robotSecret: r.robotSecret ?? null,` 后）加：

```ts
    inboundSecret: r.inboundSecret ?? null,
```

- [ ] **Step 2: `createChannelConfig` 透传**

`src/app/actions/channels.ts` 的 `createChannelConfig` input 加 `inboundSecret?: string;`，insert values（`robotSecret` 行后）加：

```ts
      inboundSecret: input.inboundSecret?.trim() || null,
```

- [ ] **Step 3: `updateChannelConfig` 透传**

`updateChannelConfig` 的 `updates` 类型加 `inboundSecret?: string | null;`，patch 逻辑（`robotSecret` 行后）加：

```ts
  if (updates.inboundSecret !== undefined) patch.inboundSecret = updates.inboundSecret?.trim() || null;
```

- [ ] **Step 4: 类型检查 + Commit**

Run: `npx tsc --noEmit` → 0 errors

```bash
git add src/lib/dal/channels.ts src/app/actions/channels.ts
git commit -m "feat(channel): DAL/actions 透传 inboundSecret"
```

---

## Task 3: link-extract.ts（纯函数，TDD）

**Files:**
- Create: `src/lib/channels/link-extract.ts`
- Test: `src/lib/channels/__tests__/link-extract.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/channels/__tests__/link-extract.test.ts
import { describe, it, expect } from "vitest";
import { extractUrls } from "../link-extract";

describe("extractUrls", () => {
  it("提取单个 http(s) 链接", () => {
    expect(extractUrls("看看这个 https://example.com/a 不错")).toEqual([
      "https://example.com/a",
    ]);
  });
  it("提取多个链接并去重", () => {
    expect(
      extractUrls("https://a.com/1 和 https://b.com/2 还有 https://a.com/1")
    ).toEqual(["https://a.com/1", "https://b.com/2"]);
  });
  it("无链接返回空数组", () => {
    expect(extractUrls("今天天气不错")).toEqual([]);
  });
  it("过滤钉钉自身域名", () => {
    expect(extractUrls("https://example.com/x https://open.dingtalk.com/y")).toEqual([
      "https://example.com/x",
    ]);
  });
  it("剥离末尾中文标点", () => {
    expect(extractUrls("链接：https://example.com/a。")).toEqual([
      "https://example.com/a",
    ]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/channels/__tests__/link-extract.test.ts`
Expected: FAIL（`extractUrls` 未定义）。

- [ ] **Step 3: 最小实现**

```ts
// src/lib/channels/link-extract.ts
const URL_RE = /https?:\/\/[^\s，。、；）)】""'']+/g;
const BLOCKED_HOSTS = ["dingtalk.com", "alidocs.dingtalk.com"];

/** 从一段文本里提取 http(s) 链接，去重并过滤钉钉自身域名。 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const url = raw.replace(/[.,;:!?）)】。，、；]+$/u, "");
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }
    if (BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`))) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/channels/__tests__/link-extract.test.ts`
Expected: PASS（5 passed）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/link-extract.ts src/lib/channels/__tests__/link-extract.test.ts
git commit -m "feat(channel): extractUrls 链接提取纯函数"
```

---

## Task 4: ingest-link-to-article.ts（去重 + 抓取 + 直插，TDD）

**Files:**
- Create: `src/lib/channels/ingest-link-to-article.ts`
- Test: `src/lib/channels/__tests__/ingest-link-to-article.test.ts`

- [ ] **Step 1: 写失败测试（mock db + web-fetch）**

```ts
// src/lib/channels/__tests__/ingest-link-to-article.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
const returning = vi.fn();
const values = vi.fn(() => ({ returning }));
const insert = vi.fn(() => ({ values }));
vi.mock("@/db", () => ({
  db: { query: { articles: { findFirst } }, insert },
}));
const fetchViaJinaReader = vi.fn();
vi.mock("@/lib/web-fetch", () => ({ fetchViaJinaReader }));

import { ingestLinkToArticle } from "../ingest-link-to-article";

const baseInput = {
  organizationId: "org1",
  url: "https://example.com/a",
  sourceName: "钉钉收稿·@u1",
  channelContext: {
    platform: "dingtalk",
    configId: "cfg1",
    chatId: "chat1",
    externalUserId: "u1",
    externalMessageId: "m1",
  },
};

beforeEach(() => {
  findFirst.mockReset();
  returning.mockReset();
  values.mockClear();
  insert.mockClear();
  fetchViaJinaReader.mockReset();
});

describe("ingestLinkToArticle", () => {
  it("已存在同 org+sourceUrl → 跳过，不抓取不插入", async () => {
    findFirst.mockResolvedValue({ id: "old1", title: "旧稿" });
    const r = await ingestLinkToArticle(baseInput);
    expect(r).toEqual({ skipped: true, articleId: "old1", title: "旧稿" });
    expect(fetchViaJinaReader).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("新链接 → 抓取并插入 draft，字段映射正确", async () => {
    findFirst.mockResolvedValue(undefined);
    fetchViaJinaReader.mockResolvedValue({ title: "标题", content: "正文内容" });
    returning.mockResolvedValue([{ id: "new1" }]);
    const r = await ingestLinkToArticle(baseInput);
    expect(r).toEqual({ skipped: false, articleId: "new1", title: "标题" });
    const inserted = values.mock.calls[0][0];
    expect(inserted).toMatchObject({
      organizationId: "org1",
      title: "标题",
      body: "正文内容",
      status: "draft",
      sourceType: "repost",
      sourceUrl: "https://example.com/a",
      sourceName: "钉钉收稿·@u1",
      createdBy: null,
    });
    expect(inserted.content).toEqual({ headline: "标题", body: "正文内容", imageNotes: [] });
    expect(inserted.metadata.ingestedFromChannel.configId).toBe("cfg1");
  });

  it("抓取标题为空 → 用域名兜底", async () => {
    findFirst.mockResolvedValue(undefined);
    fetchViaJinaReader.mockResolvedValue({ title: "  ", content: "x" });
    returning.mockResolvedValue([{ id: "new2" }]);
    const r = await ingestLinkToArticle(baseInput);
    expect(r.title).toBe("example.com");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/channels/__tests__/ingest-link-to-article.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

```ts
// src/lib/channels/ingest-link-to-article.ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { fetchViaJinaReader } from "@/lib/web-fetch";

export interface IngestLinkInput {
  organizationId: string;
  url: string;
  sourceName: string;
  channelContext: {
    platform: string;
    configId: string;
    chatId: string;
    externalUserId: string;
    externalMessageId: string;
  };
}

export interface IngestLinkResult {
  skipped: boolean;
  articleId?: string;
  title: string;
}

/**
 * 抓取链接正文并存为 articles 草稿。无 requireAuth —— 供 Inngest/webhook 上下文调用。
 * 按 (organizationId, sourceUrl) 查重，命中即跳过。
 */
export async function ingestLinkToArticle(
  input: IngestLinkInput
): Promise<IngestLinkResult> {
  const existing = await db.query.articles.findFirst({
    where: and(
      eq(articles.organizationId, input.organizationId),
      eq(articles.sourceUrl, input.url)
    ),
    columns: { id: true, title: true },
  });
  if (existing) {
    return { skipped: true, articleId: existing.id, title: existing.title };
  }

  const { title, content } = await fetchViaJinaReader(input.url);
  const safeTitle = title?.trim() || new URL(input.url).hostname;

  const [row] = await db
    .insert(articles)
    .values({
      organizationId: input.organizationId,
      title: safeTitle,
      body: content,
      content: { headline: safeTitle, body: content, imageNotes: [] },
      mediaType: "article",
      status: "draft",
      sourceType: "repost",
      sourceUrl: input.url,
      sourceName: input.sourceName,
      createdBy: null,
      wordCount: content.length,
      metadata: { ingestedFromChannel: input.channelContext },
    })
    .returning({ id: articles.id });

  return { skipped: false, articleId: row.id, title: safeTitle };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/channels/__tests__/ingest-link-to-article.test.ts`
Expected: PASS（3 passed）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/ingest-link-to-article.ts src/lib/channels/__tests__/ingest-link-to-article.test.ts
git commit -m "feat(channel): ingestLinkToArticle 抓取+去重+存草稿"
```

---

## Task 5: 抽出 format.ts + session-webhook.ts（钉钉会话回执，TDD）

> 为什么先抽 `format.ts`：`session-webhook` 要复用 `formatForPlatform`，但它现在长在 `gateway.ts` 里，而 `gateway.ts` 又 import 了 `@/app/actions/channels`（`"use server"` + `@/db`）和 `@/lib/agent/intent-recognition`（AI SDK）这些重模块。若 `session-webhook` 直接 import `gateway`，它的单测会被这条重依赖链拖累、易碎。把纯格式化函数抽到无依赖的 `format.ts`，`gateway` re-export 保持现有消费方（outbound.ts / dingtalk route）不变，`session-webhook` 只依赖 `format.ts`，测试干净隔离。

**Files:**
- Create: `src/lib/channels/format.ts`
- Modify: `src/lib/channels/gateway.ts:254-362`（移走 formatter，改 re-export）
- Create: `src/lib/channels/session-webhook.ts`
- Test: `src/lib/channels/__tests__/session-webhook.test.ts`

- [ ] **Step 1: 抽出 `format.ts`**

把 `gateway.ts` 的 `OutboundPayload` 类型 + `formatForPlatform` + `formatForDingTalk` + `formatForWechatWork`（:254-362 整段，含注释）原样移到新文件 `src/lib/channels/format.ts`，并把 `OutboundPayload` 与 `formatForPlatform` 改为 `export`：

```ts
// src/lib/channels/format.ts
// 平台消息体格式化（纯函数，无外部依赖）。从 gateway.ts 抽出，供 gateway / outbound / session-webhook 共用。

export type OutboundPayload = {
  type: "text" | "markdown" | "card";
  title?: string;
  content: string;
  actions?: { label: string; url: string }[];
};

export function formatForPlatform(
  platform: "dingtalk" | "wechat_work",
  payload: OutboundPayload
): unknown {
  if (platform === "dingtalk") return formatForDingTalk(payload);
  return formatForWechatWork(payload);
}

// ↓↓↓ formatForDingTalk / formatForWechatWork 函数体原样从 gateway.ts 搬过来 ↓↓↓
// （这两个内部函数保持 unexported，只被 formatForPlatform 调用，不要 export）
```

- [ ] **Step 2: gateway.ts 删除该段并 re-export**

`gateway.ts` 删掉 :254-362 那段（含 `OutboundPayload` 类型与三个函数），在文件顶部 import 区附近加一行 re-export（保持 outbound.ts / dingtalk route 现有 `import { formatForPlatform } from "@/lib/channels/gateway"` 不报错）：

```ts
export { formatForPlatform, type OutboundPayload } from "./format";
```

- [ ] **Step 3: 类型检查（确认 re-export 生效）**

Run: `npx tsc --noEmit`
Expected: 0 errors（outbound.ts:11、dingtalk route:7 的 `formatForPlatform` 仍从 gateway 解析得到）。

- [ ] **Step 4: 写 session-webhook 失败测试（mock fetch）**

```ts
// src/lib/channels/__tests__/session-webhook.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { postToSessionWebhook } from "../session-webhook";

beforeEach(() => vi.restoreAllMocks());

describe("postToSessionWebhook", () => {
  it("errcode=0 → ok:true，body 为钉钉 text 格式", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ errcode: 0 })));
    const r = await postToSessionWebhook("https://oapi/x", {
      type: "text",
      content: "✅ 已收录",
    });
    expect(r.ok).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ msgtype: "text", text: { content: "✅ 已收录" } });
  });

  it("errcode≠0 → ok:false 带 error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ errcode: 1, errmsg: "boom" }))
    );
    const r = await postToSessionWebhook("https://oapi/x", { type: "text", content: "x" });
    expect(r).toEqual({ ok: false, error: "boom" });
  });

  it("fetch 抛错 → ok:false 不冒泡", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("net"));
    const r = await postToSessionWebhook("https://oapi/x", { type: "text", content: "x" });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 5: 跑测试确认失败**

Run: `npx vitest run src/lib/channels/__tests__/session-webhook.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 6: 实现（import 自 `./format`，不 import gateway）**

```ts
// src/lib/channels/session-webhook.ts
import { formatForPlatform } from "./format";

export interface SessionReplyPayload {
  type: "text" | "markdown" | "card";
  title?: string;
  content: string;
  actions?: { label: string; url: string }[];
}

/**
 * 把消息 POST 到钉钉回调自带的 sessionWebhook（临时会话地址）。
 * 复用 formatForPlatform 拼钉钉消息体。失败不抛，返回 {ok:false}。
 */
export async function postToSessionWebhook(
  sessionWebhook: string,
  payload: SessionReplyPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body = formatForPlatform("dingtalk", payload);
    const res = await fetch(sessionWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { errcode?: number; errmsg?: string };
    if (data.errcode !== 0) return { ok: false, error: data.errmsg ?? "未知错误" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "未知错误" };
  }
}
```

- [ ] **Step 7: 跑测试确认通过 + 全量类型检查**

Run: `npx vitest run src/lib/channels/__tests__/session-webhook.test.ts` → PASS（3 passed）
Run: `npx tsc --noEmit` → 0 errors（format.ts 抽出后 gateway/outbound/route 仍编译）

- [ ] **Step 8: Commit**

```bash
git add src/lib/channels/format.ts src/lib/channels/gateway.ts src/lib/channels/session-webhook.ts src/lib/channels/__tests__/session-webhook.test.ts
git commit -m "refactor(channel): 抽出 format.ts；feat: postToSessionWebhook 钉钉会话回执"
```

---

## Task 6: Inngest 事件 + channelLinkIngest 函数 + 注册

**Files:**
- Modify: `src/inngest/events.ts`（加事件类型，放在 Mission 段之后任意位置）
- Create: `src/inngest/functions/channel-link-ingest.ts`
- Modify: `src/inngest/functions/index.ts`（import + 加进 functions 数组）
- Test: `src/inngest/functions/__tests__/channel-link-ingest.test.ts`

- [ ] **Step 1: 加事件类型**

`src/inngest/events.ts` 的 `InngestEvents` 里加：

```ts
  // ─── Channel Inbound Link Ingest (2026-06-19) ───
  /** 钉钉/企微入站消息含链接 → 抓取存稿。由 gateway 派发，channelLinkIngest 消费 */
  "channel/link-ingest.requested": {
    data: {
      organizationId: string;
      configId: string;
      platform: "dingtalk" | "wechat_work";
      url: string;
      sourceName: string;
      chatId: string;
      externalUserId: string;
      externalMessageId: string;
      /** 钉钉回调自带的 sessionWebhook，用于异步回执；空串表示无 */
      replyWebhook: string;
    };
  };
```

- [ ] **Step 2: 写失败测试（mock ingest + session-webhook）**

```ts
// src/inngest/functions/__tests__/channel-link-ingest.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const ingestLinkToArticle = vi.fn();
vi.mock("@/lib/channels/ingest-link-to-article", () => ({ ingestLinkToArticle }));
const postToSessionWebhook = vi.fn();
vi.mock("@/lib/channels/session-webhook", () => ({ postToSessionWebhook }));
const recordOutboundMessage = vi.fn();
vi.mock("@/app/actions/channels", () => ({ recordOutboundMessage }));

import { runIngestAndReply, notifyIngestFailure } from "../channel-link-ingest";

const data = {
  organizationId: "org1",
  configId: "cfg1",
  platform: "dingtalk" as const,
  url: "https://example.com/a",
  sourceName: "钉钉收稿·@u1",
  chatId: "c1",
  externalUserId: "u1",
  externalMessageId: "m1",
  replyWebhook: "https://oapi/session",
};

beforeEach(() => {
  ingestLinkToArticle.mockReset();
  postToSessionWebhook.mockReset();
  recordOutboundMessage.mockReset();
});

describe("runIngestAndReply", () => {
  it("新稿入库 → 回执 ✅ 含查看链接", async () => {
    ingestLinkToArticle.mockResolvedValue({ skipped: false, articleId: "a1", title: "标题" });
    postToSessionWebhook.mockResolvedValue({ ok: true });
    await runIngestAndReply(data);
    const [, payload] = postToSessionWebhook.mock.calls[0];
    expect(payload.content).toContain("✅ 已收录");
    expect(payload.content).toContain("标题");
  });

  it("命中去重 → 回执已收录过", async () => {
    ingestLinkToArticle.mockResolvedValue({ skipped: true, articleId: "a1", title: "旧稿" });
    postToSessionWebhook.mockResolvedValue({ ok: true });
    await runIngestAndReply(data);
    const [, payload] = postToSessionWebhook.mock.calls[0];
    expect(payload.content).toContain("已收录过");
  });

  it("无 replyWebhook → 不调 sessionWebhook", async () => {
    ingestLinkToArticle.mockResolvedValue({ skipped: false, articleId: "a1", title: "t" });
    await runIngestAndReply({ ...data, replyWebhook: "" });
    expect(postToSessionWebhook).not.toHaveBeenCalled();
  });
});

describe("notifyIngestFailure", () => {
  it("有 replyWebhook → 推 ❌ 失败回执 + 记 failed 日志", async () => {
    postToSessionWebhook.mockResolvedValue({ ok: true });
    await notifyIngestFailure(data, "抓取超时");
    const [, payload] = postToSessionWebhook.mock.calls[0];
    expect(payload.content).toContain("❌ 抓取失败");
    expect(payload.content).toContain("抓取超时");
    expect(recordOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org1", configId: "cfg1", status: "failed" })
    );
  });
});
```

> 注：核心逻辑抽成可单测的纯 async（`runIngestAndReply` / `notifyIngestFailure`），Inngest 函数只是壳。这样不必 mock 整个 Inngest runtime。

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run src/inngest/functions/__tests__/channel-link-ingest.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 4: 实现**

```ts
// src/inngest/functions/channel-link-ingest.ts
import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { ingestLinkToArticle } from "@/lib/channels/ingest-link-to-article";
import { postToSessionWebhook } from "@/lib/channels/session-webhook";
import { recordOutboundMessage } from "@/app/actions/channels";

type LinkIngestData = InngestEvents["channel/link-ingest.requested"]["data"];

/** 核心逻辑（可单测）：抓取入库 + 成功/去重回执。 */
export async function runIngestAndReply(data: LinkIngestData): Promise<void> {
  const result = await ingestLinkToArticle({
    organizationId: data.organizationId,
    url: data.url,
    sourceName: data.sourceName,
    channelContext: {
      platform: data.platform,
      configId: data.configId,
      chatId: data.chatId,
      externalUserId: data.externalUserId,
      externalMessageId: data.externalMessageId,
    },
  });

  if (!data.replyWebhook) return;

  const link = result.articleId
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/articles/${result.articleId}`
    : undefined;
  const content = result.skipped
    ? `该链接已收录过《${result.title}》`
    : `✅ 已收录《${result.title}》`;

  await postToSessionWebhook(data.replyWebhook, {
    type: link ? "card" : "text",
    title: "收稿结果",
    content,
    actions: link ? [{ label: "查看稿件", url: link }] : undefined,
  });
}

/** 终态失败回执（重试耗尽后调用）：推 ❌ 到群 + 记 failed 日志。 */
export async function notifyIngestFailure(
  data: LinkIngestData,
  errorMsg: string
): Promise<void> {
  const content = `❌ 抓取失败：${errorMsg}，可手动在系统添加。`;
  if (data.replyWebhook) {
    await postToSessionWebhook(data.replyWebhook, { type: "text", title: "收稿结果", content });
  }
  await recordOutboundMessage({
    organizationId: data.organizationId,
    configId: data.configId,
    platform: data.platform,
    externalUserId: data.externalUserId || undefined,
    chatId: data.chatId || undefined,
    content: { text: content },
    status: "failed",
  });
}

export const channelLinkIngest = inngest.createFunction(
  { id: "channel-link-ingest", retries: 2 },
  { event: "channel/link-ingest.requested" },
  async ({ event, step }) => {
    await step.run("ingest-and-reply", () => runIngestAndReply(event.data));
    return { ok: true };
  }
);

/**
 * 终态失败处理 —— 订阅 inngest/function.failed，仅认领本函数的失败。
 * 镜像本仓 executeMissionTaskFailureHandler 的写法（用 Record<string,unknown> 取原始事件）。
 */
export const channelLinkIngestFailureHandler = inngest.createFunction(
  { id: "channel-link-ingest-failure-handler", retries: 1 },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    const fnId = (event.data as Record<string, unknown>)?.function_id;
    if (fnId !== "channel-link-ingest") return;
    const originalEvent = (event.data as Record<string, unknown>)?.event as
      | { data?: LinkIngestData }
      | undefined;
    const errorMsg =
      ((event.data as Record<string, unknown>)?.error as { message?: string })?.message ??
      "未知错误";
    const data = originalEvent?.data;
    if (!data) return;
    await step.run("notify-failure", () => notifyIngestFailure(data, errorMsg));
  }
);
```

- [ ] **Step 5: 注册两个函数**

`src/inngest/functions/index.ts` 顶部 import：

```ts
import { channelLinkIngest, channelLinkIngestFailureHandler } from "./channel-link-ingest";
```

`functions` 数组里加：

```ts
  // Channel inbound link ingest
  channelLinkIngest,
  channelLinkIngestFailureHandler,
```

- [ ] **Step 6: 跑测试 + 类型检查**

Run: `npx vitest run src/inngest/functions/__tests__/channel-link-ingest.test.ts` → PASS（4 passed）
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 7: Commit**

```bash
git add src/inngest/events.ts src/inngest/functions/channel-link-ingest.ts src/inngest/functions/index.ts src/inngest/functions/__tests__/channel-link-ingest.test.ts
git commit -m "feat(channel): channelLinkIngest Inngest 函数 + 事件类型 + 注册"
```

---

## Task 7: gateway 链接分支 + StandardizedMessage.replyWebhook

**Files:**
- Modify: `src/lib/channels/gateway.ts:20-29`（接口）、`:108-116`（分支）
- Test: `src/lib/channels/__tests__/gateway-link-branch.test.ts`

- [ ] **Step 1: 写失败测试（mock inngest + actions）**

```ts
// src/lib/channels/__tests__/gateway-link-branch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();
vi.mock("@/inngest/client", () => ({ inngest: { send } }));
vi.mock("@/app/actions/channels", () => ({
  recordInboundMessage: vi.fn().mockResolvedValue({ messageId: "x" }),
  recordOutboundMessage: vi.fn().mockResolvedValue({ messageId: "y" }),
}));

import { handleInboundMessage } from "../gateway";

const msg = {
  platform: "dingtalk" as const,
  configId: "cfg1",
  organizationId: "org1",
  externalMessageId: "m1",
  externalUserId: "u1",
  chatId: "c1",
  textContent: "看看 https://example.com/a 这条",
  rawMessage: {},
  replyWebhook: "https://oapi/session",
};

beforeEach(() => send.mockReset());

describe("handleInboundMessage 链接分支", () => {
  it("含链接 → 派 channel/link-ingest.requested 并秒回 ⏳", async () => {
    const r = await handleInboundMessage(msg);
    expect(send).toHaveBeenCalledTimes(1);
    const evt = send.mock.calls[0][0];
    expect(evt.name).toBe("channel/link-ingest.requested");
    expect(evt.data.url).toBe("https://example.com/a");
    expect(evt.data.replyWebhook).toBe("https://oapi/session");
    expect(evt.id).toContain("m1");
    expect(r.reply).toContain("⏳");
  });

  it("无链接 → 不派事件（落到自由识别分支）", async () => {
    await handleInboundMessage({ ...msg, textContent: "今天天气不错" }).catch(() => {});
    expect(send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/channels/__tests__/gateway-link-branch.test.ts`
Expected: FAIL（无链接分支 / 字段不存在）。

- [ ] **Step 3: 改接口 + 加分支**

`StandardizedMessage` 接口（:20-29）**已有** `rawMessage: unknown;`（:28）——不要重复添加（重复会 `Duplicate identifier` tsc 失败）。只在 `rawMessage` 那行后面新增一行：

```ts
  replyWebhook?: string; // 钉钉 sessionWebhook（异步回执用）
```

文件顶部加 import：

```ts
import { inngest } from "@/inngest/client";
import { extractUrls } from "./link-extract";
```

`handleInboundMessage` 在 `if (command) { return handleQuickCommand(...); }` 之后、`return handleFreeFormMessage(...)` 之前插入：

```ts
  // 3. 含链接 → 异步抓取存稿
  const urls = extractUrls(text);
  if (urls.length > 0) {
    return handleLinkIngest(urls, msg);
  }
```

文件内（quick command handler 附近）新增：

```ts
async function handleLinkIngest(
  urls: string[],
  msg: StandardizedMessage
): Promise<{ reply: string; missionId?: string }> {
  const sourceName = `钉钉收稿·@${msg.externalUserId || "未知"}`;
  await Promise.all(
    urls.map((url, i) =>
      inngest.send({
        id: `${msg.externalMessageId}#${i}`,
        name: "channel/link-ingest.requested",
        data: {
          organizationId: msg.organizationId,
          configId: msg.configId,
          platform: msg.platform,
          url,
          sourceName,
          chatId: msg.chatId,
          externalUserId: msg.externalUserId,
          externalMessageId: msg.externalMessageId,
          replyWebhook: msg.replyWebhook ?? "",
        },
      })
    )
  );
  return {
    reply:
      urls.length === 1
        ? "⏳ 已收到链接，正在抓取，稍后回执。"
        : `⏳ 已收到 ${urls.length} 条链接，正在抓取，稍后回执。`,
  };
}
```

- [ ] **Step 4: 跑测试确认通过 + 类型检查**

Run: `npx vitest run src/lib/channels/__tests__/gateway-link-branch.test.ts` → PASS
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/gateway.ts src/lib/channels/__tests__/gateway-link-branch.test.ts
git commit -m "feat(channel): gateway 加链接分支，派 link-ingest 事件并秒回"
```

---

## Task 8: 钉钉 webhook route —— inboundSecret 验签 + 透传 sessionWebhook

**Files:**
- Modify: `src/app/api/channels/dingtalk/webhook/[configId]/route.ts:22-35`（验签）、`:57-67`（调用）

- [ ] **Step 1: 验签改用 inboundSecret（回退 robotSecret）**

把 `:23` 的 `if (config.robotSecret) {` 一段改为：

```ts
    // 入站回调验签：优先用企业内部机器人 AppSecret（inboundSecret），
    // 回退旧字段 robotSecret 以兼容存量配置。
    const inboundSecret = config.inboundSecret ?? config.robotSecret;
    if (inboundSecret) {
      const timestamp = req.headers.get("timestamp");
      const sign = req.headers.get("sign");
      if (!timestamp || !sign) {
        return NextResponse.json({ errcode: 401, errmsg: "Missing signature" }, { status: 401 });
      }
      if (!isDingtalkTimestampValid(timestamp)) {
        return NextResponse.json({ errcode: 401, errmsg: "Timestamp expired" }, { status: 401 });
      }
      if (!verifyDingtalkSignature(timestamp, sign, inboundSecret)) {
        return NextResponse.json({ errcode: 401, errmsg: "Invalid signature" }, { status: 401 });
      }
    }
```

- [ ] **Step 2: 透传 sessionWebhook**

`handleInboundMessage({...})` 调用里（`:57` 附近）加一行：

```ts
      textContent,
      rawMessage: body,
      replyWebhook: typeof body.sessionWebhook === "string" ? body.sessionWebhook : undefined,
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 0 errors。

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/channels/dingtalk/webhook/[configId]/route.ts"
git commit -m "feat(channel): 钉钉 webhook 用 inboundSecret 验签并透传 sessionWebhook"
```

---

## Task 9: 渠道配置 UI —— inboundSecret 表单栏

**Files:**
- Modify: `src/app/(dashboard)/settings/channels/channels-client.tsx`（`ChannelFormState`:118 / `defaultForm`:129 / `openEdit`:180 / `handleSubmit`:207 / 钉钉表单字段:584 附近）

- [ ] **Step 1: 表单 state 加字段**

`ChannelFormState`（:118）在 `robotSecret: string;` 后加 `inboundSecret: string;`；`defaultForm()`（:129）加 `inboundSecret: "",`；`openEdit`（:183 的 setForm）加 `inboundSecret: cfg.inboundSecret ?? "",`。

- [ ] **Step 2: handleSubmit 透传**

`handleSubmit`（:207）里**每一处**传 `robotSecret` 的对象旁边都照抄一行 `inboundSecret`，**写法与该处 `robotSecret` 完全一致**（该行用 `form.robotSecret || null` 就写 `form.inboundSecret || null`；用 `|| undefined` 就跟着 `|| undefined`）。该文件里 `robotSecret` 出现在多处（create 调用、乐观更新、update 调用），逐处对齐即可，不要自己臆断 null/undefined。

- [ ] **Step 3: 钉钉表单加密钥栏**

在钉钉的 `robotSecret` 密钥字段（:584 的那段 secret field 组件）后，复制一份改为 `inboundSecret`：

```tsx
                  <SecretField
                    id="ch-inboundSecret"
                    label="入站验签密钥（企业内部机器人 AppSecret）"
                    value={form.inboundSecret}
                    masked={editTarget ? !showSecrets["inboundSecret"] : false}
                    showToggle={!!editTarget}
                    onToggle={() => toggleSecret("inboundSecret")}
                    onChange={(v) => setField("inboundSecret", v)}
                  />
```

> 组件真名是 `SecretField`（定义在本文件 :827 附近），props 与现有 `robotSecret` 那处（:584-594）保持一致——**`showToggle={!!editTarget}` 是必填 boolean，漏了会 tsc 失败**。仅在钉钉 platform 分支显示。不要新造、不要裸 `<input>`。

- [ ] **Step 4: 类型检查 + ui-polish 自检**

Run: `npx tsc --noEmit` → 0 errors
然后用 ui-polish skill 自检这个文件（确认用了共享 `<Input>`/无颜色覆盖/中文文案）。

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/settings/channels/channels-client.tsx"
git commit -m "feat(channel): 渠道配置加入站验签密钥（AppSecret）表单栏"
```

---

## Task 10: 全量验证 + 端到端手测

- [ ] **Step 1: 类型 + 构建 + 全量测试**

```bash
npx tsc --noEmit          # 0 errors
npm run build             # 通过
npm test                  # 新增 4 个测试文件全过；DB 集成测试需本地库在跑
```

- [ ] **Step 2: 端到端手测清单（dev server + 真实钉钉）**

1. `/settings/channels` 编辑钉钉渠道，填入企业内部机器人 AppSecret 到「入站验签密钥」，复制 webhook URL。
2. 钉钉开发者后台：机器人「消息接收」回调地址填该 URL；机器人加入测试群。
3. 群里 @机器人 发一条带链接的消息（如 `@机器人 https://...`）。
4. 期望：群里秒回 `⏳ 已收到链接，正在抓取`；几秒后回 `✅ 已收录《标题》[查看稿件]`。
5. `/articles` 出现一篇 `draft`、`sourceType=repost`、`sourceUrl` 为该链接的稿件。
6. 再发同一链接 → 回 `该链接已收录过《标题》`，不重复入库。
7. 发一条无链接闲聊 → 维持原有"已识别意图"行为，不入库。

- [ ] **Step 3: 收尾 commit（如有手测期微调）**

```bash
git add -A && git commit -m "chore(channel): 入站收稿端到端联调微调"
```

---

## 备注 / 风险

- **inngest `id` 幂等**：inngest `^3.54.1` 支持 `send({ id, name, data })`，同 `id` 在去重窗口内只投一次。主去重仍是 `ingestLinkToArticle` 的 `sourceUrl` 查重（独立兜住钉钉 at-least-once 重试）。
- **sessionWebhook 字段名**：以机器人实际回调样例为准二次确认（spec 已核实官方含此字段）。若字段名不同，只需改 Task 8 Step 2 一处。
- **企微 P2**：本计划只做钉钉。企微入站收链接 + access_token 回执留到下一个 plan。
- **退化兼容**：未填 `inboundSecret` 的存量钉钉配置走 `robotSecret` 回退验签，不破坏现有出站。
