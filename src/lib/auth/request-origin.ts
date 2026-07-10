import type { NextRequest } from "next/server";

/** 构建对外 redirect 用的 origin，避免 dev server 绑定 0.0.0.0 时跳到 https://0.0.0.0:3000 */
export function resolvePublicOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host && !host.startsWith("0.0.0.0")) {
    const proto =
      request.headers.get("x-forwarded-proto") ??
      (request.nextUrl.protocol === "https:" ? "https" : "http");
    return `${proto}://${host}`;
  }

  const port = request.nextUrl.port || "3000";
  return `https://local.demo.chinamcloud.cn:${port}`;
}

export function absoluteUrl(request: NextRequest, path: string): URL {
  const base = resolvePublicOrigin(request);
  return new URL(path.startsWith("/") ? path : `/${path}`, base);
}
