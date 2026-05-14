/**
 * scripts/merge-cqgd-rb-cctv-outlets.ts
 *
 * 一次性合并 + 重命名:
 *  A. 第1眼新闻 系列: 保留 9f86fb35, 把 d9cc23b4(第 1 眼新闻) / 1aac24d8(重庆广电)
 *     的 channels 合并进来后停用
 *  B. 重庆日报 系列: 保留 8c832c20, 把 1b03bb2b(新重庆-重庆日报, industry tier)
 *     合并进来后停用
 *  C. outlet_name 改成 xlsx 的"品牌（机构）"复合写法:
 *       - 中央广播电视总台         → 央视新闻（中央广播电视总台）
 *       - 第1眼新闻 (合并后)       → 第1眼新闻（重庆广电）
 *       - 重庆日报  (合并后)       → 新重庆（重庆日报）
 *     旧名挪到 group_name(机构正式名)
 *
 * 频道去重规则: 按 type + 主标识(website.url / wechat_oa.ghid / douyin.secUid /
 *  weibo.uid / kuaishou.userId)。完全空的占位 channel 也合并到只保留 1 条。
 *
 * 用法:
 *   pnpm tsx scripts/merge-cqgd-rb-cctv-outlets.ts          # dry-run
 *   pnpm tsx scripts/merge-cqgd-rb-cctv-outlets.ts --apply  # 写库
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { and, eq, inArray } from "drizzle-orm";

const apply = process.argv.includes("--apply");

interface ChannelLite {
  type: string;
  [k: string]: unknown;
}

function channelKey(c: ChannelLite): string {
  switch (c.type) {
    case "website":
      return `website|${String(c["url"] ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
    case "wechat_oa":
      return `wechat_oa|${c["ghid"] ?? ""}|${c["name"] ?? c["nickname"] ?? ""}`;
    case "douyin":
      return `douyin|${c["secUid"] ?? ""}|${c["uid"] ?? ""}`;
    case "weibo":
      return `weibo|${c["uid"] ?? ""}`;
    case "kuaishou":
      return `kuaishou|${c["userId"] ?? ""}`;
    default:
      return JSON.stringify(c);
  }
}

function dedupChannels(channels: ChannelLite[]): ChannelLite[] {
  const seen = new Map<string, ChannelLite>();
  for (const c of channels) {
    const k = channelKey(c);
    if (!seen.has(k)) {
      seen.set(k, c);
    } else {
      // 已存在:合并 channel 内部字段(空字段被新值覆盖)
      const existing = seen.get(k)!;
      const merged: ChannelLite = { ...existing };
      for (const [field, v] of Object.entries(c)) {
        if ((merged[field] === undefined || merged[field] === "") && v !== undefined && v !== "") {
          merged[field] = v;
        }
      }
      seen.set(k, merged);
    }
  }
  return [...seen.values()];
}

interface MergeOp {
  /** 保留并合并到这条 */
  keeperId: string;
  keeperOldName: string;
  /** 合并后的目标 outlet_name(若不重命名,跟 keeperOldName 相同) */
  newName: string;
  /** 合并后写入 group_name 的机构名 */
  newGroupName: string;
  /** 要合并进来后停用的 outlet ID */
  mergeSourceIds: string[];
}

