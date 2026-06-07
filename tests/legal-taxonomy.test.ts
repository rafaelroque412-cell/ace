import { describe, expect, it } from "vitest";
import {
  ANSWERABLE_DOCUMENT_TYPES,
  ANSWERABLE_DOCUMENT_TYPE_OPTIONS,
  DOCUMENT_TYPES,
  documentTypeLabel,
  processTypeLabel,
} from "@/lib/legal-taxonomy";
import { normalizeDocumentType, normalizeProcessType } from "@/lib/documents";

describe("taxonomia documental", () => {
  it("los tipos respondibles son un subconjunto de los tipos documentales", () => {
    const allValues = new Set(DOCUMENT_TYPES.map((t) => t.value));
    for (const value of ANSWERABLE_DOCUMENT_TYPES) {
      expect(allValues.has(value)).toBe(true);
    }
  });

  it("las opciones respondibles coinciden con la lista de valores", () => {
    expect(ANSWERABLE_DOCUMENT_TYPE_OPTIONS.map((o) => o.value).sort()).toEqual(
      [...ANSWERABLE_DOCUMENT_TYPES].sort(),
    );
  });

  it("cada value de taxonomia es un tipo documental valido en lib/documents", () => {
    // Guarda contra desincronizacion entre la taxonomia de UI y los tipos permitidos.
    for (const t of DOCUMENT_TYPES) {
      expect(normalizeDocumentType(t.value)).toBe(t.value);
    }
  });
});

describe("etiquetas legibles", () => {
  it("documentTypeLabel devuelve la etiqueta o un fallback", () => {
    expect(documentTypeLabel("ley")).toBe("Ley");
    expect(documentTypeLabel(null)).toBe("Sin tipo");
    expect(documentTypeLabel("desconocido")).toBe("desconocido");
  });

  it("processTypeLabel devuelve null para vacio", () => {
    expect(processTypeLabel("comparacion_precios")).toBe("Comparacion de precios");
    expect(processTypeLabel(null)).toBeNull();
  });
});

describe("alineacion proceso UI <-> dominio", () => {
  it("todo proceso con etiqueta normaliza al mismo value", () => {
    const labelled = processTypeLabel("subasta_inversa_electronica");
    expect(labelled).toBeTruthy();
    expect(normalizeProcessType("subasta_inversa_electronica")).toBe(
      "subasta_inversa_electronica",
    );
  });
});
