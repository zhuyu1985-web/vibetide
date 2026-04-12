export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { listKnowledgeBaseSummariesByOrg } from "@/lib/dal/knowledge-bases";
import { KnowledgeBasesClient } from "./knowledge-bases-client";

export default async function KnowledgeBasesPage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const summaries = await listKnowledgeBaseSummariesByOrg(orgId).catch(() => []);

  return <KnowledgeBasesClient initialSummaries={summaries} />;
}
