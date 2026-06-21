"use server";

import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  createDomain,
  updateDomain,
  deleteDomain,
  seedDefaultDomainsForOrg,
} from "@/lib/dal/domains";
import { revalidatePath } from "next/cache";

async function orgOrThrow() {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");
  return orgId;
}

/** 中文名 → slug：取 ASCII 化，无 ASCII 字符时回退随机 slug。 */
function slugify(name: string): string {
  const ascii = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `domain-${Date.now().toString(36)}`;
}

export async function createDomainAction(input: {
  name: string;
  slug?: string;
  description?: string;
  promptGuidance?: string;
  authoritySources?: string[];
  sortOrder?: number;
}) {
  const orgId = await orgOrThrow();
  if (!input.name?.trim()) throw new Error("领域名称必填");
  const d = await createDomain(orgId, {
    slug: input.slug?.trim() || slugify(input.name),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    promptGuidance: input.promptGuidance?.trim() || null,
    authoritySources: input.authoritySources ?? [],
    sortOrder: input.sortOrder ?? 0,
  });
  revalidatePath("/settings/domains");
  return d;
}

export async function updateDomainAction(
  domainId: string,
  patch: {
    name?: string;
    description?: string;
    promptGuidance?: string;
    authoritySources?: string[];
    sortOrder?: number;
  },
) {
  const orgId = await orgOrThrow();
  await updateDomain(orgId, domainId, {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.description !== undefined
      ? { description: patch.description.trim() || null }
      : {}),
    ...(patch.promptGuidance !== undefined
      ? { promptGuidance: patch.promptGuidance.trim() || null }
      : {}),
    ...(patch.authoritySources !== undefined
      ? { authoritySources: patch.authoritySources }
      : {}),
    ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
  });
  revalidatePath("/settings/domains");
}

export async function deleteDomainAction(domainId: string) {
  const orgId = await orgOrThrow();
  try {
    await deleteDomain(orgId, domainId);
  } catch {
    // domain_id 被 ai_employees / workflow_templates 外键引用时 DB 抛约束错。
    throw new Error("该领域仍被员工或场景引用，无法删除");
  }
  revalidatePath("/settings/domains");
}

export async function seedDefaultDomainsAction() {
  const orgId = await orgOrThrow();
  const inserted = await seedDefaultDomainsForOrg(orgId);
  revalidatePath("/settings/domains");
  return { inserted };
}
