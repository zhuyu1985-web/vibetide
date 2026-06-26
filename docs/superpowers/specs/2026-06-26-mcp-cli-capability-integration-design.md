# MCP(消费侧)+ CLI(触发入口)接入 · 设计文档

- **日期**: 2026-06-26
- **作者**: zhuyu / claude
- **状态**: 设计已拍板,待 spec review → 实现计划
- **关系**: 本文把 [2026-06-18 能力与集成中心 spec](2026-06-18-domain-form-first-class-and-capability-center-design.md) 的 §7(MCP)/§8(CLI)**抽出来独立成可实现设计**,脱离该 spec 的「领域/形态」两块(那两块单独推进)。本文已按当前代码逐处对齐——原 spec 写于代码变更前,部分锚点已漂(如 `toVercelTools` 原标 :2817、实为 :2845),以本文为准。

> **实现纪律提醒**:下文所有 `file:line` 是写作时(2026-06-26)的锚点,实现前**逐处 grep 符号名复核**,不要照搬行号。Schema 变更走 Drizzle 标准流程(`npm run db:generate` → `db:migrate`),禁手工 SQL(CLAUDE.md 纪律)。

---

## 1. 背景与现状

### 1.1 "现在只能接 SKILL" 这个判断要修正

当前 agent 的可调工具其实有 **3 类来源**,SKILL 只是其一的"壳":

1. **内置 tool**:`ALL_TOOLS`(15 个),`createToolDefinitions()`(`src/lib/agent/tool-registry.ts`)产出的 AI SDK v6 `tool({inputSchema, execute})`,**module 加载期同步单例**。
2. **plugin 型 skill**:`skills.type='plugin'` 的行携带 `pluginConfig`(一个 HTTP 端点),`createPluginTool` 外调——**系统现在就已能把外部能力作为 tool 接进来**,只是单端点、单 tool。
3. **运行期动态注入**:`kb_search`(`createKnowledgeBaseTools`)、mission 协作工具,执行时 lazy 生成。

一个 **SKILL = 元数据 + prompt,不含可执行码**(`src/db/schema/skills.ts`)。`slug` 同时挂 `SKILL.md`(进 prompt 第 2/2.5 层)与一个**可选**同名 tool;~47 个 SKILL.md 仅 15 个有真 tool,其余是纯 prompt 行为。

### 1.2 MCP / CLI 现状

- **MCP**:全库 0 集成、0 依赖,无 `mcp_servers` 表。`ai@6.0.116` 的 `exports` 无 `mcp` 子路径,`createMCPClient` 在核心包不存在;`@ai-sdk/mcp` 与 `@modelcontextprotocol/sdk` 均未安装。
- **CLI**:无正式入口。仅 `scripts/` 下零散 tsx 脚本手工跑,无 `bin`/`commander`。

### 1.3 关键运行时事实(决定方案边界)

- **跑 agent 的模型**:DeepSeek over OpenAI 兼容端点(`model-router.ts` `getDeepSeekClient().chat()`,env `LLM_PROVIDER` 可切 DashScope/Zhipu)。OpenAI 兼容 API 支持 `tool_calls`,整条 registry 已作为 function tools 经 `generateText` 工作 → **LLM loop 一旦拿到 MCP 转出的 ToolSet 即可调用,无需换 provider**。
- **无服务端 sandbox**:工具执行跑在 Next.js server actions / Inngest worker 内,**零进程隔离**。任何 `child_process` spawn(stdio-MCP、shell-exec CLI)都是净新增安全面 → 本设计**全部规避**。

---

## 2. 范围与非目标

### 2.1 范围(安全内圈)

| 维度 | 本期 | 明确不做(留后) |
|---|---|---|
| MCP transport | **仅 http**(`createMCPClient({transport:{type:'http'}})`) | stdio(需服务端 spawn + sandbox) |
| MCP 方向 | **消费侧**(连外部 MCP server 拉 tool 进来) | 把本系统工具暴露为 MCP server |
| MCP 授权粒度 | **org 全员 + read/write 门控**(拍板) | per-employee 绑定(§9 演进路径) |
| CLI 定位 | **触发入口**(跑 mission / skill) | shell-exec **能力**(LLM 调任意 shell,无 sandbox) |

### 2.2 不改

- `executeAgent` 的 `generateText + stepCountIs(20)` 主 loop(`src/lib/agent/execution.ts`)。
- `buildSystemPrompt` 的 7 层结构(MCP 工具走执行层注入,**不进 prompt 文本**)。
- `skills.kind`(tool|skill)语义 —— **MCP 不是新 kind,是工具的 source**。
- `authorityLevel` 门控既有逻辑、`assembleAgent` 签名(不串 orgId,见 §5)。

