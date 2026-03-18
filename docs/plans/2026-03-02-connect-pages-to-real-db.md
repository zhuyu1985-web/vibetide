# Connect 3 Core Pages to Real Supabase DB — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire team-hub, employee/[id], and team-builder server pages to the real Supabase PostgreSQL database via the existing Drizzle ORM DAL, and add organization-scoped RLS policies.

**Architecture:** Server component pages call async DAL functions (already written in `src/lib/dal/`) which query Supabase via Drizzle ORM. RLS policies enforce organization-level data isolation through a `get_user_org_id()` helper function. The seed script populates initial data using a direct database connection that bypasses RLS.

**Tech Stack:** Next.js 16.1.6, Drizzle ORM 0.45.1, Supabase (PostgreSQL), TypeScript 5

---

### Task 1: Push database schema to Supabase

**Files:**
- Read: `drizzle.config.ts` (verify config)
- Read: `.env.local` (verify DATABASE_URL is set)

**Step 1: Verify DATABASE_URL is configured**

Run: `grep DATABASE_URL /Users/zhuyu/dev/chinamcloud/vibetide/.env.local | head -1`
Expected: A line like `DATABASE_URL=postgresql://...` (not a placeholder)

**Step 2: Push schema to create all 14 tables**

Run: `cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run db:push`
Expected: Output showing tables created (organizations, user_profiles, ai_employees, skills, employee_skills, teams, team_members, workflow_templates, workflow_instances, workflow_steps, team_messages, tasks, knowledge_bases, employee_knowledge_bases) plus enum types. No errors.

**Step 3: Commit**

No files changed — schema push is a runtime operation against the DB.

---

### Task 2: Seed the database with initial data

**Files:**
- Run: `src/db/seed.ts`

**Step 1: Run the seed script**

Run: `cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run db:seed`
Expected output (approximate):
```
Seeding database...

1. Creating organization...
   Created org: Vibe Media Demo (uuid)

2. Inserting AI employees and skills...
   小雷 (xiaolei) -> uuid
   小策 (xiaoce) -> uuid
   小资 (xiaozi) -> uuid
   小文 (xiaowen) -> uuid
   小剪 (xiaojian) -> uuid
   小审 (xiaoshen) -> uuid
   小发 (xiaofa) -> uuid
   小数 (xiaoshu) -> uuid
   Inserted 8 employees

3. Inserting teams...
   Team: 新闻快讯突击队
   Team: 深度报道精英组
   Team: 新媒体运营全能队

4. Inserting workflow instances...
   Workflow: AI手机大战：华为、苹果、三星三方角力
   Workflow: 新能源汽车集体降价潮来袭

5. Inserting team messages...
   Inserted 8 messages

Seed complete!
```

**Step 2: Verify in Drizzle Studio (optional)**

Run: `cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run db:studio`
Expected: Opens browser with database viewer showing populated tables.

---

### Task 3: Wire team-hub page to DAL

**Files:**
- Modify: `src/app/(dashboard)/team-hub/page.tsx`

**Step 1: Update page.tsx to use DAL**

Replace the entire file content with:

```typescript
import { getEmployees } from "@/lib/dal/employees";
import { getWorkflows } from "@/lib/dal/workflows";
import { getTeamMessages } from "@/lib/dal/messages";
import { TeamHubClient } from "./team-hub-client";

export default async function TeamHubPage() {
  const [employees, workflows, messages] = await Promise.all([
    getEmployees(),
    getWorkflows(),
    getTeamMessages(),
  ]);

  return (
    <TeamHubClient
      employees={employees}
      workflows={workflows}
      messages={messages}
    />
  );
}
```

