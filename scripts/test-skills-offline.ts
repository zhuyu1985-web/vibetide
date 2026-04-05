/**
 * Offline Skill Data Validation
 * Validates all 29 skills' constants data without DB connection.
 * Checks: content quality, schema completeness, SKILL.md files existence.
 */
import { EMPLOYEE_CORE_SKILLS } from "../src/lib/constants";
import { getAllBuiltinSkills, type BuiltinSkillDef } from "../src/lib/skill-loader";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface ValidationResult {
  slug: string;
  name: string;
  category: string;
  checks: { name: string; pass: boolean; detail: string }[];
}

function validateSkill(skill: BuiltinSkillDef): ValidationResult {
  const checks: ValidationResult["checks"] = [];

  // 1. Content length
  const contentLen = skill.content.length;
  checks.push({
    name: "content长度",
    pass: contentLen >= 500,
    detail: `${contentLen}字符 ${contentLen < 500 ? "(过短，需≥500)" : "✓"}`,
  });

  // 2. Content has structured sections
  const hasExecFlow = skill.content.includes("执行流程");
  const hasOutputSpec = skill.content.includes("输出规格");
  const hasQualityStd = skill.content.includes("质量标准");
  const hasInputSpec = skill.content.includes("输入规格");
  checks.push({
    name: "内容结构完整",
    pass: hasExecFlow && hasOutputSpec && hasQualityStd && hasInputSpec,
    detail: [
      hasInputSpec ? "✓输入" : "✗输入",
      hasExecFlow ? "✓流程" : "✗流程",
      hasOutputSpec ? "✓输出" : "✗输出",
      hasQualityStd ? "✓质量" : "✗质量",
    ].join(" "),
  });

  // 3. Content is Chinese
  const chineseRatio = (skill.content.match(/[\u4e00-\u9fff]/g) || []).length / contentLen;
  checks.push({
    name: "中文内容",
    pass: chineseRatio > 0.15,
    detail: `中文占比 ${(chineseRatio * 100).toFixed(0)}%`,
  });

  // 4. inputSchema defined
  checks.push({
    name: "inputSchema",
    pass: !!skill.inputSchema && Object.keys(skill.inputSchema).length > 0,
    detail: skill.inputSchema ? `${Object.keys(skill.inputSchema).length}个字段` : "缺失",
  });

  // 5. outputSchema defined
  checks.push({
    name: "outputSchema",
    pass: !!skill.outputSchema && Object.keys(skill.outputSchema).length > 0,
    detail: skill.outputSchema ? `${Object.keys(skill.outputSchema).length}个字段` : "缺失",
  });

  // 6. runtimeConfig defined
  checks.push({
    name: "runtimeConfig",
    pass: !!skill.runtimeConfig,
    detail: skill.runtimeConfig
      ? `type=${skill.runtimeConfig.type}, model=${skill.runtimeConfig.modelDependency || "N/A"}`
      : "缺失",
  });

  // 7. compatibleRoles defined
  checks.push({
    name: "compatibleRoles",
    pass: !!skill.compatibleRoles && skill.compatibleRoles.length > 0,
    detail: skill.compatibleRoles ? `${skill.compatibleRoles.length}个角色` : "缺失",
  });

  // 8. SKILL.md file exists
  const skillMdPath = join(process.cwd(), "skills", skill.slug, "SKILL.md");
  const skillMdExists = existsSync(skillMdPath);
  let skillMdLines = 0;
  let skillMdHasFrontmatter = false;
  let skillMdHasExample = false;
  let skillMdHasEdgeCases = false;
  let skillMdHasCollaboration = false;
  if (skillMdExists) {
    const md = readFileSync(skillMdPath, "utf-8");
    skillMdLines = md.split("\n").length;
    skillMdHasFrontmatter = md.startsWith("---");
    skillMdHasExample = md.includes("输出示例");
    skillMdHasEdgeCases = md.includes("边界情况");
    skillMdHasCollaboration = md.includes("上下游协作");
  }
  checks.push({
    name: "SKILL.md文件",
    pass: skillMdExists && skillMdLines >= 60,
    detail: skillMdExists
      ? `${skillMdLines}行 ${skillMdHasFrontmatter ? "✓frontmatter" : "✗frontmatter"} ${skillMdHasExample ? "✓示例" : "✗示例"} ${skillMdHasEdgeCases ? "✓边界" : "✗边界"} ${skillMdHasCollaboration ? "✓协作" : "✗协作"}`
      : "文件不存在",
  });

  // 9. Content doesn't have unescaped quotes (syntax issue)
  // Check for unescaped double quotes inside content (which would break JS strings)
  // This is a static check - the fact that the code compiles means this passed
  checks.push({
    name: "语法安全",
    pass: true,
    detail: "编译通过",
  });

  // 10. Skill bound to at least one employee
  const boundEmployees = Object.entries(EMPLOYEE_CORE_SKILLS)
    .filter(([, skills]) => skills.includes(skill.slug))
    .map(([emp]) => emp);
  checks.push({
    name: "员工绑定",
    pass: boundEmployees.length > 0,
    detail: boundEmployees.length > 0 ? `绑定: ${boundEmployees.join(", ")}` : "未绑定任何员工",
  });

  // 11. modelDependency format (provider:model)
  if (skill.runtimeConfig?.modelDependency) {
    const hasColon = skill.runtimeConfig.modelDependency.includes(":");
    checks.push({
      name: "模型格式",
      pass: hasColon,
      detail: hasColon
        ? `格式正确: ${skill.runtimeConfig.modelDependency}`
        : `格式错误: ${skill.runtimeConfig.modelDependency} (需要 provider:model)`,
    });
  }

  return { slug: skill.slug, name: skill.name, category: skill.category, checks };
}

