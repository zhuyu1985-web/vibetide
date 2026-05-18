import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import {
  listResearchTopics,
  listTopicGroups,
} from "@/lib/dal/research/research-topics";
import { TopicsClient } from "./topics-client";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    PERMISSIONS.MENU_RESEARCH,
  );
  if (!allowed) redirect("/home");

  const [topics, groups] = await Promise.all([
    listResearchTopics(ctx.organizationId),
    listTopicGroups(ctx.organizationId),
  ]);

  return <TopicsClient topics={topics} groups={groups} />;
}
