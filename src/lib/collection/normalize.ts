import { createHash } from "node:crypto";
import Chinese from "chinese-s2t";

/**
 * 标题归一化: 繁简转简 → 去标点/符号 → 去空白 → lowercase
 * 对应 spec 6.3 "normalize_title"
 */
export function normalizeTitle(title: string): string {
  if (!title) return "";
  const simplified = Chinese.t2s(title);
  // 去除常见标点(ASCII + 中文) 和 所有空白
  return simplified
    .replace(/[\s\u00A0\u3000]+/g, "")
    .replace(
      /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~！"#¥%&'()*+，－。／：；＜＝＞？＠［＼］＾＿｀｛｜｝～·【】《》「」『』、…—\-]+/g,
      "",
    )
    .toLowerCase();
}

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAM_KEYS = new Set([
  "fbclid",
  "gclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "ref",
  "spm",
]);

/**
 * URL 归一化:
 * - 去 fragment
 * - http→https
 * - lowercase scheme + host
 * - 去尾部斜杠(root 保留)
 * - 去 utm_* / fbclid 等追踪参数
 * - 剩余 query 按键排序
 * 失败返回 null
 */
export function normalizeUrl(raw: string): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // Only handle http(s)
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  // strip trailing slash from pathname except root
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  // filter + sort params
  const filtered = Array.from(url.searchParams.entries())
    .filter(([k]) => {
      if (TRACKING_PARAM_KEYS.has(k)) return false;
      return !TRACKING_PARAM_PREFIXES.some((p) => k.toLowerCase().startsWith(p));
    })
    .sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [k, v] of filtered) url.searchParams.append(k, v);

  return url.toString();
}

export function computeUrlHash(raw: string): string | null {
  const norm = normalizeUrl(raw);
  if (!norm) return null;
  return createHash("md5").update(norm).digest("hex");
}

/**
 * 内容指纹:
 * - 有 publishedAt: bucket = UTC 当天 00:00 epoch (24h)
 * - 无 publishedAt: bucket = floor(capturedAt_epoch / 7d) * 7d (7d)
 * 对应 spec 6.3
 */
export function computeContentFingerprint(
  title: string,
  publishedAt: Date | null,
  capturedAt: Date = new Date(),
): string {
  const titleNorm = normalizeTitle(title);
  let bucket: number;
  if (publishedAt) {
    bucket = Date.UTC(
      publishedAt.getUTCFullYear(),
      publishedAt.getUTCMonth(),
      publishedAt.getUTCDate(),
    );
  } else {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    bucket = Math.floor(capturedAt.getTime() / SEVEN_DAYS_MS) * SEVEN_DAYS_MS;
  }
  return createHash("md5").update(`${titleNorm}:${bucket}`).digest("hex");
}
