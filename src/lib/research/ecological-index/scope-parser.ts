// 生态文明传播指数报告 - 媒体名单 xlsx 解析
//
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §5.1
// Plan: docs/superpowers/plans/2026-05-26-ecological-index-report-plan.md Task 2.1
//
// 输入: 14 列 xlsx (分级|媒体名|集团|区域|区县|行业|网站|公众号名|抖音URL|
//                    微博URL|快手URL|快手备注|公众号ghid|备注)
// 输出: ParsedScope (units + warnings + stats)
//
// 关键规则:
//   1. tier 字符串 → enum:
//        央级 → central
//        行业 → industry
//        省/市级 / 市级 → municipal
//        区县融媒 → district_rmt
//        政务新媒体 → district_gov
//   2. 区县归并: 江北区 + 渝北区 → 两江新区 (districtNormalized 字段)
//   3. district 缺失补全: L32 忠州新闻 → 忠县; L54 巫溪发布 → 巫溪县
//   4. 公众号别名: H 列用 "|" 分隔(trim 后过滤空与 "无")
//   5. 微博 UID: 从 J 列 URL weibo.com/u/<digits> 或 weibo.com/<digits>?
//   6. 网站: G 列 "|" 分隔, 去 https?:// 与尾部 "/"
//   7. 多 URL 字段(抖音/快手): 拆行后取首个含 douyin.com / kuaishou.com 的
//   8. xlsxRow: 1-based, 含表头, L2 是第一行数据
//
// 该实现移植自项目早期 scripts/build_media_scope_final.py 的 vetted Python 逻辑,
// 是范本而非 spike 实验。

import * as XLSX from "@e965/xlsx";
import type {
  ParsedScope,
  ParsedScopeUnit,
  ScopeUnitTier,
} from "./types";

/** xlsx 列索引常量(0-based),与 fixture 一致 */
const COL = {
  TIER: 0,
  NAME: 1,
  // GROUP: 2,
  // REGION: 3,
  DISTRICT: 4,
  // INDUSTRY: 5,
  WEBSITES: 6,
  WECHAT_NAMES: 7,
  DOUYIN: 8,
  WEIBO: 9,
  KUAISHOU: 10,
  // KUAISHOU_NOTE: 11,
  WECHAT_GHID: 12,
  // REMARK: 13,
} as const;

/** xlsx 中文分级 → enum */
const TIER_MAP: Record<string, ScopeUnitTier> = {
  央级: "central",
  行业: "industry",
  "省/市级": "municipal",
  市级: "municipal",
  区县融媒: "district_rmt",
  政务新媒体: "district_gov",
};

/** District 归并:江北/渝北 → 两江新区 */
function normalizeDistrict(name: string | null | undefined): string | null {
  if (!name) return null;
  if (name === "江北区" || name === "渝北区") return "两江新区";
  return name;
}

/** 从 weibo URL 中提取数字 UID(优先 /u/<digits>,其次 /<digits>) */
function extractWeiboUid(url: string | null | undefined): string | null {
  if (!url) return null;
  const mU = url.match(/weibo\.com\/u\/(\d+)/);
  if (mU?.[1]) return mU[1];
  const mD = url.match(/weibo\.com\/(\d+)(?:[?\/]|$)/);
  if (mD?.[1]) return mD[1];
  return null;
}

/** "|" 分隔的别名列表(过滤空与 "无") */
function splitPipe(s: unknown): string[] {
  if (typeof s !== "string") return [];
  return s
    .split("|")
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x !== "无");
}

/** "|" 分隔的网站,去协议头与尾部 "/" */
function splitWebsites(s: unknown): string[] {
  if (typeof s !== "string") return [];
  return s
    .split("|")
    .map((x) =>
      x.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""),
    )
    .filter((x) => x.length > 0 && x !== "无");
}

/** 多行 / 多分隔符 URL 字段,取首个含指定 host 的 URL */
function firstUrlByHost(s: unknown, host: string): string | null {
  if (typeof s !== "string") return null;
  for (const line of s.split(/[\n;]+/)) {
    const t = line.trim();
    if (t && t.includes(host)) return t;
  }
  return null;
}

