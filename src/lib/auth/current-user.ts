import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";

export type CurrentUser = SessionPayload;

/**
 * Returns the logged-in user from session cookie, or null.
 * Replaces `supabase.auth.getUser()`.
 *
 * Cached per-request via React `cache()` — multiple callers in the same
 * render pass share one cookie read.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  return getSession();
});

/**
 * Throws/redirects if no session. Use in server actions and protected pages
 * where unauthenticated access should never reach the body.
 */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
