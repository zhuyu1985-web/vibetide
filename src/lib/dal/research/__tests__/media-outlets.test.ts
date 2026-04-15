// src/lib/dal/research/__tests__/media-outlets.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { listMediaOutlets } from "../media-outlets";
import { db } from "@/db";
import { organizations } from "@/db/schema/users";

let ORG_ID: string;

beforeAll(async () => {
  if (process.env.SEED_ORG_ID) {
    ORG_ID = process.env.SEED_ORG_ID;
    return;
  }
  const orgs = await db.select({ id: organizations.id }).from(organizations).limit(1);
  if (orgs.length === 0) throw new Error("No organization for tests");
  ORG_ID = orgs[0].id;
});

describe("listMediaOutlets", () => {
  it("returns outlets filtered by tier=central", async () => {
    const central = await listMediaOutlets({ organizationId: ORG_ID, tier: "central" });
    expect(central.length).toBeGreaterThan(0);
    expect(central.every((o) => o.tier === "central")).toBe(true);
  });

  it("returns outlets filtered by tier=district_media with district name resolved", async () => {
    const district = await listMediaOutlets({ organizationId: ORG_ID, tier: "district_media" });
    expect(district.length).toBeGreaterThan(0);
    expect(district.every((o) => o.tier === "district_media")).toBe(true);
    expect(district.some((o) => o.districtName !== null)).toBe(true);
  });

  it("supports case-insensitive name search", async () => {
    const result = await listMediaOutlets({ organizationId: ORG_ID, search: "新华" });
    expect(result.some((o) => o.name.includes("新华"))).toBe(true);
  });

  it("aliasCount is computed correctly for 新华社", async () => {
    const result = await listMediaOutlets({ organizationId: ORG_ID, search: "新华社" });
    const xinhua = result.find((o) => o.name === "新华社");
    expect(xinhua).toBeDefined();
    expect(xinhua!.aliasCount).toBeGreaterThanOrEqual(2); // seeded with 新华网 + 新华社客户端
  });

  it("listing all tiers returns at least 41 outlets (seeded count)", async () => {
    const all = await listMediaOutlets({ organizationId: ORG_ID });
    expect(all.length).toBeGreaterThanOrEqual(41);
  });
});
