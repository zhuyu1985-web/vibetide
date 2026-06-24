"use server";

// 采集源「内联 Excel 批量导入抖音号」的三个 server action:
//   1. downloadAccountImportTemplate — 生成标准 xlsx 模板(账号清单 + 填写说明)
//   2. previewAccountImport          — 解析每行 + 自动补 secUid(不写库)
//   3. confirmAccountImport          — upsert 媒体账号库 + 返回 outletIds 供向导关联
//
// 与 bulk-import.ts 平行。所有 action 都 requireAuth() + organizationId 隔离。

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { requireAuth } from "@/lib/auth";
import {
  OUTLET_TIER_VALUES,
  OUTLET_TIER_LABELS,
  type OutletTier,
} from "@/lib/collection/constants";
import {
  bumpDictionaryVersion,
  findOutletByChannelIdentifier,
} from "@/lib/dal/media-outlet-dictionary";
import { parseDouyinProfileUrl } from "@/lib/media-outlet/url-parsers";
import { searchDouyinUser } from "@/lib/collection/adapters/tikhub/account-search";
import type { Channel, DouyinChannel } from "@/lib/media-outlet/channels";

const DEFAULT_TIER: OutletTier = "government_self_media";
const DEFAULT_REGION = "全国";
const PREVIEW_SEARCH_CONCURRENCY = 5;

// ─── 类型 ────────────────────────────────────────────────────────────

/** Excel 解析后的原始行(中文表头,key 不保证规范,用 readField 容错读取) */
export type AccountImportRawRow = Record<string, unknown>;

export type PreviewMatchSource = "secuid" | "url" | "auto" | "none";
export type PreviewStatus = "ok" | "auto" | "error" | "duplicate";

export interface PreviewRow {
  rowIndex: number;
  outletName: string;
  platform: "douyin";
  nickname: string;
  secUid: string | null;
  followerCount: number | null;
  verified: boolean | null;
  avatarUrl: string | null;
  outletTier: string; // 已填缺省
  outletRegion: string; // 已填缺省
  groupName: string | null;
  description: string | null;
  profileUrl: string | null;
  matchSource: PreviewMatchSource;
  status: PreviewStatus;
  reason?: string;
}

/** 结构与 new-source-wizard-client 的 WizardOutletOption 一致,供向导回填候选 */
export interface ImportedOutletOption {
  id: string;
  outletName: string;
  outletTier: string;
  channels: Array<{
    type: string;
    nickname?: string;
    name?: string;
    url?: string;
    domain?: string;
  }>;
}

// ─── 字段读取容错 ──────────────────────────────────────────────────────

function readField(row: AccountImportRawRow, keys: readonly string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  }
  return "";
}

const FIELD_KEYS = {
  outletName: ["媒体名称", "名称", "媒体", "outletName", "name"],
  platform: ["平台", "platform"],
  profileUrl: ["主页链接", "链接", "主页", "profileUrl", "url"],
  secUid: ["secUid", "sec_uid", "secuid", "SecUid", "sec_user_id"],
  tier: ["媒体分级", "分级", "tier", "outletTier"],
  region: ["区域", "地区", "region", "outletRegion"],
  groupName: ["集团", "母公司", "groupName"],
  description: ["备注", "说明", "description", "remark"],
} as const;

function normalizeTier(raw: string): string {
  const t = raw.trim();
  if (!t) return DEFAULT_TIER;
  const byLabel = OUTLET_TIER_VALUES.find((v) => OUTLET_TIER_LABELS[v] === t);
  if (byLabel) return byLabel;
  if ((OUTLET_TIER_VALUES as readonly string[]).includes(t)) return t;
  return DEFAULT_TIER;
}

function isDouyinPlatform(raw: string): boolean {
  const p = raw.trim().toLowerCase();
  return p === "" || p === "抖音" || p === "douyin";
}

