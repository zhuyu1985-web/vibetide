import { describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: dbMocks.select,
  },
}));

import { exportCollectedItemsForExcel } from "../collected-items";

function mockCountOnly(total: number) {
  dbMocks.select.mockReturnValueOnce({
    from: vi.fn(() => ({
      where: vi.fn(async () => [{ n: total }]),
    })),
  });
}

function mockCountThenRows(total: number) {
  mockCountOnly(total);
  dbMocks.select.mockReturnValueOnce({
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => []),
        })),
      })),
    })),
  });
}

describe("exportCollectedItemsForExcel — 导出上限", () => {
  it("默认允许导出超过 50000 但不超过 100000 条的匹配结果", async () => {
    dbMocks.select.mockReset();
    mockCountThenRows(50001);

    await expect(exportCollectedItemsForExcel("org-id")).resolves.toEqual([]);
  });

  it("默认超过 100000 条时提示单次导出上限", async () => {
    dbMocks.select.mockReset();
    mockCountOnly(100001);

    await expect(exportCollectedItemsForExcel("org-id")).rejects.toThrow(
      "匹配 100001 条,超过单次导出上限 100000 条,请收紧筛选条件后再试",
    );
  });
});
