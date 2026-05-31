# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## Project Overview

Vibetide (Vibe Media) is a Chinese-language AI-powered content management platform. It manages a team of 8 specialized AI employees that collaborate on content production workflows: hot topic monitoring, content planning, writing, video production, quality review, channel distribution, and data analytics.

## Commands

```bash
npm run dev          # Start Next.js dev server (binds 0.0.0.0:3000)
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check (no emit)

# Tests (Vitest)
npm run test                           # Run all tests once
npm run test:watch                     # Watch mode
npm run test:coverage                  # With coverage
npx vitest run path/to/file.test.ts    # Run a single test file
npx vitest run -t "test name pattern"  # Filter by test name

# Database (requires DATABASE_URL in .env.local)
npm run db:push                  # Push Drizzle schema to Supabase (dev)
npm run db:generate              # Generate SQL migration files
npm run db:migrate               # Apply migrations
npm run db:studio                # Open Drizzle Studio (visual DB browser)
npm run db:seed                  # Seed database (src/db/seed.ts)
npm run db:seed:research         # Seed research module data
npm run db:seed:mock-articles    # Seed mock research articles
npm run db:cleanup-empty-workflows   # Remove empty workflow templates
npm run db:cleanup-workflow-dupes    # Dedupe workflow templates
npm run db:cleanup-skill-dupes       # Dedupe legacy skill rows
```

**Pre-commit hooks:** husky + lint-staged run `eslint --fix` on staged `src/**/*.{ts,tsx}` (installed automatically via the `prepare` script on `npm install`).

## Tech Stack

- **Framework:** Next.js 16.1.6, React 19, TypeScript 5 (strict mode)
- **Database:** Supabase (PostgreSQL) via Drizzle ORM 0.45.1 with `postgres` driver
- **Auth:** Self-built (iron-session encrypted cookie + argon2id password hashing). DB-only — Supabase Auth (GoTrue) no longer used.
- **AI:** AI SDK (Vercel) v6, @ai-sdk/anthropic
- **UI:** shadcn/ui (new-york style), Radix UI, Tailwind CSS v4, Lucide icons
- **Charts:** Recharts 3.7
- **Animation:** Framer Motion
- **Automation:** Inngest (background jobs, event-driven workflows)
- **Path alias:** `@/*` maps to `./src/*`

## Architecture

### 架构决策记录（ADRs）

重大架构决定记录在 `docs/adr/`。**做架构相关变更前必须读相关 ADR**；如果当前任务与某条 ADR 冲突，先告知 owner 评估是否 reopen ADR，不要直接绕过。

当前生效：

- [`2026-05-01-platform-supabase-strategy.md`](docs/adr/2026-05-01-platform-supabase-strategy.md) — 留 self-hosted Supabase；统一栈不分 SKU；不引入 supabase-js / 不替换 Inngest / 不做极简版客户化部署。该 ADR §5 Non-Goals 列出明确禁止的方向。
- [`2026-05-29-workflow-template-schedule-on-scheduled-jobs.md`](docs/adr/2026-05-29-workflow-template-schedule-on-scheduled-jobs.md) — workflow_template 定时任务嫁接 `scheduled_jobs` 表（加 `kind` 字段区分 platform vs workflow_template），不新建独立调度系统。`workflow_templates.triggerConfig` 标 `@deprecated`，由 `scheduled_jobs(kind='workflow_template')` 取代。

ADR 是 immutable 决策快照——情况变了写新 ADR 引用并 supersede 老的，不要修改老 ADR 内容。

### Route Structure

Three route areas under `src/app/`:
- `landing/` — Public landing page (shown at `/` for unauthenticated visitors).
- `(auth)/` — `login/`, `register/`, `auth/` (OAuth callback). No layout protection.
- `(dashboard)/` — 34 dashboard route groups. Layout fetches user profile with graceful fallback.

Root page (`/`) shows the landing page for unauthenticated users, redirects authenticated users to `/home`.

### Server/Client Component Pattern

**Use Server Components by default.** Only add `"use client"` when components need browser interactivity (event handlers, hooks, browser APIs). **Never import server-side DAL code (`src/lib/dal/`) from client components** — this causes build-time DB connection errors.

Dashboard pages follow a consistent split:
- **`page.tsx`** — Server component. Fetches data (from DAL or mock), passes as props.
- **`*-client.tsx`** — Client component ("use client"). Receives data as props, handles all interactivity.

Example: `team-hub/page.tsx` (server) → `team-hub-client.tsx` (client).

### Data Flow

```
Server Page → DAL (src/lib/dal/) → Drizzle ORM → Supabase PostgreSQL
                                                        ↑
Mutations  → Server Actions (src/app/actions/) ─────────┘
```

- **DAL** (`src/lib/dal/`): Read-only query functions that return UI types (`AIEmployee`, `Team`, etc. from `src/lib/types.ts`). Transform DB rows to match frontend interfaces.
- **Server Actions** (`src/app/actions/`): Mutations with `"use server"`. All require auth via `requireAuth()` helper. Use `revalidatePath()` for cache invalidation.
- **Mock data** (`src/data/`): 19 files with static mock data. Pages not yet migrated to DAL import directly from here.

