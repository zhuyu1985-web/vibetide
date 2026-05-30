import { notFound } from "next/navigation";
import { db } from "@/db";
import { workflowTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { WorkflowDetailClient } from "./workflow-detail-client";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { listSchedulesByTemplate } from "@/lib/dal/workflow-template-schedules";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const workflow = await db.query.workflowTemplates.findFirst({
    where: eq(workflowTemplates.id, id),
  });

  if (!workflow) notFound();

  // 定时任务 tab 数据 —— 仅当模板属于当前 org 才有意义;跨 org 查看时返回空数组
  const orgId = await getCurrentUserOrg();
  const schedules =
    orgId && workflow.organizationId === orgId
      ? await listSchedulesByTemplate(orgId, id)
      : [];

  return <WorkflowDetailClient workflow={workflow} schedules={schedules} />;
}
