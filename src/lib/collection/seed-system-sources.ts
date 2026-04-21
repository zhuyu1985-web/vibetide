import { db } from "@/db";
import { collectionSources } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { TOPHUB_DEFAULT_NODES, PLATFORM_ALIASES } from "@/lib/trending-api";

/**
 * 系统源命名约定: 带 __system__ 前缀,UI 过滤时隐藏(Phase 2 暂不过滤,留给 Phase 3)
 */
export const SYSTEM_HOT_TOPIC_SOURCE_NAME = "__system_hot_topic_crawler__";

/**
 * 把 TopHub 默认节点名(中文)映射为 tophub Adapter 接受的英文别名。
 * 与 src/app/api/inspiration/crawl/route.ts 的 buildDefaultPlatforms 保持一致。
 */
function buildHotTopicPlatforms(): string[] {
  return Object.keys(TOPHUB_DEFAULT_NODES).map((chineseName) => {
    const aliases = PLATFORM_ALIASES[chineseName];
    return aliases?.[0] ?? chineseName.toLowerCase();
  });
}

/**
 * 幂等:为指定组织确保存在一个启用的系统热榜采集源。
 * - 不存在时创建
 * - 存在但被软删除时重新启用并清除 deletedAt
 * - 已存在时仅刷新 config.platforms(保证始终与最新 TOPHUB_DEFAULT_NODES 同步)
 */
export async function ensureHotTopicSystemSource(organizationId: string): Promise<string> {
  const platforms = buildHotTopicPlatforms();

  const [existing] = await db
    .select()
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, organizationId),
        eq(collectionSources.name, SYSTEM_HOT_TOPIC_SOURCE_NAME),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(collectionSources)
      .set({
        config: { platforms },
        enabled: true,
        deletedAt: null,
        updatedAt: new Date(),
        targetModules: ["hot_topics"],
        researchBridgeEnabled: true,
      })
      .where(eq(collectionSources.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(collectionSources)
    .values({
      organizationId,
      name: SYSTEM_HOT_TOPIC_SOURCE_NAME,
      sourceType: "tophub",
      config: { platforms },
      targetModules: ["hot_topics"],
      enabled: true,
      scheduleCron: "0 * * * *",
      researchBridgeEnabled: true,
    })
    .returning({ id: collectionSources.id });

  return created.id;
}
