export function parseWeiboTime(raw: string, refDate = new Date()): Date | undefined {
  if (!raw) return undefined;
  if (raw === "刚刚") return new Date(refDate);

  const minMatch = raw.match(/^(\d+)\s*分钟前$/);
  if (minMatch) return new Date(refDate.getTime() - parseInt(minMatch[1]!) * 60 * 1000);

  const hourMatch = raw.match(/^(\d+)\s*小时前$/);
  if (hourMatch) return new Date(refDate.getTime() - parseInt(hourMatch[1]!) * 60 * 60 * 1000);

  const todayMatch = raw.match(/^今天\s+(\d{2}):(\d{2})$/);
  if (todayMatch) {
    const d = new Date(refDate);
    d.setHours(parseInt(todayMatch[1]!), parseInt(todayMatch[2]!), 0, 0);
    return d;
  }

  const mdMatch = raw.match(/^(\d{1,2})-(\d{1,2})(?:\s+(\d{2}):(\d{2}))?$/);
  if (mdMatch) {
    const d = new Date(refDate.getFullYear(), parseInt(mdMatch[1]!) - 1, parseInt(mdMatch[2]!));
    if (mdMatch[3]) d.setHours(parseInt(mdMatch[3]!), parseInt(mdMatch[4]!));
    return d;
  }

  const iso = new Date(raw);
  return isNaN(iso.getTime()) ? undefined : iso;
}

export function parseTimestampMs(ms: number | null | undefined): Date | undefined {
  if (!ms || typeof ms !== "number" || ms <= 0) return undefined;
  return new Date(ms);
}

export function parseTimestampSec(s: number | null | undefined): Date | undefined {
  if (!s || typeof s !== "number" || s <= 0) return undefined;
  return new Date(s * 1000);
}
