import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
