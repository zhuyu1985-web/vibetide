/**
 * 从平台主页 URL 提取账号识别符。
 *
 * 支持：
 *   - douyin: https://www.douyin.com/user/MS4wLjABAAAA...  → secUid
 *   - weibo:  https://weibo.com/u/1234567890                → uid
 *             https://m.weibo.cn/u/1234567890               → uid
 *   - kuaishou: https://www.kuaishou.com/profile/3xa...    → userId
 *   - wechat_oa: gh_xxxxx                                   → ghid
 *
 * 用户也可直接粘贴裸 ID，函数会容错。
 */

export type SupportedPlatform = "douyin" | "weibo" | "kuaishou" | "wechat_oa";

export interface ParseResult {
  ok: true;
  identifier: string;
  platform: SupportedPlatform;
}

export interface ParseError {
  ok: false;
  error: string;
}

export function parseProfileUrl(
  platform: SupportedPlatform,
  raw: string,
): ParseResult | ParseError {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "请输入主页 URL 或识别符" };

  switch (platform) {
    case "douyin":
      return parseDouyin(trimmed);
    case "weibo":
      return parseWeibo(trimmed);
    case "kuaishou":
      return parseKuaishou(trimmed);
    case "wechat_oa":
      return parseWechatOa(trimmed);
    default:
      return { ok: false, error: `平台 ${platform} 暂不支持` };
  }
}

function parseDouyin(raw: string): ParseResult | ParseError {
  // 裸 secUid（以 MS4wLj 开头）
  if (/^MS4wLj[A-Za-z0-9_-]+$/.test(raw)) {
    return { ok: true, platform: "douyin", identifier: raw };
  }
  // URL 提取
  const match = raw.match(/\/user\/(MS4wLj[A-Za-z0-9_-]+)/);
  if (match) {
    return { ok: true, platform: "douyin", identifier: match[1] };
  }
  return {
    ok: false,
    error:
      "未能识别抖音 secUid。请粘贴形如 https://www.douyin.com/user/MS4wLjABAAAA... 的主页 URL，或直接粘贴 MS4wLj 开头的 secUid",
  };
}

function parseWeibo(raw: string): ParseResult | ParseError {
  // 裸数字 uid
  if (/^\d{6,}$/.test(raw)) {
    return { ok: true, platform: "weibo", identifier: raw };
  }
  // weibo.com/u/12345 / m.weibo.cn/u/12345 / weibo.com/12345
  const match =
    raw.match(/weibo\.(?:com|cn)\/u\/(\d{6,})/) ||
    raw.match(/weibo\.(?:com|cn)\/(\d{6,})(?:[/?]|$)/);
  if (match) {
    return { ok: true, platform: "weibo", identifier: match[1] };
  }
  return {
    ok: false,
    error:
      "未能识别微博 uid。请粘贴形如 https://weibo.com/u/1234567890 的主页 URL，或直接粘贴 6 位以上数字 uid",
  };
}

function parseKuaishou(raw: string): ParseResult | ParseError {
  // 裸 userId（字母数字组合）
  if (/^[A-Za-z0-9_-]{6,}$/.test(raw) && !raw.startsWith("http")) {
    return { ok: true, platform: "kuaishou", identifier: raw };
  }
  const match = raw.match(/kuaishou\.com\/profile\/([A-Za-z0-9_-]+)/);
  if (match) {
    return { ok: true, platform: "kuaishou", identifier: match[1] };
  }
  return {
    ok: false,
    error:
      "未能识别快手 userId。请粘贴 https://www.kuaishou.com/profile/{userId} 形式的主页 URL",
  };
}

function parseWechatOa(raw: string): ParseResult | ParseError {
  if (/^gh_[A-Za-z0-9]+$/.test(raw)) {
    return { ok: true, platform: "wechat_oa", identifier: raw };
  }
  return {
    ok: false,
    error: "请输入以 gh_ 开头的微信公众号 ghid（如 gh_a3d35d4c9d3f）",
  };
}
