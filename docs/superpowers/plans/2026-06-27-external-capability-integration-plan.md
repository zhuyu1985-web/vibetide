# 外部能力接入(HTTP-MCP + 注册式 CLI 工具)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让数字员工 agent 能调用外部能力——连接 http MCP server 拉取其工具,以及调用注册式白名单 CLI 工具(ffmpeg 类),全部经 `toVercelTools` 统一来源槽注入,5 个用户面统一可见。

**Architecture:** 不改 `executeAgent` 主 loop,只在 `toVercelTools`(`src/lib/agent/tool-registry.ts`)加两个工具来源槽(`mcpTools` / `cliTools`),由两个 lazy 工厂在执行期按 org 注入。MCP 走 `@ai-sdk/mcp` http transport(异步连接 + 收尾关闭)。CLI 走 `child_process.spawn(shell:false)` + argv 安全模型,重活入队 Inngest(抄 tingwu durable 模式),文件 I/O 桥接 media-assets + 存储 provider,产物落 `mission_artifacts`。授权 org 全员 + read/write 门控。

**Tech Stack:** Next.js 16 / Drizzle ORM / AI SDK v6(`@ai-sdk/mcp`)/ Inngest / Vitest / `child_process` / 火山 TOS·腾讯 COS 存储抽象。

**Spec:** [docs/superpowers/specs/2026-06-26-mcp-cli-capability-integration-design.md](../specs/2026-06-26-mcp-cli-capability-integration-design.md)

---

## 通用约定(所有任务遵守)

- **Schema 变更**:改 `src/db/schema/*.ts` 后,本地 `npm run db:push`(本地库 journal 空,团队约定);提交前另跑 `npm run db:generate` 产出迁移文件供生产 `db:migrate`,并 `bash scripts/verify-schema-sync.sh`。
- **每步 commit 前**必过 `npx tsc --noEmit`;里程碑末过 `npm run build`。
- **测试**:`npx vitest run <file>` 跑单文件;新测试放 `src/lib/**/__tests__/` 就近。
- **行号**:spec/本计划的 `:line` 是写作时锚点,动手前 grep 符号名复核。
- **UI**:复用共享 primitive(Button/Input/Select/DataTable/GlassCard…),禁裸 `<button>/<input>`;按钮无边框;文案中文。
- **取 org id 的标准写法**(所有 server action / 需 orgId 处复用,**不是** `requireCurrentOrgId`——它不存在):
  ```ts
  import { requireAuth } from "@/lib/auth";
  import { getCurrentUserOrg } from "@/lib/dal/auth"; // 返回 string | null
  async function requireOrg(): Promise<string> {
    await requireAuth();
    const orgId = await getCurrentUserOrg();
    if (!orgId) throw new Error("无法获取组织信息");
    return orgId;
  }
  ```
  (照搬 `src/app/actions/channels.ts:15-20` 的 `requireOrg` helper。)
- **`validatePluginUrl` 是返回值不是抛异常**(`src/lib/plugin-security.ts`,返回 `{ valid, error? }`)——必须显式判:
  ```ts
  const check = validatePluginUrl(url);
  if (!check.valid) throw new Error(check.error!);
  ```
  直接 `validatePluginUrl(url)` 不判返回值 = SSRF 闸门形同虚设。
- **不要用 `git commit --amend`** 在本活跃分支(有并行提交流);每个任务一个新 commit。

---

## 文件结构地图

### 里程碑 M1 — MCP-http 配置(纯配置,不碰执行链路)
| 文件 | 职责 |
|---|---|
| `src/db/schema/mcp-servers.ts`(新) | `mcp_servers` 表 |
| `src/db/schema/index.ts`(改) | re-export 新表 |
| `src/lib/dal/mcp-servers.ts`(新) | 只读:`listEnabledMcpServers(orgId)` / `listMcpServersByOrg` / `getMcpServerById`(org 校验) |
| `src/app/actions/mcp-servers.ts`(新) | `createMcpServer`/`updateMcpServer`/`toggleMcpServer`/`testMcpServer`(requireAuth + org) |
| `src/lib/mcp/feature-flags.ts`(新) | `isMcpEnabled()` env flag |
| `src/lib/mcp/crypto-headers.ts`(新) | 认证头加解密(包 `crypto.ts`) |
| `src/app/(dashboard)/settings/mcp/`(新) | MCP 服务器管理页(server + client) |

### 里程碑 M2 — 工具注入接缝(MCP 可用)
| 文件 | 职责 |
|---|---|
| `package.json`(改) | 加 `@ai-sdk/mcp` 依赖 |
| `src/lib/mcp/toolset.ts`(新) | `createMcpToolset(orgId)` → `{tools, close}` |
| `src/lib/agent/tool-registry.ts`(改) | `toVercelTools` 加 `mcpTools?` 槽 + 合并循环 |
| `src/lib/agent/execution.ts`(改 ~:239) | 调 `createMcpToolset` + 传槽 + finally close |
| `src/app/api/chat/stream/route.ts`(改 ~:160) | 同上(onFinish/onError close) |
| `src/app/api/chat/intent-execute/route.ts`(改 ~:264) | 同上 |
| `src/app/api/scenarios/execute/route.ts`(改 ~:161) | 同上 |

