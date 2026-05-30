/**
 * Internal revalidation hook for seed / migration / admin CLI scripts.
 *
 * 用法:
 *   curl -X POST http://localhost:3000/api/internal/revalidate-paths \
 *     -H "Content-Type: application/json" \
 *     -H "x-internal-key: $INTERNAL_REVALIDATE_KEY" \
 *     -d '{"paths": ["/workflows", "/home"]}'
 *
 * 安全:
 *   - dev 模式(NODE_ENV !== 'production'):无需 header,允许任意 localhost 调用
 *   - production:必须 header `x-internal-key` == env `INTERNAL_REVALIDATE_KEY`,
 *     否则 403。若 env 没设,production 一律拒绝。
 *
 * 路径白名单:只接受以 `/` 开头的相对路径,且 segment 数 ≤ 5,避免误传任意值。
 *
 * 该端点只清缓存,不读写 DB,无业务副作用。
 */
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

function isAllowedPath(p: string): boolean {
  if (typeof p !== "string" || !p.startsWith("/")) return false;
  if (p.length > 200) return false;
  // 拒绝 ../ 与查询串
  if (p.includes("..") || p.includes("?") || p.includes("#")) return false;
  const segs = p.split("/").filter(Boolean);
  return segs.length <= 5;
}

export async function POST(req: Request) {
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    const expected = process.env.INTERNAL_REVALIDATE_KEY;
    if (!expected) {
      return NextResponse.json(
        { ok: false, error: "INTERNAL_REVALIDATE_KEY not configured" },
        { status: 403 },
      );
    }
    const got = req.headers.get("x-internal-key");
    if (got !== expected) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json body" },
      { status: 400 },
    );
  }

  const raw = (body as { paths?: unknown })?.paths;
  if (!Array.isArray(raw)) {
    return NextResponse.json(
      { ok: false, error: "paths must be an array of strings" },
      { status: 400 },
    );
  }

  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const p of raw) {
    if (typeof p === "string" && isAllowedPath(p)) {
      revalidatePath(p);
      accepted.push(p);
    } else {
      rejected.push(typeof p === "string" ? p : String(p));
    }
  }

  return NextResponse.json({ ok: true, accepted, rejected });
}
