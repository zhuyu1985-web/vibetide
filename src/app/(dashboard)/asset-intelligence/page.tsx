export const dynamic = "force-dynamic";

import {
  getAssetForUnderstanding,
  getProcessingQueue,
  getQueueStats,
  getTagDistribution,
  getKnowledgeGraph,
  getTagCategorySummary,
  getAssetTagList,
} from "@/lib/dal/assets";
import { getTagSchemas, getDefaultTagSchemas } from "@/lib/dal/tag-schemas";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import AssetIntelligenceClient from "./asset-intelligence-client";

export default async function AssetIntelligencePage() {
  const orgId = await getCurrentUserOrg().catch(() => null);

  const [asset, queue, queueStats, tagDistribution, knowledgeGraph, customTagSchemas, tagCategorySummary, assetTagList] =
    await Promise.all([
      getAssetForUnderstanding().catch(() => null),
      getProcessingQueue().catch(() => []),
      getQueueStats().catch(() => ({ queued: 0, processing: 0, completed: 0, failed: 0 })),
      getTagDistribution().catch(() => []),
      getKnowledgeGraph().catch(() => ({ nodes: [], edges: [] })),
      orgId ? getTagSchemas(orgId).catch(() => []) : Promise.resolve([]),
      getTagCategorySummary().catch(() => []),
      getAssetTagList().catch(() => []),
    ]);

  const defaultTagSchemas = getDefaultTagSchemas();

  return (
    <AssetIntelligenceClient
      asset={asset ?? null}
      queue={queue}
      queueStats={queueStats}
      tagDistribution={tagDistribution}
      knowledgeGraph={knowledgeGraph}
      customTagSchemas={customTagSchemas}
      defaultTagSchemas={defaultTagSchemas}
      tagCategorySummary={tagCategorySummary}
      assetTagList={assetTagList}
    />
  );
}
