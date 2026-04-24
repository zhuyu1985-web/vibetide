import { createBrowserClient } from "@supabase/ssr";

// 当 env 配置的是 loopback（127.0.0.1 / localhost）时，
// 把 host 替换成浏览器当前访问的 host，这样 LAN 工作站能正确访问本机容器。
function resolveBrowserSupabaseUrl(rawUrl: string): string {
  if (typeof window === "undefined") return rawUrl;
  try {
    const url = new URL(rawUrl);
    const isLoopback =
      url.hostname === "127.0.0.1" ||
      url.hostname === "localhost" ||
      url.hostname === "0.0.0.0";
    if (isLoopback && window.location.hostname) {
      url.hostname = window.location.hostname;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return rawUrl;
  }
}

// 统一 cookie key — 否则 @supabase/ssr 会按 Supabase URL hostname 派生 key，
// 浏览器端（LAN IP）和 SSR 端（127.0.0.1）派生的 key 不一致，SSR 读不到 session。
const SUPABASE_STORAGE_KEY = "sb-vibetide-auth-token";

export function createClient() {
  return createBrowserClient(
    resolveBrowserSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { storageKey: SUPABASE_STORAGE_KEY } }
  );
}
