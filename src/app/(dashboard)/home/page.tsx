import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { missions } from "@/db/schema/missions";
import { savedConversations } from "@/db/schema/saved-conversations";
import { userProfiles } from "@/db/schema/users";
import { desc, eq } from "drizzle-orm";
import { getEmployees } from "@/lib/dal/employees";
import {
  listTemplatesForHomepageByTab,
  type HomepageTabKey,
} from "@/lib/dal/workflow-templates-listing";
import type { ScenarioCardData } from "@/lib/types";
import type { WorkflowTemplateRow } from "@/db/types";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

// 2026-04-20 首页 tab 重构 — "主流场景 + 8 职能 + 我的工作流" = 10 tab，
// 服务端并行 fetch 所有 tab 数据，支持切换无感。
const HOMEPAGE_TAB_KEYS: HomepageTabKey[] = [
  "featured",
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
  "custom",
];

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
  const scenarioMap: Record<string, ScenarioCardData[]> = {};
  let employeeDbIdMap: Record<string, string> = {};
  let templatesByTab: Record<string, WorkflowTemplateRow[]> = {};

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

      // 2026-04-20 首页 tab 重构 — 并行 fetch 10 个 tab 数据。
      if (orgId) {
        try {
          const results = await Promise.all(
            HOMEPAGE_TAB_KEYS.map((key) =>
              listTemplatesForHomepageByTab(orgId, key),
            ),
          );
          templatesByTab = Object.fromEntries(
            HOMEPAGE_TAB_KEYS.map((key, i) => [key, results[i]]),
          );
        } catch {
          // Graceful degradation — fall through with an empty tab map.
        }
      }
    }

    // Legacy `employee_scenarios` table dropped 2026-04-20 —
    // scenarioMap stays as an empty record; per-employee "chip" scenarios in
    // the chat input are sourced elsewhere now.

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
        templatesByTab={templatesByTab}
      />
    </Suspense>
  );
}
