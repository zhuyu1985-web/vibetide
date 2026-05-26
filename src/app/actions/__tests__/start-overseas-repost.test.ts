import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/current-user", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "u1" }),
}));

const findFirstUserProfile = vi.hoisted(() => vi.fn());
const findFirstHotTopic = vi.hoisted(() => vi.fn());
const findFirstMission = vi.hoisted(() => vi.fn());
const findFirstTemplate = vi.hoisted(() => vi.fn());
const startMissionFromTemplateMock = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({
  db: {
    query: {
      userProfiles: { findFirst: findFirstUserProfile },
      hotTopics: { findFirst: findFirstHotTopic },
      missions: { findFirst: findFirstMission },
      workflowTemplates: { findFirst: findFirstTemplate },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ catch: vi.fn() })),
      })),
    })),
  },
}));
vi.mock("@/db/schema/missions", () => ({ missions: {} as never }));
vi.mock("@/db/schema/hot-topics", () => ({ hotTopics: {} as never }));
vi.mock("@/db/schema/user-profiles", () => ({ userProfiles: {} as never }));
vi.mock("@/db/schema/workflow-templates", () => ({ workflowTemplates: {} as never }));
vi.mock("@/app/actions/workflow-launch", () => ({ startMissionFromTemplate: startMissionFromTemplateMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { startOverseasRepost } from "../hot-topics";

beforeEach(() => {
  findFirstUserProfile.mockReset();
  findFirstHotTopic.mockReset();
  findFirstMission.mockReset();
  findFirstTemplate.mockReset();
  startMissionFromTemplateMock.mockReset();
  findFirstUserProfile.mockResolvedValue({ id: "u1", organizationId: "org1" });
});

describe("startOverseasRepost", () => {
  it("正常路径：拉 topic + 调 startMissionFromTemplate 时把 source + titleOverride 塞 options", async () => {
    findFirstHotTopic.mockResolvedValue({
      id: "topic1", title: "T", summary: "S", sourceUrl: "https://weibo.com/x",
    });
    findFirstMission.mockResolvedValue(null);
    findFirstTemplate.mockResolvedValue({ id: "tpl1" });
    startMissionFromTemplateMock.mockResolvedValue({ ok: true, missionId: "m1" });

    const res = await startOverseasRepost("topic1");

    expect(res.id).toBe("m1");
    expect(startMissionFromTemplateMock).toHaveBeenCalledWith(
      "tpl1",
      expect.objectContaining({
        source_topic_id: "topic1",
        source_title: "T",
        source_url: "https://weibo.com/x",
      }),
      {
        source: {
          module: "hot_topics_overseas",
          entityId: "topic1",
          entityType: "hot_topic",
        },
        titleOverride: "海外转发：T",
      },
    );
  });

  it("同 topic 已有 mission 复用", async () => {
    findFirstHotTopic.mockResolvedValue({ id: "topic1", title: "T", sourceUrl: "" });
    findFirstMission.mockResolvedValue({ id: "existing-m" });
    const res = await startOverseasRepost("topic1");
    expect(res.id).toBe("existing-m");
    expect(startMissionFromTemplateMock).not.toHaveBeenCalled();
  });

  it("模板未 seed 抛错", async () => {
    findFirstHotTopic.mockResolvedValue({ id: "topic1", title: "T" });
    findFirstMission.mockResolvedValue(null);
    findFirstTemplate.mockResolvedValue(null);
    await expect(startOverseasRepost("topic1")).rejects.toThrow(/模板未 seed/);
  });

  it("并发双击同一 topic 拿到同一个 mission.id (race fix)", async () => {
    findFirstHotTopic.mockResolvedValue({
      id: "topic1", title: "T", summary: "S", sourceUrl: "",
    });
    // 两次 dedup 查询都返回 null —— 这就是 race window：两个调用都通过 app 层 dedup
    findFirstMission.mockResolvedValue(null);
    findFirstTemplate.mockResolvedValue({ id: "tpl1" });
    // startMissionFromTemplate 内部 unique 索引拦截 + 复用 winner mission id；
    // 这里 mock 两次都返回同一个 id 模拟该最终效果。
    startMissionFromTemplateMock.mockResolvedValue({ ok: true, missionId: "winner-m" });

    const [a, b] = await Promise.all([
      startOverseasRepost("topic1"),
      startOverseasRepost("topic1"),
    ]);

    expect(a.id).toBe("winner-m");
    expect(b.id).toBe("winner-m");
    expect(a.id).toBe(b.id);
  });
});
