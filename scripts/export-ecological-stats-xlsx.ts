/**
 * scripts/export-ecological-stats-xlsx.ts
 *
 * 按客户《26生态初稿-统计表.xlsx》的 6 个 sheet 维度生成统计报表。
 *
 * Sheet 顺序与客户模板一致:
 *   1. 1.按区县重复与去重后报道数 (数据说明 + 媒体大类×区县 + 媒体单个×区县)
 *   2. 2.报道速度 (中央/行业/市级,各 41 行)
 *   3. 3.主题丰富度 (各区县报道总量排名)
 *   4. 0-1权重系数 (AHP 判断矩阵说明)
 *   5. 0-2榜单计算 (1.0 版综合得分)
 *   6. 0-3对比去年 (2024 vs 2025 排名对比,占位等待历史数据)
 *
 * 口径(2026-05-20):
 *   - 39 个区县(江北/渝北合并到两江新区)
 *   - 中央级 4 outlet / 市级 5 outlet / 行业级 1 outlet(美丽重庆缺数据)
 *   - 西部国际传播中心(ichongqing)报道数 <5,按客户口径剔除
 *   - 主题词 16 个,主题命中走 research_collected_item_topics annotation
 *   - 公众指数固定 80(缺线下宣传/公众行为数据,客户 1.0 版本即固定 80)
 *
 * 用法:
 *   npx tsx scripts/export-ecological-stats-xlsx.ts                        # 默认 org,默认 2025 全年
 *   npx tsx scripts/export-ecological-stats-xlsx.ts <orgId>
 *   npx tsx scripts/export-ecological-stats-xlsx.ts <orgId> 2025-01-01 2025-12-31
 *   # 输出 docs/ecological-stats-export.xlsx
 *
 * 默认时间窗:published_at ∈ [2025-01-01, 2025-12-31],严格剔除 2026 年数据
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import * as XLSX from "xlsx";

// 39 个区县,客户口径排序:中心城区 → 主城新区 → 渝东北 → 渝东南
const DISTRICTS = [
  "万州区","黔江区","涪陵区","渝中区","大渡口区","沙坪坝区","九龙坡区","南岸区","北碚区",
  "巴南区","长寿区","江津区","合川区","永川区","南川区","綦江区","大足区","璧山区",
  "铜梁区","潼南区","荣昌区","开州区","梁平区","武隆区","城口县","丰都县","垫江县","忠县",
  "云阳县","奉节县","巫山县","巫溪县","石柱县","秀山县","酉阳县","彭水县",
  "科学城重庆高新区","万盛经开区","两江新区",
];

// 媒体大类 → DB outlet_name (剔除 ichongqing / 美丽重庆缺数据)
const CENTRAL_OUTLETS = ["央视新闻（中央广播电视总台）", "人民日报", "新华社", "光明日报"];
const MUNICIPAL_OUTLETS = ["新重庆（重庆日报）", "华龙网", "七一网 / 七一客户端", "上游新闻", "重庆广电"];
const INDUSTRY_OUTLETS = ["中国环境报"];

const TIER_MAP = new Map<string, "central" | "municipal" | "industry">();
for (const n of CENTRAL_OUTLETS) TIER_MAP.set(n, "central");
for (const n of MUNICIPAL_OUTLETS) TIER_MAP.set(n, "municipal");
for (const n of INDUSTRY_OUTLETS) TIER_MAP.set(n, "industry");
const ALL_TRACKED_OUTLETS = [...CENTRAL_OUTLETS, ...MUNICIPAL_OUTLETS, ...INDUSTRY_OUTLETS];

// 2024 榜单 baseline (5.0 版) — 用于 Sheet 6 同比对比
// 江北/渝北/两江新区 当年独立计分,本表保留原始 41 行,合并到 39 行时取 3 者均值
const RANKING_2024: Array<{ district: string; score: number }> = [
  { district: "万州区", score: 74.38 },
  { district: "黔江区", score: 76.79 },
  { district: "涪陵区", score: 80.60 },
  { district: "渝中区", score: 78.54 },
  { district: "大渡口区", score: 76.02 },
  { district: "江北区", score: 73.57 },
  { district: "沙坪坝区", score: 75.41 },
  { district: "九龙坡区", score: 82.52 },
  { district: "南岸区", score: 76.56 },
  { district: "北碚区", score: 85.52 },
  { district: "渝北区", score: 83.59 },
  { district: "巴南区", score: 81.12 },
  { district: "长寿区", score: 77.69 },
  { district: "江津区", score: 79.16 },
  { district: "合川区", score: 72.68 },
  { district: "永川区", score: 75.73 },
  { district: "南川区", score: 76.37 },
  { district: "綦江区", score: 71.38 },
  { district: "大足区", score: 70.21 },
  { district: "璧山区", score: 74.94 },
  { district: "铜梁区", score: 72.88 },
  { district: "潼南区", score: 72.52 },
  { district: "荣昌区", score: 71.14 },
  { district: "开州区", score: 77.14 },
  { district: "梁平区", score: 79.14 },
  { district: "武隆区", score: 71.92 },
  { district: "城口县", score: 72.11 },
  { district: "丰都县", score: 73.28 },
  { district: "垫江县", score: 71.63 },
  { district: "忠县", score: 79.11 },
  { district: "云阳县", score: 82.02 },
  { district: "奉节县", score: 80.53 },
  { district: "巫山县", score: 80.85 },
  { district: "巫溪县", score: 67.99 },
  { district: "石柱县", score: 69.39 },
  { district: "秀山县", score: 73.95 },
  { district: "酉阳县", score: 70.49 },
  { district: "彭水县", score: 72.05 },
  { district: "科学城重庆高新区", score: 72.32 }, // 原"西部科学城重庆高新区",改名对齐 DB
  { district: "万盛经开区", score: 72.73 },
  { district: "两江新区", score: 84.48 },
];

// Sheet 1 表 4 媒体列顺序 (Excel 列名 → DB outletName)
const OUTLET_COLUMNS_S4: { excel: string; dbName: string }[] = [
  { excel: "重庆日报网",    dbName: "新重庆（重庆日报）" },
  { excel: "华龙网",         dbName: "华龙网" },
  { excel: "七一网",         dbName: "七一网 / 七一客户端" },
  { excel: "上游新闻网",     dbName: "上游新闻" },
  { excel: "视界网",         dbName: "重庆广电" },
  { excel: "人民网",         dbName: "人民日报" },
  { excel: "光明网",         dbName: "光明日报" },
  { excel: "新华网",         dbName: "新华社" },
  { excel: "央视网",         dbName: "央视新闻（中央广播电视总台）" },
  { excel: "中国环境网站",   dbName: "中国环境报" },
];

interface DistrictTierStats { district: string; central: number; industry: number; municipal: number; total: number }
interface DistrictOutletStats { district: string; counts: Record<string, number>; total: number }
interface SpeedStats { district: string; earliest: Date | null; latest: Date | null; spanDays: number; count: number; speed: number }
interface ScoreRow { rank: number; district: string; central: number; industry: number; municipal: number; public: number; total: number }

async function main() {
  const orgArg = process.argv[2];
  const fromArg = process.argv[3];
  const toArg = process.argv[4];

  const { db } = await import("@/db");
  const { collectedItems } = await import("@/db/schema/collection");
  const { mediaOutletDictionary } = await import("@/db/schema/media-outlet-dictionary");
  const { researchCollectedItemDistricts, researchCollectedItemTopics } = await import("@/db/schema/research/annotations");
  const { researchTopics } = await import("@/db/schema/research/research-topics");
  const { organizations } = await import("@/db/schema/users");
  const { and, eq, sql, inArray, isNotNull } = await import("drizzle-orm");

  // postgres-js 不接受 string[] 直接传给 ANY,需要用 sql.join 构造 ARRAY literal
  const trackedSql = sql`ARRAY[${sql.join(ALL_TRACKED_OUTLETS.map(n => sql`${n}`), sql`, `)}]::text[]`;
  const centralSql = sql`ARRAY[${sql.join(CENTRAL_OUTLETS.map(n => sql`${n}`), sql`, `)}]::text[]`;
  const industrySql = sql`ARRAY[${sql.join(INDUSTRY_OUTLETS.map(n => sql`${n}`), sql`, `)}]::text[]`;
  const municipalSql = sql`ARRAY[${sql.join(MUNICIPAL_OUTLETS.map(n => sql`${n}`), sql`, `)}]::text[]`;
  const districtsSql = sql`ARRAY[${sql.join(DISTRICTS.map(d => sql`${d}`), sql`, `)}]::text[]`;

  let orgId = orgArg;
  if (!orgId) {
    const rows = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).limit(5);
    if (rows.length === 0) { console.error("DB 中没有 organization"); process.exit(1); }
    if (rows.length > 1) {
      console.error("多个 org,请显式传 orgId");
      process.exit(1);
    }
    orgId = rows[0]!.id;
    console.log(`使用默认 org: ${orgId} (${rows[0]!.name})`);
  }

  // 默认 2025 全年 (严格剔除 2026 数据)
  // postgres-js raw sql 模板不接受 Date binding,转 ISO string
  const publishedAtFrom = (fromArg ? new Date(fromArg) : new Date("2025-01-01T00:00:00Z")).toISOString();
  const publishedAtTo = (toArg ? new Date(toArg) : new Date("2025-12-31T23:59:59Z")).toISOString();

  console.log(`📊 拉数据 org=${orgId} 时间=${publishedAtFrom} ~ ${publishedAtTo}`);

  // ── 1) 拉所有需要的字典 id
  const trackedOutletRows = await db
    .select({ id: mediaOutletDictionary.id, outletName: mediaOutletDictionary.outletName, outletTier: mediaOutletDictionary.outletTier })
    .from(mediaOutletDictionary)
    .where(and(
      eq(mediaOutletDictionary.organizationId, orgId),
      inArray(mediaOutletDictionary.outletName, ALL_TRACKED_OUTLETS),
    ));
  const outletIdToName = new Map(trackedOutletRows.map(r => [r.id, r.outletName]));
  const trackedOutletIds = trackedOutletRows.map(r => r.id);
  console.log(`  → 加载 ${trackedOutletRows.length} 个 tracked outlet`);

  // ── 2) 拉 collected_items + districts annotation + outlet (限定 tracked outlets)
  const timeWhere: ReturnType<typeof sql>[] = [];
  if (publishedAtFrom) timeWhere.push(sql`${collectedItems.publishedAt} >= ${publishedAtFrom}`);
  if (publishedAtTo) timeWhere.push(sql`${collectedItems.publishedAt} <= ${publishedAtTo}`);

  // ── 3) Sheet 1 子表 1:数据说明 概况指标
  console.log("  → 计算概况指标...");
  const [{ totalItems }] = await db
    .select({ totalItems: sql<number>`COUNT(*)::int` })
    .from(collectedItems)
    .where(and(eq(collectedItems.organizationId, orgId), ...timeWhere));

  // 有效数据:至少有 1 个 district annotation
  const [{ validItems }] = await db.execute<{ validItems: number }>(sql`
    SELECT COUNT(DISTINCT ci.id)::int AS "validItems"
    FROM collected_items ci
    INNER JOIN research_collected_item_districts rd ON rd.collected_item_id = ci.id
    WHERE ci.organization_id = ${orgId}
      ${publishedAtFrom ? sql`AND ci.published_at >= ${publishedAtFrom}` : sql``}
      ${publishedAtTo ? sql`AND ci.published_at <= ${publishedAtTo}` : sql``}
  `);

  // 按媒体(归类后)+ 标题去重:有效数据中 (outlet_name, title) 唯一组合数
  // 注:限定 tracked outlets 范围内,以匹配客户口径(只算受关注的 10 个媒体)
  const [{ dedupedItems }] = await db.execute<{ dedupedItems: number }>(sql`
    SELECT COUNT(DISTINCT (o.outlet_name, ci.title))::int AS "dedupedItems"
    FROM collected_items ci
    INNER JOIN research_collected_item_districts rd ON rd.collected_item_id = ci.id
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND o.outlet_name = ANY(${trackedSql})
      ${publishedAtFrom ? sql`AND ci.published_at >= ${publishedAtFrom}` : sql``}
      ${publishedAtTo ? sql`AND ci.published_at <= ${publishedAtTo}` : sql``}
  `);

  // 按区县重复(去重前): 所有 (item, district) pair 行数(tracked outlets)
  const [{ districtPairsAll }] = await db.execute<{ districtPairsAll: number }>(sql`
    SELECT COUNT(*)::int AS "districtPairsAll"
    FROM collected_items ci
    INNER JOIN research_collected_item_districts rd ON rd.collected_item_id = ci.id
    INNER JOIN research_cq_districts d ON d.id = rd.district_id
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND o.outlet_name = ANY(${trackedSql})
      AND d.name = ANY(${districtsSql})
      ${publishedAtFrom ? sql`AND ci.published_at >= ${publishedAtFrom}` : sql``}
      ${publishedAtTo ? sql`AND ci.published_at <= ${publishedAtTo}` : sql``}
  `);

  // 按区县重复(去重后): 同(outlet, title)算一条
  const [{ districtPairsDedup }] = await db.execute<{ districtPairsDedup: number }>(sql`
    SELECT COUNT(*)::int AS "districtPairsDedup"
    FROM (
      SELECT DISTINCT o.outlet_name, ci.title, d.name AS district
      FROM collected_items ci
      INNER JOIN research_collected_item_districts rd ON rd.collected_item_id = ci.id
      INNER JOIN research_cq_districts d ON d.id = rd.district_id
      INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
      WHERE ci.organization_id = ${orgId}
        AND o.outlet_name = ANY(${trackedSql})
        AND d.name = ANY(${districtsSql})
        ${publishedAtFrom ? sql`AND ci.published_at >= ${publishedAtFrom}` : sql``}
        ${publishedAtTo ? sql`AND ci.published_at <= ${publishedAtTo}` : sql``}
    ) sub
  `);

  // 按主题重复(去重后): 同(outlet, title)算一条
  const [{ topicPairsDedup }] = await db.execute<{ topicPairsDedup: number }>(sql`
    SELECT COUNT(*)::int AS "topicPairsDedup"
    FROM (
      SELECT DISTINCT o.outlet_name, ci.title, t.name AS topic
      FROM collected_items ci
      INNER JOIN research_collected_item_topics rt ON rt.collected_item_id = ci.id
      INNER JOIN research_topics t ON t.id = rt.topic_id
      INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
      WHERE ci.organization_id = ${orgId}
        AND o.outlet_name = ANY(${trackedSql})
        ${publishedAtFrom ? sql`AND ci.published_at >= ${publishedAtFrom}` : sql``}
        ${publishedAtTo ? sql`AND ci.published_at <= ${publishedAtTo}` : sql``}
    ) sub
  `);

  console.log(`     原始 ${totalItems} / 有效 ${validItems} / 去重 ${dedupedItems} / 区县pair ${districtPairsDedup} / 主题pair ${topicPairsDedup}`);

  // ── 4) Sheet 1 子表 3,4:区县 × 媒体 (去重后)
  // 按 (district, outlet, title) DISTINCT 去重 — 等价于"按媒体+标题归类后,该区县命中的稿件数"
  console.log("  → 计算区县×媒体...");
  const distOutletRows = await db.execute<{ district: string; outlet_name: string; cnt: number }>(sql`
    SELECT d.name AS district, o.outlet_name, COUNT(DISTINCT ci.title)::int AS cnt
    FROM collected_items ci
    INNER JOIN research_collected_item_districts rd ON rd.collected_item_id = ci.id
    INNER JOIN research_cq_districts d ON d.id = rd.district_id
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND o.outlet_name = ANY(${trackedSql})
      AND d.name = ANY(${districtsSql})
      ${publishedAtFrom ? sql`AND ci.published_at >= ${publishedAtFrom}` : sql``}
      ${publishedAtTo ? sql`AND ci.published_at <= ${publishedAtTo}` : sql``}
    GROUP BY d.name, o.outlet_name
  `);

  const districtTierMap = new Map<string, DistrictTierStats>();
  const districtOutletMap = new Map<string, DistrictOutletStats>();
  for (const d of DISTRICTS) {
    districtTierMap.set(d, { district: d, central: 0, industry: 0, municipal: 0, total: 0 });
    districtOutletMap.set(d, { district: d, counts: {}, total: 0 });
  }
  for (const r of distOutletRows) {
    const tier = TIER_MAP.get(r.outlet_name);
    if (!tier) continue;
    const t = districtTierMap.get(r.district);
    if (t) { t[tier] += r.cnt; t.total += r.cnt; }
    const o = districtOutletMap.get(r.district);
    if (o) { o.counts[r.outlet_name] = (o.counts[r.outlet_name] ?? 0) + r.cnt; o.total += r.cnt; }
  }

  // ── 5) Sheet 2:报道速度 (3 个子表,按媒体大类)
  console.log("  → 计算报道速度...");
  const speedRows = await db.execute<{ district: string; tier: string; earliest: Date; latest: Date; cnt: number }>(sql`
    SELECT d.name AS district,
      CASE WHEN o.outlet_name = ANY(${centralSql}) THEN 'central'
           WHEN o.outlet_name = ANY(${industrySql}) THEN 'industry'
           WHEN o.outlet_name = ANY(${municipalSql}) THEN 'municipal'
      END AS tier,
      MIN(ci.published_at) AS earliest,
      MAX(ci.published_at) AS latest,
      COUNT(DISTINCT ci.title)::int AS cnt
    FROM collected_items ci
    INNER JOIN research_collected_item_districts rd ON rd.collected_item_id = ci.id
    INNER JOIN research_cq_districts d ON d.id = rd.district_id
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND o.outlet_name = ANY(${trackedSql})
      AND d.name = ANY(${districtsSql})
      AND ci.published_at IS NOT NULL
      ${publishedAtFrom ? sql`AND ci.published_at >= ${publishedAtFrom}` : sql``}
      ${publishedAtTo ? sql`AND ci.published_at <= ${publishedAtTo}` : sql``}
    GROUP BY d.name, tier
  `);

  const speedByTier = { central: new Map<string, SpeedStats>(), industry: new Map<string, SpeedStats>(), municipal: new Map<string, SpeedStats>() };
  for (const r of speedRows) {
    if (!r.tier) continue;
    const earliest = r.earliest ? new Date(r.earliest as unknown as string) : null;
    const latest = r.latest ? new Date(r.latest as unknown as string) : null;
    const dayDiff = earliest && latest ? Math.max(1, Math.round((latest.getTime() - earliest.getTime()) / 86400000) + 1) : 0;
    const speed = dayDiff > 0 ? r.cnt / dayDiff : 0;
    speedByTier[r.tier as keyof typeof speedByTier].set(r.district, {
      district: r.district,
      earliest,
      latest,
      spanDays: dayDiff,
      count: r.cnt,
      speed: Math.round(speed * 1000) / 1000,
    });
  }

  // ── 6) Sheet 3:主题丰富度 (各区县命中主题次数总和)
  console.log("  → 计算主题丰富度...");
  const topicByDistrictRows = await db.execute<{ district: string; cnt: number }>(sql`
    SELECT d.name AS district,
      COUNT(*)::int AS cnt
    FROM (
      SELECT DISTINCT o.outlet_name, ci.title, t.name AS topic, ci.id AS item_id
      FROM collected_items ci
      INNER JOIN research_collected_item_topics rt ON rt.collected_item_id = ci.id
      INNER JOIN research_topics t ON t.id = rt.topic_id
      INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
      WHERE ci.organization_id = ${orgId}
        AND o.outlet_name = ANY(${trackedSql})
        ${publishedAtFrom ? sql`AND ci.published_at >= ${publishedAtFrom}` : sql``}
        ${publishedAtTo ? sql`AND ci.published_at <= ${publishedAtTo}` : sql``}
    ) deduped
    INNER JOIN collected_items ci2 ON ci2.id = deduped.item_id
    INNER JOIN research_collected_item_districts rd ON rd.collected_item_id = ci2.id
    INNER JOIN research_cq_districts d ON d.id = rd.district_id
    WHERE d.name = ANY(${districtsSql})
    GROUP BY d.name
  `);
  const topicRichnessMap = new Map<string, number>();
  for (const d of DISTRICTS) topicRichnessMap.set(d, 0);
  for (const r of topicByDistrictRows) topicRichnessMap.set(r.district, r.cnt);

  // ── 7) Sheet 5 榜单计算 — min-max 归一化到 [65, 95] 区间
  console.log("  → 计算综合得分...");
  const minMax = (values: number[]): [number, number] => values.length === 0 ? [0, 0] : [Math.min(...values), Math.max(...values)];
  const normalize = (v: number, min: number, max: number): number =>
    max === min ? 80 : Math.round((65 + ((v - min) / (max - min)) * 30) * 10) / 10;

  const centralVals = DISTRICTS.map(d => districtTierMap.get(d)!.central);
  const industryVals = DISTRICTS.map(d => districtTierMap.get(d)!.industry);
  const municipalVals = DISTRICTS.map(d => districtTierMap.get(d)!.municipal);
  const [cMin, cMax] = minMax(centralVals);
  const [iMin, iMax] = minMax(industryVals);
  const [mMin, mMax] = minMax(municipalVals);

  const scores: ScoreRow[] = DISTRICTS.map(d => {
    const s = districtTierMap.get(d)!;
    const central = normalize(s.central, cMin, cMax);
    const industry = normalize(s.industry, iMin, iMax);
    const municipal = normalize(s.municipal, mMin, mMax);
    const publicIdx = 80; // 缺线下宣传 / 公众行为数据,固定 80
    const total = Math.round((central * 0.5 + industry * 0.25 + municipal * 0.15 + publicIdx * 0.10) * 100) / 100;
    return { rank: 0, district: d, central, industry, municipal, public: publicIdx, total };
  });
  scores.sort((a, b) => b.total - a.total);
  scores.forEach((s, i) => { s.rank = i + 1; });

  // ── 8) 写 6 sheet
  console.log("  → 生成 xlsx...");
  const wb = XLSX.utils.book_new();

  // Sheet 1
  const s1Rows: (string | number | null)[][] = [];
  s1Rows.push([null, null, null, "华栖云生态文明传播统计表", null, null, null]);
  s1Rows.push([1, "数据说明", null, "覆盖范围: 39 个统计单元(江北/渝北合并到两江新区)", null, null, null]);
  s1Rows.push([null, "项目", "数值", null, null, null, null]);
  s1Rows.push([null, "原始数据总行数", totalItems, null, null, null, null]);
  s1Rows.push([null, "去除无效数据后(至少命中一个区县)", validItems, null, null, null, null]);
  s1Rows.push([null, "按媒体(归类后)+ 标题去重后", dedupedItems, null, null, null, null]);
  s1Rows.push([null, "按区县重复统计总数(去重前)", districtPairsAll, null, null, null, null]);
  s1Rows.push([null, "按区县重复统计总数", districtPairsDedup, null, null, null, null]);
  s1Rows.push([null, "按主题重复统计总数", topicPairsDedup, null, null, null, null]);
  s1Rows.push([]);
  s1Rows.push([null, "说明:", null, null, null, null, null]);
  s1Rows.push([null, "原始数据: 全部 collected_items", null, null, null, null, null]);
  s1Rows.push([null, "有效数据: 至少包含一个重庆区县 annotation", null, null, null, null, null]);
  s1Rows.push([null, "去重: 同一媒体(按归类后)同一标题只保留一条", null, null, null, null, null]);
  s1Rows.push([null, "按区县重复: 一条新闻可同时提及多个区县,因此区县总数 > 去重稿件数", null, null, null, null, null]);
  s1Rows.push([]);
  s1Rows.push([2, "媒体大类(市级、中央级、行业级)分别统计在 39 个区县的报道数量", null, null, null, null, null]);
  s1Rows.push([null, "类别", "包含媒体", null, null, null, null]);
  s1Rows.push([null, "市级媒体", MUNICIPAL_OUTLETS.join("、"), null, null, null, null]);
  s1Rows.push([null, "中央级媒体", CENTRAL_OUTLETS.join("、"), null, null, null, null]);
  s1Rows.push([null, "行业级媒体", INDUSTRY_OUTLETS.join("、"), null, null, null, null]);
  s1Rows.push([null, "注:西部国际传播中心(ichongqing)采集到的有效报道 <5,按客户口径剔除", null, null, null, null, null]);
  s1Rows.push([null, "注:美丽重庆缺微信公众号采集源,暂无数据", null, null, null, null, null]);
  s1Rows.push([]);
  s1Rows.push([3, "媒体大类 × 区县 报道数量统计表", null, null, null, null, null]);
  s1Rows.push([null, "排名", "统计单元", "中央级媒体", "行业级媒体", "市级媒体", "合计"]);
  const tier3Sorted = [...DISTRICTS].sort((a, b) => districtTierMap.get(b)!.total - districtTierMap.get(a)!.total);
  tier3Sorted.forEach((d, i) => {
    const s = districtTierMap.get(d)!;
    s1Rows.push([null, i + 1, d, s.central, s.industry, s.municipal, s.total]);
  });
  const tCentral = tier3Sorted.reduce((sum, d) => sum + districtTierMap.get(d)!.central, 0);
  const tIndustry = tier3Sorted.reduce((sum, d) => sum + districtTierMap.get(d)!.industry, 0);
  const tMunicipal = tier3Sorted.reduce((sum, d) => sum + districtTierMap.get(d)!.municipal, 0);
  const tAll = tCentral + tIndustry + tMunicipal;
  s1Rows.push([null, "合计", `${DISTRICTS.length} 个单元`, tCentral, tIndustry, tMunicipal, tAll]);
  s1Rows.push([]);
  s1Rows.push([null, "说明:", null, null, null, null, null]);
  s1Rows.push([null, `市级媒体合计 ${tMunicipal} 次,占总数 ${tAll > 0 ? (tMunicipal/tAll*100).toFixed(1) : "0"}%`, null, null, null, null, null]);
  s1Rows.push([null, `中央级媒体合计 ${tCentral} 次,占总数 ${tAll > 0 ? (tCentral/tAll*100).toFixed(1) : "0"}%`, null, null, null, null, null]);
  s1Rows.push([null, `行业级媒体合计 ${tIndustry} 次,占总数 ${tAll > 0 ? (tIndustry/tAll*100).toFixed(1) : "0"}%`, null, null, null, null, null]);
  s1Rows.push([]);
  s1Rows.push([4, "媒体单个 × 区县 报道数量统计表", null, null, null, null, null]);
  s1Rows.push([null, "排名", "统计单元", ...OUTLET_COLUMNS_S4.map(c => c.excel), "合计"]);
  const outletSorted = [...DISTRICTS].sort((a, b) => districtOutletMap.get(b)!.total - districtOutletMap.get(a)!.total);
  outletSorted.forEach((d, i) => {
    const o = districtOutletMap.get(d)!;
    s1Rows.push([null, i + 1, d, ...OUTLET_COLUMNS_S4.map(c => o.counts[c.dbName] ?? 0), o.total]);
  });
  const outletTotals = OUTLET_COLUMNS_S4.map(c => outletSorted.reduce((sum, d) => sum + (districtOutletMap.get(d)!.counts[c.dbName] ?? 0), 0));
  const grandTotal = outletTotals.reduce((a, b) => a + b, 0);
  s1Rows.push([null, "合计", `${DISTRICTS.length} 个单元`, ...outletTotals, grandTotal]);

  const ws1 = XLSX.utils.aoa_to_sheet(s1Rows);
  ws1["!cols"] = [{ wch: 4 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws1, "1.按区县重复与去重后报道数");

  // Sheet 2: 报道速度
  const s2Rows: (string | number | Date | null)[][] = [];
  const speedSections = [
    { idx: 1, title: "中央级媒体报道时间范围、数量与传播速度(39 个区县)", data: speedByTier.central, desc: "中央级媒体(人民日报、光明日报、新华社、央视新闻)" },
    { idx: 2, title: "行业级媒体报道时间范围、数量与传播速度(39 个区县)", data: speedByTier.industry, desc: "行业级媒体仅指 中国环境报,缺美丽重庆" },
    { idx: 3, title: "市级媒体报道时间范围、数量与传播速度(39 个区县)", data: speedByTier.municipal, desc: "市级媒体合计占总报道数 86% 左右" },
  ];
  for (const sec of speedSections) {
    s2Rows.push([sec.idx, sec.title, null, null, null, null, null, null]);
    s2Rows.push([null, "序号", "统计单元", "最早时间", "最晚时间", "时间跨度(天)", "报道数量(次)", "传播速度(次/天)"]);
    const sorted = [...DISTRICTS].sort((a, b) => (sec.data.get(b)?.count ?? 0) - (sec.data.get(a)?.count ?? 0));
    sorted.forEach((d, i) => {
      const s = sec.data.get(d);
      s2Rows.push([null, i + 1, d, s?.earliest ?? null, s?.latest ?? null, s?.spanDays ?? 0, s?.count ?? 0, s?.speed ?? 0]);
    });
    s2Rows.push([null, "说明:", null, null, null, null, null, null]);
    s2Rows.push([null, sec.desc, null, null, null, null, null, null]);
    s2Rows.push([null, "传播速度 = 报道数量 ÷ 时间跨度(天数), 单位:次/天", null, null, null, null, null, null]);
    s2Rows.push([]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(s2Rows);
  ws2["!cols"] = [{ wch: 4 }, { wch: 6 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, "2.报道速度");

  // Sheet 3: 主题丰富度
  const s3Rows: (string | number | null)[][] = [];
  s3Rows.push([null, 1, "各区县生态文明传播报道总量排名(主题丰富度)", null, null]);
  s3Rows.push([null, null, "序号", "区县", "合计"]);
  const richSorted = [...DISTRICTS].sort((a, b) => (topicRichnessMap.get(b) ?? 0) - (topicRichnessMap.get(a) ?? 0));
  richSorted.forEach((d, i) => {
    s3Rows.push([null, null, i + 1, d, topicRichnessMap.get(d) ?? 0]);
  });
  const richTotal = richSorted.reduce((sum, d) => sum + (topicRichnessMap.get(d) ?? 0), 0);
  s3Rows.push([null, null, "全市总计", null, richTotal]);
  s3Rows.push([]);
  s3Rows.push([null, null, "注: 合计 = 该区县命中所有 16 个主题词的次数总和(同 outlet+title 算 1 次)", null, null]);

  const ws3 = XLSX.utils.aoa_to_sheet(s3Rows);
  ws3["!cols"] = [{ wch: 4 }, { wch: 4 }, { wch: 8 }, { wch: 18 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws3, "3.主题丰富度");

  // Sheet 4: 0-1权重系数
  const s4Rows: (string | number | null)[][] = [];
  s4Rows.push([]);
  s4Rows.push([null, "AHP 层次分析", "判断矩阵(第一层权重)", null, null, null, null, null]);
  s4Rows.push([null, null, null, "中央媒体传播指数", "行业媒体传播指数", "区县媒体传播指数", "公众行为引导指数", "权重 %"]);
  s4Rows.push([null, null, "中央媒体传播指数", 1, 2, 3.333, 5, 50]);
  s4Rows.push([null, null, "行业媒体传播指数", 0.5, 1, 1.667, 2.5, 25]);
  s4Rows.push([null, null, "区县媒体传播指数", 0.3, 0.6, 1, 1.5, 15]);
  s4Rows.push([null, null, "公众行为引导指数", 0.2, 0.4, 0.667, 1, 10]);
  s4Rows.push([]);
  s4Rows.push([null, "第二层权重(分项指标)", null, null, null, null, null, null]);
  s4Rows.push([null, null, "指标", "权重", null, null, null, null]);
  s4Rows.push([null, null, "数量", 4, null, null, null, null]);
  s4Rows.push([null, null, "丰富度", 3, null, null, null, null]);
  s4Rows.push([null, null, "速度", 3, null, null, null, null]);
  s4Rows.push([]);
  s4Rows.push([null, "综合得分公式 = 中央 × 50% + 行业 × 25% + 市级 × 15% + 公众 × 10%", null, null, null, null, null, null]);
  s4Rows.push([null, "各指数(0-100)按 min-max 归一化到 [65, 95] 区间,公众指数缺数据,固定 80", null, null, null, null, null, null]);

  const ws4 = XLSX.utils.aoa_to_sheet(s4Rows);
  ws4["!cols"] = [{ wch: 4 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws4, "0-1权重系数");

  // Sheet 5: 0-2榜单计算
  const s5Rows: (string | number | null)[][] = [];
  s5Rows.push([]);
  s5Rows.push([null, "1.0 版生态文明传播指数榜单(基于 2025 实际数据)", null, null, null, null, null, null]);
  s5Rows.push([null, "排名", "统计单元", "中央指数", "行业指数", "市级指数", "公众指数", "综合得分"]);
  for (const s of scores) {
    s5Rows.push([null, s.rank, s.district, s.central, s.industry, s.municipal, s.public, s.total]);
  }
  s5Rows.push([]);
  s5Rows.push([null, "说明:", null, null, null, null, null, null]);
  s5Rows.push([null, "中央指数 = min-max 归一化(中央级媒体报道数) → [65, 95]", null, null, null, null, null, null]);
  s5Rows.push([null, "行业指数 / 市级指数 同理", null, null, null, null, null, null]);
  s5Rows.push([null, "公众指数固定 80(线下宣传与公众行为数据缺失)", null, null, null, null, null, null]);
  s5Rows.push([null, "综合得分 = 中央 × 0.5 + 行业 × 0.25 + 市级 × 0.15 + 公众 × 0.10", null, null, null, null, null, null]);

  const ws5 = XLSX.utils.aoa_to_sheet(s5Rows);
  ws5["!cols"] = [{ wch: 4 }, { wch: 6 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws5, "0-2榜单计算");

  // Sheet 6: 0-3对比去年 — 2024 baseline vs 2025 实际榜单
  // 24 年 41 行 → 合并到 39 行(江北/渝北/两江新区取均值,保留 outlet 实体合并到两江新区的统计口径)
  const baseline2024Map = new Map<string, number>();
  for (const r of RANKING_2024) baseline2024Map.set(r.district, r.score);
  const liangJiangAvg = ((baseline2024Map.get("江北区") ?? 0) + (baseline2024Map.get("渝北区") ?? 0) + (baseline2024Map.get("两江新区") ?? 0)) / 3;
  const merged2024 = new Map<string, number>();
  for (const d of DISTRICTS) {
    if (d === "两江新区") merged2024.set(d, Math.round(liangJiangAvg * 100) / 100);
    else if (baseline2024Map.has(d)) merged2024.set(d, baseline2024Map.get(d)!);
  }
  // 24 年合并后排名
  const rank2024 = new Map<string, number>();
  [...merged2024.entries()].sort((a, b) => b[1] - a[1]).forEach(([d], i) => rank2024.set(d, i + 1));

  // 排名变化文案
  const changeLabel = (diff: number): string => {
    if (diff >= 20) return "断崖式上升";
    if (diff >= 10) return "大幅上升";
    if (diff >= 5) return "上升";
    if (diff >= 2) return "微升";
    if (diff === 1 || diff === -1) return "基本稳定";
    if (diff === 0) return "持平";
    if (diff >= -4) return "微降";
    if (diff >= -9) return "下降";
    if (diff >= -19) return "大幅下降";
    return "断崖式下降";
  };

  const s6Rows: (string | number | null)[][] = [];
  s6Rows.push([null, "诊断:", null, null, null, null]);
  s6Rows.push([null, "第一层缺少线下宣传、区县融媒体和美丽重庆数据", null, null, null, null]);
  s6Rows.push([null, "第二层缺少主题丰富度的精细权重(目前直接使用主题命中总数)", null, null, null, null]);
  s6Rows.push([]);
  s6Rows.push([null, "2024 vs 2025 排名对比(2024 baseline 来自客户提供的 5.0 版榜单)", null, null, null, null]);
  s6Rows.push([null, "注:江北区/渝北区/两江新区 在 2024 各自独立计分,本表按 25 年新口径合并到'两江新区'(取 3 者均值)", null, null, null, null]);
  s6Rows.push([]);
  s6Rows.push([null, "区县", "2024 排名", "2025 排名", "排名变化", "说明"]);
  // 按 25 年排名顺序排
  const scoresByRank = [...scores].sort((a, b) => a.rank - b.rank);
  for (const s of scoresByRank) {
    const r24 = rank2024.get(s.district);
    const r25 = s.rank;
    if (r24 === undefined) {
      s6Rows.push([null, s.district, "—", r25, "—", "2024 无对应数据"]);
      continue;
    }
    const diff = r24 - r25;
    const arrow = diff > 0 ? `↑ ${diff}` : diff < 0 ? `↓ ${Math.abs(diff)}` : "0";
    s6Rows.push([null, s.district, r24, r25, arrow, changeLabel(diff)]);
  }
  s6Rows.push([]);
  s6Rows.push([null, "排名变化档位说明:", null, null, null, null]);
  s6Rows.push([null, "↑↓ ≥ 20: 断崖式 | ≥ 10: 大幅 | ≥ 5: 显著 | ≥ 2: 微 | ≤ 1: 基本稳定 | = 0: 持平", null, null, null, null]);

  const ws6 = XLSX.utils.aoa_to_sheet(s6Rows);
  ws6["!cols"] = [{ wch: 4 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws6, "0-3对比去年");

  const outPath = "docs/ecological-stats-export.xlsx";
  XLSX.writeFile(wb, outPath);
  console.log(`✓ 导出完成 → ${outPath}`);
  process.exit(0);
}

main().catch((err) => { console.error("fatal:", err); process.exit(1); });
