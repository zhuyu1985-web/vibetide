# 数字员工「领域 / 形态」一等维度 + 能力与集成中心 · 设计文档

- **日期**: 2026-06-18
- **作者**: zhuyu / claude
- **范围**:
  - 数据:新增 `domains` 受控字典表;`ai_employees` 领域从自由 `domainTags` 收敛到字典外键;`workflow_templates` 场景级 + 节点级加 `domain` / `mediaForm` 字段;新增 `mcp_servers` 表
  - 派单:`pickEmployeeForStep`(`src/lib/mission-core.ts:135`)加「领域」第二因子 + 无匹配 fallback
  - 运行时:`executeAgent`(`src/lib/agent/execution.ts:190`)支持任务级 `mediaForm` override(当前只读实例)
  - UI:选员工「工种→领域」两级选择器;工作流编排「场景默认 + 节点徽章(领域/形态)」;`/skills` 升级为「能力与集成中心」四区
  - 集成:`toVercelTools`(`src/lib/agent/tool-registry.ts:2817`)工具来源层加 MCP client 适配 + `/settings/mcp` 管理页;CLI 入口(`package.json` `bin` + `commander`)复用 `executeMissionDirect`
- **不改**:
  - `executeAgent` 的 `generateText + stepCountIs(20)` 核心 loop
  - `buildSystemPrompt` 的分层结构(只新增/复用 Layer 4.5/4.6,不重排)
  - 工种 `CRAFT_META` / `CRAFT_CORE_SKILLS`(`src/lib/constants.ts`)、`authorityLevel` 门控
  - `skills.kind`(tool|skill)语义(MCP 不作为新 kind,见 §7)

---

## 1. 问题与目标

### 1.1 现状

四层重构(commit `a80339a`)把「员工 = 工种 × 三维修饰」落了地,但三维修饰目前都塞在 `ai_employees.instanceConfig`(`src/db/schema/ai-employees.ts:71-87`),且**只进 prompt、不参与任何选人/编排逻辑**:

1. **领域(domainTags)** 是自由字符串数组,仅在 `buildSystemPrompt` 的 Layer 4.5 注入(`src/lib/agent/prompt-templates.ts:187-194`)。**派单 `pickEmployeeForStep`(`src/lib/mission-core.ts:135-207`)只认 `roleType` + `isPreset`,完全不看领域** —— 多个 reporter 实例(财经/体育)时派单等同随机。
2. **媒体形态(mediaForm)** 枚举 `news|newmedia|convergence`,绑在实例上(`instanceConfig.mediaForm`),Layer 4.6 注入(`prompt-templates.ts:196-216`)。同一个人想换形态产出必须改实例配置,**不能按任务切换**。
3. **MCP**:全库 0 集成、0 依赖。工具走 AI SDK `tool()` 同进程直调(`tool-registry.ts` `toVercelTools:2817`)。
4. **CLI**:无正式入口。仅 `scripts/` 下零散 tsx 脚本(`run-real-mission.ts` 调 `executeMissionDirect`,`mission-executor.ts:2124`),手工 `tsx` 跑,无 `bin` / `commander`。

### 1.2 痛点

- **选员工**:用户面对几十个实例平铺,不知道按什么选;想要「财经记者」却无两级收敛。
- **工作流编排**:节点派单只到工种,派不准领域;每节点手填领域又太繁琐。
- **形态僵硬**:同一记者不能这次出新闻稿、下次出短视频脚本。
- **MCP/CLI**:无集成入口,文档只能标「目标态」。

### 1.3 目标

| 目标 | 衡量 |
|---|---|
| 领域升为**一等维度** | 选员工「工种→领域」两级;派单按工种+领域确定性选人 |
| 形态做**任务级输出参数** | 场景默认 + 节点覆盖 + 实例缺省;不参与派单;运行时可 override |
| MCP/CLI 纳入**能力与集成中心** | `/skills` 四区;MCP 工具进工具库(标来源);CLI 作触发入口 |
| **向后兼容** | 旧 mission / 旧实例 / 旧模板不破;领域字典对历史 `domainTags` 平滑迁移 |

### 1.4 Non-Goals

- 不重写 `executeAgent` 执行 loop、不改 7 层 prompt 结构。
- 不把形态做成实例属性(避免「工种×领域×形态」实例爆炸)。
- 不把 MCP/CLI 做成 `skills.kind`(抽象层不同,见 §7/§8)。
- MCP 本期只做**消费侧**(连外部 MCP server 把其 tool 拉进来),不做「把本系统工具暴露为 MCP server」(留后续)。