const OPS: MergeOp[] = [
  {
    keeperId: "9f86fb35-26fd-4d1c-9f3b-78c33d5f6310", // 第1眼新闻 (假设 id 前 8 位足够;真正 query 时用 LIKE 也行)
    keeperOldName: "第1眼新闻",
    newName: "第1眼新闻（重庆广电）",
    newGroupName: "重庆广电",
    mergeSourceIds: [
      "d9cc23b4-XXXX", // 第 1 眼新闻
      "1aac24d8-XXXX", // 重庆广电
    ],
  },
  {
    keeperId: "8c832c20-XXXX", // 重庆日报
    keeperOldName: "重庆日报",
    newName: "新重庆（重庆日报）",
    newGroupName: "重庆日报",
    mergeSourceIds: [
      "1b03bb2b-XXXX", // 新重庆-重庆日报
    ],
  },
  {
    keeperId: "30e06dcf-XXXX", // 中央广播电视总台
    keeperOldName: "中央广播电视总台",
    newName: "央视新闻（中央广播电视总台）",
    newGroupName: "中央广播电视总台",
    mergeSourceIds: [],
  },
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 未注入");
  const { db } = await import("@/db");
  const { mediaOutletDictionary } = await import("@/db/schema/media-outlet-dictionary");

  // 先用名字查到完整 id,避免硬编码 8 位前缀
  const targetNames = [
    "第1眼新闻", "第 1 眼新闻", "重庆广电",
    "重庆日报", "新重庆-重庆日报",
    "中央广播电视总台",
  ];
  const rows = await db
    .select()
    .from(mediaOutletDictionary)
    .where(inArray(mediaOutletDictionary.outletName, targetNames));
  const byName = new Map(rows.map((r) => [r.outletName, r]));
  function need(name: string) {
    const r = byName.get(name);
    if (!r) throw new Error(`DB 找不到 outlet_name="${name}"`);
    return r;
  }

  const ops: MergeOp[] = [
    {
      keeperId: need("第1眼新闻").id,
      keeperOldName: "第1眼新闻",
      newName: "第1眼新闻（重庆广电）",
      newGroupName: "重庆广电",
      mergeSourceIds: [need("第 1 眼新闻").id, need("重庆广电").id],
    },
    {
      keeperId: need("重庆日报").id,
      keeperOldName: "重庆日报",
      newName: "新重庆（重庆日报）",
      newGroupName: "重庆日报",
      mergeSourceIds: [need("新重庆-重庆日报").id],
    },
    {
      keeperId: need("中央广播电视总台").id,
      keeperOldName: "中央广播电视总台",
      newName: "央视新闻（中央广播电视总台）",
      newGroupName: "中央广播电视总台",
      mergeSourceIds: [],
    },
  ];

  console.log(`mode = ${apply ? "APPLY" : "DRY-RUN"}\n`);

  for (const op of ops) {
    const keeper = rows.find((r) => r.id === op.keeperId)!;
    const sources = op.mergeSourceIds.map((id) => rows.find((r) => r.id === id)!);

    const beforeChans = (keeper.channels ?? []) as unknown as ChannelLite[];
    const mergedRaw = [
      ...beforeChans,
      ...sources.flatMap((s) => (s.channels ?? []) as unknown as ChannelLite[]),
    ];
    const dedupd = dedupChannels(mergedRaw);

    console.log(`── ${op.keeperOldName} → ${op.newName} ──`);
    console.log(`   keeper [${keeper.id.slice(0, 8)}] tier=${keeper.outletTier}`);
    console.log(`   channels: ${beforeChans.length}(self) + ${sources.reduce((n, s) => n + ((s.channels ?? []) as unknown[]).length, 0)}(merged from ${sources.length} src) → ${dedupd.length} (去重后)`);
    if (op.newName !== op.keeperOldName) {
      console.log(`   outlet_name: "${op.keeperOldName}" → "${op.newName}"`);
      console.log(`   group_name:  "${keeper.groupName ?? ""}" → "${op.newGroupName}"`);
    } else {
      console.log(`   (outlet_name 不变)`);
    }
    for (const s of sources) {
      console.log(`   将停用 [${s.id.slice(0, 8)}] ${s.outletName} (tier=${s.outletTier})`);
    }
    console.log("");

    if (!apply) continue;

    await db
      .update(mediaOutletDictionary)
      .set({
        outletName: op.newName,
        groupName: op.newGroupName,
        channels: dedupd as unknown as never,
        updatedAt: new Date(),
      })
      .where(eq(mediaOutletDictionary.id, op.keeperId));
    console.log(`   ✓ 已更新 keeper ${op.newName}`);

    for (const s of sources) {
      await db
        .update(mediaOutletDictionary)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(mediaOutletDictionary.id, s.id));
      console.log(`   ✓ 已停用 ${s.outletName}`);
    }
    console.log("");
  }

  if (!apply) console.log("DRY-RUN 完成。加 --apply 写库。");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
