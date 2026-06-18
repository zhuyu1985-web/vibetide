import { describe, it, expect } from "vitest";
import {
  pickEmployeeForStep,
  type EmployeeWithSkills,
} from "@/lib/mission-core";

// 四层重构:pickEmployeeForStep 确定性"技能→工种"派单 + 向后兼容回退。

/** 构造一个工种默认实例(带 roleType + isPreset)。 */
function craft(roleType: string, skillSlugs: string[] = []): EmployeeWithSkills {
  return {
    id: `id-${roleType}`,
    slug: roleType,
    name: roleType,
    title: roleType,
    nickname: roleType,
    roleType,
    isPreset: 1,
    skills: [],
    skillSlugs,
  };
}

const TEAM = [
  craft("reporter"),
  craft("editor"),
  craft("commentator"),
  craft("post_production"),
  craft("reviewer"),
];

describe("pickEmployeeForStep — 确定性技能→工种派单", () => {
  it("content_generate(core=reporter)派给 reporter 工种实例", () => {
    const picked = pickEmployeeForStep(
      { order: 1, config: { skillSlug: "content_generate" } },
      [],
      TEAM,
    );
    expect(picked.employee?.roleType).toBe("reporter");
  });

  it("video_edit_plan(core=post_production)派给后期实例", () => {
    const picked = pickEmployeeForStep(
      { order: 1, config: { skillSlug: "video_edit_plan" } },
      [],
      TEAM,
    );
    expect(picked.employee?.roleType).toBe("post_production");
  });

  it("fact_check 归 reviewer(按锁定模型 D7),非 reporter", () => {
    const picked = pickEmployeeForStep(
      { order: 1, config: { skillSlug: "fact_check" } },
      [],
      TEAM,
    );
    expect(picked.employee?.roleType).toBe("reviewer");
  });

  it("defaultTeam 内的工种优先于默认 core 主人", () => {
    // content_generate 兼容 [reporter, editor, commentator];defaultTeam 指定 editor → 选 editor
    const picked = pickEmployeeForStep(
      { order: 1, config: { skillSlug: "content_generate" } },
      ["editor"],
      TEAM,
    );
    expect(picked.employee?.roleType).toBe("editor");
  });

  it("requiredCraft 显式指定工种时直接命中", () => {
    const picked = pickEmployeeForStep(
      { order: 1, config: { skillSlug: "content_generate", requiredCraft: "commentator" } },
      [],
      TEAM,
    );
    expect(picked.employee?.roleType).toBe("commentator");
  });

  it("显式 employeeSlug 优先级最高", () => {
    const picked = pickEmployeeForStep(
      { order: 1, employeeSlug: "reviewer", config: { skillSlug: "content_generate" } },
      [],
      TEAM,
    );
    expect(picked.employee?.slug).toBe("reviewer");
  });

  it("向后兼容:员工无 roleType(旧数据)时退回 skillName 名称匹配", () => {
    const legacy: EmployeeWithSkills[] = [
      { id: "a", slug: "xiaowen", name: "内容创作师", title: "", nickname: "", skills: ["内容生成"] },
      { id: "b", slug: "xiaoshen", name: "质量审核官", title: "", nickname: "", skills: ["质量审核"] },
    ];
    const picked = pickEmployeeForStep(
      { order: 1, config: { skillName: "质量审核" } },
      ["xiaowen", "xiaoshen"],
      legacy,
    );
    expect(picked.employee?.slug).toBe("xiaoshen");
  });

  it("无任何工种实例匹配该技能且无 defaultTeam → 返回 null(交由调用方兜底)", () => {
    // task_planning 只兼容 producer;TEAM 里没有 producer 实例
    const picked = pickEmployeeForStep(
      { order: 1, config: { skillSlug: "task_planning" } },
      [],
      TEAM,
    );
    expect(picked.employee).toBeNull();
  });
});
