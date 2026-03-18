import { getAssets, getAssetStats } from "@/lib/dal/assets";
import { getCategories } from "@/lib/dal/categories";
import MediaAssetsClient from "./media-assets-client";

export default async function MediaAssetsPage() {
  const [assets, stats, categories] = await Promise.all([
    getAssets().catch(() => []),
    getAssetStats().catch(() => ({ totalCount: 0, videoCount: 0, imageCount: 0, audioCount: 0, documentCount: 0, totalStorageDisplay: "0 B" })),
    getCategories().catch(() => []),
  ]);

  return <MediaAssetsClient assets={assets} stats={stats} categories={categories} />;
}
