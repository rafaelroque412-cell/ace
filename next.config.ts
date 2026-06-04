import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: 50 * 1024 * 1024,
  },
  poweredByHeader: false,
};

export default nextConfig;
