import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listMyResearchTasks } from "@/lib/dal/research/research-tasks";
import { ResearchHomeClient } from "./research-home-client";

export const dynamic = "force-dynamic";

export default async function ResearchHomePage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(ctx.userId, ctx.organizationId, PERMISSIONS.MENU_RESEARCH);
  if (!allowed) redirect("/home");

  const tasks = await listMyResearchTasks(ctx.organizationId, ctx.userId);
  return <ResearchHomeClient tasks={tasks} />;
}
