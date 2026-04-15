import { createHash } from "node:crypto";

/**
 * Normalize URL for dedup:
 *  - Lowercase scheme + host (path is case-preserving)
 *  - Drop fragment
 *  - Drop trailing slash on pathname (unless pathname is "/")
 *  - Drop tracking query params (utm_*, fbclid, gclid, spm, ref, _hsmi)
 *  - Sort remaining query params alphabetically
 */
export function normalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();

  const TRACKING = /^(utm_|fbclid$|gclid$|spm$|ref$|_hsmi$)/i;
  const keep: [string, string][] = [];
  u.searchParams.forEach((v, k) => {
    if (!TRACKING.test(k)) keep.push([k, v]);
  });
  keep.sort(([a], [b]) => a.localeCompare(b));
  u.search = "";
  for (const [k, v] of keep) u.searchParams.append(k, v);

  let pathname = u.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  u.pathname = pathname;

  return u.toString();
}

export function hashUrl(raw: string): string {
  const normalized = normalizeUrl(raw);
  return createHash("sha256").update(normalized).digest("hex");
}
