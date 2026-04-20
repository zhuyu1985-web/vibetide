export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getEmployees } from "@/lib/dal/employees";
import { getSavedConversations } from "@/lib/dal/conversations";
import { ChatCenterClient } from "./chat-center-client";
import type { AIEmployee, ScenarioCardData } from "@/lib/types";
import type { SavedConversationRow } from "@/db/types";
// NOTE: getAllScenariosByOrg / @/lib/dal/scenarios removed 2026-04-20
// (employee_scenarios table DROPPED at commit a066cbb). scenarioMap
// stays empty until ChatCenterClient migrates to workflow_templates.

export default async function ChatPage() {
  let employees: AIEmployee[] = [];
  let savedConversations: SavedConversationRow[] = [];
  // Legacy `employee_scenarios` table dropped 2026-04-20 — scenarioMap
  // stays empty until ChatCenterClient is migrated to workflow_templates
  // (Phase 3).
  const scenarioMap: Record<string, ScenarioCardData[]> = {};

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
