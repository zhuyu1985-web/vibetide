import { describe, it, expect, beforeAll } from "vitest";
import { matchOutletForUrl } from "../outlet-matcher";
import { db } from "@/db";
import { organizations } from "@/db/schema/users";

let ORG_ID: string;
beforeAll(async () => {
  const orgs = await db.select({ id: organizations.id }).from(organizations).limit(1);
  if (orgs.length === 0) throw new Error("No organization for tests");
  ORG_ID = orgs[0].id;
});

describe("matchOutletForUrl", () => {
  it("matches 新华社 via xinhuanet.com alias", async () => {
    const r = await matchOutletForUrl("https://www.xinhuanet.com/politics/2025-06-01/c_123.htm", ORG_ID);
    expect(r).not.toBeNull();
    expect(r!.tier).toBe("central");
  });

  it("matches 人民日报 via official URL people.com.cn", async () => {
    const r = await matchOutletForUrl("https://www.people.com.cn/n1/2025/123.html", ORG_ID);
    expect(r).not.toBeNull();
    expect(r!.tier).toBe("central");
  });

  it("returns null for unknown domain", async () => {
    const r = await matchOutletForUrl("https://example-unknown-site.xyz/a", ORG_ID);
    expect(r).toBeNull();
  });

  it("handles invalid URL gracefully", async () => {
    const r = await matchOutletForUrl("not a url", ORG_ID);
    expect(r).toBeNull();
  });
});
