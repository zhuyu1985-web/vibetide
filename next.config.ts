import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许局域网工作站访问 dev server（HMR WebSocket 跨 origin 告警消除）。
  // 注意：Next.js allowedDevOrigins 的 glob 是按 hostname label 匹配的，
  // "*" 只匹配一段，所以 "192.168.*" 匹配不到 "192.168.0.100"。IP 必须写成
  // 4 段形式，否则 HMR WebSocket 握手会返回 ERR_INVALID_HTTP_RESPONSE，
  // dev client 断连重试一段时间后会触发整页 full reload，首页嵌入式对话状态
  // 因此丢失（表现为"对话消失、跳回首页"）。
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.20.*.*",
    "172.21.*.*",
    "172.22.*.*",
    "172.23.*.*",
    "172.24.*.*",
    "172.25.*.*",
    "172.26.*.*",
    "172.27.*.*",
    "172.28.*.*",
    "172.29.*.*",
    "172.30.*.*",
    "172.31.*.*",
  ],
  async redirects() {
    return [
      { source: "/employee-marketplace", destination: "/ai-employees", permanent: true },
      { source: "/team-hub", destination: "/home", permanent: true },
      { source: "/scenarios/customize", destination: "/workflows", permanent: true },
      { source: "/scenarios/customize/:path*", destination: "/workflows", permanent: true },
    ];
  },
};

export default nextConfig;
