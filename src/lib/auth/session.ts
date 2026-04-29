import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export type SessionPayload = {
  id: string;
  organizationId: string;
  displayName: string;
  isSuperAdmin: boolean;
};

const COOKIE_NAME = "vibetide-session";

function getSessionOptions(): SessionOptions {
  const password = process.env.AUTH_SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "AUTH_SESSION_SECRET is missing or shorter than 32 chars. " +
        "Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\""
    );
  }

  const ttl = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 604800);

  return {
    password,
    cookieName: COOKIE_NAME,
    ttl,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
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
