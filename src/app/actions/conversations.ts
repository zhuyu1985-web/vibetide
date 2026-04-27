"use server";

import { db } from "@/db";
import { savedConversations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function saveConversation(data: {
  employeeSlug: string;
  title: string;
  summary?: string;
  messages: {
    role: "user" | "assistant" | "system";
    content: string;
    durationMs?: number;
    thinkingSteps?: { tool: string; label: string; skillName?: string }[];
    skillsUsed?: { tool: string; skillName: string }[];
    sources?: string[];
    referenceCount?: number;
    kind?: "text" | "mission_card";
    missionId?: string;
    templateId?: string;
    templateName?: string;
  }[];
  scenarioId?: string;
  metadata?: Record<string, unknown>;
}) {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");

  const [row] = await db
    .insert(savedConversations)
    .values({
      organizationId: orgId,
      userId: user.id,
      employeeSlug: data.employeeSlug,
      title: data.title,
      summary: data.summary ?? null,
      messages: data.messages,
      scenarioId: data.scenarioId ?? null,
      metadata: data.metadata ?? null,
    })
    .returning();

  revalidatePath("/chat");
  return row;
}

export async function deleteSavedConversation(id: string) {
  const user = await requireAuth();

  await db
    .delete(savedConversations)
    .where(
      and(
        eq(savedConversations.id, id),
        eq(savedConversations.userId, user.id)
      )
    );

  revalidatePath("/chat");
}

export async function updateConversationTitle(id: string, title: string) {
  const user = await requireAuth();

  const [updated] = await db
    .update(savedConversations)
    .set({ title, updatedAt: new Date() })
    .where(
      and(
        eq(savedConversations.id, id),
        eq(savedConversations.userId, user.id)
      )
    )
    .returning();

  revalidatePath("/chat");
  return updated ?? null;
}
