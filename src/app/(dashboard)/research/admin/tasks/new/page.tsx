import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listResearchTopics } from "@/lib/dal/research/research-topics";
import { listCqDistricts } from "@/lib/dal/research/cq-districts";
import { NewTaskClient } from "./new-task-client";

export default async function NewResearchTaskPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    PERMISSIONS.RESEARCH_TASK_CREATE,
  );
  if (!allowed) redirect("/research");

  const [topics, districts] = await Promise.all([
    listResearchTopics(ctx.organizationId),
    listCqDistricts(),
  ]);
  return <NewTaskClient topics={topics} districts={districts} />;
}