---

## 3. 数据模型

### 3.1 新增 `mcp_servers`(org 级)

```ts
// src/db/schema/mcp-servers.ts（新增）
export const mcpServers = pgTable("mcp_servers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),                 // 展示名 + tool 命名空间前缀来源
  slug: text("slug").notNull(),                 // sanitize 后用于 mcp__{slug}__{tool}
  url: text("url").notNull(),                    // http MCP endpoint（过 validatePluginUrl）
  encryptedHeaders: text("encrypted_headers"),   // 认证头 JSON，crypto.ts 加密存（非明文）
  defaultToolClass: text("default_tool_class").notNull().default("write"), // 'read' | 'write'
  connectTimeoutMs: integer("connect_timeout_ms").notNull().default(8000),
  enabled: integer("enabled").notNull().default(1),
  // 诊断/展示
  lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
  lastError: text("last_error"),
  toolCount: integer("tool_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("mcp_servers_org_name_uidx").on(t.organizationId, t.name)]);
```

### 3.2 可选 `mcp_server_tools`(发现缓存 + 单 tool 分类覆写)

```ts
// 缓存某 server 暴露的 tool 清单，供「工具区」展示来源 + 运营把个别 read 工具放宽给 advisor
export const mcpServerTools = pgTable("mcp_server_tools", {
  id: uuid("id").defaultRandom().primaryKey(),
  mcpServerId: uuid("mcp_server_id").references(() => mcpServers.id, { onDelete: "cascade" }).notNull(),
  toolName: text("tool_name").notNull(),         // MCP 原始 tool 名
  namespacedName: text("namespaced_name").notNull(), // mcp__{slug}__{tool}
  description: text("description"),
  toolClass: text("tool_class"),                 // null=继承 server.defaultToolClass；'read'|'write'=覆写
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("mcp_server_tools_uidx").on(t.mcpServerId, t.toolName)]);
```

> **v1 可裁剪**:`mcp_server_tools` 可推迟到 M3——M1/M2 先用 `mcp_servers.defaultToolClass` 整 server 兜底(默认 write)。建表与否不阻塞接入主链路。

### 3.3 CLI

**无任何 schema 变更**。CLI 是入口不是能力。

---

## 4. MCP 集成接缝(核心)

### 4.1 唯一合流点已确认

`toVercelTools(...)`(`src/lib/agent/tool-registry.ts:2845`)是 **5 个用户面共用的 ToolSet 合流函数**:

| 用户面 | 调用点(写作时锚点) | 备注 |
|---|---|---|
| 自由对话 | `src/app/api/chat/stream/route.ts` `baseTools`(~:160) | cowork 对话中心 |
| mission 执行 | `src/lib/agent/execution.ts` `executeAgent`(~:239) | DAG 多步 |
| intent-execute | `src/app/api/chat/intent-execute/route.ts`(~:264) | 服务端预执行 + 短路 |
| 场景执行 | `src/app/api/scenarios/execute/route.ts`(~:161) | 轻量场景 |
| 钉钉 / IM | → `executeMissionDirect`(`src/lib/mission-executor.ts:2248`)→ mission 执行路径 | 无独立 LLM 调用 |

**结论**:在 `toVercelTools` 内合并 + 在上表这 **4 个生产调用点** wiring,**5 个用户面统一可见**,对话中心不掉队。

> ⚠ **第 5 个 `toVercelTools` 调用点(明确划出本期范围)**:`testSkillExecution`(`src/app/actions/employee-advanced.ts:431`)是技能测试/预览 harness,**故意传 `organizationId: undefined` 以屏蔽写操作**。它非生产路径,且无 orgId 时 MCP 写类工具本就被门控掉 → **不接入 MCP**(若要让测试预览也看到 MCP 工具,可后续单独接,但需谨慎处理无 org 上下文)。所以全量 `toVercelTools` 调用点是 **5 个,本期接 4 个生产面**,这一个显式排除。

> ⚠ **不经 `toVercelTools` 的 LLM 调用**(`/api/ai/*`、`workflows/generate`、`clarify-or-plan` 等)本就无外部工具或自建 inline ToolSet,**不在本期覆盖**——它们是分析/规划用途,不需要 MCP 工具。这是已知且可接受的边界。

### 4.2 三处改动

**① 新工厂 `createMcpToolset(orgId)`**(tool-registry.ts 内,仿 `createKnowledgeBaseTools` ~:2652 的 lazy 模式)