### Database

- **~145 tables** defined across 54 schema files in `src/db/schema/`
- **72 enums** in `src/db/schema/enums.ts`
- **Key tables:** `organizations`, `user_profiles`, `ai_employees`, `skills`, `employee_skills`, `employee_memories`, `teams`, `team_members`, `workflow_templates`, `workflow_instances`, `workflow_steps`, `workflow_artifacts`, `team_messages`, `tasks`, `knowledge_bases`, `employee_knowledge_bases`, `missions`, `media_assets`, `articles`, `categories`
- **Types** auto-derived in `src/db/types.ts` via `InferSelectModel`/`InferInsertModel`
- **Connection** in `src/db/index.ts`: `postgres-js` driver,自动根据 DATABASE_URL 判断本地/远程(本地 `127.0.0.1` 自动启用 `prepare:true` 享受 prepared statement 加速,远程 pooler 自动 `prepare:false` 避免 PgBouncer transaction mode 协议冲突)
- **Migrations** output to `supabase/migrations/`
- Multi-tenant: all core tables have `organization_id` foreign key

### Schema Migration 规范（**强制纪律**，避免 schema drift）

**背景**：项目曾出现 21 个手工日期格式 SQL 文件（`20260419xxx.sql` 等）脱离 Drizzle `_journal.json` 追踪，迁库时部分漏跑（如 `idx_workflow_templates_owner_employee` 索引漏建、`missed_topics` 废表残留）。**只要遵守下面流程，schema 永远跟代码同步**。

**写新 schema 变更的唯一标准流程**：

```bash
# Step 1: 改 src/db/schema/*.ts（加表/字段/索引/枚举值）

# Step 2: 让 Drizzle 自动生成 migration + 更新 _journal.json
npm run db:generate

# 这会产出 supabase/migrations/NNNN_xxx.sql + 同步 meta/_journal.json + 对应 snapshot.json

# Step 3: 应用到当前 DATABASE_URL
npm run db:migrate
```

**禁止行为**：
- ❌ 不要**手工**在 `supabase/migrations/` 里创建 `YYYYMMDD_xxx.sql` 日期格式文件 — Drizzle 不会追踪它，迁库必漏
- ❌ 不要**绕过 Drizzle 直接 psql** 改生产 schema — 改完一定走标准流程让 journal 同步
- ❌ 不要**手工编辑 `_journal.json`** — 必须配对的 snapshot 文件，乱改会让 `db:migrate` 报错

**必须做的事**：
- ✅ 一次 schema 变更 → 一个 `db:generate` 产出 → 一次 `db:migrate`
- ✅ **每次切换 DATABASE_URL / 迁库后**立即跑 `bash scripts/verify-schema-sync.sh` 验证 16 个关键 fingerprint
- ✅ 部署到生产前确认 `npm run db:migrate` 在生产环境跑过
- ✅ 出现需要数据迁移的复杂变更（如 column 类型修改 + 数据搬运），写一个临时 `scripts/migration-NNN.ts` 脚本配合 Drizzle 标准 migration 用，不要把数据 migration 塞进 SQL 文件里

**Schema drift 检查脚本**：`scripts/verify-schema-sync.sh`
- 自动读 `.env.local` 的 DATABASE_URL
- 16 个 fingerprint：核心表存在、关键字段、关键索引、枚举值、废表已删
- 出现 `MISSING` / `STALE` 立即修复 — 输出对应 migration 找根因

### Auth Flow

完全自建，不依赖 Supabase Auth / GoTrue。所有用户认证只读写 `public.user_profiles` 表。

- **Auth lib** (`src/lib/auth/`):
  - `hash.ts` — `hashPassword` / `verifyPassword`（argon2id，m=19MiB / t=2 / p=1）
  - `session.ts` — iron-session AES-256-GCM 加密 cookie（`vibetide-session`），7 天滑动过期
  - `current-user.ts` — `getCurrentUser()`（cached per-request）+ `requireAuth()`（未登录抛 redirect /login）
  - `index.ts` — barrel export
- **Server Actions** in `src/app/actions/auth.ts`:
  - `signIn`：查 `userProfiles.email` → `verifyPassword` → 写 `lastLoginAt` → `setSession`
  - `signUp`：校验 email 唯一 → `hashPassword` → INSERT `userProfiles` 关联默认 org → `setSession`
  - `signOut`：`destroySession`
