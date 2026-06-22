/**
 * 火山引擎 TOS（对象存储）provider 实现。
 * 逻辑直接来自原 src/lib/volc-tos.ts，封装成 StorageProvider。
 */
import { TosClient } from "@volcengine/tos-sdk";
import type { StorageProvider } from "./types";

const accessKeyId = process.env.VOLC_TOS_ACCESS_KEY_ID || "";
const accessKeySecret = process.env.VOLC_TOS_SECRET_ACCESS_KEY || "";
const region = process.env.VOLC_TOS_REGION || "cn-beijing";
const bucket = process.env.VOLC_TOS_BUCKET || "vibetide-media";
const endpoint = process.env.VOLC_TOS_ENDPOINT || "tos-cn-beijing.volces.com";

function getClient() {
  return new TosClient({
    accessKeyId,
    accessKeySecret,
    region,
    endpoint,
  });
}

function generateUploadUrl(
  objectKey: string,
  _contentType: string,
  expiresIn = 3600
): string {
  const client = getClient();
  return client.getPreSignedUrl({
    method: "PUT",
    bucket,
    key: objectKey,
    expires: expiresIn,
  });
}

function generateDownloadUrl(objectKey: string, expiresIn = 3600): string {
  const client = getClient();
  return client.getPreSignedUrl({
    method: "GET",
    bucket,
    key: objectKey,
    expires: expiresIn,
  });
}

function getPublicUrl(objectKey: string): string {
  return `https://${bucket}.${endpoint}/${objectKey}`;
}

/**
 * 服务端直接上传 Buffer 到 TOS（AIGC 生成内容转存专用）。
 *
 * ⚠️ 不走 SDK 的 client.putObject——@volcengine/tos-sdk@2.9.1 内部捆绑 axios@0.21.4，
 * 在 Node 22 上会抛 ERR_INVALID_PROTOCOL。
 * 改用「预签名 PUT URL + 原生 fetch」绕开坏 axios。
 */
async function putObject(
  objectKey: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  const url = generateUploadUrl(objectKey, contentType);
  const ab = new ArrayBuffer(body.byteLength);
  new Uint8Array(ab).set(body);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Blob([ab], { type: contentType }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TOS putObject 失败：${res.status} ${text}`);
  }
}

async function deleteObject(objectKey: string): Promise<void> {
  const client = getClient();
  await client.deleteObject({ bucket, key: objectKey });
}

export const volcStorage: StorageProvider = {
  generateUploadUrl,
  generateDownloadUrl,
  getPublicUrl,
  putObject,
  deleteObject,
  get defaultBucket() {
    return bucket;
  },
};
