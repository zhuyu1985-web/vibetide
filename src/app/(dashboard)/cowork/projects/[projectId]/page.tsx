import { notFound } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { getProjectById } from "@/lib/dal/projects";
import { listConversationsByUser } from "@/lib/dal/cowork-conversations";
import { ProjectDetailClient } from "./project-detail-client";

export const dynamic = "force-dynamic";

export default async function CoworkProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) notFound();

  const project = await getProjectById(ctx.organizationId, projectId);
  if (!project) notFound();

  const conversations = await listConversationsByUser(
    ctx.organizationId,
    ctx.userId,
    { projectId },
  );

  return <ProjectDetailClient project={project} conversations={conversations} />;
}