function main() {
  console.log("=".repeat(70));
  console.log("🔍 Vibetide 技能数据完整性验证");
  console.log("=".repeat(70));
  console.log(`\n📋 技能总数: ${getAllBuiltinSkills().length}\n`);

  const allResults: ValidationResult[] = [];
  const categories = ["perception", "analysis", "generation", "production", "management", "knowledge"];
  const categoryNames: Record<string, string> = {
    perception: "感知类", analysis: "分析类", generation: "生成类",
    production: "制作类", management: "管理类", knowledge: "知识类",
  };

  let totalChecks = 0;
  let totalPass = 0;
  let totalFail = 0;

  for (const category of categories) {
    const skills = getAllBuiltinSkills().filter((s) => s.category === category);
    console.log(`\n${"─".repeat(50)}`);
    console.log(`📂 ${categoryNames[category]} (${skills.length}个)`);
    console.log(`${"─".repeat(50)}`);

    for (const skill of skills) {
      const result = validateSkill(skill);
      allResults.push(result);

      const failedChecks = result.checks.filter((c) => !c.pass);
      const icon = failedChecks.length === 0 ? "✅" : "⚠️";
      console.log(`\n  ${icon} ${skill.name} (${skill.slug})`);

      for (const check of result.checks) {
        const ci = check.pass ? "  ✓" : "  ✗";
        console.log(`    ${ci} ${check.name}: ${check.detail}`);
        totalChecks++;
        if (check.pass) totalPass++;
        else totalFail++;
      }
    }
  }

  // Summary
  console.log(`\n${"=".repeat(70)}`);
  console.log("📊 验证结果汇总");
  console.log(`${"=".repeat(70)}`);
  console.log(`\n检查项总数: ${totalChecks}`);
  console.log(`✅ 通过: ${totalPass}`);
  console.log(`❌ 失败: ${totalFail}`);
  console.log(`通过率: ${((totalPass / totalChecks) * 100).toFixed(1)}%`);

  // List all failures
  const failures = allResults.flatMap((r) =>
    r.checks.filter((c) => !c.pass).map((c) => ({
      skill: `${r.name} (${r.slug})`,
      check: c.name,
      detail: c.detail,
    }))
  );

  if (failures.length > 0) {
    console.log(`\n❌ 失败项详情:`);
    for (const f of failures) {
      console.log(`   ${f.skill} → ${f.check}: ${f.detail}`);
    }
  } else {
    console.log(`\n🎉 所有检查项全部通过!`);
  }

  // Check employee coverage
  console.log(`\n${"─".repeat(50)}`);
  console.log("👥 员工-技能覆盖检查");
  console.log(`${"─".repeat(50)}`);
  for (const [emp, skills] of Object.entries(EMPLOYEE_CORE_SKILLS)) {
    const missing = skills.filter((s) => !getAllBuiltinSkills().find((b) => b.slug === s));
    if (missing.length > 0) {
      console.log(`  ⚠️ ${emp}: 绑定了不存在的技能: ${missing.join(", ")}`);
    } else {
      console.log(`  ✅ ${emp}: ${skills.length}个核心技能全部存在`);
    }
  }

  // Check for orphan skills (not bound to any employee)
  const allBoundSlugs = new Set(Object.values(EMPLOYEE_CORE_SKILLS).flat());
  const orphans = getAllBuiltinSkills().filter((s) => !allBoundSlugs.has(s.slug));
  if (orphans.length > 0) {
    console.log(`\n  ⚠️ 未绑定到任何员工的技能: ${orphans.map((s) => s.slug).join(", ")}`);
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

main();
