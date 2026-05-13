/**
 * scripts/rename-outlets-from-xlsx.ts
 *
 * 一次性把 DB 里的旧 outlet 名(如"九龙坡发布") RENAME 成 Excel 第一批里的新名
 * (如"九龙坡区融媒体中心")。匹配规则: 同 (outlet_tier, outlet_district)。
 *
 * 这一步必须在 import-outlet-channels-from-xlsx.ts 之前跑,否则 import 会把
 * Excel 新名当成新 outlet 插入,导致 DB 出现同机构的两条记录。
 *
 * 用法:
 *   DATABASE_URL=... pnpm tsx scripts/rename-outlets-from-xlsx.ts --dry-run
 *   DATABASE_URL=... pnpm tsx scripts/rename-outlets-from-xlsx.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";

const TIER_MAP: Record<string, string> = {
  央级: "central",
  "省/市级": "provincial_municipal",
  省市级: "provincial_municipal",
  行业: "industry",
  区县融媒: "district_media",
  区县: "district_media",
  政务新媒体: "government_self_media",
};

// 显式 override(district 空或匹配歧义时手工指定 DB 旧名 → Excel 新名)
const MANUAL_RENAMES: Record<string, string> = {
  忠州新闻: "忠县融媒体中心",
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const filePath =
  args.find((a) => a.endsWith(".xlsx")) ?? "docs/media-outlets-channels-todo.xlsx";

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

async function main() {
  console.log(`📂 Reading: ${filePath} ${dryRun ? "(DRY RUN)" : ""}\n`);

  const wb = XLSX.readFile(filePath);
  const dbOutlets = await db.select().from(mediaOutletDictionary);
  const dbNames = new Set(dbOutlets.map((o) => o.outletName));

  const firstSheet = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });

  // 收集 rename pairs: {dbId, oldName, newName}
  const renamePlan: { dbId: string; oldName: string; newName: string; reason: string }[] = [];

  // 1) Manual overrides 优先
  for (const [oldName, newName] of Object.entries(MANUAL_RENAMES)) {
    const dbRow = dbOutlets.find((o) => o.outletName === oldName);
    if (!dbRow) {
      console.warn(`  ⚠️  manual override "${oldName}" 在 DB 找不到,跳过`);
      continue;
    }
    if (dbNames.has(newName)) {
      console.warn(`  ⚠️  manual override "${oldName}" → "${newName}" 但目标名已存在,跳过`);
      continue;
    }
    renamePlan.push({ dbId: dbRow.id, oldName, newName, reason: "manual" });
  }

  // 2) 按 (tier, district) 自动匹配
  const alreadyRenaming = new Set(renamePlan.map((r) => r.dbId));
  for (const row of rows) {
    const newName = norm(row["媒体名"]);
    if (!newName) continue;
    if (dbNames.has(newName)) continue; // 新名已存在 → 无需 rename
    if (Object.values(MANUAL_RENAMES).includes(newName)) continue; // 已由 manual 处理

    const tier = TIER_MAP[norm(row["分级"])] ?? null;
    const district = norm(row["区县"]);
    if (!district) continue; // 无 district 的不自动匹配(应在 MANUAL_RENAMES 显式声明)

    const candidates = dbOutlets.filter(
      (o) =>
        !alreadyRenaming.has(o.id) &&
        (!tier || o.outletTier === tier) &&
        (o.outletDistrict ?? "") === district,
    );

    if (candidates.length === 1) {
      renamePlan.push({
        dbId: candidates[0]!.id,
        oldName: candidates[0]!.outletName,
        newName,
        reason: `district=${district}`,
      });
      alreadyRenaming.add(candidates[0]!.id);
    } else if (candidates.length > 1) {
      console.warn(`  ⚠️  "${newName}" 有 ${candidates.length} 个候选:`, candidates.map((c) => c.outletName));
    }
    // candidates.length === 0 → 这是真正的新 outlet,留给 import 脚本 INSERT
  }

  // 打印 plan
  console.log(`计划 RENAME ${renamePlan.length} 个 outlet:\n`);
  for (const r of renamePlan) {
    console.log(`  "${r.oldName}" → "${r.newName}"  [${r.reason}]`);
  }

  if (dryRun) {
    console.log("\n(DRY RUN — 没改库)");
    process.exit(0);
  }

  // 执行 rename
  let ok = 0;
  for (const r of renamePlan) {
    try {
      await db
        .update(mediaOutletDictionary)
        .set({ outletName: r.newName, updatedAt: new Date() })
        .where(eq(mediaOutletDictionary.id, r.dbId));
      ok++;
    } catch (e) {
      console.error(`  ❌ "${r.oldName}" rename 失败:`, (e as Error).message);
    }
  }
  console.log(`\n✅ 完成 ${ok}/${renamePlan.length} 个 rename`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
