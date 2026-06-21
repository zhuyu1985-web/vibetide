import { db } from "@/db";
import { domains } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { DEFAULT_DOMAINS } from "@/lib/domains-defaults";
import type { DomainRecord } from "@/lib/types";

/**
 * 领域一等维度（P1）—— 取单个领域的「口径包」。
 *
 * 装配 agent 时按 ai_employees.domain_id 取出 promptGuidance / authoritySources，
 * 注入 AssembledAgent → Layer 4.5 提示词 + web_search includeDomains。
 */
export async function getDomainById(domainId: string) {
  const [d] = await db
    .select({
      id: domains.id,
      name: domains.name,
      promptGuidance: domains.promptGuidance,
      authoritySources: domains.authoritySources,
    })
    .from(domains)
    .where(eq(domains.id, domainId));
  return d ?? null;
}

/** 列出 org 下所有领域（按 sortOrder, name）。供配置页下拉 / 字典管理 / 编排器。 */
export async function listDomainsByOrg(orgId: string): Promise<DomainRecord[]> {
  if (!orgId) return [];
  const rows = await db
    .select({
      id: domains.id,
      slug: domains.slug,
      name: domains.name,
      description: domains.description,
      promptGuidance: domains.promptGuidance,
      authoritySources: domains.authoritySources,
      sortOrder: domains.sortOrder,
    })
    .from(domains)
    .where(eq(domains.organizationId, orgId))
    .orderBy(asc(domains.sortOrder), asc(domains.name));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    promptGuidance: r.promptGuidance,
    authoritySources: (r.authoritySources as string[] | null) ?? [],
    sortOrder: r.sortOrder ?? 0,
  }));
}

/** 幂等播种默认领域（org+slug 唯一索引 → onConflictDoNothing）。返回新插入条数。 */
export async function seedDefaultDomainsForOrg(orgId: string): Promise<number> {
  if (!orgId) return 0;
  const res = await db
    .insert(domains)
    .values(
      DEFAULT_DOMAINS.map((d) => ({
        organizationId: orgId,
        slug: d.slug,
        name: d.name,
        description: d.description ?? null,
        promptGuidance: d.promptGuidance ?? null,
        authoritySources: d.authoritySources ?? [],
        sortOrder: d.sortOrder,
      })),
    )
    .onConflictDoNothing({ target: [domains.organizationId, domains.slug] })
    .returning({ id: domains.id });
  return res.length;
}

function toDomainRecord(row: typeof domains.$inferSelect): DomainRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    promptGuidance: row.promptGuidance,
    authoritySources: (row.authoritySources as string[] | null) ?? [],
    sortOrder: row.sortOrder ?? 0,
  };
}

export async function createDomain(
  orgId: string,
  input: {
    slug: string;
    name: string;
    description?: string | null;
    promptGuidance?: string | null;
    authoritySources?: string[];
    sortOrder?: number;
  },
): Promise<DomainRecord> {
  const [row] = await db
    .insert(domains)
    .values({
      organizationId: orgId,
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      promptGuidance: input.promptGuidance ?? null,
      authoritySources: input.authoritySources ?? [],
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return toDomainRecord(row);
}

export async function updateDomain(
  orgId: string,
  domainId: string,
  patch: {
    name?: string;
    description?: string | null;
    promptGuidance?: string | null;
    authoritySources?: string[];
    sortOrder?: number;
  },
): Promise<void> {
  await db
    .update(domains)
    .set(patch)
    .where(and(eq(domains.id, domainId), eq(domains.organizationId, orgId)));
}

export async function deleteDomain(orgId: string, domainId: string): Promise<void> {
  await db
    .delete(domains)
    .where(and(eq(domains.id, domainId), eq(domains.organizationId, orgId)));
}
