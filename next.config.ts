import type { NextConfig } from "next";
import { maxPdfSizeBytes } from "./lib/upload-limits";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    proxyClientMaxBodySize: maxPdfSizeBytes,
  },
  allowedDevOrigins: ['192.168.2.225', 'localhost'],
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
};

export default nextConfig;
