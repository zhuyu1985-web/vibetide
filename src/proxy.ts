import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import type { SessionPayload } from "@/lib/auth";

const COOKIE_NAME = "vibetide-session";
const DEFAULT_TTL = 604800; // 7d

function isPublic(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth")
  );
}

async function readSession(
  request: NextRequest
): Promise<Partial<SessionPayload> | null> {
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookieValue) return null;

  const password = process.env.AUTH_SESSION_SECRET;
  if (!password || password.length < 32) return null;

  try {
    const data = await unsealData<Partial<SessionPayload>>(cookieValue, {
      password,
      ttl: Number(process.env.AUTH_SESSION_TTL_SECONDS ?? DEFAULT_TTL),
    });
    return data && data.id ? data : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");

  // 完全公共路径（不需要 user 信息）— 直接放行
  if (isPublic(pathname) && !isAuthPage) {
    return NextResponse.next();
  }

  const session = await readSession(request);
  const isAuthed = !!session?.id;

  if (isAuthed && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  if (!isAuthed && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // 排除 API（路由自带 requireAuth 鉴权；302 会破坏前端 fetch）与静态资源
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
