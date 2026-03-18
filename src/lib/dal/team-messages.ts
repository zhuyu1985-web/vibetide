import { db } from "@/db";
import { teamMessages, aiEmployees } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Post a team message from an AI employee (Module 3 integration per Section 七).
 * Used by server actions and Inngest functions to notify teams of events.
 */
export async function postTeamMessage(params: {
  teamId?: string | null;
  senderSlug: string; // AI employee slug (e.g., "xiaoshen", "xiaofa", "xiaoshu")
  type: "alert" | "decision_request" | "status_update" | "work_output";
  content: string;
  actions?: { label: string; variant: "default" | "primary" | "destructive" }[];
  attachments?: { type: "topic_card" | "draft_preview" | "chart" | "asset"; title: string; description?: string }[];
}) {
  // Resolve AI employee ID from slug
  const employee = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.slug, params.senderSlug),
  });

  if (!employee) return null;

  const [row] = await db
    .insert(teamMessages)
    .values({
      teamId: params.teamId || null,
      senderType: "ai",
      aiEmployeeId: employee.id,
      type: params.type,
      content: params.content,
      actions: params.actions || null,
      attachments: params.attachments || null,
    })
    .returning();

  return row;
}
