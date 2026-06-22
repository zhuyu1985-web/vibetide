/**
 * 腾讯云 COS（对象存储）provider 实现。
 *
 * 启用条件：STORAGE_PROVIDER=tencent
 * 必需 env：COS_SECRET_ID / COS_SECRET_KEY / COS_REGION / COS_BUCKET
 *
 * putObject 复用「预签名 PUT URL + 原生 fetch」方案（与 volc 同款，不走 SDK 上传）。
 */
import COS from "cos-nodejs-sdk-v5";
import type { StorageProvider } from "./types";

const secretId = process.env.COS_SECRET_ID || "";
const secretKey = process.env.COS_SECRET_KEY || "";
const cosRegion = process.env.COS_REGION || "ap-guangzhou";
const cosBucket = process.env.COS_BUCKET || "";

function getClient() {
  return new COS({ SecretId: secretId, SecretKey: secretKey });
}

/**
 * 生成预签名上传 URL。
 * cos.getObjectUrl 在不传 callback 时同步返回 string（SDK 文档确认）。
 */
function generateUploadUrl(
  objectKey: string,
  _contentType: string,
  expiresIn = 3600
): string {
  const cos = getClient();
  return cos.getObjectUrl({
    Bucket: cosBucket,
    Region: cosRegion,
    Key: objectKey,
    Method: "PUT",
    Sign: true,
    Expires: expiresIn,
  });
}

function generateDownloadUrl(objectKey: string, expiresIn = 3600): string {
  const cos = getClient();
  return cos.getObjectUrl({
    Bucket: cosBucket,
    Region: cosRegion,
    Key: objectKey,
    Method: "GET",
    Sign: true,
    Expires: expiresIn,
  });
}

function getPublicUrl(objectKey: string): string {
  return `https://${cosBucket}.cos.${cosRegion}.myqcloud.com/${objectKey}`;
}

/**
 * 服务端直接上传 Buffer 到 COS。
 * 复用「预签名 PUT URL + 原生 fetch」方案，不走 SDK 上传，Node 22 兼容性最佳。
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
    throw new Error(`COS putObject 失败：${res.status} ${text}`);
  }
}

async function deleteObject(objectKey: string): Promise<void> {
  const cos = getClient();
  await new Promise<void>((resolve, reject) => {
    cos.deleteObject(
      { Bucket: cosBucket, Region: cosRegion, Key: objectKey },
      (err) => (err ? reject(err) : resolve())
    );
  });
}

export const tencentStorage: StorageProvider = {
  generateUploadUrl,
  generateDownloadUrl,
  getPublicUrl,
  putObject,
  deleteObject,
  get defaultBucket() {
    return cosBucket;
  },
};
