import { z } from "zod";

export const HELP_CATEGORY_SLUGS = [
  "getting-started", "ai-employees", "workflows", "creation",
  "data-collection", "media-assets", "channels", "admin",
] as const;
export type HelpCategorySlug = (typeof HELP_CATEGORY_SLUGS)[number];

export const HelpFrontmatterSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(200),
  slug: z.string().optional(),
  category: z.enum(HELP_CATEGORY_SLUGS),
  group: z.string().optional(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  authors: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  popular: z.boolean().optional(),
  order: z.number().int().optional(),
  toc: z.boolean().default(true),
});
export type HelpFrontmatter = z.infer<typeof HelpFrontmatterSchema>;

export const HelpCategoryMetaSchema = z.object({
  title: z.string(),
  description: z.string(),
  icon: z.string(),                                 // Lucide icon name
  groups: z.array(z.object({
    title: z.string(),
    docs: z.array(z.string()),                      // 文件 slug,顺序即排序
  })),
});
export type HelpCategoryMeta = z.infer<typeof HelpCategoryMetaSchema>;

export interface TocEntry { depth: 2 | 3; text: string; id: string; }

export interface HelpDoc {
  category: HelpCategorySlug;
  slug: string;
  frontmatter: HelpFrontmatter;
  filePath: string;
}

export interface HelpDocWithBody extends HelpDoc {
  body: string;                                     // 原始 MDX 内容(不含 frontmatter)
  toc: TocEntry[];
  readingTime: string;                              // "约 5 分钟"
}

export interface HelpCategorySummary {
  slug: HelpCategorySlug;
  meta: HelpCategoryMeta;
  docCount: number;
}
