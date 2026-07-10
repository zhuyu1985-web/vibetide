import type { NextRequest, NextResponse } from "next/server";
import {
  getHostCookieBaseOptions,
  resolveSsoCookieDomain,
} from "@/lib/auth/cookie-options";
import {
  getSessionCookieDeleteOptions,
  VIBETIDE_SESSION_COOKIE,
} from "@/lib/auth/session";
import { SSO_COOKIE_NAMES } from "@/lib/auth/sso-cookies";

type ExpireCookieOptions = {
  name: string;
  path?: string;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  httpOnly?: boolean;
  domain?: string;
};

function capitalizeSameSite(value: "lax" | "strict" | "none"): string {
  if (value === "lax") return "Lax";
  if (value === "strict") return "Strict";
  return "None";
}

function buildExpiredSetCookieHeader(options: ExpireCookieOptions): string {
  const parts = [
    `${options.name}=`,
    `Path=${options.path ?? "/"}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    `SameSite=${capitalizeSameSite(options.sameSite ?? "lax")}`,
  ];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.domain) parts.push(`Domain=${options.domain}`);
  return parts.join("; ");
}

function appendExpiredCookie(
  response: NextResponse,
  options: ExpireCookieOptions,
): void {
  response.headers.append(
    "Set-Cookie",
    buildExpiredSetCookieHeader(options),
  );
}

/** 在 NextResponse 上 append 多条 Set-Cookie 清掉会话与 SSO cookie */
export function applyLogoutCookies(
  request: NextRequest,
  response: NextResponse,
): void {
  const names = new Set<string>([VIBETIDE_SESSION_COOKIE, ...SSO_COOKIE_NAMES]);

  for (const cookie of request.cookies.getAll()) {
    names.add(cookie.name);
  }

  for (const options of getSessionCookieDeleteOptions()) {
    appendExpiredCookie(response, {
      name: VIBETIDE_SESSION_COOKIE,
      path: options.path,
      secure: options.secure,
      sameSite: options.sameSite,
      httpOnly: options.httpOnly,
    });
  }

  const base = getHostCookieBaseOptions();
  const hostVariants = [base];
  if (base.secure) {
    hostVariants.push({ ...base, secure: false });
  }

  for (const name of names) {
    if (name === VIBETIDE_SESSION_COOKIE) continue;
    for (const variant of hostVariants) {
      appendExpiredCookie(response, {
        name,
        path: variant.path,
        secure: variant.secure,
        sameSite: variant.sameSite,
      });
    }
  }

  const parentDomain = resolveSsoCookieDomain();
  if (parentDomain) {
    for (const name of names) {
      appendExpiredCookie(response, {
        name,
        path: base.path,
        secure: base.secure,
        sameSite: base.sameSite,
        domain: parentDomain,
      });
      if (base.secure) {
        appendExpiredCookie(response, {
          name,
          path: base.path,
          secure: false,
          sameSite: base.sameSite,
          domain: parentDomain,
        });
      }
    }
  }
}
