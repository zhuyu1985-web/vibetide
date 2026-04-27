export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import { getEmployees } from "@/lib/dal/employees";
import { getSavedConversations } from "@/lib/dal/conversations";
import { listTemplatesForHomepageByTab } from "@/lib/dal/workflow-templates-listing";
import { ChatCenterClient } from "./chat-center-client";
import type { AIEmployee } from "@/lib/types";
import type { SavedConversationRow, WorkflowTemplateRow } from "@/db/types";
import type { EmployeeId } from "@/lib/constants";

export default async function ChatPage() {
  let employees: AIEmployee[] = [];
  let savedConversations: SavedConversationRow[] = [];
  const scenarioMap: Record<string, WorkflowTemplateRow[]> = {};

  try {
    employees = await getEmployees();
  } catch {
    // Gracefully degrade — empty list
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      savedConversations = await getSavedConversations(user.id);

      const profile = await db
        .select({ organizationId: userProfiles.organizationId })
        .from(userProfiles)
        .where(eq(userProfiles.id, user.id))
        .limit(1);
      const orgId = profile[0]?.organizationId;

      if (orgId && employees.length > 0) {
        const slugs = employees.map((e) => e.id as EmployeeId);
        const results = await Promise.all(
          slugs.map((slug) =>
            listTemplatesForHomepageByTab(orgId, slug).catch(
              () => [] as WorkflowTemplateRow[],
            ),
          ),
        );
        slugs.forEach((slug, i) => {
          scenarioMap[slug] = results[i];
        });
      }
    }
  } catch {
    // Gracefully degrade — empty list
  }

  return (
    <ChatCenterClient
      employees={employees}
      savedConversations={savedConversations}
      scenarioMap={scenarioMap}
    />
  );
}
