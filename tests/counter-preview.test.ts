import { describe, expect, it } from "vitest";
import { formatCounterPreview } from "@/app/components/oficinas/use-oficinas";

describe("formatCounterPreview", () => {
  it("formato basico con sufijo simple y ancho 3", () => {
    expect(formatCounterPreview("OFICIO", 1, 3, "MDCH", 2026)).toBe(
      "OFICIO N° 001-2026-MDCH",
    );
  });

  it("rellena con ceros a la izquierda segun el ancho", () => {
    expect(formatCounterPreview("INFORME", 42, 4, "MDCH", 2026)).toBe(
      "INFORME N° 0042-2026-MDCH",
    );
  });

  it("sin sufijo: solo numero + anio", () => {
    expect(formatCounterPreview("CARTA", 5, 3, null, 2026)).toBe(
      "CARTA N° 005-2026",
    );
  });

  it("sufijo con segmentos separados por guion", () => {
    expect(formatCounterPreview("OFICIO", 1, 3, "MDCH-GM", 2026)).toBe(
      "OFICIO N° 001-2026-MDCH-GM",
    );
  });

  it("sufijo con segmentos separados por slash", () => {
    expect(formatCounterPreview("OFICIO", 1, 3, "MDCH/GM", 2026)).toBe(
      "OFICIO N° 001-2026-MDCH-GM",
    );
  });

  it("sufijo con multiples segmentos mixtos", () => {
    expect(formatCounterPreview("MEMORANDUM", 12, 3, "MDCH/SG-A", 2026)).toBe(
      "MEMORANDUM N° 012-2026-MDCH-SG-A",
    );
  });

  it("ignora segmentos vacios del sufijo", () => {
    expect(formatCounterPreview("OFICIO", 1, 3, "MDCH//GM", 2026)).toBe(
      "OFICIO N° 001-2026-MDCH-GM",
    );
  });

  it("ancho 6: numero mas largo", () => {
    expect(formatCounterPreview("OFICIO", 1, 6, "MDCH", 2026)).toBe(
      "OFICIO N° 000001-2026-MDCH",
    );
  });

  it("el anio se toma del parametro, no de Date.now()", () => {
    expect(formatCounterPreview("OFICIO", 1, 3, "MDCH", 2099)).toBe(
      "OFICIO N° 001-2099-MDCH",
    );
  });

  it("trimea espacios en cada segmento del sufijo", () => {
    expect(formatCounterPreview("OFICIO", 1, 3, " MDCH / GM ", 2026)).toBe(
      "OFICIO N° 001-2026-MDCH-GM",
    );
  });
});