### 里程碑 M3 — CLI 能力(完整)
| 文件 | 职责 |
|---|---|
| `src/db/schema/cli-tools.ts`(新) | `cli_tools` + `cli_tool_runs` 表 |
| `src/lib/cli/allowlist.ts`(新) | `CLI_ALLOWED_BINARIES` 解析 + 校验 + binary 存在性预检 |
| `src/lib/cli/argv.ts`(新) | **安全核心**:argsSchema 校验 + argvTemplate → 安全 argv 数组 |
| `src/lib/cli/scratch.ts`(新) | `mkdtemp` scratch 目录 + cleanup |
| `src/lib/cli/spawn.ts`(新) | `runCli`:spawn(shell:false) + 超时 kill + 退出码/stderr 捕获 |
| `src/lib/media/asset-io.ts`(新) | `resolveOrgAsset(orgId,id)` / `downloadObjectToFile` / `storeBufferAsAsset` / ffprobe 元数据 |
| `src/lib/format.ts`(新)+ `src/app/actions/assets.ts`(改 :19/:134) | 把 `formatFileSize` 移出 `"use server"` 文件到普通模块 |
| `src/lib/cli/toolset.ts`(新) | `createCliToolset(orgId)` → ToolSet(sync 直跑 / async 入队) |
| `src/lib/dal/cli-tools.ts`(新) | CLI 工具/运行记录读 |
| `src/app/actions/cli-tools.ts`(新) | CLI 工具 CRUD + test-run |
| `src/inngest/events.ts`(改 ~:615) | 声明 `cli/run.requested` |
| `src/inngest/functions/cli-run.ts`(新) | `cliRun` durable fn + 失败 handler |
| `src/inngest/functions/index.ts`(改 :184) | 注册 |
| `src/lib/agent/tool-registry.ts`(改) | `toVercelTools` 加 `cliTools?` 槽 |
| 4 个调用点(改) | 传 `cliTools` 槽 |
| `src/app/(dashboard)/settings/cli-tools/` 或能力中心(新) | CLI 工具管理页 |

---

# 里程碑 M1 — MCP-http 配置

> 交付物:运营能在 `/settings/mcp` 增删/测连 http MCP server,凭据加密存。尚未接入 agent(M2 接)。

### Task M1.1: `mcp_servers` 表

**Files:**
- Create: `src/db/schema/mcp-servers.ts`
- Modify: `src/db/schema/index.ts`(re-export)

- [ ] **Step 1: 写表定义**(仿 `src/db/schema/channels.ts` 风格)

```ts
// src/db/schema/mcp-servers.ts
import { pgTable, uuid, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const mcpServers = pgTable("mcp_servers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  url: text("url").notNull(),
  encryptedHeaders: text("encrypted_headers"),
  defaultToolClass: text("default_tool_class").notNull().default("write"), // 'read' | 'write'
  connectTimeoutMs: integer("connect_timeout_ms").notNull().default(8000),
  enabled: integer("enabled").notNull().default(1),
  lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
  lastError: text("last_error"),
  toolCount: integer("tool_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("mcp_servers_org_name_uidx").on(t.organizationId, t.name)]);
```

- [ ] **Step 2: re-export** 在 `src/db/schema/index.ts` 加 `export * from "./mcp-servers";`

- [ ] **Step 3: 应用 schema** `npm run db:push`(本地)→ 确认无错;`npm run db:generate` 产迁移文件。

- [ ] **Step 4: tsc** `npx tsc --noEmit` → 0 错。

- [ ] **Step 5: Commit**
```bash
git add src/db/schema/mcp-servers.ts src/db/schema/index.ts supabase/migrations
git commit -m "feat(mcp): mcp_servers 表"
```

### Task M1.2: 认证头加解密 + feature flag

**Files:**
- Create: `src/lib/mcp/crypto-headers.ts`, `src/lib/mcp/feature-flags.ts`
- Test: `src/lib/mcp/__tests__/crypto-headers.test.ts`

- [ ] **Step 1: 写失败测试**(往返加解密)
```ts
// crypto-headers.test.ts
import { encryptHeaders, decryptHeaders } from "../crypto-headers";
test("headers round-trip", () => {
  const h = { Authorization: "Bearer xyz" };
  const enc = encryptHeaders(h);
  expect(enc).not.toContain("xyz");
  expect(decryptHeaders(enc)).toEqual(h);
});
test("decrypt null/empty → {}", () => {
  expect(decryptHeaders(null)).toEqual({});
});
```

- [ ] **Step 2: 跑测试确认 FAIL**(模块不存在)`npx vitest run src/lib/mcp/__tests__/crypto-headers.test.ts`

- [ ] **Step 3: 实现**(包 `src/lib/crypto.ts` 的 `encrypt`/`decrypt`)
```ts
// src/lib/mcp/crypto-headers.ts
import { encrypt, decrypt } from "@/lib/crypto";
export function encryptHeaders(headers: Record<string, string>): string {
  return encrypt(JSON.stringify(headers));
}
export function decryptHeaders(enc: string | null): Record<string, string> {
  if (!enc) return {};
  try { return JSON.parse(decrypt(enc)); } catch { return {}; }
}
```
```ts
// src/lib/mcp/feature-flags.ts
export function isMcpEnabled(): boolean {
  return process.env.VIBETIDE_MCP_ENABLED === "true";
}
```

