import { describe, expect, it } from "vitest";
import { evaluateProcurementRules } from "@/lib/procurement-rules";

describe("evaluateProcurementRules - identificacion del procedimiento", () => {
  it("requiere revision cuando no se identifica el procedimiento", () => {
    const result = evaluateProcurementRules({ procedureType: "" });
    expect(result.conclusion).toBe("requiere_revision");
    expect(result.procedureType).toBeNull();
    expect(result.findings[0].code).toBe("PROC-000");
  });

  it("normaliza texto libre a un procedimiento conocido", () => {
    expect(evaluateProcurementRules({ procedureType: "Comparación de Precios" }).procedureType).toBe(
      "comparacion_precios",
    );
    expect(evaluateProcurementRules({ procedureType: "SIE" }).procedureType).toBe(
      "subasta_inversa_electronica",
    );
    expect(evaluateProcurementRules({ procedureType: "licitacion publica" }).procedureLabel).toBe(
      "Licitacion publica",
    );
  });
});

describe("evaluateProcurementRules - comparacion de precios", () => {
  it("procede con datos completos y compatibles", () => {
    const result = evaluateProcurementRules({
      procedureType: "comparacion_precios",
      objectType: "bienes",
      amount: 50000,
      standardized: true,
      marketPlurality: true,
      validOffers: 3,
    });
    expect(result.conclusion).toBe("procede");
    expect(result.findings.every((f) => f.status !== "requiere_dato")).toBe(true);
  });

  it("no procede cuando el objeto no es compatible (obras)", () => {
    const result = evaluateProcurementRules({
      procedureType: "comparacion_precios",
      objectType: "obras",
      amount: 50000,
      standardized: true,
      marketPlurality: true,
      validOffers: 3,
    });
    expect(result.conclusion).toBe("no_procede");
    expect(result.findings.some((f) => f.code === "CP-OBJ-002" && f.status === "no_cumple")).toBe(
      true,
    );
  });

  it("requiere revision cuando faltan datos clave", () => {
    const result = evaluateProcurementRules({ procedureType: "comparacion_precios" });
    expect(result.conclusion).toBe("requiere_revision");
    expect(result.findings.some((f) => f.status === "requiere_dato")).toBe(true);
  });

  it("no procede si el objeto no es comparable por precio", () => {
    const result = evaluateProcurementRules({
      procedureType: "comparacion_precios",
      objectType: "bienes",
      amount: 50000,
      standardized: false,
      marketPlurality: true,
      validOffers: 3,
    });
    expect(result.findings.some((f) => f.code === "CP-MERCADO-002" && f.status === "no_cumple")).toBe(
      true,
    );
    expect(result.conclusion).toBe("no_procede");
  });
});
