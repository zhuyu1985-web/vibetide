/**
 * scripts/compute-ranking-v5-2025.ts
 *
 * 按指数体系 docx (2025-05-20 22:00) 重新计算 39 区县 5 维传播指数。
 *
 * 权重 :
 *   一级 : 中央 45% / 行业 25% / 市级 15% / 区县 8% / 公众 7%
 *   二级 : 报道数量 40% / 主题丰富度 30% / 传播速度 30%
 *
 * 一级 → tier 映射 :
 *   中央 = tier='central'
 *   行业 = tier='industry'
 *   市级 = tier='provincial_municipal'
 *   区县 = tier='district_media' ∪ tier='government_self_media'
 *   公众 = 全 39 区县固定 80 分占位 (体系 docx 已声明 2025 数据待生态环境局上报)
 *
 * 数据 :
 *   collected_items × research_collected_item_districts × research_collected_item_topics × media_outlet_dictionary
 *   时间窗 : published_at ∈ [2025-01-01, 2026-01-01)
 *
 * 数据处理 :
 *   1) 报道数量 : COUNT(DISTINCT item_id) per (district, tier)
 *   2) 主题丰富度 F = 1/Σ|p_t − 1/N|, N=16 ; p_t 为某主题占该 (district, tier) 报道数的比例
 *   3) 传播速度 = COUNT / 发布天数 (有发布的不同 published_at 日期个数)
 *   4) 三个二级指标各自在 39 区县间做 min-max → [65, 95]
 *   5) 一级 = 数量×0.40 + 丰富度×0.30 + 速度×0.30 (不再二次区间化)
 *   6) 综合 = 中央×0.45 + 行业×0.25 + 市级×0.15 + 区县×0.08 + 公众×0.07
 *
 * 输出 :
 *   - /tmp/ranking-v5-2025-from-db.json  (39 区县完整明细)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

const ORG_ENV = process.argv[2];

type TierKey = "central" | "industry" | "municipal" | "district" | "public";
const TIERS_FROM_DB: Record<Exclude<TierKey, "public">, string[]> = {
  central: ["central"],
  industry: ["industry"],
  municipal: ["provincial_municipal"],
  district: ["district_media", "government_self_media"],
};
const TIER_WEIGHT: Record<TierKey, number> = {
  central: 0.45,
  industry: 0.25,
  municipal: 0.15,
  district: 0.08,
  public: 0.07,
};
const SUB_WEIGHT = { count: 0.4, richness: 0.3, freq: 0.3 } as const;
const SCALE_MIN = 65;
const SCALE_MAX = 95;
const TOPIC_N = 16;

function scaleToRange(values: number[]): number[] {
  if (values.length === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi === lo) return values.map(() => (SCALE_MIN + SCALE_MAX) / 2);
  return values.map((v) => SCALE_MIN + ((v - lo) / (hi - lo)) * (SCALE_MAX - SCALE_MIN));
}

function richnessF(counts: number[], N: number): number {
  const total = counts.reduce((s, x) => s + x, 0);
  if (total === 0) return 0;
  let sumDev = 0;
  for (let i = 0; i < N; i += 1) {
    const p = (counts[i] ?? 0) / total;
    sumDev += Math.abs(p - 1 / N);
  }
  // 兜底:若全 0 → 0
  if (sumDev === 0) return Number.POSITIVE_INFINITY;
  return 1 / sumDev;
}

async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  const fs = await import("node:fs");

  const orgRows = await db.execute(sql`SELECT id, name FROM organizations LIMIT 5`);
  if ((orgRows as any).length === 0) { console.error("无 org"); process.exit(1); }
  const orgId = ORG_ENV ?? (orgRows as any)[0].id;
  console.log(`org: ${orgId}\n`);

  // 1) 39 区县 + 16 topic
  const dRows = await db.execute(sql`SELECT id, name FROM research_cq_districts ORDER BY name`);
  const districts = (dRows as any).map((r: any) => ({ id: r.id as string, name: r.name as string }));
  const districtNames = districts.map((d: any) => d.name);
  console.log(`✓ 39 区县: ${districts.length}`);

  const tRows = await db.execute(sql`
    SELECT id, name FROM research_topics
    WHERE organization_id = ${orgId} ORDER BY name
  `);
  const topics = (tRows as any).map((r: any) => ({ id: r.id as string, name: r.name as string }));
  console.log(`✓ 16 主题: ${topics.length} (期望 16)`);

  // 2) 拉数:每篇 item 的 (district_id, tier, topic_id, item_id, published_at)
  console.log(`\n拉取 2025 年 items × district × topic × tier 联表...`);
  const allTiers = Object.values(TIERS_FROM_DB).flat();
  const t0 = Date.now();
  const rows = await db.execute(sql`
    SELECT
      ci.id AS item_id,
      ci.published_at AS published_at,
      mod.outlet_tier AS tier,
      icd.district_id AS district_id,
      ict.topic_id AS topic_id
    FROM collected_items ci
    JOIN research_collected_item_districts icd ON icd.collected_item_id = ci.id
    JOIN research_collected_item_topics ict ON ict.collected_item_id = ci.id
    JOIN media_outlet_dictionary mod ON ci.outlet_id = mod.id
    WHERE ci.organization_id = ${orgId}
      AND ci.published_at >= '2025-01-01'
      AND ci.published_at < '2026-01-01'
      AND mod.outlet_tier = ANY(ARRAY[${sql.join(allTiers.map((t) => sql`${t}`), sql`, `)}]::text[])
  `);
  const raw = rows as any as Array<{
    item_id: string; published_at: Date; tier: string;
    district_id: string; topic_id: string;
  }>;
  console.log(`✓ 拉到 ${raw.length} 行 (district × topic 笛卡尔积; 耗时 ${(Date.now() - t0) / 1000}s)`);

  // 3) 聚合
  // 把 outlet_tier (5 个值) 映射到 5 个一级 key
  const dbTierToKey: Record<string, Exclude<TierKey, "public">> = {};
  for (const [key, arr] of Object.entries(TIERS_FROM_DB)) {
    for (const t of arr) dbTierToKey[t] = key as Exclude<TierKey, "public">;
  }

  const topicIdToIdx = new Map<string, number>(topics.map((t: any, i: number) => [t.id, i]));
  const districtIdToName = new Map<string, string>(districts.map((d: any) => [d.id, d.name]));

  // bucket: districtName → tierKey → { items: Set, topicCounts: number[N], days: Set }
  type Bucket = { items: Set<string>; topicCounts: number[]; days: Set<string> };
  const empty = (): Bucket => ({ items: new Set(), topicCounts: Array(TOPIC_N).fill(0), days: new Set() });
  const buckets: Record<string, Record<Exclude<TierKey, "public">, Bucket>> = {};
  for (const name of districtNames) {
    buckets[name] = {
      central: empty(), industry: empty(), municipal: empty(), district: empty(),
    };
  }

  for (const row of raw) {
    const districtName = districtIdToName.get(row.district_id);
    if (!districtName) continue;
    const tierKey = dbTierToKey[row.tier];
    if (!tierKey) continue;
    const b = buckets[districtName]?.[tierKey];
    if (!b) continue;

    b.items.add(row.item_id);
    // topic count : 同一 item 的多个 topic_id 行都会进来,这里要按 (item,topic) 去重不重要 ; 因为 annotation 唯一约束已保证
    const tIdx = topicIdToIdx.get(row.topic_id);
    if (tIdx !== undefined) b.topicCounts[tIdx] = (b.topicCounts[tIdx] ?? 0) + 1;

    const day = (row.published_at instanceof Date)
      ? row.published_at.toISOString().slice(0, 10)
      : String(row.published_at).slice(0, 10);
    b.days.add(day);
  }

  // 4) 算每个 (district, tier) 的三项二级原始值
  type RawTri = { count: number; richness: number; freq: number };
  const rawTri: Record<string, Record<Exclude<TierKey, "public">, RawTri>> = {};
  for (const name of districtNames) {
    rawTri[name] = {} as any;
    for (const tier of ["central", "industry", "municipal", "district"] as const) {
      const b = buckets[name]![tier];
      const count = b.items.size;
      const days = b.days.size;
      const f = richnessF(b.topicCounts, TOPIC_N);
      // 若 richness 是 +Inf (全部 16 类均匀) 给一个上限,工程上极少发生
      const safeF = Number.isFinite(f) ? f : 16;
      const freq = days > 0 ? count / days : 0;
      rawTri[name]![tier] = { count, richness: safeF, freq };
    }
  }

  // 5) 区间化:每个二级在 39 区县间独立 min-max
  const scaledTri: Record<string, Record<Exclude<TierKey, "public">, RawTri>> = {};
  for (const name of districtNames) scaledTri[name] = {} as any;
  for (const tier of ["central", "industry", "municipal", "district"] as const) {
    for (const key of ["count", "richness", "freq"] as const) {
      const values = districtNames.map((n: string) => rawTri[n]![tier][key]);
      const scaled = scaleToRange(values);
      for (let i = 0; i < districtNames.length; i += 1) {
        const name = districtNames[i] as string;
        scaledTri[name]![tier] ??= { count: 0, richness: 0, freq: 0 };
        scaledTri[name]![tier][key] = scaled[i] as number;
      }
    }
  }

  // 6) 一级 = 数量×0.40 + 丰富度×0.30 + 速度×0.30
  type Final = {
    central: number; industry: number; municipal: number; district: number; public: number;
    composite: number;
  };
  const finals: Record<string, Final> = {};
  for (const name of districtNames) {
    const t = scaledTri[name]!;
    const central = t.central.count * SUB_WEIGHT.count + t.central.richness * SUB_WEIGHT.richness + t.central.freq * SUB_WEIGHT.freq;
    const industry = t.industry.count * SUB_WEIGHT.count + t.industry.richness * SUB_WEIGHT.richness + t.industry.freq * SUB_WEIGHT.freq;
    const municipal = t.municipal.count * SUB_WEIGHT.count + t.municipal.richness * SUB_WEIGHT.richness + t.municipal.freq * SUB_WEIGHT.freq;
    const district = t.district.count * SUB_WEIGHT.count + t.district.richness * SUB_WEIGHT.richness + t.district.freq * SUB_WEIGHT.freq;
    const pub = 80; // 公众占位
    const composite = central * TIER_WEIGHT.central + industry * TIER_WEIGHT.industry + municipal * TIER_WEIGHT.municipal + district * TIER_WEIGHT.district + pub * TIER_WEIGHT.public;
    finals[name] = { central, industry, municipal, district, public: pub, composite };
  }

  // 7) 输出
  const ranked = districtNames
    .map((name: string) => ({ name, ...finals[name] as Final }))
    .sort((a: any, b: any) => b.composite - a.composite)
    .map((r: any, i: number) => ({ rank: i + 1, ...r }));

  console.log(`\n=== Top 10 ===`);
  for (const r of ranked.slice(0, 10)) {
    console.log(`  ${r.rank.toString().padStart(2)} ${r.name.padEnd(8)} 央=${r.central.toFixed(2)} 业=${r.industry.toFixed(2)} 市=${r.municipal.toFixed(2)} 区=${r.district.toFixed(2)} 公=${r.public.toFixed(2)} → ${r.composite.toFixed(2)}`);
  }
  console.log(`\n=== Bottom 5 ===`);
  for (const r of ranked.slice(-5)) {
    console.log(`  ${r.rank.toString().padStart(2)} ${r.name.padEnd(8)} 央=${r.central.toFixed(2)} 业=${r.industry.toFixed(2)} 市=${r.municipal.toFixed(2)} 区=${r.district.toFixed(2)} 公=${r.public.toFixed(2)} → ${r.composite.toFixed(2)}`);
  }

  // 统计
  const scores = ranked.map((r: any) => r.composite);
  const mean = scores.reduce((s: number, x: number) => s + x, 0) / scores.length;
  const sorted = [...scores].sort((a: number, b: number) => a - b);
  const median = sorted[Math.floor(scores.length / 2)] as number;
  const variance = scores.reduce((s: number, x: number) => s + (x - mean) ** 2, 0) / scores.length;
  const stdev = Math.sqrt(variance);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  console.log(`\n=== 统计 ===`);
  console.log(`  max=${max.toFixed(2)}, min=${min.toFixed(2)}, span=${(max - min).toFixed(2)}`);
  console.log(`  mean=${mean.toFixed(2)}, median=${median.toFixed(2)}, stdev=${stdev.toFixed(2)}`);
  const high = scores.filter((x: number) => x >= 80).length;
  const mid = scores.filter((x: number) => x >= 72 && x < 80).length;
  const low = scores.filter((x: number) => x < 72).length;
  console.log(`  tier: 高(≥80)=${high}, 中(72-80)=${mid}, 低(<72)=${low}`);

  // 把全部细节写到 JSON
  const out = {
    org_id: orgId,
    year: 2025,
    weights: { tier: TIER_WEIGHT, sub: SUB_WEIGHT, range: [SCALE_MIN, SCALE_MAX] },
    topic_n: TOPIC_N,
    topics: topics.map((t: any) => t.name),
    raw: rawTri,
    scaled: scaledTri,
    finals,
    ranked,
    stats: { max, min, span: max - min, mean, median, stdev, tier_high: high, tier_mid: mid, tier_low: low },
  };
  fs.writeFileSync("/tmp/ranking-v5-2025-from-db.json", JSON.stringify(out, null, 2));
  console.log(`\n✓ 已写 /tmp/ranking-v5-2025-from-db.json`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
