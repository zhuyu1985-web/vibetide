"use server";

// 采集源「内联 Excel 批量导入社媒账号」的三个 server action:
//   1. downloadAccountImportTemplate — 生成标准 xlsx 模板(账号清单 + 填写说明)
//   2. previewAccountImport          — 解析每行 + 自动补 secUid(不写库)
//   3. confirmAccountImport          — upsert 媒体账号库 + 返回 outletIds 供向导关联
//
// 与 bulk-import.ts 平行。所有 action 都 requireAuth() + organizationId 隔离。
// 纯逻辑(平台识别/URL解析/ID校验/去重/类型)在 account-import-helpers.ts(可单测)。

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { requireAuth } from "@/lib/auth";
import { OUTLET_TIER_VALUES, OUTLET_TIER_LABELS } from "@/lib/collection/constants";
import {
  bumpDictionaryVersion,
  findOutletByChannelIdentifier,
} from "@/lib/dal/media-outlet-dictionary";
import { searchDouyinUser } from "@/lib/collection/adapters/tikhub/account-search";
import type { Channel } from "@/lib/media-outlet/channels";
import {
  DEFAULT_REGION,
  PLATFORM_LABELS,
  PLATFORM_ID_FIELD,
  resolvePlatform,
  parseUrlToId,
  validateId,
  expandDouyinShortLink,
  readField,
  FIELD_KEYS,
  normalizeTier,
  mapWithConcurrency,
  confirmRowSchema,
  buildChannel,
  channelKey,
  toWizardChannels,
  type SupportedPlatform,
  type AccountImportRawRow,
  type PreviewMatchSource,
  type PreviewRow,
  type ImportedOutletOption,
  type ConfirmRow,
} from "@/lib/collection/account-import-helpers";

const PREVIEW_SEARCH_CONCURRENCY = 5;

// ─── 1. 模板下载 ──────────────────────────────────────────────────────

