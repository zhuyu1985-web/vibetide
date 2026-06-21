import { describe, it, expect, vi, beforeEach } from "vitest";

const { returningUpd, where, set, update } = vi.hoisted(() => {
  const returningUpd = vi.fn();
  const where = vi.fn(() => ({ returning: returningUpd }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { returningUpd, where, set, update };
});

vi.mock("@/db", () => ({ db: { update } }));

import { cancelChannelMission } from "../cancel-channel-mission";

beforeEach(() => {
  returningUpd.mockReset();
  set.mockClear();
  update.mockClear();
});

describe("cancelChannelMission", () => {
  it("在途 mission → 改 1 行，标 cancelled，返回 true", async () => {
    returningUpd.mockResolvedValue([{ id: "m1" }]);
    const ok = await cancelChannelMission("m1", "org1");
    expect(ok).toBe(true);
    expect(update).toHaveBeenCalled();
    const patch = (set.mock.calls as unknown as [unknown[]][])[0][0];
    expect(patch).toMatchObject({ status: "cancelled" });
  });

  it("已终态 mission（终态守卫 0 行）→ 返回 false", async () => {
    returningUpd.mockResolvedValue([]);
    const ok = await cancelChannelMission("m1", "org1");
    expect(ok).toBe(false);
  });
});
