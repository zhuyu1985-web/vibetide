import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  workflowArtifacts,
  missions,
  organizations,
  aiEmployees,
} from "@/db/schema";
import {
  insertWorkflowArtifact,
  listArtifactsByMission,
} from "../workflow-artifacts";
import { eq } from "drizzle-orm";

describe("DAL workflow-artifacts", () => {
  const orgId = randomUUID();
  const employeeId = randomUUID();
  const missionId = randomUUID();

  beforeAll(async () => {
    // workflow_artifacts.mission_id FK → missions.id (ON DELETE CASCADE)
    // missions.organization_id FK → organizations.id
    // missions.leader_employee_id FK → ai_employees.id
    const stamp = Date.now();
    await db
      .insert(organizations)
      .values({ id: orgId, name: "test-org-wa", slug: `test-wa-${stamp}` })
      .onConflictDoNothing();
    await db
      .insert(aiEmployees)
      .values({
        id: employeeId,
        organizationId: orgId,
        slug: `test-wa-leader-${stamp}`,
        name: "测试领队",
        nickname: "测试领队",
        title: "测试领队",
        roleType: "leader",
      })
      .onConflictDoNothing();
    await db
      .insert(missions)
      .values({
        id: missionId,
        organizationId: orgId,
        title: "wa test mission",
        scenario: "custom",
        userInstruction: "test",
        leaderEmployeeId: employeeId,
      })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await db
      .delete(workflowArtifacts)
      .where(eq(workflowArtifacts.missionId, missionId));
  });

  afterAll(async () => {
    await db
      .delete(workflowArtifacts)
      .where(eq(workflowArtifacts.missionId, missionId));
    await db.delete(missions).where(eq(missions.id, missionId));
    await db.delete(aiEmployees).where(eq(aiEmployees.id, employeeId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("insertWorkflowArtifact returns the created row", async () => {
    const row = await insertWorkflowArtifact({
      missionId,
      artifactType: "cms_publication",
      title: "CMS 入库：测试稿件",
      content: { cmsArticleId: "925194", previewUrl: "https://x/y" },
      producerEmployeeId: employeeId,
    });
    expect(row.id).toBeTruthy();
    expect(row.artifactType).toBe("cms_publication");
    expect(row.title).toContain("测试稿件");
  });

  it("supports all 9 existing artifactType values (smoke test)", async () => {
    const types = [
      "topic_brief",
      "angle_list",
      "material_pack",
      "article_draft",
      "video_plan",
      "review_report",
      "publish_plan",
      "analytics_report",
      "generic",
    ] as const;
    for (const t of types) {
      await insertWorkflowArtifact({
        missionId,
        artifactType: t,
        title: `t-${t}`,
        content: {},
      });
    }
    const list = await listArtifactsByMission(missionId);
    expect(list.length).toBeGreaterThanOrEqual(9);
  });

  it("listArtifactsByMission returns records newest-first", async () => {
    await insertWorkflowArtifact({
      missionId,
      artifactType: "cms_publication",
      title: "A",
      content: {},
    });
    await new Promise((r) => setTimeout(r, 10));
    await insertWorkflowArtifact({
      missionId,
      artifactType: "cms_publication",
      title: "B",
      content: {},
    });
    const list = await listArtifactsByMission(missionId);
    expect(list[0].title).toBe("B");
    expect(list[1].title).toBe("A");
  });
});
