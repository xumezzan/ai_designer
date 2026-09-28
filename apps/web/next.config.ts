import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Browser code only ever calls relative URLs; the dev server proxies them to FastAPI.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/media/:path*", destination: `${API_URL}/media/:path*` },
    ];
  },
  allowedDevOrigins: ["*.e2b.app", "localhost"],
  images: { unoptimized: true },
};

export default nextConfig;
