/** 会话与 SSO cookie 的共享选项（set/delete 必须一致才能清掉） */

export function useSecureCookie(): boolean {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    try {
      return new URL(siteUrl).protocol === "https:";
    } catch {
      // fall through
    }
  }
  return process.env.NODE_ENV === "production";
}

export function parentDomainFromHostname(hostname: string): string | undefined {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length < 3) return undefined;
  return `.${parts.slice(-3).join(".")}`;
}

export function resolveSsoCookieDomain(): string | undefined {
  const configured = process.env.CMC_COOKIE_DOMAIN?.trim();
  if (configured) return configured;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) return undefined;

  try {
    const hostname = new URL(siteUrl).hostname;
    if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
      return undefined;
    }
    return parentDomainFromHostname(hostname);
  } catch {
    return undefined;
  }
}

export type HostCookieOptions = {
  httpOnly?: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
};

export function getHostCookieBaseOptions(): HostCookieOptions {
  return {
    secure: useSecureCookie(),
    sameSite: "lax",
    path: "/",
  };
}
