import { describe, it, expect } from "vitest";
import {
  EMPLOYEE_META,
  EMPLOYEE_SHORT_DESC,
  EMPLOYEE_CORE_SKILLS,
  BUILTIN_SKILL_NAMES,
} from "@/lib/constants";

describe("EMPLOYEE_META xiaoyan registration", () => {
  it("xiaoyan registered consistently across META / SHORT_DESC / CORE_SKILLS / SKILL_NAMES", () => {
    // META
    expect(EMPLOYEE_META.xiaoyan).toBeDefined();
    expect(EMPLOYEE_META.xiaoyan.id).toBe("xiaoyan");
    expect(EMPLOYEE_META.xiaoyan.name).toBe("学术研究员");
    expect(EMPLOYEE_META.xiaoyan.color).toBe("#4f46e5");
    expect(EMPLOYEE_META.xiaoyan.bgColor).toBe("rgba(79,70,229,0.12)");

    // SHORT_DESC
    expect(EMPLOYEE_SHORT_DESC.xiaoyan).toBeDefined();
    expect(EMPLOYEE_SHORT_DESC.xiaoyan.length).toBeGreaterThan(0);

    // CORE_SKILLS — 三件套
    expect(EMPLOYEE_CORE_SKILLS.xiaoyan).toEqual([
      "report_drafter",
      "research_query_builder",
      "data_pivoter",
    ]);

    // BUILTIN_SKILL_NAMES — 三件套 slug→中文名映射
    expect(BUILTIN_SKILL_NAMES.report_drafter).toBe("学术报告草拟");
    expect(BUILTIN_SKILL_NAMES.research_query_builder).toBe("研究检索构建");
    expect(BUILTIN_SKILL_NAMES.data_pivoter).toBe("数据透视分析");
  });
});