- [ ] **Step 4: 跑测试 PASS**。 **Step 5: tsc + Commit** `feat(mcp): 认证头加解密 + feature flag`

### Task M1.3: DAL(只读)

**Files:**
- Create: `src/lib/dal/mcp-servers.ts`
- Test: `src/lib/dal/__tests__/mcp-servers.test.ts`(可用 mock db 或集成,视项目现有 DAL 测试风格;若 DAL 无单测先例,跳过测试只做类型 + 手验)

- [ ] **Step 1: 实现读函数**(全部 org 作用域)
```ts
// src/lib/dal/mcp-servers.ts
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function listEnabledMcpServers(orgId: string) {
  return db.query.mcpServers.findMany({
    where: and(eq(mcpServers.organizationId, orgId), eq(mcpServers.enabled, 1)),
  });
}
export async function listMcpServersByOrg(orgId: string) {
  return db.query.mcpServers.findMany({ where: eq(mcpServers.organizationId, orgId) });
}
export async function getMcpServerById(orgId: string, id: string) {
  return db.query.mcpServers.findFirst({
    where: and(eq(mcpServers.id, id), eq(mcpServers.organizationId, orgId)),
  });
}
```

- [ ] **Step 2: tsc + Commit** `feat(mcp): mcp_servers DAL`

### Task M1.4: Server actions(CRUD + 测连)

**Files:**
- Create: `src/app/actions/mcp-servers.ts`
- 参考模板:`src/app/actions/channels.ts`(create/update/toggle/test 形状)、`src/app/actions/skills.ts:106` `registerPluginSkill`(SSRF + 加密)

- [ ] **Step 1: 实现 actions**(第一行 `"use server"`;全部 `requireAuth()` + `requireCurrentOrgId()`;URL 过 `validatePluginUrl`;头 `encryptHeaders`)
```ts
"use server";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { validatePluginUrl } from "@/lib/plugin-security";
import { encryptHeaders } from "@/lib/mcp/crypto-headers";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function requireOrg(): Promise<string> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");
  return orgId;
}

export async function createMcpServer(input: {
  name: string; url: string; headers?: Record<string,string>;
  defaultToolClass?: "read"|"write"; connectTimeoutMs?: number;
}) {
  const orgId = await requireOrg();
  const check = validatePluginUrl(input.url);
  if (!check.valid) throw new Error(check.error!); // SSRF/非 HTTPS 即拒
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await db.insert(mcpServers).values({
    organizationId: orgId, name: input.name, slug, url: input.url,
    encryptedHeaders: input.headers ? encryptHeaders(input.headers) : null,
    defaultToolClass: input.defaultToolClass ?? "write",
    connectTimeoutMs: input.connectTimeoutMs ?? 8000,
  });
  revalidatePath("/settings/mcp");
}
// updateMcpServer / toggleMcpServer(enabled 0/1)同形状，均 and(eq(id), eq(org))
```

- [ ] **Step 2: `testMcpServer`** —— M1 阶段先做"占位"返回(真正连接在 M2 有 `createMCPClient` 后填),或直接放到 M2.2。建议:M1 只校验 URL 可达性(`fetch(url,{method:"HEAD"})` 带超时),返回 `{ok, error?}`;真正的 tool 列表测连 M2 接。

- [ ] **Step 3: tsc + Commit** `feat(mcp): mcp_servers server actions`

### Task M1.5: 管理 UI `/settings/mcp`

**Files:**
- Create: `src/app/(dashboard)/settings/mcp/page.tsx`(server,`export const dynamic = 'force-dynamic'`,取 `listMcpServersByOrg`)
- Create: `src/app/(dashboard)/settings/mcp/mcp-client.tsx`(client)
- 参考:`/settings/channels` 或 `/settings/cms-mapping` 的页面结构

- [ ] **Step 1: server page** 取数据传 client。
- [ ] **Step 2: client** —— `<DataTable>` 列出 server(name/url/状态/toolCount/lastConnectedAt);`<GlassCard>` + `<Dialog>` 新建/编辑表单(`<Input>` URL、`<Textarea>` headers JSON、`<Select>` defaultToolClass);`<Button>` 测连/启停。弹层内列表用固定高度 `h-X`(非 `max-h`)。
- [ ] **Step 3: tsc + build + Commit** `feat(mcp): /settings/mcp 管理页`

> **M1 验收**:`/settings/mcp` 能增删 server、URL 过 SSRF、头加密入库、toggle 生效。`npm run build` 过。

---

# 里程碑 M2 — 工具注入接缝(MCP 可用)

> 交付物:agent 在 5 个面都能调用 org 启用的 http MCP server 暴露的工具。

### Task M2.1: 安装依赖

- [ ] **Step 1:** `npm i @ai-sdk/mcp`(http transport 不需 `@modelcontextprotocol/sdk`)。
- [ ] **Step 2:** 确认 `package.json` 出现 `@ai-sdk/mcp`,版本与 `ai@^6` 兼容。 **Commit** `chore(mcp): 安装 @ai-sdk/mcp`

### Task M2.2: `createMcpToolset(orgId)`

**Files:**
- Create: `src/lib/mcp/toolset.ts`
- Test: `src/lib/mcp/__tests__/toolset.test.ts`

