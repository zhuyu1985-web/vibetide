import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { cache } from "react";

const ChangelogFrontmatterSchema = z.object({
  title: z.string(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  version: z.string(),
  summary: z.string(),
});
export type ChangelogFrontmatter = z.infer<typeof ChangelogFrontmatterSchema>;

export interface ChangelogEntry {
  slug: string;
  frontmatter: ChangelogFrontmatter;
  body: string;
}

const CHANGELOG_DIR = path.join(
  process.env.HELP_CONTENT_ROOT ?? path.join(process.cwd(), "content/help"),
  "changelog",
);

export const listChangelogEntries = cache(async (): Promise<ChangelogEntry[]> => {
  let files: string[];
  try {
    files = await fs.readdir(CHANGELOG_DIR);
  } catch {
    return [];
  }
  const entries: ChangelogEntry[] = [];
  for (const f of files) {
    if (!f.endsWith(".mdx")) continue;
    const slug = f.replace(/\.mdx$/, "");
    const raw = await fs.readFile(path.join(CHANGELOG_DIR, f), "utf-8");
    const { data, content } = matter(raw);
    const fm = ChangelogFrontmatterSchema.parse(data);
    entries.push({ slug, frontmatter: fm, body: content });
  }
  return entries.sort((a, b) => b.frontmatter.publishedAt.localeCompare(a.frontmatter.publishedAt));
});