export async function downloadAccountImportTemplate(): Promise<{
  base64: string;
  filename: string;
}> {
  await requireAuth();
  const XLSX = await import("@e965/xlsx");

  const wb = XLSX.utils.book_new();

  // sheet1「账号清单」必须是第一个 sheet(parseExcelFile 只读 SheetNames[0])
  const headers = [
    "媒体名称",
    "平台",
    "主页链接",
    "账号ID",
    "媒体分级",
    "区域",
    "集团",
    "备注",
  ];
  const examples = [
    ["中国日报", "抖音", "", "", "", "", "中国日报社", "只填名称即可,系统自动匹配认证号"],
    [
      "央视新闻",
      "抖音",
      "https://www.douyin.com/user/MS4wLjABAAAA示例",
      "",
      "央级媒体",
      "全国",
      "中央广播电视总台",
      "填了主页链接则优先解析,不再自动搜索",
    ],
    [
      "人民日报",
      "微博",
      "https://weibo.com/u/2803301701",
      "",
      "央级媒体",
      "全国",
      "人民日报社",
      "微博填主页链接或 uid(数字)",
    ],
    [
      "某某号",
      "微信公众号",
      "",
      "gh_abcdef123456",
      "政务新媒体",
      "北京",
      "",
      "公众号填 ghid(gh_ 开头),不支持名称搜索",
    ],
  ];
  const sheet1 = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  sheet1["!cols"] = [
    { wch: 16 },
    { wch: 10 },
    { wch: 50 },
    { wch: 34 },
    { wch: 14 },
    { wch: 10 },
    { wch: 18 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, sheet1, "账号清单");

  // sheet2「填写说明」
  const tierLabels = OUTLET_TIER_VALUES.map((v) => OUTLET_TIER_LABELS[v]).join(
    " / ",
  );
  const notes: string[][] = [
    ["社媒账号批量导入 — 填写说明"],
    [""],
    ["1. 【媒体名称】必填,是唯一识别键(同名会合并到同一媒体,可在不同行挂多个平台/账号)。"],
    ["2. 【平台】支持:抖音 / 微博 / 快手 / 微信公众号;留空默认抖音。"],
    [
      "3. 抖音最省事:只填【媒体名称】即可,系统自动搜索并匹配“已认证 + 粉丝最高”的账号。",
    ],
    [
      "4. 想精确指定:填【主页链接】或【账号ID】。账号ID 各平台含义—— 抖音:secUid;微博:uid(数字);快手:userId;公众号:ghid(gh_ 开头)。",
    ],
    [
      "5. 主页链接示例—— 抖音:https://www.douyin.com/user/MS4w...(v.douyin.com 短链系统会自动展开);微博:https://weibo.com/u/数字;快手:https://www.kuaishou.com/profile/xxx。公众号没有主页链接,请填 ghid。",
    ],
    [
      "6. 仅抖音支持“只填名称自动搜号”;微博/快手/公众号必须填主页链接或账号ID。",
    ],
    [`7. 【媒体分级】可选值:${tierLabels};留空默认“政务新媒体”。`],
    ["8. 【区域】如“全国 / 北京 / 江苏”;留空默认“全国”。【集团】【备注】选填。"],
    [
      "9. 上传后进入“预览核对”:自动匹配的行会标“请核对”,可逐行改账号ID或删除后再确认。",
    ],
  ];
  const sheet2 = XLSX.utils.aoa_to_sheet(notes);
  sheet2["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, sheet2, "填写说明");

  const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;
  return { base64, filename: "社媒账号批量导入模板.xlsx" };
}

// ─── 2. 预览解析 + 自动补 secUid ───────────────────────────────────────

export async function previewAccountImport(
  rows: AccountImportRawRow[],
): Promise<{ previewRows: PreviewRow[]; totalSearchCostUsd: number }> {
  const user = await requireAuth();
  let totalSearchCostUsd = 0;

  const previewRows = await mapWithConcurrency(
    rows,
    PREVIEW_SEARCH_CONCURRENCY,
    async (row, index): Promise<PreviewRow> => {
      const outletName = readField(row, FIELD_KEYS.outletName);
      const platformRaw = readField(row, FIELD_KEYS.platform);
      const tier = normalizeTier(readField(row, FIELD_KEYS.tier));
      const region = readField(row, FIELD_KEYS.region) || DEFAULT_REGION;
      const groupName = readField(row, FIELD_KEYS.groupName) || null;
      const description = readField(row, FIELD_KEYS.description) || null;
      const platform = resolvePlatform(platformRaw);
      const safePlatform: SupportedPlatform = platform ?? "douyin";

      const base: PreviewRow = {
        rowIndex: index,
        outletName,
        platform: safePlatform,
        platformLabel: PLATFORM_LABELS[safePlatform],
        nickname: outletName,
        identifier: null,
        identifierLabel: PLATFORM_ID_FIELD[safePlatform],
        followerCount: null,
        verified: null,
        avatarUrl: null,
        outletTier: tier,
        outletRegion: region,
        groupName,
        description,
        profileUrl: null,
        matchSource: "none",
        status: "error",
      };

      if (!outletName) return { ...base, reason: "缺少媒体名称" };
      if (!platform) {
        return {
          ...base,
          reason: `无法识别平台“${platformRaw}”(支持:抖音/微博/快手/微信公众号)`,
        };
      }

      // ① 账号 ID 直填(最高优先级)
      const idRaw = readField(row, FIELD_KEYS.identifier);
      if (idRaw) {
        const err = validateId(platform, idRaw);
        if (err) return { ...base, reason: err };
        return finalizeWithId(base, user.organizationId, platform, {
          id: idRaw,
          nickname: outletName,
          matchSource: "id",
        });
      }

      // ② 主页链接解析(抖音含 v.douyin.com 短链展开)
      const urlRaw = readField(row, FIELD_KEYS.profileUrl);
      if (urlRaw) {
        let parsed = parseUrlToId(platform, urlRaw);
        if (!parsed && platform === "douyin" && /v\.douyin\.com/i.test(urlRaw)) {
          const expanded = await expandDouyinShortLink(urlRaw);
          if (expanded) parsed = parseUrlToId("douyin", expanded);
        }
        if (parsed) {
          return finalizeWithId(base, user.organizationId, platform, {
            id: parsed.id,
            nickname: outletName,
            profileUrl: parsed.profileUrl ?? urlRaw,
            matchSource: "url",
          });
        }
        // 解析失败 → 抖音降级名称搜索;其余平台报错(见下)
      }

      // ③ 只有名称:仅抖音支持自动搜索
      if (platform === "douyin") {
        try {
          const { candidate, costUsd } = await searchDouyinUser(outletName);
          totalSearchCostUsd += costUsd;
          if (!candidate) {
            return {
              ...base,
              reason: urlRaw
                ? "主页链接无法解析,且按名称未搜到账号(短链不支持请用完整链接)"
                : "未搜到匹配的抖音号,请补填主页链接或 secUid",
            };
          }
          const enriched: PreviewRow = {
            ...base,
            nickname: candidate.nickname || outletName,
            identifier: candidate.secUid,
            followerCount: candidate.followerCount,
            verified: candidate.verified,
            avatarUrl: candidate.avatarUrl ?? null,
            matchSource: "auto",
            status: "auto",
          };
          return applyDuplicateFlag(enriched, user.organizationId, platform);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { ...base, reason: `搜索失败: ${msg}` };
        }
      }

      // 非抖音平台只有名称 → 无法定位
      return {
        ...base,
        reason: `${PLATFORM_LABELS[platform]}暂不支持按名称自动搜索,请填主页链接或 ${PLATFORM_ID_FIELD[platform]}`,
      };
    },
  );

  return { previewRows, totalSearchCostUsd };
}

async function finalizeWithId(
  base: PreviewRow,
  orgId: string,
  platform: SupportedPlatform,
  opts: {
    id: string;
    nickname: string;
    profileUrl?: string;
    matchSource: PreviewMatchSource;
  },
): Promise<PreviewRow> {
  const row: PreviewRow = {
    ...base,
    identifier: opts.id,
    nickname: opts.nickname,
    profileUrl: opts.profileUrl ?? null,
    matchSource: opts.matchSource,
    status: "ok",
  };
  return applyDuplicateFlag(row, orgId, platform);
}

/** 若该账号 ID 已在媒体账号库某 outlet 里,标为 duplicate(确认时幂等跳过)。 */
async function applyDuplicateFlag(
  row: PreviewRow,
  orgId: string,
  platform: SupportedPlatform,
): Promise<PreviewRow> {
  if (!row.identifier) return row;
  try {
    const existing = await findOutletByChannelIdentifier(
      orgId,
      platform,
      PLATFORM_ID_FIELD[platform],
      row.identifier,
    );
    if (existing) {
      return {
        ...row,
        status: "duplicate",
        reason: `该账号已在媒体账号库“${existing.outletName}”中`,
      };
    }
  } catch {
    // 查重失败不阻塞,按非重复处理
  }
  return row;
}

// ─── 3. 确认导入(upsert 字典 + 返回 outletIds) ─────────────────────────

export async function confirmAccountImport(rawRows: ConfirmRow[]): Promise<{
  outletIds: string[];
  outlets: ImportedOutletOption[];
  created: number;
  merged: number;
  skipped: number;
}> {
  const user = await requireAuth();
  const rows = z.array(confirmRowSchema).parse(rawRows);

  // 按媒体名称分组(同名多平台/多账号合并到一个 outlet)
  const grouped = new Map<string, ConfirmRow[]>();
  for (const r of rows) {
    const list = grouped.get(r.outletName);
    if (list) list.push(r);
    else grouped.set(r.outletName, [r]);
  }

  const outletIds: string[] = [];
  const outlets: ImportedOutletOption[] = [];
  let created = 0;
  let merged = 0;
  let skipped = 0;

  for (const [outletName, group] of grouped) {
    const [existing] = await db
      .select()
      .from(mediaOutletDictionary)
      .where(
        and(
          eq(mediaOutletDictionary.organizationId, user.organizationId),
          eq(mediaOutletDictionary.outletName, outletName),
        ),
      )
      .limit(1);

    if (existing) {
      const channels = [...((existing.channels ?? []) as Channel[])];
      const seen = new Set(channels.map(channelKey));
      let addedAny = false;
      for (const r of group) {
        const ch = buildChannel(r);
        const key = channelKey(ch);
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        channels.push(ch);
        seen.add(key);
        addedAny = true;
      }
      if (addedAny) {
        await db
          .update(mediaOutletDictionary)
          .set({ channels, updatedAt: new Date() })
          .where(
            and(
              eq(mediaOutletDictionary.id, existing.id),
              eq(mediaOutletDictionary.organizationId, user.organizationId),
            ),
          );
        merged++;
      }
      outletIds.push(existing.id);
      outlets.push({
        id: existing.id,
        outletName: existing.outletName,
        outletTier: existing.outletTier,
        channels: toWizardChannels(channels),
      });
    } else {
      const seen = new Set<string>();
      const newChannels: Channel[] = [];
      for (const r of group) {
        const ch = buildChannel(r);
        const key = channelKey(ch);
        if (seen.has(key)) continue;
        newChannels.push(ch);
        seen.add(key);
      }
      const head = group[0]!;
      const [inserted] = await db
        .insert(mediaOutletDictionary)
        .values({
          organizationId: user.organizationId,
          outletName,
          outletTier: head.outletTier,
          outletRegion: head.outletRegion,
          groupName: head.groupName ?? null,
          description: head.description ?? null,
          channels: newChannels,
        })
        .returning();
      created++;
      outletIds.push(inserted!.id);
      outlets.push({
        id: inserted!.id,
        outletName: inserted!.outletName,
        outletTier: inserted!.outletTier,
        channels: toWizardChannels(newChannels),
      });
    }
  }

  await bumpDictionaryVersion(user.organizationId);
  revalidatePath("/data-collection/outlets");

  return { outletIds, outlets, created, merged, skipped };
}
