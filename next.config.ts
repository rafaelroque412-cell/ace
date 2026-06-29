import type { NextConfig } from "next";
import { maxPdfSizeBytes } from "./lib/upload-limits";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: maxPdfSizeBytes,
  },
  allowedDevOrigins: ['192.168.2.225', 'localhost'],
  // Modulos nativos/ESM que no deben empaquetarse en el server bundle: el OCR de
  // PDFs escaneados rasteriza con pdfjs-dist + el addon nativo @napi-rs/canvas.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
};

export default nextConfig;
