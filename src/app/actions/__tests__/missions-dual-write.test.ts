import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";

// `revalidatePath` requires Next's static-generation store at runtime; in
// vitest it throws "Invariant: static generation store missing". Stub it out
// so the server action logic (the part we actually care about) runs.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// `executeMissionDirect` fires a detached promise that performs LLM calls,
// writes back to the DB, and polls. None of this is relevant to the dual-
// write assertion and it slows tests down. Stub to a no-op resolver.
vi.mock("@/lib/mission-executor", () => ({
  executeMissionDirect: vi.fn(async () => undefined),
}));

import { db } from "@/db";
import {
  organizations,
  workflowTemplates,
  missions,
  missionTasks,
  missionMessages,
  missionArtifacts,
  aiEmployees,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  resolveWorkflowTemplateId,
  startMissionFromModule,
} from "../missions";

/**
 * B.1 Unified Scenario Workflow — Task 13
 *
 * Verifies `startMission`/`startMissionFromModule` dual-write pattern:
 *   - `missions.scenario` (text slug, unchanged semantics)
 *   - `missions.workflow_template_id` (new FK → workflow_templates.id)
 *
 * `startMission` itself requires Supabase auth (can't unit-test cleanly in
 * node env), so we test:
 *   1. The pure `resolveWorkflowTemplateId` helper (3 cases).
 *   2. `startMissionFromModule` end-to-end (org is a param, no auth dep).
 *
 * Both share the same resolution helper, so coverage of one lane + the helper
 * unit-tests gives full confidence.
 */
describe("resolveWorkflowTemplateId (unit)", () => {
  const orgId = randomUUID();

  beforeAll(async () => {
    const stamp = Date.now();
    await db
      .insert(organizations)
      .values({ id: orgId, name: "test-org-resolve", slug: `test-resolve-${stamp}` })
      .onConflictDoNothing();
    await db
      .insert(workflowTemplates)
      .values({
        organizationId: orgId,
        name: "test-resolve-tmpl",
        category: "news",
        isBuiltin: true,
        isEnabled: true,
        legacyScenarioKey: "resolve_legacy_key",
        defaultTeam: [],
        steps: [],
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(workflowTemplates).where(eq(workflowTemplates.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("returns explicit id when provided (highest priority)", async () => {
    const explicit = randomUUID();
    // Note: pass a real legacy key too — explicit should still win without DB lookup.
    const result = await resolveWorkflowTemplateId(orgId, "resolve_legacy_key", explicit);
    expect(result).toBe(explicit);
  });

  it("auto-resolves from legacy scenario key when explicit id missing", async () => {
    const result = await resolveWorkflowTemplateId(orgId, "resolve_legacy_key", undefined);
    expect(result).toBeTruthy();
    // Confirm it matches the seeded template
    const row = await db.query.workflowTemplates.findFirst({
      where: eq(workflowTemplates.legacyScenarioKey, "resolve_legacy_key"),
    });
    expect(result).toBe(row?.id);
  });

  it("returns null when scenario has no matching template", async () => {
    const result = await resolveWorkflowTemplateId(orgId, "no_such_key_xyz123", undefined);
    expect(result).toBeNull();
  });

  it("returns null when scenario slug is undefined and no explicit id", async () => {
    const result = await resolveWorkflowTemplateId(orgId, undefined, undefined);
    expect(result).toBeNull();
  });
});

describe("startMissionFromModule dual-write (integration)", () => {
  const orgId = randomUUID();
  let templateId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    await db
      .insert(organizations)
      .values({ id: orgId, name: "test-org-dw", slug: `test-dw-${stamp}` })
      .onConflictDoNothing();

    const [t] = await db
      .insert(workflowTemplates)
      .values({
        organizationId: orgId,
        name: "test-dw-tmpl",
        category: "news",
        isBuiltin: true,
        isEnabled: true,
        legacyScenarioKey: "test_dw_legacy",
        defaultTeam: [],
        steps: [],
      })
      .returning();
    templateId = t.id;
  });

  afterAll(async () => {
    // Cleanup mission-related rows first (FK children), then mission, template, org.
    const orgMissions = await db
      .select({ id: missions.id })
      .from(missions)
      .where(eq(missions.organizationId, orgId));
    for (const m of orgMissions) {
      await db.delete(missionArtifacts).where(eq(missionArtifacts.missionId, m.id));
      await db.delete(missionMessages).where(eq(missionMessages.missionId, m.id));
      await db.delete(missionTasks).where(eq(missionTasks.missionId, m.id));
    }
    await db.delete(missions).where(eq(missions.organizationId, orgId));
    await db.delete(aiEmployees).where(eq(aiEmployees.organizationId, orgId));
    await db.delete(workflowTemplates).where(eq(workflowTemplates.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("writes workflowTemplateId when provided explicitly", async () => {
    const mission = await startMissionFromModule({
      organizationId: orgId,
      title: "test-explicit-id",
      scenario: "custom",
      userInstruction: "test",
      sourceModule: "test_dual_write",
      workflowTemplateId: templateId,
    });
    expect(mission.workflowTemplateId).toBe(templateId);
    expect(mission.scenario).toBe("custom"); // slug unchanged
  });

  it("auto-resolves workflowTemplateId from scenario legacy key", async () => {
    const mission = await startMissionFromModule({
      organizationId: orgId,
      title: "test-auto-resolve",
      scenario: "test_dw_legacy",
      userInstruction: "test",
      sourceModule: "test_dual_write",
    });
    expect(mission.workflowTemplateId).toBe(templateId);
    expect(mission.scenario).toBe("test_dw_legacy"); // slug preserved
  });

  it("leaves workflowTemplateId null when scenario has no template", async () => {
    const mission = await startMissionFromModule({
      organizationId: orgId,
      title: "test-custom-null",
      scenario: "some_custom_unmapped_key",
      userInstruction: "test",
      sourceModule: "test_dual_write",
    });
    expect(mission.workflowTemplateId).toBeNull();
    expect(mission.scenario).toBe("some_custom_unmapped_key"); // slug still written
  });
});
