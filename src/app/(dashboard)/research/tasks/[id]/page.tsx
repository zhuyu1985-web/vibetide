import { notFound, redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { getResearchTaskDetail } from "@/lib/dal/research/research-tasks";
import { TaskDetailClient } from "./task-detail-client";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");

  const detail = await getResearchTaskDetail(id, ctx.organizationId);
  if (!detail) notFound();
  return <TaskDetailClient task={detail.task} articles={detail.articles} />;
}
