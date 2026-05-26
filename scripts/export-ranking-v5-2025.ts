/**
 * scripts/export-ranking-v5-2025.ts
 *
 * 仿照客户 24 年榜单 5.0 版格式（《榜单5.0-契合度改为丰富度及报道去重二次补录垫江等后.xlsx》），
 * 用 25 年数据生成 9 个 sheet 的统计表。
 *
 * 5.0 版算法:
 *   综合指数 = 中央媒体指数 × 50% + 行业媒体指数 × 25% + 区县媒体指数 × 15% + 公众行为指数 × 10%
 *   每类指数 = 报道总数 × 40% + 主题丰富度 × 30% + 传播速度 × 30%
 *   每个分项 0-100 归一化(min-max → [60, 95])
 *
 * 媒体范围:
 *   - 中央: 央视新闻、人民日报、新华社、光明日报
 *   - 行业: 中国环境报、美丽重庆
 *   - 区县: 41 个区县融媒体(政务新媒体单独一类,不计入区县媒体指数)
 *   - 公众: 暂无数据,固定指数为 80
 *
 * 用法:
 *   npx tsx scripts/export-ranking-v5-2025.ts
 *   # 输出 docs/ranking-v5-2025.xlsx
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import * as XLSX from "xlsx";

// 39 个区县,按 24 年表序号顺序
const DISTRICTS = [
  "万州区","黔江区","涪陵区","渝中区","大渡口区","沙坪坝区","九龙坡区","南岸区","北碚区",
  "巴南区","长寿区","江津区","合川区","永川区","南川区","綦江区","大足区","璧山区",
  "铜梁区","潼南区","荣昌区","开州区","梁平区","武隆区","城口县","丰都县","垫江县","忠县",
  "云阳县","奉节县","巫山县","巫溪县","石柱县","秀山县","酉阳县","彭水县",
  "科学城重庆高新区","万盛经开区","两江新区",
];

// 16 主题词,按 DB 实际名
const TOPICS = [
  "美丽中国","综合治理","绿色发展","双碳","和谐共生","长江生态","绿水青山","制度建设",
  "资源节约","污染防治攻坚战","清洁能源","国家公园","环保督察","生物多样性","生态红线","低碳经济",
];

// 媒体范围 (DB 实际 outlet_name)
const CENTRAL_OUTLETS = ["央视新闻（中央广播电视总台）", "人民日报", "新华社", "光明日报"];
const INDUSTRY_OUTLETS = ["中国环境报", "美丽重庆"];
// 区县媒体只算 tier=district_media 的(各区融媒) — 不含 government_self_media (政务新媒体)
// 公众行为 (4) 单独一类,本期暂无数据

const TIME_FROM = "2025-01-01T00:00:00Z";
const TIME_TO = "2025-12-31T23:59:59Z";

// 2024 baseline 5.0 版 (用于 0-4 结果比较)
// 数据来源:客户提供的《榜单5.0-契合度改为丰富度及报道去重二次补录垫江等后.xlsx》
//   sheet '0-4结果比较' 中 5.0 版列(R3-R43, col 27-29: 序号/区县/综合指数)
// 这是从客户原文件读取的真实历史 baseline,非凭空生成
const RANKING_2024_V5: Array<{ rank: number; district: string; score: number }> = [
  { rank: 1, district: "万州区", score: 74.38 },
  { rank: 2, district: "黔江区", score: 76.79 },
  { rank: 3, district: "涪陵区", score: 80.60 },
  { rank: 4, district: "渝中区", score: 78.54 },
  { rank: 5, district: "大渡口区", score: 76.02 },
  { rank: 6, district: "江北区", score: 73.57 },
  { rank: 7, district: "沙坪坝区", score: 75.41 },
  { rank: 8, district: "九龙坡区", score: 82.52 },
  { rank: 9, district: "南岸区", score: 76.56 },
  { rank: 10, district: "北碚区", score: 85.52 },
  { rank: 11, district: "渝北区", score: 83.59 },
  { rank: 12, district: "巴南区", score: 81.12 },
  { rank: 13, district: "长寿区", score: 77.69 },
  { rank: 14, district: "江津区", score: 79.16 },
  { rank: 15, district: "合川区", score: 72.68 },
  { rank: 16, district: "永川区", score: 75.73 },
  { rank: 17, district: "南川区", score: 76.37 },
  { rank: 18, district: "綦江区", score: 71.38 },
  { rank: 19, district: "大足区", score: 70.21 },
  { rank: 20, district: "璧山区", score: 74.94 },
  { rank: 21, district: "铜梁区", score: 72.88 },
  { rank: 22, district: "潼南区", score: 72.52 },
  { rank: 23, district: "荣昌区", score: 71.14 },
  { rank: 24, district: "开州区", score: 77.14 },
  { rank: 25, district: "梁平区", score: 79.14 },
  { rank: 26, district: "武隆区", score: 71.92 },
  { rank: 27, district: "城口县", score: 72.11 },
  { rank: 28, district: "丰都县", score: 73.28 },
  { rank: 29, district: "垫江县", score: 71.63 },
  { rank: 30, district: "忠县", score: 79.11 },
  { rank: 31, district: "云阳县", score: 82.02 },
  { rank: 32, district: "奉节县", score: 80.53 },
  { rank: 33, district: "巫山县", score: 80.85 },
  { rank: 34, district: "巫溪县", score: 67.99 },
  { rank: 35, district: "石柱县", score: 69.39 },
  { rank: 36, district: "秀山县", score: 73.95 },
  { rank: 37, district: "酉阳县", score: 70.49 },
  { rank: 38, district: "彭水县", score: 72.05 },
  { rank: 39, district: "科学城重庆高新区", score: 72.32 },
  { rank: 40, district: "万盛经开区", score: 72.73 },
  { rank: 41, district: "两江新区", score: 84.48 },
];

// min-max 归一化到 [60, 95]
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 80;
  return Math.round((60 + ((value - min) / (max - min)) * 35) * 100) / 100;
}

async function main() {
  const { db } = await import("@/db");
  const { collectedItems } = await import("@/db/schema/collection");
  const { mediaOutletDictionary } = await import("@/db/schema/media-outlet-dictionary");
  const { researchCollectedItemDistricts, researchCollectedItemTopics } = await import("@/db/schema/research/annotations");
  const { researchTopics } = await import("@/db/schema/research/research-topics");
  const { sql } = await import("drizzle-orm");

  const orgId = "a0000000-0000-4000-8000-000000000001";

  // sql 数组 literal helpers (postgres-js 不接受 string[] 直传 ANY)
  const arr = (names: string[]) =>
    sql`ARRAY[${sql.join(names.map((n) => sql`${n}`), sql`, `)}]::text[]`;
  const districtsSql = arr(DISTRICTS);
  const topicsSql = arr(TOPICS);
  const centralSql = arr(CENTRAL_OUTLETS);
  const industrySql = arr(INDUSTRY_OUTLETS);
  const allTrackedSql = arr([...CENTRAL_OUTLETS, ...INDUSTRY_OUTLETS]);

  console.log(`📊 拉 2025 数据 org=${orgId}`);

  // ── A) 每区县 × 每媒体大类: 报道量 + min/max 时间
  // 中央 / 行业: 按 annotation district 归属 (那些媒体没有"区县属地",一稿提及哪个区就算到哪个区)
  // 区县融媒: 按 outlet 自己的 outlet_district 归属 (这才是"该区融媒发布的稿件",不是"任何区融媒报道提到该区")
  console.log("  → 拉中央/行业 报道总数 + 速度 (按 annotation district)...");
  const centralIndustryStats = await db.execute<{
    district: string; tier: string; cnt: number;
    earliest: string | null; latest: string | null;
  }>(sql`
    SELECT
      d.name AS district,
      CASE WHEN o.outlet_name = ANY(${centralSql}) THEN 'central' ELSE 'industry' END AS tier,
      COUNT(DISTINCT (o.outlet_name, ci.title))::int AS cnt,
      MIN(ci.published_at)::text AS earliest,
      MAX(ci.published_at)::text AS latest
    FROM collected_items ci
    INNER JOIN research_collected_item_districts rd ON rd.collected_item_id = ci.id
    INNER JOIN research_cq_districts d ON d.id = rd.district_id
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND d.name = ANY(${districtsSql})
      AND o.outlet_name = ANY(${allTrackedSql})
      AND ci.published_at >= ${TIME_FROM} AND ci.published_at <= ${TIME_TO}
    GROUP BY d.name, tier
  `);

  console.log("  → 拉区县融媒 报道总数 + 速度 (按 outlet.outlet_district 归属)...");
  const districtMediaStats = await db.execute<{
    district: string; cnt: number;
    earliest: string | null; latest: string | null;
  }>(sql`
    SELECT
      o.outlet_district AS district,
      COUNT(DISTINCT (o.outlet_name, ci.title))::int AS cnt,
      MIN(ci.published_at)::text AS earliest,
      MAX(ci.published_at)::text AS latest
    FROM collected_items ci
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND o.outlet_district = ANY(${districtsSql})
      AND o.outlet_tier = 'district_media'
      AND ci.published_at >= ${TIME_FROM} AND ci.published_at <= ${TIME_TO}
    GROUP BY o.outlet_district
  `);

  // 索引 (district, tier) → stats
  type S = { dedupCount: number; earliest: Date | null; latest: Date | null; spanDays: number; speed: number };
  const tierMap = new Map<string, { central: S; industry: S; district_media: S }>();
  const emptyStats = (): S => ({ dedupCount: 0, earliest: null, latest: null, spanDays: 0, speed: 0 });
  for (const d of DISTRICTS) {
    tierMap.set(d, { central: emptyStats(), industry: emptyStats(), district_media: emptyStats() });
  }
  const buildStats = (cnt: number, earliestStr: string | null, latestStr: string | null): S => {
    const earliest = earliestStr ? new Date(earliestStr) : null;
    const latest = latestStr ? new Date(latestStr) : null;
    const spanDays = earliest && latest ? Math.max(1, Math.round((latest.getTime() - earliest.getTime()) / 86400000) + 1) : 0;
    const speed = spanDays > 0 ? cnt / spanDays : 0;
    return { dedupCount: cnt, earliest, latest, spanDays, speed: Math.round(speed * 1000) / 1000 };
  };
  for (const row of centralIndustryStats) {
    const m = tierMap.get(row.district);
    if (!m) continue;
    m[row.tier as "central" | "industry"] = buildStats(row.cnt, row.earliest, row.latest);
  }
  for (const row of districtMediaStats) {
    const m = tierMap.get(row.district);
    if (!m) continue;
    m.district_media = buildStats(row.cnt, row.earliest, row.latest);
  }

  // ── B) 每区县 × 每媒体大类 × 每主题词: 命中数
  // 中央 + 行业: 按 annotation district 归属
  console.log("  → 拉中央/行业 主题丰富度 (按 annotation district)...");
  const centralIndustryRichness = await db.execute<{
    district: string; topic: string; tier: string; cnt: number;
  }>(sql`
    SELECT
      d.name AS district,
      t.name AS topic,
      CASE WHEN o.outlet_name = ANY(${centralSql}) THEN 'central' ELSE 'industry' END AS tier,
      COUNT(DISTINCT (o.outlet_name, ci.title))::int AS cnt
    FROM collected_items ci
    INNER JOIN research_collected_item_districts rd ON rd.collected_item_id = ci.id
    INNER JOIN research_cq_districts d ON d.id = rd.district_id
    INNER JOIN research_collected_item_topics rt ON rt.collected_item_id = ci.id
    INNER JOIN research_topics t ON t.id = rt.topic_id
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND d.name = ANY(${districtsSql})
      AND t.name = ANY(${topicsSql})
      AND o.outlet_name = ANY(${allTrackedSql})
      AND ci.published_at >= ${TIME_FROM} AND ci.published_at <= ${TIME_TO}
    GROUP BY d.name, t.name, tier
  `);

  // 区县融媒: 按 outlet.outlet_district 归属 — 这才是"该区融媒发布的稿件"
  console.log("  → 拉区县融媒 主题丰富度 (按 outlet.outlet_district)...");
  const districtMediaRichness = await db.execute<{
    district: string; topic: string; cnt: number;
  }>(sql`
    SELECT
      o.outlet_district AS district,
      t.name AS topic,
      COUNT(DISTINCT (o.outlet_name, ci.title))::int AS cnt
    FROM collected_items ci
    INNER JOIN research_collected_item_topics rt ON rt.collected_item_id = ci.id
    INNER JOIN research_topics t ON t.id = rt.topic_id
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND o.outlet_district = ANY(${districtsSql})
      AND t.name = ANY(${topicsSql})
      AND o.outlet_tier = 'district_media'
      AND ci.published_at >= ${TIME_FROM} AND ci.published_at <= ${TIME_TO}
    GROUP BY o.outlet_district, t.name
  `);

  // 索引 (district, topic, tier) → count
  const richMap = new Map<string, number>();
  for (const r of centralIndustryRichness) {
    if (!r.tier) continue;
    richMap.set(`${r.district}|${r.topic}|${r.tier}`, r.cnt);
  }
  for (const r of districtMediaRichness) {
    richMap.set(`${r.district}|${r.topic}|district_media`, r.cnt);
  }

  // 主题丰富度: 每区县在某大类下"覆盖多少个主题"
  // 5.0 版定义: 主题丰富度 = 该区县命中的主题数量(distinct topics with > 0 reports)
  // 但对照 24 年 1-0榜单数据 R5 万州区央媒主题丰富度=12, 数据是 (强 9, 弱 2, 无 1, 报道数 135),
  // 12 是按"加权 = 强*2 + 弱*1 + 无*0 + 报道数 / 16"近似算的
  // 实际 5.0 改"丰富度"后,定义: 区县在该大类下命中报道的"主题数量(0-16)"
  // 我们采用这个口径: 每大类下区县命中了多少个 distinct topics
  function getTopicCoverage(district: string, tier: keyof S extends never ? string : "central" | "industry" | "district_media"): number {
    let count = 0;
    for (const t of TOPICS) {
      const k = `${district}|${t}|${tier}`;
      if ((richMap.get(k) ?? 0) > 0) count += 1;
    }
    return count;
  }

  // ── C) 算原始值 + 计算值
  console.log("  → 计算指数...");
  interface RawValues { central: { count: number; richness: number; speed: number }; industry: { count: number; richness: number; speed: number }; districtMedia: { count: number; richness: number; speed: number }; public: { count: number; richness: number; speed: number } }
  interface CalcValues { central: { count: number; richness: number; speed: number; index: number }; industry: { count: number; richness: number; speed: number; index: number }; districtMedia: { count: number; richness: number; speed: number; index: number }; public: { count: number; richness: number; speed: number; index: number }; composite: number }

  const rawByDistrict = new Map<string, RawValues>();
  for (const d of DISTRICTS) {
    const tm = tierMap.get(d)!;
    rawByDistrict.set(d, {
      central:       { count: tm.central.dedupCount,        richness: getTopicCoverage(d, "central"),        speed: tm.central.speed },
      industry:      { count: tm.industry.dedupCount,       richness: getTopicCoverage(d, "industry"),       speed: tm.industry.speed },
      districtMedia: { count: tm.district_media.dedupCount, richness: getTopicCoverage(d, "district_media"), speed: tm.district_media.speed },
      public:        { count: 0, richness: 0, speed: 0 },  // 暂无数据,后续填环境局活动数据
    });
  }

  // 计算各项的 min/max 用于归一化
  const allCentral = DISTRICTS.map((d) => rawByDistrict.get(d)!.central);
  const allIndustry = DISTRICTS.map((d) => rawByDistrict.get(d)!.industry);
  const allDistMed = DISTRICTS.map((d) => rawByDistrict.get(d)!.districtMedia);
  const m = (arr: number[]) => ({ min: Math.min(...arr), max: Math.max(...arr) });
  const stats = {
    central:       { count: m(allCentral.map(x => x.count)),    richness: m(allCentral.map(x => x.richness)),    speed: m(allCentral.map(x => x.speed)) },
    industry:      { count: m(allIndustry.map(x => x.count)),   richness: m(allIndustry.map(x => x.richness)),   speed: m(allIndustry.map(x => x.speed)) },
    districtMedia: { count: m(allDistMed.map(x => x.count)),    richness: m(allDistMed.map(x => x.richness)),    speed: m(allDistMed.map(x => x.speed)) },
  };

  const calcByDistrict = new Map<string, CalcValues>();
  for (const d of DISTRICTS) {
    const raw = rawByDistrict.get(d)!;
    // 每类指数 = 报道数 × 40% + 丰富度 × 30% + 速度 × 30%(每分项归一化到 [60, 95])
    const calc = (raw: { count: number; richness: number; speed: number }, st: { count: { min: number; max: number }; richness: { min: number; max: number }; speed: { min: number; max: number } }) => {
      const cN = normalize(raw.count, st.count.min, st.count.max);
      const rN = normalize(raw.richness, st.richness.min, st.richness.max);
      const sN = normalize(raw.speed, st.speed.min, st.speed.max);
      const idx = Math.round((cN * 0.4 + rN * 0.3 + sN * 0.3) * 100) / 100;
      return { count: cN, richness: rN, speed: sN, index: idx };
    };
    const central = calc(raw.central, stats.central);
    const industry = calc(raw.industry, stats.industry);
    const dm = calc(raw.districtMedia, stats.districtMedia);
    // 公众指数因无数据固定 80,且各分项也都是 80
    const pub = { count: 80, richness: 80, speed: 80, index: 80 };
    const composite = Math.round((central.index * 0.5 + industry.index * 0.25 + dm.index * 0.15 + pub.index * 0.10) * 100) / 100;
    calcByDistrict.set(d, {
      central, industry, districtMedia: dm, public: pub, composite,
    });
  }

  // 25 年榜单 排名
  const ranking2025 = [...DISTRICTS].map((d) => ({ district: d, composite: calcByDistrict.get(d)!.composite }));
  ranking2025.sort((a, b) => b.composite - a.composite);
  const rank2025Map = new Map<string, number>();
  ranking2025.forEach((r, i) => rank2025Map.set(r.district, i + 1));

  // ─────── 构造 11 个 sheet ───────
  console.log("  → 生成 11 个 sheet...");
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: 0-1统计分工
  const s1: (string | number | null)[][] = [];
  s1.push([null, null, null, null, null, null, null, null]);
  s1.push([null, null, null, null, null, null, null, null]);
  s1.push([null, "数据分工(参考 24 年口径)", null, null, null, null, null, null]);
  s1.push([null, null, "序号", "一级指标", "二级指标", "数据收集主体", "数据整理主体", "数据收集范围"]);
  s1.push([null, "数据分工", 1, "中央媒体传播指数", "报道数量", "采集系统直采", "脚本自动统计", "中央电视台、人民日报、新华社、光明日报全媒体"]);
  s1.push([null, "数据分工", 1, "中央媒体传播指数", "主题丰富度", "采集系统直采", "脚本自动统计", null]);
  s1.push([null, "数据分工", 1, "中央媒体传播指数", "传播速度", "采集系统直采", "脚本自动统计", null]);
  s1.push([null, "数据分工", 2, "行业媒体传播指数", "报道数量", "采集系统直采", "脚本自动统计", "中国环境报、美丽重庆全媒体"]);
  s1.push([null, "数据分工", 2, "行业媒体传播指数", "主题丰富度", "采集系统直采", "脚本自动统计", null]);
  s1.push([null, "数据分工", 2, "行业媒体传播指数", "传播速度", "采集系统直采", "脚本自动统计", null]);
  s1.push([null, "数据分工", 3, "区县媒体传播指数", "报道数量", "采集系统直采", "脚本自动统计", "区县融媒体(政务新媒体不计入,单独一类)"]);
  s1.push([null, "数据分工", 3, "区县媒体传播指数", "主题丰富度", "采集系统直采", "脚本自动统计", null]);
  s1.push([null, "数据分工", 3, "区县媒体传播指数", "传播速度", "采集系统直采", "脚本自动统计", null]);
  s1.push([null, "数据分工", 4, "公众行为引导指数", "待定", "市生态环境局", "环境局上报", "六五环境日、815 全国生态日、志愿服务、公共设施开放、美丽重庆六进等"]);
  s1.push([null, "数据分工", 4, "公众行为引导指数", "(暂无数据)", null, null, null]);
  s1.push([]);
  s1.push([null, "统计分工(本期由系统自动生成)", null, null, null, null, null, null]);
  s1.push([null, null, "负责人", "序号", "区县", null, "备注", null]);
  for (let i = 0; i < DISTRICTS.length; i++) {
    s1.push([null, null, "脚本", i + 1, DISTRICTS[i]!, null, null, null]);
  }
  const ws1 = XLSX.utils.aoa_to_sheet(s1);
  ws1["!cols"] = [{ wch: 4 }, { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, ws1, "0-1统计分工");

  // ── Sheet 2: 0-2关键词
  const TOPIC_ALIASES: Record<string, string> = {
    "美丽中国": "美丽中国建设、生态宜居",
    "综合治理": "生态保护、生态修复、生态环境综合治理、系统治理、环境治理",
    "绿色发展": "绿色低碳、低碳发展、绿色转型、零碳蓝碳",
    "双碳": "碳达峰碳中和、降污减碳、碳交易",
    "和谐共生": "地球生命共同体、绿色丝绸之路",
    "长江生态": "长江经济带生态保护、长江经济带、长江大保护、长江共抓大保护",
    "绿水青山": "绿水青山就是金山银山、两山理念/理论/实践",
    "制度建设": "生态文明制度、生态文明建设、生态文明体制改革",
    "资源节约": "资源节约集约利用、资源可循环",
    "污染防治攻坚战": "蓝天、碧水、净土保卫战",
    "清洁能源": "能源消费革命、新型能源体系、无废城市",
    "国家公园": "国家森林公园",
    "环保督察": "中央生态环境保护督察、环保督查",
    "生物多样性": "生物多样性保护",
    "生态红线": "生态保护红线",
    "低碳经济": "绿色生活、低碳消费",
  };
  const s2: (string | number | null)[][] = [];
  s2.push([]);
  s2.push([null, null, "序号", "共词", "近似称谓", null]);
  for (let i = 0; i < TOPICS.length; i++) {
    s2.push([null, null, i + 1, TOPICS[i]!, TOPIC_ALIASES[TOPICS[i]!] ?? "", null]);
  }
  const ws2 = XLSX.utils.aoa_to_sheet(s2);
  ws2["!cols"] = [{ wch: 4 }, { wch: 4 }, { wch: 8 }, { wch: 16 }, { wch: 60 }, { wch: 4 }];
  XLSX.utils.book_append_sheet(wb, ws2, "0-2关键词");

  // ── Sheet 3: 0-3权重系数
  const s3: (string | number | null)[][] = [];
  s3.push([]);
  s3.push([null, "AHP 层次分析", "判断矩阵表格,如下表:", null, null, null, null, null, null]);
  s3.push([null, null, null, "中央媒体传播指数", "行业媒体传播指数", "区县媒体传播指数", "公众行为引导指数", null, "权重 %"]);
  s3.push([null, null, "中央媒体传播指数", 1, 2, 3.333, 5, null, 50]);
  s3.push([null, null, "行业媒体传播指数", 0.5, 1, 1.667, 2.5, null, 25]);
  s3.push([null, null, "区县媒体传播指数", 0.3, 0.6, 1, 1.5, null, 15]);
  s3.push([null, null, "公众行为引导指数", 0.2, 0.4, 0.667, 1, null, 10]);
  s3.push([]);
  s3.push([null, null, null, null, "第二层(分项权重)", null, null, null, null]);
  s3.push([null, null, null, null, null, "报道数量(数量)", 4, null, null]);
  s3.push([null, null, null, null, null, "主题丰富度", 3, null, null]);
  s3.push([null, null, null, null, null, "传播速度(速度)", 3, null, null]);
  s3.push([]);
  s3.push([null, "综合指数 = 中央 × 50% + 行业 × 25% + 区县 × 15% + 公众 × 10%", null, null, null, null, null, null, null]);
  s3.push([null, "每类指数 = 数量 × 40% + 丰富度 × 30% + 速度 × 30%", null, null, null, null, null, null, null]);
  s3.push([null, "每个分项归一化到 [60, 95] 区间; 公众指数因无数据固定 80", null, null, null, null, null, null, null]);
  const ws3 = XLSX.utils.aoa_to_sheet(s3);
  ws3["!cols"] = [{ wch: 4 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 4 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws3, "0-3权重系数");

  // ── Sheet 4: 0-4结果比较
  const s4: (string | number | null)[][] = [];
  s4.push(["这是 2024 年榜单 5.0 版!2025 年榜单见右侧, 排名变化见同比对比表", null, null, null, null, null, null, null, null, null, null]);
  s4.push(["5.0版(2024)", "5.0版(2024)", "5.0版(2024)", "5.0版(2024)", null, "1.0版(2025)", "1.0版(2025)", "1.0版(2025)", null, "排名变化", "排名变化", "排名变化", "排名变化"]);
  s4.push(["序号", "区县", "综合指数", "排名(按指数)", null, "排名", "区县", "综合指数", null, "区县", "2024 排名", "2025 排名", "排名变化"]);
  // 24 年序号顺序
  for (const r24 of RANKING_2024_V5) {
    s4.push([r24.rank, r24.district, r24.score, null, null, null, null, null, null, null, null, null, null]);
  }
  // 右侧 25 年榜单 (按排名顺序排,会覆盖刚才的空列)
  for (let i = 0; i < ranking2025.length; i++) {
    const r25 = ranking2025[i]!;
    const targetRow = i + 4; // R4 起 (1-indexed,我们 push 用 0-indexed,标题占 0-2 行,数据从 3 起)
    if (s4[targetRow]) {
      s4[targetRow]![5] = i + 1;
      s4[targetRow]![6] = r25.district;
      s4[targetRow]![7] = r25.composite;
    }
  }
  // 排名变化 (按 25 年排名顺序)
  for (let i = 0; i < ranking2025.length; i++) {
    const r25 = ranking2025[i]!;
    // 24 年合并江北/渝北/两江新区 → 取均值
    let r24Score: number | null = null;
    if (r25.district === "两江新区") {
      const jb = RANKING_2024_V5.find((r) => r.district === "江北区")?.score ?? 0;
      const yb = RANKING_2024_V5.find((r) => r.district === "渝北区")?.score ?? 0;
      const lj = RANKING_2024_V5.find((r) => r.district === "两江新区")?.score ?? 0;
      r24Score = Math.round(((jb + yb + lj) / 3) * 100) / 100;
    } else {
      r24Score = RANKING_2024_V5.find((r) => r.district === r25.district)?.score ?? null;
    }
    // 24 年合并后的排名
    const merged24 = DISTRICTS.map((d) => {
      let score: number;
      if (d === "两江新区") {
        const jb = RANKING_2024_V5.find((r) => r.district === "江北区")?.score ?? 0;
        const yb = RANKING_2024_V5.find((r) => r.district === "渝北区")?.score ?? 0;
        const lj = RANKING_2024_V5.find((r) => r.district === "两江新区")?.score ?? 0;
        score = (jb + yb + lj) / 3;
      } else {
        score = RANKING_2024_V5.find((r) => r.district === d)?.score ?? 0;
      }
      return { district: d, score };
    });
    merged24.sort((a, b) => b.score - a.score);
    const r24Rank = merged24.findIndex((m) => m.district === r25.district) + 1;
    const diff = r24Rank - (i + 1);
    const change = diff > 0 ? `↑ ${diff}` : diff < 0 ? `↓ ${Math.abs(diff)}` : "0";
    const targetRow = i + 4;
    if (s4[targetRow]) {
      s4[targetRow]![9] = r25.district;
      s4[targetRow]![10] = r24Rank;
      s4[targetRow]![11] = i + 1;
      s4[targetRow]![12] = change;
    }
  }
  const ws4 = XLSX.utils.aoa_to_sheet(s4);
  ws4["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 4 }, { wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 4 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws4, "0-4结果比较");

  // ── Sheet 5: 1-0榜单数据 (原始值 + 计算值 + 综合)
  const s5: (string | number | null)[][] = [];
  s5.push([null, "原始值", "原始值", "原始值", "原始值", "原始值", "原始值", "原始值", "原始值", "原始值", "原始值", "原始值", "原始值", "原始值", null, "计算值", "计算值", "计算值", "计算值", "计算值", "计算值", "计算值", "计算值", "计算值", "计算值", "计算值", "计算值", "计算值"]);
  s5.push([null, null, null, "中央媒体传播指数", null, null, "行业媒体传播指数", null, null, "区县媒体传播指数", null, null, "公众行为引导指数", null, null, null, null, "中央媒体传播指数", null, null, "行业媒体传播指数", null, null, "区县媒体传播指数", null, null, "公众行为引导指数", "综合指数"]);
  s5.push([null, "序号", "区县", "报道数", "主题丰富度", "传播速度", "报道数", "主题丰富度", "传播速度", "报道数", "主题丰富度", "传播速度", "活动数", "丰富度", "速度", "序号", "区县", "数量", "丰富度", "速度", "数量", "丰富度", "速度", "数量", "丰富度", "速度", "(固定 80)", "综合得分"]);
  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i]!;
    const raw = rawByDistrict.get(d)!;
    const calc = calcByDistrict.get(d)!;
    s5.push([
      null, i + 1, d,
      raw.central.count, raw.central.richness, raw.central.speed,
      raw.industry.count, raw.industry.richness, raw.industry.speed,
      raw.districtMedia.count, raw.districtMedia.richness, raw.districtMedia.speed,
      0, 0, 0,  // 公众原始
      i + 1, d,
      calc.central.count, calc.central.richness, calc.central.speed,
      calc.industry.count, calc.industry.richness, calc.industry.speed,
      calc.districtMedia.count, calc.districtMedia.richness, calc.districtMedia.speed,
      calc.public.index,
      calc.composite,
    ]);
  }
  const ws5 = XLSX.utils.aoa_to_sheet(s5);
  XLSX.utils.book_append_sheet(wb, ws5, "1-0榜单数据");

  // ── 拉 8 个媒体细分 (中央 4 + 行业 2 + 区县融媒 + 政务媒体) 用于 1报道篇数 + 2-1央媒丰富度
  console.log("  → 拉 8 个媒体的 (区县×主题) 细分...");
  const centralIndustryBreakdown = await db.execute<{
    district: string; topic: string; outlet_name: string; cnt: number;
  }>(sql`
    SELECT d.name AS district, t.name AS topic, o.outlet_name, COUNT(DISTINCT (o.outlet_name, ci.title))::int AS cnt
    FROM collected_items ci
    INNER JOIN research_collected_item_districts rd ON rd.collected_item_id = ci.id
    INNER JOIN research_cq_districts d ON d.id = rd.district_id
    INNER JOIN research_collected_item_topics rt ON rt.collected_item_id = ci.id
    INNER JOIN research_topics t ON t.id = rt.topic_id
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND d.name = ANY(${districtsSql})
      AND t.name = ANY(${topicsSql})
      AND o.outlet_name = ANY(${allTrackedSql})
      AND ci.published_at >= ${TIME_FROM} AND ci.published_at <= ${TIME_TO}
    GROUP BY d.name, t.name, o.outlet_name
  `);
  const dmBreakdown = await db.execute<{
    district: string; topic: string; cnt: number;
  }>(sql`
    SELECT o.outlet_district AS district, t.name AS topic, COUNT(DISTINCT (o.outlet_name, ci.title))::int AS cnt
    FROM collected_items ci
    INNER JOIN research_collected_item_topics rt ON rt.collected_item_id = ci.id
    INNER JOIN research_topics t ON t.id = rt.topic_id
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND o.outlet_district = ANY(${districtsSql})
      AND t.name = ANY(${topicsSql})
      AND o.outlet_tier = 'district_media'
      AND ci.published_at >= ${TIME_FROM} AND ci.published_at <= ${TIME_TO}
    GROUP BY o.outlet_district, t.name
  `);
  const govBreakdown = await db.execute<{
    district: string; topic: string; cnt: number;
  }>(sql`
    SELECT o.outlet_district AS district, t.name AS topic, COUNT(DISTINCT (o.outlet_name, ci.title))::int AS cnt
    FROM collected_items ci
    INNER JOIN research_collected_item_topics rt ON rt.collected_item_id = ci.id
    INNER JOIN research_topics t ON t.id = rt.topic_id
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND o.outlet_district = ANY(${districtsSql})
      AND t.name = ANY(${topicsSql})
      AND o.outlet_tier = 'government_self_media'
      AND ci.published_at >= ${TIME_FROM} AND ci.published_at <= ${TIME_TO}
    GROUP BY o.outlet_district, t.name
  `);
  const centralMap = new Map<string, number>();
  for (const r of centralIndustryBreakdown) centralMap.set(`${r.district}|${r.topic}|${r.outlet_name}`, r.cnt);
  const dmMap = new Map<string, number>();
  for (const r of dmBreakdown) dmMap.set(`${r.district}|${r.topic}`, r.cnt);
  const govMap = new Map<string, number>();
  for (const r of govBreakdown) govMap.set(`${r.district}|${r.topic}`, r.cnt);

  // ── Sheet 5.5: 1报道词数
  // 词数 = 主题词命中次数(一稿命中 3 主题 = 3 词)
  // 段一 = 39 区县 × 4 大类的词数汇总
  // 段二 = 39×16×8 媒体的细分词数(段二行 sum == 段一对应大类词数)
  console.log("  → 拉词数汇总 (主题词命中次数)...");

  const ciAgg = await db.execute<{
    district: string; tier: string; word_count: number;
  }>(sql`
    SELECT
      d.name AS district,
      CASE
        WHEN o.outlet_name = ANY(${centralSql}) THEN 'central'
        WHEN o.outlet_name = ANY(${industrySql}) THEN 'industry'
      END AS tier,
      COUNT(DISTINCT (o.outlet_name, ci.title, t.name))::int AS word_count
    FROM research_collected_item_topics rt
    INNER JOIN research_topics t ON t.id = rt.topic_id
    INNER JOIN collected_items ci ON ci.id = rt.collected_item_id
    INNER JOIN research_collected_item_districts rd ON rd.collected_item_id = ci.id
    INNER JOIN research_cq_districts d ON d.id = rd.district_id
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND d.name = ANY(${districtsSql})
      AND t.name = ANY(${topicsSql})
      AND o.outlet_name = ANY(${allTrackedSql})
      AND ci.published_at >= ${TIME_FROM} AND ci.published_at <= ${TIME_TO}
    GROUP BY d.name, tier
  `);
  const dmWordCount = await db.execute<{ district: string; word_count: number }>(sql`
    SELECT o.outlet_district AS district,
      COUNT(DISTINCT (o.outlet_name, ci.title, t.name))::int AS word_count
    FROM research_collected_item_topics rt
    INNER JOIN research_topics t ON t.id = rt.topic_id
    INNER JOIN collected_items ci ON ci.id = rt.collected_item_id
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND o.outlet_district = ANY(${districtsSql})
      AND t.name = ANY(${topicsSql})
      AND o.outlet_tier = 'district_media'
      AND ci.published_at >= ${TIME_FROM} AND ci.published_at <= ${TIME_TO}
    GROUP BY o.outlet_district
  `);
  const govWordCount = await db.execute<{ district: string; word_count: number }>(sql`
    SELECT o.outlet_district AS district,
      COUNT(DISTINCT (o.outlet_name, ci.title, t.name))::int AS word_count
    FROM research_collected_item_topics rt
    INNER JOIN research_topics t ON t.id = rt.topic_id
    INNER JOIN collected_items ci ON ci.id = rt.collected_item_id
    INNER JOIN media_outlet_dictionary o ON o.id = ci.outlet_id
    WHERE ci.organization_id = ${orgId}
      AND o.outlet_district = ANY(${districtsSql})
      AND t.name = ANY(${topicsSql})
      AND o.outlet_tier = 'government_self_media'
      AND ci.published_at >= ${TIME_FROM} AND ci.published_at <= ${TIME_TO}
    GROUP BY o.outlet_district
  `);

  const wordCountMap = new Map<string, { central: number; industry: number; dm: number; gov: number }>();
  for (const d of DISTRICTS) wordCountMap.set(d, { central: 0, industry: 0, dm: 0, gov: 0 });
  for (const r of ciAgg) {
    const m = wordCountMap.get(r.district);
    if (!m || !r.tier) continue;
    if (r.tier === "central") m.central = r.word_count;
    else if (r.tier === "industry") m.industry = r.word_count;
  }
  for (const r of dmWordCount) { const m = wordCountMap.get(r.district); if (m) m.dm = r.word_count; }
  for (const r of govWordCount) { const m = wordCountMap.get(r.district); if (m) m.gov = r.word_count; }

  const s_baodao: (string | number | null)[][] = [];
  s_baodao.push([null, "1 报道词数 — 主题词命中次数(一稿命中 3 个主题 = 3 词)", null, null, null, null, null, null, null, null, null, null, null]);
  s_baodao.push([null, "匹配规则:matcher 扫描 title + content + ocr + asr + tags + matched_keywords + raw_metadata.keyword;任一字段命中任一关键词即记为该主题命中 1 词", null, null, null, null, null, null, null, null, null, null, null]);
  s_baodao.push([]);
  s_baodao.push([null, "段一:39 区县 × 4 大类的报道词数汇总", null, null, null, null, null, null, null, null, null, null, null]);
  s_baodao.push([null, "序号", "区县", "中央媒体词数", "行业媒体词数", "区县融媒词数", "政务媒体词数", "总词数", null, null, null, null, null]);

  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i]!;
    const w = wordCountMap.get(d)!;
    const total = w.central + w.industry + w.dm + w.gov;
    s_baodao.push([null, i + 1, d, w.central, w.industry, w.dm, w.gov, total, null, null, null, null, null]);
  }
  s_baodao.push([]);
  s_baodao.push([]);
  s_baodao.push([null, "段二:39 区县 × 16 主题 × 8 媒体的细分词数(共 624 行)", null, null, null, null, null, null, null, null, null, null, null]);
  s_baodao.push([null, "段二每个 cell = (区县, 主题, 媒体)下命中该主题的稿件数(同 outlet 同 title 算 1 次)。段二每个区县 16 行在某媒体列求和 = 段一对应大类词数。", null, null, null, null, null, null, null, null, null, null, null]);
  s_baodao.push([null, "序号", "区县", "关键词", "央视新闻", "人民日报", "新华社", "光明日报", "中国环境报", "美丽重庆", "区县融媒", "政务媒体", "合计"]);
  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i]!;
    for (const t of TOPICS) {
      const cctv = centralMap.get(`${d}|${t}|央视新闻(中央广播电视总台)`) ?? centralMap.get(`${d}|${t}|央视新闻（中央广播电视总台）`) ?? 0;
      const rmrb = centralMap.get(`${d}|${t}|人民日报`) ?? 0;
      const xhs = centralMap.get(`${d}|${t}|新华社`) ?? 0;
      const gmrb = centralMap.get(`${d}|${t}|光明日报`) ?? 0;
      const zhb = centralMap.get(`${d}|${t}|中国环境报`) ?? 0;
      const mlcq = centralMap.get(`${d}|${t}|美丽重庆`) ?? 0;
      const dm = dmMap.get(`${d}|${t}`) ?? 0;
      const gov = govMap.get(`${d}|${t}`) ?? 0;
      const sum = cctv + rmrb + xhs + gmrb + zhb + mlcq + dm + gov;
      s_baodao.push([null, i + 1, d, t, cctv, rmrb, xhs, gmrb, zhb, mlcq, dm, gov, sum]);
    }
  }
  s_baodao.push([]);
  s_baodao.push([null, "归属口径说明:", null, null, null, null, null, null, null, null, null, null, null]);
  s_baodao.push([null, "中央 / 行业媒体:按 annotation district(任何媒体报道提到该区即计入)", null, null, null, null, null, null, null, null, null, null, null]);
  s_baodao.push([null, "区县融媒 / 生态环境政务媒体:按 outlet.outlet_district(该区融媒/政务自己发布的稿件)", null, null, null, null, null, null, null, null, null, null, null]);

  const ws_baodao = XLSX.utils.aoa_to_sheet(s_baodao);
  ws_baodao["!cols"] = [
    { wch: 3 }, { wch: 5 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 10 }, { wch: 11 }, { wch: 9 }, { wch: 10 }, { wch: 12 }, { wch: 9 },
  ];
  XLSX.utils.book_append_sheet(wb, ws_baodao, "1报道词数");

  // ──── 三个丰富度 sheet 通用算法 ────
  // 公式来源: 24 年《指数体系》0-1统计分工 R22:
  //   "计算公式为 F = 1/Σ|i - 1/N|, 其中 i 为每一类主题报道占本区县全部报道的比例, N 为主题数量(=16)"
  //
  // 具体算法:
  //   1. 对每个区县 d、每个媒体大类 m,先算 16 个主题在该 (区县,大类) 下的词数 c_{d,m,t}
  //   2. 词数总和 n_{d,m} = Σ_t c_{d,m,t}
  //   3. 每个主题占比 p_{d,m,t} = c_{d,m,t} / n_{d,m}
  //   4. 主题差值 diff_{d,m,t} = |p_{d,m,t} - 1/16|
  //   5. Σ差值 = Σ_t diff_{d,m,t}
  //   6. 丰富度 F_{d,m} = 1 / Σ差值
  //
  // 注: 24 年截图中"中央媒体丰富度 0.23"跟标准 F 公式不一致(应该是 ≈1.4),
  //     疑为 24 年模板的旧版残留;以 24 年 0-1 文档定义的 F 为准。
  //     行媒/区媒的 24 年数字(1.41 / 0.62)跟本公式 1/Σ 一致。
  function buildRichnessSheet(tier: "central" | "industry" | "district_media", title: string, sample_d: string) {
    const N = TOPICS.length; // 16
    const ideal = 1 / N;

    type Row = { d: string; counts: number[]; total: number; props: number[]; diffs: number[]; sum: number; F: number };
    const rows: Row[] = DISTRICTS.map((d) => {
      const counts = TOPICS.map((t) => richMap.get(`${d}|${t}|${tier}`) ?? 0);
      const total = counts.reduce((a, b) => a + b, 0);
      const props = total > 0 ? counts.map((c) => c / total) : counts.map(() => 0);
      const diffs = props.map((p) => Math.abs(p - ideal));
      const sum = diffs.reduce((a, b) => a + b, 0);
      const F = sum > 0 ? 1 / sum : 0;
      return { d, counts, total, props, diffs, sum, F };
    });

    const s: (string | number | null)[][] = [];
    s.push([null, title, ...Array(N + 3).fill(null)]);
    s.push([null, "公式: F = 1 / Σ|p_t - 1/N|, N=16, p_t = 主题 t 词数 / 该区县大类总词数", ...Array(N + 3).fill(null)]);
    s.push([null, "F 越大 → 16 主题分布越均匀;F 越小 → 主题集中在少数几个上", ...Array(N + 3).fill(null)]);

    // 计算示例 (用样本区县)
    const sample = rows.find((r) => r.d === sample_d) ?? rows[0]!;
    s.push([]);
    s.push([null, `算法演示(以 ${sample.d} 为例):`, ...Array(N + 3).fill(null)]);
    s.push([null, `  · 该区县在本大类下总词数 = ${sample.total}`, ...Array(N + 3).fill(null)]);
    const topMaxIdx = sample.props.indexOf(Math.max(...sample.props));
    s.push([null, `  · 占比最高主题:${TOPICS[topMaxIdx]} = ${(sample.props[topMaxIdx]! * 100).toFixed(2)}%, 差值 |p-1/16| = ${(sample.diffs[topMaxIdx]! * 100).toFixed(2)}%`, ...Array(N + 3).fill(null)]);
    s.push([null, `  · Σ差值 = ${(sample.sum * 100).toFixed(2)}%, F = 1/${(sample.sum * 100).toFixed(2)}% × 100% = ${(sample.F).toFixed(2)}`, ...Array(N + 3).fill(null)]);
    s.push([]);

    // 段一: 比例值层(每行 1 区县)
    s.push([null, "段一·比例值层 (每行 = 1 区县)", ...Array(N + 3).fill(null)]);
    s.push(["序号", "区县", ...TOPICS, "总词数", "丰富度 F"]);
    rows.forEach((r, i) => {
      s.push([
        i + 1, r.d,
        ...r.props.map((p) => (p * 100).toFixed(2) + "%"),
        r.total,
        Math.round(r.F * 100) / 100,
      ]);
    });

    s.push([]);
    // 段二: 差值绝对值层
    s.push([null, "段二·差值绝对值层 (|p_t - 1/16|, 单位: %)", ...Array(N + 3).fill(null)]);
    s.push(["序号", "区县", ...TOPICS, "Σ差值 (%)", "F = 1/Σ"]);
    rows.forEach((r, i) => {
      s.push([
        i + 1, r.d,
        ...r.diffs.map((diff) => (diff * 100).toFixed(2) + "%"),
        (r.sum * 100).toFixed(2) + "%",
        Math.round(r.F * 100) / 100,
      ]);
    });

    return s;
  }

  // ── Sheet 7: 2-1央媒丰富度
  const s_central = buildRichnessSheet("central", "2-1 央媒丰富度 (中央 4 媒体: 央视新闻 + 人民日报 + 新华社 + 光明日报)", "万州区");
  const ws_central = XLSX.utils.aoa_to_sheet(s_central);
  ws_central["!cols"] = [{ wch: 6 }, { wch: 16 }, ...TOPICS.map(() => ({ wch: 10 })), { wch: 9 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws_central, "2-1央媒丰富度");

  // ── Sheet 8: 2-2行媒丰富度
  const s_industry = buildRichnessSheet("industry", "2-2 行媒丰富度 (行业 2 媒体: 中国环境报 + 美丽重庆)", "万州区");
  const ws_industry = XLSX.utils.aoa_to_sheet(s_industry);
  ws_industry["!cols"] = [{ wch: 6 }, { wch: 16 }, ...TOPICS.map(() => ({ wch: 10 })), { wch: 9 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws_industry, "2-2行媒丰富度");

  // ── Sheet 9: 2-3区媒丰富度
  const s_dm = buildRichnessSheet("district_media", "2-3 区媒丰富度 (各区融媒体, 按 outlet.outlet_district 归属)", "万州区");
  const ws_dm = XLSX.utils.aoa_to_sheet(s_dm);
  ws_dm["!cols"] = [{ wch: 6 }, { wch: 16 }, ...TOPICS.map(() => ({ wch: 10 })), { wch: 9 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws_dm, "2-3区媒丰富度");

  // ── Sheet 9: 3传播速度+报道量
  // 注: 25 年数据库已按 content_fingerprint 唯一约束去重,所有数据本身即"去重后",
  // 不存在 24 年那种"去重前/去重后"两列。本表只展示去重后报道量 + 传播速度。
  // 区县融媒数据按 outlet.outlet_district 归属(即该区融媒发布的稿件数),
  // 与中央/行业按 annotation district(任何媒体报道提到该区)口径不同。
  const s9: (string | number | null)[][] = [];
  s9.push([null, "3 报道量 + 传播速度(按媒体大类)", null, null, null, null, null, null, null]);
  s9.push([null, "说明:25 年数据库的稿件按 content_fingerprint 唯一约束去重,展示的均为去重后值", null, null, null, null, null, null, null]);
  s9.push([null, "中央/行业:按 annotation district 归属(媒体报道提及该区即计入)", null, null, null, null, null, null, null]);
  s9.push([null, "区县融媒:按 outlet.outlet_district 归属(该区融媒自己发布的稿件)", null, null, null, null, null, null, null]);
  s9.push([]);
  s9.push([null, "序号", "区县", "中央报道", "行业报道", "区县融媒报道", "合计", "央媒速度", "行媒速度", "区媒速度"]);
  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i]!;
    const m = tierMap.get(d)!;
    const totalCount = m.central.dedupCount + m.industry.dedupCount + m.district_media.dedupCount;
    s9.push([
      null, i + 1, d,
      m.central.dedupCount, m.industry.dedupCount, m.district_media.dedupCount, totalCount,
      m.central.speed, m.industry.speed, m.district_media.speed,
    ]);
  }
  s9.push([]);
  s9.push([null, "传播速度 = 报道量 ÷ 时间跨度(天), 单位: 次/天", null, null, null, null, null, null, null, null]);
  const ws9 = XLSX.utils.aoa_to_sheet(s9);
  ws9["!cols"] = [{ wch: 4 }, { wch: 6 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws9, "3报道量+传播速度");

  // ── Sheet 10: 4宣传活动指标 (留空模板,等待重庆市生态环境局上报线下活动数据)
  // 5 个主题活动: 六五环境日 / 815全国生态日 / 志愿服务活动 / 环保设施向公众开放 / 美丽重庆六进活动
  const s_huodong: (string | number | null)[][] = [];
  s_huodong.push([null, "4 宣传活动指标(数据来源:重庆市生态环境局区县上报《2025 年线下生态文明宣传活动信息收集表》)", null, null, null, null, null, null, null, null, null, null]);
  s_huodong.push([null, "⚠ 本表当前为空模板,2025 年线下宣传活动数据待环境局上报后填入(24 年共收集 1194 场活动)", null, null, null, null, null, null, null, null, null, null]);
  s_huodong.push([null, null, null, "主题 1", "主题 2", "主题 3", "主题 4", "主题 5", null, "*输入日期保存为数值", null, null]);
  s_huodong.push([null, null, null, "活动场数", "活动场数", "活动场数", "活动场数", "活动场数", "活动总数", "传播速度", "传播速度", "传播速度"]);
  s_huodong.push([null, "序号", "区县", "六五环境日", "815 全国生态日", "志愿服务活动", "环保设施向公众开放", "美丽重庆六进活动", null, "最晚日期", "最早日期", "计算值(场/天)"]);
  // 41 行区县,数据全部留空
  for (let i = 0; i < DISTRICTS.length; i++) {
    s_huodong.push([null, i + 1, DISTRICTS[i]!, null, null, null, null, null, null, null, null, null]);
  }
  s_huodong.push([]);
  s_huodong.push([null, "说明:", null, null, null, null, null, null, null, null, null, null]);
  s_huodong.push([null, "1. 公众行为引导指数 = 活动数量 × 40% + 活动主题丰富度 × 30% + 活动传播速度 × 30%", null, null, null, null, null, null, null, null, null, null]);
  s_huodong.push([null, "2. 5 类主题:六五环境日(6.5)、8·15 全国生态日、志愿服务活动、环保设施向公众开放、美丽重庆六进活动", null, null, null, null, null, null, null, null, null, null]);
  s_huodong.push([null, "3. 活动主题丰富度 F = 1 / Σ|p_i - 1/5|,其中 p_i 为各主题占总数比例。F 越大,各主题分布越均匀。", null, null, null, null, null, null, null, null, null, null]);
  s_huodong.push([null, "4. 传播速度 = 活动总数 ÷ (最晚日期 - 最早日期 + 1)", null, null, null, null, null, null, null, null, null, null]);
  s_huodong.push([null, "5. 数据无后续 5.0 版可用之前,1-0 榜单中公众行为指数固定 80(同 24 年口径)", null, null, null, null, null, null, null, null, null, null]);
  const ws_huodong = XLSX.utils.aoa_to_sheet(s_huodong);
  ws_huodong["!cols"] = [{ wch: 4 }, { wch: 5 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 9 }, { wch: 11 }, { wch: 11 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws_huodong, "4宣传活动指标");

  const outPath = "docs/ranking-v5-2025.xlsx";
  XLSX.writeFile(wb, outPath);
  console.log(`✓ 导出完成 → ${outPath}`);

  // 摘要
  console.log("\n=== 25 年榜单 Top 10 ===");
  for (let i = 0; i < 10; i++) {
    const r = ranking2025[i]!;
    console.log(`  ${i + 1}. ${r.district}  ${r.composite}`);
  }

  process.exit(0);
}

main().catch((err) => { console.error("fatal:", err); process.exit(1); });