// ─── 简易并发池(每批 ≤25 行,并发 5 跑搜索) ────────────────────────────

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

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
    "secUid",
    "媒体分级",
    "区域",
    "集团",
    "备注",
  ];
  const example1 = [
    "中国日报",
    "抖音",
    "",
    "",
    "",
    "",
    "中国日报社",
    "只填名称即可,系统自动匹配认证号",
  ];
  const example2 = [
    "央视新闻",
    "抖音",
    "https://www.douyin.com/user/MS4wLjABAAAA示例secUid",
    "",
    "央级媒体",
    "全国",
    "中央广播电视总台",
    "填了主页链接则优先解析,不再自动搜索",
  ];
  const sheet1 = XLSX.utils.aoa_to_sheet([headers, example1, example2]);
  sheet1["!cols"] = [
    { wch: 16 },
    { wch: 8 },
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
    ["抖音号批量导入 — 填写说明"],
    [""],
    ["1. 【媒体名称】必填,是唯一识别键(同名会合并到同一媒体)。"],
    [
      "2. 最省事:只填【媒体名称】一列即可,系统会自动搜索抖音号并匹配“已认证 + 粉丝最高”的账号。",
    ],
    [
      "3. 想精确指定某个号:填【主页链接】(抖音网页版主页地址,形如 https://www.douyin.com/user/MS4w...)或直接填【secUid】,系统不再自动猜测。",
    ],
    [
      "   注意:v.douyin.com 短链暂不支持,请用完整 douyin.com/user/... 链接,或留空让系统搜索。",
    ],
    ["4. 【平台】目前仅支持“抖音”,其余平台后续开放。"],
    [`5. 【媒体分级】可选值:${tierLabels};留空默认“政务新媒体”。`],
    ["6. 【区域】如“全国 / 北京 / 江苏”;留空默认“全国”。"],
    ["7. 【集团】【备注】选填。"],
    [
      "8. 同一媒体有多个抖音号:分多行填写(确认导入时按 secUid 合并到同一媒体)。",
    ],
    [
      "9. 上传后进入“预览核对”:自动匹配的行会标“请核对”,可逐行改 secUid 或删除后再确认。",
    ],
  ];
  const sheet2 = XLSX.utils.aoa_to_sheet(notes);
  sheet2["!cols"] = [{ wch: 96 }];
  XLSX.utils.book_append_sheet(wb, sheet2, "填写说明");

  const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;
  return { base64, filename: "抖音号批量导入模板.xlsx" };
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

      const base: PreviewRow = {
        rowIndex: index,
        outletName,
        platform: "douyin",
        nickname: outletName,
        secUid: null,
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

      if (!outletName) {
        return { ...base, reason: "缺少媒体名称" };
      }
      if (!isDouyinPlatform(platformRaw)) {
        return { ...base, reason: `暂不支持平台“${platformRaw}”,当前仅支持抖音` };
      }

      // ① secUid 直填(最高优先级)
      const secUidRaw = readField(row, FIELD_KEYS.secUid);
      if (secUidRaw) {
        return finalizeWithSecUid(base, user.organizationId, {
          secUid: secUidRaw,
          nickname: outletName,
          matchSource: "secuid",
        });
      }

      // ② 主页链接解析
      const urlRaw = readField(row, FIELD_KEYS.profileUrl);
      if (urlRaw) {
        const parsed = parseDouyinProfileUrl(urlRaw);
        if (parsed) {
          return finalizeWithSecUid(base, user.organizationId, {
            secUid: parsed.secUid,
            nickname: outletName,
            profileUrl: parsed.profileUrl ?? urlRaw,
            matchSource: "url",
          });
        }
        // 链接解析失败 → 若无名称兜底就报错,否则降级到名称搜索
        // (这里一定有 outletName,继续走 ③)
      }

      // ③ 只有名称 → tikhub 搜索补 secUid
      try {
        const { candidate, costUsd } = await searchDouyinUser(outletName);
        totalSearchCostUsd += costUsd;
        if (!candidate) {
          return {
            ...base,
            reason: urlRaw
              ? "主页链接无法解析,且按名称未搜到匹配账号"
              : "未搜到匹配的抖音号,请补填主页链接或 secUid",
          };
        }
        const enriched: PreviewRow = {
          ...base,
          nickname: candidate.nickname || outletName,
          secUid: candidate.secUid,
          followerCount: candidate.followerCount,
          verified: candidate.verified,
          avatarUrl: candidate.avatarUrl ?? null,
          matchSource: "auto",
          status: "auto",
        };
        return applyDuplicateFlag(enriched, user.organizationId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ...base, reason: `搜索失败: ${msg}` };
      }
    },
  );

  return { previewRows, totalSearchCostUsd };
}