- [ ] **Step 1: 写失败测试**(用 mock:把 `createMCPClient` 与 `listEnabledMcpServers` 通过 `vi.mock` 替身,验证 ① 工具前缀 `mcp__{slug}__{tool}` 且 sanitize ② 单 server 抛错被跳过、其余仍返回 ③ `close()` 调用所有 client.close ④ 无 server → 空 tools)
```ts
// toolset.test.ts（要点）
vi.mock("@ai-sdk/mcp", () => ({ createMCPClient: vi.fn() }));
vi.mock("@/lib/dal/mcp-servers", () => ({ listEnabledMcpServers: vi.fn() }));
// server A 正常返回 {search:{...}}, server B 抛错
// 断言 result.tools 有 "mcp__a__search"、无 B 的工具、close 调到 A.close
```

- [ ] **Step 2: 跑测试确认 FAIL**。

- [ ] **Step 3: 实现**
```ts
// src/lib/mcp/toolset.ts
import { createMCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import { listEnabledMcpServers } from "@/lib/dal/mcp-servers";
import { decryptHeaders } from "./crypto-headers";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { eq } from "drizzle-orm";

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]+/g, "_");

export async function createMcpToolset(orgId: string): Promise<{ tools: ToolSet; close: () => Promise<void> }> {
  const servers = await listEnabledMcpServers(orgId);
  const clients: Array<{ close: () => Promise<void> }> = [];
  const tools: ToolSet = {};
  await Promise.all(servers.map(async (s) => {
    try {
      const client = await createMCPClient({
        transport: { type: "http", url: s.url, headers: decryptHeaders(s.encryptedHeaders) },
      });
      clients.push(client);
      const raw = await client.tools();
      for (const [name, def] of Object.entries(raw)) {
        tools[sanitize(`mcp__${s.slug}__${name}`)] = def as ToolSet[string];
      }
      await db.update(mcpServers).set({
        lastConnectedAt: new Date(), toolCount: Object.keys(raw).length, lastError: null,
      }).where(eq(mcpServers.id, s.id));
    } catch (e) {
      await db.update(mcpServers).set({ lastError: String(e) }).where(eq(mcpServers.id, s.id));
    }
  }));
  return { tools, close: async () => { await Promise.allSettled(clients.map((c) => c.close())); } };
}
```
> 注:per-server 连接超时——若 `createMCPClient` 不内置,用 `Promise.race([client.tools(), timeout(s.connectTimeoutMs)])` 包住握手。实现时按 `@ai-sdk/mcp` 实际 API 调整。

- [ ] **Step 4: 跑测试 PASS**。回填 `testMcpServer`(M1.4)用 `createMcpToolset` 单连一个 server 取 toolCount。 **Step 5: tsc + Commit** `feat(mcp): createMcpToolset 工厂`

### Task M2.3: `toVercelTools` 加 `mcpTools` 槽

**Files:**
- Modify: `src/lib/agent/tool-registry.ts`(`toVercelTools` ~:2845,kbTools 合并循环 ~:2890)
- Test: `src/lib/agent/__tests__/to-vercel-tools-mcp.test.ts`

- [ ] **Step 1: 写失败测试**——传入 `mcpTools={ mcp__a__x: {...} }`,断言出现在结果且过了 `wrapToolExecuteWithContext`(execute 注入 orgId)。
- [ ] **Step 2: FAIL**(签名无此参数)。
- [ ] **Step 3: 实现**——给 `toVercelTools` 加形参 `mcpTools?: ToolSet`(放 `cliTools` 之前留位),在 kbTools 循环后镜像合并:
```ts
if (mcpTools) {
  for (const [name, def] of Object.entries(mcpTools)) {
    result[name] = wrapToolExecuteWithContext(def as { execute?: unknown }, context) as ToolSet[string];
  }
}
```
- [ ] **Step 4: PASS + tsc + Commit** `feat(mcp): toVercelTools 加 mcpTools 槽`

### Task M2.4: 4 个调用点 wiring + 生命周期

**Files:** Modify `execution.ts:239`、`chat/stream/route.ts:160`、`chat/intent-execute/route.ts:264`、`scenarios/execute/route.ts:161`

- [ ] **Step 1(execution.ts,generateText)**:
```ts
const mcp = await createMcpToolset(context.organizationId);
try {
  const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs, missionTools, kbTools, mcp.tools, context);
  // ... 原 generateText
} finally { await mcp.close(); }
```
- [ ] **Step 2(三个 streaming route,streamText)**:同样 `await createMcpToolset(orgId)`,传槽,并在 `streamText({ onFinish: async()=>{...; await mcp.close()}, onError: async()=>{ await mcp.close() } })` 关闭。注意 `toVercelTools` 的参数顺序(mcp.tools 放新槽位)。
- [ ] **Step 3:** 每个文件改完 `npx tsc --noEmit`。
- [ ] **Step 4: 手验**——起一个 http MCP server(或 mock),在对话中心触发其工具,确认调用成功且响应回流;`enabled=0` 后该工具消失。⚠ `validatePluginUrl` 只放行 **HTTPS**,纯 `http://localhost` 无法经 UI/action 注册——用 HTTPS 隧道端点,或在单测里直接调 `createMcpToolset`(绕过 action 的 URL 校验)验证。注:这里 `transport.type:"http"` 是 MCP 的 **Streamable HTTP 传输类型**,URL scheme 仍是 `https://`,两者不冲突。
- [ ] **Step 5: build + Commit** `feat(mcp): 4 调用点注入 MCP 工具集 + 生命周期收尾`

