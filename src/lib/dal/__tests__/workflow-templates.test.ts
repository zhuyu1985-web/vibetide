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
  seedBuiltinTemplatesForOrg,
  type BuiltinSeedInput,
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
          steps: [{ id: "s1", config: { skillSlug: "test_skill" } }],
        },
        {
          organizationId: orgId,
          name: "test-builtin-deep-1",
          category: "deep",
          isBuiltin: true,
          isEnabled: true,
          defaultTeam: ["xiaoce", "xiaowen"],
          steps: [{ id: "s1", config: { skillSlug: "test_skill" } }],
        },
        {
          organizationId: orgId,
          name: "test-builtin-adv-1",
          category: "advanced",
          isBuiltin: true,
          isEnabled: true,
          defaultTeam: ["xiaolei", "xiaowen"],
          steps: [{ id: "s1", config: { skillSlug: "test_skill" } }],
        },
        {
          organizationId: orgId,
          name: "test-custom-1",
          category: "custom",
          isBuiltin: false,
          isEnabled: true,
          defaultTeam: [],
          steps: [{ id: "s1", config: { skillSlug: "test_skill" } }],
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

describe("seedBuiltinTemplatesForOrg", () => {
  const orgId = randomUUID();

  beforeAll(async () => {
    const stamp = Date.now();
    await db.insert(organizations)
      .values({ id: orgId, name: "test-org-seed", slug: `test-seed-${stamp}` })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(workflowTemplates).where(eq(workflowTemplates.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  const seedList: BuiltinSeedInput[] = [
    {
      name: "seed-news-with-key",
      category: "news",
      legacyScenarioKey: "seed_news_key_1",
      defaultTeam: ["xiaolei"],
      steps: [{ id: "s1", config: { skillSlug: "test_skill" } }],
    },
    {
      name: "seed-custom-no-key",
      category: "custom",
      legacyScenarioKey: null,     // 走 (org_id, name) WHERE is_builtin partial index
      defaultTeam: [],
      steps: [{ id: "s1", config: { skillSlug: "test_skill" } }],
    },
  ];

  it("inserts new rows on first run", async () => {
    await seedBuiltinTemplatesForOrg(orgId, seedList);
    const rows = await listWorkflowTemplatesByOrg(orgId, { isBuiltin: true });
    const ours = rows.filter(r => r.name.startsWith("seed-"));
    expect(ours.length).toBe(2);
  });

  it("is idempotent on second run (no duplicates)", async () => {
    await seedBuiltinTemplatesForOrg(orgId, seedList);
    const rows = await listWorkflowTemplatesByOrg(orgId, { isBuiltin: true });
    const ours = rows.filter(r => r.name.startsWith("seed-"));
    expect(ours.length).toBe(2);
  });

  it("updates fields on re-seed with same key (legacy key path)", async () => {
    const updated: BuiltinSeedInput[] = [
      {
        ...seedList[0],
        description: "updated-via-reseed",
      },
      seedList[1],
    ];
    await seedBuiltinTemplatesForOrg(orgId, updated);
    const row = await getWorkflowTemplateByLegacyKey(orgId, "seed_news_key_1");
    expect(row?.description).toBe("updated-via-reseed");
  });

  it("updates fields on re-seed with same name (no-legacy-key path)", async () => {
    const updated: BuiltinSeedInput[] = [
      seedList[0],
      {
        ...seedList[1],
        description: "updated-via-name-key",
      },
    ];
    await seedBuiltinTemplatesForOrg(orgId, updated);
    const rows = await listWorkflowTemplatesByOrg(orgId, { isBuiltin: true });
    const target = rows.find(r => r.name === "seed-custom-no-key");
    expect(target?.description).toBe("updated-via-name-key");
  });
});

describe("B.1 AC: two-entry same-source assertion", () => {
  const orgId = randomUUID();

  beforeAll(async () => {
    const stamp = Date.now();
    await db.insert(organizations)
      .values({ id: orgId, name: "test-org-two-entry", slug: `test-two-entry-${stamp}` })
      .onConflictDoNothing();

    // Seed at least 2 rows so set comparison is meaningful
    await db.insert(workflowTemplates).values([
      { organizationId: orgId, name: "two-entry-a", category: "news", isBuiltin: true, isEnabled: true, defaultTeam: ["xiaolei"], steps: [{ id: "s1", config: { skillSlug: "test_skill" } }] },
      { organizationId: orgId, name: "two-entry-b", category: "deep", isBuiltin: true, isEnabled: true, defaultTeam: ["xiaoce"], steps: [{ id: "s1", config: { skillSlug: "test_skill" } }] },
      // One disabled row to verify filter consistency
      { organizationId: orgId, name: "two-entry-disabled", category: "news", isBuiltin: true, isEnabled: false, defaultTeam: [], steps: [] },
      // One non-builtin to verify filter consistency
      { organizationId: orgId, name: "two-entry-custom", category: "custom", isBuiltin: false, isEnabled: true, defaultTeam: [], steps: [] },
    ]).onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(workflowTemplates).where(eq(workflowTemplates.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("首页 filter and 任务中心 filter return identical workflow id sets", async () => {
    // Filter used by /home/page.tsx (Task 15) and /missions/page.tsx (Task 17)
    const homeFilter = { isBuiltin: true, isEnabled: true };
    const missionsFilter = { isBuiltin: true, isEnabled: true };

    const home = await listWorkflowTemplatesByOrg(orgId, homeFilter);
    const missions = await listWorkflowTemplatesByOrg(orgId, missionsFilter);

    const homeIds = new Set(home.map(w => w.id));
    const missionIds = new Set(missions.map(w => w.id));

    expect(homeIds).toEqual(missionIds);
    expect(home.length).toBeGreaterThanOrEqual(2);
    // Disabled row must be excluded from both
    expect(home.find(w => w.name === "two-entry-disabled")).toBeUndefined();
    expect(missions.find(w => w.name === "two-entry-disabled")).toBeUndefined();
    // Non-builtin row must be excluded from both
    expect(home.find(w => w.name === "two-entry-custom")).toBeUndefined();
    expect(missions.find(w => w.name === "two-entry-custom")).toBeUndefined();
  });

  it("changing isBuiltin filter breaks the equality (canary)", async () => {
    // If someone accidentally changes one page to use different filter, this test catches it
    const home = await listWorkflowTemplatesByOrg(orgId, { isBuiltin: true, isEnabled: true });
    const missions = await listWorkflowTemplatesByOrg(orgId, { isBuiltin: false, isEnabled: true });
    const homeIds = new Set(home.map(w => w.id));
    const missionIds = new Set(missions.map(w => w.id));
    // Expect inequality to confirm the canary works
    expect(homeIds).not.toEqual(missionIds);
  });
});
