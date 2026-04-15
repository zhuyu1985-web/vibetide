import { db } from "@/db";
import {
  mediaOutlets,
  mediaOutletAliases,
} from "@/db/schema/research/media-outlets";
import { eq, and } from "drizzle-orm";

export type OutletMatch = {
  outletId: string;
  tier: "central" | "provincial_municipal" | "industry" | "district_media";
  districtId: string | null;
} | null;

/**
 * Resolve a URL to an outlet_id via:
 *  1. Hostname equals (or ends with "." + ) outlet.officialUrl hostname
 *  2. Alias.matchPattern as hostname substring
 */
export async function matchOutletForUrl(
  url: string,
  organizationId: string,
): Promise<OutletMatch> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }

  const rows = await db
    .select({
      id: mediaOutlets.id,
      tier: mediaOutlets.tier,
      districtId: mediaOutlets.districtId,
      officialUrl: mediaOutlets.officialUrl,
    })
    .from(mediaOutlets)
    .where(
      and(
        eq(mediaOutlets.organizationId, organizationId),
        eq(mediaOutlets.status, "active"),
      ),
    );

  for (const o of rows) {
    if (!o.officialUrl) continue;
    try {
      const oh = new URL(o.officialUrl).hostname.toLowerCase().replace(/^www\./, "");
      if (hostname === oh || hostname.endsWith("." + oh)) {
        return { outletId: o.id, tier: o.tier, districtId: o.districtId };
      }
    } catch {}
  }

  const aliases = await db
    .select({
      outletId: mediaOutletAliases.outletId,
      matchPattern: mediaOutletAliases.matchPattern,
    })
    .from(mediaOutletAliases);

  for (const a of aliases) {
    if (!a.matchPattern) continue;
    if (hostname.includes(a.matchPattern.toLowerCase())) {
      const [outlet] = await db
        .select({ tier: mediaOutlets.tier, districtId: mediaOutlets.districtId })
        .from(mediaOutlets)
        .where(eq(mediaOutlets.id, a.outletId));
      if (outlet) {
        return { outletId: a.outletId, tier: outlet.tier, districtId: outlet.districtId };
      }
    }
  }

  return null;
}

/**
 * Batch variant — resolves many URLs in one pass, preloading outlets + aliases.
 */
export async function matchOutletsForUrls(
  urls: string[],
  organizationId: string,
): Promise<Map<string, OutletMatch>> {
  const result = new Map<string, OutletMatch>();
  const outlets = await db
    .select()
    .from(mediaOutlets)
    .where(
      and(
        eq(mediaOutlets.organizationId, organizationId),
        eq(mediaOutlets.status, "active"),
      ),
    );
  const aliases = await db.select().from(mediaOutletAliases);

  const byHost = new Map<string, (typeof outlets)[number]>();
  for (const o of outlets) {
    if (!o.officialUrl) continue;
    try {
      const h = new URL(o.officialUrl).hostname.toLowerCase().replace(/^www\./, "");
      byHost.set(h, o);
    } catch {}
  }
  const outletById = new Map(outlets.map((o) => [o.id, o]));

  for (const url of urls) {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      result.set(url, null);
      continue;
    }

    let match: OutletMatch = null;
    for (const [h, o] of byHost) {
      if (hostname === h || hostname.endsWith("." + h)) {
        match = { outletId: o.id, tier: o.tier, districtId: o.districtId };
        break;
      }
    }
    if (!match) {
      for (const a of aliases) {
        if (a.matchPattern && hostname.includes(a.matchPattern.toLowerCase())) {
          const o = outletById.get(a.outletId);
          if (o) {
            match = { outletId: a.outletId, tier: o.tier, districtId: o.districtId };
            break;
          }
        }
      }
    }
    result.set(url, match);
  }
  return result;
}