> **M2 验收**:启用一个 http MCP server,agent 在自由对话/mission/intent-execute/场景四路径都能调到其工具;失败 server 降级不阻断;client 连接被关闭。`npm run build` 过。

---

# 里程碑 M3 — CLI 能力(完整)

> 交付物:运营注册 ffmpeg 类 CLI 工具,agent 用自然语言驱动转码/剪辑;轻命令同步、重命令走 Inngest,产物入素材库 + 回流任务台。**两个内部 commit 边界:M3a 基础+同步,M3b 异步。**

## M3a — 基础 + 同步执行

### Task M3.1: `cli_tools` + `cli_tool_runs` 表

**Files:** Create `src/db/schema/cli-tools.ts`;Modify `src/db/schema/index.ts`

- [ ] **Step 1: 表定义**
```ts
// src/db/schema/cli-tools.ts
import { pgTable, uuid, text, integer, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const cliTools = pgTable("cli_tools", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull(),
  command: text("command").notNull(),                 // ∈ CLI_ALLOWED_BINARIES
  argsSchema: jsonb("args_schema").notNull(),          // { field: {type,enum?,min?,max?,regex?,required?} }
  argvTemplate: jsonb("argv_template").notNull(),       // token[]：string | {param} | {output}
  executionMode: text("execution_mode").notNull().default("async"), // 'sync'|'async'
  syncTimeoutMs: integer("sync_timeout_ms").notNull().default(20000),
  outputKind: text("output_kind").notNull().default("media_asset"), // 'media_asset'|'text'
  toolClass: text("tool_class").notNull().default("write"),
  enabled: integer("enabled").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("cli_tools_org_slug_uidx").on(t.organizationId, t.slug)]);

export const cliToolRuns = pgTable("cli_tool_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  cliToolId: uuid("cli_tool_id").references(() => cliTools.id).notNull(),
  status: text("status").notNull().default("queued"), // queued|processing|done|failed
  inputAssetId: uuid("input_asset_id"),
  outputAssetId: uuid("output_asset_id"),
  argvResolved: jsonb("argv_resolved"),
  exitCode: integer("exit_code"),
  errorMessage: text("error_message"),
  stderrTail: text("stderr_tail"),
  missionId: uuid("mission_id"),
  taskId: uuid("task_id"),
  conversationId: uuid("conversation_id"),
  jobId: text("job_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (t) => [index("cli_tool_runs_org_tool_idx").on(t.organizationId, t.cliToolId), index("cli_tool_runs_job_idx").on(t.jobId)]);
```
- [ ] **Step 2: re-export + `db:push` + `db:generate` + tsc + Commit** `feat(cli): cli_tools/cli_tool_runs 表`

### Task M3.2: 命令白名单 + 预检

**Files:** Create `src/lib/cli/allowlist.ts`;Test `src/lib/cli/__tests__/allowlist.test.ts`

- [ ] **Step 1: 失败测试**——`assertAllowedBinary("ffmpeg")` 通过、`assertAllowedBinary("bash")` 抛错(env `CLI_ALLOWED_BINARIES=ffmpeg,ffprobe`)。
- [ ] **Step 2: FAIL**。
- [ ] **Step 3: 实现**
```ts
// src/lib/cli/allowlist.ts
export function allowedBinaries(): string[] {
  return (process.env.CLI_ALLOWED_BINARIES ?? "").split(",").map(s => s.trim()).filter(Boolean);
}
export function assertAllowedBinary(cmd: string): void {
  if (!allowedBinaries().includes(cmd)) throw new Error(`命令未在 CLI_ALLOWED_BINARIES 白名单：${cmd}`);
}
// 预检：binary 存在性（首次运行/注册时调用）
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const pexec = promisify(execFile);
export async function probeBinary(cmd: string): Promise<{ ok: boolean; error?: string }> {
  assertAllowedBinary(cmd);
  try { await pexec(cmd, ["-version"], { timeout: 5000 }); return { ok: true }; }
  catch (e) { return { ok: false, error: `binary 不可用：${cmd}（${String(e)}）` }; }
}
```
- [ ] **Step 4: PASS + tsc + Commit** `feat(cli): 命令白名单 + binary 预检`

### Task M3.3: argv 安全引擎(**核心,重点 TDD**)

**Files:** Create `src/lib/cli/argv.ts`;Test `src/lib/cli/__tests__/argv.test.ts`