```ts
// 伪代码——实现锚点
export async function createMcpToolset(organizationId: string): Promise<{
  tools: ToolSet;
  close: () => Promise<void>;
}> {
  const servers = await listEnabledMcpServers(organizationId); // DAL
  const clients: Array<{ close: () => Promise<void> }> = [];
  const tools: ToolSet = {};

  await Promise.all(servers.map(async (s) => {
    try {
      const client = await createMCPClient({
        transport: { type: "http", url: s.url, headers: decryptHeaders(s.encryptedHeaders) },
        // per-server 超时：用 AbortSignal.timeout(s.connectTimeoutMs) 包裹握手
      });
      clients.push(client);
      const raw = await client.tools(); // AI SDK ToolSet（自动 MCP→AI SDK 转换）
      for (const [name, def] of Object.entries(raw)) {
        const ns = sanitize(`mcp__${s.slug}__${name}`); // ^[a-zA-Z0-9_-]+$
        tools[ns] = def;
      }
      await markServerConnected(s.id, Object.keys(raw).length); // lastConnectedAt + toolCount
    } catch (e) {
      await markServerError(s.id, String(e)); // 降级不阻断：跳过该 server，记 lastError
    }
  }));

  return { tools, close: async () => { await Promise.allSettled(clients.map(c => c.close())); } };
}
```

要点:
- **依赖**:仅 `@ai-sdk/mcp` 的 `createMCPClient`(http transport **不需要** `@modelcontextprotocol/sdk`)。`import { createMCPClient } from "@ai-sdk/mcp"`。
- **命名空间化 + sanitize**:`mcp__{slug}__{tool}` 防与 15 个内置 slug 及 server 间碰撞;"来源"列直接解析前缀。
- **降级不阻断**:单 server 失败/超时 → 跳过 + 记 `lastError`,绝不拖垮整次装配(对齐原 spec §11)。
- **生命周期**:client 异步连接,**用完必须 `close()`**。

**② `toVercelTools` 加第 6 槽 `mcpTools?: ToolSet`**

在现有 kbTools 合并循环(~:2890-2897)后镜像合并一遍——每个 MCP tool 仍过 `wrapToolExecuteWithContext`(~:2806)拿到 `organizationId`/`operatorId`。保持空 context 时的早返回引用相等性。

**③ 4 个调用点 wiring**

每处:
```ts
const mcp = await createMcpToolset(orgId);
const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs, missionTools, kbTools, mcpTools = mcp.tools, context);
// LLM 调用的 onFinish / onError(streamText)或 finally(generateText)里：
await mcp.close();
```

- `execution.ts`(generateText):`try/finally` 关闭。
- 三个 streaming route(streamText):`onFinish` + `onError` 关闭(参 AI SDK MCP cookbook 标准写法)。

### 4.3 性能注记

http MCP 为**每次 agent 运行建连一次**(连接握手 + `tools()` 往返)。v1 接受此成本;若热点 server 成为瓶颈,后续可引入「org 级 client 连接池 + tool 列表 TTL 缓存」(独立优化,不进 v1)。`connectTimeoutMs` 默认 8s 防握手卡死。

---

## 5. 权限门控(补原 spec 未覆盖的缺口)

探查发现:`assembleAgent`(`src/lib/agent/assembly.ts`)**没有 `organizationId` 入参**,org 信息只在执行层 `ToolContext` 才进来。故:

- **MCP 工具走执行层注入**(§4.2),**不串 orgId 进 `assembleAgent`** → MCP 工具不进 prompt 文本、不参与 `authorityLevel` 的 observer→`[]` 过滤。这是"安全内圈"的合理取舍:observer 走 mission 本就拿不到工具,read/write 分类已够用。
- **read/write 门控**:MCP 发现的 tool **默认 `write` 类**(保守),`createMcpToolset` 据 `defaultToolClass`/`mcp_server_tools.toolClass` 给每 tool 打标 → 在合并时:
  - write 类:仅当 `context.authorityLevel ∈ {executor, coordinator}` 才并入;
  - read 类:advisor+ 可见(运营在管理页确认安全后把个别工具降为 read)。
- 写类 MCP 工具纳入既有 `WRITE_TOOL_NAMES` dryRun 思路(`tool-registry.ts` ~:2154)。

> **授权粒度拍板**:**org 全员**——某 org `enabled=1` 的 server,其 tool 对该 org 所有非 observer 员工可见,是否能调由 read/write + `authorityLevel` 决定。**不建 `employee_mcp_servers` 绑定表**。per-employee 细粒度作为 §9 演进路径。

---

## 6. 安全

