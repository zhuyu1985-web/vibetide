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

Two route groups under `src/app/`:
- `(auth)/` — Login, register, OAuth callback. No layout protection.
- `(dashboard)/` — All 20+ dashboard pages. Protected by auth check in layout.tsx which redirects to `/login` if unauthenticated.

Root page (`/`) redirects authenticated users to `/team-hub`, unauthenticated to `/login`.

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

- **60 tables** defined across 27 schema files in `src/db/schema/`
- **37 enums** in `src/db/schema/enums.ts`
- **Key tables:** `organizations`, `user_profiles`, `ai_employees`, `skills`, `employee_skills`, `employee_memories`, `teams`, `team_members`, `workflow_templates`, `workflow_instances`, `workflow_steps`, `workflow_artifacts`, `team_messages`, `tasks`, `knowledge_bases`, `employee_knowledge_bases`
- **Types** auto-derived in `src/db/types.ts` via `InferSelectModel`/`InferInsertModel`
- **Connection** in `src/db/index.ts`: uses `postgres` driver with `{ prepare: false }` (required for Supabase PgBouncer)
- **Migrations** output to `supabase/migrations/`
- Multi-tenant: all core tables have `organization_id` foreign key

### Auth Flow

- **Supabase clients:** `src/lib/supabase/client.ts` (browser), `server.ts` (RSC/actions), `middleware.ts` (session refresh)
- **Middleware** (`src/middleware.ts`): Refreshes session cookies, protects dashboard routes, redirects auth pages for logged-in users
- **Server Actions** in `src/app/actions/auth.ts`: `signIn`, `signUp`, `signOut`
- Email/password auth only (no social login)

### AI Employee System

8 preset AI employees (defined in `src/lib/constants.ts` as `EMPLOYEE_META`), each with a unique `EmployeeId` slug: `xiaolei`, `xiaoce`, `xiaozi`, `xiaowen`, `xiaojian`, `xiaoshen`, `xiaofa`, `xiaoshu`. The `advisor` ID is for channel advisors.

Each employee has skills (many-to-many via `employee_skills`), performance stats, and can participate in teams and workflow steps.

### Component Organization

- `src/components/ui/` — shadcn/ui base components (25+). Add new ones via `npx shadcn add <component>`.
- `src/components/shared/` — Domain-specific reusable components (GlassCard, EmployeeAvatar, ActivityFeed, WorkflowPipeline, etc.)
- `src/components/charts/` — Recharts wrappers (area, bar, donut, gauge, radar, heat curve)
- `src/components/layout/` — AppSidebar, Topbar
- `cn()` utility in `src/lib/utils.ts` for merging Tailwind classes

### Environment Variables

All environment variables are stored in **`.env.local`** (not `.env`). See `.env.example` for template:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL          # Direct PostgreSQL connection for Drizzle
ANTHROPIC_API_KEY     # For AI SDK agent execution
ZHIPU_API_KEY         # For GLM-5 model (skill testing)
```

**Important:** Supabase may have connectivity issues. Pages that query the database at render time must add `export const dynamic = 'force-dynamic'` to avoid build-time DB connection timeouts.

### Agent System

- **8 agent files** in `src/lib/agent/`: assembly, execution, intent-parser, prompt-templates, step-io, tool-registry, types, index
- **Agent assembly pipeline:** Load employee → skills → knowledge bases → memories (top-10) → compute proficiency → filter tools by authority → build 7-layer system prompt
- **7-layer prompt:** Identity → Skills+Proficiency → Authority → Sensitive Topics → Knowledge → Memories → Output+Quality Self-Eval
- **Workflow engine:** `src/inngest/functions/execute-workflow.ts` — Inngest-based, with quality gates, token budget, artifact persistence

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