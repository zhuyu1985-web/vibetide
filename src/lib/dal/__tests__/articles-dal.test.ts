import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mock chain: select().from().where().orderBy().limit()
const { limitFn, orderByFn, whereFn, fromFn, selectFn } = vi.hoisted(() => {
  const limitFn = vi.fn();
  const orderByFn = vi.fn(() => ({ limit: limitFn }));
  const whereFn = vi.fn(() => ({ orderBy: orderByFn }));
  const fromFn = vi.fn(() => ({ where: whereFn }));
  const selectFn = vi.fn(() => ({ from: fromFn }));
  return { limitFn, orderByFn, whereFn, fromFn, selectFn };
});

vi.mock("@/db", () => ({
  db: { select: selectFn },
}));

import { getLatestArticleByMission } from "../articles";

beforeEach(() => {
  selectFn.mockClear();
  fromFn.mockClear();
  whereFn.mockClear();
  orderByFn.mockClear();
  limitFn.mockReset();
});

describe("getLatestArticleByMission", () => {
  it("有匹配行 → 返回 {id, title, status}", async () => {
    limitFn.mockResolvedValue([
      { id: "art1", title: "AI 稿", status: "draft" },
    ]);
    const result = await getLatestArticleByMission("mission1", "org1");
    expect(result).toEqual({ id: "art1", title: "AI 稿", status: "draft" });
    expect(selectFn).toHaveBeenCalled();
  });

  it("无匹配行 → 返回 null", async () => {
    limitFn.mockResolvedValue([]);
    const result = await getLatestArticleByMission("missionX", "org1");
    expect(result).toBeNull();
  });
});
