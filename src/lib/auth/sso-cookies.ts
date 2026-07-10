import { cookies } from "next/headers";
import {
  getHostCookieBaseOptions,
  resolveSsoCookieDomain,
} from "@/lib/auth/cookie-options";
import {
  expireSessionCookie,
  VIBETIDE_SESSION_COOKIE,
} from "@/lib/auth/session";

/** CMC SSO 相关 cookie，退出时额外在父域做过期处理 */
export const SSO_COOKIE_NAMES = [
  "xn_userInfo",
  "login_cmc_id",
  "login_cmc_tid",
] as const;

export type SsoCookieName = (typeof SSO_COOKIE_NAMES)[number];

function expireOnParentDomain(
  store: Awaited<ReturnType<typeof cookies>>,
  names: Iterable<string>,
): void {
  const domain = resolveSsoCookieDomain();
  if (!domain) return;

  const base = getHostCookieBaseOptions();
  for (const name of names) {
    store.set(name, "", {
      ...base,
      domain,
      maxAge: 0,
      expires: new Date(0),
    });
  }
}

function expireHostCookie(
  store: Awaited<ReturnType<typeof cookies>>,
  name: string,
): void {
  const base = getHostCookieBaseOptions();
  const variants = [base];
  if (base.secure) {
    variants.push({ ...base, secure: false });
  }

  for (const options of variants) {
    store.delete({ name, ...options });
    store.set(name, "", {
      ...options,
      maxAge: 0,
      expires: new Date(0),
    });
  }
}

/** 退出登录：清空当前请求携带的全部 cookie + 父域 SSO cookie */
export async function clearAllCookies(): Promise<void> {
  const store = await cookies();
  const names = new Set<string>([VIBETIDE_SESSION_COOKIE, ...SSO_COOKIE_NAMES]);

  for (const cookie of store.getAll()) {
    names.add(cookie.name);
  }

  await expireSessionCookie();

  for (const name of names) {
    if (name === VIBETIDE_SESSION_COOKIE) continue;
    expireHostCookie(store, name);
  }

  expireOnParentDomain(store, names);
}

export { resolveSsoCookieDomain } from "@/lib/auth/cookie-options";

/** @deprecated 使用 clearAllCookies */
export async function clearSsoCookies(): Promise<void> {
  await clearAllCookies();
}
