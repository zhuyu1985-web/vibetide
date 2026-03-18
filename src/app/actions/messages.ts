"use server";

import { db } from "@/db";
import { teamMessages } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function sendTeamMessage(data: {
  teamId?: string;
  senderType: "ai" | "human";
  aiEmployeeId?: string;
  type: "alert" | "decision_request" | "status_update" | "work_output";
  content: string;
  actions?: { label: string; variant: "default" | "primary" | "destructive" }[];
  attachments?: {
    type: "topic_card" | "draft_preview" | "chart" | "asset";
    title: string;
    description?: string;
  }[];
}) {
  const user = await requireAuth();

  await db.insert(teamMessages).values({
    teamId: data.teamId,
    senderType: data.senderType,
    aiEmployeeId: data.aiEmployeeId,
    userId: data.senderType === "human" ? user.id : undefined,
    type: data.type,
    content: data.content,
    actions: data.actions,
    attachments: data.attachments,
  });

  revalidatePath("/team-hub");
}
