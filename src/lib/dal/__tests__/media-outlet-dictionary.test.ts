// /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/__tests__/media-outlet-dictionary.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { organizations } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import {
  listOutletsByOrg, getOutletById, searchOutletsByName,
  bumpDictionaryVersion, getDictionaryVersion,
} from "../media-outlet-dictionary";

let orgA: string;
let orgB: string;

beforeAll(async () => {
  const [a] = await db.insert(organizations).values({ name: "Test Org A", slug: "test-a-" + Date.now() }).returning();
  const [b] = await db.insert(organizations).values({ name: "Test Org B", slug: "test-b-" + Date.now() }).returning();
  orgA = a!.id;
  orgB = b!.id;

  // orgA 灌 3 条
  await db.insert(mediaOutletDictionary).values([
    { organizationId: orgA, outletName: "新华社", outletTier: "central", outletRegion: "全国", domains: ["xinhuanet.com"], publicAccountNames: ["新华社"] },
    { organizationId: orgA, outletName: "重庆日报", outletTier: "provincial_municipal", outletRegion: "重庆", domains: ["cqrb.cn"], publicAccountNames: ["重庆日报"] },
    { organizationId: orgA, outletName: "涪陵发布", outletTier: "district_media", outletRegion: "重庆", outletDistrict: "涪陵区", publicAccountNames: ["涪陵发布"] },
  ]);
  // orgB 灌 1 条
  await db.insert(mediaOutletDictionary).values({
    organizationId: orgB, outletName: "人民日报", outletTier: "central", outletRegion: "全国",
  });
});

afterAll(async () => {
  await db.delete(organizations).where(eq(organizations.id, orgA));
  await db.delete(organizations).where(eq(organizations.id, orgB));
});

describe("listOutletsByOrg", () => {
  it("默认按 tier 升序 + outletName 升序", async () => {
    const rows = await listOutletsByOrg(orgA);
    expect(rows.length).toBe(3);
    expect(rows[0]!.outletTier).toBe("central");
  });

  it("按 tier 过滤", async () => {
    const rows = await listOutletsByOrg(orgA, { tier: "district_media" });
    expect(rows.length).toBe(1);
    expect(rows[0]!.outletName).toBe("涪陵发布");
  });

  it("按 region 过滤", async () => {
    const rows = await listOutletsByOrg(orgA, { region: "重庆" });
    expect(rows.length).toBe(2);
  });

  it("按 search 关键词命中 outletName / publicAccountNames / domains", async () => {
    const a = await listOutletsByOrg(orgA, { search: "重庆" });
    expect(a.length).toBe(1); // 只命中 outletName
    const b = await listOutletsByOrg(orgA, { search: "xinhuanet" });
    expect(b.length).toBe(1); // 命中 domains
    const c = await listOutletsByOrg(orgA, { search: "涪陵发布" });
    expect(c.length).toBe(1); // 命中 publicAccountNames
  });

  it("跨 org 隔离 — orgB 看不到 orgA 数据", async () => {
    const rows = await listOutletsByOrg(orgB);
    expect(rows.length).toBe(1);
    expect(rows[0]!.outletName).toBe("人民日报");
  });
});

describe("getOutletById", () => {
  it("跨 org 返回 null", async () => {
    const orgARows = await listOutletsByOrg(orgA);
    const result = await getOutletById(orgARows[0]!.id, orgB);
    expect(result).toBeNull();
  });
});

describe("bumpDictionaryVersion", () => {
  it("version +1，返回新 version", async () => {
    const before = await getDictionaryVersion(orgA);
    const newVersion = await bumpDictionaryVersion(orgA);
    expect(newVersion).toBe(before + 1);
    const after = await getDictionaryVersion(orgA);
    expect(after).toBe(newVersion);
  });
});

describe("createOutlet 唯一约束", () => {
  it("同 org 重名报错", async () => {
    await expect(db.insert(mediaOutletDictionary).values({
      organizationId: orgA, outletName: "新华社", outletTier: "central",
    })).rejects.toThrow();
  });
});
