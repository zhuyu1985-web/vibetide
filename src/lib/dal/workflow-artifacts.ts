import { db } from "@/db";
import { workflowArtifacts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * workflow_artifacts DAL —— 向 mission 写入可视化任务产出。
 *
 * Phase 1：`cms_publication` artifactType 承载 CMS 入库结果，供任务中心 UI
 * 展示「CMS 入库成功 / 回链 / 预览 URL」。由 `publishArticleToCms` 在 Step 9
 * 调用。
 */

export type WorkflowArtifactType =
  | "topic_brief"
  | "angle_list"
  | "material_pack"
  | "article_draft"
  | "video_plan"
  | "review_report"
  | "publish_plan"
  | "analytics_report"
  | "generic"
  | "cms_publication";

export interface InsertWorkflowArtifactInput {
  missionId: string;
  artifactType: WorkflowArtifactType;
  title: string;
  content: Record<string, unknown>;
  producerEmployeeId?: string;
  producerTaskId?: string;
}

export async function insertWorkflowArtifact(
  input: InsertWorkflowArtifactInput,
): Promise<typeof workflowArtifacts.$inferSelect> {
  const [row] = await db
    .insert(workflowArtifacts)
    .values({
      missionId: input.missionId,
      artifactType: input.artifactType,
      title: input.title,
      content: input.content as object,
      producerEmployeeId: input.producerEmployeeId ?? null,
      producerTaskId: input.producerTaskId ?? null,
    })
    .returning();
  return row;
}

export async function listArtifactsByMission(
  missionId: string,
  options: { limit?: number } = {},
) {
  return await db.query.workflowArtifacts.findMany({
    where: eq(workflowArtifacts.missionId, missionId),
    orderBy: [desc(workflowArtifacts.createdAt)],
    limit: options.limit ?? 50,
  });
}

export async function listArtifactsByType(
  missionId: string,
  artifactType: WorkflowArtifactType,
) {
  return await db.query.workflowArtifacts.findMany({
    where: (t, { and, eq }) =>
      and(eq(t.missionId, missionId), eq(t.artifactType, artifactType)),
    orderBy: [desc(workflowArtifacts.createdAt)],
  });
}
