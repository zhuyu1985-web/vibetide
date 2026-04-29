import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { listKnowledgeBaseSummariesByOrg } from "@/lib/dal/knowledge-bases";
import {
  getKnowledgeSources,
  getKnowledgeItems,
  getChannelDNA,
  getSyncLogs,
} from "@/lib/dal/channel-advisors";
import { KnowledgeBasesClient } from "./knowledge-bases-client";

export default async function KnowledgeBasesPage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const [summaries, channelSources, channelItems, channelDNA, channelSyncLogs] =
    await Promise.all([
      listKnowledgeBaseSummariesByOrg(orgId).catch(() => []),
      getKnowledgeSources().catch(() => ({
        upload: [],
        cms: [],
        subscription: [],
        stats: { totalDocuments: 0, totalChunks: 0, lastSync: "" },
      })),
      getKnowledgeItems().catch(() => []),
      getChannelDNA().catch(() => ({ dimensions: [], report: "" })),
      getSyncLogs().catch(() => []),
    ]);

  return (
    <KnowledgeBasesClient
      initialSummaries={summaries}
      channelData={{
        sources: channelSources,
        items: channelItems,
        dna: channelDNA,
        syncLogs: channelSyncLogs,
      }}
    />
  );
}
