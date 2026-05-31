import "server-only";
import { cache } from "react";
import path from "node:path";
import fs from "node:fs/promises";
import fg from "fast-glob";
import matter from "gray-matter";
import readingTime from "reading-time";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { VFile } from "vfile";
import {
  HelpFrontmatterSchema, HelpCategoryMetaSchema,
  HELP_CATEGORY_SLUGS,
  type HelpDoc, type HelpDocWithBody, type HelpCategorySummary,
  type HelpCategorySlug, type TocEntry,
} from "./types";
import { remarkExtractToc } from "./toc";

const CONTENT_ROOT = process.env.HELP_CONTENT_ROOT
  ?? path.join(process.cwd(), "content/help");

export const listAllDocs = cache(async (): Promise<HelpDoc[]> => {
  const files = await fg("*/**/*.mdx", {
    cwd: CONTENT_ROOT, absolute: true,
    ignore: ["**/changelog/**"],
  });
  const docs: HelpDoc[] = [];
  for (const filePath of files) {
    const raw = await fs.readFile(filePath, "utf-8");
    const { data } = matter(raw);
    const parsed = HelpFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `Frontmatter invalid in ${filePath}: ${JSON.stringify(parsed.error.flatten())}`,
      );
    }
    const rel = path.relative(CONTENT_ROOT, filePath);
    const [category] = rel.split(path.sep);
    if (!HELP_CATEGORY_SLUGS.includes(category as HelpCategorySlug)) {
      throw new Error(`Doc ${rel} lives under unknown category "${category}"`);
    }
    const slug = parsed.data.slug ?? path.basename(filePath, ".mdx");
    docs.push({
      category: category as HelpCategorySlug,
      slug,
      frontmatter: parsed.data,
      filePath,
    });
  }
  return docs;
});

export const listDocsByCategory = cache(async (cat: HelpCategorySlug) => {
  const all = await listAllDocs();
  return all.filter((d) => d.category === cat);
});

export const getCategoryMeta = cache(async (cat: HelpCategorySlug) => {
  const metaPath = path.join(CONTENT_ROOT, cat, "_meta.json");
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    return HelpCategoryMetaSchema.parse(JSON.parse(raw));
  } catch (e) {
    throw new Error(`_meta.json missing or invalid for ${cat}: ${(e as Error).message}`);
  }
});

export const listCategories = cache(async (): Promise<HelpCategorySummary[]> => {
  const summaries: HelpCategorySummary[] = [];
  for (const slug of HELP_CATEGORY_SLUGS) {
    const docs = await listDocsByCategory(slug);
    if (docs.length === 0) continue;                // 空分类不进首页网格,但分类页可访问
    const meta = await getCategoryMeta(slug);
    summaries.push({ slug, meta, docCount: docs.length });
  }
  return summaries;
});

export const getDocBySlug = cache(
  async (cat: HelpCategorySlug, slug: string): Promise<HelpDocWithBody | null> => {
    const docs = await listDocsByCategory(cat);
    const doc = docs.find((d) => d.slug === slug);
    if (!doc) return null;
    const raw = await fs.readFile(doc.filePath, "utf-8");
    const { content } = matter(raw);

    // 独立跑一次 remark pipeline 抽 TOC,与 <MDXRemote> 渲染解耦
    const processor = unified().use(remarkParse).use(remarkExtractToc);
    const tree = processor.parse(content);
    const file = new VFile(content);
    await processor.run(tree, file);
    const toc = (file.data.toc as TocEntry[] | undefined) ?? [];

    const rtStats = readingTime(content, { wordsPerMinute: 300 });
    const readingTimeText = `约 ${Math.max(1, Math.round(rtStats.minutes))} 分钟`;

    return { ...doc, body: content, toc, readingTime: readingTimeText };
  },
);

export const listPopularDocs = cache(async (limit = 6) => {
  const all = await listAllDocs();
  return all.filter((d) => d.frontmatter.popular).slice(0, limit);
});