---

## 2. 核心模型:四维归位

整套设计的纲领 —— 四个维度各归各位,职责不交叉:

| 维度 | 角色 | 在哪选 | 参与派单? | 运行时差异化 | 载体 |
|---|---|---|---|---|---|
| **工种** craft | 选人主维度 | 选员工 / 节点 | ✅ | 身份 + 核心技能 | `ai_employees.roleType` |
| **领域** domain | 选人副维度 | 选员工 + 场景默认 / 节点覆盖 | ✅ **新增** | 知识库 + 领域口径(Layer 4.5) | `ai_employees.domain_id` + `domains` 字典 |
| **形态** form | 任务输出 | 场景默认 / 节点覆盖 | ❌ | 产物形态(Layer 4.6) | 任务级参数 + 实例缺省 |
| **层级** authority | 权限 | 员工配置 | ❌(门控) | 工具集 + 定稿/发布权 | `ai_employees.authorityLevel`(已有) |

**判定准则**:
- 「换了它要不要换人」→ 要 = 选人维度(工种、领域);不要 = 任务维度(形态)。
- 财经记者 ≠ 体育记者(不同人)→ 领域是选人维度。
- 同一财经记者能写新闻也能写短视频(同一人)→ 形态是任务维度。

---

## 3. 数据模型改动

> 全部走 Drizzle 标准流程(`npm run db:generate` → `db:migrate`),禁手工 SQL(CLAUDE.md 纪律)。

### 3.1 新增 `domains` 受控字典

```ts
// src/db/schema/domains.ts（新增）
export const domains = pgTable("domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  slug: text("slug").notNull(),          // "finance" / "sports" / "politics"
  name: text("name").notNull(),          // 财经 / 体育 / 时政
  description: text("description"),
  // 领域「口径包」—— 执行时差异化的真正载体（见 §5.1）
  promptGuidance: text("prompt_guidance"),                      // 领域专属提示词：口径/术语/禁忌（注入 Layer 4.5）
  authoritySources: jsonb("authority_sources").$type<string[]>().default([]), // 权威源域名白名单：注入 prompt + 喂 web_search includeDomains
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("domains_org_slug_uidx").on(t.organizationId, t.slug)]);
```

- org 级可维护(在「能力与集成中心」或设置页 CRUD)。
- Seed 一批默认领域(财经/体育/时政/社会/民生/法治/科技/文娱…)对标 §1 的媒体岗位领域。

### 3.2 `ai_employees` 领域收敛

- 新增 `domainId uuid references(domains.id)`(可空 = 通用,不限领域)。
- **保留** `instanceConfig.domainTags` 一个迁移期,写一次性脚本 `scripts/migration-domain-001.ts`:把历史 `domainTags[0]` 按名称匹配/新建 `domains` 行,回填 `domainId`;`mediaForm` 保留(成为「实例缺省形态」)。
- `instanceConfig` 收窄为 `{ mediaForm?, platformSpecs? }`(domainTags 退役)。

### 3.3 `workflow_templates`:场景级 + 节点级领域/形态

- 场景级(模板根):`defaultDomainId uuid?`、`defaultMediaForm enum?`。
- 节点级(`steps[]` 每步,**存现有 `steps[]` jsonb,不新增列**):可选 `domainId?`(覆盖场景默认)、`mediaForm?`(覆盖场景默认);`requiredCraft` 已有。
- 场景级 `defaultDomainId` / `defaultMediaForm` 为**模板根新增列**。
- 解析优先级(派单/装配前):**节点值 > 场景默认 > 空**。

### 3.4 新增 `mcp_servers`

```ts
// src/db/schema/mcp-servers.ts（新增）
export const mcpServers = pgTable("mcp_servers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  transport: text("transport").notNull(),   // "stdio" | "http"
  // config 取 transport 判别式 shape（P5 定义 McpServerConfig 联合类型 + zod 校验）：
  //   stdio → { command, args, env?, connectTimeoutMs }
  //   http  → { url, headers?, connectTimeoutMs }
  config: jsonb("config").notNull(),
  enabled: integer("enabled").default(1),
  lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
  toolCount: integer("tool_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### 3.5 `mission_tasks` 加领域 fallback 标记

新增列 `domainFallback boolean default false`：派单时领域未精确命中、回退通用实例时置 `true`，供 UI 显式提示「领域未精确匹配」(对齐 §4「不静默」原则)。

---

## 4. 派单逻辑改动 · `pickEmployeeForStep`

文件 `src/lib/mission-core.ts:135-207`。现状只按 `roleType` + `isPreset` 排序。改为**工种 + 领域双因子**:

```
解析 step 的 { requiredCraft|requiredSkill, domainId(节点>场景默认) }
   ↓
