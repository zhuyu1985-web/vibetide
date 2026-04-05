import JSZip from "jszip";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { SkillCategory } from "./types";

export interface ParsedSkillFile {
  fileType: "reference" | "script";
  fileName: string;
  filePath: string;
  content: string;
}

export interface ParsedSkillMeta {
  name: string; // slug or display name
  displayName?: string; // Chinese display name
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
}

export interface ParsedSkillPackage {
  name: string;
  description: string;
  content: string; // SKILL.md body (without frontmatter)
  meta: ParsedSkillMeta; // full parsed metadata
  files: ParsedSkillFile[];
}

export interface ValidationError {
  type: "missing_skill_md" | "too_many_files" | "file_too_large" | "unsafe_path";
  message: string;
  details?: string[];
}

const MAX_FILES = 20;
const MAX_ZIP_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Parse SKILL.md frontmatter. Supports both simple (name/description only)
 * and enriched (full YAML with category, schemas, etc.) formats.
 */
export function parseFrontmatter(raw: string): {
  name: string;
  description: string;
  body: string;
  meta: ParsedSkillMeta;
} {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return {
      name: "",
      description: "",
      body: raw,
      meta: { name: "", description: "" },
    };
  }

  const body = match[2].trim();

  try {
    const parsed = parseYaml(match[1]) as Record<string, unknown>;
    const meta: ParsedSkillMeta = {
      name: String(parsed.name || ""),
      displayName: parsed.displayName ? String(parsed.displayName) : undefined,
      description: String(parsed.description || ""),
      category: parsed.category as SkillCategory | undefined,
      version: parsed.version ? String(parsed.version) : undefined,
      inputSchema: parsed.inputSchema as Record<string, string> | undefined,
      outputSchema: parsed.outputSchema as Record<string, string> | undefined,
      runtimeConfig: parsed.runtimeConfig as ParsedSkillMeta["runtimeConfig"],
      compatibleRoles: parsed.compatibleRoles as string[] | undefined,
    };

    return {
      name: meta.displayName || meta.name,
      description: meta.description,
      body,
      meta,
    };
  } catch {
    // Fallback to simple regex parsing if YAML fails
    let name = "";
    let description = "";
    for (const line of match[1].split("\n")) {
      const nameMatch = line.match(/^name:\s*(.+)/);
      if (nameMatch) name = nameMatch[1].replace(/^["']|["']$/g, "").trim();
      const descMatch = line.match(/^description:\s*(.+)/);
      if (descMatch) description = descMatch[1].replace(/^["']|["']$/g, "").trim();
    }
    return { name, description, body, meta: { name, description } };
  }
}

function isUnsafePath(path: string): boolean {
  return (
    path.includes("..") ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    /[<>:"|?*]/.test(path)
  );
}

function cleanContent(text: string): string {
  // Remove BOM
  let cleaned = text.replace(/^\uFEFF/, "");
  // Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return cleaned;
}

export async function parseSkillZip(
  file: File
): Promise<{ package: ParsedSkillPackage; errors: ValidationError[] }> {
  const errors: ValidationError[] = [];

  if (file.size > MAX_ZIP_SIZE) {
    errors.push({
      type: "file_too_large",
      message: `文件大小不能超过 10MB（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）`,
    });
    return { package: { name: "", description: "", content: "", meta: { name: "", description: "" }, files: [] }, errors };
  }

  const zip = await JSZip.loadAsync(file);
  const allPaths = Object.keys(zip.files).filter(
    (p) => !zip.files[p].dir && !p.startsWith("__MACOSX") && !p.endsWith(".DS_Store")
  );

  // Detect root prefix: if all files share a single parent folder, strip it
  let prefix = "";
  const topLevelEntries = new Set(
    allPaths.map((p) => p.split("/")[0])
  );
  if (topLevelEntries.size === 1) {
    const singleDir = [...topLevelEntries][0];
    const hasSkillMdInDir = allPaths.some(
      (p) => p === `${singleDir}/SKILL.md`
    );
    if (hasSkillMdInDir) {
      prefix = singleDir + "/";
    }
  }

  // Normalize paths by stripping prefix
  const normalizedFiles = allPaths.map((p) => ({
    originalPath: p,
    relativePath: prefix ? p.slice(prefix.length) : p,
  }));

  // Check for SKILL.md
  const skillMdEntry = normalizedFiles.find(
    (f) => f.relativePath === "SKILL.md"
  );
  if (!skillMdEntry) {
    errors.push({
      type: "missing_skill_md",
      message: "技能包必须包含 SKILL.md 文件",
    });
    return { package: { name: "", description: "", content: "", meta: { name: "", description: "" }, files: [] }, errors };
  }

  // File count check
  if (normalizedFiles.length > MAX_FILES) {
    errors.push({
      type: "too_many_files",
      message: `文件数量不能超过 ${MAX_FILES} 个（当前 ${normalizedFiles.length} 个）`,
    });
    return { package: { name: "", description: "", content: "", meta: { name: "", description: "" }, files: [] }, errors };
  }

  // Path safety check
  const unsafePaths: string[] = [];
  const safeFiles = normalizedFiles.filter((f) => {
    if (isUnsafePath(f.relativePath)) {
      unsafePaths.push(f.relativePath);
      return false;
    }
    return true;
  });
  if (unsafePaths.length > 0) {
    errors.push({
      type: "unsafe_path",
      message: `已跳过 ${unsafePaths.length} 个不安全路径的文件`,
      details: unsafePaths,
    });
  }

  // Read SKILL.md
  const skillMdRaw = await zip.files[skillMdEntry.originalPath].async("string");
  const { name, description, body, meta } = parseFrontmatter(cleanContent(skillMdRaw));

  // Read other files
  const parsedFiles: ParsedSkillFile[] = [];
  for (const f of safeFiles) {
    if (f.relativePath === "SKILL.md") continue;

    const content = cleanContent(
      await zip.files[f.originalPath].async("string")
    );

    let fileType: "reference" | "script";
    if (f.relativePath.startsWith("references/")) {
      fileType = "reference";
    } else if (f.relativePath.startsWith("scripts/")) {
      fileType = "script";
    } else {
      // Files not in references/ or scripts/ go to references by default
      fileType = "reference";
    }

    const fileName = f.relativePath.split("/").pop() || f.relativePath;

    parsedFiles.push({
      fileType,
      fileName,
      filePath: f.relativePath,
      content,
    });
  }

  return {
    package: {
      name,
      description,
      content: body,
      meta,
      files: parsedFiles,
    },
    errors,
  };
}

export function generateSkillMd(
  name: string,
  description: string,
  content: string,
  meta?: Partial<ParsedSkillMeta>
): string {
  if (meta?.category) {
    // Enriched format with full metadata
    const fm: Record<string, unknown> = {
      name: meta.name || name,
      ...(meta.displayName && { displayName: meta.displayName }),
      description,
      category: meta.category,
      ...(meta.version && { version: meta.version }),
      ...(meta.inputSchema && { inputSchema: meta.inputSchema }),
      ...(meta.outputSchema && { outputSchema: meta.outputSchema }),
      ...(meta.runtimeConfig && { runtimeConfig: meta.runtimeConfig }),
      ...(meta.compatibleRoles?.length && { compatibleRoles: meta.compatibleRoles }),
    };
    return `---\n${stringifyYaml(fm).trim()}\n---\n\n${content}`;
  }
  return `---\nname: ${name}\ndescription: "${description.replace(/"/g, '\\"')}"\n---\n\n${content}`;
}
