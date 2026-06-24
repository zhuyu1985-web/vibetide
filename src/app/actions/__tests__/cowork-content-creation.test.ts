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

  it("写稿→落 draft 草稿→落 draft_result 消息带 articleId（meta 只放 bodyPreview，不放整篇 body）", async () => {
    invokeMock.mockImplementation(async (tool: string) =>
      tool === "content_generate" ? { ok:true, result:{ content:"标题\n\n正文", wordCount: 4 } }
      : { ok:true, result:{ firstArticleId:"art1", firstTitle:"标题" } }); // archive_to_drafts
    const res = await confirmCreationPlan("cv1", plan);
    expect(res.ok).toBe(true);
    // archive_to_drafts 必须用 initialStatus draft
    expect(invokeMock).toHaveBeenCalledWith("archive_to_drafts",
      expect.objectContaining({ initialStatus: "draft", organizationId: "o1" }), expect.anything());
    expect(appendMessageMock).toHaveBeenCalledWith("cv1", expect.objectContaining({
      kind: "draft_result", meta: expect.objectContaining({ articleId: "art1", bodyPreview: "正文" }),
    }));
    // 已入库时 meta 不应再塞整篇 body（文章本身才是真相源）
    const happyMeta = (appendMessageMock.mock.calls.at(-1)![1] as { meta: Record<string, unknown> }).meta;
    expect(happyMeta).not.toHaveProperty("body");
  });

  it("落库没拿到 articleId → 降级 draft_result（带整篇 body 兜底，标记未入库）", async () => {
    invokeMock.mockImplementation(async (tool: string) =>
      tool === "content_generate" ? { ok:true, result:{ content:"标题\n\n正文", wordCount:4 } }
      : { ok:true, result:{ firstArticleId: null } });
    const res = await confirmCreationPlan("cv1", plan);
    expect(res.ok).toBe(true);
    expect(appendMessageMock).toHaveBeenCalledWith("cv1", expect.objectContaining({
      kind: "draft_result", meta: expect.objectContaining({ articleId: null, archived: false, body: "正文" }),
    }));
  });

  it("content_generate 返回失败哨兵 → 拦截在 archive 之前，不入库、不发 draft_result", async () => {
    invokeMock.mockImplementation(async (tool: string) =>
      tool === "content_generate"
        ? { ok:true, result:{ content:"[生成失败] 模型超时", wordCount:0 } }
        : { ok:true, result:{ firstArticleId:"art1" } }); // archive_to_drafts（不应被调用）
    const res = await confirmCreationPlan("cv1", plan);
    expect(res).toMatchObject({ ok: false });
    // 绝不能落库
    expect(invokeMock).not.toHaveBeenCalledWith("archive_to_drafts", expect.anything(), expect.anything());
    // 只发一条 text 写稿失败消息，绝不发 draft_result
    expect(appendMessageMock).toHaveBeenCalledWith("cv1", expect.objectContaining({ kind: "text" }));
    expect(appendMessageMock).not.toHaveBeenCalledWith("cv1", expect.objectContaining({ kind: "draft_result" }));
    expect(appendVersionMock).not.toHaveBeenCalled();
  });
});
