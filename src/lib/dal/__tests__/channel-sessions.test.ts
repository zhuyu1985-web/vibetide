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

// 包一层 spy 记录 eq(col, val) 调用，仍委派给真实 eq 让 and() 正常构造 where
const { eqSpy } = vi.hoisted(() => ({ eqSpy: vi.fn() }));
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown) => {
      eqSpy(col, val);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actual.eq as any)(col, val);
    },
  };
});

import { channelSessions } from "@/db/schema/channel-sessions";
import {
  getOrCreateSession,
  resetSession,
  getSessionByActiveMissionId,
  recordSessionResult,
  setSessionLastArticleId,
} from "../channel-sessions";

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

describe("recordSessionResult", () => {
  it("写 contextTurns(上次请求+已完成摘要) + idle + 跟进窗口", async () => {
    await recordSessionResult(
      { configId: "cfg1", chatId: "c1", externalUserId: "u1" },
      { instruction: "写AI稿", resultSummary: "完成了AI稿" },
    );
    expect(update).toHaveBeenCalled();
    const patch = (set.mock.calls as unknown as unknown[][])[0][0] as {
      status: string;
      activeMissionId: null;
      pendingPlan: null;
      contextTurns: { role: string; content: string }[];
      expiresAt: Date;
    };
    expect(patch).toMatchObject({ status: "idle", activeMissionId: null, pendingPlan: null });
    expect(patch.contextTurns).toEqual([
      { role: "user", content: "写AI稿" },
      { role: "assistant", content: "已完成：完成了AI稿" },
    ]);
    expect(patch.expiresAt).toBeInstanceOf(Date);
  });

  it("带 articleId → patch 含 lastArticleId", async () => {
    set.mockClear();
    await recordSessionResult(
      { configId: "cfg1", chatId: "c1", externalUserId: "u1" },
      { instruction: "写AI稿", resultSummary: "完成了AI稿", articleId: "art1" },
    );
    const patch = (set.mock.calls as unknown as unknown[][])[0][0] as Record<string, unknown>;
    expect(patch.lastArticleId).toBe("art1");
  });

  it("不传 articleId → patch 含 lastArticleId: null（旧调用兼容）", async () => {
    set.mockClear();
    await recordSessionResult(
      { configId: "cfg1", chatId: "c1", externalUserId: "u1" },
      { instruction: "写AI稿", resultSummary: "完成了AI稿" },
    );
    const patch = (set.mock.calls as unknown as unknown[][])[0][0] as Record<string, unknown>;
    expect(patch.lastArticleId).toBeNull();
  });
});

describe("resetSession", () => {
  it("patch 含 lastArticleId: null, pendingPublish: null", async () => {
    set.mockClear();
    await resetSession({ configId: "cfg1", chatId: "c1", externalUserId: "u1" });
    const patch = (set.mock.calls as unknown as unknown[][])[0][0] as Record<string, unknown>;
    expect(patch.lastArticleId).toBeNull();
    expect(patch.pendingPublish).toBeNull();
  });
});

describe("setSessionLastArticleId", () => {
  it("写 lastArticleId + 刷新跟进窗口，不动 status/contextTurns", async () => {
    set.mockClear();
    await setSessionLastArticleId({ configId: "cfg1", chatId: "c1", externalUserId: "u1" }, "a1");
    expect(update).toHaveBeenCalled();
    const patch = (set.mock.calls as unknown as unknown[][])[0][0] as Record<string, unknown>;
    expect(patch.lastArticleId).toBe("a1");
    expect(patch.expiresAt).toBeInstanceOf(Date);
    // 不应覆盖进行中会话的状态字段
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("contextTurns");
    expect(patch).not.toHaveProperty("activeMissionId");
  });

  it("守卫：where 含 status='idle'（进行中会话下变 no-op，不污染 expiresAt）", async () => {
    eqSpy.mockClear();
    await setSessionLastArticleId({ configId: "cfg1", chatId: "c1", externalUserId: "u1" }, "a1");
    expect(eqSpy).toHaveBeenCalledWith(channelSessions.status, "idle");
  });
});
