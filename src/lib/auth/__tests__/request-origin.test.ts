import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { absoluteUrl, resolvePublicOrigin } from "@/lib/auth/request-origin";

function mockRequest(
  url: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, { headers });
}

describe("request-origin", () => {
  it("prefers NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://local.demo.chinamcloud.cn:3000");
    const req = mockRequest("https://0.0.0.0:3000/login");
    expect(resolvePublicOrigin(req)).toBe("https://local.demo.chinamcloud.cn:3000");
    vi.unstubAllEnvs();
  });

  it("uses Host header when not 0.0.0.0", () => {
    vi.unstubAllEnvs();
    const req = mockRequest("https://0.0.0.0:3000/login", {
      host: "local.demo.chinamcloud.cn:3000",
    });
    expect(resolvePublicOrigin(req)).toBe(
      "https://local.demo.chinamcloud.cn:3000",
    );
  });

  it("absoluteUrl builds safe login redirect", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://local.demo.chinamcloud.cn:3000");
    const req = mockRequest("https://0.0.0.0:3000/auth/sso");
    const url = absoluteUrl(req, "/login?error=sso_failed");
    expect(url.toString()).toBe(
      "https://local.demo.chinamcloud.cn:3000/login?error=sso_failed",
    );
    vi.unstubAllEnvs();
  });
});
