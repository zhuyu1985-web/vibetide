import { notFound } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { listProjectsByOrg } from "@/lib/dal/projects";
import {
  listConversationsByUser,
  getConversationWithMessages,
} from "@/lib/dal/cowork-conversations";
import { CoworkClient } from "../cowork-client";
import {
  buildPendingInitialProcessing,
  readInitialProcessing,
} from "@/lib/cowork/initial-processing";

export const dynamic = "force-dynamic";

export default async function CoworkConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ processing?: string }>;
}) {
  const { conversationId } = await params;
  const { processing } = await searchParams;
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) notFound();

  const [conversations, active, projects] = await Promise.all([
    listConversationsByUser(ctx.organizationId, ctx.userId),
    getConversationWithMessages(ctx.organizationId, ctx.userId, conversationId),
    listProjectsByOrg(ctx.organizationId),
  ]);
  if (!active) notFound();
  let initialProcessing = readInitialProcessing(active.conversation.metadata);
  if (!initialProcessing && processing === "1") {
    const prompt = [...active.messages]
      .reverse()
      .find((message) => message.role === "user")
      ?.content.trim();
    if (prompt) initialProcessing = buildPendingInitialProcessing(prompt);
  }

  return (
    <CoworkClient
      key={conversationId}
      conversations={conversations}
      projects={projects}
      active={active}
      initialProcessing={initialProcessing}
    />
  );
}
