import { describe, it, expect, vi, beforeEach } from "vitest";

const findArticleMock = vi.hoisted(() => vi.fn());
const setMock = vi.hoisted(() => vi.fn(() => ({ where: vi.fn() })));
const updateArticleMock = vi.hoisted(() => vi.fn(() => ({ set: setMock })));
const reviseMock = vi.hoisted(() => vi.fn());
const appendVersionMock = vi.hoisted(() => vi.fn());
const appendMessageMock = vi.hoisted(() => vi.fn());
const getConvoMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("@/lib/dal/auth", () => ({ getCurrentUserOrg: vi.fn(async () => "o1") }));
vi.mock("@/db", () => ({
  db: { query: { articles: { findFirst: findArticleMock } }, update: updateArticleMock },
}));
vi.mock("@/db/schema/articles", () => ({ articles: { id: "id", organizationId: "org" } }));
vi.mock("@/lib/content/revise", () => ({
  reviseDraft: reviseMock,
  // confirmCreationPlan 也在同文件 import 这两个纯函数，给个直通实现避免连带报错
  deriveTitle: vi.fn((c: string) => c.split("\n")[0]),
  splitTitleBody: vi.fn((t: string) => ({ title: t.split("\n")[0], body: t })),
}));
vi.mock("@/lib/dal/article-versions", () => ({ appendArticleVersion: appendVersionMock }));
vi.mock("@/lib/dal/cowork-conversations", () => ({
  appendMessage: appendMessageMock,
  getConversationById: getConvoMock,
}));
vi.mock("@/lib/agent/tool-registry", () => ({ invokeToolDirectly: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { reviseDraftInConversation } from "../cowork-content-creation";

describe("reviseDraftInConversation", () => {
  beforeEach(() => {
    [findArticleMock, reviseMock, appendVersionMock, appendMessageMock, getConvoMock, setMock, updateArticleMock].forEach(
      (m) => m.mockReset(),
    );
    updateArticleMock.mockReturnValue({ set: setMock });
    setMock.mockReturnValue({ where: vi.fn() });
    appendVersionMock.mockResolvedValue({ versionNo: 2 });
    getConvoMock.mockResolvedValue({ id: "cv1", projectId: null });
  });

  it("改稿→写回+版本(rewrite)+新 draft_result（瘦身 meta：bodyPreview，无整篇 body）", async () => {
    findArticleMock.mockResolvedValue({
      id: "art1",
      title: "老标题",
      body: "老正文",
      language: "zh",
      version: 1,
    });
    reviseMock.mockResolvedValue({ title: "新标题", body: "新正文内容很长".repeat(40) });

    const res = await reviseDraftInConversation("cv1", "art1", "导语短一点");

    expect(res).toEqual({ ok: true, articleId: "art1" });
    // 版本链：rewrite + 指令留痕
    expect(appendVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: "art1",
        changeKind: "rewrite",
        changeInstruction: "导语短一点",
        organizationId: "o1",
        language: "zh",
        createdBy: "u1",
      }),
    );
    // 落新 draft_result，meta 瘦身：archived=true、有 bodyPreview、不含整篇 body
    expect(appendMessageMock).toHaveBeenCalledWith(
      "cv1",
      expect.objectContaining({
        kind: "draft_result",
        meta: expect.objectContaining({
          articleId: "art1",
          archived: true,
          title: "新标题",
          bodyPreview: expect.any(String),
          illustrate: false,
        }),
      }),
    );
    const meta = appendMessageMock.mock.calls[0][1].meta;
    expect(meta.body).toBeUndefined();
    expect(meta.bodyPreview.length).toBeLessThanOrEqual(200);
  });

  it("找不到稿件 → 不写回、不发消息", async () => {
    findArticleMock.mockResolvedValue(undefined);
    const res = await reviseDraftInConversation("cv1", "artX", "改一改");
    expect(res).toEqual({ ok: false, error: "找不到稿件" });
    expect(updateArticleMock).not.toHaveBeenCalled();
    expect(appendMessageMock).not.toHaveBeenCalled();
  });

  it("reviseDraft 返回 null → 发文本提示、不写库、不发 draft_result", async () => {
    findArticleMock.mockResolvedValue({ id: "art1", title: "老标题", body: "老正文", language: "zh", version: 1 });
    reviseMock.mockResolvedValue(null);
    const res = await reviseDraftInConversation("cv1", "art1", "乱改");
    expect(res).toEqual({ ok: false, error: "改稿失败" });
    expect(updateArticleMock).not.toHaveBeenCalled();
    expect(appendVersionMock).not.toHaveBeenCalled();
    expect(appendMessageMock).toHaveBeenCalledWith(
      "cv1",
      expect.objectContaining({ kind: "text", content: expect.stringContaining("改稿失败") }),
    );
  });

  it("会话不存在/无权 → 直接拒绝", async () => {
    getConvoMock.mockResolvedValue(null);
    const res = await reviseDraftInConversation("cvX", "art1", "改");
    expect(res).toEqual({ ok: false, error: "对话不存在或无权访问" });
    expect(findArticleMock).not.toHaveBeenCalled();
  });
});