- [ ] **Step 1: 写注入/校验测试集(覆盖攻击面)**
```ts
// argv.test.ts
import { validateParams, resolveArgv } from "../argv";
const schema = { input:{type:"asset",required:true}, fmt:{type:"enum",values:["mp4","gif"]} };
const tmpl = ["-y","-i",{param:"input"},"-f",{param:"fmt"},{output:"out"}];

test("注入字符串作为单个 argv 元素，不被拆分/解析", () => {
  // input 解析后是 scratch 路径；这里测 enum 拒非法值
  expect(() => validateParams(schema, { input:"asset-1", fmt:"mp4; rm -rf /" })).toThrow();
});
test("enum 越界被拒", () => {
  expect(() => validateParams(schema, { input:"asset-1", fmt:"avi" })).toThrow();
});
test("缺 required 被拒", () => {
  expect(() => validateParams(schema, { fmt:"mp4" })).toThrow();
});
test("resolveArgv 产出固定位置数组、引用值是单元素", () => {
  const argv = resolveArgv(tmpl, { input:"/scratch/in.mov", fmt:"mp4" }, "/scratch/out.mp4");
  expect(argv).toEqual(["-y","-i","/scratch/in.mov","-f","mp4","/scratch/out.mp4"]);
});
test("数值上下限/regex 生效", () => { /* min/max/regex 各一例 */ });
```
- [ ] **Step 2: FAIL**。
- [ ] **Step 3: 实现**(`validateParams`:逐字段 type/enum/min/max/regex/required 校验,asset 型返回原 id 待 resolver 解析;`resolveArgv`:token 数组逐项映射,`{param}` 替换为已校验值的**单个**字符串元素,`{output}` 替换为传入的输出路径,literal 原样。**绝不** join 成字符串)。
- [ ] **Step 4: PASS**(全绿,尤其注入用例)。 **tsc + Commit** `feat(cli): argv 安全引擎（参数校验 + 模板解析）`

### Task M3.4: 媒体文件 I/O helper

**Files:** Create `src/lib/media/asset-io.ts`;Modify `src/app/actions/assets.ts`(导出 `formatFileSize`);Test `src/lib/media/__tests__/asset-io.test.ts`

- [ ] **Step 1: 移出 `formatFileSize`** —— `assets.ts` 首行是 `"use server"`,该文件**所有导出必须是 async**(否则 build 报 "Server Actions must be async functions")。把 `formatFileSize`(`assets.ts:19` 的纯同步函数)**移到** `src/lib/format.ts`(新建普通模块)并 `export`,再把 `assets.ts:134` 的调用改成 `import { formatFileSize } from "@/lib/format"`。**不要**在 `assets.ts` 原地加 `export`。
- [ ] **Step 2: 写测试**(mock storage + db):`resolveOrgAsset(orgId, id)` 对他 org 资产返回 null;`storeBufferAsAsset` 调 `putObject` + insert mediaAssets 且带 fileSize。
- [ ] **Step 3: 实现**
```ts
// src/lib/media/asset-io.ts
import { promises as fs } from "node:fs";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateDownloadUrl, getPublicUrl, putObject, defaultBucket } from "@/lib/storage";
import { formatFileSize } from "@/lib/format"; // 已从 "use server" 的 assets.ts 移出（Step 1）

// org 作用域解析（绝不用 org-blind getAssetDetailFull）
export async function resolveOrgAsset(orgId: string, assetId: string) {
  return db.query.mediaAssets.findFirst({
    where: and(eq(mediaAssets.id, assetId), eq(mediaAssets.organizationId, orgId)),
  });
}
const MAX_BYTES = 500 * 1024 * 1024;
export async function downloadObjectToFile(objectKey: string, scratchPath: string, ttl = 7200): Promise<void> {
  const url = generateDownloadUrl(objectKey, ttl);
  const head = await fetch(url, { method: "HEAD" });
  const len = Number(head.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error(`输入超出大小上限 ${MAX_BYTES}`);
  const res = await fetch(url);
  await fs.writeFile(scratchPath, Buffer.from(await res.arrayBuffer()));
}
export async function storeBufferAsAsset(buf: Buffer, opts: {
  organizationId: string; slug: string; ext: string; contentType: string;
  type: "video" | "image" | "audio" | "document"; // mediaAssetTypeEnum，非任意 string
  title: string; inputAssetId?: string;
  durationSeconds?: number; width?: number; height?: number;
}): Promise<{ assetId: string; publicUrl: string }> {
  if (buf.byteLength > MAX_BYTES) throw new Error(`输出超出大小上限 ${MAX_BYTES}`);
  const objectKey = `${opts.organizationId}/cli/${opts.slug}/${crypto.randomUUID()}.${opts.ext}`;
  await putObject(objectKey, buf, opts.contentType);
  const publicUrl = getPublicUrl(objectKey);
  const [row] = await db.insert(mediaAssets).values({
    organizationId: opts.organizationId, tosObjectKey: objectKey, tosBucket: defaultBucket,
    fileUrl: publicUrl, type: opts.type, title: opts.title, mimeType: opts.contentType,
    source: `cli_${opts.slug}`, parentVersionId: opts.inputAssetId ?? null,
    fileSize: buf.byteLength, fileSizeDisplay: formatFileSize(buf.byteLength),
    durationSeconds: opts.durationSeconds, width: opts.width, height: opts.height,
  }).returning({ id: mediaAssets.id });
  return { assetId: row.id, publicUrl };
}
// ffprobe 元数据（内部 helper，非 agent 工具）
export async function probeMedia(path: string): Promise<{ durationSeconds?: number; width?: number; height?: number }> { /* execFile ffprobe -v quiet -print_format json -show_streams -show_format */ }
```
> 复核 `mediaAssets` 实际列名(tosObjectKey/fileUrl/fileSize/fileSizeDisplay/durationSeconds/width/height/source/parentVersionId,见 `src/db/schema/media-assets.ts`)。
- [ ] **Step 4: PASS + tsc + Commit** `feat(media): CLI 文件 I/O helper（org 解析/下载/上传建资产/ffprobe）`

