import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasSsoCookies,
  parseXnUserInfo,
  resolveSsoIdentity,
  safeNextPath,
  findOrProvisionUserByPhone,
  SsoIdentityError,
} from "@/lib/auth/cmc-sso";
import { fetchCmcGroupUser } from "@/lib/auth/cmc-console-client";

vi.mock("@/lib/auth/cmc-console-client", () => ({
  fetchCmcGroupUser: vi.fn(),
}));

vi.mock("@/lib/auth/hash", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
}));

const findFirstMock = vi.fn();
const updateMock = vi.fn();
const insertMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      userProfiles: { findFirst: (...args: unknown[]) => findFirstMock(...args) },
      organizations: {
        findFirst: vi.fn(async () => ({ id: "org-1" })),
      },
    },
    update: (...args: unknown[]) => updateMock(...args),
    insert: (...args: unknown[]) => insertMock(...args),
  },
}));

describe("safeNextPath", () => {
  it("returns /home for empty or unsafe paths", () => {
    expect(safeNextPath(null)).toBe("/home");
    expect(safeNextPath("//evil.com")).toBe("/home");
    expect(safeNextPath("http://evil.com")).toBe("/home");
  });

  it("allows internal relative paths", () => {
    expect(safeNextPath("/workflows/123")).toBe("/workflows/123");
    expect(safeNextPath("/workflows/123?tab=1")).toBe("/workflows/123?tab=1");
  });
});

describe("parseXnUserInfo", () => {
  it("parses valid JSON", () => {
    const result = parseXnUserInfo(
      JSON.stringify({ account: "chongjing", phone: "15198287686" }),
    );
    expect(result).toEqual({
      displayName: "chongjing",
      phone: "15198287686",
      source: "xn_userInfo",
    });
  });

  it("rejects missing fields", () => {
    expect(() => parseXnUserInfo(JSON.stringify({ account: "a" }))).toThrow(
      SsoIdentityError,
    );
  });

  it("rejects invalid phone", () => {
    expect(() =>
      parseXnUserInfo(JSON.stringify({ account: "a", phone: "123" })),
    ).toThrow(SsoIdentityError);
  });
});

describe("resolveSsoIdentity", () => {
  beforeEach(() => {
    vi.stubEnv("CMC_CONSOLE", "https://console.demo.chinamcloud.cn");
    vi.mocked(fetchCmcGroupUser).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers xn_userInfo over CMC API", async () => {
    const result = await resolveSsoIdentity({
      xnUserInfo: JSON.stringify({ account: "user1", phone: "13800138000" }),
      loginCmcId: "id",
      loginCmcTid: "tid",
    });
    expect(result.source).toBe("xn_userInfo");
    expect(fetchCmcGroupUser).not.toHaveBeenCalled();
  });

  it("falls back to CMC API when xn_userInfo absent", async () => {
    vi.mocked(fetchCmcGroupUser).mockResolvedValue({
      login_name: "cmc_user",
      user_mobile: "13900139000",
    });

    const result = await resolveSsoIdentity({
      loginCmcId: "id",
      loginCmcTid: "tid",
    });

    expect(result).toEqual({
      displayName: "cmc_user",
      phone: "13900139000",
      source: "cmc_api",
    });
    expect(fetchCmcGroupUser).toHaveBeenCalledWith("id", "tid");
  });

  it("throws when no SSO cookies", async () => {
    await expect(resolveSsoIdentity({})).rejects.toThrow(SsoIdentityError);
  });
});

describe("hasSsoCookies", () => {
  it("detects xn_userInfo", () => {
    expect(hasSsoCookies({ xnUserInfo: '{"a":1}' })).toBe(true);
  });

  it("requires both CMC cookies", () => {
    expect(hasSsoCookies({ loginCmcId: "a" })).toBe(false);
    expect(hasSsoCookies({ loginCmcId: "a", loginCmcTid: "b" })).toBe(true);
  });
});

describe("findOrProvisionUserByPhone", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset();
    insertMock.mockReset();
    updateMock.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    insertMock.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  it("logs in existing user by phone hash", async () => {
    findFirstMock.mockResolvedValueOnce({
      id: "u1",
      organizationId: "org-1",
      displayName: "existing",
      passwordHash: "hash",
      isSuperAdmin: false,
    });

    const session = await findOrProvisionUserByPhone({
      displayName: "ignored",
      phone: "15198287686",
    });

    expect(session.id).toBe("u1");
    expect(insertMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalled();
  });

  it("registers new user when phone not found", async () => {
    findFirstMock.mockResolvedValueOnce(null);

    const session = await findOrProvisionUserByPhone({
      displayName: "newuser",
      phone: "15198287686",
    });

    expect(session.displayName).toBe("newuser");
    expect(session.organizationId).toBe("org-1");
    expect(insertMock).toHaveBeenCalled();
  });
});
