import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { putObject, getPublicUrl, defaultBucket } from "@/lib/volc-tos";

export async function storeRemoteImageToTos(
  url: string,
  args: { organizationId: string; articleId: string; title: string }
): Promise<{ assetId: string; publicUrl: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载图片失败：${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const objectKey = `${args.organizationId}/aigc/${args.articleId}/${crypto.randomUUID()}.png`;
  await putObject(objectKey, buf, "image/png");
  const publicUrl = getPublicUrl(objectKey);
  const [asset] = await db
    .insert(mediaAssets)
    .values({
      organizationId: args.organizationId,
      tosObjectKey: objectKey,
      tosBucket: defaultBucket,
      fileUrl: publicUrl,
      type: "image",
      title: `${args.title} 配图`,
    })
    .returning({ id: mediaAssets.id });
  return { assetId: asset.id, publicUrl };
}
