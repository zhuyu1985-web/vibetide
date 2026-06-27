/**
 * Tests for surfaceCliOutput
 *
 * Mocks:
 * - @/db  (db.insert / db.select via drizzle-like fluent chain)
 * - @/lib/dal/cowork-conversations (appendMessage)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock state (must live in vi.hoisted so factory closures can read them) ──

const { insertValuesCalls, selectReturnQueue, appendMessageMock, dbMock } =
  vi.hoisted(() => {
    const insertValuesCalls: unknown[] = [];
    const selectReturnQueue: unknown[][] = [];

    function makeInsertChain() {
      return {
        values: vi.fn().mockImplementation((v: unknown) => {
          insertValuesCalls.push(v);
          return Promise.resolve([]);
        }),
      };
    }

    function makeSelectChain(rows: unknown[]) {
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(rows),
          }),
        }),
      };
    }

    const dbMock = {
      insert: vi.fn().mockReturnValue(makeInsertChain()),
      select: vi.fn().mockImplementation(() => {
        const rows = selectReturnQueue.shift() ?? [];
        return makeSelectChain(rows);
      }),
    };

    const appendMessageMock = vi.fn().mockResolvedValue({});

    return { insertValuesCalls, selectReturnQueue, appendMessageMock, dbMock };
  });

// ── Module mocks (factories can now safely close over hoisted vars) ───────────

vi.mock("@/db", () => ({ db: dbMock }));

vi.mock("@/db/schema", () => ({
  missionArtifacts: Symbol("missionArtifacts"),
  missionTasks: Symbol("missionTasks"),
  missions: Symbol("missions"),
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn((col, val) => ({ col, val })) }));

vi.mock("@/lib/dal/cowork-conversations", () => ({
  appendMessage: appendMessageMock,
}));

// ── Import SUT after mocks ────────────────────────────────────────────────────

import { surfaceCliOutput } from "../surface";

// ── Test constants ────────────────────────────────────────────────────────────

const OUTPUT = {
  assetId: "asset-1",
  publicUrl: "https://cdn.example.com/video.mp4",
  assetType: "video",
  title: "测试视频",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetMocks() {
  insertValuesCalls.length = 0;
  selectReturnQueue.length = 0;
  appendMessageMock.mockClear();
  dbMock.insert.mockClear();
  dbMock.select.mockClear();

  // Re-wire insert chain (mockClear removes the return value)
  dbMock.insert.mockReturnValue({
    values: vi.fn().mockImplementation((v: unknown) => {
      insertValuesCalls.push(v);
      return Promise.resolve([]);
    }),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("surfaceCliOutput", () => {
  beforeEach(resetMocks);

  it("neither missionId nor conversationId → no-op", async () => {
    await surfaceCliOutput(
      { organizationId: "org-1", cliToolName: "test-tool" },
      OUTPUT,
    );

    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(appendMessageMock).not.toHaveBeenCalled();
  });

  it("missionId only → inserts mission_artifacts with fileUrl; no appendMessage", async () => {
    // resolveProducedBy: no taskId → query missions → leaderEmployeeId
    selectReturnQueue.push([{ leaderEmployeeId: "emp-leader-1" }]);

    await surfaceCliOutput(
      {
        organizationId: "org-1",
        missionId: "mission-1",
        cliToolName: "my-cli",
      },
      OUTPUT,
    );

    expect(appendMessageMock).not.toHaveBeenCalled();
    expect(dbMock.insert).toHaveBeenCalledTimes(1);

    const row = insertValuesCalls[0] as Record<string, unknown>;
    expect(row.missionId).toBe("mission-1");
    expect(row.fileUrl).toBe(OUTPUT.publicUrl);
    expect(row.type).toBe(OUTPUT.assetType);
    expect(row.title).toBe(OUTPUT.title);
    expect(row.producedBy).toBe("emp-leader-1");
    const meta = row.metadata as Record<string, unknown>;
    expect(meta.assetId).toBe(OUTPUT.assetId);
    expect(meta.source).toBe("cli");
    expect(meta.cliToolName).toBe("my-cli");
  });

  it("missionId + taskId → uses task assignedEmployeeId as producedBy", async () => {
    // resolveProducedBy: taskId present → query missionTasks first, returns assignedEmployeeId
    selectReturnQueue.push([{ assignedEmployeeId: "emp-task-1" }]);

    await surfaceCliOutput(
      {
        organizationId: "org-1",
        missionId: "mission-2",
        taskId: "task-2",
        cliToolName: "cli-x",
      },
      OUTPUT,
    );

    const row = insertValuesCalls[0] as Record<string, unknown>;
    expect(row.taskId).toBe("task-2");
    expect(row.producedBy).toBe("emp-task-1");
  });

  it("conversationId only → calls appendMessage with import_card + fileUrl in meta; no DB insert", async () => {
    await surfaceCliOutput(
      {
        organizationId: "org-1",
        conversationId: "conv-1",
        cliToolName: "gen-video",
      },
      OUTPUT,
    );

    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(appendMessageMock).toHaveBeenCalledTimes(1);

    const [convId, msg] = appendMessageMock.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(convId).toBe("conv-1");
    expect(msg.role).toBe("assistant");
    expect(msg.kind).toBe("import_card");
    expect(typeof msg.content).toBe("string");
    const meta = msg.meta as Record<string, unknown>;
    expect(meta.fileUrl).toBe(OUTPUT.publicUrl);
    expect(meta.assetId).toBe(OUTPUT.assetId);
    expect(meta.assetType).toBe(OUTPUT.assetType);
  });

  it("both missionId and conversationId → inserts artifact AND calls appendMessage", async () => {
    selectReturnQueue.push([{ leaderEmployeeId: "emp-leader-2" }]);

    await surfaceCliOutput(
      {
        organizationId: "org-1",
        missionId: "mission-3",
        conversationId: "conv-3",
        cliToolName: "combo-tool",
      },
      OUTPUT,
    );

    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    expect(appendMessageMock).toHaveBeenCalledTimes(1);

    const row = insertValuesCalls[0] as Record<string, unknown>;
    expect(row.fileUrl).toBe(OUTPUT.publicUrl);

    const [, msg] = appendMessageMock.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(msg.kind).toBe("import_card");
    expect((msg.meta as Record<string, unknown>).fileUrl).toBe(OUTPUT.publicUrl);
  });
});
