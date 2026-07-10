# 外部能力接入(HTTP-MCP + 注册式 CLI 工具)· 设计文档

- **日期**: 2026-06-26(2026-06-26 重写:CLI 从"触发入口"修正为"注册式能力来源")
- **作者**: zhuyu / claude
- **状态**: 设计已拍板,待 spec review → 实现计划
- **关系**: 取代 [2026-06-18 能力与集成中心 spec](2026-06-18-domain-form-first-class-and-capability-center-design.md) §7/§8,脱离其「领域/形态」两块。已按当前代码逐处对齐(原 spec 写于代码变更前,锚点已漂)。

> **实现纪律**:下文 `file:symbol/line` 是 2026-06-26 锚点,实现前**逐处 grep 符号名复核**,勿照搬行号。Schema 变更走 Drizzle 标准流程(`npm run db:generate` → `db:migrate`),禁手工 SQL。

---

## 1. 核心定位修正

**一句话**:本系统现在只能接 SKILL(元数据+prompt)与同进程内置 tool;本设计让 agent 能**调用外部能力**,有两种来源:

| 来源 adapter | 调用方式 | 起服务端子进程? | 典型能力 | 本期 |
|---|---|---|---|---|
| **HTTP-MCP** | HTTP 请求 | ❌ | 云端 MCP server | ✅ |
| **注册式 CLI 工具** | `child_process.spawn` | ✅(须管控) | `ffmpeg` / `yt-dlp` / 剪映 CLI 等 | ✅ |
| ~~stdio-MCP~~ | 子进程 stdin/stdout | ✅ | 打包成 MCP 的本地 CLI | ❌ 延后 |
| ~~通用 shell-exec~~ | 任意命令 | ✅ | — | ❌ **永不做**(逃逸风险) |
| ~~CLI 触发入口~~ | 人/脚本启动系统 | — | — | ❌ 删除(非本需求) |

**两条铁律(来自需求方拍板)**:
1. **CLI 是能力不是入口** —— agent 调用 CLI 程序,不是"从命令行把系统跑起来"。
2. **只跑注册在系统里的命令,绝不允许任意 shell** —— 运营登记 `command + 参数 schema`,agent 只能在登记范围内驱动,无法逃逸成任意执行(§6 安全模型)。

**统一抽象**:两种来源都在 `toVercelTools`(`src/lib/agent/tool-registry.ts:2845`)的工具来源槽汇合,5 个用户面统一可见。

---

## 2. 范围与非目标

### 2.1 范围
- **MCP**:仅 http transport 消费侧(连外部 MCP server 拉 tool 进来)。
- **CLI**:注册式白名单工具,argv 安全模型,同步(快命令)+ 异步(重命令走 Inngest)双执行域,文件 I/O 桥接现有 media-assets。
- **授权**:org 全员 + read/write 门控(拍板,不建 per-employee 绑定表)。

### 2.2 非目标
- 不做 stdio-MCP、不做通用 shell-exec、不做 CLI 命令行入口。
- 不把本系统工具暴露为 MCP server(生产侧,留后)。
- 不改 `executeAgent` 主 loop、7 层 prompt 结构、`skills.kind` 语义、`assembleAgent` 签名(不串 orgId,见 §5)。

---

## 3. 统一接缝(MCP 与 CLI 共用)

探查确认:`toVercelTools`(`tool-registry.ts:2845`)是 **5 个用户面唯一 ToolSet 合流函数**:

| 用户面 | 生产调用点 |
|---|---|
| 自由对话 | `src/app/api/chat/stream/route.ts`(~:160) |
| mission 执行 | `src/lib/agent/execution.ts` `executeAgent`(~:239) |
| intent-execute | `src/app/api/chat/intent-execute/route.ts`(~:264) |
| 场景执行 | `src/app/api/scenarios/execute/route.ts`(~:161) |
| 钉钉 / IM | → `executeMissionDirect`(`src/lib/mission-executor.ts:2248`)→ mission 路径 |

