import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { organizations, workflowTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  listWorkflowTemplatesByOrg,
  getWorkflowTemplateByLegacyKey,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  softDisableWorkflowTemplate,
  getWorkflowTemplate,
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

describe("createWorkflowTemplate / updateWorkflowTemplate / softDisableWorkflowTemplate", () => {
  const orgId = randomUUID();

  beforeAll(async () => {
    const stamp = Date.now();
    await db.insert(organizations)
      .values({ id: orgId, name: "test-org-mutations", slug: `test-mutations-${stamp}` })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(workflowTemplates).where(eq(workflowTemplates.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("createWorkflowTemplate inserts a custom template with defaults", async () => {
    const created = await createWorkflowTemplate(orgId, {
      name: "test-create-1",
      description: "test description",
      category: "custom",
      steps: [],
      defaultTeam: ["xiaoshu"],
    });
    expect(created.id).toBeTruthy();
    expect(created.isBuiltin).toBe(false);
    expect(created.isEnabled).toBe(true);
    expect(created.name).toBe("test-create-1");
    expect(created.defaultTeam).toEqual(["xiaoshu"]);
    expect(created.category).toBe("custom");
  });

  it("updateWorkflowTemplate updates fields", async () => {
    const created = await createWorkflowTemplate(orgId, {
      name: "test-update-1",
      category: "custom",
      steps: [],
    });
    await updateWorkflowTemplate(created.id, {
      description: "updated-desc",
      icon: "Zap",
    });
    const fetched = await getWorkflowTemplate(created.id);
    expect(fetched?.description).toBe("updated-desc");
    expect(fetched?.icon).toBe("Zap");
  });

  it("softDisableWorkflowTemplate sets isEnabled=false", async () => {
    const created = await createWorkflowTemplate(orgId, {
      name: "test-soft-1",
      category: "custom",
      steps: [],
    });
    await softDisableWorkflowTemplate(created.id);
    const fetched = await getWorkflowTemplate(created.id);
    expect(fetched?.isEnabled).toBe(false);
  });

  it("createWorkflowTemplate persists all B.1 new fields", async () => {
    const created = await createWorkflowTemplate(orgId, {
      name: "test-create-fields",
      category: "news",
      steps: [],
      icon: "FileText",
      inputFields: [{ name: "topic", label: "话题", type: "text", required: true }],
      defaultTeam: ["xiaolei", "xiaowen"],
      appChannelSlug: "app_news",
      systemInstruction: "测试指令",
      legacyScenarioKey: "test_legacy_key",
      isBuiltin: true,
    });
    expect(created.icon).toBe("FileText");
    expect(created.inputFields).toEqual([{ name: "topic", label: "话题", type: "text", required: true }]);
    expect(created.defaultTeam).toEqual(["xiaolei", "xiaowen"]);
    expect(created.appChannelSlug).toBe("app_news");
    expect(created.systemInstruction).toBe("测试指令");
    expect(created.legacyScenarioKey).toBe("test_legacy_key");
    expect(created.isBuiltin).toBe(true);
  });
});