候选 = employees.filter(e => e.roleType ∈ craftSet)        // 第一因子:工种(不变)
   ↓
IF domainId 指定:
   matched = 候选.filter(e => e.domainId === domainId)
   IF matched.length > 0 → 在 matched 内按 isPreset 排序取首    // ✅ 领域精确命中
   ELSE → fallback:取候选里 domainId 为空的「通用实例」,
          若仍无则取候选首位;domainFallback = true（不静默）
ELSE → 现状逻辑(候选按 isPreset 取首);domainFallback = false
```

**返回 shape 改动**:`pickEmployeeForStep` 返回类型由 `EmployeeWithSkills | null` 改为 `{ employee: EmployeeWithSkills | null; domainFallback: boolean }`。调用方(mission 物化派单处)把 `domainFallback` 落到 `mission_tasks.domainFallback`(§3.5),UI 据此提示。**所有现有 caller 同步改解构**(纯函数,改动集中、可单测)。

**关键原则**:
- 领域**只缩小候选、不否决**:没有「财经记者」实例时,fallback 到通用记者并**显式标注**「领域未精确匹配」,不报错挡流程(对齐 brainstorm 拍板)。
- 显式 `employeeSlug` 仍最高优先(现状第 1 步不变)。

---

## 5. 运行时链路(配置 → 装配 → 执行 + 形态 override)

```
① 配置：选员工(工种→领域) / 编排(场景默认+节点覆盖)
        领域 → ai_employees.domainId（选人）
        形态 → 模板 defaultMediaForm / step.mediaForm（任务参数）
        ↓
② 派单：pickEmployeeForStep(工种 + 领域) → 选中实例（§4）
        ↓
③ 装配：assembleAgent(employeeId)  // src/lib/agent/assembly.ts:29
        读 domainId → join domains → 注入 Layer 4.5（领域口径）
        读绑定 KB → kb_search 限定该员工库（assembly.ts:182, execution.ts:236）
        ★ 形态不再只读实例：assembleAgent 接受 mediaFormOverride 参数
        ↓
④ 执行：executeAgent(agent, input{ mediaForm: 任务级解析值 })  // execution.ts:190
        buildSystemPrompt 用 override?? 实例缺省 → Layer 4.6（形态）
        generateText + stepCountIs(20)（不变）
