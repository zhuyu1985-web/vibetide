import { db } from "@/db";
import { categories, articles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import type { CategoryNode } from "@/lib/types";

export async function getCategories(): Promise<CategoryNode[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db.query.categories.findMany({
    where: and(eq(categories.organizationId, orgId), eq(categories.isActive, true)),
    orderBy: [categories.level, categories.sortOrder],
  });

  // Count articles per category
  const allArticles = await db.query.articles.findMany({
    where: eq(articles.organizationId, orgId),
    columns: { categoryId: true },
  });

  const articleCounts = new Map<string, number>();
  for (const a of allArticles) {
    if (a.categoryId) {
      articleCounts.set(a.categoryId, (articleCounts.get(a.categoryId) || 0) + 1);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description || undefined,
    parentId: r.parentId,
    sortOrder: r.sortOrder,
    articleCount: articleCounts.get(r.id) || 0,
  }));
}

export async function getCategoryTree(): Promise<CategoryNode[]> {
  const flat = await getCategories();

  const map = new Map<string, CategoryNode>();
  for (const cat of flat) {
    map.set(cat.id, { ...cat, children: [] });
  }

  const roots: CategoryNode[] = [];
  for (const cat of map.values()) {
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children!.push(cat);
    } else {
      roots.push(cat);
    }
  }

  return roots;
}

export async function getCategory(id: string): Promise<CategoryNode | undefined> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return undefined;

  const row = await db.query.categories.findFirst({
    where: and(eq(categories.id, id), eq(categories.organizationId, orgId)),
  });

  if (!row) return undefined;

  const allArticles = await db.query.articles.findMany({
    where: and(eq(articles.categoryId, id), eq(articles.organizationId, orgId)),
    columns: { id: true },
  });

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || undefined,
    parentId: row.parentId,
    sortOrder: row.sortOrder,
    articleCount: allArticles.length,
  };
}
