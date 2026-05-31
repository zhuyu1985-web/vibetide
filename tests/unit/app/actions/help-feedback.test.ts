import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- mock @/db (drizzle-orm 链式调用)----
// submitDocFeedback 走两条路径:
//   1. db.select().from(helpFeedback).where(...)  返回 [{ count: number }]
//   2. db.insert(helpFeedback).values(...)         返回 Promise<void>
// 用可链式 mock 让默认返回 count=0(限流未命中),具体测试可单独 override。

const mockValues = vi.fn(async () => {});
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockSelectWhere = vi.fn(async () => [{ count: 0 }]);
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

vi.mock("@/db", () => ({
  db: {
    insert: mockInsert,
    select: mockSelect,
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (k: string) => {
      if (k === "x-forwarded-for") return "1.2.3.4";
      if (k === "user-agent") return "test-ua";
      return null;
    },
  }),
}));

describe("submitDocFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置默认行为(每个 it 可以单独覆盖)
    mockSelectWhere.mockImplementation(async () => [{ count: 0 }]);
    mockValues.mockImplementation(async () => {});
    mockInsert.mockImplementation(() => ({ values: mockValues }));
    mockSelectFrom.mockImplementation(() => ({ where: mockSelectWhere }));
    mockSelect.mockImplementation(() => ({ from: mockSelectFrom }));
  });

  it("接受合法输入并落表", async () => {
    const { submitDocFeedback } = await import("@/app/actions/help-feedback");
    const r = await submitDocFeedback({ docPath: "workflows/start", helpful: true });
    expect(r.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledTimes(1);
    const values = (mockValues.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(values.docPath).toBe("workflows/start");
    expect(values.helpful).toBe(true);
    expect(values.comment).toBeNull();
    expect(values.userAgent).toBe("test-ua");
    expect(typeof values.ipHash).toBe("string");
    expect((values.ipHash as string).length).toBe(64); // sha256 hex
  });

  it("拒绝空 docPath", async () => {
    const { submitDocFeedback } = await import("@/app/actions/help-feedback");
    const r = await submitDocFeedback({ docPath: "", helpful: true });
    expect(r.ok).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("拒绝超长 comment(>500 字)", async () => {
    const { submitDocFeedback } = await import("@/app/actions/help-feedback");
    const r = await submitDocFeedback({
      docPath: "x/y",
      helpful: true,
      comment: "a".repeat(501),
    });
    expect(r.ok).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("1 分钟 > 10 条时静默假成功(ok:true 但不落表)", async () => {
    // 模拟限流命中:count 返回 11
    mockSelectWhere.mockImplementationOnce(async () => [{ count: 11 }]);
    const { submitDocFeedback } = await import("@/app/actions/help-feedback");
    const r = await submitDocFeedback({ docPath: "x/y", helpful: true });
    expect(r.ok).toBe(true);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
