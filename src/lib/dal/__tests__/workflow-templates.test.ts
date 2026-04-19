import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { organizations, workflowTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  listWorkflowTemplatesByOrg,
  getWorkflowTemplateByLegacyKey,
} from "../workflow-templates";

describe("listWorkflowTemplatesByOrg", () => {
  const orgId = randomUUID();

  beforeAll(async () => {
    const stamp = Date.now();
    await db
      .insert(organizations)
      .values({
        id: orgId,
        name: "test-org-list-wf",
        slug: `test-list-wf-${stamp}`,
      })
      .onConflictDoNothing();

    // Insert 4 rows: 2 builtin (news + deep), 1 builtin (advanced with xiaolei team), 1 custom
    await db
      .insert(workflowTemplates)
      .values([
        {
          organizationId: orgId,
          name: "test-builtin-news-1",
          category: "news",
          isBuiltin: true,
          isEnabled: true,
          defaultTeam: ["xiaolei"],
          steps: [],
        },
        {
          organizationId: orgId,
          name: "test-builtin-deep-1",
          category: "deep",
          isBuiltin: true,
          isEnabled: true,
          defaultTeam: ["xiaoce", "xiaowen"],
          steps: [],
        },
        {
          organizationId: orgId,
          name: "test-builtin-adv-1",
          category: "advanced",
          isBuiltin: true,
          isEnabled: true,
          defaultTeam: ["xiaolei", "xiaowen"],
          steps: [],
        },
        {
          organizationId: orgId,
          name: "test-custom-1",
          category: "custom",
          isBuiltin: false,
          isEnabled: true,
          defaultTeam: [],
          steps: [],
        },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db
      .delete(workflowTemplates)
      .where(eq(workflowTemplates.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("returns all enabled templates when no filter", async () => {
    const rows = await listWorkflowTemplatesByOrg(orgId);
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });

  it("filters by category", async () => {
    const rows = await listWorkflowTemplatesByOrg(orgId, { category: "news" });
    expect(rows.every((r) => r.category === "news")).toBe(true);
    expect(rows.some((r) => r.name === "test-builtin-news-1")).toBe(true);
  });

  it("filters by isBuiltin=true", async () => {
    const rows = await listWorkflowTemplatesByOrg(orgId, { isBuiltin: true });
    expect(rows.every((r) => r.isBuiltin === true)).toBe(true);
  });

  it("filters by employeeSlug (defaultTeam contains)", async () => {
    const rows = await listWorkflowTemplatesByOrg(orgId, {
      employeeSlug: "xiaolei",
    });
    // Two seeded rows have xiaolei: news-1 and adv-1
    expect(
      rows.every((r) => (r.defaultTeam as string[]).includes("xiaolei"))
    ).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("combined filter: isBuiltin + category", async () => {
    const rows = await listWorkflowTemplatesByOrg(orgId, {
      isBuiltin: true,
      category: "deep",
    });
    expect(rows.every((r) => r.isBuiltin && r.category === "deep")).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

describe("getWorkflowTemplateByLegacyKey", () => {
  const orgId = randomUUID();

  beforeAll(async () => {
    const stamp = Date.now();
    await db.insert(organizations)
      .values({ id: orgId, name: "test-org-legacy-key", slug: `test-legacy-key-${stamp}` })
      .onConflictDoNothing();

    await db.insert(workflowTemplates).values([
      {
        organizationId: orgId,
        name: "test-legacy-lookup",
        category: "news",
        isBuiltin: true,
        isEnabled: true,
        legacyScenarioKey: "breaking_news_test",
        defaultTeam: [],
        steps: [],
      },
    ]).onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(workflowTemplates).where(eq(workflowTemplates.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("returns row matching legacy_scenario_key for org", async () => {
    const row = await getWorkflowTemplateByLegacyKey(orgId, "breaking_news_test");
    expect(row?.name).toBe("test-legacy-lookup");
  });

  it("returns null when legacy key not found", async () => {
    const row = await getWorkflowTemplateByLegacyKey(orgId, "nonexistent_key_xyz");
    expect(row).toBeNull();
  });

  it("does not match rows from other orgs with same key", async () => {
    const otherOrgId = randomUUID();
    // Don't actually seed another org — just confirm the query is org-scoped
    const row = await getWorkflowTemplateByLegacyKey(otherOrgId, "breaking_news_test");
    expect(row).toBeNull();
  });
});
