import { describe, expect, it } from "vitest";
import { formatDocumentNumber, splitSufijo, formatCorrelativo } from "@/lib/document-number";

describe("formatDocumentNumber (formato oficial peruano)", () => {
  it("OFICIO: correlativo + anio + entidad", () => {
    expect(formatDocumentNumber({ tipo: "OFICIO", siguiente: 1, ancho: 3, sufijo: "MDCH", year: 2026 })).toBe(
      "OFICIO N° 001-2026-MDCH",
    );
  });

  it("OFICIO: entidad + area separados por /", () => {
    expect(formatDocumentNumber({ tipo: "OFICIO", siguiente: 1, ancho: 3, sufijo: "MDCH/GM", year: 2026 })).toBe(
      "OFICIO N° 001-2026-MDCH/GM",
    );
  });

  it("INFORME: con segmentos multiples por guion se normalizan a /", () => {
    expect(formatDocumentNumber({ tipo: "INFORME", siguiente: 42, ancho: 4, sufijo: "MDCH-SG-A", year: 2026 })).toBe(
      "INFORME N° 0042-2026-MDCH/SG/A",
    );
  });

  it("INFORME: con / y - mixtos", () => {
    expect(formatDocumentNumber({ tipo: "INFORME", siguiente: 5, ancho: 3, sufijo: "MDCH/SG-A", year: 2026 })).toBe(
      "INFORME N° 005-2026-MDCH/SG/A",
    );
  });

  it("CARTA: numero sin sufijo (entidad no definida)", () => {
    expect(formatDocumentNumber({ tipo: "CARTA", siguiente: 7, ancho: 3, sufijo: null, year: 2026 })).toBe(
      "CARTA N° 007-2026",
    );
  });

  it("CARTA: con sufijo completo", () => {
    expect(formatDocumentNumber({ tipo: "CARTA", siguiente: 7, ancho: 3, sufijo: "MDCH/OGRD", year: 2026 })).toBe(
      "CARTA N° 007-2026-MDCH/OGRD",
    );
  });

  it("MEMORANDUM: con sufijo", () => {
    expect(formatDocumentNumber({ tipo: "MEMORANDUM", siguiente: 12, ancho: 3, sufijo: "MDCH/OAF", year: 2026 })).toBe(
      "MEMORANDUM N° 012-2026-MDCH/OAF",
    );
  });

  it("ancho 6: padding a 6 digitos", () => {
    expect(formatDocumentNumber({ tipo: "OFICIO", siguiente: 1, ancho: 6, sufijo: "MDCH", year: 2026 })).toBe(
      "OFICIO N° 000001-2026-MDCH",
    );
  });

  it("el anio se respeta del parametro", () => {
    expect(formatDocumentNumber({ tipo: "OFICIO", siguiente: 1, ancho: 3, sufijo: "MDCH", year: 2099 })).toBe(
      "OFICIO N° 001-2099-MDCH",
    );
  });

  it("ignora segmentos vacios del sufijo", () => {
    expect(formatDocumentNumber({ tipo: "OFICIO", siguiente: 1, ancho: 3, sufijo: "MDCH//GM", year: 2026 })).toBe(
      "OFICIO N° 001-2026-MDCH/GM",
    );
  });

  it("trimea espacios en cada segmento del sufijo", () => {
    expect(formatDocumentNumber({ tipo: "OFICIO", siguiente: 1, ancho: 3, sufijo: " MDCH / GM ", year: 2026 })).toBe(
      "OFICIO N° 001-2026-MDCH/GM",
    );
  });

  it("siguiente > ancho: no se trunca", () => {
    expect(formatDocumentNumber({ tipo: "OFICIO", siguiente: 1234, ancho: 3, sufijo: "MDCH", year: 2026 })).toBe(
      "OFICIO N° 1234-2026-MDCH",
    );
  });

  it("ancho fuera de rango cae al default 3 o se limita a 8", () => {
    expect(formatDocumentNumber({ tipo: "OFICIO", siguiente: 1, ancho: 0, sufijo: "MDCH", year: 2026 })).toBe(
      "OFICIO N° 001-2026-MDCH",
    );
    expect(formatDocumentNumber({ tipo: "OFICIO", siguiente: 1, ancho: 99, sufijo: "MDCH", year: 2026 })).toBe(
      "OFICIO N° 00000001-2026-MDCH",
    );
  });
});

describe("splitSufijo", () => {
  it("separa por /", () => {
    expect(splitSufijo("MDCH/GM")).toEqual(["MDCH", "GM"]);
  });

  it("separa por -", () => {
    expect(splitSufijo("MDCH-SG-A")).toEqual(["MDCH", "SG", "A"]);
  });

  it("ignora segmentos vacios y trimea", () => {
    expect(splitSufijo(" MDCH //  GM ")).toEqual(["MDCH", "GM"]);
  });

  it("vacio o null", () => {
    expect(splitSufijo("")).toEqual([]);
    expect(splitSufijo(null)).toEqual([]);
    expect(splitSufijo(undefined)).toEqual([]);
  });
});

describe("formatCorrelativo", () => {
  it("padding con ceros", () => {
    expect(formatCorrelativo(1, 3)).toBe("001");
    expect(formatCorrelativo(42, 4)).toBe("0042");
  });

  it("numero mas grande que el ancho se imprime completo", () => {
    expect(formatCorrelativo(1234, 3)).toBe("1234");
  });

  it("ancho fuera de rango cae al default 3 (falsy -> 3)", () => {
    expect(formatCorrelativo(5, 0)).toBe("005");
    expect(formatCorrelativo(5, -1)).toBe("005");
    expect(formatCorrelativo(5, 99)).toBe("00000005");
  });
});
