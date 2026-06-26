import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchResultJson, TingwuApiError } from "../client";

afterEach(() => vi.restoreAllMocks());

describe("fetchResultJson", () => {
  it("成功 → 返回 JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ a: 1 }) }),
    );
    expect(await fetchResultJson("https://x/r.json")).toEqual({ a: 1 });
  });

  it("非 2xx → 抛 TingwuApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchResultJson("https://x/r.json")).rejects.toBeInstanceOf(
      TingwuApiError,
    );
  });
});
