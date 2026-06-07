import { describe, expect, it } from "vitest";
import {
  buildStoragePath,
  normalizeDocumentType,
  normalizeProcessType,
  resolveDocumentProcessType,
  sanitizeFileName,
  scopeProcessType,
  supportsAmendment,
} from "@/lib/documents";

describe("normalizeDocumentType", () => {
  it("acepta tipos validos", () => {
    expect(normalizeDocumentType("ley")).toBe("ley");
    expect(normalizeDocumentType("directiva")).toBe("directiva");
  });

  it("colapsa valores desconocidos o no-string a 'otros'", () => {
    expect(normalizeDocumentType("inventado")).toBe("otros");
    expect(normalizeDocumentType(null)).toBe("otros");
  });
});

describe("normalizeProcessType", () => {
  it("acepta procesos validos", () => {
    expect(normalizeProcessType("comparacion_precios")).toBe("comparacion_precios");
  });

  it("devuelve null para vacio o null", () => {
    expect(normalizeProcessType("")).toBeNull();
    expect(normalizeProcessType(null)).toBeNull();
  });

  it("colapsa valores desconocidos a 'otros'", () => {
    expect(normalizeProcessType("inventado")).toBe("otros");
  });
});

describe("sanitizeFileName", () => {
  it("quita acentos y reemplaza caracteres no seguros por guion", () => {
    expect(sanitizeFileName("Ley Nº 32069 (texto).pdf")).toBe("Ley-N-32069-texto-.pdf");
  });

  it("usa un nombre por defecto cuando queda vacio", () => {
    expect(sanitizeFileName("@@@")).toBe("documento.pdf");
  });
});

describe("supportsAmendment", () => {
  it("permite modificatoria en tipos normativos (ley, reglamento, directiva)", () => {
    expect(supportsAmendment("ley")).toBe(true);
    expect(supportsAmendment("reglamento")).toBe(true);
    expect(supportsAmendment("directiva")).toBe(true);
  });

  it("no la permite en otros tipos", () => {
    expect(supportsAmendment("opinion")).toBe(false);
    expect(supportsAmendment("bases_integradas")).toBe(false);
    expect(supportsAmendment("contrato")).toBe(false);
    expect(supportsAmendment("otros")).toBe(false);
  });
});

describe("scopeProcessType (pipeline, no lanzante)", () => {
  it("Ley y Reglamento fuerzan 'todos' aunque la inferencia diga otra cosa", () => {
    // Reproduce el bug: la IA infirio subasta/adjudicacion para Ley/Reglamento.
    expect(scopeProcessType("ley", "subasta_inversa_electronica")).toBe("todos");
    expect(scopeProcessType("reglamento", "adjudicacion_simplificada")).toBe("todos");
  });

  it("Opinion queda en general (null)", () => {
    expect(scopeProcessType("opinion", "licitacion_publica")).toBeNull();
  });

  it("Directiva y otros conservan el proceso (no lanza con null)", () => {
    expect(scopeProcessType("directiva", "subasta_inversa_electronica")).toBe(
      "subasta_inversa_electronica",
    );
    expect(scopeProcessType("directiva", null)).toBeNull();
    expect(scopeProcessType("resolucion", "acuerdo_marco")).toBe("acuerdo_marco");
  });
});

describe("resolveDocumentProcessType", () => {
  it("Ley y Reglamento se aplican a todos los procesos", () => {
    expect(resolveDocumentProcessType("ley", null)).toEqual({ processType: "todos" });
    // Ignora el proceso solicitado y fuerza 'todos'.
    expect(resolveDocumentProcessType("reglamento", "comparacion_precios")).toEqual({
      processType: "todos",
    });
  });

  it("Opinion es de alcance general (sin proceso)", () => {
    expect(resolveDocumentProcessType("opinion", "licitacion_publica")).toEqual({
      processType: null,
    });
  });

  it("Directiva y Bases requieren un proceso especifico", () => {
    expect(resolveDocumentProcessType("directiva", "subasta_inversa_electronica")).toEqual({
      processType: "subasta_inversa_electronica",
    });
    expect(resolveDocumentProcessType("bases_integradas", "licitacion_publica")).toEqual({
      processType: "licitacion_publica",
    });
  });

  it("Directiva y Bases rechazan proceso ausente o 'todos'", () => {
    expect(resolveDocumentProcessType("directiva", null)).toHaveProperty("error");
    expect(resolveDocumentProcessType("bases_integradas", "todos")).toHaveProperty("error");
  });

  it("otros tipos conservan el proceso indicado", () => {
    expect(resolveDocumentProcessType("resolucion", "acuerdo_marco")).toEqual({
      processType: "acuerdo_marco",
    });
    expect(resolveDocumentProcessType("contrato", null)).toEqual({ processType: null });
  });
});

describe("buildStoragePath", () => {
  it("genera ruta year/month/uuid-nombre saneado", () => {
    const path = buildStoragePath("reglamento.pdf");
    expect(path).toMatch(
      /^\d{4}\/\d{2}\/[0-9a-f-]{36}-reglamento\.pdf$/,
    );
  });

  it("genera rutas unicas en llamadas sucesivas", () => {
    expect(buildStoragePath("a.pdf")).not.toBe(buildStoragePath("a.pdf"));
  });
});
