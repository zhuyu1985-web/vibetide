import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionCookieDeleteOptions } from "@/lib/auth/session";

const deleteMock = vi.fn();
const setMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    delete: deleteMock,
    set: setMock,
  })),
}));

describe("getSessionCookieDeleteOptions", () => {
  it("includes secure:false variant on HTTPS sites", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SITE_URL",
      "https://local.demo.chinamcloud.cn:3000",
    );
    const variants = getSessionCookieDeleteOptions();
    expect(variants).toHaveLength(2);
    expect(variants[0]?.secure).toBe(true);
    expect(variants[1]?.secure).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("expireSessionCookie", () => {
  beforeEach(() => {
    deleteMock.mockReset();
    setMock.mockReset();
    vi.stubEnv(
      "NEXT_PUBLIC_SITE_URL",
      "https://local.demo.chinamcloud.cn:3000",
    );
  });

  it("deletes vibetide-session with httpOnly + secure variants", async () => {
    const { expireSessionCookie } = await import("@/lib/auth/session");
    await expireSessionCookie();

    expect(deleteMock).toHaveBeenCalledWith({
      name: "vibetide-session",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    expect(deleteMock).toHaveBeenCalledWith({
      name: "vibetide-session",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });
    expect(setMock).toHaveBeenCalledWith(
      "vibetide-session",
      "",
      expect.objectContaining({ maxAge: 0, httpOnly: true }),
    );
  });
});