> ⚠ 第 5 个 `toVercelTools` 调用点 `testSkillExecution`(`src/app/actions/employee-advanced.ts:431`)是技能测试 harness,传 `organizationId: undefined`,**显式排除**(无 org 上下文,外部能力本就该屏蔽)。
> ⚠ 不经 `toVercelTools` 的 LLM 调用(`/api/ai/*` 等)是分析/规划用途,**不覆盖**。

**改动**:`toVercelTools` 加两个来源槽 `mcpTools?: ToolSet` 与 `cliTools?: ToolSet`(镜像现有 kbTools 合并循环 ~:2890,各自过 `wrapToolExecuteWithContext` ~:2806 拿 orgId/operatorId/missionId/taskId);4 个生产调用点各 `await` 两个工厂并传入。

---

## 4. MCP 集成(http 消费侧)

### 4.1 数据模型 `mcp_servers`(org 级)
```ts
// src/db/schema/mcp-servers.ts（新增）
mcpServers = pgTable("mcp_servers", {
  id, organizationId(FK,notNull),
  name, slug,                          // tool 命名空间前缀
  url,                                  // http MCP endpoint（过 validatePluginUrl 防 SSRF）
  encryptedHeaders,                     // 认证头，crypto.ts 加密存（非明文）
  defaultToolClass: text.default("write"), // 'read' | 'write'
  connectTimeoutMs: integer.default(8000),
  enabled: integer.default(1),
  lastConnectedAt, lastError, toolCount,
  createdAt,
}, uniqueIndex(org, name))
```

### 4.2 工厂 `createMcpToolset(orgId)`(仿 `createKnowledgeBaseTools` ~:2652)
- 读 org `enabled=1` 的 server → 逐个 `createMCPClient({ transport:{ type:"http", url, headers: decrypt(...) }})`(包 `@ai-sdk/mcp`,**非** `experimental_` 前缀、**非** `ai` 核心导出;http 不需 `@modelcontextprotocol/sdk`)→ `await client.tools()`。
- **命名空间**:每个 tool 重命名 `mcp__{slug}__{tool}` 并 sanitize `^[a-zA-Z0-9_-]+$`,防与 15 内置 slug 及彼此碰撞。
- 返回 `{ tools, close }`;单 server 失败/超时 → 跳过 + 记 `lastError`,降级不阻断。
- **生命周期**:client 异步连接,用完 `await close()`(`Promise.allSettled`)。4 调用点在 `onFinish`/`onError`(streamText)或 `finally`(generateText)关闭。

> API 已经 Context7 核实:`import { createMCPClient } from "@ai-sdk/mcp"`;`createMCPClient({transport:{type:'http',url,headers}})`;`await client.tools()`;`await client.close()`。

---

## 5. CLI 能力(注册式工具)——本设计核心

### 5.1 数据模型

**`cli_tools`(org 级,登记一个可调命令)**
```ts
// src/db/schema/cli-tools.ts（新增）
cliTools = pgTable("cli_tools", {
  id, organizationId(FK,notNull),
  name, slug,                  // agent 看到的工具名：cli__{slug}
  description,                 // 给 LLM：这工具干嘛、何时用、参数含义
  command: text,               // 白名单二进制名（须 ∈ CLI_ALLOWED_BINARIES，§6①）
  argsSchema: jsonb,           // 参数定义：每个字段 type/enum/min/max/regex/required
  argvTemplate: jsonb,         // 参数→argv 数组映射（token 数组，§6③）
  executionMode: text,         // 'sync'（快命令，秒级）| 'async'（重命令→Inngest）
  syncTimeoutMs: integer.default(20000),  // sync 模式硬超时
  outputKind: text,            // 'media_asset'（产物入素材库）| 'text'（stdout 直返）
  toolClass: text.default("write"), // read|write 门控
  enabled: integer.default(1),
  createdAt,
}, uniqueIndex(org, slug))
```