### Task M3.5: spawn 封装 + scratch

**Files:** Create `src/lib/cli/scratch.ts`, `src/lib/cli/spawn.ts`;Test `src/lib/cli/__tests__/spawn.test.ts`

- [ ] **Step 1: scratch** —— `mkdtemp(os.tmpdir())` + `withScratchDir(fn)`(try/finally `rm -rf`)。
- [ ] **Step 2: 写测试**(用一个无害命令,如 `node -e "process.stdout.write('ok')"`,或注册测试桩):验证 ① 退出码捕获 ② 超时 kill ③ stderr 截断捕获。
- [ ] **Step 3: 实现 `runCli`**
```ts
// src/lib/cli/spawn.ts
import { spawn } from "node:child_process";
export function runCli(command: string, argv: string[], opts: { cwd: string; timeoutMs: number }):
  Promise<{ exitCode: number; stderrTail: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, { cwd: opts.cwd, shell: false }); // ★ shell:false
    let stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("CLI 超时")); }, opts.timeoutMs);
    child.stderr.on("data", (d) => { stderr = (stderr + d.toString()).slice(-4000); });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ exitCode: code ?? -1, stderrTail: stderr }); });
  });
}
```
- [ ] **Step 4: PASS + tsc + Commit** `feat(cli): spawn(shell:false) 封装 + scratch 目录纪律`

### Task M3.6: `createCliToolset` —— 同步路径 + 注入

**Files:** Create `src/lib/cli/toolset.ts`, `src/lib/dal/cli-tools.ts`;Modify `tool-registry.ts`(加 `cliTools?` 槽)+ 4 调用点;Test `src/lib/cli/__tests__/toolset.test.ts`

- [ ] **Step 1: DAL** `listEnabledCliTools(orgId)` / `getCliToolById(orgId,id)`(org 作用域)+ `insertCliToolRun` / `updateCliToolRun`。
- [ ] **Step 2: `toVercelTools` 加 `cliTools?: ToolSet` 槽**(M2.3 同款合并循环;测试同 M2.3)。
- [ ] **Step 3: `createCliToolset(orgId)`** —— 读 enabled cli_tools,每条生成一个 AI SDK `tool({ description, inputSchema(由 argsSchema 转 zod), execute })`,工具名 `cli__{slug}`:
  - `execute` 内:`validateParams` → 若含 asset 参数 `resolveOrgAsset` → **sync 模式**:`withScratchDir` 下载输入 + `assertAllowedBinary` + `resolveArgv` + `runCli`(`syncTimeoutMs`)+ 上传产物 `storeBufferAsAsset` + 写 `cli_tool_runs(done)` → 返回 `{success, assetId, publicUrl}`;**async 模式**:见 M3.8(本步先只实现 sync,async 抛"未实现"占位或直接进 M3b)。
- [ ] **Step 4: 4 调用点传 `cliTools`**(与 `mcpTools` 并列;注意:CLI 工具是同进程/或入队,无需 close,但与 mcp.close 并存)。建议:wiring 处 `const cli = await createCliToolset(orgId)`,传 `cli.tools`。
- [ ] **Step 5: 门控** —— 在 `assembly.ts` 或注入处按 `toolClass` 过滤(write 类仅 executor/coordinator)。复核现有 `authorityLevel` 注入点,CLI/MCP 工具走同一 read/write 分类。
- [ ] **Step 6: tsc + 手验**(注册一个 sync 探测工具如 `ffprobe` 取时长,对话里触发)+ **Commit** `feat(cli): createCliToolset 同步路径 + toVercelTools cliTools 槽 + 4 调用点`

### Task M3.7: CLI 工具管理 UI

**Files:** Create actions `src/app/actions/cli-tools.ts`(create/update/toggle/test-run)+ 能力中心「CLI 工具」区页面

- [ ] **Step 1: actions** —— CRUD(requireAuth+org;`command` 过 `assertAllowedBinary`;注册时 `probeBinary`);`testRunCliTool`(挑一个 org 资产同步跑一次)。
- [ ] **Step 2: UI** —— `command` 下拉只列 `allowedBinaries()`;参数 schema 编辑器(JSON 或表单);`<DataTable>` 列工具 + 运行日志(读 `cli_tool_runs`);测试运行按钮。共享 primitive,弹层固定高度。
- [ ] **Step 3: build + Commit** `feat(cli): CLI 工具管理 UI（注册/参数 schema/测试运行/审计日志）`

> **M3a 验收**:注册一个同步 CLI 工具(如 ffprobe),agent 能调、产物/结果回来、`cli_tool_runs` 有记录、注入字符串无法逃逸。

## M3b — 异步执行(Inngest 重活闭环)

### Task M3.8: typed event + `cliRun` durable 函数 + 失败 handler

**Files:** Modify `src/inngest/events.ts`(~:615);Create `src/inngest/functions/cli-run.ts`;Modify `src/inngest/functions/index.ts`(:184)