| 关注点 | 措施 |
|---|---|
| SSRF(http MCP URL 指内网) | **复用 `validatePluginUrl`**(`src/lib/plugin-security.ts`:强制 HTTPS + 封 localhost/私网 CIDR),建/改 server 时校验 |
| 认证头泄露 | **走 `crypto.ts` `encrypt/decrypt` 加密存**(`encryptedHeaders`),**非** `channel_configs` 明文路径 |
| 加密钥强度 | ⚠ 标注:生产必须配真 `PLUGIN_ENCRYPTION_KEY`(现 dev fallback 不安全,无 KMS)。本设计沿用既有加密路径,KMS 升级是独立项 |
| 写类工具误操作 | read/write 门控 + 写类沿用 dryRun 白名单;新外部工具默认 write(保守) |
| server 不可用 | per-server `connectTimeoutMs` + 降级跳过(§4.2),不阻断 agent |

---

## 7. CLI(触发入口)

**定位**:与 Web / Inngest / 定时并列的**触发入口**,不是能力。

- `package.json` 加 `bin: { "vibetide": "./dist/cli/index.js" }` + `commander`;CLI 单独 tsc 出 `dist/cli`(`output: standalone` 已具 Node 运行能力)。
- 子命令:
  - `vibetide run-mission <id> --org <id>` → 复用 `executeMissionDirect`(`mission-executor.ts:2248`)。
  - `vibetide run-skill --employee <slug> --skill <slug> --org <id> --input <json>` → **新写**单技能直跑:`assembleAgent` → 构造 `skillSpec` → `executeAgent(context{orgId,operatorId})` → 打印三段式输出。
  - `vibetide list-employees --org <id>` 等只读辅助。
- **Auth 旁路**:复用 `startMissionFromTemplateScheduled`(`src/app/actions/workflow-launch.ts:134`)的「显式接 orgId、跳过 `requireAuth`」模式;CLI 用 `--org` / `--operator` 提供身份,`--org` **必填无默认**(防误操作生产数据)。
- **env**:`dotenv` 读 `.env.local`(检索类工具 API key、CMS env 照常)。
- CLI 运行 agent 时同样经 `executeAgent` → `createMcpToolset` 生效(MCP 工具在 CLI 路径自动可用)。

---

## 8. UI(能力与集成中心 · 落两区)

复用原 spec §6.3「`/skills` 四区」框架,本期落地其中两区:

- **MCP 服务器**区:`mcp_servers` 的 CRUD + **测连**(连一次拉 tool 列表写 `toolCount`/`lastConnectedAt`)+ 展示发现到的 tool 与 read/write 标注 + `enabled` toggle(即时下线)。
- **工具**区加**「来源」列**:内置工具标「内置」,MCP 工具标「MCP · {server.name}」(解析 `mcp__{slug}__` 前缀)。
- **触发入口**区:给 CLI 安装与用法说明(Web/定时已有,API 留位)。