**`cli_tool_runs`(每次执行的审计 + 异步状态,补 AIGC 缺的 durable 状态)**
```ts
cliToolRuns = pgTable("cli_tool_runs", {
  id, organizationId, cliToolId(FK),
  status: text,                // 'queued'|'processing'|'done'|'failed'
  inputAssetId, outputAssetId, // media_asset 引用
  argvResolved: jsonb,         // 实际跑的 argv（审计：能复盘 agent 让它跑了什么）
  exitCode, errorMessage, stderrTail,
  missionId, taskId, conversationId, // 产物回流定位
  jobId: text,                 // Inngest 去重 id
  createdAt, finishedAt,
}, index(org, cliToolId), index(jobId))
```
> `cli_tool_runs` 同时是**安全审计表** —— 每条记录都能复盘"哪个员工、让哪个命令、跑了什么 argv、产出什么",对一个会起子进程的能力是必须的。

### 5.2 执行域:同步快路径 / 异步重路径

| 模式 | 何时 | 在哪跑 | execute() 行为 |
|---|---|---|---|
| **sync** | 快命令(探测时长/格式,秒级) | agent 所在进程(server action / Inngest worker) | 直接 spawn,`syncTimeoutMs` 硬超时,同 turn 返回结果 |
| **async** | 重命令(ffmpeg 转码/剪辑) | **独立 Inngest job** | 入队 + 立刻返回 `{status:"queued", runId}`,产物后台回写 |

**async 是 ffmpeg 这类的主路径**(同步会拖垮 agent loop / 撞 `AGENT_TIMEOUT_MS`)。注册时 `executionMode` 决定;重命令必须 `async`。

### 5.3 异步链路(抄 durable tingwu 模式,**不抄** aigc-video 的进程内自轮询)

```
agent 调 cli__ffmpeg_transcode
  → tool execute()：校验参数 → 建 cli_tool_runs(status=queued)
     → inngest.send({ name:"cli/run.requested", id: runId, data:{ orgId, cliToolId, inputAssetId,
                       resolvedParams, missionId?, taskId?, conversationId? }})
     → return { success:true, status:"queued", runId, message:"已提交，完成后产物出现在产出区" }
        （照抄 tingwu_analyze 工具 tool-registry.ts:2176-2210 的 fire-and-return；status 用 "queued" 对齐 cli_tool_runs 枚举，刻意区别于 tingwu 的 "submitted" 字面量）
  ┄┄┄┄ Inngest 后台 ┄┄┄┄
  cliRun = inngest.createFunction(
    { id:"cli-run", concurrency:{ limit:N, key:"event.data.orgId" }, retries:2 },  // CLI 可重跑、幂等
    { event:"cli/run.requested" },
    async ({event, step}) => {
      step.run("mark-processing") → cli_tool_runs.status=processing
      step.run("fetch-input")  → 见 §5.4 输入
      step.run("run-cli")      → spawn（§6 安全）+ scratch 目录 + 退出码/stderr
      step.run("store-output") → 见 §5.4 输出 → outputAssetId
      step.run("surface")      → 见 §5.5 产物回流
      → cli_tool_runs.status=done
    })
  // 失败 handler：sibling on 'inngest/function.failed' 过滤 function_id==='cli-run'
  //   → cli_tool_runs.status=failed + 回流失败卡（仿 tingwu-analyze.ts:193-213）
```
- **typed event** `cli/run.requested` 声明在 `src/inngest/events.ts`(仿 `media/tingwu-analyze.requested` :615),`src/inngest/client.ts` 的 `EventSchemas().fromRecord<InngestEvents>()` 自动绑定。
- **注册** `cliRun` + 失败 handler 进 `src/inngest/functions/index.ts` 的 `functions` 数组(:184)。
- 若 CLI 是 fire-and-poll 型(对方异步),用 tingwu durable poll(`step.sleep`+`step.run` 退避 `tingwu-analyze.ts:19-99`)抗 worker 重启。ffmpeg 是 run-to-completion,直接 `step.run("run-cli")` 包 spawn。

### 5.4 文件 I/O(桥接 media-assets + 存储 provider)

