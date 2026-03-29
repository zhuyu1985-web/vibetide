import { notFound } from "next/navigation";
import { getAssetDetailFull } from "@/lib/dal/assets";
import AssetDetailClient from "./asset-detail-client";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await getAssetDetailFull(id).catch(() => undefined);

  if (!asset) notFound();

  return <AssetDetailClient asset={asset} />;
}
