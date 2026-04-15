// src/db/seed/research/research-topics.ts
import { db } from "@/db";
import {
  researchTopics,
  researchTopicKeywords,
} from "@/db/schema/research/research-topics";
import { organizations } from "@/db/schema/users";
import { eq, and } from "drizzle-orm";

// 16 组主题：[共词, [近似称谓...]]
const TOPICS: Array<[string, string[]]> = [
  ["美丽中国", ["美丽中国建设", "生态宜居"]],
  ["综合治理", ["生态保护", "生态修复", "生态环境综合治理", "系统治理", "环境治理"]],
  ["绿色发展", ["绿色低碳", "低碳发展", "绿色转型", "零碳蓝碳"]],
  ["双碳", ["碳达峰碳中和", "降污减碳", "碳交易"]],
  ["和谐共生", ["地球生命共同体", "绿色丝绸之路"]],
  ["长江生态", ["长江经济带生态保护", "长江经济带", "长江大保护", "长江共抓大保护"]],
  ["绿水青山", ["绿水青山就是金山银山", "两山"]],
  ["制度建设", ["生态文明制度", "生态文明建设", "生态文明体制改革"]],
  ["资源节约", ["资源节约集约利用", "资源可循环"]],
  ["污染防治攻坚战", ["蓝天", "碧水", "净土保卫战"]],
  ["清洁能源", ["能源消费革命", "新型能源体系", "无废城市"]],
  ["国家公园", ["国家森林公园"]],
  ["环保督察", ["中央生态环境保护督察"]],
  ["生物多样性", ["生物多样性保护"]],
  ["生态红线", ["生态保护红线"]],
  ["低碳经济", ["绿色生活", "低碳消费"]],
];

/**
 * Resolve seed organization id — prefer explicit env var, fall back to first
 * organization in the DB (per user's decision to use dynamic lookup).
 */
async function resolveSeedOrgId(): Promise<string> {
  if (process.env.SEED_ORG_ID) return process.env.SEED_ORG_ID;
  const orgs = await db.select({ id: organizations.id }).from(organizations).limit(1);
  if (orgs.length === 0) {
    throw new Error(
      "No organization found in DB. Create one before seeding research topics.",
    );
  }
  return orgs[0].id;
}

export async function seedResearchTopics() {
  const orgId = await resolveSeedOrgId();

  for (let i = 0; i < TOPICS.length; i++) {
    const [name, aliases] = TOPICS[i];

    // Upsert topic (idempotent on org + name)
    const existing = await db.select().from(researchTopics)
      .where(and(eq(researchTopics.organizationId, orgId), eq(researchTopics.name, name)))
      .limit(1);

    let topicId: string;
    if (existing.length > 0) {
      topicId = existing[0].id;
    } else {
      const inserted = await db.insert(researchTopics).values({
        organizationId: orgId,
        name,
        sortOrder: i,
        isPreset: true,
      }).returning({ id: researchTopics.id });
      topicId = inserted[0].id;
    }

    // 共词 + 近似称谓
    const allKw = [
      { keyword: name, isPrimary: true },
      ...aliases.map((a) => ({ keyword: a, isPrimary: false })),
    ];
    await db.insert(researchTopicKeywords)
      .values(allKw.map((k) => ({ topicId, ...k })))
      .onConflictDoNothing();
  }
  console.log(`✓ Seeded ${TOPICS.length} research topics (org=${orgId})`);
}
