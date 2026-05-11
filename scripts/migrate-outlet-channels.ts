/**
 * scripts/migrate-outlet-channels.ts
 *
 * 一次性迁移: 把 media_outlet_dictionary 旧字段 domains[] + public_account_names[]
 * 转换成 channels jsonb 数组。
 *
 * - domains[]              → channels[{ type: "website", url, domain, rssUrl? }]
 * - public_account_names[] → channels[{ type: "wechat_oa", name }]   (ghid 待用户补全)
 *
 * 幂等设计:
 *   - 跳过 channels 已经非空的 row(避免覆盖用户手动编辑过的数据)
 *   - 已迁移过的 row 重跑不会重复加 channel
 *
 * 用法:
 *   pnpm tsx scripts/migrate-outlet-channels.ts
 *
 * 等观察 1-2 个 sprint 没有问题后,再起独立 migration DROP COLUMN domains / public_account_names。
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import type { Channel, WebsiteChannel, WechatOaChannel } from "@/lib/media-outlet/channels";
import { eq } from "drizzle-orm";

function domainToWebsiteChannel(domain: string): WebsiteChannel | null {
  const trimmed = domain.trim();
  if (!trimmed) return null;
  // domain 字段约定只存 host(如 people.com.cn),不带协议;构造完整 URL
  const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(url);
    return {
      type: "website",
      url: u.origin,
      domain: u.hostname,
    };
  } catch {
    // 极端兜底: 原样回填 domain 字段,url 用 https:// 拼接
    return { type: "website", url, domain: trimmed };
  }
}

function publicAccountToWechatChannel(name: string): WechatOaChannel | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return { type: "wechat_oa", name: trimmed };
}

async function main() {
  const rows = await db.select().from(mediaOutletDictionary);
  console.log(`[migrate-outlet-channels] 扫描 ${rows.length} 条 outlets...`);

  let migrated = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const row of rows) {
    // 幂等: channels 已有内容就跳过(用户可能手动编辑过)
    if (row.channels && row.channels.length > 0) {
      skipped++;
      continue;
    }

    const channels: Channel[] = [];

    for (const d of row.domains ?? []) {
      const ch = domainToWebsiteChannel(d);
      if (ch) channels.push(ch);
    }
    for (const pa of row.publicAccountNames ?? []) {
      const ch = publicAccountToWechatChannel(pa);
      if (ch) channels.push(ch);
    }

    if (channels.length === 0) {
      unchanged++;
      continue;
    }

    await db
      .update(mediaOutletDictionary)
      .set({ channels, updatedAt: new Date() })
      .where(eq(mediaOutletDictionary.id, row.id));

    migrated++;
  }

  console.log(
    `[migrate-outlet-channels] done. 迁移 ${migrated} 条;已迁移跳过 ${skipped} 条;无旧数据可迁 ${unchanged} 条。`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate-outlet-channels] failed:", err);
  process.exit(1);
});
