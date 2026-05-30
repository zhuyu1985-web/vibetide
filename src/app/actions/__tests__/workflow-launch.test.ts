import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock chain ─────────────────────────────────────────────────────────
// Use vi.hoisted so refs are available before vi.mock factories execute.

const insertCalls = vi.hoisted(
  () => [] as Array<{ table: unknown; values: Record<string, unknown> }>,
);
const insertReturningQueue = vi.hoisted(
  () => [] as Array<() => Promise<unknown>>,
);
const updateSetCalls = vi.hoisted(
  () => [] as Array<{ table: unknown; values: Record<string, unknown> }>,
);
const findFirstMissionMock = vi.hoisted(() => vi.fn());
const findFirstTemplateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "u1" }),
}));
vi.mock("@/lib/dal/auth", () => ({
  getCurrentUserOrg: vi.fn().mockResolvedValue("org1"),
}));
vi.mock("@/lib/input-fields-validation", () => ({
  validateInputs: vi.fn(
    (_fields: unknown, inputs: Record<string, unknown>) => ({
      ok: true,
      errors: {},
      cleaned: inputs,
    }),
  ),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/mission-executor", () => ({
  executeMissionDirect: vi.fn(async () => undefined),
}));
vi.mock("@/app/actions/missions", () => ({
  getOrProvisionLeader: vi.fn().mockResolvedValue({ id: "leader-emp-id" }),
}));
vi.mock("@/db/schema/missions", () => ({ missions: {} as never }));
vi.mock("@/db/schema/workflows", () => ({ workflowTemplates: {} as never }));
vi.mock("@/db/schema/ai-employees", () => ({ aiEmployees: {} as never }));

