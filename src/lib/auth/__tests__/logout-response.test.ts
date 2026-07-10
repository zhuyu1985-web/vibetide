import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { applyLogoutCookies } from "@/lib/auth/logout-response";

describe("applyLogoutCookies", () => {
  it("sets expired vibetide-session on NextResponse", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SITE_URL",
      "https://local.demo.chinamcloud.cn:3000",
    );

    const request = new NextRequest("https://local.demo.chinamcloud.cn/auth/logout", {
      headers: { cookie: "vibetide-session=abc; theme=dark" },
    });
    const response = NextResponse.redirect("https://local.demo.chinamcloud.cn/login");

    applyLogoutCookies(request, response);

    const setCookie = response.headers.getSetCookie();
    expect(
      setCookie.filter((h) => h.startsWith("vibetide-session=")).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      setCookie.some(
        (h) =>
          h.startsWith("vibetide-session=") &&
          h.includes("Max-Age=0") &&
          !h.includes("Domain="),
      ),
    ).toBe(true);
    expect(
      setCookie.some(
        (h) =>
          h.startsWith("vibetide-session=") &&
          h.includes("HttpOnly") &&
          h.includes("Max-Age=0"),
      ),
    ).toBe(true);

    vi.unstubAllEnvs();
  });
});
