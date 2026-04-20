import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { missions } from "@/db/schema/missions";
import { savedConversations } from "@/db/schema/saved-conversations";
import { userProfiles } from "@/db/schema/users";
import { desc, eq } from "drizzle-orm";
import { getEmployees } from "@/lib/dal/employees";
import { listWorkflowTemplatesByOrg } from "@/lib/dal/workflow-templates";
import type { ScenarioCardData } from "@/lib/types";
import type { WorkflowTemplateRow } from "@/db/types";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let recentMissions: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    sourceModule?: string;
  }> = [];
  let recentConversations: Array<{
    id: string;
    title: string;
    employeeSlug: string;
    updatedAt: string;
  }> = [];
  let scenarioMap: Record<string, ScenarioCardData[]> = {};
  let employeeDbIdMap: Record<string, string> = {};
  let workflows: WorkflowTemplateRow[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Get user's organization
      const profile = await db
        .select({ organizationId: userProfiles.organizationId })
        .from(userProfiles)
        .where(eq(userProfiles.id, user.id))
        .limit(1);

      const orgId = profile[0]?.organizationId;

      // Fetch recent missions (missions belong to org)
      if (orgId) {
        const missionsResult = await db
          .select({
            id: missions.id,
            title: missions.title,
            status: missions.status,
            createdAt: missions.createdAt,
            sourceModule: missions.sourceModule,
          })
          .from(missions)
          .where(eq(missions.organizationId, orgId))
          .orderBy(desc(missions.createdAt))
          .limit(5);

        recentMissions = missionsResult.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          sourceModule: m.sourceModule ?? undefined,
        }));
      }

      // Fetch recent conversations (owned by user)
      const convsResult = await db
        .select({
          id: savedConversations.id,
          title: savedConversations.title,
          employeeSlug: savedConversations.employeeSlug,
          updatedAt: savedConversations.updatedAt,
        })
        .from(savedConversations)
        .where(eq(savedConversations.userId, user.id))
        .orderBy(desc(savedConversations.updatedAt))
        .limit(5);

      recentConversations = convsResult.map((c) => ({
        ...c,
        updatedAt: c.updatedAt.toISOString(),
      }));

      // B.1 Unified Scenario Workflow — fetch enabled builtin workflow templates
      // for this org so <HomeClient> can render them (Task 16 consumes the prop).
      if (orgId) {
        try {
          workflows = await listWorkflowTemplatesByOrg(orgId, {
            isBuiltin: true,
            isEnabled: true,
          });
        } catch {
          // Graceful degradation — fall through with workflows = []
        }
      }
    }

    // Legacy `employee_scenarios` table dropped 2026-04-20 —
    // scenarioMap stays as an empty record until HomeClient is rewritten
    // to consume workflow_templates directly (Phase 3).

    // Fetch employees to build slug → dbId map for scenario execution
    try {
      const employees = await getEmployees();
      employeeDbIdMap = Object.fromEntries(
        employees.map((e) => [e.id, e.dbId])
      );
    } catch {
      // Graceful degradation
    }
  } catch {
    // Graceful degradation — show empty data
  }

  return (
    <Suspense>
      <HomeClient
        recentMissions={recentMissions}
        recentConversations={recentConversations}
        scenarioMap={scenarioMap}
        employeeDbIdMap={employeeDbIdMap}
        workflows={workflows}
      />
    </Suspense>
  );
}
