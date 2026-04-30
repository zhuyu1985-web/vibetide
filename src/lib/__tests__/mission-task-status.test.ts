import { describe, it, expect } from "vitest";
import { mapTaskStatusToUiState, type UiTaskState } from "@/lib/mission-task-status";

describe("mapTaskStatusToUiState", () => {
  const cases: Array<[string, UiTaskState]> = [
    ["pending", "pending"],
    ["ready", "pending"],
    ["claimed", "pending"],
    ["blocked", "pending"],
    ["in_progress", "running"],
    ["in_review", "running"],
    ["completed", "completed"],
    ["failed", "failed"],
    ["cancelled", "cancelled"],
  ];

  for (const [db, ui] of cases) {
    it(`maps ${db} → ${ui}`, () => {
      expect(mapTaskStatusToUiState(db as never)).toBe(ui);
    });
  }

  it("falls back to pending on unknown", () => {
    expect(mapTaskStatusToUiState("garbage" as never)).toBe("pending");
  });
});
