import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { listProjectsByOrg } from "@/lib/dal/projects";
import { ProjectsClient } from "./projects-client";

export const dynamic = "force-dynamic";

export default async function CoworkProjectsPage() {
  const ctx = await getCurrentUserAndOrg();
  const projects = ctx ? await listProjectsByOrg(ctx.organizationId) : [];
  return <ProjectsClient projects={projects} />;
}