async function finalizeWithSecUid(
  base: PreviewRow,
  orgId: string,
  opts: {
    secUid: string;
    nickname: string;
    profileUrl?: string;
    matchSource: PreviewMatchSource;
  },
): Promise<PreviewRow> {
  const row: PreviewRow = {
    ...base,
    secUid: opts.secUid,
    nickname: opts.nickname,
    profileUrl: opts.profileUrl ?? null,
    matchSource: opts.matchSource,
    status: "ok",
  };
  return applyDuplicateFlag(row, orgId);
}

/** 若该 secUid 已在字典某 outlet 里,标为 duplicate(确认时幂等跳过)。 */
async function applyDuplicateFlag(
  row: PreviewRow,
  orgId: string,
): Promise<PreviewRow> {
  if (!row.secUid) return row;
  try {
    const existing = await findOutletByChannelIdentifier(
      orgId,
      "douyin",
      "secUid",
      row.secUid,
    );
    if (existing) {
      return {
        ...row,
        status: "duplicate",
        reason: `该抖音号已在媒体账号库“${existing.outletName}”中`,
      };
    }
  } catch {
    // 查重失败不阻塞,按非重复处理
  }
  return row;
}

// ─── 3. 确认导入(upsert 字典 + 返回 outletIds) ─────────────────────────

const confirmRowSchema = z.object({
  outletName: z.string().min(1),
  nickname: z.string().min(1),
  secUid: z.string().min(1),
  profileUrl: z.string().nullable().optional(),
  outletTier: z.enum(OUTLET_TIER_VALUES),
  outletRegion: z.string().min(1),
  groupName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export type ConfirmRow = z.infer<typeof confirmRowSchema>;

function toWizardChannels(channels: Channel[]): ImportedOutletOption["channels"] {
  return channels.map((c) => ({
    type: c.type,
    nickname: "nickname" in c ? c.nickname : undefined,
    name: "name" in c ? c.name : undefined,
    url: "url" in c ? c.url : undefined,
    domain: "domain" in c ? c.domain : undefined,
  }));
}

export async function confirmAccountImport(rawRows: ConfirmRow[]): Promise<{
  outletIds: string[];
  outlets: ImportedOutletOption[];
  created: number;
  merged: number;
  skipped: number;
}> {
  const user = await requireAuth();
  const rows = z.array(confirmRowSchema).parse(rawRows);

  // 按媒体名称分组(同名多抖音号合并到一个 outlet)
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
      const existingSecUids = new Set(
        channels
          .filter((c): c is DouyinChannel => c.type === "douyin")
          .map((c) => c.secUid),
      );
      let addedAny = false;
      for (const r of group) {
        if (existingSecUids.has(r.secUid)) {
          skipped++;
          continue;
        }
        channels.push(buildDouyinChannel(r));
        existingSecUids.add(r.secUid);
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
        if (seen.has(r.secUid)) continue;
        newChannels.push(buildDouyinChannel(r));
        seen.add(r.secUid);
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

function buildDouyinChannel(r: ConfirmRow): DouyinChannel {
  return {
    type: "douyin",
    nickname: r.nickname,
    secUid: r.secUid,
    ...(r.profileUrl ? { profileUrl: r.profileUrl } : {}),
  };
}
