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
  // Incluye las plantillas .xlsx oficiales (FASE 1) en el bundle serverless para
  // que las rutas de exportación puedan leerlas en producción.
  outputFileTracingIncludes: {
    "/api/processes/**": ["./lib/plantillas-f1/**"],
  },
  // Carpeta de salida. Por defecto `.next`, la misma que usa `next dev`: lanzar
  // un build de medición con el servidor de desarrollo levantado le pisaba los
  // artefactos y lo tumbaba. Con esto se puede compilar aparte
  // (NEXT_DIST_DIR=.next-medicion npx next build) sin tocar el que está en uso.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  // Cabeceras de seguridad para TODAS las respuestas. Antes vivían solo en
  // netlify.toml (atadas a Netlify); aquí son portables y se aplican también en
  // Vercel. El cacheo inmutable de /_next/static/* lo hace Vercel por su cuenta,
  // así que no se replica.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
