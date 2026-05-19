/**
 * scripts/export-theme-matrix-xlsx.ts
 *
 * 按客户主题统计表导出 (区县 × 主题词 × 媒体源) 三维矩阵。
 *
 * 口径(2026-05-20 对齐):
 *   - 39 个区县(江北区/渝北区合并到两江新区)
 *   - 16 个主题词(按 DB 实际名,如"环保督察"不写"环保督查")
 *   - 媒体源列按 DB 字典实际 outlet_name(如"新重庆（重庆日报）"非"重庆日报官网")
 *   - 区县融媒体 / 区县生态环境局两列按 tier 汇总
 *
 * 数据来源:
 *   - computeThemeMatrix(orgId) 拉聚合(依赖 research_collected_item_topics /
 *     research_collected_item_districts annotation 表;先跑 backfill-annotate)
 *
 * 用法:
 *   npx tsx scripts/export-theme-matrix-xlsx.ts                        # 默认 org + 不限时间
 *   npx tsx scripts/export-theme-matrix-xlsx.ts <orgId>
 *   npx tsx scripts/export-theme-matrix-xlsx.ts <orgId> 2025-01-01 2025-12-31
 *   # 输出 docs/theme-matrix-export.xlsx
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import * as XLSX from "xlsx";

// 39 个重庆区县,顺序:中心城区 → 主城新区 → 渝东北 → 渝东南
// 江北区/渝北区合并到两江新区(实体保留为 outlet,统计归到两江新区行)
const DISTRICTS_IN_EXCEL_ORDER = [
  "万州区","黔江区","涪陵区","渝中区","大渡口区","沙坪坝区","九龙坡区","南岸区","北碚区",
  "巴南区","长寿区","江津区","合川区","永川区","南川区","綦江区","大足区","璧山区",
  "铜梁区","潼南区","荣昌区","开州区","梁平区","武隆区","城口县","丰都县","垫江县","忠县",
  "云阳县","奉节县","巫山县","巫溪县","石柱县","秀山县","酉阳县","彭水县",
  "科学城重庆高新区","万盛经开区","两江新区",
];

// 16 个主题词,按 DB 实际名("环保督察"而非"环保督查")
const TOPICS_IN_EXCEL_ORDER = [
  "美丽中国","综合治理","绿色发展","双碳","和谐共生","长江生态","绿水青山","制度建设",
  "资源节约","污染防治攻坚战","清洁能源","国家公园","环保督察","生物多样性","生态红线","低碳经济",
];

type OutletColumn =
  | { kind: "outlet"; excelHeader: string; outletName: string; group: string; method: string }
  | { kind: "tier"; excelHeader: string; tier: string; group: string; method: string };

// 14 个数据列 — excelHeader = outlet_name(用户口径"按 DB 实际名")
const OUTLET_COLUMNS: OutletColumn[] = [
  { kind: "outlet", excelHeader: "央视新闻（中央广播电视总台）", outletName: "央视新闻（中央广播电视总台）", group: "中央媒体报道数量", method: "官网（央视新闻）" },
  { kind: "outlet", excelHeader: "人民日报",                      outletName: "人民日报",                      group: "中央媒体报道数量", method: "官网" },
  { kind: "outlet", excelHeader: "新华社",                        outletName: "新华社",                        group: "中央媒体报道数量", method: "官网" },
  { kind: "outlet", excelHeader: "光明日报",                      outletName: "光明日报",                      group: "中央媒体报道数量", method: "官网" },
  { kind: "outlet", excelHeader: "上游新闻",                      outletName: "上游新闻",                      group: "市级媒体报道数量", method: "官网" },
  { kind: "outlet", excelHeader: "华龙网",                        outletName: "华龙网",                        group: "市级媒体报道数量", method: "官网" },
  { kind: "outlet", excelHeader: "重庆广电",                      outletName: "重庆广电",                      group: "市级媒体报道数量", method: "官网" },
  { kind: "outlet", excelHeader: "新重庆（重庆日报）",            outletName: "新重庆（重庆日报）",            group: "市级媒体报道数量", method: "官网" },
  { kind: "outlet", excelHeader: "西部国际传播中心",              outletName: "西部国际传播中心",              group: "市级媒体报道数量", method: "官网" },
  { kind: "outlet", excelHeader: "七一网 / 七一客户端",           outletName: "七一网 / 七一客户端",           group: "市级媒体报道数量", method: "官网" },
  { kind: "outlet", excelHeader: "中国环境报",                    outletName: "中国环境报",                    group: "行业媒体报道数量", method: "官网" },
  { kind: "outlet", excelHeader: "美丽重庆",                      outletName: "美丽重庆",                      group: "行业媒体报道数量", method: "官网" },
  { kind: "tier",   excelHeader: "区县融媒体",                    tier: "district_media",                       group: "区县融媒体报道数量", method: "微信微博分别收集汇总去重" },
  { kind: "tier",   excelHeader: "区县生态环境局",                tier: "government_self_media",                group: "区县环境局报道数量",  method: "微信微博分别收集汇总去重" },
];

async function main() {
  const orgArg = process.argv[2];
  const fromArg = process.argv[3];
  const toArg = process.argv[4];

  const { db } = await import("@/db");
  const { organizations } = await import("@/db/schema/users");
  const { computeThemeMatrix } = await import("@/lib/dal/research/theme-matrix");

  let orgId = orgArg;
  if (!orgId) {
    const rows = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).limit(5);
    if (rows.length === 0) { console.error("DB 中没有 organization"); process.exit(1); }
    if (rows.length > 1) {
      console.error("多个 org,请显式传 orgId:");
      for (const r of rows) console.error(`  ${r.id}  ${r.name}`);
      process.exit(1);
    }
    orgId = rows[0]!.id;
    console.log(`使用默认 org: ${orgId} (${rows[0]!.name})`);
  }

  const publishedAtFrom = fromArg ? new Date(fromArg) : undefined;
  const publishedAtTo = toArg ? new Date(toArg) : undefined;

  console.log(
    `📊 拉聚合 org=${orgId} 时间=${fromArg ?? "不限"} ~ ${toArg ?? "不限"} ...`,
  );

  const cells = await computeThemeMatrix({
    organizationId: orgId,
    publishedAtFrom,
    publishedAtTo,
    includeUndated: !publishedAtFrom && !publishedAtTo,
  });
  console.log(`  → 拉到 ${cells.length} 个 (district × topic × outlet × channel) 聚合 cell`);

  // 透视 → Map<`${district}__${topic}__${outletKey}`, count>
  // 同一稿件按 channel 拆 1:1,这里把所有 channel 求和填到 outlet 单元格
  const pivot = new Map<string, number>();
  for (const c of cells) {
    let outletKey: string;
    if (c.outletTier === "district_media") outletKey = "TIER__district_media";
    else if (c.outletTier === "government_self_media") outletKey = "TIER__government_self_media";
    else outletKey = `OUTLET__${c.outletName ?? "__UNCLASSIFIED__"}`;
    // tier 维度:district_media / government_self_media 按 outlet.outletDistrict 归口
    // (例:江北发布 outletDistrict=两江新区 → 算两江新区行)
    const districtScope =
      c.outletTier === "district_media" || c.outletTier === "government_self_media"
        ? (c.outletDistrict ?? c.districtName)
        : c.districtName;
    const key = `${districtScope}__${c.topicName}__${outletKey}`;
    pivot.set(key, (pivot.get(key) ?? 0) + c.count);
  }

  // 构造 AOA 表头(3 行)
  const aoa: (string | number | null)[][] = [];
  aoa.push([null, null, "二级指标", ...OUTLET_COLUMNS.map((c) => c.group)]);
  aoa.push([null, null, "收集方式", ...OUTLET_COLUMNS.map((c) => c.method)]);
  aoa.push(["序号", "区县", "主题词", ...OUTLET_COLUMNS.map((c) => c.excelHeader)]);

  let nonZeroCells = 0;
  for (let i = 0; i < DISTRICTS_IN_EXCEL_ORDER.length; i++) {
    const district = DISTRICTS_IN_EXCEL_ORDER[i]!;
    for (let j = 0; j < TOPICS_IN_EXCEL_ORDER.length; j++) {
      const topic = TOPICS_IN_EXCEL_ORDER[j]!;
      const row: (string | number | null)[] = [i + 1, district, topic];
      for (const col of OUTLET_COLUMNS) {
        const outletKey =
          col.kind === "tier" ? `TIER__${col.tier}` : `OUTLET__${col.outletName}`;
        const key = `${district}__${topic}__${outletKey}`;
        const v = pivot.get(key) ?? 0;
        row.push(v);
        if (v > 0) nonZeroCells += 1;
      }
      aoa.push(row);
    }
  }

  console.log(`  → 写 ${aoa.length - 3} 行 × ${OUTLET_COLUMNS.length} 数据列,非零单元格 ${nonZeroCells}`);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 14 },
    ...OUTLET_COLUMNS.map(() => ({ wch: 18 })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "3.主题重复报道数量统计表");

  const outPath = "docs/theme-matrix-export.xlsx";
  XLSX.writeFile(wb, outPath);
  console.log(`✓ 导出完成 → ${outPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