Key changes:
- Removed 3 mock data imports (`@/data/employees`, `@/data/workflows`, `@/data/messages`)
- Added 3 DAL imports (`@/lib/dal/employees`, `@/lib/dal/workflows`, `@/lib/dal/messages`)
- Made function `async`
- Used `Promise.all` to fetch employees, workflows, messages concurrently
- Removed the "when database is connected" comments (we're connected now)

**Step 2: Type check**

Run: `cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide
git add src/app/\(dashboard\)/team-hub/page.tsx
git commit -m "feat: wire team-hub page to real Supabase database via DAL"
```

---

### Task 4: Wire employee/[id] page to DAL

**Files:**
- Modify: `src/app/(dashboard)/employee/[id]/page.tsx`

**Step 1: Update page.tsx to use DAL**

Replace the entire file content with:

```typescript
import { getEmployee } from "@/lib/dal/employees";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { notFound } from "next/navigation";
import { EmployeeProfileClient } from "./employee-profile-client";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployee(id);
  const meta = EMPLOYEE_META[id as EmployeeId];

  if (!employee || !meta) {
    notFound();
  }

  return <EmployeeProfileClient employee={employee} />;
}
```

Key changes:
- Import changed from `@/data/employees` to `@/lib/dal/employees`
- `getEmployee(id)` now has `await` (DAL version is async)
- Removed "when database is connected" comments

**Step 2: Type check**

Run: `cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide
git add src/app/\(dashboard\)/employee/\[id\]/page.tsx
git commit -m "feat: wire employee profile page to real Supabase database via DAL"
```

---

### Task 5: Wire team-builder page to DAL

**Files:**
- Modify: `src/app/(dashboard)/team-builder/page.tsx`

**Step 1: Update page.tsx to use DAL**

Replace the entire file content with:

```typescript
import { getEmployees } from "@/lib/dal/employees";
import { teamScenarios } from "@/data/teams";
import { TeamBuilderClient } from "./team-builder-client";

export default async function TeamBuilderPage() {
  const employees = await getEmployees();

  return (
    <TeamBuilderClient
      employees={employees}
      scenarios={teamScenarios}
    />
  );
}
```

Key changes:
- Replaced `import { employees } from "@/data/employees"` with DAL call
- `teamScenarios` stays as static import (UI config, not DB data)
- Made function `async`
- Removed "when database is connected" comments

**Step 2: Type check**

Run: `cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide
git add src/app/\(dashboard\)/team-builder/page.tsx
git commit -m "feat: wire team-builder page to real Supabase database via DAL"
```

---

### Task 6: Create RLS policies

**Files:**
- Create: `supabase/migrations/0001_rls_policies.sql`

**Step 1: Write the RLS migration SQL**

Create `supabase/migrations/0001_rls_policies.sql` with this content:

```sql
-- =============================================================
-- Row Level Security policies for Vibetide
-- Organization-scoped: users can only access their own org's data
-- =============================================================

-- Helper: get the current user's organization_id from user_profiles
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM user_profiles
  WHERE id = auth.uid()
$$;

-- =============================================================
-- 1. organizations
-- =============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id = public.get_user_org_id());

-- =============================================================
-- 2. user_profiles
-- =============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view profiles in their organization"
  ON user_profiles FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- =============================================================
-- 3. ai_employees
-- =============================================================
ALTER TABLE ai_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AI employees in their organization"
  ON ai_employees FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can manage AI employees in their organization"
  ON ai_employees FOR ALL
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- =============================================================
-- 4. skills
-- =============================================================
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view skills in their organization"
  ON skills FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can manage skills in their organization"
  ON skills FOR ALL
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- =============================================================
-- 5. employee_skills (scoped through ai_employees)
-- =============================================================
ALTER TABLE employee_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employee_skills in their organization"
  ON employee_skills FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM ai_employees WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Users can manage employee_skills in their organization"
  ON employee_skills FOR ALL
  USING (
    employee_id IN (
      SELECT id FROM ai_employees WHERE organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM ai_employees WHERE organization_id = public.get_user_org_id()
    )
  );

-- =============================================================
-- 6. teams
-- =============================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view teams in their organization"
  ON teams FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can manage teams in their organization"
  ON teams FOR ALL
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- =============================================================
-- 7. team_members (scoped through teams)
-- =============================================================
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team_members in their organization"
  ON team_members FOR SELECT
  USING (
    team_id IN (
      SELECT id FROM teams WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Users can manage team_members in their organization"
  ON team_members FOR ALL
  USING (
    team_id IN (
      SELECT id FROM teams WHERE organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT id FROM teams WHERE organization_id = public.get_user_org_id()
    )
  );

-- =============================================================
-- 8. workflow_templates
-- =============================================================
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow_templates in their organization"
  ON workflow_templates FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can manage workflow_templates in their organization"
  ON workflow_templates FOR ALL
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- =============================================================
-- 9. workflow_instances (scoped through teams)
-- =============================================================
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow_instances in their organization"
  ON workflow_instances FOR SELECT
  USING (
    team_id IS NULL
    OR team_id IN (
      SELECT id FROM teams WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Users can manage workflow_instances in their organization"
  ON workflow_instances FOR ALL
  USING (
    team_id IS NULL
    OR team_id IN (
      SELECT id FROM teams WHERE organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    team_id IS NULL
    OR team_id IN (
      SELECT id FROM teams WHERE organization_id = public.get_user_org_id()
    )
  );

-- =============================================================
-- 10. workflow_steps (scoped through workflow_instances -> teams)
-- =============================================================
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow_steps in their organization"
  ON workflow_steps FOR SELECT
  USING (
    workflow_instance_id IN (
      SELECT wi.id FROM workflow_instances wi
      LEFT JOIN teams t ON wi.team_id = t.id
      WHERE wi.team_id IS NULL
         OR t.organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Users can manage workflow_steps in their organization"
  ON workflow_steps FOR ALL
  USING (
    workflow_instance_id IN (
      SELECT wi.id FROM workflow_instances wi
      LEFT JOIN teams t ON wi.team_id = t.id
      WHERE wi.team_id IS NULL
         OR t.organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    workflow_instance_id IN (
      SELECT wi.id FROM workflow_instances wi
      LEFT JOIN teams t ON wi.team_id = t.id
      WHERE wi.team_id IS NULL
         OR t.organization_id = public.get_user_org_id()
    )
  );

-- =============================================================
-- 11. team_messages (scoped through teams)
-- =============================================================
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team_messages in their organization"
  ON team_messages FOR SELECT
  USING (
    team_id IS NULL
    OR team_id IN (
      SELECT id FROM teams WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Users can manage team_messages in their organization"
  ON team_messages FOR ALL
  USING (
    team_id IS NULL
    OR team_id IN (
      SELECT id FROM teams WHERE organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    team_id IS NULL
    OR team_id IN (
      SELECT id FROM teams WHERE organization_id = public.get_user_org_id()
    )
  );

-- =============================================================
-- 12. tasks
-- =============================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks in their organization"
  ON tasks FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can manage tasks in their organization"
  ON tasks FOR ALL
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- =============================================================
-- 13. knowledge_bases
-- =============================================================
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view knowledge_bases in their organization"
  ON knowledge_bases FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can manage knowledge_bases in their organization"
  ON knowledge_bases FOR ALL
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- =============================================================
-- 14. employee_knowledge_bases (scoped through ai_employees)
-- =============================================================
ALTER TABLE employee_knowledge_bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employee_knowledge_bases in their organization"
  ON employee_knowledge_bases FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM ai_employees WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Users can manage employee_knowledge_bases in their organization"
  ON employee_knowledge_bases FOR ALL
  USING (
    employee_id IN (
      SELECT id FROM ai_employees WHERE organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM ai_employees WHERE organization_id = public.get_user_org_id()
    )
  );
```

**Step 2: Apply the RLS migration via Supabase SQL Editor**

Since we use `db:push` for schema (not `db:migrate`), apply this SQL directly:

Run: `cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsx -e "
import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'fs';
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const migration = readFileSync('supabase/migrations/0001_rls_policies.sql', 'utf-8');
await sql.unsafe(migration);
console.log('RLS policies applied successfully');
await sql.end();
"`

Expected: `RLS policies applied successfully`

**Step 3: Commit**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide
git add supabase/migrations/0001_rls_policies.sql
git commit -m "feat: add organization-scoped RLS policies for all tables"
```

---

### Task 7: End-to-end validation

**Files:**
- None (verification only)

**Step 1: Type check the full project**

Run: `cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit`
Expected: No errors

**Step 2: Start dev server**

Run: `cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run dev`
Expected: Starts without errors on localhost:3000

**Step 3: Verify team-hub page loads with DB data**

Open: `http://localhost:3000/team-hub`
Expected: Shows 8 AI employees in the left panel, 2 active workflows, 8 team messages. Same content as before (from seed data matching mock data).

**Step 4: Verify employee profile page loads with DB data**

Open: `http://localhost:3000/employee/xiaolei`
Expected: Shows 小雷's profile with 3 skills (全网热点监控, 热度预测模型, 舆情分析), stats, and tabs.

**Step 5: Verify team-builder page loads with DB data**

Open: `http://localhost:3000/team-builder`
Expected: Shows 4 scenarios in step 1. Clicking a scenario shows 8 employees in step 2 with checkboxes.

**Step 6: Final commit (if any fixes needed)**

If any adjustments were made during validation, commit them.
