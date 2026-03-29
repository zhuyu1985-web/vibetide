const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.",
  "10.",
  "192.168.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
];

export function validatePluginUrl(endpoint: string): {
  valid: boolean;
  error?: string;
} {
  try {
    const url = new URL(endpoint);
    for (const blocked of BLOCKED_HOSTS) {
      if (url.hostname.includes(blocked)) {
        return { valid: false, error: `不允许访问内网地址: ${url.hostname}` };
      }
    }
    if (url.protocol !== "https:") {
      return { valid: false, error: "插件端点必须使用 HTTPS 协议" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "无效的 URL 格式" };
  }
}
