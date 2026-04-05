/**
 * Verification script for Skill Management Refactor
 * Run: npx tsx scripts/verify-skill-refactor.ts
 *
 * Checks:
 * 1. skill-loader scan returns exactly 31 builtin skills
 * 2. Every skill has slug, name, category, description, content
 * 3. Every skill's content is non-empty
 * 4. Every skills SKILL.md has a category field in frontmatter
 * 5. getBuiltinSkillSlugToName() matches BUILTIN_SKILL_NAMES constant
 * 6. getBuiltinSkillNameToSlug() is the inverse of slug→name
 * 7. loadSkillContent() returns non-empty for 3 random slugs
 * 8. page-qa-fix is excluded from getAllBuiltinSkills()
 * 9. No residual BUILTIN_SKILLS value references in src/
 * 10. npx tsc --noEmit passes
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { parse as parseYaml } from "yaml";
import {
  getAllBuiltinSkills,
  getBuiltinSkillSlugToName,
  getBuiltinSkillNameToSlug,
  loadSkillContent,
  invalidateSkillCache,
} from "../src/lib/skill-loader";
import { BUILTIN_SKILL_NAMES } from "../src/lib/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXPECTED_COUNT = 31;
let passCount = 0;
let failCount = 0;

function report(check: string, pass: boolean, detail?: string) {
  const tag = pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`[${tag}] ${check}`);
  if (detail) console.log(`       ${detail}`);
  if (pass) passCount++;
  else failCount++;
}

// Ensure fresh data
invalidateSkillCache();

const skills = getAllBuiltinSkills();

// ---------------------------------------------------------------------------
// 1. Scan count
// ---------------------------------------------------------------------------
report(
  `1. getAllBuiltinSkills() returns ${EXPECTED_COUNT} skills`,
  skills.length === EXPECTED_COUNT,
  `Got ${skills.length} skills: [${skills.map((s) => s.slug).join(", ")}]`
);

// ---------------------------------------------------------------------------
// 2. Completeness of every skill
// ---------------------------------------------------------------------------
{
  const requiredFields = ["slug", "name", "category", "description", "content"] as const;
  const incomplete: string[] = [];
  for (const s of skills) {
    for (const f of requiredFields) {
      if (s[f] === undefined || s[f] === null) {
        incomplete.push(`${s.slug} missing ${f}`);
      }
    }
  }
  report(
    "2. Every skill has slug, name, category, description, content",
    incomplete.length === 0,
    incomplete.length > 0 ? incomplete.join("; ") : `All ${skills.length} skills complete`
  );
}

// ---------------------------------------------------------------------------
// 3. Content non-empty
// ---------------------------------------------------------------------------
{
  const emptyContent = skills.filter((s) => !s.content || s.content.trim() === "");
  report(
    "3. Every skill's content is non-empty",
    emptyContent.length === 0,
    emptyContent.length > 0
      ? `Empty content: ${emptyContent.map((s) => s.slug).join(", ")}`
      : `All ${skills.length} skills have non-empty content`
  );
}

// ---------------------------------------------------------------------------
// 4. Frontmatter consistency — every SKILL.md has category
// ---------------------------------------------------------------------------
{
  const skillsDir = path.join(process.cwd(), "skills");
  const dirs = fs.readdirSync(skillsDir).filter((d) => {
    return fs.existsSync(path.join(skillsDir, d, "SKILL.md"));
  });

  const missingCategory: string[] = [];
  const nonBuiltinExcluded: string[] = [];

  for (const slug of dirs) {
    const raw = fs.readFileSync(path.join(skillsDir, slug, "SKILL.md"), "utf-8");
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!match) {
      missingCategory.push(`${slug} (no frontmatter)`);
      continue;
    }
    const meta = parseYaml(match[1]) as Record<string, unknown>;

    // Non-builtin skills (builtin: false) are excluded, not a failure
    if (meta.builtin === false) {
      nonBuiltinExcluded.push(slug);
      continue;
    }

    if (!meta.category) {
      missingCategory.push(slug);
    }
  }

  report(
    "4. Every builtin SKILL.md has a category field",
    missingCategory.length === 0,
    missingCategory.length > 0
      ? `Missing category: ${missingCategory.join(", ")}`
      : `All builtin SKILL.md files have category (${nonBuiltinExcluded.length} non-builtin excluded: ${nonBuiltinExcluded.join(", ")})`
  );
}

// ---------------------------------------------------------------------------
// 5. slug→name mapping matches BUILTIN_SKILL_NAMES
// ---------------------------------------------------------------------------
{
  const loaderMap = getBuiltinSkillSlugToName();
  const constMap = BUILTIN_SKILL_NAMES;
  const mismatches: string[] = [];

  // Check loader has all constant entries
  for (const [slug, name] of Object.entries(constMap)) {
    const loaderName = loaderMap.get(slug);
    if (loaderName !== name) {
      mismatches.push(`${slug}: constant="${name}" loader="${loaderName ?? "(missing)"}"`);
    }
  }

  // Check constant has all loader entries
  for (const [slug, name] of loaderMap) {
    if (constMap[slug] === undefined) {
      mismatches.push(`${slug}: in loader but missing from BUILTIN_SKILL_NAMES`);
    }
  }

  report(
    "5. getBuiltinSkillSlugToName() matches BUILTIN_SKILL_NAMES",
    mismatches.length === 0,
    mismatches.length > 0
      ? mismatches.join("; ")
      : `All ${loaderMap.size} entries match`
  );
}

// ---------------------------------------------------------------------------
// 6. name→slug is the inverse of slug→name
// ---------------------------------------------------------------------------
{
  const slugToName = getBuiltinSkillSlugToName();
  const nameToSlug = getBuiltinSkillNameToSlug();
  const inverseErrors: string[] = [];

  for (const [slug, name] of slugToName) {
    const reverseSlug = nameToSlug.get(name);
    if (reverseSlug !== slug) {
      inverseErrors.push(`slug="${slug}" name="${name}" reverse="${reverseSlug ?? "(missing)"}"`);
    }
  }

  for (const [name, slug] of nameToSlug) {
    const reverseName = slugToName.get(slug);
    if (reverseName !== name) {
      inverseErrors.push(`name="${name}" slug="${slug}" reverse="${reverseName ?? "(missing)"}"`);
    }
  }

  report(
    "6. name→slug and slug→name are mutual inverses",
    inverseErrors.length === 0,
    inverseErrors.length > 0
      ? inverseErrors.join("; ")
      : `Bidirectional mapping verified for ${slugToName.size} entries`
  );
}

// ---------------------------------------------------------------------------
// 7. loadSkillContent for 3 random slugs
// ---------------------------------------------------------------------------
{
  const allSlugs = skills.map((s) => s.slug);
  // Pick 3 deterministic-random slugs (using indices spread across array)
  const sample = [
    allSlugs[0],
    allSlugs[Math.floor(allSlugs.length / 2)],
    allSlugs[allSlugs.length - 1],
  ].filter(Boolean);

  const failures: string[] = [];
  for (const slug of sample) {
    const content = loadSkillContent(slug);
    if (!content || content.trim() === "") {
      failures.push(slug);
    }
  }

  report(
    `7. loadSkillContent() returns non-empty for 3 sample slugs`,
    failures.length === 0,
    failures.length > 0
      ? `Empty content for: ${failures.join(", ")}`
      : `Verified: ${sample.join(", ")}`
  );
}

// ---------------------------------------------------------------------------
// 8. page-qa-fix excluded
// ---------------------------------------------------------------------------
{
  const hasPageQaFix = skills.some((s) => s.slug === "page-qa-fix");
  report(
    "8. page-qa-fix is excluded from getAllBuiltinSkills()",
    !hasPageQaFix,
    hasPageQaFix ? "page-qa-fix was found in builtin skills!" : "Correctly excluded"
  );
}

// ---------------------------------------------------------------------------
// 9. No residual BUILTIN_SKILLS value references in src/
// ---------------------------------------------------------------------------
{
  let grepOutput = "";
  try {
    // grep for BUILTIN_SKILLS that is NOT followed by _NAMES (i.e. not BUILTIN_SKILL_NAMES)
    // Also exclude type-only references and comments
    grepOutput = execSync(
      `grep -rn "BUILTIN_SKILLS" src/ --include="*.ts" --include="*.tsx" | grep -v "BUILTIN_SKILL_NAMES" | grep -v "BUILTIN_SKILL_SLUGS" | grep -v "// " | grep -v "\\* " | grep -v "type " | grep -v "interface " || true`,
      { encoding: "utf-8", cwd: process.cwd() }
    ).trim();
  } catch {
    grepOutput = "";
  }

  const lines = grepOutput
    .split("\n")
    .filter((l) => l.trim() !== "");

  report(
    "9. No residual BUILTIN_SKILLS value references in src/",
    lines.length === 0,
    lines.length > 0
      ? `Found ${lines.length} potential references:\n${lines.map((l) => `       ${l}`).join("\n")}`
      : "No residual value references found"
  );
}

// ---------------------------------------------------------------------------
// 10. Type check (npx tsc --noEmit)
// ---------------------------------------------------------------------------
{
  let tscPass = false;
  let tscOutput = "";
  try {
    tscOutput = execSync("npx tsc --noEmit 2>&1", {
      encoding: "utf-8",
      cwd: process.cwd(),
      timeout: 120_000,
    });
    tscPass = true;
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string };
    tscOutput = (err.stdout || "") + (err.stderr || "");
    tscPass = false;
  }

  report(
    "10. npx tsc --noEmit passes",
    tscPass,
    tscPass
      ? "TypeScript compilation succeeded"
      : `TypeScript errors:\n${tscOutput.split("\n").slice(0, 20).map((l) => `       ${l}`).join("\n")}`
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("\n" + "=".repeat(60));
console.log(
  `Summary: ${passCount} PASS, ${failCount} FAIL out of ${passCount + failCount} checks`
);
if (failCount > 0) {
  console.log("\x1b[31mSome checks failed. Please review above.\x1b[0m");
  process.exit(1);
} else {
  console.log("\x1b[32mAll checks passed!\x1b[0m");
  process.exit(0);
}
