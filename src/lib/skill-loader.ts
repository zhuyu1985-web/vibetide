/**
 * Skill Loader — scans skills/ directory, parses SKILL.md files,
 * provides runtime content loading with mtime-based caching.
 *
 * This is the single source of truth for builtin skill definitions.
 * Custom/plugin skills are stored in the database.
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillCategory =
  | "perception"
  | "analysis"
  | "generation"
  | "production"
  | "management"
  | "knowledge";

export interface BuiltinSkillDef {
  slug: string;
  name: string;
  category: SkillCategory;
  description: string;
  content: string;
  version: string;
  inputSchema?: Record<string, string>;
  outputSchema?: Record<string, string>;
  runtimeConfig?: {
    type: string;
    avgLatencyMs: number;
    maxConcurrency: number;
    modelDependency?: string;
  };
  compatibleRoles?: string[];
}

interface SkillFrontmatter {
  name: string; // slug (e.g. "web_search")
  displayName?: string; // Chinese display name (e.g. "全网搜索")
  description: string;
  category?: SkillCategory;
  version?: string;
  inputSchema?: Record<string, string>;
  outputSchema?: Record<string, string>;
  runtimeConfig?: {
    type: string;
    avgLatencyMs: number;
    maxConcurrency: number;
    modelDependency?: string;
  };
  compatibleRoles?: string[];
  builtin?: boolean; // false to exclude from builtin set (e.g. page-qa-fix)
}

// ---------------------------------------------------------------------------
// Directory resolution
// ---------------------------------------------------------------------------

function getSkillsDir(): string {
  return path.join(process.cwd(), "skills");
}

// ---------------------------------------------------------------------------
// YAML frontmatter parsing
// ---------------------------------------------------------------------------

function parseFrontmatterYaml(raw: string): {
  meta: SkillFrontmatter;
  body: string;
} {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return { meta: { name: "", description: "" }, body: raw };
  }
  const meta = parseYaml(match[1]) as SkillFrontmatter;
  return { meta, body: match[2].trim() };
}

// ---------------------------------------------------------------------------
// Content cache (mtime-based)
// ---------------------------------------------------------------------------

const contentCache = new Map<string, { content: string; mtime: number }>();
const isProd = process.env.NODE_ENV === "production";

/**
 * Load the body content of a single SKILL.md file by slug.
 * In production, cached forever (files are immutable per deployment).
 * In development, checks mtime for hot-reload.
 */
export function loadSkillContent(slug: string): string | null {
  const filePath = path.join(getSkillsDir(), slug, "SKILL.md");

  const cached = contentCache.get(slug);
  if (cached && isProd) return cached.content;

  try {
    const stat = fs.statSync(filePath);
    const mtime = stat.mtimeMs;

    if (cached && cached.mtime === mtime) return cached.content;

    const raw = fs.readFileSync(filePath, "utf-8");
    const { body } = parseFrontmatterYaml(raw);
    contentCache.set(slug, { content: body, mtime });
    return body;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Full scan — returns all builtin skill definitions
// ---------------------------------------------------------------------------

let builtinSkillsCache: BuiltinSkillDef[] | null = null;

/**
 * Scan the skills/ directory and parse all SKILL.md files.
 * Returns the full BuiltinSkillDef array (replaces BUILTIN_SKILLS constant).
 */
export function getAllBuiltinSkills(): BuiltinSkillDef[] {
  if (builtinSkillsCache && isProd) return builtinSkillsCache;

  const skillsDir = getSkillsDir();
  if (!fs.existsSync(skillsDir)) return [];

  const dirs = fs.readdirSync(skillsDir).filter((d) => {
    const mdPath = path.join(skillsDir, d, "SKILL.md");
    return fs.existsSync(mdPath);
  });

  const skills: BuiltinSkillDef[] = [];

  for (const slug of dirs) {
    const filePath = path.join(skillsDir, slug, "SKILL.md");
    const stat = fs.statSync(filePath);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatterYaml(raw);

    // Skip non-builtin skills (e.g. page-qa-fix)
    if (meta.builtin === false) continue;

    // Require category for builtin skills
    if (!meta.category) continue;

    skills.push({
      slug,
      name: meta.displayName || meta.name || slug,
      category: meta.category,
      description: meta.description || "",
      content: body,
      version: meta.version || "1.0",
      inputSchema: meta.inputSchema,
      outputSchema: meta.outputSchema,
      runtimeConfig: meta.runtimeConfig,
      compatibleRoles: meta.compatibleRoles,
    });

    // Also populate content cache (reuse stat from above)
    contentCache.set(slug, { content: body, mtime: stat.mtimeMs });
  }

  builtinSkillsCache = skills;
  return skills;
}

// ---------------------------------------------------------------------------
// Derived lookups (lazy-initialized singletons)
// ---------------------------------------------------------------------------

let slugToNameMap: Map<string, string> | null = null;
let nameToSlugMap: Map<string, string> | null = null;

/** slug → Chinese display name (e.g. "web_search" → "全网搜索") */
export function getBuiltinSkillSlugToName(): Map<string, string> {
  if (slugToNameMap && isProd) return slugToNameMap;
  slugToNameMap = new Map(
    getAllBuiltinSkills().map((s) => [s.slug, s.name])
  );
  return slugToNameMap;
}

/** Chinese display name → slug (e.g. "全网搜索" → "web_search") */
export function getBuiltinSkillNameToSlug(): Map<string, string> {
  if (nameToSlugMap && isProd) return nameToSlugMap;
  nameToSlugMap = new Map(
    getAllBuiltinSkills().map((s) => [s.name, s.slug])
  );
  return nameToSlugMap;
}

/**
 * Generate a formatted skill catalog string for LLM intent recognition.
 * Groups skills by category with slug and description.
 */
export function getBuiltinSkillCatalog(): string {
  const skills = getAllBuiltinSkills();
  const byCategory = new Map<string, BuiltinSkillDef[]>();

  for (const s of skills) {
    const list = byCategory.get(s.category) || [];
    list.push(s);
    byCategory.set(s.category, list);
  }

  const categoryNames: Record<string, string> = {
    perception: "感知",
    analysis: "分析",
    generation: "生成",
    production: "制作",
    management: "管理",
    knowledge: "知识",
  };

  const lines: string[] = [];
  for (const [cat, list] of byCategory) {
    lines.push(`\n### ${categoryNames[cat] || cat}`);
    for (const s of list) {
      lines.push(`- **${s.slug}** (${s.name}): ${s.description}`);
    }
  }

  return lines.join("\n");
}

/** Get the set of all builtin skill slugs */
export function getBuiltinSkillSlugs(): Set<string> {
  return new Set(getAllBuiltinSkills().map((s) => s.slug));
}

/**
 * Invalidate all caches. Useful for development or after SKILL.md file changes.
 */
export function invalidateSkillCache(): void {
  builtinSkillsCache = null;
  slugToNameMap = null;
  nameToSlugMap = null;
  contentCache.clear();
}
