import { db } from "@/db";
import { domains } from "@/db/schema";
import { eq } from "drizzle-orm";

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