**输入**(media_asset → scratch 文件):
1. `getAssetDetailFull(inputAssetId)`(`src/lib/dal/assets.ts:493`)取 `tosObjectKey`/`mimeType`。⚠ **该函数无 org 校验** —— job 必须自行 `eq(mediaAssets.organizationId, orgId)` 防跨租户。
2. `generateDownloadUrl(tosObjectKey, ttl)`(`src/lib/storage/index.ts:27`,预签名 GET,私有桶可用;ttl 给足慢任务)。
3. **新增** `downloadObjectToFile(objectKey, scratchPath)` 共享 helper(当前无,各处重复 `fetch`+`arrayBuffer`,见 `aigc/store-media.ts:26-28`):大文件加 HEAD content-length 上限(抄 `article-video-ingest.ts:14` `MAX_VIDEO_BYTES=500MB` + :62 HEAD 检查),或流式 `fetch→createWriteStream`。

**输出**(scratch 文件 → 新 media_asset):
1. **新增** `storeBufferAsAsset(buffer, contentType, meta)`(现有 `storeRemoteMediaToTos` `aigc/store-media.ts:13` 只吃远程 URL、MediaType 不含 doc,**不能直接用**;泛化其 :30-48):
   - objectKey = `${orgId}/cli/${cliToolSlug}/${crypto.randomUUID()}.${ext}`
   - `putObject(objectKey, buf, contentType)`(`index.ts:35`,单次预签名 PUT,**无 multipart** → 大输出注意 OOM/上限,沿用 500MB guard)
   - `getPublicUrl(objectKey)`(`index.ts:32`)
   - `db.insert(mediaAssets).values({ organizationId, tosObjectKey, tosBucket: defaultBucket, fileUrl, type, mimeType, source:"cli_<slug>", parentVersionId: inputAssetId, fileSize, fileSizeDisplay, durationSeconds/width/height })`
2. **媒体元数据**:`media_assets` 的 `fileSize/width/height/durationSeconds` 由一次 **ffprobe pass** 填(`storeRemoteMediaToTos` 漏填这些);`formatFileSize`(`src/app/actions/assets.ts:19`,现 file-private)需导出或复制。ffprobe 是内部 helper,**非** agent 可见工具。

**scratch 纪律**(全库 0 先例,从零建):`os.tmpdir()` + `fs.mkdtemp` 每 run 一目录;`finally` 清理;CLI 只能读写该目录(§6④)。

### 5.5 产物回流(两条面,**注意表分叉**)

CLI job 完成后**始终**产出一个 `media_asset`(素材库可见);此外按上下文双面回流:

1. **任务台(实时)**:若有 `missionId` → **直接插 `mission_artifacts` 行**(`src/db/schema/missions.ts:182`,该表**有** `fileUrl` :196 + `metadata` :197),`dal/missions.ts:182` 映射为 `MissionArtifact`,`use-mission-live.ts` 的 SSE(`/api/missions/[id]/progress`)自动刷新,无需重载即现。
   > ⚠ **不要用 `insertWorkflowArtifact`**(`dal/workflow-artifacts.ts:34`)—— 它写的是另一张 `workflow_artifacts` 表(`workflows.ts:184`),**没有 `fileUrl` 列**,媒体 URL 显示不出来。任务台的 `fileUrl` 来自 `mission_artifacts`。
2. **cowork 会话(卡片)**:若有 `conversationId` → `appendMessage(conversationId, { kind:"import_card", content, meta })`(`dal/cowork-conversations.ts`,仿 `tingwu-analyze.ts:181`),`conversation-thread.tsx:368` 渲染 `<ImportCard>`。
   > ⚠ **liveness gap**:cowork 卡靠用户下次发送的 `router.refresh()` 出现(`conversation-thread.tsx:96`),非常驻订阅;纯异步卡可能滞留到下次交互。实时优先走 mission_artifacts SSE 通道。
   > ⚠ **conversationId 不在 ToolContext**(只有 missionId/taskId/org/operator)—— 须在 tool 的 inputSchema 或调用方把它塞进 event payload(tingwu 也这么做,`events.ts:621`)。
