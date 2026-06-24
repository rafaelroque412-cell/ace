import { describe, expect, it } from "vitest";
import {
  ARCHIVO_COLORES,
  CONTENEDOR_TIPOS,
  contenedorTipoLabel,
  expedienteSearchSchema,
  extractExpedienteNumber,
  extractFecha,
  getExpedientesNamespace,
  normalizeCatalogValue,
  normalizeContenedorTipo,
} from "@/lib/expedientes-archivo";

describe("extractExpedienteNumber", () => {
  it("detecta el numero anclado a la palabra clave", () => {
    expect(
      extractExpedienteNumber("Expediente 2024-0345", "EXPEDIENTE N° 2024-0345 sobre licencia"),
    ).toBe("2024-0345");
  });

  it("prioriza el numero del titulo", () => {
    expect(
      extractExpedienteNumber("OFICIO N°012-2026-MDXX", "se hace referencia al oficio 999-2000"),
    ).toBe("012-2026-MDXX");
  });

  it("devuelve null cuando no hay numero", () => {
    expect(extractExpedienteNumber("documento", "texto sin numeracion alguna")).toBeNull();
  });
});

describe("extractFecha", () => {
  it("reconoce fecha textual con tildes", () => {
    expect(extractFecha("Chiclayo, 15 de enero de 2024")).toBe("2024-01-15");
  });

  it("reconoce fecha numerica dd/mm/yyyy", () => {
    expect(extractFecha("Emitido el 03/02/2023.")).toBe("2023-02-03");
  });

  it("devuelve null si no hay fecha valida", () => {
    expect(extractFecha("sin fecha")).toBeNull();
  });
});

describe("catalogo fijo de ubicacion fisica", () => {
  it("normaliza el tipo de contenedor a uno valido", () => {
    expect(normalizeContenedorTipo("caja")).toBe("caja");
    expect(normalizeContenedorTipo("inexistente")).toBe("otros");
    expect(normalizeContenedorTipo(123)).toBe("otros");
  });

  it("solo acepta valores del catalogo (no texto libre)", () => {
    expect(normalizeCatalogValue("rojo", ARCHIVO_COLORES)).toBe("rojo");
    expect(normalizeCatalogValue("fucsia", ARCHIVO_COLORES)).toBeNull();
    expect(normalizeCatalogValue("", ARCHIVO_COLORES)).toBeNull();
  });

  it("etiqueta el tipo de contenedor", () => {
    expect(contenedorTipoLabel("archivador")).toBe("Archivador");
    expect(contenedorTipoLabel("loquesea")).toBe("Otros");
  });

  it("cada tipo del catalogo tiene etiqueta", () => {
    for (const tipo of CONTENEDOR_TIPOS) {
      expect(contenedorTipoLabel(tipo)).toBeTruthy();
    }
  });
});

describe("expedienteSearchSchema", () => {
  it("acepta una consulta valida con anio", () => {
    const parsed = expedienteSearchSchema.safeParse({ query: "licencia", anio: 2024 });
    expect(parsed.success).toBe(true);
  });

  it("rechaza consulta demasiado corta", () => {
    expect(expedienteSearchSchema.safeParse({ query: "a" }).success).toBe(false);
  });
});

describe("getExpedientesNamespace", () => {
  it("usa el default cuando no hay env var", () => {
    const previous = process.env.PINECONE_EXPEDIENTES_NAMESPACE;
    delete process.env.PINECONE_EXPEDIENTES_NAMESPACE;
    expect(getExpedientesNamespace()).toBe("expedientes-archivo");
    if (previous !== undefined) {
      process.env.PINECONE_EXPEDIENTES_NAMESPACE = previous;
    }
  });
});
