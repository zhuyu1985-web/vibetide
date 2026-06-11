import { getCurrentUser } from "@/lib/auth";
import { listProjectsByOrg } from "@/lib/dal/projects";
import { listConversationsByUser } from "@/lib/dal/cowork-conversations";
import { CoworkSidebar } from "@/components/cowork/cowork-sidebar";
import { ProjectsClient } from "./projects-client";
import type { Project } from "@/db/schema/projects";
import type { Conversation } from "@/db/schema/conversations";

export const dynamic = "force-dynamic";

export default async function CoworkProjectsPage() {
  let projects: Project[] = [];
  let conversations: Conversation[] = [];
  try {
    const user = await getCurrentUser();
    if (user?.organizationId) {
      [projects, conversations] = await Promise.all([
        listProjectsByOrg(user.organizationId),
        listConversationsByUser(user.organizationId, user.id),
      ]);
    }
  } catch {
    // 优雅降级 — 空数据
  }

  // 与 /home、/cowork/[id] 一致:左 CoworkSidebar 工作区栏 + 主区项目网格
  return (
    <div className="flex h-full overflow-hidden">
      <CoworkSidebar conversations={conversations} activeId={null} />
      <div className="flex-1 overflow-y-auto">
        <ProjectsClient projects={projects} />
      </div>
    </div>
  );
}