3. **无 mission 的自由对话**:可能既无 missionId 也无 conversationId 闭环 —— 至少 media_asset 已落库,编辑器/素材库读 DB 即见;有 conversationId 就发 import_card。

---

## 6. 安全模型——"注册才能调,不能任意执行"

四道闸,缺一不可:

**① 命令白名单(双层)**
- **部署层**:`CLI_ALLOWED_BINARIES` env(如 `ffmpeg,ffprobe,yt-dlp,pandoc`)—— 只有运维在容器里装好且列进白名单的二进制能被登记。即便管理员也**不能登记 `bash`/`rm`** 等不在名单的命令。
- **数据层**:`cli_tools.command` 注册时校验 `∈ CLI_ALLOWED_BINARIES`。
- **预检**:注册/首次运行做一次 binary 存在性探测(`which` / `--version`),"未安装"显式报错,胜过运行中途 ENOENT 难排查。

**② `spawn` 不走 shell(根除注入)**
- `child_process.spawn(command, argvArray, { shell: false })`,**绝不** `exec`/字符串拼接。`; rm -rf`、`$(...)`、反引号进不来 —— 没有 shell 解析,参数只作为独立 argv 项原样传入。

**③ 参数 schema + argvTemplate(受限取值)**
- LLM 只能产出 `argsSchema` 定义的字段,值过校验(enum 白名单 / 数值上下限 / regex / 文件须是本 org 的 media_asset id)。
- **`type:"asset"` 参数是 argv 安全与租户隔离的连接点**:资产 id → scratch 文件的解析**必须**走一个**统一的 org 作用域 resolver**(`eq(mediaAssets.organizationId, orgId)`),严禁直接用 org-blind 的 `getAssetDetailFull` —— 否则可被诱导越权读他人资产。M3 落成一条强制代码路径。
- `argvTemplate` 是 token 数组,把校验后的值映射成**固定位置**的 argv;引用值始终是**单个 argv 元素**(不 split、不二次解析)。
- 示例(ffmpeg 转码):
  ```
  command: "ffmpeg"
  argsSchema: { input:{type:"asset",required}, outputFormat:{type:"enum",values:["mp4","mov","webm","gif"]} }
  argvTemplate: ["-y","-i",{param:"input"},"-f",{param:"outputFormat"},{output:"out"}]
  // 解析为：ffmpeg -y -i /scratch/in.mov -f mp4 /scratch/out.mp4
  ```

**④ 工作目录 jail + 超时 + 输出上限**
- 每 run 一个 `mkdtemp` scratch 目录;`{param:"input"}` 只解析到 scratch 内下载的输入,`{output:"out"}` 只生成 scratch 内输出路径 —— CLI 碰不到 scratch 外。
- 超时 kill 子进程(sync 用 `syncTimeoutMs`,async 用 Inngest step 超时);捕获 `exitCode`/`stderr` 写 `cli_tool_runs`。
- **输出上限决策(v1 拍板)**:`putObject` 是单次 buffered PUT 无 multipart → 输出超过上限(默认 500MB,沿用 `MAX_VIDEO_BYTES`)**硬拒绝**并记 `failed`,**不做**流式/multipart(留演进);输入侧 HEAD 预检超限即拒。先把内存/大小边界焊死,不在 M3b 才发现 OOM。

**⑤ 权限门控(与 MCP 一致)**
- CLI/MCP 工具默认 `write` 类(仅 `authorityLevel ∈ {executor,coordinator}` 可调);read 类 advisor+ 可见(运营在管理页对确认安全的命令降为 read)。走执行层注入,**不串 orgId 进 `assembleAgent`**(它无此参数)→ 不进 prompt 文本、不受 observer→`[]` 过滤(observer 走 mission 本就无工具,read/write 已够)。

**⑥ MCP 侧安全**:http MCP URL 复用 `validatePluginUrl`(`src/lib/plugin-security.ts`,强制 HTTPS + 封内网 CIDR 防 SSRF);认证头走 `crypto.ts` 加密存。⚠ 生产须配真 `PLUGIN_ENCRYPTION_KEY`(现 dev fallback 不安全)。