/**
 * 解析媒体名单 xlsx
 *
 * @param buffer xlsx 文件 Buffer(由调用方读取后传入)
 * @returns ParsedScope 含 units / warnings / stats
 * @throws 当 xlsx 无可用 sheet 时
 */
export function parseMediaScopeXlsx(buffer: Buffer): ParsedScope {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("xlsx 文件无 sheet");
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("xlsx 第一个 sheet 无内容");

  // header:1 让每行返回 cell 数组(不依赖列名映射,容错性更强)
  const rows = XLSX.utils.sheet_to_json<Array<unknown>>(ws, {
    header: 1,
    defval: null,
  });

  const units: ParsedScopeUnit[] = [];
  const warnings: string[] = [];

  // rows[0] 是表头,从 rows[1] 起为数据
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row) continue;
    // 整行空跳过
    if (row.every((c) => c === null || c === "" || c === undefined)) continue;

    const tierStr =
      row[COL.TIER] == null ? "" : String(row[COL.TIER]).trim();
    const name =
      row[COL.NAME] == null ? "" : String(row[COL.NAME]).trim();
    if (!tierStr || !name) continue;

    const tier = TIER_MAP[tierStr];
    if (!tier) {
      warnings.push(`L${r + 1} ${name}: 未知分级 '${tierStr}', 已跳过`);
      continue;
    }

    // ---- district + 补全 ----
    let districtOrig: string | null =
      row[COL.DISTRICT] == null
        ? null
        : String(row[COL.DISTRICT]).trim() || null;
    const noteParts: string[] = [];
    if (name === "忠州新闻" && !districtOrig) {
      districtOrig = "忠县";
      noteParts.push("district 已补全(忠县)");
      warnings.push(`L${r + 1} 忠州新闻: 自动补 district='忠县'`);
    }
    if (name === "巫溪发布" && !districtOrig) {
      districtOrig = "巫溪县";
      noteParts.push("district 已补全(巫溪县)");
      warnings.push(`L${r + 1} 巫溪发布: 自动补 district='巫溪县'`);
    }
    const districtNormalized = normalizeDistrict(districtOrig);

    // ---- ghid ----
    const ghidRaw =
      row[COL.WECHAT_GHID] == null
        ? ""
        : String(row[COL.WECHAT_GHID]).trim();
    const wechatGhid = ghidRaw.startsWith("gh_") ? ghidRaw : null;

    // ---- weibo ----
    const weiboUrl = firstUrlByHost(row[COL.WEIBO], "weibo.com");
    const weiboUid = extractWeiboUid(weiboUrl);

    // ---- douyin / kuaishou ----
    const douyinUrl = firstUrlByHost(row[COL.DOUYIN], "douyin.com");
    const kuaishouUrl = firstUrlByHost(row[COL.KUAISHOU], "kuaishou.com");

    units.push({
      xlsxRow: r + 1, // 1-based, 含表头 (L2 是第一行数据)
      name,
      tier,
      districtOrig,
      districtNormalized,
      websites: splitWebsites(row[COL.WEBSITES]),
      wechatNames: splitPipe(row[COL.WECHAT_NAMES]),
      wechatGhid,
      weiboUid,
      weiboHandle: null, // P2 不主动猜微博 handle,P3 matcher 阶段再补
      douyinUrl,
      kuaishouUrl,
      notes: noteParts.length > 0 ? noteParts.join("; ") : null,
    });
  }

  const stats = {
    totalUnits: units.length,
    centralCount: units.filter((u) => u.tier === "central").length,
    industryCount: units.filter((u) => u.tier === "industry").length,
    municipalCount: units.filter((u) => u.tier === "municipal").length,
    districtRmtCount: units.filter((u) => u.tier === "district_rmt").length,
    districtGovCount: units.filter((u) => u.tier === "district_gov").length,
  };

  return { units, warnings, stats };
}
