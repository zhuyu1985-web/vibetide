export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getEmployees } from "@/lib/dal/employees";
import { getSavedConversations } from "@/lib/dal/conversations";
import { getAllScenariosByOrg } from "@/lib/dal/scenarios";
import { ChatCenterClient } from "./chat-center-client";
import type { AIEmployee, ScenarioCardData } from "@/lib/types";
import type { SavedConversationRow } from "@/db/types";

export default async function ChatPage() {
  let employees: AIEmployee[] = [];
  let savedConversations: SavedConversationRow[] = [];
  let scenarioMap: Record<string, ScenarioCardData[]> = {};

  try {
    // Parallel fetch — employees and scenarios in one go
    [employees, scenarioMap] = await Promise.all([
      getEmployees(),
      getAllScenariosByOrg(),
    ]);
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
