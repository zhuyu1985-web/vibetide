import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { aiEmployees, employeeSkills, skills } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * 验证 A6 Phase 1: xiaoyan 学术研究员 + 3 件套 core skill 已 seed。
 *
 * Pre-requisite: `npm run db:seed` 已成功跑过（含 xiaoyan + 3 skill）。
 *
 * 注：spec/plan 写 authorityLevel=assistant，但 DB authority_level enum 仅含
 * observer/advisor/executor/coordinator。学术研究员沿用与 xiaoshu(数据分析师)
 * 一致的 advisor 等级 — 偏建议 / 报告产出，不直接执行破坏性操作。
 */
describe("xiaoyan employee seed", () => {
  it("xiaoyan exists with research_analyst role and 3 core skills bound", async () => {
    const xiaoyan = await db.query.aiEmployees.findFirst({
      where: eq(aiEmployees.slug, "xiaoyan"),
    });
    expect(xiaoyan).toBeDefined();
    expect(xiaoyan!.roleType).toBe("research_analyst");
    expect(xiaoyan!.authorityLevel).toBe("advisor");
    expect(xiaoyan!.name).toBe("学术研究员");
    expect(xiaoyan!.workPreferences).toBeDefined();
    expect(xiaoyan!.workPreferences?.communicationStyle).toBe("formal_academic");
    expect(xiaoyan!.workPreferences?.autonomyLevel).toBe(60);

    const bound = await db
      .select({ slug: skills.slug, bindingType: employeeSkills.bindingType })
      .from(employeeSkills)
      .innerJoin(skills, eq(employeeSkills.skillId, skills.id))
      .where(eq(employeeSkills.employeeId, xiaoyan!.id));

    const slugs = bound.map((r) => r.slug).sort();
    // A6 Phase 1 三件套 + 后续扩展的 web/news 通用技能 = 6 个 core skills
    expect(slugs).toEqual([
      "data_pivoter",
      "news_aggregation",
      "report_drafter",
      "research_query_builder",
      "web_deep_read",
      "web_search",
    ]);
    expect(bound.every((r) => r.bindingType === "core")).toBe(true);
  });
});
