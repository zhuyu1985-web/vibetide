import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { putObject, getPublicUrl, defaultBucket } from "@/lib/storage";

type MediaType = "image" | "video" | "audio";

const MEDIA: Record<MediaType, { ext: string; contentType: string; label: string }> = {
  image: { ext: "png", contentType: "image/png", label: "配图" },
  video: { ext: "mp4", contentType: "video/mp4", label: "配视频" },
  audio: { ext: "mp3", contentType: "audio/mpeg", label: "播客" },
};

export async function storeRemoteMediaToTos(
  url: string,
  args: { organizationId: string; articleId: string; title: string; mediaType: MediaType },
  opts?: {
    /** TOS objectKey 前缀（默认 aigc；导入视频用 imported） */
    keyPrefix?: string;
    /** media_assets.source（区分 aigc_video / article_video / upload） */
    source?: string;
    durationSeconds?: number;
    thumbnailUrl?: string;
  },
): Promise<{ assetId: string; publicUrl: string }> {
  const m = MEDIA[args.mediaType];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载媒体失败：${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const prefix = opts?.keyPrefix ?? "aigc";
  const objectKey = `${args.organizationId}/${prefix}/${args.articleId}/${crypto.randomUUID()}.${m.ext}`;
  await putObject(objectKey, buf, m.contentType);
  const publicUrl = getPublicUrl(objectKey);
  const [asset] = await db
    .insert(mediaAssets)
    .values({
      organizationId: args.organizationId,
      tosObjectKey: objectKey,
      tosBucket: defaultBucket,
      fileUrl: publicUrl,
      type: args.mediaType,
      title: `${args.title} ${m.label}`,
      mimeType: m.contentType,
      ...(opts?.source ? { source: opts.source } : {}),
      ...(opts?.durationSeconds ? { durationSeconds: opts.durationSeconds } : {}),
      ...(opts?.thumbnailUrl ? { thumbnailUrl: opts.thumbnailUrl } : {}),
    })
    .returning({ id: mediaAssets.id });
  return { assetId: asset.id, publicUrl };
}
