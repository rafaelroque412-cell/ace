import type { NextConfig } from "next";
import { maxPdfSizeBytes } from "./lib/upload-limits";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: maxPdfSizeBytes,
  },
  poweredByHeader: false,
};

export default nextConfig;
