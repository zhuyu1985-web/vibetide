/**
 * Audit script: scan src/ and skills/ for stale model references.
 *
 * Run: npx tsx scripts/audit-model-references.ts
 *
 * Exits 0 if no violations, 1 if violations found.
 * Used by M2 Phase 2 to enforce "qwen3-max via OPENAI_MODEL is the only truth"
 * — no hardcoded fallback to deepseek/glm/zhipu provider names.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const VIOLATIONS: RegExp[] = [
  /\bdeepseek-chat\b/g,
  /\bdeepseek-coder\b/g,
  /\bdeepseek-reasoner\b/g,
  /\bglm-4\b/gi,
  /\bglm-4\.5\b/gi,
  /provider:\s*["']zhipu["']/g,
  /modelDependency:\s*deepseek/g,
];

const SCAN_DIRS = ["src", "skills"];
const EXTENSIONS = new Set([".ts", ".tsx", ".md"]);
const SKIP = /\.test\.|__tests__|node_modules|\.next/;

interface Violation {
  file: string;
  line: number;
  match: string;
  context: string;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (SKIP.test(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (EXTENSIONS.has(extname(p))) out.push(p);
  }
  return out;
}

function scan(file: string): Violation[] {
  const text = readFileSync(file, "utf-8");
  const lines = text.split("\n");
  const found: Violation[] = [];
  lines.forEach((line, idx) => {
    // Allowlist: skip if this line OR the line above contains "// audit-allow:" (TS/JS)
    // or "<!-- audit-allow:" (Markdown HTML comment).
    const allowOnThisLine =
      line.includes("// audit-allow:") || line.includes("<!-- audit-allow:");
    const allowOnLineAbove =
      idx > 0 &&
      (lines[idx - 1].includes("// audit-allow:") ||
        lines[idx - 1].includes("<!-- audit-allow:"));
    if (allowOnThisLine || allowOnLineAbove) return;

    for (const rx of VIOLATIONS) {
      const m = line.match(rx);
      if (m) found.push({ file, line: idx + 1, match: m[0], context: line.trim() });
    }
  });
  return found;
}

const allFiles = SCAN_DIRS.flatMap(walk);
const violations = allFiles.flatMap(scan);

if (violations.length === 0) {
  console.log("✅ No stale model references found.");
  process.exit(0);
}

console.log(`❌ Found ${violations.length} stale model references:\n`);
for (const v of violations) {
  console.log(`  ${v.file}:${v.line} — ${v.match}`);
  console.log(`    ${v.context}\n`);
}
process.exit(1);