- [ ] **Step 1: 声明 event**`cli/run.requested`(仿 `media/tingwu-analyze.requested`),payload:`{ organizationId, cliToolId, runId, inputAssetId?, resolvedParams, missionId?, taskId?, conversationId? }`。
- [ ] **Step 2: `cliRun` 函数**(抄 `tingwu-analyze.ts:37` durable 结构,**不抄** aigc-video 自轮询)
```ts
export const cliRun = inngest.createFunction(
  { id: "cli-run", name: "[CLI] 媒体处理", concurrency: { limit: 4, key: "event.data.organizationId" }, retries: 2 },
  { event: "cli/run.requested" },
  async ({ event, step }) => {
    const d = event.data;
    await step.run("mark-processing", () => updateCliToolRun(d.runId, { status: "processing" }));
    const out = await step.run("run-cli", async () => {
      const tool = await getCliToolById(d.organizationId, d.cliToolId);
      return withScratchDir(async (dir) => {
        // resolveOrgAsset + downloadObjectToFile(inputObjectKey, scratchIn)
        // assertAllowedBinary(tool.command); resolveArgv(...); runCli(...);
        // probeMedia(scratchOut); buf = readFile(scratchOut)
        // return storeBufferAsAsset(buf, ...)
      });
    });
    await step.run("surface", () => surfaceCliOutput(d, out)); // 见 M3.9
    await updateCliToolRun(d.runId, { status: "done", outputAssetId: out.assetId, finishedAt: new Date() });
    return { ok: true };
  });
// 失败 handler：on 'inngest/function.failed' 过滤 function_id==='cli-run' → run.status=failed + 失败卡（仿 tingwu-analyze.ts:193）
```
- [ ] **Step 3: 注册** `cliRun` + 失败 handler 进 `functions/index.ts`。 **tsc + Commit** `feat(cli): cli/run.requested event + cliRun durable 函数 + 失败 handler`

### Task M3.9: 产物回流(mission_artifacts + import_card)

**Files:** Create `src/lib/cli/surface.ts`(`surfaceCliOutput`)

- [ ] **Step 1: 实现 surface**
```ts
// 1) 任务台：有 missionId → 直接插 mission_artifacts 行（★ 有 fileUrl，非 workflow_artifacts）
//    db.insert(missionArtifacts).values({ missionId, taskId, fileUrl: publicUrl, metadata:{assetId,kind}, ... })
// 2) cowork：有 conversationId → appendMessage(conversationId, { kind:"import_card", content, meta:{assetId, fileUrl} })
// 3) 都无：仅 media_asset 落库（素材库可见）
```
> ⚠ 复核 `mission_artifacts` 列(`missions.ts:182`,`fileUrl` :196)、`appendMessage` 签名(`dal/cowork-conversations.ts`)、`conversationId` 经 event payload 传入(不在 ToolContext)。
- [ ] **Step 2:** `createCliToolset` 的 async 模式 execute:`insertCliToolRun(queued)` → `inngest.send({ name:"cli/run.requested", id: runId, data })` → 返回 `{ success:true, status:"queued", runId, message:"已提交，完成后产物出现在产出区" }`(照抄 `tingwu_analyze` tool-registry.ts:2176)。tool 的 inputSchema 声明 `organizationId/missionId/taskId`(wrapToolExecuteWithContext 注入)+ `conversationId`(若需 cowork 回流)。
- [ ] **Step 3: tsc + 手验**(注册 ffmpeg 转码工具,对话里"把这个视频转成 gif" → 队列 → 产物出现在任务台/素材库)+ **build + Commit** `feat(cli): 异步产物回流（mission_artifacts + import_card）+ ffmpeg 闭环`

> **M3 验收**:ffmpeg 转码端到端跑通(自托管容器需装 ffmpeg/ffprobe + 配 `CLI_ALLOWED_BINARIES`);`cli_tool_runs` 状态流转;产物入素材库 + 任务台 SSE 可见;失败置 failed + 卡片;大文件超限被拒;注入无法逃逸。`npm run build` 过。

---

## 部署前置(运维)
- 自托管 Node 容器镜像装 `ffmpeg`/`ffprobe`(及其他要登记的 binary),确认在 PATH。
- 配 env:`CLI_ALLOWED_BINARIES`、`VIBETIDE_MCP_ENABLED`、`VIBETIDE_CLI_TOOLS_ENABLED`、真实 `PLUGIN_ENCRYPTION_KEY`、`STORAGE_PROVIDER` + 桶可用(public-read 或用 generateDownloadUrl)。
- Inngest worker 是长驻 Node host(非 edge);生产 `npm run db:migrate` + `verify-schema-sync.sh`。

## 测试总览(对齐 spec §9)
- MCP:工具前缀/降级/下线/close(M2.2)。
- argv 安全:注入字符串单元素、enum 越界、缺 required、数值/regex(M3.3,**最关键**)。
- 文件 I/O:跨 org 读拒绝、storeBufferAsAsset 往返 + 元数据、scratch 清理(M3.4/M3.5)。
- 异步闭环:状态流转、mission_artifacts.fileUrl SSE 出现、失败卡(M3.8/M3.9)。
- 集成:真 ffmpeg 小样片(CI 装 ffmpeg)。