```

**改动点**:`AgentExecutionInput` 加可选 `mediaForm`;`buildSystemPrompt`(`prompt-templates.ts:196`)取值改为 `input.mediaForm ?? agent.mediaForm`(任务级优先于实例缺省)。领域走 §4 选人,无需 override。

**差异化实证**(同一财经记者实例):
- 任务形态 `news` → 财经新闻稿(导语+主体+结语,规范书面语)
- 任务形态 `newmedia` → 财经短文案(口语化、hook、话题标签、封面文案)
- 任务形态 `convergence` → 一稿多版(新闻稿 + 短视频脚本 + 微博版)

### 5.1 领域「口径包」的运行时注入(领域差异化的真正载体)

光有 `domainId` 参与派单还不够 —— 领域差异化靠 `domains` 的口径包(`promptGuidance` + `authoritySources`)在执行时落地,**三处差异化**:

> **口径包边界 —— 只放领域共性**:口径包**不**含工种/任务差异。同一领域(体育)的口径(核官方比分、称谓规范、不传未证实转会)对该领域**所有工种、所有任务**适用;「记者 vs 编辑」由工种身份层(Layer 1)分,「采集 vs 写稿 vs 拍摄规划」由技能层(Layer 2.5 ← SKILL.md)分,产物形态由 Layer 4.6 分。四层 prompt **叠加**自动组合出「领域 × 工种 × 任务 × 形态」的精确人格,口径包无需穷举场景(否则回到「领域 × 技能」组合爆炸)。

1. **prompt 口径(Layer 4.5 升级)**:`assembleAgent` join `domains` 取 `promptGuidance`;`buildSystemPrompt`(`prompt-templates.ts:187`)Layer 4.5 改为 `promptGuidance ?? 现有通用模板`(配了专属口径用专属,没配回退现状通用模板,**向后兼容**)。
2. **检索源倾向(工具参数)**:让 `web_search` 优先该领域权威源(财经→证监会/交易所,体育→赛事官网)。⚠ **当前 `web_search` 的 `inputSchema`(`tool-registry.ts:411`)无 `includeDomains` 入参**——line 460 硬编码 `DEFAULT_INCLUDE_DOMAINS`,且 `wrapToolExecuteWithContext` 注入的未知字段会被 zod **静默 strip**(同 orgId,见 `:2766` 注释)。**实现须先给 `inputSchema` 加可选 `includeDomains` 字段**,之后才能经 context 注入领域 `authoritySources`,并在 line 460 与 `DEFAULT_INCLUDE_DOMAINS` **合并(union)**。能力在底层已具备:`searchWeb`(`src/lib/search/index.ts:35`)+ tavily/bocha provider 均支持 `includeDomains`,只缺工具层暴露这一步。
3. **知识库(已有)**:`kb_search` 检索该员工绑定的领域知识库,不变。

**注入数据流**:`pickEmployeeForStep` 选中实例 → `assembleAgent(employeeId)` join `domains` 取口径包 → `AssembledAgent` 加 `domainGuidance` / `domainAuthoritySources` 字段 → `buildSystemPrompt` 用 `promptGuidance`;`web_search` **新增 `includeDomains` schema 字段**后,经 `wrapToolExecuteWithContext` 注入领域 `authoritySources`(与 `DEFAULT_INCLUDE_DOMAINS` 合并)。

**Seed**:默认领域随迁移脚本带初始口径包(如财经:`promptGuidance`=「不荐股/财务数据以证监会·交易所披露为准/区分预测与事实」+ `authoritySources`=证监会·交易所·央行域名),运营可在领域管理页改(§6.4)。

---

## 6. UI 设计

### 6.1 Q1 选员工:工种 → 领域 两级收敛

替代「平铺实例列表」。入口:对话中心选员工、`/employee` 花名册、模板节点指派人。

```
第①级 选工种            第②级 该工种 × 领域（选完工种才出现）
┌──────────┐          财经记者·小刚    [已配置 ✓]  ← 直接选
│ 📝 记者   │───▶      体育记者·小美    [已配置 ✓]
│ ✂️ 编辑   │          时政             [+ 创建该领域实例]
│ 🔍 审核   │          通用记者         [不限领域]
└──────────┘
```

- 第②级按 `domains` 字典列出;有实例的可选,无实例的「+ 创建」一键拉起配置(预填 roleType + domainId)。
- **实例数后果**:一个工种下有几个已配置领域,第②级就有几个实例(领域是选人维度 → 多实例);**媒体形态不产生实例**(任务级切换)。**一实例一主领域**(`domainId` 单外键),跨领域 = 建多个实例;单实例配置页领域/形态均单选(非多选)。
- 复用现有员工配置页 `src/app/(dashboard)/employee/[id]/employee-profile-client.tsx`「领域·形态」Tab;领域输入从自由标签改 `domains` 字典下拉(走 `updateEmployeeInstanceConfig`,`src/app/actions/employees.ts:208`,改为写 `domainId`)。

### 6.2 Q2 工作流编排:场景默认 + 节点徽章

场景头部一次性设默认领域 + 默认形态;每节点显示工种 + 两枚徽章,默认「继承」、点开「覆盖」:

```
场景：突发新闻追踪   默认领域:[财经▾]  默认形态:[新闻▾]    ← 各设一次
──────────────────────────────────────────────────
① 新闻聚合  记者  〔领域:财经·继承〕 〔形态:新闻·继承〕
② 事实核查  审核  〔领域:财经·继承〕 〔形态:—·NA〕        ← 审核无形态产物
③ 内容生成  记者  〔领域:科技·覆盖✎〕〔形态:新媒体·覆盖✎〕  ← 单节点改
④ 发布     运营  〔领域:财经·继承〕 〔形态:融媒体·覆盖✎〕
```

- 徽章 = 受控下拉(领域来自 `domains`,形态来自枚举);继承态灰、覆盖态高亮。
- 编排画布:`src/app/(dashboard)/workflows/[id]/edit` 节点卡加两枚徽章组件。

### 6.3 Q3 能力与集成中心(`/skills` 升级为四区)

```
能力与集成中心
├─ 技能 skill       工种专业能力（须绑工种 · skills.kind='skill'）
├─ 工具 tool        通用能力 · 每项标「来源：内置 / MCP-xxx」
├─ MCP 服务器        连接管理（增删 mcp_servers、测连、查 tool 列表）
└─ 触发入口          Web 对话 / 定时 / API / CLI（运行入口，非能力）
```

- 「工具」区每行加**来源**列:内置工具标「内置」,MCP 工具标「MCP · {server.name}」。
- 「MCP 服务器」区:`mcp_servers` 的 CRUD + 连接状态 + 该 server 暴露的 tool 列表(连上后自动注册进「工具」区)。
- 「触发入口」区:展示并配置各入口(Web/定时已有;CLI 给安装与用法说明;API 留位)。

### 6.4 领域字典管理(口径包编辑)

`domains` 的 CRUD 入口(能力与集成中心新增「领域」区,或 `/settings/domains`):每个领域编辑 `name` / `description` / **`promptGuidance`(多行口径文本)** / **`authoritySources`(域名白名单标签输入)** / `sortOrder`。这是运营调领域差异化的**主抓手** —— 改口径包即时影响该领域所有实例的产出口径与检索倾向,无需改代码、无需重启。

---

## 7. MCP 集成方案(消费侧)

**抽象定位**:MCP 不是新 `kind`,是工具的**来源**。一个 MCP server 暴露一批 tool,这些 tool 与内置 tool 同进一个工具库,只是 `source` 不同。

**依赖(P5 前置)**:当前仅装 `@ai-sdk/anthropic` / `@ai-sdk/openai`,**未装 MCP 包**。需安装 `@ai-sdk/mcp`(提供 `createMCPClient`);stdio 传输另需 `@modelcontextprotocol/sdk`。

**集成点(唯一改动在工具来源层)**:
- `src/lib/agent/tool-registry.ts` 的 `toVercelTools`(:2817):新增一步 —— 读 org 启用的 `mcp_servers`,用 **`createMCPClient`**(来自 `@ai-sdk/mcp`,**注意:非 `experimental_` 前缀、非 `ai` 核心包导出**)+ stdio/http transport 拉取其 tools,转成 `ToolSet` 合并进现有 `ALL_TOOLS` / `missionTools` / `kbTools`。
- `assembleAgent`(`assembly.ts`)的工具过滤:MCP 工具按 `authorityLevel` 同样门控(读类对 advisor+;写类仅 executor+),与内置工具一致。
- **`executeAgent` 不动** —— 它只消费 `ToolSet`,不关心来源。

**配置**:`mcp_servers` 表 + `/settings`(或能力中心「MCP 服务器」区)。`enabled=0` 即时下线。

**安全**:MCP server 的本地命令(stdio)在服务器后端进程内执行(见技术文档第 12 章「执行域」—— 服务器本地,非用户本地);写类 MCP 工具受 authority 门控 + 复用现有 `WRITE_TOOL_NAMES` dryRun 防护思路。

---

## 8. CLI 集成方案

**抽象定位**:CLI 是**触发入口**(与 Web/Inngest/定时并列),不是能力。

**集成点**:
- `package.json` 加 `bin: { "vibetide": "./dist/cli/index.js" }` + `commander`。
- 子命令:
  - `vibetide run-mission <id> --org <id>` → 复用 `executeMissionDirect`(`mission-executor.ts:2124`)
  - `vibetide run-skill --employee <slug> --skill <slug> --org <id> --input <json>` → **新写**单技能直跑:`assembleAgent` → 构造 `skillSpec` → `executeAgent(context{orgId,operatorId})` → 打印三段式
  - `vibetide list-employees --org <id>` 等只读辅助
- **Auth 旁路**:复用 `startMissionFromTemplateScheduled`(`src/app/actions/workflow-launch.ts:134`)的「显式接 orgId、跳过 requireAuth」模式;CLI 用 `--org` / `--operator` 提供身份。
- **env**:`dotenv` 读 `.env.local`(检索类工具 API key、CMS env 照常)。
- **构建**:`output: standalone` 已具备 Node 运行能力;CLI 单独 tsc 出 `dist/cli`。

---

## 9. 分期落地

| 期 | 内容 | 可独立交付 |
|---|---|---|
| **P1 领域一等维度** | `domains` 表(含口径包 `promptGuidance`/`authoritySources`)+ 迁移脚本 + `ai_employees.domainId` + `pickEmployeeForStep` 双因子 + fallback 标注 + Layer 4.5 注入升级 + **`web_search` inputSchema 加 `includeDomains` 字段并注入领域权威源** | ✅ 后端先行,派单准 + 口径差异化 |
| **P2 选员工/编排 UI** | 两级选择器(本期落:`/employee` 花名册 + 配置页领域字典化;**对话中心 picker、节点指派人 picker 顺延 P2.1**)+ 场景默认/节点领域徽章 + 模板领域字段 | ✅ 依赖 P1 |
| **P3 形态任务化** | 模板 `defaultMediaForm`/节点 `mediaForm` + `executeAgent` override + 形态徽章 | ✅ 独立于领域 |
| **P4 能力与集成中心** | `/skills` 四区改版 + 工具来源列 | ✅ 纯前端重组 |
| **P5 MCP 消费** | **装 `@ai-sdk/mcp`(+stdio 需 `@modelcontextprotocol/sdk`)** + `mcp_servers` + `toVercelTools` `createMCPClient` 适配 + 管理区 | ✅ 依赖 P4 |
| **P6 CLI** | `bin` + `commander` + 单技能直跑 | ✅ 独立 |

每期一个 commit 边界,均须 `tsc --noEmit` + `build` 通过(CLAUDE.md Git 纪律)。

---

## 10. 测试考量

- **派单单测**(`pickEmployeeForStep`):工种+领域精确命中、领域 fallback(无实例→通用+标注)、显式 employeeSlug 优先、空领域回退现状。覆盖 `src/lib/__tests__/`。
- **装配/prompt 单测**:`domainId` → Layer 4.5 文案;`mediaForm` override 优先于实例缺省 → Layer 4.6 文案。
- **迁移脚本**:`domainTags` → `domains` 回填幂等;历史无 domainTags 实例 `domainId=null` 仍可派单。
- **MCP**:mock 一个 stdio MCP server,验证 tool 注册进 `ToolSet`、authority 门控生效、`enabled=0` 下线。
- **CLI**:`run-skill` 端到端跑通(脱 Web、显式 orgId、三段式输出)。

---

## 11. 风险与向后兼容

| 风险 | 缓解 |
|---|---|
| 领域字典与历史 `domainTags` 不一致 | 迁移脚本按名称匹配/新建;保留 `domainTags` 一个迁移期只读,P2 后删 |
| 旧模板无 `defaultDomain`/节点无 `domain` | 解析为「空领域」→ 派单走现状逻辑,不破 |
| 多个同领域同工种实例 | 按 `isPreset` 取首(现状规则延用),需要精确仍可显式 `employeeSlug` |
| MCP 依赖未装 / API 名误用 | P5 须先装 `@ai-sdk/mcp`(+ stdio `@modelcontextprotocol/sdk`);用 `createMCPClient`(**非** `experimental_` 前缀) |
| MCP server 不可用/超时 | `toVercelTools` 拉取失败跳过该 server(降级不阻断 agent),记 warning;**stdio 传输设 per-server 连接超时**,防 handshake 卡死拖垮每次 `toVercelTools` 装配 |
| CLI 误操作生产数据 | 写类工具沿用 dryRun 白名单;`--org` 必填,无默认 |

---

## 附:关键文件索引(实现锚点)

| 改动 | 文件:line |
|---|---|
| 派单双因子 | `src/lib/mission-core.ts:135` |
| 装配读领域/形态 | `src/lib/agent/assembly.ts:29`(:212 读 instanceConfig) |
| prompt 领域/形态层 | `src/lib/agent/prompt-templates.ts:187`(4.5)/ `:196`(4.6) |
| 执行入口(加 mediaForm override) | `src/lib/agent/execution.ts:190` |
| 工具来源层(MCP 接入) | `src/lib/agent/tool-registry.ts:2817`(`toVercelTools`) |
| web_search 检索源(领域 authoritySources) | `tool-registry.ts:411`(web_search inputSchema,**须新增 includeDomains 字段**)+ 底层 `src/lib/search/index.ts:35`(`searchWeb` 已支持) |
| 实例配置写库 | `src/app/actions/employees.ts:208`(`updateEmployeeInstanceConfig`) |
| 员工配置 UI | `src/app/(dashboard)/employee/[id]/employee-profile-client.tsx` |
| CLI 复用入口 | `src/lib/mission-executor.ts:2124`(`executeMissionDirect`) |
| Auth 旁路模式 | `src/app/actions/workflow-launch.ts:134`(`startMissionFromTemplateScheduled`) |
