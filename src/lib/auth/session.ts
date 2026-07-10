import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import {
  getHostCookieBaseOptions,
} from "@/lib/auth/cookie-options";

export type SessionPayload = {
  id: string;
  organizationId: string;
  displayName: string;
  isSuperAdmin: boolean;
};

export const VIBETIDE_SESSION_COOKIE = "vibetide-session";

function getSessionOptions(): SessionOptions {
  const password = process.env.AUTH_SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "AUTH_SESSION_SECRET is missing or shorter than 32 chars. " +
        "Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\""
    );
  }

  const ttl = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 604800);
  const base = getHostCookieBaseOptions();

  return {
    password,
    cookieName: VIBETIDE_SESSION_COOKIE,
    ttl,
    cookieOptions: {
      httpOnly: true,
      secure: base.secure,
      sameSite: base.sameSite,
      path: base.path,
    },
  };
}

export function getSessionCookieDeleteOptions(): Array<{
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
}> {
  const base = getHostCookieBaseOptions();
  const variants = [{ httpOnly: true, ...base }];
  // 兼容 HTTPS 本地开发升级前 secure:false 写入的旧 cookie
  if (base.secure) {
    variants.push({ httpOnly: true, ...base, secure: false });
  }
  return variants;
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const session = await getIronSession<Partial<SessionPayload>>(
    store,
    getSessionOptions()
  );
  if (!session.id || !session.organizationId) return null;
  return {
    id: session.id,
    organizationId: session.organizationId,
    displayName: session.displayName ?? "",
    isSuperAdmin: !!session.isSuperAdmin,
  };
}

export async function setSession(payload: SessionPayload): Promise<void> {
  const store = await cookies();
  const session = await getIronSession<SessionPayload>(
    store,
    getSessionOptions()
  );
  Object.assign(session, payload);
  await session.save();
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const session = await getIronSession<SessionPayload>(
    store,
    getSessionOptions()
  );
  session.destroy();
}

/** 显式过期 vibetide-session（delete 必须带与写入时一致的 httpOnly/secure/path） */
export async function expireSessionCookie(): Promise<void> {
  const store = await cookies();
  for (const options of getSessionCookieDeleteOptions()) {
    store.delete({ name: VIBETIDE_SESSION_COOKIE, ...options });
    store.set(VIBETIDE_SESSION_COOKIE, "", {
      ...options,
      maxAge: 0,
      expires: new Date(0),
    });
  }
}
