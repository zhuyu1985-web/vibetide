import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { listDomainsByOrg } from "@/lib/dal/domains";
import { DomainsClient } from "./domains-client";

export const dynamic = "force-dynamic";

/**
 * 领域字典管理（P2，spec §6.4）。
 *
 * 运营在此维护 domains 字典 + 口径包（promptGuidance / authoritySources）——
 * 改口径包即时影响该领域所有员工实例的产出口径与 web_search 检索倾向（P1 Layer 4.5）。
 * org 级访问（非 super-admin-only）。
 */
export default async function DomainsSettingsPage() {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  const domains = orgId ? await listDomainsByOrg(orgId) : [];
  return <DomainsClient domains={domains} />;
}
