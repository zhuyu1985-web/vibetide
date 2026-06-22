/**
 * ensureArticleForMission — 三态单测
 *
 * ① 已有 article → 直接返回，不 insert
 * ② 无 article 但 task.outputData.articles[0].body 有内容 → insert draft + 返回新 id
 * ③ 无 article 且无文章内容 → 返回 null，不 insert
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const {
  // articles select chain: .select().from().where().orderBy().limit()
  artLimitFn, artOrderByFn, artWhereFn, artFromFn,
  // missionTasks select chain: .select().from().where()  → resolves array directly
  taskWhereFn, taskFromFn,
  // insert chain: .insert().values().returning()
  returningFn, valuesFn, insertFn,
} = vi.hoisted(() => {
  const artLimitFn = vi.fn();
  const artOrderByFn = vi.fn(() => ({ limit: artLimitFn }));
  const artWhereFn = vi.fn(() => ({ orderBy: artOrderByFn }));
  const artFromFn = vi.fn(() => ({ where: artWhereFn }));

  const taskWhereFn = vi.fn();
  const taskFromFn = vi.fn(() => ({ where: taskWhereFn }));

  const returningFn = vi.fn();
  const valuesFn = vi.fn(() => ({ returning: returningFn }));
  const insertFn = vi.fn(() => ({ values: valuesFn }));

  return { artLimitFn, artOrderByFn, artWhereFn, artFromFn, taskWhereFn, taskFromFn, returningFn, valuesFn, insertFn };
});

// db.select is called twice inside ensureArticleForMission:
//   call #1 → articles query (needs .from → .where → .orderBy → .limit)
//   call #2 → missionTasks query (needs .from → .where, resolves directly)
let selectCallCount = 0;
vi.mock("@/db", () => ({
  db: {
    select: (_cols: unknown) => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // articles chain
        return { from: artFromFn };
      }
      // missionTasks chain
      return { from: taskFromFn };
    },
    insert: insertFn,
  },
}));

import { ensureArticleForMission } from "../articles";

beforeEach(() => {
  selectCallCount = 0;
  artLimitFn.mockReset();
  artOrderByFn.mockClear();
  artWhereFn.mockClear();
  artFromFn.mockClear();
  taskWhereFn.mockReset();
  taskFromFn.mockClear();
  returningFn.mockReset();
  valuesFn.mockClear();
  insertFn.mockClear();
});

describe("ensureArticleForMission", () => {
  it("① 已有 article → 直接返回，不 insert", async () => {
    artLimitFn.mockResolvedValue([{ id: "art1", title: "已有稿", status: "draft" }]);

    const result = await ensureArticleForMission("m1", "org1");
    expect(result).toEqual({ id: "art1", title: "已有稿" });
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("② 无 article 但 task.outputData.articles[0].body 有内容 → insert draft + 返回新 id", async () => {
    artLimitFn.mockResolvedValue([]);
    taskWhereFn.mockResolvedValue([
      { outputData: { articles: [{ title: "AI 大模型报道", body: "这是正文内容" }] } },
    ]);
    returningFn.mockResolvedValue([{ id: "new-art1", title: "AI 大模型报道" }]);

    const result = await ensureArticleForMission("m1", "org1");
    expect(result).toEqual({ id: "new-art1", title: "AI 大模型报道" });
    expect(insertFn).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertedValues = (valuesFn.mock.calls[0] as any[])[0] as Record<string, unknown>;
    expect(insertedValues.organizationId).toBe("org1");
    expect(insertedValues.missionId).toBe("m1");
    expect(insertedValues.body).toBe("这是正文内容");
    expect(insertedValues.title).toBe("AI 大模型报道");
    expect(insertedValues.status).toBe("draft");
  });

  it("② fallback: outputData.body（无 articles 数组）→ insert draft", async () => {
    artLimitFn.mockResolvedValue([]);
    taskWhereFn.mockResolvedValue([
      { outputData: { title: "fallback 标题", body: "fallback 正文" } },
    ]);
    returningFn.mockResolvedValue([{ id: "new-art2", title: "fallback 标题" }]);

    const result = await ensureArticleForMission("m1", "org1");
    expect(result).toEqual({ id: "new-art2", title: "fallback 标题" });
    expect(insertFn).toHaveBeenCalledTimes(1);
  });

  it("③ 无 article 且无文章内容 → 返回 null，不 insert", async () => {
    artLimitFn.mockResolvedValue([]);
    taskWhereFn.mockResolvedValue([{ outputData: { someKey: "no-body-here" } }]);

    const result = await ensureArticleForMission("m1", "org1");
    expect(result).toBeNull();
    expect(insertFn).not.toHaveBeenCalled();
  });
});
