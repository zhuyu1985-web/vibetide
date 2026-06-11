import { notFound } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { getProjectById, listProjectsByOrg } from "@/lib/dal/projects";
import { listConversationsByUser } from "@/lib/dal/cowork-conversations";
import { CoworkSidebar } from "@/components/cowork/cowork-sidebar";
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

  // 侧栏要全量项目 + 全部最近对话;详情区只要本项目下的会话
  const [allProjects, allConversations, projectConversations] =
    await Promise.all([
      listProjectsByOrg(ctx.organizationId),
      listConversationsByUser(ctx.organizationId, ctx.userId),
      listConversationsByUser(ctx.organizationId, ctx.userId, { projectId }),
    ]);

  return (
    <div className="flex h-full overflow-hidden">
      <CoworkSidebar
        projects={allProjects}
        conversations={allConversations}
        activeId={null}
      />
      <div className="flex-1 overflow-y-auto">
        <ProjectDetailClient
          project={project}
          conversations={projectConversations}
        />
      </div>
    </div>
  );
}
