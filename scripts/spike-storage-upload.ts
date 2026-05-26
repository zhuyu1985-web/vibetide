// scripts/spike-storage-upload.ts
//
// P0.3 — 验证 Supabase Storage 能否上传 80MB+ 文件
// (P3 Step 6c 市级 tier xlsx 大约这个量级,需提前确认上限)
//
// 与项目 ADR 2026-05-01-platform-supabase-strategy §5 Non-Goals 对齐:
// 不引入 supabase-js,直接走 Storage REST API
// (参考 src/lib/research/report-storage.ts)
//
//   POST {url}/storage/v1/object/{bucket}/{path}   ← 上传
//   DELETE {url}/storage/v1/object/{bucket}/{path} ← 清理
//
// 环境变量必填: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// 缺失会被识别为 BLOCKED 状态(非 implementer bug)。

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

interface UploadResult {
  ok: boolean;
  elapsedSec: number;
  error?: string;
  status?: number;
}

function getEnv(): { url: string; key: string } | { error: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return {
      error:
        "NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 未设置(检查 .env.local;ADR 2026-05-01 用 self-hosted Supabase REST API)",
    };
  }
  return { url, key };
}

async function uploadAndCheck(sizeMB: number): Promise<UploadResult> {
  const env = getEnv();
  if ("error" in env) {
    return { ok: false, elapsedSec: 0, error: env.error };
  }
  const { url, key } = env;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_REPORTS ?? "research-reports";
  const size = sizeMB * 1024 * 1024;
  const buf = Buffer.alloc(size, "A");
  const objKey = `spike/storage-${sizeMB}mb-${Date.now()}.bin`;

  // 拷一份独立 ArrayBuffer (对齐 report-storage.ts 的写法,避免 Buffer 的
  // underlying ArrayBuffer | SharedArrayBuffer 类型不匹配)
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);

  const endpoint = `${url}/storage/v1/object/${bucket}/${encodeURIComponent(objKey)}`;
  const t0 = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/octet-stream",
        "x-upsert": "true",
      },
      body: new Blob([ab], { type: "application/octet-stream" }),
    });
    const elapsedSec = (Date.now() - t0) / 1000;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        elapsedSec,
        error: text || res.statusText,
        status: res.status,
      };
    }
    // 清理
    try {
      await fetch(
        `${url}/storage/v1/object/${bucket}/${encodeURIComponent(objKey)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${key}` },
        },
      );
    } catch {
      // 清理失败不影响判定,只是会留个测试残留
    }
    return { ok: true, elapsedSec, status: res.status };
  } catch (e) {
    const elapsedSec = (Date.now() - t0) / 1000;
    return { ok: false, elapsedSec, error: String(e) };
  }
}

async function main() {
  // 早期 sanity: env 缺失直接 BLOCKED 退出
  const env = getEnv();
  if ("error" in env) {
    console.error(`✗ BLOCKED: ${env.error}`);
    console.error("");
    console.error("缺失的 env(见 .env.example):");
    console.error("  - NEXT_PUBLIC_SUPABASE_URL=https://<host>");
    console.error("  - SUPABASE_SERVICE_ROLE_KEY=<service-role JWT>");
    process.exit(2);
  }

  console.log(`Supabase URL: ${env.url}`);
  console.log(
    `Bucket: ${process.env.SUPABASE_STORAGE_BUCKET_REPORTS ?? "research-reports"}`,
  );

  console.log("\n=== 80MB ===");
  const r1 = await uploadAndCheck(80);
  console.log(
    r1.ok
      ? `✓ 80MB 上传成功, ${r1.elapsedSec.toFixed(2)}s`
      : `✗ 80MB 失败 (${r1.status ?? "?"}, ${r1.elapsedSec.toFixed(2)}s): ${r1.error}`,
  );

  console.log("\n=== 120MB ===");
  const r2 = await uploadAndCheck(120);
  console.log(
    r2.ok
      ? `✓ 120MB 上传成功, ${r2.elapsedSec.toFixed(2)}s`
      : `✗ 120MB 失败 (${r2.status ?? "?"}, ${r2.elapsedSec.toFixed(2)}s): ${r2.error}`,
  );

  console.log("\n=== 结论 ===");
  console.log(`80MB: ${r1.ok ? "PASS" : "FAIL"}`);
  console.log(`120MB: ${r2.ok ? "PASS" : "FAIL"}`);
  if (!r1.ok) {
    console.log(
      "→ 需要联系管理员调高 bucket 单文件配额, 或 P3 Step 6 严格按 tier 拆 4 文件(每个 ≤ 80MB)",
    );
  } else if (!r2.ok) {
    console.log(
      "→ 80MB OK 但 120MB 失败, P3 Step 6 必须按 tier 拆 4 文件(实施时已计划)",
    );
  } else {
    console.log("→ 配额充足, P3 实施按既定方案进行");
  }
  // exit code 反映结果: 0 = 80MB OK, 1 = 80MB 失败
  process.exit(r1.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
