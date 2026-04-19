/**
 * skill-consistency-check — daily Inngest cron that diff's filesystem MD
 * files (skills/*.md, workflows/*.md) against database content columns
 * (skills.content, workflow_templates.content).
 *
 * **Behavior**: detects mismatches, logs them to the structured Inngest
 * event stream, and returns a summary. Does NOT auto-merge — conflicts
 * between file and DB are resolved by the developer running:
 *   - `npx tsx scripts/sync-skills-from-md.ts`       (file → DB)
 *   - `npx tsx scripts/sync-skills-to-md.ts`         (DB → file)
 *   - `npx tsx scripts/sync-workflows-from-md.ts`    (file → DB)
 *   - `npx tsx scripts/sync-workflows-to-md.ts`      (DB → file)
 *
 * On Vercel production, the filesystem is read-only; in that case this
 * function's filesystem reads reflect the content from the last build
 * (what was committed at deploy time). Any drift means DB has been edited
 * since deploy → the team should commit the DB content back to files and
 * redeploy, or accept DB as source and mark the drift acknowledged.
 */

import fs from "node:fs";
import path from "node:path";
import { inngest } from "../client";
import { db } from "@/db";
import { skills } from "@/db/schema/skills";
import { workflowTemplates } from "@/db/schema/workflows";
import { organizations } from "@/db/schema/users";
import { and, eq, isNotNull, asc } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter stripping (duplicates skill-md-sync's splitMd logic intentionally
// to keep this file dependency-free for potential future Edge Runtime port).
// ─────────────────────────────────────────────────────────────────────────────

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw.trim();
  const endIdx = raw.indexOf("---", 3);
  if (endIdx === -1) return raw.trim();
  return raw.slice(endIdx + 3).trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DriftRecord {
  kind: "skill" | "workflow";
  slug: string;
  reason: "missing_file" | "missing_db" | "content_mismatch";
  fileChars: number;
  dbChars: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inngest function
// ─────────────────────────────────────────────────────────────────────────────

export const skillConsistencyCheck = inngest.createFunction(
  {
    id: "skill-consistency-check",
    retries: 1,
  },
  // 02:30 Asia/Shanghai daily — between CMS catalog sync (02:00) and morning
  // content workflows (06:30+), so drift alerts land in time for the editor's
  // morning review.
  { cron: "TZ=Asia/Shanghai 30 2 * * *" },
  async ({ step }) => {
    // ── Step 1: scan skills/ directory ──
    const skillDrifts = await step.run("scan-skills", async () => {
      const drifts: DriftRecord[] = [];
      const skillsDir = path.join(process.cwd(), "skills");
      if (!fs.existsSync(skillsDir)) return drifts;

      // Use oldest org as canonical source (builtin skills are identical
      // across orgs; we only need to diff file vs one DB row per slug).
      const org = await db.query.organizations.findFirst({
        orderBy: [asc(organizations.createdAt)],
      });
      if (!org) return drifts;

      const dbSkills = await db.query.skills.findMany({
        where: and(eq(skills.organizationId, org.id), isNotNull(skills.slug)),
      });
      const dbBySlug = new Map(dbSkills.map((s) => [s.slug!, s]));

      const fileDirs = fs.readdirSync(skillsDir).filter((d) => {
        const full = path.join(skillsDir, d);
        return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "SKILL.md"));
      });
      const fileSlugs = new Set(fileDirs);

      // Files present but not in DB
      for (const slug of fileSlugs) {
        const filePath = path.join(skillsDir, slug, "SKILL.md");
        const fileContent = stripFrontmatter(fs.readFileSync(filePath, "utf-8"));
        const dbRow = dbBySlug.get(slug);
        if (!dbRow) {
          drifts.push({
            kind: "skill",
            slug,
            reason: "missing_db",
            fileChars: fileContent.length,
            dbChars: 0,
          });
          continue;
        }
        const dbContent = (dbRow.content ?? "").trim();
        if (fileContent !== dbContent) {
          drifts.push({
            kind: "skill",
            slug,
            reason: "content_mismatch",
            fileChars: fileContent.length,
            dbChars: dbContent.length,
          });
        }
      }

      // DB entries present but no file (only flag if slug looks like builtin)
      for (const [slug, dbRow] of dbBySlug) {
        if (!fileSlugs.has(slug) && dbRow.type === "builtin") {
          drifts.push({
            kind: "skill",
            slug,
            reason: "missing_file",
            fileChars: 0,
            dbChars: (dbRow.content ?? "").length,
          });
        }
      }

      return drifts;
    });

    // ── Step 2: scan workflows/ directory ──
    const workflowDrifts = await step.run("scan-workflows", async () => {
      const drifts: DriftRecord[] = [];
      const workflowsDir = path.join(process.cwd(), "workflows");
      if (!fs.existsSync(workflowsDir)) return drifts;

      const org = await db.query.organizations.findFirst({
        orderBy: [asc(organizations.createdAt)],
      });
      if (!org) return drifts;

      const dbWorkflows = await db.query.workflowTemplates.findMany({
        where: and(
          eq(workflowTemplates.organizationId, org.id),
          isNotNull(workflowTemplates.legacyScenarioKey),
        ),
      });
      const dbBySlug = new Map(
        dbWorkflows.map((w) => [w.legacyScenarioKey!, w] as const),
      );

      const fileDirs = fs.readdirSync(workflowsDir).filter((d) => {
        const full = path.join(workflowsDir, d);
        return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "SKILL.md"));
      });
      const fileSlugs = new Set(fileDirs);

      for (const slug of fileSlugs) {
        const filePath = path.join(workflowsDir, slug, "SKILL.md");
        const fileContent = stripFrontmatter(fs.readFileSync(filePath, "utf-8"));
        const dbRow = dbBySlug.get(slug);
        if (!dbRow) {
          drifts.push({
            kind: "workflow",
            slug,
            reason: "missing_db",
            fileChars: fileContent.length,
            dbChars: 0,
          });
          continue;
        }
        const dbContent = (dbRow.content ?? "").trim();
        if (fileContent !== dbContent) {
          drifts.push({
            kind: "workflow",
            slug,
            reason: "content_mismatch",
            fileChars: fileContent.length,
            dbChars: dbContent.length,
          });
        }
      }

      for (const [slug, dbRow] of dbBySlug) {
        if (!fileSlugs.has(slug) && dbRow.isBuiltin) {
          drifts.push({
            kind: "workflow",
            slug,
            reason: "missing_file",
            fileChars: 0,
            dbChars: (dbRow.content ?? "").length,
          });
        }
      }

      return drifts;
    });

    const totalDrifts = skillDrifts.length + workflowDrifts.length;

    // ── Step 3: log summary as structured event ──
    await step.run("log-summary", async () => {
      if (totalDrifts === 0) {
        console.log("[skill-consistency-check] ✓ All files ↔ DB in sync");
        return;
      }
      console.warn(
        `[skill-consistency-check] ⚠️ ${totalDrifts} drift(s) detected:`,
      );
      for (const d of [...skillDrifts, ...workflowDrifts]) {
        console.warn(
          `  ${d.kind}:${d.slug} — ${d.reason} (file: ${d.fileChars} chars, db: ${d.dbChars} chars)`,
        );
      }
    });

    return {
      driftCount: totalDrifts,
      skillDrifts: skillDrifts.length,
      workflowDrifts: workflowDrifts.length,
      drifts: [...skillDrifts, ...workflowDrifts],
    };
  },
);
