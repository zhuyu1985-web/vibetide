import { storeRemoteMediaToTos } from "@/lib/aigc/store-media";

export async function storeRemoteImageToTos(
  url: string,
  args: { organizationId: string; articleId: string; title: string }
): Promise<{ assetId: string; publicUrl: string }> {
  return storeRemoteMediaToTos(url, { ...args, mediaType: "image" });
}
