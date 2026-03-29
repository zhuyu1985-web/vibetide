import { db } from "@/db";
import {
  creationSessions,
  tasks,
  creationChatMessages,
  workflowTemplates,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { EmployeeId } from "@/lib/constants";
import type {
  CreationGoal,
  SuperCreationTask,
  ChatMessage,
  HitTemplate,
  EDLProject,
} from "@/lib/types";

export async function getActiveCreationGoal(
  orgId: string
): Promise<CreationGoal | null> {
  const row = await db.query.creationSessions.findFirst({
    where: and(
      eq(creationSessions.organizationId, orgId),
      eq(creationSessions.status, "active")
    ),
    orderBy: [desc(creationSessions.createdAt)],
  });

  if (!row) return null;

  return {
    id: row.id,
    title: row.goalTitle,
    description: row.goalDescription || "",
    status: row.status,
    createdAt: row.createdAt.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export async function getCreationTasks(
  sessionId: string
): Promise<SuperCreationTask[]> {
  const rows = await db.query.tasks.findMany({
    where: eq(tasks.sessionId, sessionId),
    with: {
      assignee: true,
    },
    orderBy: [desc(tasks.createdAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    mediaType: (row.mediaType || "article") as SuperCreationTask["mediaType"],
    status: (row.status || "queued") as SuperCreationTask["status"],
    assignee: (row.assignee?.slug || "xiaowen") as EmployeeId,
    progress: row.progress || 0,
    aiResponsible: row.assignee?.nickname || "",
    wordCount: row.wordCount || 0,
    content: (row.content as SuperCreationTask["content"]) || {
      headline: "",
      body: "",
    },
    advisorNotes: (row.advisorNotes as string[]) || undefined,
  }));
}

export async function getCreationChatMessages(
  sessionId: string
): Promise<ChatMessage[]> {
  const rows = await db.query.creationChatMessages.findMany({
    where: eq(creationChatMessages.sessionId, sessionId),
    with: {
      employee: true,
    },
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    employeeId: row.employee
      ? (row.employee.slug as EmployeeId)
      : undefined,
    name: row.employee ? row.employee.nickname : "编辑",
    content: row.content,
    timestamp: row.createdAt.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
}

export async function getHitTemplates(
  orgId: string
): Promise<HitTemplate[]> {
  const rows = await db.query.workflowTemplates.findMany({
    where: eq(workflowTemplates.organizationId, orgId),
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    structure: row.steps.map((s) => s.label),
    usageCount: 0,
    hitRate: 0,
    bestPerformance: { views: 0, likes: 0, shares: 0 },
    category: row.description || "",
    description: row.description || "",
  }));
}

export function getDefaultEDLProject(): EDLProject {
  return {
    id: "edl-1",
    title: "AI手机大战 - 完整版视频",
    duration: "05:30",
    tracks: [
      {
        name: "视频轨",
        color: "#3b82f6",
        clips: [
          { start: 0, end: 30, label: "开场动画" },
          { start: 30, end: 120, label: "华为评测" },
          { start: 120, end: 210, label: "小米评测" },
          { start: 210, end: 280, label: "OPPO评测" },
          { start: 280, end: 330, label: "对比总结" },
        ],
      },
      {
        name: "字幕轨",
        color: "#10b981",
        clips: [{ start: 0, end: 330, label: "全程字幕" }],
      },
      {
        name: "BGM轨",
        color: "#f59e0b",
        clips: [
          { start: 0, end: 30, label: "科技感BGM" },
          { start: 30, end: 280, label: "轻快背景音乐" },
          { start: 280, end: 330, label: "结尾音乐" },
        ],
      },
      {
        name: "音效轨",
        color: "#ef4444",
        clips: [
          { start: 0, end: 5, label: "开场音效" },
          { start: 29, end: 31, label: "转场" },
          { start: 119, end: 121, label: "转场" },
          { start: 209, end: 211, label: "转场" },
          { start: 279, end: 281, label: "转场" },
        ],
      },
    ],
    formats: ["PR XML", "剪映 JSON", "快编 EDL", "Edius AAF"],
  };
}
