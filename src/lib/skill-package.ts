import JSZip from "jszip";

export interface ParsedSkillFile {
  fileType: "reference" | "script";
  fileName: string;
  filePath: string;
  content: string;
}

export interface ParsedSkillPackage {
  name: string;
  description: string;
  content: string; // SKILL.md body (without frontmatter)
  files: ParsedSkillFile[];
}

export interface ValidationError {
  type: "missing_skill_md" | "too_many_files" | "file_too_large" | "unsafe_path";
  message: string;
  details?: string[];
}

const MAX_FILES = 20;
const MAX_ZIP_SIZE = 10 * 1024 * 1024; // 10MB

export function parseFrontmatter(raw: string): {
  name: string;
  description: string;
  body: string;
} {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return { name: "", description: "", body: raw };
  }

  const frontmatter = match[1];
  const body = match[2];

  let name = "";
  let description = "";

  for (const line of frontmatter.split("\n")) {
    const nameMatch = line.match(/^name:\s*(.+)/);
    if (nameMatch) {
      name = nameMatch[1].replace(/^["']|["']$/g, "").trim();
    }
    const descMatch = line.match(/^description:\s*(.+)/);
    if (descMatch) {
      description = descMatch[1].replace(/^["']|["']$/g, "").trim();
    }
  }

  return { name, description, body: body.trim() };
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
    return { package: { name: "", description: "", content: "", files: [] }, errors };
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
    return { package: { name: "", description: "", content: "", files: [] }, errors };
  }

  // File count check
  if (normalizedFiles.length > MAX_FILES) {
    errors.push({
      type: "too_many_files",
      message: `文件数量不能超过 ${MAX_FILES} 个（当前 ${normalizedFiles.length} 个）`,
    });
    return { package: { name: "", description: "", content: "", files: [] }, errors };
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
  const { name, description, body } = parseFrontmatter(cleanContent(skillMdRaw));

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
      files: parsedFiles,
    },
    errors,
  };
}

export function generateSkillMd(
  name: string,
  description: string,
  content: string
): string {
  return `---\nname: ${name}\ndescription: "${description.replace(/"/g, '\\"')}"\n---\n\n${content}`;
}
