import { describe, it, expect } from "vitest";
import {
  applyMissionEvent,
  emptyMissionProgress,
} from "../parse-mission-event";

describe("applyMissionEvent", () => {
  it("starts empty", () => {
    const s = emptyMissionProgress();
    expect(s.status).toBe("pending");
    expect(s.progress).toBe(0);
    expect(Object.keys(s.tasksById)).toHaveLength(0);
    expect(s.notFound).toBe(false);
  });

  it("accumulates task-update events into tasksById", () => {
    let s = emptyMissionProgress();
    s = applyMissionEvent(s, "task-update", JSON.stringify({
      taskId: "t1", title: "选题", status: "running",
    }));
    s = applyMissionEvent(s, "task-update", JSON.stringify({
      taskId: "t2", title: "写作", status: "pending",
    }));
    expect(Object.keys(s.tasksById)).toHaveLength(2);
    expect(s.tasksById.t1.status).toBe("running");
  });

  it("updates existing task on subsequent task-update", () => {
    let s = emptyMissionProgress();
    s = applyMissionEvent(s, "task-update", JSON.stringify({
      taskId: "t1", title: "选题", status: "running",
    }));
    s = applyMissionEvent(s, "task-update", JSON.stringify({
      taskId: "t1", title: "选题", status: "completed",
    }));
    expect(s.tasksById.t1.status).toBe("completed");
    expect(Object.keys(s.tasksById)).toHaveLength(1);
  });

  it("merges mission-progress event", () => {
    let s = emptyMissionProgress();
    s = applyMissionEvent(s, "mission-progress", JSON.stringify({
      status: "running", progress: 30,
    }));
    expect(s.status).toBe("running");
    expect(s.progress).toBe(30);
  });

  it("sets notFound on error event", () => {
    let s = emptyMissionProgress();
    s = applyMissionEvent(s, "error", JSON.stringify({
      message: "Mission not found",
    }));
    expect(s.notFound).toBe(true);
  });

  it("ignores malformed JSON", () => {
    const s = emptyMissionProgress();
    expect(applyMissionEvent(s, "task-update", "not-json")).toEqual(s);
  });

  it("ignores unknown event names", () => {
    const s = emptyMissionProgress();
    expect(applyMissionEvent(s, "unknown" as never, "{}")).toEqual(s);
  });
});
