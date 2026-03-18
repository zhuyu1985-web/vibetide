# Connect 3 Core Pages to Real Supabase Database

**Date:** 2026-03-02
**Status:** Approved
**Approach:** Direct Switch (Approach A)

## Scope

Connect 3 already-migrated server component pages to the real Supabase PostgreSQL database via the existing Drizzle ORM DAL layer. Add basic organization-scoped RLS policies.

**In scope:**
- team-hub, employee/[id], team-builder pages
- Database schema push + seed data
- Organization-scoped RLS policies

**Out of scope:**
- Other 20 dashboard pages (remain on mock data)
- Role-based access control (admin/editor/viewer)
- Real-time subscriptions

## Database Setup/

1. Run `npm run db:push` to create all 14 tables from existing Drizzle schema
2. Run `npm run db:seed` to populate: 8 AI employees, 24 skills, 3 teams, 2 workflow instances (16 steps), 8 messages
3. Prerequisite: `.env.local` with valid `DATABASE_URL`

## Page Wiring

### team-hub/page.tsx

Replace mock data imports with DAL calls:
- `employees` from `@/data/employees` -> `getEmployees()` from `@/lib/dal/employees`
- `workflows` from `@/data/workflows` -> `getWorkflows()` from `@/lib/dal/workflows`
- `teamMessages` from `@/data/messages` -> `getTeamMessages()` from `@/lib/dal/messages`
- Make function async

### employee/[id]/page.tsx

- `getEmployee` from `@/data/employees` -> `getEmployee` from `@/lib/dal/employees`
- Already async, minimal change

### team-builder/page.tsx

- `employees` from `@/data/employees` -> `getEmployees()` from `@/lib/dal/employees`
- `teamScenarios` stays as static import (UI configuration, not entity data)
- Make function async

## RLS Design

### Organization-scoped tables (direct `organization_id` column)
- organizations, user_profiles, ai_employees, skills, teams, workflow_templates, knowledge_bases, tasks

### Parent-scoped tables (via joins)
- employee_skills (through ai_employees)
- team_members (through teams)
- workflow_instances (through teams)
- workflow_steps (through workflow_instances)
- team_messages (through teams)
- employee_knowledge_bases (through ai_employees)

### Implementation
- Single SQL file: `supabase/migrations/0001_rls_policies.sql`
- Helper function: `get_user_org_id()` reads user's org from user_profiles
- All tables get RLS enabled
- SELECT/INSERT/UPDATE/DELETE policies scoped to user's organization
- Seed script uses direct DATABASE_URL connection (bypasses RLS)

## Files Changed

| File | Action |
|------|--------|
| `src/app/(dashboard)/team-hub/page.tsx` | Modify: swap mock imports to DAL |
| `src/app/(dashboard)/employee/[id]/page.tsx` | Modify: swap import to DAL |
| `src/app/(dashboard)/team-builder/page.tsx` | Modify: swap import to DAL |
| `supabase/migrations/0001_rls_policies.sql` | Create: RLS policies |

## Validation

1. `npm run db:push` succeeds
2. `npm run db:seed` populates all data
3. `npx tsc --noEmit` passes
4. `npm run dev` starts without errors
5. `/team-hub` displays employees, workflows, messages from DB
6. `/employee/xiaolei` shows profile with skills from DB
7. `/team-builder` lists employees for team composition from DB
