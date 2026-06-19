import { describe, it, expect, vi, beforeEach } from "vitest";
import { postToSessionWebhook } from "../session-webhook";

beforeEach(() => vi.restoreAllMocks());

describe("postToSessionWebhook", () => {
  it("errcode=0 → ok:true，body 为钉钉 text 格式", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ errcode: 0 })));
    const r = await postToSessionWebhook("https://oapi/x", {
      type: "text",
      content: "✅ 已收录",
    });
    expect(r.ok).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ msgtype: "text", text: { content: "✅ 已收录" } });
  });

  it("errcode≠0 → ok:false 带 error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ errcode: 1, errmsg: "boom" }))
    );
    const r = await postToSessionWebhook("https://oapi/x", { type: "text", content: "x" });
    expect(r).toEqual({ ok: false, error: "boom" });
  });

  it("fetch 抛错 → ok:false 不冒泡", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("net"));
    const r = await postToSessionWebhook("https://oapi/x", { type: "text", content: "x" });
    expect(r.ok).toBe(false);
  });
});
