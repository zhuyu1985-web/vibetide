import "server-only";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";
import { cache } from "react";

export const FaqCategorySchema = z.object({ id: z.string(), name: z.string() });
export const FaqItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  question: z.string().min(1),
  answer: z.string().min(1),
  relatedDocs: z.array(z.string()).optional(),
  popular: z.boolean().optional(),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const FaqFileSchema = z.object({
  categories: z.array(FaqCategorySchema),
  items: z.array(FaqItemSchema),
});
export type FaqCategory = z.infer<typeof FaqCategorySchema>;
export type FaqItem = z.infer<typeof FaqItemSchema>;
export type FaqFile = z.infer<typeof FaqFileSchema>;

const FAQ_PATH = path.join(
  process.env.HELP_CONTENT_ROOT ?? path.join(process.cwd(), "content/help"),
  "faq.json",
);

export const loadFaq = cache(async (): Promise<FaqFile> => {
  const raw = await fs.readFile(FAQ_PATH, "utf-8");
  return FaqFileSchema.parse(JSON.parse(raw));
});
