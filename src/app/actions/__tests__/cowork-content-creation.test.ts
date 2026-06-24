import { describe, it, expect, vi, beforeEach } from "vitest";
const invokeMock = vi.hoisted(() => vi.fn());
const appendMessageMock = vi.hoisted(() => vi.fn());
const appendVersionMock = vi.hoisted(() => vi.fn());
const getConvoMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("@/lib/dal/auth", () => ({ getCurrentUserOrg: vi.fn(async () => "o1") }));
vi.mock("@/lib/agent/tool-registry", () => ({ invokeToolDirectly: invokeMock }));
vi.mock("@/lib/dal/cowork-conversations", () => ({ appendMessage: appendMessageMock, getConversationById: getConvoMock }));
vi.mock("@/lib/dal/article-versions", () => ({ appendArticleVersion: appendVersionMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { confirmCreationPlan } from "../cowork-content-creation";

const plan = { topic:{title:"热点A"}, topicOptions:[], topicFromHotlist:true, angle:"角度",
  genre:"news", channel:"wechat_mp", wordCount:1000, illustrate:false, hotlistAvailable:true } as never;

describe("confirmCreationPlan", () => {
  beforeEach(() => { invokeMock.mockReset(); appendMessageMock.mockReset(); appendVersionMock.mockReset();
    appendVersionMock.mockResolvedValue({ id: "v1" });
    getConvoMock.mockResolvedValue({ id: "cv1", projectId: null }); });

  it("写稿→落 draft 草稿→落 draft_result 消息带 articleId", async () => {
    invokeMock.mockImplementation(async (tool: string) =>
      tool === "content_generate" ? { ok:true, result:{ content:"标题\n\n正文", wordCount: 4 } }
      : { ok:true, result:{ firstArticleId:"art1", firstTitle:"标题" } }); // archive_to_drafts
    const res = await confirmCreationPlan("cv1", plan);
    expect(res.ok).toBe(true);
    // archive_to_drafts 必须用 initialStatus draft
    expect(invokeMock).toHaveBeenCalledWith("archive_to_drafts",
      expect.objectContaining({ initialStatus: "draft", organizationId: "o1" }), expect.anything());
    expect(appendMessageMock).toHaveBeenCalledWith("cv1", expect.objectContaining({
      kind: "draft_result", meta: expect.objectContaining({ articleId: "art1" }),
    }));
  });

  it("落库没拿到 articleId → 降级 draft_result（仍带正文，标记未入库）", async () => {
    invokeMock.mockImplementation(async (tool: string) =>
      tool === "content_generate" ? { ok:true, result:{ content:"标题\n\n正文", wordCount:4 } }
      : { ok:true, result:{ firstArticleId: null } });
    const res = await confirmCreationPlan("cv1", plan);
    expect(res.ok).toBe(true);
    expect(appendMessageMock).toHaveBeenCalledWith("cv1", expect.objectContaining({
      kind: "draft_result", meta: expect.objectContaining({ articleId: null, archived: false }),
    }));
  });
});