---

## 7. UI(能力与集成中心)

`/skills` 升级,落三区:
- **MCP 服务器**区:`mcp_servers` CRUD + 测连 + 显示发现到的 tool 列表与 read/write。
- **CLI 工具**区:`cli_tools` CRUD + **参数 schema 编辑器**(运营定义允许哪些参数/取值)+ `command` 下拉只列 `CLI_ALLOWED_BINARIES` + **测试运行**(挑一个 media_asset 跑一次看产物)+ 启停 + `cli_tool_runs` 执行/审计日志。
- **工具**区加「**来源**」列:`内置` / `MCP · {name}` / `CLI · {name}`(解析 `mcp__`/`cli__` 前缀)。

配置三件套照搬 `channel_configs`(`src/db/schema/channels.ts` + `actions/channels.ts` create/update/toggle/test + `/settings/channels`)。Feature flag 仿 `src/lib/cms/feature-flags.ts` → `isMcpEnabled()` / `isCliToolsEnabled()`。

---

## 8. 分期落地

| 期 | 内容 | 交付 |
|---|---|---|
| **M1 MCP-http 配置** | `mcp_servers` + DAL + actions(create/update/toggle/**test**,SSRF+加密)+ `/settings/mcp` + flag | ✅ 纯配置 |
| **M2 工具注入接缝** | 装 `@ai-sdk/mcp` + `createMcpToolset` + `toVercelTools` 加 `mcpTools` 槽 + 4 调用点 wiring + 生命周期 close | ✅ MCP 可用 |
| **M3 CLI 能力(完整)** | 拍板合并,内部两个 commit:<br>**M3a 基础+同步**:`cli_tools`+`cli_tool_runs` 表 + `CLI_ALLOWED_BINARIES` + argv 安全模型 + `spawn` 封装 + scratch 纪律 + 存储 helper(`downloadObjectToFile`/`storeBufferAsAsset`/导出 `formatFileSize`)+ `createCliToolset` 合并进 `toVercelTools` + sync 执行 + 能力中心「CLI 工具」区<br>**M3b 异步**:`cli/run.requested` event + `cliRun` Inngest fn(durable 模式)+ 失败 handler + ffprobe 元数据 + 产物回流(mission_artifacts + import_card)+ 状态列 → ffmpeg 重活闭环 | ✅ CLI 端到端 |

每 commit `tsc --noEmit` + `npm run build` 必过。M1/M2 与 M3 解耦,可并行/先后。

---

## 9. 测试考量

- **MCP**:mock http MCP server,验证 ① tool 前缀注册 ② 单 server 超时/失败跳过、其余正常 ③ `enabled=0` 下线 ④ `close()` 被调。
- **argv 安全(重点)**:注入字符串(`"a; rm -rf /"`、`"$(whoami)"`)作参数 → 断言以**单个 argv 元素**传入、shell 未解析;非白名单 `command` 登记被拒;越界 enum/数值被拒。
- **门控**:write 类对 advisor 不可见、executor 可见;read 覆写后 advisor 可见。
- **文件 I/O**:跨 org 读 `inputAssetId` 被拒;`storeBufferAsAsset` 往返 + 元数据正确;scratch `finally` 清理。
- **异步闭环**:mock 一个快 CLI 走 `cli/run.requested` → `cli_tool_runs` 状态流转 queued→processing→done;产物 `mission_artifacts.fileUrl` 在任务台 SSE 出现;失败 handler 置 failed + 卡片。
- **CLI 集成**:真 ffmpeg 转码一个小样片端到端(需 CI 装 ffmpeg)。

---

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 任意命令执行 / 注入 | §6 四道闸:二进制白名单 + `spawn(shell:false)` + 参数 schema + scratch jail。**核心安全保证** |
| 服务端无 sandbox | 注册式 + 白名单 + jail 是"受控执行"而非完全隔离;**确认 Inngest worker 是长驻 Node 容器(非 edge/serverless)且 ffmpeg/ffprobe 在 PATH**;高敏环境可后续上容器/microVM 隔离(演进) |
| 全库无 spawn 先例 | 从零建执行纪律(scratch/退出码/stderr/cleanup);`asr/transcode.ts:8` 标注 ffmpeg-in-serverless 未验证 → 必须在自托管容器跑 |
| 产物表接错 | 任务台用 `mission_artifacts`(有 fileUrl),**非** `workflow_artifacts` |
| 大文件 OOM | `putObject` 单次 buffered PUT 无 multipart + `storeRemoteMediaToTos` 全量进内存 → 抄 500MB HEAD guard 或流式 |
| 重任务拖垮 CLI host | `concurrency:{limit:N, key:org}` 防 org 间踩踏;`retries:2`(CLI 幂等可重跑) |
| 跨租户读资产 | `getAssetDetailFull` 无 org 校验 → job 自行 `eq(organizationId)` |
| MCP 依赖/凭据 | 已核实 `@ai-sdk/mcp` API;凭据加密存,生产配真 `PLUGIN_ENCRYPTION_KEY` |
| conversationId 缺失 | 不在 ToolContext → 经 event payload 透传;无则只回 media_asset + mission_artifacts |
| 存储桶 | provider 模块加载期定(`STORAGE_PROVIDER`);确认 worker 跑的桶存在且 public-read(否则 `getPublicUrl` 失效,用 `generateDownloadUrl`) |

---

## 附:关键实现锚点(实现前复核)

| 改动 | 文件:symbol |
|---|---|
| ToolSet 合流(加 mcpTools/cliTools 槽) | `tool-registry.ts:2845` `toVercelTools`、:2806 `wrapToolExecuteWithContext`、:2871 `ToolContext` |
| 4 调用点 | `execution.ts:239`、`chat/stream/route.ts:160`、`chat/intent-execute/route.ts:264`、`scenarios/execute/route.ts:161` |
| 异步 tool 先例(照抄) | `tool-registry.ts:2176` `tingwu_analyze`(`inngest.send` :2196,return handle :2200) |
| durable Inngest 模板 | `inngest/functions/tingwu-analyze.ts:37`(:19 退避,:193 失败 handler) |
| 简单内联模板(对照,**不抄**自轮询) | `inngest/functions/aigc-video.ts:84` |
| typed event 声明 | `inngest/events.ts:615`(仿 `media/tingwu-analyze.requested`)+ `inngest/client.ts` `fromRecord` + `functions/index.ts:184` 注册 |
| 输入读资产 | `dal/assets.ts:493` `getAssetDetailFull`(**自加 org 校验**) |
| 存储 I/O 原语 | `storage/index.ts:27` `generateDownloadUrl` / :32 `getPublicUrl` / :35 `putObject`;`storage/types.ts:5` `StorageProvider`(6 成员,无 getObject) |
| 输出建资产(泛化) | `aigc/store-media.ts:13` `storeRemoteMediaToTos` → 新增 `storeBufferAsAsset`;`actions/assets.ts:19` `formatFileSize`(导出) |
| 大文件 guard | `inngest/functions/article-video-ingest.ts:14` `MAX_VIDEO_BYTES` + :62 HEAD |
| 任务台产物 | `db/schema/missions.ts:182` `mission_artifacts`(fileUrl :196)、`dal/missions.ts:182` 映射、`use-mission-live.ts` SSE |
| cowork 卡片 | `dal/cowork-conversations.ts` `appendMessage`、`conversation-thread.tsx:368` import_card(:96 router.refresh liveness) |
| 媒体表 | `db/schema/media-assets.ts` `mediaAssets`(tosObjectKey/fileUrl/mimeType/fileSize/durationSeconds/width/height/source/parentVersionId) |
| SSRF / 凭据加密 | `plugin-security.ts` `validatePluginUrl`、`crypto.ts` `encrypt`/`decrypt` |
| connector 配置模板 | `db/schema/channels.ts` + `actions/channels.ts`(create/update/toggle/test) |