vi.mock("@/db", () => ({
  db: {
    query: {
      workflowTemplates: { findFirst: findFirstTemplateMock },
      missions: { findFirst: findFirstMissionMock },
    },
    insert: vi.fn((table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        insertCalls.push({ table, values });
        return {
          returning: () => {
            const next = insertReturningQueue.shift();
            if (!next) {
              throw new Error(
                "Unexpected db.insert(...).values(...).returning() call — queue empty",
              );
            }
            return next();
          },
        };
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        updateSetCalls.push({ table, values });
        // Return a Thenable that also exposes .catch — supports both
        // `await db.update().set().where()` and `.where().catch(...)` patterns.
        return { where: vi.fn(() => Promise.resolve()) };
      },
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
  },
}));

import {
  startMissionFromTemplate,
  startMissionFromTemplateScheduled,
} from "../workflow-launch";
import { requireAuth } from "@/lib/auth/current-user";
import { getCurrentUserOrg } from "@/lib/dal/auth";

beforeEach(() => {
  insertCalls.length = 0;
  insertReturningQueue.length = 0;
  updateSetCalls.length = 0;
  findFirstMissionMock.mockReset();
  findFirstTemplateMock.mockReset();
  findFirstTemplateMock.mockResolvedValue({
    id: "tpl1",
    name: "测试模板",
    inputFields: [],
    defaultTeam: [],
    promptTemplate: null,
  });
});

function uniqueViolation(): Error & { code: string } {
  return Object.assign(new Error("duplicate key value violates unique constraint"), {
    code: "23505",
    constraint_name: "missions_source_dedup_uidx",
  });
}

describe("startMissionFromTemplate — source link & race handling", () => {
  it("writes sourceModule / sourceEntityId / sourceEntityType / title on initial INSERT", async () => {
    insertReturningQueue.push(() => Promise.resolve([{ id: "m1" }]));

    const res = await startMissionFromTemplate(
      "tpl1",
      { foo: "bar" },
      {
        source: {
          module: "hot_topics_overseas",
          entityId: "topic-1",
          entityType: "hot_topic",
        },
        titleOverride: "海外转发：测试新闻",
      },
    );

    expect(res).toEqual({ ok: true, missionId: "m1" });
    expect(insertCalls.length).toBeGreaterThanOrEqual(1);
    const missionInsert = insertCalls[0].values;
    expect(missionInsert.sourceModule).toBe("hot_topics_overseas");
    expect(missionInsert.sourceEntityId).toBe("topic-1");
    expect(missionInsert.sourceEntityType).toBe("hot_topic");
    expect(missionInsert.title).toBe("海外转发：测试新闻");
  });

  it("returns existing mission id when INSERT hits unique violation (concurrent race)", async () => {
    insertReturningQueue.push(() => Promise.reject(uniqueViolation()));
    findFirstMissionMock.mockResolvedValueOnce({
      id: "winner-mission",
      status: "queued",
    });

    const res = await startMissionFromTemplate(
      "tpl1",
      { foo: "bar" },
      {
        source: {
          module: "hot_topics_overseas",
          entityId: "topic-1",
          entityType: "hot_topic",
        },
      },
    );

    expect(res).toEqual({ ok: true, missionId: "winner-mission" });
    expect(findFirstMissionMock).toHaveBeenCalled();
    // Only one INSERT attempt — not a retry, just return existing.
    expect(insertCalls.length).toBe(1);
  });

  it("clears stale source link and retries INSERT when existing mission is failed (retry-after-failure)", async () => {
    insertReturningQueue.push(() => Promise.reject(uniqueViolation()));
    insertReturningQueue.push(() => Promise.resolve([{ id: "new-mission" }]));
    findFirstMissionMock.mockResolvedValueOnce({
      id: "old-failed-mission",
      status: "failed",
    });

    const res = await startMissionFromTemplate(
      "tpl1",
      { foo: "bar" },
      {
        source: {
          module: "hot_topics_overseas",
          entityId: "topic-1",
          entityType: "hot_topic",
        },
      },
    );

    expect(res).toEqual({ ok: true, missionId: "new-mission" });
    expect(insertCalls.length).toBe(2); // first INSERT failed, second retried
    const clearUpdate = updateSetCalls.find(
      (u) =>
        u.values.sourceModule === null &&
        u.values.sourceEntityId === null &&
        u.values.sourceEntityType === null,
    );
    expect(clearUpdate, "should clear stale source link before retry").toBeDefined();
  });

  it("falls back to template.name when titleOverride is omitted", async () => {
    insertReturningQueue.push(() => Promise.resolve([{ id: "m2" }]));

    await startMissionFromTemplate(
      "tpl1",
      { foo: "bar" },
      {
        source: {
          module: "hot_topics",
          entityId: "topic-2",
          entityType: "hot_topic",
        },
      },
    );

    expect(insertCalls[0].values.title).toBe("测试模板");
  });

  it("propagates non-unique-violation DB errors without querying for existing mission", async () => {
    const otherErr = Object.assign(new Error("syntax error"), { code: "42601" });
    insertReturningQueue.push(() => Promise.reject(otherErr));

    await expect(
      startMissionFromTemplate(
        "tpl1",
        { foo: "bar" },
        {
          source: {
            module: "hot_topics",
            entityId: "topic-1",
            entityType: "hot_topic",
          },
        },
      ),
    ).rejects.toMatchObject({ code: "42601" });

    expect(findFirstMissionMock).not.toHaveBeenCalled();
  });

  it("works without options.source (no race handling, no source link)", async () => {
    insertReturningQueue.push(() => Promise.resolve([{ id: "m3" }]));

    const res = await startMissionFromTemplate("tpl1", { foo: "bar" });

    expect(res).toEqual({ ok: true, missionId: "m3" });
    expect(insertCalls[0].values.sourceModule).toBeUndefined();
    expect(insertCalls[0].values.sourceEntityId).toBeUndefined();
  });

  it("propagates unique-violation when options.source is absent (impossible-but-defensive)", async () => {
    insertReturningQueue.push(() => Promise.reject(uniqueViolation()));

    await expect(
      startMissionFromTemplate("tpl1", { foo: "bar" }),
    ).rejects.toMatchObject({ code: "23505" });

    expect(findFirstMissionMock).not.toHaveBeenCalled();
  });

  it("parallel callers with the same source both resolve to the winner's mission id", async () => {
    // First INSERT wins, second hits unique violation and reuses winner's id.
    insertReturningQueue.push(() => Promise.resolve([{ id: "winner-id" }]));
    insertReturningQueue.push(() => Promise.reject(uniqueViolation()));
    // The loser's findFirst lookup sees the winner row already committed.
    findFirstMissionMock.mockResolvedValue({ id: "winner-id", status: "queued" });

    const sourceArg = {
      source: {
        module: "hot_topics_overseas",
        entityId: "topic-1",
        entityType: "hot_topic",
      },
    };
    const [a, b] = await Promise.all([
      startMissionFromTemplate("tpl1", { foo: "bar" }, sourceArg),
      startMissionFromTemplate("tpl1", { foo: "bar" }, sourceArg),
    ]);

    expect(a).toEqual({ ok: true, missionId: "winner-id" });
    expect(b).toEqual({ ok: true, missionId: "winner-id" });
    expect(insertCalls.length).toBe(2); // both tried to INSERT; one was rejected
  });
});

describe("startMissionFromTemplateScheduled — scheduled launch path", () => {
  it("does NOT call requireAuth or getCurrentUserOrg (service entry, no session)", async () => {
    insertReturningQueue.push(() => Promise.resolve([{ id: "sched-m1" }]));

    vi.mocked(requireAuth).mockClear();
    vi.mocked(getCurrentUserOrg).mockClear();

    const res = await startMissionFromTemplateScheduled(
      "tpl1",
      "org-explicit",
      { foo: "bar" },
      {
        source: {
          module: "schedule",
          entityId: "scheduled-job-1",
          entityType: "scheduled_job",
        },
      },
    );

    expect(res).toEqual({ ok: true, missionId: "sched-m1" });
    expect(requireAuth).not.toHaveBeenCalled();
    expect(getCurrentUserOrg).not.toHaveBeenCalled();
  });

  it("uses the explicit orgId argument and writes schedule-kind source link", async () => {
    insertReturningQueue.push(() => Promise.resolve([{ id: "sched-m2" }]));

    await startMissionFromTemplateScheduled(
      "tpl1",
      "org-A",
      { foo: "bar" },
      {
        source: {
          module: "schedule",
          entityId: "job-xyz",
          entityType: "scheduled_job",
        },
      },
    );

    const inserted = insertCalls[0].values;
    expect(inserted.organizationId).toBe("org-A");
    expect(inserted.sourceModule).toBe("schedule");
    expect(inserted.sourceEntityId).toBe("job-xyz");
    expect(inserted.sourceEntityType).toBe("scheduled_job");
  });

  it("reuses race winner when the same scheduled-job tries to insert twice", async () => {
    insertReturningQueue.push(() => Promise.reject(uniqueViolation()));
    findFirstMissionMock.mockResolvedValueOnce({
      id: "winner-sched-mission",
      status: "queued",
    });

    const res = await startMissionFromTemplateScheduled(
      "tpl1",
      "org-A",
      { foo: "bar" },
      {
        source: {
          module: "schedule",
          entityId: "job-xyz",
          entityType: "scheduled_job",
        },
      },
    );

    expect(res).toEqual({ ok: true, missionId: "winner-sched-mission" });
    expect(insertCalls.length).toBe(1);
  });

  it("returns _global error when template is not in the given org", async () => {
    findFirstTemplateMock.mockResolvedValueOnce(null);

    const res = await startMissionFromTemplateScheduled(
      "tpl-foreign",
      "org-A",
      { foo: "bar" },
    );

    expect(res).toEqual({
      ok: false,
      errors: { _global: "模板不存在或无权访问" },
    });
    expect(insertCalls.length).toBe(0);
  });
});
