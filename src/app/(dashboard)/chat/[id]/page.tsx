import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSavedConversationById } from "@/lib/dal/conversations";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const conversation = await getSavedConversationById(id, user.id);

  if (!conversation) {
    notFound();
  }

  redirect(
    `/chat?employee=${conversation.employeeSlug}&conversation=${conversation.id}`
  );
}
