import { describe, it, expect } from "vitest";
import {
  missionDrawerReducer,
  type MissionDrawerState,
} from "@/lib/cowork/mission-drawer-state";

const closed: MissionDrawerState = { missionId: null, open: false };

describe("missionDrawerReducer", () => {
  it("focus 打开并锁定 mission", () => {
    const s = missionDrawerReducer(closed, { type: "focus", missionId: "m1" });
    expect(s).toEqual({ missionId: "m1", open: true });
  });

  it("close 收起但保留 missionId", () => {
    const open = { missionId: "m1", open: true };
    const s = missionDrawerReducer(open, { type: "close" });
    expect(s).toEqual({ missionId: "m1", open: false });
  });

  it("open 需已有 mission 才生效", () => {
    expect(missionDrawerReducer(closed, { type: "open" })).toBe(closed);
    const s = missionDrawerReducer({ missionId: "m1", open: false }, { type: "open" });
    expect(s).toEqual({ missionId: "m1", open: true });
  });

  it("focus 切换到新 mission", () => {
    const s = missionDrawerReducer(
      { missionId: "m1", open: true },
      { type: "focus", missionId: "m2" },
    );
    expect(s).toEqual({ missionId: "m2", open: true });
  });

  it("pending 乐观打开(无 missionId,供 loading 态)", () => {
    const s = missionDrawerReducer(closed, { type: "pending" });
    expect(s).toEqual({ missionId: null, open: true });
  });

  it("pending 后 focus 加载真实 mission", () => {
    const p = missionDrawerReducer(closed, { type: "pending" });
    const s = missionDrawerReducer(p, { type: "focus", missionId: "m1" });
    expect(s).toEqual({ missionId: "m1", open: true });
  });
});
