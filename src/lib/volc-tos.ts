import { TosClient, TosClientError, TosServerError } from "@volcengine/tos-sdk";

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

/**
 * 生成预签名上传 URL，客户端可直接 PUT 文件到此 URL
 * @param objectKey  对象键 (如 orgId/userId/uuid/filename)
 * @param _contentType 保留参数（TOS 预签名不在 URL 中指定 Content-Type，客户端上传时自行设置 header）
 * @param expiresIn  过期秒数，默认 3600
 */
export function generateUploadUrl(
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

/**
 * 生成预签名下载 URL
 */
export function generateDownloadUrl(
  objectKey: string,
  expiresIn = 3600
): string {
  const client = getClient();
  return client.getPreSignedUrl({
    method: "GET",
    bucket,
    key: objectKey,
    expires: expiresIn,
  });
}

/**
 * 获取公开访问 URL（需桶设置为公开读）
 */
export function getPublicUrl(objectKey: string): string {
  return `https://${bucket}.${endpoint}/${objectKey}`;
}

/**
 * 服务端直接上传 Buffer 到 TOS（AI 生成图片转存专用）。
 *
 * ⚠️ 不走 SDK 的 client.putObject——@volcengine/tos-sdk@2.9.1 内部捆绑 axios@0.21.4，
 * 在 Node 22 上发实际请求会抛 ERR_INVALID_PROTOCOL（generateUploadUrl 只拼串不发请求，故无此问题）。
 * 改用「预签名 PUT URL（拼串，正常）+ 原生 fetch PUT 字节」绕开坏 axios。
 */
export async function putObject(
  objectKey: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  const url = generateUploadUrl(objectKey, contentType);
  // 拷一份独立 ArrayBuffer 作为 Blob body（跨 Node/Edge runtime 通）。
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

/**
 * 删除 TOS 对象
 */
export async function deleteObject(objectKey: string): Promise<void> {
  const client = getClient();
  await client.deleteObject({ bucket, key: objectKey });
}

export { bucket as defaultBucket };
