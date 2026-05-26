/**
 * scripts/compute-ranking-scope.ts
 *
 * 基于 /tmp/media-scope-final.json (94 家媒体) 严格收敛后重算 5 维 × 3 子 = 15 指标
 *
 * 与 compute-ranking-v5-2025-full.ts 的差别 :
 *   1) 不再按 outlet_tier 全集筛 outlet,而是用 scope 内 94 个单位反查匹配到的 outlet_id 白名单
 *   2) 江北/渝北区县融媒 + 江北区生态环境局 → 归并到两江新区
 *   3) 政务号(government_self_media)字典 PA 全空,实际匹配不到 items, 全部计为 0 (用户已确认)
 *   4) 公众类仍用 /tmp/activities-2025.json 真实数据
 *
 * 输出 :
 *   /tmp/ranking-v5-2025-scope.json  含 ranked + raw_media + scaled_media + raw_public + ...
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
import { readFileSync, writeFileSync } from "node:fs";

type TierKey = "central" | "industry" | "municipal" | "district" | "public";
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
  if (sumDev === 0) return N;
  return 1 / sumDev;
}

type Unit = {
  id: string; name: string; tier: string;
  district_normalized?: string;
  websites: string[]; wechat_names: string[];
  wechat_ghid: string | null; weibo_uid: string | null;
  xlsx_row?: number;
};
type Scope = {
  main_media_12: Unit[];
  district_rmt_41: Unit[];
  district_gov_41: Unit[];
};

async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");

  const scope: Scope = JSON.parse(readFileSync("/tmp/media-scope-final.json", "utf-8"));
  const orgRows = await db.execute(sql`SELECT id FROM organizations LIMIT 1`);
  const orgId = (orgRows as any)[0].id;
  console.log(`org: ${orgId}\n`);

  // 1) 39 标准区县 + 16 主题
  const dRows = await db.execute(sql`SELECT id, name FROM research_cq_districts ORDER BY name`);
  const districts = (dRows as any).map((r: any) => ({ id: r.id as string, name: r.name as string }));
  const districtNames: string[] = districts.map((d: any) => d.name);
  const tRows = await db.execute(sql`
    SELECT id, name FROM research_topics WHERE organization_id = ${orgId} ORDER BY name
  `);
  const topics = (tRows as any).map((r: any) => ({ id: r.id as string, name: r.name as string }));
  console.log(`✓ 39 区县, 16 主题`);

  // 2) 加载活动数据
  const activities = JSON.parse(readFileSync("/tmp/activities-2025.json", "utf-8")) as Array<{
    district: string; themes: Record<string, number>; total: number;
    first_date: string | null; last_date: string | null;
    span_days: number | null; freq: number | null;
  }>;
  const activityByDistrict = new Map(activities.map(a => [a.district, a]));
  console.log(`✓ 加载活动数据 ${activities.length} 个区县`);

  // 3) 把 94 个 unit 归并到 4 个一级 tier
  type TierFor = Exclude<TierKey, "public">;
  const allUnits: Array<Unit & { tierKey: TierFor }> = [];
  for (const u of scope.main_media_12) allUnits.push({ ...u, tierKey: u.tier as TierFor });
  for (const u of scope.district_rmt_41) allUnits.push({ ...u, tierKey: "district" });
  for (const u of scope.district_gov_41) allUnits.push({ ...u, tierKey: "district" });

  // 4) Unit ↔ outlet_id 匹配 (同 coverage-dryrun.ts 逻辑)
  const dictRows = await db.execute(sql`
    SELECT id, outlet_name, outlet_tier, public_account_names, domains
    FROM media_outlet_dictionary WHERE organization_id = ${orgId}
  `);
  const dicts = (dictRows as any).map((r: any) => ({
    id: r.id as string, outlet_name: r.outlet_name as string,
    outlet_tier: r.outlet_tier as string | null,
    public_account_names: (r.public_account_names ?? []) as string[],
    domains: (r.domains ?? []) as string[],
  }));

  const outletToUnit = new Map<string, { unit: Unit & { tierKey: TierFor } }>();
  for (const u of allUnits) {
    for (const d of dicts) {
      let matched = false;
      // 公众号名匹配
      const dictPAs: string[] = (d.public_account_names ?? []).map((x: string) => x.trim());
      for (const wn of u.wechat_names) {
        if (dictPAs.includes(wn) || dictPAs.some((p: string) => p === wn || (wn && p.includes(wn)) || (p && wn.includes(p)))) {
          matched = true; break;
        }
      }
      // 域名匹配
      if (!matched && u.websites.length > 0) {
        const dictDomains: string[] = (d.domains ?? []).map((x: string) => x.toLowerCase());
        for (const ww of u.websites) {
          const w = ww.replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase();
          if (w && (dictDomains.includes(w) || dictDomains.some((dd: string) => dd.includes(w) || w.includes(dd)))) {
            matched = true; break;
          }
        }
      }
      // outletName 模糊匹配
      if (!matched && u.name && d.outlet_name) {
        const oname = d.outlet_name;
        if (oname === u.name || oname.includes(u.name) || u.name.includes(oname)) matched = true;
        else for (const wn of u.wechat_names) {
          if (wn && oname && (oname.includes(wn) || wn.includes(oname))) { matched = true; break; }
        }
      }
      if (matched) outletToUnit.set(d.id, { unit: u });
    }
  }
  console.log(`✓ outlet_id → unit 映射建立: ${outletToUnit.size} 个 outlet`);

  // 5) 拉数 (限定 outlet_id 白名单)
  const whitelist = Array.from(outletToUnit.keys());
  console.log(`\n拉取 2025 年 items × district × topic (限定 ${whitelist.length} 个 outlet)...`);
  const rows = await db.execute(sql`
    SELECT
      ci.id AS item_id, ci.published_at AS published_at,
      ci.outlet_id AS outlet_id,
      icd.district_id AS district_id, ict.topic_id AS topic_id
    FROM collected_items ci
    JOIN research_collected_item_districts icd ON icd.collected_item_id = ci.id
    JOIN research_collected_item_topics ict ON ict.collected_item_id = ci.id
    WHERE ci.organization_id = ${orgId}
      AND ci.published_at >= '2025-01-01' AND ci.published_at < '2026-01-01'
      AND ci.outlet_id IS NOT NULL
      AND ci.outlet_id = ANY(ARRAY[${sql.join(whitelist.map(id => sql`${id}::uuid`), sql`, `)}]::uuid[])
  `);
  const raw = rows as any as Array<{
    item_id: string; published_at: Date; outlet_id: string;
    district_id: string; topic_id: string;
  }>;
  console.log(`✓ 拉到 ${raw.length} 行 (district × topic 笛卡尔积)`);

  // 6) 聚合 — 按 (district, tier) 分桶
  const topicIdToIdx = new Map<string, number>(topics.map((t: any, i: number) => [t.id, i]));
  const districtIdToName = new Map<string, string>(districts.map((d: any) => [d.id, d.name]));
  // 江北/渝北的归并
  function normalizeDistrict(name: string): string {
    if (name === "江北区" || name === "渝北区") return "两江新区";
    return name;
  }

  type Bucket = { items: Set<string>; topicCounts: number[]; days: Set<string> };
  const empty = (): Bucket => ({ items: new Set(), topicCounts: Array(TOPIC_N).fill(0), days: new Set() });
  const buckets: Record<string, Record<TierFor, Bucket>> = {};
  for (const name of districtNames) {
    buckets[name] = { central: empty(), industry: empty(), municipal: empty(), district: empty() };
  }
  for (const row of raw) {
    const u = outletToUnit.get(row.outlet_id);
    if (!u) continue;
    const tierKey = u.unit.tierKey;
    const rawDistrict = districtIdToName.get(row.district_id);
    if (!rawDistrict) continue;
    const districtNorm = normalizeDistrict(rawDistrict);
    const b = buckets[districtNorm]?.[tierKey];
    if (!b) continue;
    b.items.add(row.item_id);
    const tIdx = topicIdToIdx.get(row.topic_id);
    if (tIdx !== undefined) b.topicCounts[tIdx] = (b.topicCounts[tIdx] ?? 0) + 1;
    const day = (row.published_at instanceof Date)
      ? row.published_at.toISOString().slice(0, 10)
      : String(row.published_at).slice(0, 10);
    b.days.add(day);
  }

  // 7) 媒体类原始三元组
  type RawTri = { count: number; richness: number; freq: number; topicCounts?: number[]; days?: number };
  const rawMedia: Record<string, Record<TierFor, RawTri>> = {};
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

  // 8) 公众类
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

  // 9) 区间化
  const scaledMedia: Record<string, Record<TierFor, RawTri>> = {};
  for (const name of districtNames) scaledMedia[name] = {} as any;
  for (const tier of ["central", "industry", "municipal", "district"] as const) {
    for (const key of ["count", "richness", "freq"] as const) {
      const values = districtNames.map(n => rawMedia[n]![tier][key]);
      const scaled = scaleToRange(values);
      for (let i = 0; i < districtNames.length; i += 1) {
        const name = districtNames[i]!;
        scaledMedia[name]![tier] ??= { count: 0, richness: 0, freq: 0 };
        scaledMedia[name]![tier][key] = scaled[i] as number;
      }
    }
  }
  const scaledPublic: Record<string, RawTri> = {};
  for (const key of ["count", "richness", "freq"] as const) {
    const values = districtNames.map(n => rawPublic[n]![key]);
    const scaled = scaleToRange(values);
    for (let i = 0; i < districtNames.length; i += 1) {
      const name = districtNames[i]!;
      scaledPublic[name] ??= { count: 0, richness: 0, freq: 0 };
      scaledPublic[name]![key] = scaled[i] as number;
    }
  }

  // 10) 一级 + 综合
  type Final = { central: number; industry: number; municipal: number; district: number; public: number; composite: number };
  const finals: Record<string, Final> = {};
  for (const name of districtNames) {
    const m = scaledMedia[name]!;
    const p = scaledPublic[name]!;
    const cv = m.central.count * SUB_WEIGHT.count + m.central.richness * SUB_WEIGHT.richness + m.central.freq * SUB_WEIGHT.freq;
    const iv = m.industry.count * SUB_WEIGHT.count + m.industry.richness * SUB_WEIGHT.richness + m.industry.freq * SUB_WEIGHT.freq;
    const mv = m.municipal.count * SUB_WEIGHT.count + m.municipal.richness * SUB_WEIGHT.richness + m.municipal.freq * SUB_WEIGHT.freq;
    const dv = m.district.count * SUB_WEIGHT.count + m.district.richness * SUB_WEIGHT.richness + m.district.freq * SUB_WEIGHT.freq;
    const pv = p.count * SUB_WEIGHT.count + p.richness * SUB_WEIGHT.richness + p.freq * SUB_WEIGHT.freq;
    const composite = cv * TIER_WEIGHT.central + iv * TIER_WEIGHT.industry + mv * TIER_WEIGHT.municipal + dv * TIER_WEIGHT.district + pv * TIER_WEIGHT.public;
    finals[name] = { central: cv, industry: iv, municipal: mv, district: dv, public: pv, composite };
  }
  const ranked = districtNames
    .map(name => ({ name, ...finals[name]! }))
    .sort((a, b) => b.composite - a.composite)
    .map((r, i) => ({ rank: i + 1, ...r }));

  console.log(`\n=== Top 10 ===`);
  for (const r of ranked.slice(0, 10)) {
    console.log(`  ${r.rank.toString().padStart(2)} ${r.name.padEnd(8)} 央=${r.central.toFixed(2)} 业=${r.industry.toFixed(2)} 市=${r.municipal.toFixed(2)} 区=${r.district.toFixed(2)} 公=${r.public.toFixed(2)} → ${r.composite.toFixed(2)}`);
  }
  console.log(`\n=== Bottom 5 ===`);
  for (const r of ranked.slice(-5)) {
    console.log(`  ${r.rank.toString().padStart(2)} ${r.name.padEnd(8)} 央=${r.central.toFixed(2)} 业=${r.industry.toFixed(2)} 市=${r.municipal.toFixed(2)} 区=${r.district.toFixed(2)} 公=${r.public.toFixed(2)} → ${r.composite.toFixed(2)}`);
  }

  const scores = ranked.map(r => r.composite);
  const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted[Math.floor(scores.length / 2)] as number;
  const stdev = Math.sqrt(scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length);
  const max = Math.max(...scores), min = Math.min(...scores);
  const high = scores.filter(x => x >= 80).length;
  const mid = scores.filter(x => x >= 72 && x < 80).length;
  const low = scores.filter(x => x < 72).length;
  console.log(`\n=== 统计 ===`);
  console.log(`  max=${max.toFixed(2)}, min=${min.toFixed(2)}, span=${(max - min).toFixed(2)}`);
  console.log(`  mean=${mean.toFixed(2)}, median=${median.toFixed(2)}, stdev=${stdev.toFixed(2)}`);
  console.log(`  tier: 高(≥80)=${high}, 中(72-80)=${mid}, 低(<72)=${low}`);

  const out = {
    scope_source: "/tmp/media-scope-final.json",
    org_id: orgId, year: 2025,
    weights: { tier: TIER_WEIGHT, sub: SUB_WEIGHT, range: [SCALE_MIN, SCALE_MAX] },
    topic_n: TOPIC_N, activity_n: ACTIVITY_N,
    topics: topics.map((t: any) => t.name),
    activity_themes: ["六五环境日", "815全国生态日", "志愿服务活动", "环保设施向公众开放", "美丽重庆六进活动"],
    notes: {
      scope: "严格按 /Users/zhuyu/Downloads/副本媒体站点名单-2(1).xlsx 94 家媒体",
      district_merge: "江北区 + 渝北区 → 两江新区",
      gov_zero: "41 家区县生态环境局政务号 DB 未采到稿件,实际计为 0",
      kaizhou_zero: "开州融媒未采到稿件,数据采集不足,仅供参考",
    },
    raw_media: rawMedia, raw_public: rawPublic,
    scaled_media: scaledMedia, scaled_public: scaledPublic,
    finals, ranked,
    stats: { max, min, span: max - min, mean, median, stdev, tier_high: high, tier_mid: mid, tier_low: low },
  };
  writeFileSync("/tmp/ranking-v5-2025-scope.json", JSON.stringify(out, null, 2));
  console.log(`\n✓ 已写 /tmp/ranking-v5-2025-scope.json`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
