import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assembleAgent } from "@/lib/agent/assembly";

/**
 * A6 Phase 2 — 验证 A5 Inngest Step 3 既有调用路径
 *
 *   const xiaoyan = await db.query.aiEmployees.findFirst({
 *     where: eq(aiEmployees.slug, "xiaoyan"),
 *   });
 *   const agent = await assembleAgent(xiaoyan.id, undefined, {
 *     skillOverrides: ["report_drafter"],
 *   });
 *
 * 装配出的 systemPrompt 必须含 SKILL.md 核心要素（学术研究员小研身份、
 * 学术中性风格硬约束、第三人称叙述、禁止行为清单），否则 A5 Inngest Step 3
 * 在 generateText 时拿不到风格约束，输出会偏离学术体。
 *
 * 依赖：Phase 1 已 seed xiaoyan（src/db/__tests__/seed-employees.test.ts 验过）。
 */
describe("report_drafter SKILL.md → assembleAgent system prompt", () => {
  it("xiaoyan + skillOverrides=['report_drafter'] 装配出的 systemPrompt 含 SKILL.md 核心要素", async () => {
    const xiaoyan = await db.query.aiEmployees.findFirst({
      where: eq(aiEmployees.slug, "xiaoyan"),
    });
    expect(xiaoyan, "xiaoyan 必须已 seed (依赖 A6 Phase 1)").toBeDefined();

    const agent = await assembleAgent(xiaoyan!.id, undefined, {
      skillOverrides: ["report_drafter"],
    });

    // SKILL.md 身份段（## 执行流程 章节顶部）
    expect(agent.systemPrompt).toContain("学术研究员小研");
    // 学术中性风格硬约束（## 执行流程 内的"学术中性"小节标题 + 文字）
    expect(agent.systemPrompt).toContain("学术中性");
    // 第三人称叙述硬约束
    expect(agent.systemPrompt).toContain("第三人称");
    // 禁止行为清单（"禁止" / "不写" / "不臆造" 任一命中即可）
    expect(agent.systemPrompt).toMatch(/禁止|不写|不臆造/);
  });
});
