import { describe, expect, it } from "vitest";
import {
  detectCitations,
  extractArticleMentions,
  normalizeNormNumber,
} from "@/lib/legal-citations";

describe("normalizeNormNumber", () => {
  it("quita el prefijo N° y deja solo el numero/codigo", () => {
    expect(normalizeNormNumber("N° 32069")).toBe("32069");
    expect(normalizeNormNumber("Nº 30225")).toBe("30225");
  });

  it("conserva guiones de codigos tipo decreto supremo", () => {
    expect(normalizeNormNumber("009-2025-EF")).toBe("009-2025-ef");
  });

  it("devuelve cadena vacia para null/undefined", () => {
    expect(normalizeNormNumber(null)).toBe("");
    expect(normalizeNormNumber(undefined)).toBe("");
  });
});

describe("detectCitations", () => {
  it("detecta 'articulo N de la <norma> N°' con tipo, numero y articulo", () => {
    const [cita] = detectCitations("Conforme al articulo 144 del Reglamento N° 009-2025-EF.");
    expect(cita.refType).toBe("reglamento");
    expect(cita.refArticleNumber).toBe("144");
    // detectCitations preserva el case del numero; solo normalizeNormNumber lo baja.
    expect(cita.refDocumentNumber).toBe("009-2025-EF");
    expect(normalizeNormNumber(cita.refDocumentNumber)).toBe("009-2025-ef");
  });

  it("detecta una referencia a Ley con su numero", () => {
    const [cita] = detectCitations("segun el articulo 5 de la Ley 32069");
    expect(cita.refType).toBe("ley");
    expect(cita.refArticleNumber).toBe("5");
    expect(cita.refDocumentNumber).toBe("32069");
  });

  it("clasifica 'Decreto Supremo' como decreto", () => {
    const citas = detectCitations("aprobado por Decreto Supremo 009-2025-EF");
    expect(citas.some((c) => c.refType === "decreto")).toBe(true);
  });

  it("no duplica la norma cuando ya se capturo como 'articulo N de la <norma>'", () => {
    // El patron de norma suelta no debe volver a contar la Ley 32069 enmascarada.
    const citas = detectCitations("el articulo 10 de la Ley 32069 establece");
    const leyes = citas.filter((c) => c.refType === "ley" && c.refDocumentNumber === "32069");
    expect(leyes).toHaveLength(1);
  });

  it("devuelve lista vacia cuando no hay citas", () => {
    expect(detectCitations("texto sin referencias normativas")).toEqual([]);
  });
});

describe("extractArticleMentions", () => {
  it("extrae numeros de articulo unicos", () => {
    const mentions = extractArticleMentions("el articulo 12 y el articulo 12 y el articulo 60");
    expect(mentions.sort()).toEqual(["12", "60"]);
  });

  it("devuelve lista vacia sin menciones", () => {
    expect(extractArticleMentions("sin articulos aqui")).toEqual([]);
  });
});
