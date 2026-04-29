import { redirect, notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getSavedConversationById } from "@/lib/dal/conversations";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  const conversation = await getSavedConversationById(id, user.id);

  if (!conversation) {
    notFound();
  }

  redirect(
    `/chat?employee=${conversation.employeeSlug}&conversation=${conversation.id}`
  );
}
