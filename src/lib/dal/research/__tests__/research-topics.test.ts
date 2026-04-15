// src/lib/dal/research/__tests__/research-topics.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { listResearchTopics, getResearchTopicById } from "../research-topics";
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

describe("listResearchTopics", () => {
  it("returns at least 16 preset topics for seeded org", async () => {
    const result = await listResearchTopics(ORG_ID);
    expect(result.length).toBeGreaterThanOrEqual(16);
    const names = result.map((r) => r.name);
    expect(names).toContain("环保督察");
    expect(names).toContain("绿水青山");
    expect(names).toContain("美丽中国");
  });

  it("primaryKeyword matches topic name for all preset topics", async () => {
    const result = await listResearchTopics(ORG_ID);
    const presets = result.filter((r) => r.isPreset);
    for (const t of presets) {
      expect(t.primaryKeyword).toBe(t.name);
    }
  });

  it("aliasCount is >= 1 for topics that have 近似称谓", async () => {
    const result = await listResearchTopics(ORG_ID);
    const meili = result.find((r) => r.name === "美丽中国");
    expect(meili?.aliasCount).toBeGreaterThanOrEqual(2); // "美丽中国建设", "生态宜居"
    const zonghe = result.find((r) => r.name === "综合治理");
    expect(zonghe?.aliasCount).toBeGreaterThanOrEqual(5);
  });
});

describe("getResearchTopicById", () => {
  it("returns topic with its keywords and samples", async () => {
    const topics = await listResearchTopics(ORG_ID);
    const first = topics[0];
    const detail = await getResearchTopicById(first.id, ORG_ID);
    expect(detail).not.toBeNull();
    expect(detail!.topic.id).toBe(first.id);
    expect(detail!.keywords.length).toBeGreaterThanOrEqual(1);
    expect(detail!.samples).toBeInstanceOf(Array); // samples empty until Task 10+ sample rows exist
  });

  it("returns null for foreign org", async () => {
    const topics = await listResearchTopics(ORG_ID);
    const first = topics[0];
    const fakeOrg = "00000000-0000-0000-0000-000000000000";
    const detail = await getResearchTopicById(first.id, fakeOrg);
    expect(detail).toBeNull();
  });
});
