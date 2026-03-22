export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getEmployees } from "@/lib/dal/employees";
import { getSavedConversations } from "@/lib/dal/conversations";
import { ChatCenterClient } from "./chat-center-client";
import type { AIEmployee } from "@/lib/types";
import type { SavedConversationRow } from "@/db/types";

export default async function ChatPage() {
  let employees: AIEmployee[] = [];
  let savedConversations: SavedConversationRow[] = [];

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
    />
  );
}
