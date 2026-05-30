/**
 * scripts/export-scope-content-xlsx.ts
 *
 * 按 /tmp/media-scope-final.json 范围内的 94 家媒体, 把 2025 年所有 collected_items
 * 按"内容池" (data-collection/content) 的标准导出模板导出为 xlsx
 *
 * 用项目自带的 EXPORT_COLUMN_ORDER + exportRowToOpinionRecord 标准转换器,
 * 保证导出格式与"内容池 → 导出 Excel" 完全一致(33 列, 列顺序 / 字段映射 / 格式化都相同)
 *
 * 输出: docs/scope-content-2025.xlsx
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { readFileSync, writeFileSync } from "node:fs";

const SCOPE_PATH = "/tmp/media-scope-final.json";
const OUT_PATH = "/Users/zhuyu/dev/chinamcloud/vibetide/docs/scope-content-2025.xlsx";

type Unit = {
  id: string; name: string; tier: string;
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
  const { collectedItems, collectedItemContents } = await import("@/db/schema/collection");
  const { mediaOutletDictionary } = await import("@/db/schema/media-outlet-dictionary");
  const { sql, and, eq, gte, lt, desc, inArray, getTableColumns } = await import("drizzle-orm");
  const { exportRowToOpinionRecord, EXPORT_COLUMN_ORDER } = await import("@/lib/collection/bulk-export/opinion-export");
  const XLSX = await import("@e965/xlsx");

  const scope: Scope = JSON.parse(readFileSync(SCOPE_PATH, "utf-8"));
  const orgRows = await db.execute(sql`SELECT id FROM organizations LIMIT 1`);
  const orgId = (orgRows as any)[0].id;
  console.log(`org: ${orgId}\n`);

  // 1) 把 94 个 unit 收集成数组
  const allUnits: Unit[] = [
    ...scope.main_media_12,
    ...scope.district_rmt_41,
    ...scope.district_gov_41,
  ];
  console.log(`✓ scope 加载: ${allUnits.length} 个媒体单位`);

  // 2) 反查 outlet_id 白名单(同 coverage-dryrun 逻辑)
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

  const outletWhitelist = new Set<string>();
  const matchedUnitOutletMap: Array<{ unit: string; outlets: string[] }> = [];
  for (const u of allUnits) {
    const matchedOutlets: string[] = [];
    for (const d of dicts) {
      let matched = false;
      const dictPAs = (d.public_account_names ?? []).map((x: string) => x.trim());
      for (const wn of u.wechat_names) {
        if (dictPAs.includes(wn) || dictPAs.some((p: string) => p === wn || (wn && p.includes(wn)) || (p && wn.includes(p)))) {
          matched = true; break;
        }
      }
      if (!matched && u.websites.length > 0) {
        const dictDomains = (d.domains ?? []).map((x: string) => x.toLowerCase());
        for (const ww of u.websites) {
          const w = ww.replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase();
          if (w && (dictDomains.includes(w) || dictDomains.some((dd: string) => dd.includes(w) || w.includes(dd)))) {
            matched = true; break;
          }
        }
      }
      if (!matched && u.name && d.outlet_name) {
        const oname = d.outlet_name;
        if (oname === u.name || oname.includes(u.name) || u.name.includes(oname)) matched = true;
        else for (const wn of u.wechat_names) {
          if (wn && oname && (oname.includes(wn) || wn.includes(oname))) { matched = true; break; }
        }
      }
      if (matched) { outletWhitelist.add(d.id); matchedOutlets.push(d.outlet_name); }
    }
    matchedUnitOutletMap.push({ unit: u.name, outlets: matchedOutlets });
  }
  console.log(`✓ outlet_id 白名单: ${outletWhitelist.size} 个`);

  // 3) COUNT 先看会拉多少
  const whitelist = Array.from(outletWhitelist);
  const cnt = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM collected_items
    WHERE organization_id = ${orgId}
      AND published_at >= '2025-01-01' AND published_at < '2026-01-01'
      AND outlet_id IS NOT NULL
      AND outlet_id = ANY(ARRAY[${sql.join(whitelist.map(id => sql`${id}::uuid`), sql`, `)}]::uuid[])
  `);
  const total = (cnt as any)[0].n;
  console.log(`✓ 预计导出 ${total.toLocaleString()} 条 items`);

  // 4) 用 Drizzle query builder 拉数据(含 LEFT JOIN 副表 content/ocr/asr)
  console.log(`\n开始拉取数据(同时 LEFT JOIN content/ocr/asr)...`);
  const t0 = Date.now();
  const rows = await db
    .select({
      ...getTableColumns(collectedItems),
      content: collectedItemContents.content,
      ocrText: collectedItemContents.ocrText,
      asrText: collectedItemContents.asrText,
    })
    .from(collectedItems)
    .leftJoin(collectedItemContents, eq(collectedItemContents.itemId, collectedItems.id))
    .where(and(
      eq(collectedItems.organizationId, orgId),
      gte(collectedItems.publishedAt, new Date("2025-01-01T00:00:00.000Z")),
      lt(collectedItems.publishedAt, new Date("2026-01-01T00:00:00.000Z")),
      inArray(collectedItems.outletId, whitelist),
    ))
    .orderBy(desc(collectedItems.firstSeenAt));
  console.log(`✓ 拉到 ${rows.length.toLocaleString()} 行 (耗时 ${((Date.now() - t0) / 1000).toFixed(2)}s)`);

  // 5) 转 33 列 records(用项目标准转换器)
  console.log(`\n转换为内容池标准导出格式...`);
  const records = rows.map((row: any, i: number) => exportRowToOpinionRecord(row, i + 1));
  console.log(`✓ 转换完成`);

  // 6) 生成 xlsx
  console.log(`\n生成 xlsx 文件...`);
  const sheet = XLSX.utils.json_to_sheet(records, { header: [...EXPORT_COLUMN_ORDER] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "内容池数据(范围内)");

  // 列宽自适应(每列估算)
  const widths: { wch: number }[] = EXPORT_COLUMN_ORDER.map((col) => {
    if (col === "完整内容") return { wch: 50 };
    if (col === "OCR文本" || col === "ASR文本") return { wch: 40 };
    if (col === "内容摘要") return { wch: 35 };
    if (col === "标题") return { wch: 35 };
    if (col === "链接" || col === "封面图") return { wch: 25 };
    if (col === "命中关键词" || col === "命中地域" || col === "行业分类") return { wch: 20 };
    if (col === "发布时间" || col === "采集时间") return { wch: 18 };
    return { wch: 12 };
  });
  sheet["!cols"] = widths;

  const buffer: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  writeFileSync(OUT_PATH, buffer);
  console.log(`\n✓ 已写出: ${OUT_PATH}`);
  console.log(`  共 ${rows.length.toLocaleString()} 行 × ${EXPORT_COLUMN_ORDER.length} 列`);

  // 7) 同时输出文件大小
  const { statSync } = await import("node:fs");
  const stat = statSync(OUT_PATH);
  console.log(`  文件大小: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

  // 8) 抽样校验
  console.log(`\n=== 抽样校验(头 3 行 + 尾 3 行) ===`);
  for (const idx of [0, 1, 2, rows.length - 3, rows.length - 2, rows.length - 1]) {
    if (idx < 0 || idx >= rows.length) continue;
    const r = rows[idx];
    console.log(`  [${idx + 1}] ${(r as any).title?.slice(0, 40) ?? "(无标题)"} | 作者=${(r as any).author ?? "-"} | 发布=${(r as any).publishedAt?.toISOString?.()?.slice(0, 10) ?? "-"}`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
