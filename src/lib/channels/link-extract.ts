const URL_RE = /https?:\/\/[^\s，。、；）)】""'']+/g;
const BLOCKED_HOSTS = ["dingtalk.com", "alidocs.dingtalk.com"];

/** 从一段文本里提取 http(s) 链接，去重并过滤钉钉自身域名。 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const url = raw.replace(/[.,;:!?）)】。，、；]+$/u, "");
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }
    if (BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`))) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
