import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirst, returning, returningUpd, values, insert, set, where, update } =
  vi.hoisted(() => {
    const returning = vi.fn();
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));
    const returningUpd = vi.fn();
    const where = vi.fn(() => ({ returning: returningUpd }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    return { findFirst: vi.fn(), returning, returningUpd, values, insert, set, where, update };
  });

vi.mock("@/db", () => ({
  db: { query: { channelSessions: { findFirst } }, insert, update },
}));

import { getOrCreateSession, resetSession, getSessionByActiveMissionId } from "../channel-sessions";

const key = {
  organizationId: "org1",
  configId: "cfg1",
  platform: "dingtalk" as const,
  chatId: "c1",
  externalUserId: "u1",
};

beforeEach(() => {
  findFirst.mockReset();
  returning.mockReset();
  returningUpd.mockReset();
  insert.mockClear();
  update.mockClear();
  where.mockReset();
  where.mockImplementation(() => ({ returning: returningUpd }));
  set.mockClear();
});

describe("getOrCreateSession", () => {
  it("已存在 → 直接返回", async () => {
    findFirst.mockResolvedValue({
      id: "s1",
      ...key,
      status: "idle",
      contextTurns: [],
      clarifyRounds: 0,
    });
    const s = await getOrCreateSession(key);
    expect(s.id).toBe("s1");
    expect(insert).not.toHaveBeenCalled();
  });

  it("不存在 → 插入新行", async () => {
    findFirst.mockResolvedValue(undefined);
    returning.mockResolvedValue([
      {
        id: "s2",
        ...key,
        status: "idle",
        contextTurns: [],
        clarifyRounds: 0,
      },
    ]);
    const s = await getOrCreateSession(key);
    expect(insert).toHaveBeenCalled();
    expect(s.id).toBe("s2");
  });

  it("已存在但已过期 → 重置为 idle 再返回", async () => {
    findFirst.mockResolvedValue({
      id: "s1",
      status: "running",
      clarifyRounds: 3,
      contextTurns: [],
      expiresAt: new Date(Date.now() - 1000),
    });
    returningUpd.mockResolvedValue([
      { id: "s1", status: "idle", clarifyRounds: 0, contextTurns: [], expiresAt: null },
    ]);
    const s = await getOrCreateSession(key);
    expect(update).toHaveBeenCalled();
    expect(s.status).toBe("idle");
    expect(s.clarifyRounds).toBe(0);
    expect(s.expiresAt).toBeNull();
  });
});

describe("resetSession", () => {
  it("按三元组键复位 idle + 清 activeMissionId", async () => {
    await resetSession({
      configId: "cfg1",
      chatId: "c1",
      externalUserId: "u1",
    });
    expect(update).toHaveBeenCalled();
    const patch = (set.mock.calls as unknown as [unknown[]][])[0][0];
    expect(patch).toMatchObject({
      status: "idle",
      activeMissionId: null,
      clarifyRounds: 0,
    });
  });
});

describe("getSessionByActiveMissionId", () => {
  it("按 activeMissionId 查到 → 返回 session", async () => {
    findFirst.mockResolvedValue({ id: "s1", activeMissionId: "m1", status: "running" });
    const s = await getSessionByActiveMissionId("m1");
    expect(s?.id).toBe("s1");
  });
  it("查不到 → 返回 null", async () => {
    findFirst.mockResolvedValue(undefined);
    const s = await getSessionByActiveMissionId("mx");
    expect(s).toBeNull();
  });
});
