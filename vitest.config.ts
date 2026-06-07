import { defineConfig } from "vitest/config";

// Tests unitarios de la logica de dominio determinista (reglas de procedencia,
// deteccion de citas, taxonomia, normalizacion de documentos). No tocan red ni BD:
// si un test necesita Supabase/Pinecone/OpenAI, mockear esas dependencias.
// resolve.tsconfigPaths resuelve el alias "@/*" del tsconfig nativamente.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
