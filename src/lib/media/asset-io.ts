/**
 * 媒体文件 I/O helpers — bridges CLI tool input/output to the
 * media-assets + object-storage pipeline.
 *
 * All operations are org-scoped (multi-tenant isolation seam).
 * Used by M3.6 / M3.8 agent tool implementations.
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  generateDownloadUrl,
  getPublicUrl,
  putObject,
  defaultBucket,
} from "@/lib/storage";
import { formatFileSize } from "@/lib/format";

const execFileAsync = promisify(execFile);

/** 500 MB guard for both input and output */
const MAX_BYTES = 500 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Org-scoped asset resolve (tenant-isolation seam)
// ---------------------------------------------------------------------------

/**
 * Resolve a media asset by id, enforcing org ownership.
 * NEVER use the org-blind `getAssetDetailFull` for agent operations —
 * this is the authoritative tenant-isolation check.
 */
export async function resolveOrgAsset(orgId: string, assetId: string) {
  return db.query.mediaAssets.findFirst({
    where: and(
      eq(mediaAssets.id, assetId),
      eq(mediaAssets.organizationId, orgId)
    ),
  });
}

// ---------------------------------------------------------------------------
// Download object to local scratch file
// ---------------------------------------------------------------------------

/**
 * Download an object-storage object to a local scratch path.
 * Uses a presigned download URL (no streaming API on the storage layer).
 *
 * @param objectKey  TOS/COS object key
 * @param scratchPath  Absolute local path to write the file
 * @param ttl  Presigned URL TTL in seconds (default 7200 = 2 h)
 */
export async function downloadObjectToFile(
  objectKey: string,
  scratchPath: string,
  ttl = 7200
): Promise<void> {
  const url = generateDownloadUrl(objectKey, ttl);

  // Size guard via HEAD before downloading
  const head = await fetch(url, { method: "HEAD" });
  const len = Number(head.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) {
    throw new Error(
      `输入文件超出大小上限 ${formatFileSize(MAX_BYTES)}（实际 ${formatFileSize(len)}）`
    );
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下载失败: HTTP ${res.status} ${res.statusText}`);
  }
  await fs.writeFile(scratchPath, Buffer.from(await res.arrayBuffer()));
}

// ---------------------------------------------------------------------------
// Upload buffer → object storage → mediaAssets row
// ---------------------------------------------------------------------------

export type AssetMediaType = "video" | "image" | "audio" | "document";

export interface StoreBufferAsAssetOpts {
  organizationId: string;
  /** Short slug used to build the object key path segment (e.g. "subtitle", "transcode") */
  slug: string;
  /** File extension without leading dot (e.g. "mp4", "srt") */
  ext: string;
  contentType: string;
  /** Maps to mediaAssetTypeEnum — must be one of the four valid values */
  type: AssetMediaType;
  title: string;
  /** Parent asset id for version-chain linking */
  inputAssetId?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
}

/**
 * Upload a buffer to object storage and insert a `media_assets` row.
 * Returns the new asset id and its public URL.
 */
export async function storeBufferAsAsset(
  buf: Buffer,
  opts: StoreBufferAsAssetOpts
): Promise<{ assetId: string; publicUrl: string }> {
  if (buf.byteLength > MAX_BYTES) {
    throw new Error(
      `输出文件超出大小上限 ${formatFileSize(MAX_BYTES)}（实际 ${formatFileSize(buf.byteLength)}）`
    );
  }

  const objectKey = `${opts.organizationId}/cli/${opts.slug}/${crypto.randomUUID()}.${opts.ext}`;
  await putObject(objectKey, buf, opts.contentType);
  const publicUrl = getPublicUrl(objectKey);

  const [row] = await db
    .insert(mediaAssets)
    .values({
      organizationId: opts.organizationId,
      tosObjectKey: objectKey,
      tosBucket: defaultBucket,
      fileUrl: publicUrl,
      type: opts.type,
      title: opts.title,
      mimeType: opts.contentType,
      source: `cli_${opts.slug}`,
      parentVersionId: opts.inputAssetId ?? null,
      fileSize: buf.byteLength,
      fileSizeDisplay: formatFileSize(buf.byteLength),
      durationSeconds: opts.durationSeconds,
      width: opts.width,
      height: opts.height,
    })
    .returning({ id: mediaAssets.id });

  return { assetId: row.id, publicUrl };
}

// ---------------------------------------------------------------------------
// ffprobe metadata (best-effort, internal helper)
// ---------------------------------------------------------------------------

export interface ProbeResult {
  durationSeconds?: number;
  width?: number;
  height?: number;
}

/**
 * Extract basic metadata from a media file via `ffprobe`.
 * Best-effort: returns `{}` on ANY error (missing binary, parse failure, etc.)
 * so a missing ffprobe in CI/CD never breaks the pipeline.
 */
export async function probeMedia(path: string): Promise<ProbeResult> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_streams",
      "-show_format",
      path,
    ]);

    const data = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{
        codec_type?: string;
        width?: number;
        height?: number;
      }>;
    };

    const result: ProbeResult = {};

    const durationStr = data.format?.duration;
    if (durationStr) {
      const secs = Math.round(parseFloat(durationStr));
      if (isFinite(secs) && secs > 0) result.durationSeconds = secs;
    }

    const videoStream = data.streams?.find((s) => s.codec_type === "video");
    if (videoStream?.width) result.width = videoStream.width;
    if (videoStream?.height) result.height = videoStream.height;

    return result;
  } catch {
    // ffprobe unavailable or failed — metadata is optional
    return {};
  }
}
