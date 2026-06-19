import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirst, returning, values, insert, set, where, update } =
  vi.hoisted(() => {
    const returning = vi.fn();
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));
    const where = vi.fn();
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    return { findFirst: vi.fn(), returning, values, insert, set, where, update };
  });

vi.mock("@/db", () => ({
  db: { query: { channelSessions: { findFirst } }, insert, update },
}));

import { getOrCreateSession, resetSession } from "../channel-sessions";

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
  insert.mockClear();
  update.mockClear();
  where.mockReset();
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
});

describe("resetSession", () => {
  it("按三元组键复位 idle + 清 activeMissionId", async () => {
    where.mockResolvedValue(undefined);
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