- **Proxy**（`src/proxy.ts`）— Next.js 16 路由拦截器（旧名 middleware）。读 `vibetide-session` cookie 用 `unsealData` 解密。公共路径（`/`, `/auth/*`）直接放行；`/login` 与 `/register` 已登录则跳 `/home`；其余未登录跳 `/login?next=...`
- **`user_profiles` 表**：`id` (uuid)、`email` (unique)、`password_hash`、`password_hash_algo` (`'argon2id'`)、`last_login_at`、`organization_id`、`display_name`、`role`、`is_super_admin`、`avatar_url`
- **Admin 用户管理**（`src/app/actions/admin.ts`）：直接 `db.insert(userProfiles)` 写入，停用账号 = `password_hash = NULL`
- **Env 必填**：`AUTH_SESSION_SECRET`（≥ 32 字符）、`AUTH_SESSION_TTL_SECONDS`（默认 604800）
- Email/password auth only (no social login / OAuth / 邮件验证 / 找回密码)

### AI Employee System

8 preset AI employees (defined in `src/lib/constants.ts` as `EMPLOYEE_META`), each with a unique `EmployeeId` slug: `xiaolei`, `xiaoce`, `xiaozi`, `xiaowen`, `xiaojian`, `xiaoshen`, `xiaofa`, `xiaoshu`. The `advisor` ID is for channel advisors.

Each employee has skills (many-to-many via `employee_skills`), performance stats, and can participate in teams and workflow steps.

### Component Organization

- `src/components/ui/` — shadcn/ui base components (25+). Add new ones via `npx shadcn add <component>`.
- `src/components/shared/` — Domain-specific reusable components (GlassCard, DataTable, PageHeader, EmployeeAvatar, ActivityFeed, WorkflowPipeline, etc.)
- `src/components/charts/` — Recharts wrappers (area, bar, donut, gauge, radar, heat curve)
- `src/components/layout/` — AppSidebar, Topbar
- `cn()` utility in `src/lib/utils.ts` for merging Tailwind classes

### Design System Rules (don't break these)

Every past round of style drift came from bypassing shared primitives. These rules keep the UI consistent:

**Always use the shared primitives. Never hand-roll:**
- Buttons → `<Button>` from `@/components/ui/button` (never `<button>`)
- Inputs → `<Input>` from `@/components/ui/input` (never `<input type='text'>`)
- Search boxes → `<SearchInput>` from `@/components/shared/search-input` (never `<div className="relative"><Search absolute .../><Input pl-8 .../></div>`)
- Dropdowns → `<Select>` from `@/components/ui/select` (never `<select>`)
- Multi-line inputs → `<Textarea>` from `@/components/ui/textarea` (never `<textarea>`)
- Date pickers → `<DatePicker>` / `<DateRangePicker>` from `@/components/shared/date-picker` (never Popover+Calendar built from scratch)
- Tabs → `<Tabs>` / `<TabsList>` / `<TabsTrigger>` from `@/components/ui/tabs`. Use `variant="default"` (filled pill) or `variant="line"` (underlined). Don't manually emulate via `className="bg-transparent border-0 p-0 h-auto"` — use the variant.
- Data tables → `<DataTable>` from `@/components/shared/data-table` (never hand-rolled flex/grid rows)
- Page titles → `<PageHeader>` from `@/components/shared/page-header`
- Cards → `<GlassCard>` from `@/components/shared/glass-card` (never `rounded-xl bg-white p-4 shadow`)

**Never override color classes via `className` on shared components.** The shared `Button` uses a liquid-glass translucent sky style. `<Button className="bg-primary text-white">...</Button>` defeats the shared style — use `variant` (`default` / `ghost` / `destructive` / `outline` / `secondary` / `link`) instead. Same for `<Input>`, `<SelectTrigger>`, `<Textarea>`, etc.

