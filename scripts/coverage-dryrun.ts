/**
 * scripts/coverage-dryrun.ts
 *
 * 方案 A 覆盖率 dry-run :
 * 1. 加载 /tmp/media-scope-final.json (94 家最终媒体)
 * 2. 提取所有匹配字段 : ghid + 公众号名 + 网站域名 + 微博 UID + 媒体名
 * 3. 去 DB media_outlet_dictionary 找匹配的 outlet_id 集合
 * 4. COUNT collected_items WHERE outlet_id ∈ 集合 (2025 年内)
 * 5. 按 tier / 媒体名 / 区县 三个维度分组,输出审计报告 + 写 /tmp/coverage-dryrun.json
 *
 * 输出 : 让用户判断 67k items 收敛到新范围后,是否有充足数据继续指标计算
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { readFileSync, writeFileSync } from "node:fs";

const ORG_ENV = process.argv[2];
const SCOPE_PATH = "/tmp/media-scope-final.json";
const OUT_PATH = "/tmp/coverage-dryrun.json";

type Unit = {
  id: string;
  name: string;
  tier: string;
  district_normalized?: string;
  websites: string[];
  wechat_names: string[];
  wechat_ghid: string | null;
  weibo_uid: string | null;
  weibo_handle: string | null;
  xlsx_row?: number;
};
type Scope = {
  main_media_12: Unit[];
  district_rmt_41: Unit[];
  district_gov_41: Unit[];
  conflicts_resolution: any[];
};

async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");

  const scope: Scope = JSON.parse(readFileSync(SCOPE_PATH, "utf-8"));
  const orgRows = await db.execute(sql`SELECT id, name FROM organizations LIMIT 5`);
  const orgId = ORG_ENV ?? (orgRows as any)[0].id;
  console.log(`org: ${orgId}`);

  // === 1. 把 94 个单位归并到 5 个一级 tier ===
  type TierKey = "central" | "industry" | "municipal" | "district";
  const allUnits: Array<Unit & { tierKey: TierKey }> = [];
  for (const u of scope.main_media_12) {
    const tierKey = u.tier as TierKey; // central/industry/municipal
    allUnits.push({ ...u, tierKey });
  }
  for (const u of scope.district_rmt_41) {
    allUnits.push({ ...u, tierKey: "district" });
  }
  for (const u of scope.district_gov_41) {
    allUnits.push({ ...u, tierKey: "district" });
  }
  console.log(`✓ 加载 ${allUnits.length} 个单位`);

  // === 2. 收集所有匹配字段 → 反查 DB outlet ===
  const allWechatNames = new Set<string>();
  const allGhids = new Set<string>();
  const allDomains = new Set<string>();
  const allWeiboUids = new Set<string>();
  const allMediaNames = new Set<string>();
  for (const u of allUnits) {
    if (u.wechat_ghid) allGhids.add(u.wechat_ghid);
    for (const n of u.wechat_names) allWechatNames.add(n);
    for (const w of u.websites) {
      // 取域名主体 (去 path / 查询参数)
      const d = w.replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase();
      if (d) allDomains.add(d);
    }
    if (u.weibo_uid) allWeiboUids.add(u.weibo_uid);
    if (u.weibo_handle) allMediaNames.add(u.weibo_handle);
    allMediaNames.add(u.name);
  }
  // 公众号名也加入媒体名集合 (用于 outlet_name 模糊匹配)
  for (const n of allWechatNames) allMediaNames.add(n);

  console.log(`\n收集到的匹配字段 :`);
  console.log(`  - 公众号名: ${allWechatNames.size}`);
  console.log(`  - 公众号 ghid: ${allGhids.size}`);
  console.log(`  - 网站域名: ${allDomains.size}`);
  console.log(`  - 微博 UID: ${allWeiboUids.size}`);
  console.log(`  - 全部媒体/账号名(用于 outlet 反查): ${allMediaNames.size}`);

  // === 3. 反查 DB media_outlet_dictionary ===
  // 策略 :
  //   - 把 dict 全部拉到内存 (~158 行)
  //   - 在 TS 里按 (publicAccountNames 包含、outletName 包含、domains 包含) 匹配
  const dictRows = await db.execute(sql`
    SELECT id, outlet_name, outlet_tier, outlet_region, outlet_district,
           public_account_names, domains
    FROM media_outlet_dictionary
    WHERE organization_id = ${orgId}
  `);
  const dicts: Array<{
    id: string; outlet_name: string; outlet_tier: string | null;
    outlet_region: string | null; outlet_district: string | null;
    public_account_names: string[]; domains: string[];
  }> = (dictRows as any).map((r: any) => ({
    id: r.id, outlet_name: r.outlet_name, outlet_tier: r.outlet_tier,
    outlet_region: r.outlet_region, outlet_district: r.outlet_district,
    public_account_names: r.public_account_names ?? [],
    domains: r.domains ?? [],
  }));
  console.log(`\n✓ DB media_outlet_dictionary 共 ${dicts.length} 行`);

  // 每个 unit 找匹配的 outlet_id
  type Match = {
    unit: Unit & { tierKey: TierKey };
    matched_outlet_ids: string[];
    matched_outlet_names: string[];
    match_reasons: string[];
  };
  const matches: Match[] = [];
  for (const u of allUnits) {
    const matched_outlet_ids: string[] = [];
    const matched_outlet_names: string[] = [];
    const match_reasons: string[] = [];
    for (const d of dicts) {
      let matched = false; const why: string[] = [];
      // 1) 公众号名匹配
      const dictPAs = (d.public_account_names ?? []).map(x => x.trim());
      for (const wn of u.wechat_names) {
        if (dictPAs.includes(wn) || dictPAs.some(p => p === wn || (wn && p.includes(wn)) || (p && wn.includes(p)))) {
          matched = true; why.push(`wechat_name=${wn}`); break;
        }
      }
      // 2) 域名匹配
      if (!matched && u.websites.length > 0) {
        const dictDomains = (d.domains ?? []).map(x => x.toLowerCase());
        for (const ww of u.websites) {
          const w = ww.replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase();
          if (!w) continue;
          if (dictDomains.includes(w) || dictDomains.some(dd => dd.includes(w) || w.includes(dd))) {
            matched = true; why.push(`domain=${w}`); break;
          }
        }
      }
      // 3) outletName 模糊匹配
      if (!matched && u.name && d.outlet_name) {
        const oname = d.outlet_name;
        if (oname === u.name || oname.includes(u.name) || u.name.includes(oname)) {
          matched = true; why.push(`outlet_name=${oname}`);
        } else {
          // 用公众号名也试一下
          for (const wn of u.wechat_names) {
            if (wn && oname && (oname.includes(wn) || wn.includes(oname))) {
              matched = true; why.push(`name_wn=${wn}↔${oname}`); break;
            }
          }
        }
      }
      if (matched) {
        matched_outlet_ids.push(d.id);
        matched_outlet_names.push(d.outlet_name);
        match_reasons.push(why.join("/"));
      }
    }
    matches.push({ unit: u, matched_outlet_ids, matched_outlet_names, match_reasons });
  }

  // === 4. 统计 outlet 匹配情况 ===
  const unmatched = matches.filter(m => m.matched_outlet_ids.length === 0);
  const matched = matches.filter(m => m.matched_outlet_ids.length > 0);
  console.log(`\n=== Unit → DB outlet 匹配情况 ===`);
  console.log(`  匹配上: ${matched.length} / ${allUnits.length}`);
  console.log(`  未匹配: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log(`\n  未匹配的单位:`);
    for (const m of unmatched) {
      console.log(`    [${m.unit.tier}] ${m.unit.name} (L${m.unit.xlsx_row})`);
    }
  }

  // === 5. COUNT items per (matched outlet, 2025 年) ===
  const allMatchedOutletIds = new Set<string>();
  for (const m of matched) {
    for (const id of m.matched_outlet_ids) allMatchedOutletIds.add(id);
  }
  console.log(`\n  总匹配的 outlet_id 数: ${allMatchedOutletIds.size}`);

  const outletIdArr = Array.from(allMatchedOutletIds);
  let itemsTotal = 0; let itemsByOutlet: Record<string, number> = {};
  if (outletIdArr.length > 0) {
    const rows = await db.execute(sql`
      SELECT ci.outlet_id, COUNT(*)::int AS n
      FROM collected_items ci
      WHERE ci.organization_id = ${orgId}
        AND ci.published_at >= '2025-01-01' AND ci.published_at < '2026-01-01'
        AND ci.outlet_id IS NOT NULL
        AND ci.outlet_id = ANY(ARRAY[${sql.join(outletIdArr.map(id => sql`${id}::uuid`), sql`, `)}]::uuid[])
      GROUP BY ci.outlet_id
    `);
    for (const r of rows as any) {
      itemsByOutlet[r.outlet_id] = r.n;
      itemsTotal += r.n;
    }
  }
  console.log(`\n  ✓ 新范围内 2025 年 items 总数: ${itemsTotal.toLocaleString()}`);

  // 对比旧范围
  const oldTotalRow = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM collected_items
    WHERE organization_id = ${orgId}
      AND published_at >= '2025-01-01' AND published_at < '2026-01-01'
      AND outlet_id IS NOT NULL
  `);
  const oldTotal = (oldTotalRow as any)[0].n;
  const retention = oldTotal > 0 ? (itemsTotal / oldTotal * 100) : 0;
  console.log(`  旧范围 2025 年 items 总数:   ${oldTotal.toLocaleString()}`);
  console.log(`  保留率: ${retention.toFixed(1)}%`);

  // === 6. 按 5 个一级 tier 分组 ===
  type TierAgg = { matched_units: number; total_units: number; matched_outlets: number; items: number };
  const tierAgg: Record<string, TierAgg> = {
    central: { matched_units: 0, total_units: 0, matched_outlets: 0, items: 0 },
    industry: { matched_units: 0, total_units: 0, matched_outlets: 0, items: 0 },
    municipal: { matched_units: 0, total_units: 0, matched_outlets: 0, items: 0 },
    district: { matched_units: 0, total_units: 0, matched_outlets: 0, items: 0 },
  };
  for (const m of matches) {
    const t = (m.unit as any).tierKey as string;
    if (!tierAgg[t]) continue;
    tierAgg[t]!.total_units += 1;
    if (m.matched_outlet_ids.length > 0) {
      tierAgg[t]!.matched_units += 1;
      tierAgg[t]!.matched_outlets += m.matched_outlet_ids.length;
      for (const oid of m.matched_outlet_ids) {
        tierAgg[t]!.items += (itemsByOutlet[oid] ?? 0);
      }
    }
  }
  console.log(`\n=== 按一级 tier 分组 ===`);
  console.log(`${'tier'.padEnd(12)} | ${'匹配/总'.padEnd(10)} | ${'匹配 outlet 数'.padEnd(15)} | ${'2025 items'.padEnd(12)}`);
  console.log("-".repeat(70));
  for (const t of ["central", "industry", "municipal", "district"] as const) {
    const a = tierAgg[t]!;
    console.log(`${t.padEnd(12)} | ${(a.matched_units + "/" + a.total_units).padEnd(10)} | ${String(a.matched_outlets).padEnd(15)} | ${a.items.toLocaleString().padEnd(12)}`);
  }

  // === 7. 按媒体单位列每个的 items 数(用于审计) ===
  type UnitAgg = { unit: Unit; items: number; matched_outlets: string[] };
  const unitAggs: UnitAgg[] = matches.map(m => ({
    unit: m.unit,
    items: m.matched_outlet_ids.reduce((s, id) => s + (itemsByOutlet[id] ?? 0), 0),
    matched_outlets: m.matched_outlet_names,
  }));

  // === 8. 按 39 区县分组 ===
  const STANDARD_39 = [
    "万州区", "万盛经开区", "两江新区", "丰都县", "九龙坡区", "云阳县", "北碚区", "南岸区",
    "南川区", "合川区", "垫江县", "城口县", "大渡口区", "大足区", "奉节县", "巫山县", "巫溪县",
    "巴南区", "开州区", "彭水县", "忠县", "梁平区", "武隆区", "永川区", "江津区", "沙坪坝区",
    "涪陵区", "渝中区", "潼南区", "璧山区", "石柱县", "秀山县", "科学城重庆高新区", "綦江区",
    "荣昌区", "酉阳县", "铜梁区", "长寿区", "黔江区",
  ];
  const distAgg: Record<string, { rmt_units: number; gov_units: number; rmt_items: number; gov_items: number }> = {};
  for (const d of STANDARD_39) distAgg[d] = { rmt_units: 0, gov_units: 0, rmt_items: 0, gov_items: 0 };
  for (const u of unitAggs) {
    const dn = u.unit.district_normalized;
    if (!dn || !distAgg[dn]) continue;
    if (u.unit.tier === "district_rmt") {
      distAgg[dn]!.rmt_units += 1;
      distAgg[dn]!.rmt_items += u.items;
    } else if (u.unit.tier === "district_gov") {
      distAgg[dn]!.gov_units += 1;
      distAgg[dn]!.gov_items += u.items;
    }
  }
  console.log(`\n=== 按 39 区县分组 (区县融媒 + 政务) ===`);
  console.log(`${'区县'.padStart(20)} | ${'融媒数'.padEnd(6)} | ${'融媒 items'.padEnd(11)} | ${'政务数'.padEnd(6)} | ${'政务 items'.padEnd(11)} | ${'区县合计'.padEnd(8)}`);
  console.log("-".repeat(95));
  for (const d of STANDARD_39) {
    const a = distAgg[d]!;
    const total = a.rmt_items + a.gov_items;
    console.log(`${d.padStart(20)} | ${String(a.rmt_units).padEnd(6)} | ${a.rmt_items.toLocaleString().padEnd(11)} | ${String(a.gov_units).padEnd(6)} | ${a.gov_items.toLocaleString().padEnd(11)} | ${total.toLocaleString().padEnd(8)}`);
  }

  // === 9. 保存 ===
  const out = {
    captured_at: new Date().toISOString(),
    org_id: orgId,
    summary: {
      total_units: allUnits.length,
      matched_units: matched.length,
      unmatched_units: unmatched.length,
      matched_outlet_count: allMatchedOutletIds.size,
      items_in_scope: itemsTotal,
      items_old_full: oldTotal,
      retention_pct: retention,
    },
    by_tier: tierAgg,
    by_district: distAgg,
    unit_details: unitAggs.map(u => ({
      tier: u.unit.tier, name: u.unit.name,
      district: u.unit.district_normalized,
      xlsx_row: u.unit.xlsx_row,
      matched_outlets: u.matched_outlets,
      items: u.items,
    })),
    unmatched: unmatched.map(m => ({
      tier: m.unit.tier, name: m.unit.name,
      district: m.unit.district_normalized,
      xlsx_row: m.unit.xlsx_row,
      hint_wechat_names: m.unit.wechat_names,
      hint_ghid: m.unit.wechat_ghid,
      hint_websites: m.unit.websites,
    })),
  };
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\n✓ 已写: ${OUT_PATH}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
