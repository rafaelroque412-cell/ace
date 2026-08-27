import { describe, expect, it } from "vitest";
import { ARCHIVO_COLORES, CONTENEDOR_TIPOS, contenedorTipoLabel, extractExpedienteNumber, extractFecha, extractSerieDocumental, getExpedientesNamespace, normalizeCatalogValue, normalizeContenedorTipo } from "@/lib/expedientes-archivo";
import { expedienteSearchSchema } from "@/lib/expedientes-archivo-schema";

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

describe("extractSerieDocumental", () => {
  it("detecta RESOLUCION con modificador variable (DE ALCALDIA)", () => {
    const detectado = extractSerieDocumental(
      "RESOLUCIÓN DE ALCALDÍA N° 004-2024-MDCH-A\n\nVISTOS: el informe...",
    );
    expect(detectado).toEqual({
      serie: "RESOLUCIÓN DE ALCALDÍA N° 004-2024-MDCH-A",
      tipoDocumento: "Resolución",
      numero: "004",
      anio: 2024,
    });
  });

  it("detecta DECRETO y ORDENANZA (antes ausentes del catalogo, causaban null)", () => {
    expect(extractSerieDocumental("DECRETO DE ALCALDÍA N° 002-2024-MDCH")?.tipoDocumento).toBe(
      "Decreto",
    );
    expect(extractSerieDocumental("ORDENANZA MUNICIPAL N° 005-2024-MDCH")?.tipoDocumento).toBe(
      "Ordenanza",
    );
  });

  it("detecta INFORME, OFICIO MULTIPLE y MEMORANDO sin regresion", () => {
    expect(extractSerieDocumental("INFORME N°1555-2026-MDCH/SGEIM-OAD-RTC")?.serie).toBe(
      "INFORME N°1555-2026-MDCH/SGEIM-OAD-RTC",
    );
    expect(extractSerieDocumental("OFICIO MÚLTIPLE N° 012-2024-MDCH-A")?.tipoDocumento).toBe(
      "Oficio",
    );
    expect(extractSerieDocumental("MEMORANDO NRO 22-2026-MDCH/OL")?.tipoDocumento).toBe(
      "Memorando",
    );
  });

  it("el tipo de documento sale de la primera palabra de la cabecera", () => {
    expect(extractSerieDocumental("CARTA N° 8-2025-MDCH")?.tipoDocumento).toBe("Carta");
  });

  it("el anio sale del numero de la cabecera, no de una mencion en el cuerpo", () => {
    const detectado = extractSerieDocumental(
      "OFICIO N° 010-2025-MDCH\n\nSe adjunta copia del año 2019 anterior.",
    );
    expect(detectado?.anio).toBe(2025);
  });

  it("no confunde una mencion en minusculas del cuerpo con la cabecera", () => {
    expect(
      extractSerieDocumental("mediante el informe tecnico se determina lo siguiente"),
    ).toBeNull();
  });

  it("devuelve null sin cabecera reconocible", () => {
    expect(extractSerieDocumental("documento sin numeracion")).toBeNull();
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