Known drift patterns to avoid (these have all appeared and been cleaned up — don't reintroduce):
- `<Input className="bg-white/60 border border-gray-200 focus:ring-blue-500/30">` — strip the overrides
- `<SelectTrigger className="bg-[var(--glass-input-bg)] border-[var(--glass-input-border)]">` — strip
- `<SelectTrigger className="border-0 bg-gray-100 dark:bg-gray-800">` — strip
- `<Textarea className="border-0 bg-gray-100 dark:bg-gray-800">` — strip
- `<TabsList className="bg-transparent border-0 p-0 h-auto">` — use `variant="line"` instead

**DataTable API (key patterns):**
```tsx
<DataTable
  rows={items}
  rowKey={(item) => item.id}
  columns={[
    { key: "name", header: "名称", render: (r) => r.name },              // flex column (default)
    { key: "status", header: "状态", width: "w-24", render: (r) => ... }, // Tailwind width class
    { key: "date", header: "时间", width: "120px", render: (r) => ... }, // CSS length
    { key: "count", header: "数量", align: "right", sortable: true, render: (r) => r.count },
  ]}
  // Optional: selection
  selectable
  selectedKeys={selected}
  onSelectionChange={setSelected}
  // Optional: sorting (controlled)
  sortKey={sortField}
  sortDirection={sortDir}
  onSortChange={(key, dir) => { ... }}
  // Optional: expandable rows. If `onExpandChange` is provided, row-click toggles
  // expansion and a chevron column appears. Omit it to drive expansion from an
  // action button inside a cell.
  expandedKeys={expanded}
  renderExpanded={(row) => <div>...</div>}
  // Optional: empty state + footer
  emptyMessage={<EmptyStateContent />}
  footer={<FooterStats />}
/>
```

**SearchInput API:**
```tsx
<SearchInput placeholder="搜索..." value={q} onChange={e => setQ(e.target.value)} />
<SearchInput className="w-60" inputClassName="h-8 text-xs" ... />  // compact variant
```
`className` goes on the wrapper (use for width / positioning). `inputClassName` forwards to the inner `<Input>` (use for size variants like `h-8 text-xs`).

**DatePicker / DateRangePicker API:**
```tsx
<DatePicker value={date} onChange={setDate} placeholder="选择日期" />
<DateRangePicker value={range} onChange={setRange} placeholder="选择日期范围" />
```
The trigger visually matches `<Input>` (bordered, muted) since date pickers are form inputs, not primary-action buttons.

**Dialog / Popover 内的可滚动列表必须用固定高度,不能用 `max-h-X`。** `max-h-X` 让容器跟着内容长度伸缩 — 用户输入搜索过滤、切 tab、增删条目时,弹层高度会不断抖动,体验差。统一规则:

```tsx
// ❌ 抖动:容器高度跟内容走
<div className="max-h-[300px] overflow-y-auto">
  {items.length === 0 ? <p className="text-center py-8">空</p> : items.map(...)}
</div>

// ✅ 稳定:容器固定高度,空态用 flex h-full 居中占满
<div className="h-[300px] overflow-y-auto">
  {items.length === 0
    ? <div className="flex h-full items-center justify-center"><p>空</p></div>
    : items.map(...)}
</div>
```

适用范围:所有 `<Dialog>` / `<Popover>` / `<Sheet>` 内部 `overflow-y-auto` 的容器,只要上方有搜索框 / 过滤按钮 / tab / 动态条目增删,都必须 `h-X` 不用 `max-h-X`。常见高度区间:popover 用 `h-60` ~ `h-[320px]`;dialog 内列表用 `h-[300px]` ~ `h-[400px]`。曾在 2026-05-14 一次性把 9 处历史抖动改完,不要再引入新的 `max-h-X` + `overflow-y-auto` 组合在弹层内。

**Enforcement:** `eslint.config.mjs` defines `no-restricted-syntax` rules (currently `warn`) that flag raw `<button>/<input>/<select>/<textarea>` in `src/app/**` and `src/components/**` (except under `src/components/ui/**`, `src/app/landing/**`, `src/components/media-assets/**`). Editor ESLint integrations show red squigglies on violations; CI output lists them too.

### Environment Variables

All environment variables are stored in **`.env.local`** (not `.env`). See `.env.example` for template:
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL              # Direct PostgreSQL connection for Drizzle

# AI Services (DeepSeek via OpenAI-compatible API)
OPENAI_API_KEY            # DeepSeek API key
OPENAI_API_BASE_URL       # https://api.deepseek.com/v1
OPENAI_MODEL              # deepseek-chat

# Web Search & Content Reading
SEARCH_PROVIDER           # 联网搜索 provider: bocha | tavily (默认 bocha,国内可直连)
BOCHA_API_KEY             # 博查 Web Search API (国内主通道,与 SEARCH_PROVIDER=bocha 配合)
TAVILY_API_KEY            # Tavily Search API (海外通道,与 SEARCH_PROVIDER=tavily 配合;Collection Hub tavilyAdapter 强制使用)
JINA_API_KEY              # Jina Reader API (网页深读)

# Trending Topics (热榜聚合)
TRENDING_API_URL
TRENDING_API_KEY
TRENDING_RESPONSE_MAPPING # JSON response field mapping

# Inngest (production only; dev auto-configures)
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
```

**Important:** Supabase may have connectivity issues. Pages that query the database at render time must add `export const dynamic = 'force-dynamic'` to avoid build-time DB connection timeouts.

### CMS Integration Layer (Phase 1)

Phase 1 交付的 `src/lib/cms/` 模块是 VibeTide → 华栖云 CMS 的唯一出口。

**导出（只从 `@/lib/cms` import，不直接访问内部文件）：**
- `CmsClient` + 5 接口（getChannels / getAppList / getCatalogTree / saveArticle / getArticleDetail）
- `publishArticleToCms({ articleId, appChannelSlug, operatorId, triggerSource })` — 核心入库
- `syncCmsCatalogs(orgId, options)` — 三步栏目同步
- `mapArticleToCms(article, ctx)` + `loadMapperContext(orgId, slug, org)`
- 错误类型：`CmsAuthError` / `CmsBusinessError` / `CmsNetworkError` / `CmsSchemaError` / `CmsConfigError`
- Feature flag：`isCmsPublishEnabled()` / `isCatalogSyncEnabled()`

**9 个 APP 栏目 slug（`ALL_APP_CHANNEL_SLUGS` 严格锁定）：**
`app_home / app_news / app_politics / app_sports / app_variety / app_livelihood_zhongcao / app_livelihood_tandian / app_livelihood_podcast / app_drama`

**关键 env（`.env.local`）：**
- `CMS_HOST` / `CMS_LOGIN_CMC_ID` / `CMS_LOGIN_CMC_TID` / `CMS_TENANT_ID` / `CMS_USERNAME`
- `VIBETIDE_CMS_PUBLISH_ENABLED`（默认 false，按 org 灰度）
- `VIBETIDE_CATALOG_SYNC_ENABLED`（默认 true）

**Inngest 函数：**
- `cmsCatalogSyncDaily`（每天 02:00 Asia/Shanghai 跑 org 级同步）
- `cmsCatalogSyncOnDemand`（event `cms/catalog-sync.trigger`）
- `cmsStatusPoll`（入库后 5 次指数退避轮询，event `cms/publication.submitted`）
- `cmsPublishRetry`（失败重试 3 次，event `cms/publication.retry`）

**配置 UI：** `/settings/cms-mapping`（绑定 app_channels → cms_catalogs + 同步日志）

### Scenario/Workflow 统一架构（B.1）

**单一真相源：** `workflow_templates` 表是 VibeTide 所有"场景"的唯一来源。

**数据流：**
- 首页场景网格、任务中心"发起新任务" 都调用 `listWorkflowTemplatesByOrg(orgId, filter)`
- 启动 mission 时双写 `scenario` (slug) + `workflowTemplateId` (uuid FK)
- `mission.scenario` 继续是 slug（builtin → legacy_scenario_key；custom → `custom_${nanoid(6)}`）
- 下游消费者（mission-executor / leader-plan / inngest / channels gateway）仍按 `mission.scenario` slug 分发（B.2 才迁到 workflowTemplateId）

**Category 12 值：** news / deep / social / advanced / livelihood / podcast / drama / daily_brief / video / analytics / distribution / custom

**Seed 来源（27+ builtin rows / org）：**
- SCENARIO_CONFIG (10)：`src/lib/constants.ts:456`（@deprecated，B.2 删）
- ADVANCED_SCENARIO_CONFIG (6)：`:610`（@deprecated）
- employeeScenarios.xiaolei (5)：迁到 workflow_templates
- 现有 templatesData (6)：补齐 icon/defaultTeam/appChannelSlug

**关键文件：**
- DAL: `src/lib/dal/workflow-templates.ts` (listWorkflowTemplatesByOrg / seedBuiltinTemplatesForOrg / getByLegacyKey / create / update / softDisable)
- Slug 工具: `src/lib/workflow-template-slug.ts` (templateToScenarioSlug)
- Seed 映射: `src/db/seed-builtin-workflows.ts` (buildBuiltinScenarioSeeds)
- Fallback: `src/lib/scenario-fallback.ts` (resolveScenarioConfig for mission display)
- Spec: `docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md`

**B.2 Pending（独立 spec）：** `/scenarios/customize` 重写、`channels/gateway.ts` 改读 DB、删除 SCENARIO_CONFIG 常量、DROP employee_scenarios 表、mission 下游消费者迁到 workflowTemplateId。

### Skill MD 标准（Track B / baoyu-inspired）

13 个 CMS/AIGC/场景 skill MD 按 baoyu-skills 规范标准化（Track B, 2026-04-19）：

**主文件规模：** 每个 `skills/<name>/SKILL.md` 目标 180-320 行（总计 ≤ 3500 行）

**Frontmatter 约定：**
- 保留：name / displayName / description / version / category
- 保留：metadata.{skill_kind, scenario_tags, compatibleEmployees, modelDependency, requires}
- 新增：metadata.implementation.{scriptPath, testPath}
- 新增：metadata.openclaw.{schemaPath, referenceSpec, subtemplatesPath?}
- 删除：metadata.runtime.{avgLatencyMs, maxConcurrency, timeoutMs, type}

**Body 10-12 章标准：**
1. 使用条件（合并 When/Prereq/Pre-flight）
2. 输入 / 输出（简要表，完整 Schema 外链）
3. 工作流 Checklist
4. 子模板分化（可选，摘要表）
5. 质量把关（合并自检+失败模式）
6. 输出模板 / 示例
7. EXTEND.md 示例
8. 上下游协作
9. 常见问题
10. 参考资料

**Script-heavy skill（duanju/zhongcao/podcast）子模板规范：**
- SKILL.md 只放摘要表（12+ / 4+ / 5+ 子类型矩阵）
- 详细规范写入 `src/lib/agent/skills/<name>-subtemplates.ts`（当前为 stub，follow-up 填充）

**Spec：** `docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md`
**Plan：** `docs/superpowers/plans/2026-04-19-skill-md-baoyu-standardization-plan.md`

### API Routes

`src/app/api/` has 10 route groups:
- `/ai/` — analysis, chat, edit (AI-powered content operations)
- `/chat/` — intent, intent-execute, stream (chat center backend)
- `/employees/`, `/inspiration/`, `/media-assets/`, `/missions/`, `/scenarios/`, `/skills/`, `/workflows/`
- `/inngest/` — Inngest webhook endpoint

### Agent System

- **10 files + tools dir** in `src/lib/agent/`: assembly, execution, index, intent-parser, intent-recognition, model-router, prompt-templates, step-io, tool-registry, types, `tools/`
- **Agent assembly pipeline:** Load employee → skills → knowledge bases → memories (top-10) → compute proficiency → filter tools by authority → build 7-layer system prompt
- **7-layer prompt:** Identity → Skills+Proficiency → Authority → Sensitive Topics → Knowledge → Memories → Output+Quality Self-Eval
- **Intent recognition** (`intent-recognition.ts`): AI-driven skill routing in chat center; parses user messages to determine which employee/skill to invoke
- **Model router** (`model-router.ts`): Routes LLM calls to appropriate providers

### Inngest (Background Jobs)

`src/inngest/functions/` contains 16 event-driven functions:
- **Content pipeline:** `hot-topic-crawl`, `hot-topic-enrichment`, `publishing-events`
- **Mission engine:** `execute-mission-task`, `check-task-dependencies`, `handle-task-failure`
- **AI operations:** `leader-plan`, `leader-consolidate`, `learning-engine`, `benchmarking-analysis`, `benchmarking-crawl`
- **Monitoring:** `analytics-report`, `daily-performance-snapshot`, `employee-status-guard`
- **Knowledge base:** `knowledge-base-vectorize` (Jina embeddings pipeline for KB documents)
- **Scheduler:** `scheduled-jobs-runner`（每分钟扫 `scheduled_jobs` 表派发对应 event；2026-05-29 起按 `kind` 分叉：platform 派 row.eventName，workflow_template 派统一 `scheduled-jobs/workflow-template.run`），`workflow-template-scheduled-launch`（订阅后者，调 `startMissionFromTemplateScheduled` 启动 mission，runtime source 标记 `module='schedule'`）
- Dev server auto-configures; production requires `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`

#### Workflow Template Schedules (2026-05-29)

任意 `workflow_template` 可挂 0..N 条 cron schedule（运营在 `/workflows/[id]` "定时任务" tab 上配置）；不影响手动启动入口——两者并存。

- **DAL:** `src/lib/dal/workflow-template-schedules.ts`（per-org per-template CRUD，强制 `kind='workflow_template'` + org 隔离）
- **Server actions:** `src/app/actions/workflow-template-schedules.ts`（auth + 模板 ownership 校验 + cron `cron-parser` 校验 + 周期下限 60 秒）
- **Cron 校验:** `src/lib/cron.ts`（`validateCronExpression(expr, tz)` 返回 `{ok, nextRuns[3]}` 或 `{ok:false, error}`）
- **Service 入口:** `startMissionFromTemplateScheduled(templateId, orgId, inputs, options)`（与 `startMissionFromTemplate` 共享 `_buildAndInsertMission` helper；跳过 `requireAuth`，显式接 orgId）
- **触发链路:** runner 每分钟扫表 → 派 typed event（带 `workflowTemplateId` / `organizationId` / `inputParams`）→ `workflowTemplateScheduledLaunch` handler → `startMissionFromTemplateScheduled`，`source.module='schedule'` + `sourceEntityId=jobId` 让 `missions_source_dedup_uidx` 自动去重
- **关闭:** UI 上 toggle enabled=false，下个分钟 tick 起停止派发
- **UI 入口（两处统一）:** ① 详情页 `/workflows/[id]` "定时任务" tab；② 编辑器 `/workflows/[id]/edit` 画布"入门" section 的 TriggerCard 卡片，点击在 Sheet 中嵌入同一个 `ScheduleListClient` 做完整 CRUD（`src/components/workflows/schedule-sheet.tsx`）。两入口共享 `ScheduleListClient` 的 `onSchedulesChange` 回调把 schedule 数同步给 TriggerCard 显示
- **已废弃（ADR-0002）:** `workflow_templates.triggerType` enum + `triggerConfig` jsonb 字段；编辑器 `BottomActionBar` 的"开启/已开启"按钮；TriggerCard 旧版"手动 ↔ 定时"切换。新代码不要恢复这些 stub —— 所有"是否定时 / cron 表达式 / 启用状态"都从 `scheduled_jobs(kind='workflow_template')` 派生

### Knowledge Base Module

Top-level module at `/knowledge-bases` for managing AI employee knowledge bases (separate from `/channel-knowledge` which is the channel DNA dashboard).

- **Routes:** `src/app/(dashboard)/knowledge-bases/` — list page + `[id]` detail page (4 tabs: 文档/绑定员工/同步日志/设置)
- **DAL:** `src/lib/dal/knowledge-bases.ts` — `listKnowledgeBaseSummariesByOrg`, `getKnowledgeBaseById`, `listKnowledgeItems`, `getKnowledgeBaseBindings`, `getKnowledgeBaseSyncLogs`, `loadEmbeddedKnowledgeItems`, `assertKnowledgeBaseOwnership`. All multi-tenant scoped via `organizationId`.
- **Server actions:** `src/app/actions/knowledge-bases.ts` — `createKnowledgeBase`, `updateKnowledgeBase`, `deleteKnowledgeBase`, `addKnowledgeItem`, `crawlUrlIntoKB`, `updateKnowledgeItem`, `deleteKnowledgeItem`, `reindexKnowledgeBase`
- **Ingestion:** 3 paths — manual paste, .md/.txt upload, URL crawl via existing Jina Reader (`src/lib/web-fetch.ts:181`)
- **Chunking:** `src/lib/knowledge/chunking.ts` — paragraph + sentence + char-based fallback, 500-800 chars per chunk with 50-char overlap
- **Embeddings:** `src/lib/knowledge/embeddings.ts` — Jina `jina-embeddings-v3` (1024 dim), batch 100 with retry/backoff. Async via Inngest `knowledge-base-vectorize`.
- **Retrieval:** `src/lib/knowledge/retrieval.ts` — application-layer cosine similarity over jsonb-stored vectors. V1 keeps jsonb (no pgvector); upgrade path documented when chunk count exceeds ~10k.
- **Agent integration:** `kb_search` tool in `tool-registry.ts` (`createKnowledgeBaseTools`). Auto-injected at execution time when employee has KB bindings (see `assembly.ts` and `execution.ts`). Filters by employee's bound KBs and skips KBs with `vectorization_status != 'done'`.

### Help Center Module

公开访问的产品帮助中心,挂在独立路由段 `src/app/help/`(不在 `(dashboard)` / `(auth)` 下),包括首页、分类页、详情页、FAQ、更新日志、搜索结果页;dashboard 内左下角浮动「小帮」AI 员工入口(`<HelpLauncher />`)。详见 `docs/superpowers/specs/2026-05-31-help-center-design.md` + `docs/superpowers/plans/2026-05-31-help-center-plan.md`。

- **Routes:** `src/app/help/` —— 独立 layout(不套 dashboard sidebar/topbar);6 个页面:`page.tsx`(首页)/ `[category]/page.tsx`(分类索引)/ `[category]/[slug]/page.tsx`(详情)/ `faq/page.tsx` / `changelog/page.tsx` / `search/page.tsx`;`not-found.tsx` 专属 404
- **内容仓:** `content/help/` 走 MDX:`<category>/_meta.json` 描述分类元数据(title/icon/groups),`<category>/<slug>.mdx` 是文档正文,`faq.json` 是 FAQ 扁平 Q&A,`changelog/YYYY-MM.mdx` 是月度更新日志。**frontmatter 日期字段必须加引号** (`publishedAt: "2026-05-31"`),否则 gray-matter YAML 默认解析成 JS Date 对象,zod string regex 拒绝
- **数据层:** `src/lib/help/` —— `types.ts`(`HelpFrontmatterSchema` / `HelpCategoryMetaSchema` zod)/ `content.ts`(5 个 cached loader:listAllDocs / listDocsByCategory / getCategoryMeta / getDocBySlug / listPopularDocs;`HELP_CONTENT_ROOT` env 可切换便于测试)/ `toc.ts`(remarkExtractToc plugin,用 `github-slugger` 与 rehype-slug 算法一致)/ `faq.ts` / `changelog.ts` / `search-client.ts`(客户端 pagefind) / `changelog-meta.ts`(构建期 auto-generated,LATEST_CHANGELOG_AT 时间戳)
- **MDX 引擎:** `next-mdx-remote-client/rsc` 在 RSC 渲染期编译,`/help/**` 全部 `force-static`;`@shikijs/rehype` + `transformerNotationDiff` 构建期高亮(`// [!code ++]` 支持);`rehype-slug` + `rehype-autolink-headings` 给 H2/H3 加 id 与锚点;TOC 抽取**独立**于正文渲染(`getDocBySlug` 单跑一次 remark pipeline 把 vfile.data.toc 取出来,因 `<MDXRemote>` 不透传 vfile.data)
- **8 个自定义 MDX 组件:** `src/components/help/mdx/` —— Callout(tip/warn/note/info 4 色)/ Steps / ScreenshotZoom(Dialog 全屏)/ VideoEmbed / EmployeeBadge(接 `EMPLOYEE_META` 渲染 SVG 头像)/ KeyboardKey / DocLink(构建期 verify)/ Tabs(包 `@/components/ui/tabs`,别名 MdxTabs)。`index.tsx` 统一导出 `mdxComponents`,含标准元素重写(`<a>` 内链 `startsWith("/") && !startsWith("//")` 排除 protocol-relative)
- **搜索:** Pagefind v1,`scripts/build-help-search.ts` 是 `postbuild` 钩子(`pnpm run build` 串 `next build && tsx ...`)扫 `.next/server/app/help/**/*.html` 产出 `public/pagefind/*` 索引;`forceLanguage:"zh-cn"`,`excludeSelectors:["pre"]` 不索引代码块。客户端 `searchHelp(q)` 走 `import("/pagefind/pagefind.js")` 延迟加载 wasm(~200KB)。两个交互入口:顶栏 Cmd+K SearchDialog(`h-[400px]` 固定高度防抖)+ `/help/search?q=` 全量结果页
- **HelpLauncher 5 态:** `src/components/help/launcher/help-launcher.tsx` + `xiaobang-avatar.tsx` —— idle(眨眼 + 问号灯泡 float)/ hover(framer-motion spring scale+rotate + 气泡)/ active(scale 0.92 → 跳 /help)/ wave(idle 30s 无活动 + 同 session ≤ 3 次 + 相邻 ≥ 5min,挥手 1.2s + 气泡)/ first-tip(localStorage 防重,首次 5s 弹气泡)。`?` Shift+/ 全局快捷键(屏蔽 input/textarea/contenteditable/`[data-help-shortcut-ignore]`)。红点 badge:`LATEST_CHANGELOG_AT > localStorage.help-changelog-last-seen` 时显示。**CSS 类用 `avatar-anim-hand-wave`,不要 `avatar-anim-wave`**(后者已被 XiaofaAvatar 雷达波占用)。`/help/*` 内自动 `return null`
- **反馈表:** `help_feedback` 表(Drizzle schema `src/db/schema/help-feedback.ts`,7 字段 + 2 index),server action `src/app/actions/help-feedback.ts`(第一行必须 `"use server"`)。落表 + IP sha256 hash + `count() ... INTERVAL '1 minute' > HELP_FEEDBACK_RATE_LIMIT (env 默认 10)` 静默假成功防滥用。**MVP 不暴露读接口**,运营走 Drizzle Studio
- **proxy 放行:** `src/proxy.ts:8` `isPublic()` 含 `pathname.startsWith("/help")`,未登录可访问全部 `/help/*`
- **构建管道:** `package.json` scripts —— `predev` / `prebuild` 跑 `build-help-meta` 生成 changelog-meta.ts;`build` 串 `verify-help-links → next build → build-help-search`,任何一步失败构建挂
- **文档维护流程:** 写新 mdx → 改/加 `_meta.json` 把 slug 列入 groups → 跑 `pnpm exec tsx scripts/verify-help-links.ts` 校验 DocLink 完整 → `pnpm run build` 全过 → commit。FAQ 直接改 `content/help/faq.json`(无 build 校验,但 relatedDocs 要与真实 slug 对齐)

## AI SDK Notes

This project uses **AI SDK (Vercel) v6**. Key API differences from older versions:
- Use `stopWhen: stepCountIs(N)` not `maxSteps`
- Use `inputSchema` not `parameters` for tool definitions
- Use `maxOutputTokens` not `maxTokens`
- Import from `ai` package: `generateText`, `tool`, `stopWhen`, `stepCountIs`

## Verification

After implementing features, always verify before considering work complete:
1. `npx tsc --noEmit` — Type check passes
2. `npm run build` — Production build passes

## Conventions

- All UI text is in Chinese (Simplified)
- Product requirement docs are in `docs/requirement/` (7 comprehensive spec documents)
- Design/implementation plans go in `docs/plans/`
- Use OpenSpec workflow for architectural changes (see `openspec/AGENTS.md`)
- Glass UI design system: follow existing component patterns in `src/components/shared/` for consistent styling (GlassCard, frosted backgrounds, gradient accents)

## Git Workflow

主分支是 `main`，正式发布的代码最终都要回到 `main`。分支 / worktree 不再被禁止，可用于并行的 subagent 工作流，但需要遵循以下纪律：

- **常规小改动直接落 `main`**：单人单线程的修改、bug fix、小重构，commit + push 到 `main` 是默认动作，不必拆分支。
- **subagent / 并行工作可以开分支或 worktree**：当存在 2 个以上独立 subagent 同时改不同子模块、或某个 agent 想在隔离环境里做大改动时，鼓励用 `git worktree add` 或临时分支隔离，避免互相踩 working tree。命名约定：`claude/<topic>` 或 `feature/<topic>`，`.worktrees/<topic>` 放工作区目录。
- **分支生命周期短**：分支只用于隔离一次 subagent 任务或一次大 refactor，完成后立刻 merge/rebase 回 `main` 并删除分支与 worktree。不要长期维护多条平行分支。
- **每个 commit 都能独立 build**：无论在 `main` 还是临时分支，每个 commit 都要 `tsc --noEmit` 零错误、`npm run build` 通过。中间态必然 break 的（例如 Phase 3 删除常量引发 Phase 4 连锁修改），合并成一个 commit。
- **不要 force-push `main`**；临时分支 force-push 没问题（rebase 后常需要）。merge 回 `main` 用 fast-forward 或 squash，避免无意义的 merge commit。
- **`.worktrees/` 和 `.claude/worktrees/` 在 `.gitignore` 中**——这是为了避免 worktree 工作目录被作为子目录追踪进 `main`，不是禁止使用 worktree 本身。worktree 检出的分支正常追踪。

所有的按钮或lab等任何可以点击触发事件的按钮，不要带边框

所有的回复采用中文