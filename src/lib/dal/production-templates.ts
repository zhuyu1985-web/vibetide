import { db } from "@/db";
import { productionTemplates } from "@/db/schema/production-templates";
import type { TemplateStructure, TemplateVariable } from "@/db/schema/production-templates";
import { eq, desc, sql } from "drizzle-orm";

export interface ProductionTemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
  structure: TemplateStructure;
  variables: TemplateVariable[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * List all production templates, optionally filtered by category.
 */
export async function getProductionTemplates(
  orgId: string,
  category?: string
): Promise<ProductionTemplateItem[]> {
  const whereCondition = category
    ? sql`${productionTemplates.organizationId} = ${orgId} AND ${productionTemplates.category} = ${category}`
    : eq(productionTemplates.organizationId, orgId);

  const rows = await db
    .select()
    .from(productionTemplates)
    .where(whereCondition)
    .orderBy(desc(productionTemplates.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description || "",
    category: r.category || "",
    structure: (r.structure as TemplateStructure) || {
      sections: [],
      mediaTypes: [],
      targetChannels: [],
    },
    variables: (r.variables as TemplateVariable[]) || [],
    usageCount: r.usageCount || 0,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/**
 * Get a single production template by ID.
 */
export async function getProductionTemplate(
  id: string
): Promise<ProductionTemplateItem | null> {
  const rows = await db
    .select()
    .from(productionTemplates)
    .where(eq(productionTemplates.id, id))
    .limit(1);

  const row = rows[0];

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    category: row.category || "",
    structure: (row.structure as TemplateStructure) || {
      sections: [],
      mediaTypes: [],
      targetChannels: [],
    },
    variables: (row.variables as TemplateVariable[]) || [],
    usageCount: row.usageCount || 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Get template usage stats for the organization.
 */
export async function getTemplateStats(orgId: string) {
  const rows = await db
    .select({
      category: productionTemplates.category,
      count: sql<number>`count(*)::int`,
      totalUsage: sql<number>`coalesce(sum(${productionTemplates.usageCount}), 0)::int`,
    })
    .from(productionTemplates)
    .where(eq(productionTemplates.organizationId, orgId))
    .groupBy(productionTemplates.category);

  const categoryLabels: Record<string, string> = {
    news_flash: "快讯",
    interview: "访谈",
    commentary: "评论",
    feature: "特稿",
    social_post: "社交帖",
  };

  return {
    categories: rows.map((r) => ({
      category: r.category || "other",
      label: categoryLabels[r.category || ""] || "其他",
      count: r.count,
      totalUsage: r.totalUsage,
    })),
    totalTemplates: rows.reduce((sum, r) => sum + r.count, 0),
    totalUsage: rows.reduce((sum, r) => sum + r.totalUsage, 0),
  };
}
