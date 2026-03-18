export const dynamic = "force-dynamic";

import { getKnowledgeSources, getKnowledgeItems, getChannelDNA, getSyncLogs } from "@/lib/dal/channel-advisors";
import ChannelKnowledgeClient from "./channel-knowledge-client";

export default async function ChannelKnowledgePage() {
  const [sources, items, dna, syncLogs] = await Promise.all([
    getKnowledgeSources().catch(() => ({ upload: [], cms: [], subscription: [], stats: { totalDocuments: 0, totalChunks: 0, lastSync: "" } })),
    getKnowledgeItems().catch(() => []),
    getChannelDNA().catch(() => ({ dimensions: [], report: "" })),
    getSyncLogs().catch(() => []),
  ]);

  return (
    <ChannelKnowledgeClient
      sources={sources}
      items={items}
      dna={dna}
      syncLogs={syncLogs}
    />
  );
}
