import { describe, it, expect } from "vitest";
import {
  computeExpiredResetPatch,
  CONTENT_LOOP_TTL_MS,
} from "../channel-sessions";

const NOW = 1_800_000_000_000; // 固定时间，避免依赖真实时钟

describe("computeExpiredResetPatch", () => {
  it("未过期 → 返回 null（不动会话）", () => {
    expect(
      computeExpiredResetPatch(
        { expiresAt: new Date(NOW + 60_000), scenarioPhase: "idle" },
        NOW,
      ),
    ).toBeNull();
  });

  it("无 expiresAt → 返回 null", () => {
    expect(
      computeExpiredResetPatch({ expiresAt: null, scenarioPhase: "idle" }, NOW),
    ).toBeNull();
  });

  it("普通会话过期 → 全清回干净 idle（清 lastArticleId、expiresAt=null）", () => {
    const patch = computeExpiredResetPatch(
      { expiresAt: new Date(NOW - 1), scenarioPhase: "idle" },
      NOW,
    );
    expect(patch).not.toBeNull();
    expect(patch!.status).toBe("idle");
    expect(patch).toHaveProperty("lastArticleId", null);
    expect(patch!.expiresAt).toBeNull();
  });

  it("闭环会话过期 → 保留 lastArticleId/loopContext/scenarioPhase/activeTopicId，续长 TTL", () => {
    const patch = computeExpiredResetPatch(
      { expiresAt: new Date(NOW - 1), scenarioPhase: "drafting" },
      NOW,
    );
    expect(patch).not.toBeNull();
    // 关键：patch 不含这些 key → 不被覆盖，闭环产出/上下文保留
    expect(patch).not.toHaveProperty("lastArticleId");
    expect(patch).not.toHaveProperty("loopContext");
    expect(patch).not.toHaveProperty("scenarioPhase");
    expect(patch).not.toHaveProperty("activeTopicId");
    // 瞬时 ad-hoc 字段仍清
    expect(patch!.status).toBe("idle");
    expect(patch!.pendingPlan).toBeNull();
    // 续 7 天窗口
    expect((patch!.expiresAt as Date).getTime()).toBe(NOW + CONTENT_LOOP_TTL_MS);
  });
});
