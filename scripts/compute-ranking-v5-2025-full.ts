/**
 * scripts/compute-ranking-v5-2025-full.ts
 *
 * 按指数体系 docx (2025-05-20 22:00) 重新计算 39 区县 5 维传播指数。
 * 与 compute-ranking-v5-2025.ts 区别 : 公众行为引导指数用 /tmp/activities-2025.json 实际数据
 *
 * 公众行为引导指数算法 :
 *   1) 活动数量 = sum of 5 themes 场数
 *   2) 活动主题丰富度 F = 1/Σ|p_t − 1/5|, N=5
 *   3) 活动传播速度 = total / (last_date - first_date + 1)
 *   4) 3 个二级在 39 区县间 min-max → [65, 95]
 *   5) 一级 = 数量×0.40 + 丰富度×0.30 + 速度×0.30
 *
 * 输出 :
 *   /tmp/ranking-v5-2025-full.json (含 4 媒体 tier × 3 子 + 公众 × 3 子 + 综合)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

const ORG_ENV = process.argv[2];

type TierKey = "central" | "industry" | "municipal" | "district" | "public";
const MEDIA_TIERS_FROM_DB: Record<Exclude<TierKey, "public">, string[]> = {
  central: ["central"],
  industry: ["industry"],
  municipal: ["provincial_municipal"],
  district: ["district_media", "government_self_media"],
};
const TIER_WEIGHT: Record<TierKey, number> = {
  central: 0.45, industry: 0.25, municipal: 0.15, district: 0.08, public: 0.07,
};
const SUB_WEIGHT = { count: 0.4, richness: 0.3, freq: 0.3 } as const;
const SCALE_MIN = 65;
const SCALE_MAX = 95;
const TOPIC_N = 16;
const ACTIVITY_N = 5;

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
  if (sumDev === 0) return N; // 完全均匀情形,F = 1 / 0 → 取 N 作上限
  return 1 / sumDev;
}

async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  const fs = await import("node:fs");

  const orgRows = await db.execute(sql`SELECT id, name FROM organizations LIMIT 5`);
  const orgId = ORG_ENV ?? (orgRows as any)[0].id;
  console.log(`org: ${orgId}\n`);

  // 1) 39 区县 + 16 topic + 活动 JSON
  const dRows = await db.execute(sql`SELECT id, name FROM research_cq_districts ORDER BY name`);
  const districts = (dRows as any).map((r: any) => ({ id: r.id as string, name: r.name as string }));
  const districtNames = districts.map((d: any) => d.name);

  const tRows = await db.execute(sql`
    SELECT id, name FROM research_topics
    WHERE organization_id = ${orgId} ORDER BY name
  `);
  const topics = (tRows as any).map((r: any) => ({ id: r.id as string, name: r.name as string }));

  type Activity = {
    seq: number; district: string;
    themes: Record<string, number>; total: number;
    first_date: string | null; last_date: string | null;
    span_days: number | null; freq: number | null;
  };
  const activities: Activity[] = JSON.parse(fs.readFileSync("/tmp/activities-2025.json", "utf-8"));
  const activityByDistrict = new Map<string, Activity>(activities.map((a) => [a.district, a]));

  console.log(`✓ 39 区县, 16 主题, ${activities.length} 个区县活动数据`);

  // 2) 拉数 (媒体)
  console.log(`\n拉取 2025 年 items × district × topic × tier 联表...`);
  const allMediaTiers = Object.values(MEDIA_TIERS_FROM_DB).flat();
  const t0 = Date.now();
  const rows = await db.execute(sql`
    SELECT
      ci.id AS item_id, ci.published_at AS published_at,
      mod.outlet_tier AS tier,
      icd.district_id AS district_id, ict.topic_id AS topic_id
    FROM collected_items ci
    JOIN research_collected_item_districts icd ON icd.collected_item_id = ci.id
    JOIN research_collected_item_topics ict ON ict.collected_item_id = ci.id
    JOIN media_outlet_dictionary mod ON ci.outlet_id = mod.id
    WHERE ci.organization_id = ${orgId}
      AND ci.published_at >= '2025-01-01' AND ci.published_at < '2026-01-01'
      AND mod.outlet_tier = ANY(ARRAY[${sql.join(allMediaTiers.map((t) => sql`${t}`), sql`, `)}]::text[])
  `);
  const raw = rows as any as Array<{
    item_id: string; published_at: Date; tier: string;
    district_id: string; topic_id: string;
  }>;
  console.log(`✓ 拉到 ${raw.length} 行 (耗时 ${(Date.now() - t0) / 1000}s)`);

  // 3) 聚合
  const dbTierToKey: Record<string, Exclude<TierKey, "public">> = {};
  for (const [key, arr] of Object.entries(MEDIA_TIERS_FROM_DB)) {
    for (const t of arr) dbTierToKey[t] = key as Exclude<TierKey, "public">;
  }
  const topicIdToIdx = new Map<string, number>(topics.map((t: any, i: number) => [t.id, i]));
  const topicIdxToName = new Map<number, string>(topics.map((t: any, i: number) => [i, t.name]));
  const districtIdToName = new Map<string, string>(districts.map((d: any) => [d.id, d.name]));

  type Bucket = { items: Set<string>; topicCounts: number[]; days: Set<string> };
  const empty = (): Bucket => ({ items: new Set(), topicCounts: Array(TOPIC_N).fill(0), days: new Set() });
  const buckets: Record<string, Record<Exclude<TierKey, "public">, Bucket>> = {};
  for (const name of districtNames) {
    buckets[name] = { central: empty(), industry: empty(), municipal: empty(), district: empty() };
  }

  for (const row of raw) {
    const districtName = districtIdToName.get(row.district_id);
    if (!districtName) continue;
    const tierKey = dbTierToKey[row.tier];
    if (!tierKey) continue;
    const b = buckets[districtName]![tierKey];
    b.items.add(row.item_id);
    const tIdx = topicIdToIdx.get(row.topic_id);
    if (tIdx !== undefined) b.topicCounts[tIdx] = (b.topicCounts[tIdx] ?? 0) + 1;
    const day = (row.published_at instanceof Date)
      ? row.published_at.toISOString().slice(0, 10)
      : String(row.published_at).slice(0, 10);
    b.days.add(day);
  }

  // 4) 算原始三元组
  type RawTri = { count: number; richness: number; freq: number; topicCounts?: number[]; days?: number };
  const rawMedia: Record<string, Record<Exclude<TierKey, "public">, RawTri>> = {};
  for (const name of districtNames) {
    rawMedia[name] = {} as any;
    for (const tier of ["central", "industry", "municipal", "district"] as const) {
      const b = buckets[name]![tier];
      const count = b.items.size;
      const days = b.days.size;
      const f = richnessF(b.topicCounts, TOPIC_N);
      const freq = days > 0 ? count / days : 0;
      rawMedia[name]![tier] = { count, richness: f, freq, topicCounts: [...b.topicCounts], days };
    }
  }

  // 5) 公众 raw 三元组
  const rawPublic: Record<string, RawTri & { themes?: Record<string, number>; firstDate?: string | null; lastDate?: string | null; spanDays?: number | null }> = {};
  for (const name of districtNames) {
    const a = activityByDistrict.get(name);
    if (a) {
      const themeCounts = Object.values(a.themes);
      const f = richnessF(themeCounts, ACTIVITY_N);
      rawPublic[name] = {
        count: a.total, richness: f, freq: a.freq ?? 0,
        themes: a.themes, firstDate: a.first_date, lastDate: a.last_date, spanDays: a.span_days,
      };
    } else {
      rawPublic[name] = { count: 0, richness: 0, freq: 0 };
    }
  }

  // 6) 区间化 (每个二级独立)
  const scaledMedia: Record<string, Record<Exclude<TierKey, "public">, RawTri>> = {};
  for (const name of districtNames) scaledMedia[name] = {} as any;
  for (const tier of ["central", "industry", "municipal", "district"] as const) {
    for (const key of ["count", "richness", "freq"] as const) {
      const values = districtNames.map((n: string) => rawMedia[n]![tier][key]);
      const scaled = scaleToRange(values);
      for (let i = 0; i < districtNames.length; i += 1) {
        const name = districtNames[i] as string;
        scaledMedia[name]![tier] ??= { count: 0, richness: 0, freq: 0 };
        scaledMedia[name]![tier][key] = scaled[i] as number;
      }
    }
  }
  const scaledPublic: Record<string, RawTri> = {};
  for (const key of ["count", "richness", "freq"] as const) {
    const values = districtNames.map((n: string) => rawPublic[n]![key]);
    const scaled = scaleToRange(values);
    for (let i = 0; i < districtNames.length; i += 1) {
      const name = districtNames[i] as string;
      scaledPublic[name] ??= { count: 0, richness: 0, freq: 0 };
      scaledPublic[name]![key] = scaled[i] as number;
    }
  }

  // 7) 一级 + 综合
  type Final = { central: number; industry: number; municipal: number; district: number; public: number; composite: number };
  const finals: Record<string, Final> = {};
  for (const name of districtNames) {
    const m = scaledMedia[name]!;
    const p = scaledPublic[name]!;
    const central = m.central.count * SUB_WEIGHT.count + m.central.richness * SUB_WEIGHT.richness + m.central.freq * SUB_WEIGHT.freq;
    const industry = m.industry.count * SUB_WEIGHT.count + m.industry.richness * SUB_WEIGHT.richness + m.industry.freq * SUB_WEIGHT.freq;
    const municipal = m.municipal.count * SUB_WEIGHT.count + m.municipal.richness * SUB_WEIGHT.richness + m.municipal.freq * SUB_WEIGHT.freq;
    const district = m.district.count * SUB_WEIGHT.count + m.district.richness * SUB_WEIGHT.richness + m.district.freq * SUB_WEIGHT.freq;
    const pub = p.count * SUB_WEIGHT.count + p.richness * SUB_WEIGHT.richness + p.freq * SUB_WEIGHT.freq;
    const composite = central * TIER_WEIGHT.central + industry * TIER_WEIGHT.industry + municipal * TIER_WEIGHT.municipal + district * TIER_WEIGHT.district + pub * TIER_WEIGHT.public;
    finals[name] = { central, industry, municipal, district, public: pub, composite };
  }

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

  const scores = ranked.map((r: any) => r.composite);
  const mean = scores.reduce((s: number, x: number) => s + x, 0) / scores.length;
  const sorted = [...scores].sort((a: number, b: number) => a - b);
  const median = sorted[Math.floor(scores.length / 2)] as number;
  const stdev = Math.sqrt(scores.reduce((s: number, x: number) => s + (x - mean) ** 2, 0) / scores.length);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const high = scores.filter((x: number) => x >= 80).length;
  const mid = scores.filter((x: number) => x >= 72 && x < 80).length;
  const low = scores.filter((x: number) => x < 72).length;
  console.log(`\n=== 统计 ===`);
  console.log(`  max=${max.toFixed(2)}, min=${min.toFixed(2)}, span=${(max - min).toFixed(2)}`);
  console.log(`  mean=${mean.toFixed(2)}, median=${median.toFixed(2)}, stdev=${stdev.toFixed(2)}`);
  console.log(`  tier: 高(≥80)=${high}, 中(72-80)=${mid}, 低(<72)=${low}`);

  const out = {
    org_id: orgId,
    year: 2025,
    weights: { tier: TIER_WEIGHT, sub: SUB_WEIGHT, range: [SCALE_MIN, SCALE_MAX] },
    topic_n: TOPIC_N, activity_n: ACTIVITY_N,
    topics: topics.map((t: any) => t.name),
    activity_themes: ["六五环境日", "815全国生态日", "志愿服务活动", "环保设施向公众开放", "美丽重庆六进活动"],
    raw_media: rawMedia,
    raw_public: rawPublic,
    scaled_media: scaledMedia,
    scaled_public: scaledPublic,
    finals,
    ranked,
    stats: { max, min, span: max - min, mean, median, stdev, tier_high: high, tier_mid: mid, tier_low: low },
  };
  fs.writeFileSync("/tmp/ranking-v5-2025-full.json", JSON.stringify(out, null, 2));
  console.log(`\n✓ 已写 /tmp/ranking-v5-2025-full.json`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