**配置模式参照**:org 级 connector 三件套——`channel_configs`(`src/db/schema/channels.ts`)+ `actions/channels.ts`(create/update/toggle/**test**)+ `/settings/channels` 页。MCP 直接照搬这套形状(`createMcpServer`/`updateMcpServer`/`toggleMcpServer`/`testMcpServer`,均 `requireAuth` + org-ownership 校验)。

**Feature flag**:仿 `src/lib/cms/feature-flags.ts` 的 env 驱动形状 → `isMcpEnabled()`。无 DB 级灰度表(与现状一致)。

---

## 9. 分期落地

| 期 | 内容 | 可独立交付 |
|---|---|---|
| **M1 配置后端 + UI** | `mcp_servers`(+ 可选 `mcp_server_tools`)表 + DAL + server actions(create/update/toggle/**test 连接**,SSRF 校验 + 加密头)+ `/settings/mcp`(或能力中心 MCP 区)+ `isMcpEnabled()` flag | ✅ 纯配置,不碰执行链路 |
| **M2 工具注入** | 装 `@ai-sdk/mcp` + `createMcpToolset` + `toVercelTools` 第 6 槽 + 4 调用点 wiring + 生命周期 close | ✅ 依赖 M1 |
| **M3 门控 + 来源列** | read/write 分类(默认 write,可放宽 read)+ 工具区「来源」列 + `mcp_server_tools` 落地 | ✅ 依赖 M2 |
| **M4 CLI** | `bin` + `commander` + 三子命令(run-mission / run-skill / list-employees)+ tsc dist/cli | ✅ 独立 |

每期一个 commit,`tsc --noEmit` + `npm run build` 必过(CLAUDE.md Git 纪律)。

### 演进路径(不在 v1)

- **per-employee MCP 绑定**:需要更细授权时,加 `employee_mcp_servers` 绑定表(仿 `employee_skills`/KB 绑定),在 `createMcpToolset` 加 employeeId 过滤。
- **stdio transport** + **shell-exec CLI 能力**:需先建服务端 sandbox / 信任模型,届时再开。
- **暴露本系统工具为 MCP server**(生产侧)。
- **client 连接池 + tool 列表 TTL 缓存**(性能优化)。

---

## 10. 测试考量

- **`createMcpToolset` 单测**:mock 一个 http MCP server(可用本地 in-memory MCP server),验证 ① tool 注册进 ToolSet 且前缀正确 ② 单 server 超时/失败被跳过、其余正常 ③ `enabled=0` 不拉取 ④ `close()` 被调用。
- **门控单测**:write 类对 advisor 不可见、对 executor 可见;read 覆写后 advisor 可见。
- **wiring 集成**:4 个调用点各确认 MCP 工具进入最终 ToolSet 且生命周期 close 被触发(尤其 streamText 的 onFinish/onError)。
- **SSRF/加密**:`validatePluginUrl` 拒内网 URL;`encryptedHeaders` 往返解密正确。
- **CLI**:`run-skill` 端到端脱 Web、显式 orgId、三段式输出;`--org` 缺失报错。

---

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| `@ai-sdk/mcp` 包名 / API 误用 | 已核实(Context7,2026-06-26):`import { createMCPClient } from "@ai-sdk/mcp"`,http 用 `{transport:{type:'http',url,headers}}`,`await client.tools()`,`await client.close()`。**非** `experimental_` 前缀、**非** `ai` 核心导出 |
| MCP client 未 close 致连接泄漏 | 4 调用点强制在 finally / onFinish+onError close;`Promise.allSettled` 防单点失败漏关其余 |
| MCP 工具名碰撞内置 slug | `mcp__{slug}__{tool}` 命名空间 + sanitize;合并顺序确保内置工具不被外部覆盖(MCP 后并入但带前缀,天然不撞) |
| 新外部工具默认无门控 | 默认 `write` 类(仅 executor/coordinator),运营显式放宽 read |
| 慢 / 挂的 MCP server 拖垮每次装配 | per-server `connectTimeoutMs`(默认 8s)+ 降级跳过 + `Promise.all` 并发拉取 |
| 不经 `toVercelTools` 的 LLM 路径无 MCP 工具 | 明确边界(§4.1):`/api/ai/*` 等为分析/规划用途,本期不覆盖 |
| 生产加密钥弱 | 标注 `PLUGIN_ENCRYPTION_KEY` 必配真值;KMS 升级独立项 |

---

## 附:关键文件索引(实现锚点 · 实现前复核行号)

| 改动 | 文件:symbol |
|---|---|
| ToolSet 合流(加第 6 槽) | `src/lib/agent/tool-registry.ts` `toVercelTools`(~:2845)、`wrapToolExecuteWithContext`(~:2806) |
| MCP 工厂(仿 KB) | `src/lib/agent/tool-registry.ts` `createMcpToolset`(新增,仿 `createKnowledgeBaseTools` ~:2652) |
| 调用点 ①执行 | `src/lib/agent/execution.ts` `executeAgent`(~:239 `toVercelTools` 调用) |
| 调用点 ②自由对话 | `src/app/api/chat/stream/route.ts`(~:160) |
| 调用点 ③intent-execute | `src/app/api/chat/intent-execute/route.ts`(~:264) |
| 调用点 ④场景 | `src/app/api/scenarios/execute/route.ts`(~:161) |
| 钉钉/IM(经 mission) | `src/lib/mission-executor.ts` `executeMissionDirect`(:2248) |
| SSRF 校验复用 | `src/lib/plugin-security.ts` `validatePluginUrl` |
| 凭据加密复用 | `src/lib/crypto.ts` `encrypt`/`decrypt`(env `PLUGIN_ENCRYPTION_KEY`) |
| connector 配置模板 | `src/db/schema/channels.ts`(~:22)+ `src/app/actions/channels.ts`(create/update/toggle/test) |
| Feature flag 模板 | `src/lib/cms/feature-flags.ts`(`isMcpEnabled()` 仿此) |
| CLI Auth 旁路模式 | `src/app/actions/workflow-launch.ts` `startMissionFromTemplateScheduled`(:134) |
| CLI 单技能直跑 | `src/lib/agent/assembly.ts` `assembleAgent` + `src/lib/agent/execution.ts` `executeAgent` |
