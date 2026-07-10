import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllCookies,
  resolveSsoCookieDomain,
  SSO_COOKIE_NAMES,
} from "@/lib/auth/sso-cookies";

const deleteMock = vi.fn();
const setMock = vi.fn();
const getAllMock = vi.fn(() => [
  { name: "vibetide-session", value: "x" },
  { name: "theme", value: "dark" },
]);
const expireSessionCookieMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  VIBETIDE_SESSION_COOKIE: "vibetide-session",
  expireSessionCookie: (...args: unknown[]) => expireSessionCookieMock(...args),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: getAllMock,
    delete: deleteMock,
    set: setMock,
  })),
}));

describe("resolveSsoCookieDomain", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers CMC_COOKIE_DOMAIN env", () => {
    vi.stubEnv("CMC_COOKIE_DOMAIN", ".demo.chinamcloud.cn");
    expect(resolveSsoCookieDomain()).toBe(".demo.chinamcloud.cn");
  });

  it("derives from NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SITE_URL",
      "https://local.demo.chinamcloud.cn:3000",
    );
    expect(resolveSsoCookieDomain()).toBe(".demo.chinamcloud.cn");
  });

  it("returns undefined for localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    expect(resolveSsoCookieDomain()).toBeUndefined();
  });
});

describe("clearAllCookies", () => {
  beforeEach(() => {
    deleteMock.mockReset();
    setMock.mockReset();
    getAllMock.mockClear();
    expireSessionCookieMock.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv("CMC_COOKIE_DOMAIN", ".demo.chinamcloud.cn");
    vi.stubEnv(
      "NEXT_PUBLIC_SITE_URL",
      "https://local.demo.chinamcloud.cn:3000",
    );
  });

  it("expires session via expireSessionCookie", async () => {
    await clearAllCookies();
    expect(expireSessionCookieMock).toHaveBeenCalledTimes(1);
  });

  it("deletes other cookies from getAll with secure variants", async () => {
    await clearAllCookies();

    expect(deleteMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "theme", secure: true, path: "/" }),
    );
    for (const name of SSO_COOKIE_NAMES) {
      expect(deleteMock).toHaveBeenCalledWith(
        expect.objectContaining({ name }),
      );
    }
  });

  it("expires cookies on parent domain", async () => {
    await clearAllCookies();

    const expiredNames = setMock.mock.calls.map((call) => call[0]);
    expect(expiredNames).toContain("theme");
    for (const name of SSO_COOKIE_NAMES) {
      expect(expiredNames).toContain(name);
    }
  });
});
