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
npm run dev          # Start Next.js dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check (no emit)

# Database (requires DATABASE_URL in .env.local)
npm run db:push      # Push Drizzle schema to Supabase (dev)
npm run db:generate  # Generate SQL migration files
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio (visual DB browser)
npm run db:seed      # Seed database (npx tsx src/db/seed.ts)
```

## Tech Stack

- **Framework:** Next.js 16.1.6, React 19, TypeScript 5 (strict mode)
- **Database:** Supabase (PostgreSQL) via Drizzle ORM 0.45.1 with `postgres` driver
- **Auth:** Supabase Auth (@supabase/ssr for SSR cookie management)
- **AI:** AI SDK (Vercel) v6, @ai-sdk/anthropic
- **UI:** shadcn/ui (new-york style), Radix UI, Tailwind CSS v4, Lucide icons
- **Charts:** Recharts 3.7
- **Animation:** Framer Motion
- **Automation:** Inngest (background jobs, event-driven workflows)
- **Path alias:** `@/*` maps to `./src/*`

## Architecture

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
- **Connection** in `src/db/index.ts`: uses `postgres` driver with `{ prepare: false }` (required for Supabase PgBouncer)
- **Migrations** output to `supabase/migrations/`
- Multi-tenant: all core tables have `organization_id` foreign key

### Auth Flow

- **Supabase clients:** `src/lib/supabase/client.ts` (browser), `server.ts` (RSC/actions)
- **Middleware helper** (`src/lib/supabase/middleware.ts`): `updateSession()` refreshes cookies, redirects unauthenticated users to `/login`, redirects authenticated users away from auth pages to `/home`. Note: no active root `middleware.ts` file currently exists.
- **Server Actions** in `src/app/actions/auth.ts`: `signIn`, `signUp`, `signOut`
- Email/password auth only (no social login)

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
TAVILY_API_KEY            # Tavily Search API (全网搜索)
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
- Dev server auto-configures; production requires `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`

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

所有的按钮或lab等任何可以点击触发事件的按钮，不要带边框

所有的回复采用中文