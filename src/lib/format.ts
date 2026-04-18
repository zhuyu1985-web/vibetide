/**
 * UI formatting helpers — keep date/time display consistent across the app.
 */

/**
 * Relative time in Chinese, falls back to absolute date for old entries.
 * Example: "刚刚" / "3 分钟前" / "2 小时前" / "昨天 14:32" / "2026-04-10"
 */
export function formatRelativeTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";

  const now = Date.now();
  const diff = now - d.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < 0) return d.toLocaleString("zh-CN"); // future timestamp
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 2 * day) {
    return `昨天 ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;

  // Same calendar year → no year
  if (d.getFullYear() === new Date().getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Absolute timestamp for tooltips / detailed views.
 */
export function formatAbsoluteTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN");
}

/**
 * Integer formatting with thousand separators.
 */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("zh-CN");
}

/**
 * Percentage 0..1 → "95.2%"
 */
export function formatPercent(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}
