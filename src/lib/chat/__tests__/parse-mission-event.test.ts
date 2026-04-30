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
      taskId: "t1", title: "选题", status: "in_progress",
    }));
    s = applyMissionEvent(s, "task-update", JSON.stringify({
      taskId: "t2", title: "写作", status: "pending",
    }));
    expect(Object.keys(s.tasksById)).toHaveLength(2);
    expect(s.tasksById.t1.status).toBe("in_progress");
  });

  it("updates existing task on subsequent task-update", () => {
    let s = emptyMissionProgress();
    s = applyMissionEvent(s, "task-update", JSON.stringify({
      taskId: "t1", title: "选题", status: "in_progress",
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

describe("applyMissionEvent · mission-init", () => {
  it("stores init payload on first emission", () => {
    let s = emptyMissionProgress();
    s = applyMissionEvent(s, "mission-init", JSON.stringify({
      templateId: "tpl-1",
      templateName: "深度新闻调研",
      steps: [
        { phase: 1, name: "全网线索扫描", skillName: "热点扫描" },
        { phase: 2, name: "深度信息采集", skillName: "网页深读" },
      ],
    }));
    expect(s.init).not.toBeNull();
    expect(s.init?.templateName).toBe("深度新闻调研");
    expect(s.init?.steps).toHaveLength(2);
    expect(s.init?.steps[0].skillName).toBe("热点扫描");
  });

  it("ignores malformed init payload", () => {
    let s = emptyMissionProgress();
    s = applyMissionEvent(s, "mission-init", "{not json");
    expect(s.init).toBeNull();
  });
});

describe("applyMissionEvent · task-update extended fields", () => {
  it("captures outputSummary on completion", () => {
    let s = emptyMissionProgress();
    s = applyMissionEvent(s, "task-update", JSON.stringify({
      taskId: "t1", title: "选题", status: "completed",
      outputSummary: "已识别 3 条主线索",
      phase: 1,
    }));
    expect(s.tasksById.t1.outputSummary).toBe("已识别 3 条主线索");
    expect(s.tasksById.t1.phase).toBe(1);
  });

  it("captures error fields on failure", () => {
    let s = emptyMissionProgress();
    s = applyMissionEvent(s, "task-update", JSON.stringify({
      taskId: "t1", title: "核验", status: "failed",
      errorMessage: "知网 API 403",
      errorRecoverable: true,
      retryCount: 1,
    }));
    expect(s.tasksById.t1.errorMessage).toBe("知网 API 403");
    expect(s.tasksById.t1.errorRecoverable).toBe(true);
    expect(s.tasksById.t1.retryCount).toBe(1);
  });
});
