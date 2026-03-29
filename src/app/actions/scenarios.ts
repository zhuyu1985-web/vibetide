"use server";

// This file is kept for potential non-streaming use cases.
// The streaming scenario execution uses /api/scenarios/execute route instead.

import { createClient } from "@/lib/supabase/server";

export async function requireScenarioAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
