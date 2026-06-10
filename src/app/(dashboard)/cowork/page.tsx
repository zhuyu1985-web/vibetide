import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { listProjectsByOrg } from "@/lib/dal/projects";
import { listConversationsByUser } from "@/lib/dal/cowork-conversations";
import { CoworkClient } from "./cowork-client";

export const dynamic = "force-dynamic";

export default async function CoworkPage() {
  const ctx = await getCurrentUserAndOrg();
  const [projects, conversations] = ctx
    ? await Promise.all([
        listProjectsByOrg(ctx.organizationId),
        listConversationsByUser(ctx.organizationId, ctx.userId),
      ])
    : [[], []];

  return (
    <CoworkClient
      key="none"
      projects={projects}
      conversations={conversations}
      active={null}
    />
  );
}
