import { notFound } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { listProjectsByOrg } from "@/lib/dal/projects";
import {
  listConversationsByUser,
  getConversationWithMessages,
} from "@/lib/dal/cowork-conversations";
import { CoworkClient } from "../cowork-client";

export const dynamic = "force-dynamic";

export default async function CoworkConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) notFound();

  const [projects, conversations, active] = await Promise.all([
    listProjectsByOrg(ctx.organizationId),
    listConversationsByUser(ctx.organizationId, ctx.userId),
    getConversationWithMessages(ctx.organizationId, ctx.userId, conversationId),
  ]);
  if (!active) notFound();

  return (
    <CoworkClient
      key={conversationId}
      projects={projects}
      conversations={conversations}
      active={active}
    />
  );
}
