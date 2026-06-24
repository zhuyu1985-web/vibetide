"use server";

// 采集源「内联 Excel 批量导入社媒账号」的三个 server action:
//   1. downloadAccountImportTemplate — 生成标准 xlsx 模板(账号清单 + 填写说明)
//   2. previewAccountImport          — 解析每行 + 自动补 secUid(不写库)
//   3. confirmAccountImport          — upsert 媒体账号库 + 返回 outletIds 供向导关联
//
// 与 bulk-import.ts 平行。所有 action 都 requireAuth() + organizationId 隔离。
// P1: 支持抖音/微博/快手/微信公众号 4 平台;抖音 v.douyin.com 短链自动展开;
//     仅抖音支持「只填名称自动搜号」,其余平台需填主页链接或账号 ID。

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
import {
  parseDouyinProfileUrl,
  parseWeiboProfileUrl,
  parseKuaishouProfileUrl,
} from "@/lib/media-outlet/url-parsers";
import { searchDouyinUser } from "@/lib/collection/adapters/tikhub/account-search";
import {
  getChannelIdentifier,
  type Channel,
} from "@/lib/media-outlet/channels";

const DEFAULT_TIER: OutletTier = "government_self_media";
const DEFAULT_REGION = "全国";
const PREVIEW_SEARCH_CONCURRENCY = 5;

// ─── 平台配置 ──────────────────────────────────────────────────────────

export type SupportedPlatform = "douyin" | "weibo" | "kuaishou" | "wechat_oa";

const PLATFORM_LABELS: Record<SupportedPlatform, string> = {
  douyin: "抖音",
  weibo: "微博",
  kuaishou: "快手",
  wechat_oa: "微信公众号",
};

/** 各平台的账号识别符字段名(与 channels.ts / findOutletByChannelIdentifier 对齐) */
const PLATFORM_ID_FIELD: Record<SupportedPlatform, string> = {
  douyin: "secUid",
  weibo: "uid",
  kuaishou: "userId",
  wechat_oa: "ghid",
};

function resolvePlatform(raw: string): SupportedPlatform | null {
  const p = raw.trim();
  if (!p) return "douyin"; // 平台列留空默认抖音
  const low = p.toLowerCase();
  if (p === "抖音" || low === "douyin") return "douyin";
  if (p === "微博" || low === "weibo") return "weibo";
  if (p === "快手" || low === "kuaishou") return "kuaishou";
  if (p === "微信公众号" || p === "公众号" || p === "微信" || low === "wechat_oa" || low === "wechat")
    return "wechat_oa";
  return null;
}

/** 主页链接 → 账号识别符(公众号无标准主页 URL 解析) */
function parseUrlToId(
  platform: SupportedPlatform,
  url: string,
): { id: string; profileUrl?: string } | null {
  switch (platform) {
    case "douyin": {
      const c = parseDouyinProfileUrl(url);
      return c ? { id: c.secUid, profileUrl: c.profileUrl } : null;
    }
    case "weibo": {
      const c = parseWeiboProfileUrl(url);
      return c ? { id: c.uid, profileUrl: c.profileUrl } : null;
    }
    case "kuaishou": {
      const c = parseKuaishouProfileUrl(url);
      return c ? { id: c.userId, profileUrl: c.profileUrl } : null;
    }
    case "wechat_oa":
      return null;
  }
}

/** 直填账号 ID 的基本格式校验,返回错误信息或 null(合法) */
function validateId(platform: SupportedPlatform, id: string): string | null {
  switch (platform) {
    case "weibo":
      return /^\d+$/.test(id) ? null : "微博 uid 必须是数字";
    case "wechat_oa":
      return /^gh_[a-zA-Z0-9]+$/.test(id) ? null : "公众号 ghid 必须以 gh_ 开头";
    case "douyin":
    case "kuaishou":
      return id.trim() ? null : "账号 ID 不能为空";
  }
}

/** 抖音 v.douyin.com 短链 → 跟踪重定向拿完整主页 URL(P1) */
async function expandDouyinShortLink(url: string): Promise<string | null> {
  try {
    let current = url.trim();
    for (let i = 0; i < 5; i++) {
      const res = await fetch(current, {
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        },
      });
      const loc = res.headers.get("location");
      if (!loc) return current;
      current = new URL(loc, current).toString();
      if (/douyin\.com\/(?:share\/)?user\//i.test(current)) return current;
    }
    return current;
  } catch {
    return null;
  }
}

// ─── 类型 ────────────────────────────────────────────────────────────

/** Excel 解析后的原始行(中文表头,key 不保证规范,用 readField 容错读取) */
export type AccountImportRawRow = Record<string, unknown>;

export type PreviewMatchSource = "id" | "url" | "auto" | "none";
export type PreviewStatus = "ok" | "auto" | "error" | "duplicate";

export interface PreviewRow {
  rowIndex: number;
  outletName: string;
  platform: SupportedPlatform;
  platformLabel: string;
  nickname: string;
  identifier: string | null; // secUid/uid/userId/ghid
  identifierLabel: string; // 字段名(给前端占位/提示)
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
  identifier: [
    "账号ID",
    "账号id",
    "账号 ID",
    "secUid",
    "sec_uid",
    "secuid",
    "sec_user_id",
    "uid",
    "userId",
    "user_id",
    "ghid",
  ],
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

// ─── 简易并发池(每批 ≤25 行,并发 5 跑搜索/短链展开) ────────────────────

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

const confirmRowSchema = z.object({
  outletName: z.string().min(1),
  platform: z.enum(["douyin", "weibo", "kuaishou", "wechat_oa"]),
  nickname: z.string().min(1),
  identifier: z.string().min(1),
  profileUrl: z.string().nullable().optional(),
  outletTier: z.enum(OUTLET_TIER_VALUES),
  outletRegion: z.string().min(1),
  groupName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export type ConfirmRow = z.infer<typeof confirmRowSchema>;

function buildChannel(r: ConfirmRow): Channel {
  const profileUrl = r.profileUrl || undefined;
  switch (r.platform) {
    case "douyin":
      return {
        type: "douyin",
        nickname: r.nickname,
        secUid: r.identifier,
        ...(profileUrl ? { profileUrl } : {}),
      };
    case "weibo":
      return {
        type: "weibo",
        nickname: r.nickname,
        uid: r.identifier,
        ...(profileUrl ? { profileUrl } : {}),
      };
    case "kuaishou":
      return {
        type: "kuaishou",
        nickname: r.nickname,
        userId: r.identifier,
        ...(profileUrl ? { profileUrl } : {}),
      };
    case "wechat_oa":
      return { type: "wechat_oa", name: r.nickname, ghid: r.identifier };
  }
}

function channelKey(c: Channel): string {
  return `${c.type}:${getChannelIdentifier(c) ?? ""}`;
}

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
