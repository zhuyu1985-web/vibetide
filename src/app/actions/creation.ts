"use server";

import { db } from "@/db";
import {
  creationSessions,
  tasks,
  contentVersions,
  creationChatMessages,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
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

export async function createCreationSession(data: {
  organizationId: string;
  goalTitle: string;
  goalDescription?: string;
  mediaTypes?: string[];
}) {
  await requireAuth();

  const [session] = await db
    .insert(creationSessions)
    .values(data)
    .returning();

  revalidatePath("/super-creation");
  revalidatePath("/premium-content");
  return session;
}

export async function updateTaskContent(
  taskId: string,
  data: {
    headline?: string;
    body?: string;
    wordCount?: number;
  }
) {
  await requireAuth();

  // Get current task to determine version number
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  if (!task) throw new Error("Task not found");

  // Update the task content
  const currentContent = task.content || { headline: "", body: "" };
  const newContent = {
    ...currentContent,
    ...(data.headline !== undefined && { headline: data.headline }),
    ...(data.body !== undefined && { body: data.body }),
  };

  await db
    .update(tasks)
    .set({
      content: newContent,
      wordCount: data.wordCount ?? task.wordCount,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  // Create a content version
  const versionCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contentVersions)
    .where(eq(contentVersions.taskId, taskId));

  await db.insert(contentVersions).values({
    taskId,
    versionNumber: (versionCount[0]?.count || 0) + 1,
    headline: data.headline || currentContent.headline,
    body: data.body || currentContent.body,
    wordCount: data.wordCount ?? task.wordCount ?? 0,
    editorType: "ai",
    changeSummary: "内容更新",
  });

  revalidatePath("/super-creation");
  revalidatePath("/premium-content");
}

export async function updateTaskStatus(
  taskId: string,
  status: string
) {
  await requireAuth();

  await db
    .update(tasks)
    .set({ status, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  revalidatePath("/super-creation");
  revalidatePath("/premium-content");
}

export async function sendCreationChatMessage(data: {
  sessionId: string;
  role: "editor" | "ai";
  employeeId?: string;
  content: string;
}) {
  await requireAuth();

  await db.insert(creationChatMessages).values(data);

  revalidatePath("/super-creation");
}

export async function applyHitTemplate(data: {
  taskId: string;
  templateStructure: string[];
}) {
  await requireAuth();

  // Update task content with template structure
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, data.taskId),
  });

  if (!task) throw new Error("Task not found");

  const currentContent = task.content || { headline: "", body: "" };
  const templateBody = data.templateStructure
    .map((s, i) => `## ${i + 1}. ${s}\n\n`)
    .join("");

  await db
    .update(tasks)
    .set({
      content: { ...currentContent, body: templateBody },
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, data.taskId));

  revalidatePath("/premium-content");
}

export async function getActiveCreationGoal() {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("Organization not found");

  const session = await db.query.creationSessions.findFirst({
    where: and(
      eq(creationSessions.organizationId, orgId),
      eq(creationSessions.status, "active")
    ),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });

  if (!session) return null;

  return {
    id: session.id,
    goalTitle: session.goalTitle,
    goalDescription: session.goalDescription,
    mediaTypes: session.mediaTypes,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
  };
}

