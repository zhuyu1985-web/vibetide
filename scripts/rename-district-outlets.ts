/**
 * scripts/rename-district-outlets.ts
 *
 * 按 docs/test-site.xlsx "修改后" sheet 中"区县融媒"分级的 41 条数据,
 * 把 DB 里对应区县媒体的 outlet_name 改成 xlsx 的品牌名(如"巫溪发布"),
 * 同时把原来的机构名(如"巫溪县融媒体中心")写到 group_name。
 *
 * 匹配规则:
 *  - 优先按 outlet_district 字段匹配(xlsx "区县"列)
 *  - xlsx 区县字段为空的两条(忠州新闻 / 巫溪发布)走硬编码映射
 *  - 找不到的 / 多匹配的会报出来不动它,让人工处理
 *
 * 注意:由于 outlet_name 是显示用,会改下游所有引用(媒体字典 / 采集源 outlet 选择
 * 列表),但 DB 里的 FK 都是 uuid,不涉及关联表迁移。
 *
 * 用法:
 *   pnpm tsx scripts/rename-district-outlets.ts          # dry-run
 *   pnpm tsx scripts/rename-district-outlets.ts --apply  # 真正写库
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import * as XLSX from "xlsx";
import { and, eq } from "drizzle-orm";

const apply = process.argv.includes("--apply");

// xlsx 区县字段为空时的硬编码映射(xlsx 媒体名 → DB outlet_district)
const EMPTY_DISTRICT_FALLBACK: Record<string, string> = {
  "忠州新闻": "忠县",
  "巫溪发布": "巫溪县",
};

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL 未注入 — 检查 .env.local");
  }

  const { db } = await import("@/db");
  const { mediaOutletDictionary } = await import("@/db/schema/media-outlet-dictionary");

  const wb = XLSX.readFile("docs/test-site.xlsx");
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

  const districtRows = rows.filter((r) => r["分级"]?.trim() === "区县融媒");
  console.log(`xlsx "区县融媒" 共 ${districtRows.length} 条`);

  // 拉 DB 现有 district_media 全集做内存匹配
  const dbAll = await db
    .select()
    .from(mediaOutletDictionary)
    .where(eq(mediaOutletDictionary.outletTier, "district_media"));
  const byDistrict = new Map<string, typeof dbAll>();
  for (const r of dbAll) {
    if (!r.outletDistrict) continue;
    if (!byDistrict.has(r.outletDistrict)) byDistrict.set(r.outletDistrict, [] as typeof dbAll);
    byDistrict.get(r.outletDistrict)!.push(r);
  }

  interface Action {
    outletId: string;
    org: string;
    oldName: string;
    newName: string;
    oldGroup: string | null;
    newGroup: string;
    district: string;
  }
  const plan: Action[] = [];
  const skipped: { reason: string; xlsxName: string; district: string }[] = [];

  for (const r of districtRows) {
    const xlsxName = r["媒体名"].trim();
    let district = r["区县"].trim();
    if (!district) {
      district = EMPTY_DISTRICT_FALLBACK[xlsxName] ?? "";
    }
    if (!district) {
      skipped.push({ reason: "xlsx 区县字段空且无 fallback", xlsxName, district: "(空)" });
      continue;
    }
    const candidates = byDistrict.get(district) ?? [];
    if (candidates.length === 0) {
      skipped.push({ reason: `DB 没有区县="${district}"的 district_media`, xlsxName, district });
      continue;
    }
    if (candidates.length > 1) {
      skipped.push({
        reason: `DB 同区县有 ${candidates.length} 条 district_media,需人工选 (${candidates.map((c) => c.outletName).join(" | ")})`,
        xlsxName,
        district,
      });
      continue;
    }
    const dbRow = candidates[0]!;
    if (dbRow.outletName === xlsxName && dbRow.groupName === dbRow.outletName) {
      // 已经是目标状态,no-op
      continue;
    }
    plan.push({
      outletId: dbRow.id,
      org: dbRow.organizationId,
      oldName: dbRow.outletName,
      newName: xlsxName,
      oldGroup: dbRow.groupName,
      newGroup: dbRow.outletName, // 永远把当前机构名写进 group_name(幂等)
      district,
    });
  }

  console.log("");
  console.log(`── 计划 (${plan.length} 条改名) ──`);
  for (const a of plan) {
    const groupChange = a.oldGroup === a.newGroup ? "(group 不变)" : `group: "${a.oldGroup ?? ""}" → "${a.newGroup}"`;
    console.log(`  [${a.outletId.slice(0, 8)}] 区县=${a.district}`);
    console.log(`     outlet_name: "${a.oldName}" → "${a.newName}"`);
    console.log(`     ${groupChange}`);
  }

  if (skipped.length > 0) {
    console.log("");
    console.log(`── 跳过 (${skipped.length} 条) ──`);
    for (const s of skipped) {
      console.log(`  ! ${s.xlsxName} (区县=${s.district}): ${s.reason}`);
    }
  }

  if (!apply) {
    console.log("");
    console.log("DRY-RUN 完成。加 --apply 真正写库。");
    return;
  }

  // APPLY: 一条一条 update。outlet_name 没有 unique 约束(只有 organization_id + outlet_name 的复合,
  // 见 schema),所以同 org 内同名会失败 — 先看一下重名碰撞。
  console.log("");
  console.log("── APPLY ──");
  for (const a of plan) {
    try {
      await db
        .update(mediaOutletDictionary)
        .set({
          outletName: a.newName,
          groupName: a.newGroup,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(mediaOutletDictionary.id, a.outletId),
            eq(mediaOutletDictionary.organizationId, a.org),
          ),
        );
      console.log(`  ✓ ${a.oldName} → ${a.newName}`);
    } catch (err) {
      console.error(`  ✗ ${a.oldName} → ${a.newName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log("");
  console.log("APPLY 完成。建议刷新 /data-collection/outlets 核对。");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
