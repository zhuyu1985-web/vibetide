// src/lib/research/report-storage.ts
//
// A5 Phase 6 — Supabase Storage 简易 client（service-role REST，绕过 supabase-js 依赖）
//
// 不引入 supabase-js（per ADR 2026-05-01-platform-supabase-strategy §5 Non-Goals：
// 留 self-hosted Supabase 但不加 supabase-js）。直接走 Storage REST API：
//   POST {url}/storage/v1/object/{bucket}/{path}      ← 上传
//   POST {url}/storage/v1/object/sign/{bucket}/{path} ← 拿签名 URL
//
// Spec ref: docs/superpowers/specs/2026-05-07-a5-report-export-design.md §4.1 Step 5/6
// Plan ref: docs/superpowers/plans/2026-05-07-a5-report-export-plan.md Phase 6 Task 6.1
//
// 注意：生产 deploy 需 .env.local 里 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// 配置完整，否则 getEnv() 会抛错（Inngest 自动 retry 3 次）。Phase 0 implementer 已 flag。

const BUCKET_DEFAULT = "research-reports";
const SIGNED_URL_TTL_DEFAULT = 60 * 60 * 24; // 24 小时

function getBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET_REPORTS || BUCKET_DEFAULT;
}

function getEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase storage env not configured (need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  return { url, key };
}

/**
 * 上传文件到 Supabase Storage。
 *
 * @param objectPath - 桶内对象路径，如 "{orgId}/{reportId}/report.docx"
 *                     （此 helper 内部会 encodeURIComponent，不要 double-encode）
 * @param body       - 文件字节
 * @param contentType - MIME 类型（docx / xlsx 等）
 *
 * 失败时抛 Error，由 Inngest 自动 retry。
 */
export async function uploadFile(
  objectPath: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const { url, key } = getEnv();
  const bucket = getBucket();
  const endpoint = `${url}/storage/v1/object/${bucket}/${encodeURIComponent(objectPath)}`;
  // 用 Blob 包装 buffer 作为 BodyInit（DOM lib 的 BodyInit 接 Blob，跨 Node/Edge runtime 都通）。
  // 拷一份独立 ArrayBuffer 避免 Buffer 的 underlying ArrayBuffer | SharedArrayBuffer 类型不匹配。
  const ab = new ArrayBuffer(body.byteLength);
  new Uint8Array(ab).set(body);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: new Blob([ab], { type: contentType }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Storage upload failed: ${res.status} ${text}`);
  }
}

/**
 * 拿对象的签名 URL（默认 24h 有效期）。
 *
 * 防御性兼容 Supabase Storage 两种字段格式（per Phase 1 reviewer M-3）：
 *  - 老版本返 { signedURL: "/object/sign/..." }
 *  - 新版本（camelCase）返 { signedUrl: "/object/sign/..." }
 * 缺失则抛清晰错误。
 *
 * 返回 path-only 时自动拼前缀 ${url}/storage/v1。
 */
export async function getSignedUrl(
  objectPath: string,
  ttlSeconds: number = SIGNED_URL_TTL_DEFAULT,
): Promise<{ url: string; expiresAt: Date }> {
  const { url, key } = getEnv();
  const bucket = getBucket();
  const endpoint = `${url}/storage/v1/object/sign/${bucket}/${encodeURIComponent(objectPath)}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: ttlSeconds }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Storage sign failed: ${res.status} ${text}`);
  }
  const r = (await res.json()) as { signedURL?: string; signedUrl?: string };
  const signed = r.signedURL ?? r.signedUrl;
  if (!signed) {
    throw new Error(
      "Supabase Storage 返回签名 URL 字段缺失（既无 signedURL 也无 signedUrl）",
    );
  }
  const fullUrl = signed.startsWith("http") ? signed : `${url}/storage/v1${signed}`;
  return { url: fullUrl, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
}

/**
 * 拼对象路径：`{orgId}/{reportId}/{fileName}`
 *
 * 不做 encode（保持可读性，由 uploadFile / getSignedUrl 在调用 endpoint 时 encode）。
 */
export function buildObjectPath(
  orgId: string,
  reportId: string,
  fileName: string,
): string {
  return `${orgId}/${reportId}/${fileName}`;
}

/**
 * 上传 + 签名一步到位（generic helper for callers that don't need to split the steps）。
 */
export async function uploadAndSign(input: {
  objectPath: string;
  body: Buffer | Uint8Array;
  contentType: string;
  ttlSeconds?: number;
}): Promise<{ url: string; expiresAt: Date }> {
  await uploadFile(input.objectPath, input.body, input.contentType);
  return getSignedUrl(input.objectPath, input.ttlSeconds ?? SIGNED_URL_TTL_DEFAULT);
}

/**
 * 重签已存在对象的 URL（用于 URL 即将过期的场景）。
 */
export async function resignUrl(
  objectPath: string,
  ttlSeconds: number = SIGNED_URL_TTL_DEFAULT,
): Promise<{ url: string; expiresAt: Date }> {
  return getSignedUrl(objectPath, ttlSeconds);
}
