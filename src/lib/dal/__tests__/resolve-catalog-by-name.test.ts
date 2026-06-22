import { describe, it, expect, vi, beforeEach } from "vitest";

// hoisted mock for @/db
const { where, from, select } = vi.hoisted(() => {
  const where = vi.fn();
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { where, from, select };
});

vi.mock("@/db", () => ({ db: { select } }));

import { resolveCatalogByName } from "../cms-catalogs";

const ORG_ID = "org-test-uuid";

type Row = { catalogId: number; appId: number; siteId: number; name: string };

const rows: Row[] = [
  { catalogId: 1, appId: 10, siteId: 81, name: "新闻" },
  { catalogId: 2, appId: 10, siteId: 81, name: "体育频道" },
  { catalogId: 3, appId: 10, siteId: 81, name: "民生资讯" },
];

beforeEach(() => {
  vi.clearAllMocks();
  // reset select/from chain so each test can configure where independently
  from.mockReturnValue({ where });
  select.mockReturnValue({ from });
});

describe("resolveCatalogByName", () => {
  it("精确名命中 → 返回该行", async () => {
    where.mockResolvedValue(rows);
    const result = await resolveCatalogByName(ORG_ID, "新闻");
    expect(result).toEqual({ catalogId: 1, appId: 10, siteId: 81, name: "新闻" });
  });

  it("包含匹配命中（输入是栏目名子串）→ 返回该条", async () => {
    where.mockResolvedValue(rows);
    // "体育" is contained in "体育频道"
    const result = await resolveCatalogByName(ORG_ID, "体育");
    expect(result?.name).toBe("体育频道");
  });

  it("包含匹配命中（栏目名是输入的子串）→ 返回该条", async () => {
    where.mockResolvedValue(rows);
    // "新闻" is contained in input "新闻资讯"
    const result = await resolveCatalogByName(ORG_ID, "新闻资讯");
    expect(result?.name).toBe("新闻");
  });

  it("无匹配 → null", async () => {
    where.mockResolvedValue(rows);
    const result = await resolveCatalogByName(ORG_ID, "财经");
    expect(result).toBeNull();
  });
});
