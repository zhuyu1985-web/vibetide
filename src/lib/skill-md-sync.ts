/**
 * Skill / Workflow MD Sync Helpers
 *
 * Two-way sync between filesystem (skills/*.md, workflows/*.md) and database
 * (skills.content, workflow_templates.content).
 *
 * Directions:
 * - DB → File: Called from updateSkill / updateWorkflowTemplate server actions
 *   (dev only — production filesystem is read-only on Vercel).
 * - File → DB: Called from scripts/sync-skills-from-md.ts and
 *   scripts/sync-workflows-from-md.ts (bulk sync / initial seed).
 *
 * **Production filesystem note:** On Vercel, `/var/task` is read-only after
 * deploy. So `writeSkillMdBody()` is a no-op in production. In that case,
 * the DB is the single source of truth and the next deployment rebuilds from
 * the committed SKILL.md files (one-way from git → DB via sync script).
 *
 * Dev workflow:
 *   UI edit → updateSkill → DB + fs write → next page load reads DB (fresh)
 *   CLI edit → file saved → run sync-from-md.ts → DB updated
 */

import fs from "node:fs";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter preservation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a SKILL.md file into `{ frontmatter, body }`. Both include the `---`
 * delimiters on the frontmatter side. Returns empty frontmatter if none.
 */
function splitMd(raw: string): { frontmatter: string; body: string } {
  if (!raw.startsWith("---")) {
    return { frontmatter: "", body: raw };
  }
  const endIdx = raw.indexOf("---", 3);
  if (endIdx === -1) {
    return { frontmatter: "", body: raw };
  }
  const frontmatter = raw.slice(0, endIdx + 3);
  // Strip leading newline after the closing `---`
  const rest = raw.slice(endIdx + 3).replace(/^\r?\n/, "");
  return { frontmatter, body: rest };
}

/**
 * Write new body content to a SKILL.md, preserving the existing YAML
 * frontmatter. If file doesn't exist or has no frontmatter, writes body only.
 */
function writeMdBodyPreservingFrontmatter(filePath: string, newBody: string): void {
  let frontmatter = "";
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf-8");
    frontmatter = splitMd(existing).frontmatter;
  }
  const content = frontmatter ? `${frontmatter}\n\n${newBody}\n` : newBody;
  fs.writeFileSync(filePath, content, "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Directory resolution
// ─────────────────────────────────────────────────────────────────────────────

function getSkillsDir(): string {
  return path.join(process.cwd(), "skills");
}

function getWorkflowsDir(): string {
  return path.join(process.cwd(), "workflows");
}

// ─────────────────────────────────────────────────────────────────────────────
// Production guard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Is this runtime allowed to write to the skills/ or workflows/ directories?
 *
 * - Dev (localhost): yes
 * - Vercel production: no (read-only filesystem)
 *
 * Consumers MUST check this before calling writeSkillMdBody / writeWorkflowMdBody.
 */
export function isFilesystemWritable(): boolean {
  // Vercel sets VERCEL=1 in all Vercel environments
  if (process.env.VERCEL === "1") return false;
  return process.env.NODE_ENV !== "production";
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill MD Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write skill content to `skills/<slug>/SKILL.md`, preserving frontmatter.
 * No-op if filesystem is read-only (production) or slug is null/empty.
 *
 * Returns true if written, false if skipped.
 */
export function writeSkillMdBody(slug: string | null | undefined, body: string): boolean {
  if (!slug) return false;
  if (!isFilesystemWritable()) return false;

  const filePath = path.join(getSkillsDir(), slug, "SKILL.md");

  // Only write if the directory exists — never create new skill dirs via UI
  // edit. Creating new atomic skills is a file-system-first operation (git).
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) return false;

  try {
    writeMdBodyPreservingFrontmatter(filePath, body);
    return true;
  } catch (err) {
    console.error(`[skill-md-sync] failed to write ${filePath}:`, err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow MD Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write workflow content to `workflows/<slug>/SKILL.md`, preserving frontmatter.
 * Slug here corresponds to `workflow_templates.legacy_scenario_key`.
 *
 * Returns true if written, false if skipped.
 */
export function writeWorkflowMdBody(slug: string | null | undefined, body: string): boolean {
  if (!slug) return false;
  if (!isFilesystemWritable()) return false;

  const filePath = path.join(getWorkflowsDir(), slug, "SKILL.md");
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) return false;

  try {
    writeMdBodyPreservingFrontmatter(filePath, body);
    return true;
  } catch (err) {
    console.error(`[skill-md-sync] failed to write ${filePath}:`, err);
    return false;
  }
}
