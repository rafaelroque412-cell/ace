import { describe, expect, it } from "vitest";
import { PLANTILLAS_BASES } from "@/lib/bases-plantillas";

describe("PLANTILLAS_BASES · Licitación Pública para bienes", () => {
  const plantilla = PLANTILLAS_BASES["Licitación Pública para bienes"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("la Sección Específica tiene los campos confirmados del Capítulo I y III", () => {
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas).toContain("cap1.entidad.nombre");
    expect(rutas).toContain("cap1.entidad.ruc");
    expect(rutas).toContain("cap3.finalidadPublica");
    expect(rutas).toContain("cap3.descripcionRequerimiento");
    expect(rutas).toContain("cap3.modalidadPago");
    expect(rutas).toContain("cap3.sistemaEntrega");
  });

  it("los campos con origen literal declaran de qué hito salen", () => {
    const finalidad = plantilla.seccionEspecifica.find((c) => c.ruta === "cap3.finalidadPublica")!;
    expect(finalidad.origen).toBe("literal");
    expect(finalidad.hito).toBe("A3");
  });

  it("el nombre y RUC de la entidad no se inventan como literal de un hito", () => {
    // Ni A1 ni A9 tienen un campo de nombre/RUC de la entidad contratante: ese
    // dato vive en Configuración → Municipalidad (entity_settings), no en los
    // hitos de la fase de contratación.
    const nombre = plantilla.seccionEspecifica.find((c) => c.ruta === "cap1.entidad.nombre")!;
    const ruc = plantilla.seccionEspecifica.find((c) => c.ruta === "cap1.entidad.ruc")!;
    expect(nombre.origen).toBe("entidad");
    expect(ruc.origen).toBe("entidad");
  });

  it("el resto del Capítulo III (3.3.c-j) y el 3.5 salen de A3/A4, leídos del PDF real", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap3.plazoEntrega"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "plazo_dias" });
    expect(porRuta["cap3.lugarEntrega"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "lugar_entrega" });
    expect(porRuta["cap3.penalidadMora"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "penalidad_mora" });
    expect(porRuta["cap3.otrasPenalidades"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "otras_penalidades" });
    expect(porRuta["cap3.subcontratacion"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "subcontratacion" });
    expect(porRuta["cap3.formulaReajuste"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "formula_reajuste" });
    expect(porRuta["cap3.solucionControversias"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "solucion_controversias" });
    // Los requisitos de calificación de las bases son los DECIDIDOS en la
    // estrategia (A4 · f), no la propuesta del área usuaria en A3.
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
  });

  it("el Capítulo IV (factores de evaluación) sale de la estrategia decidida en A4", () => {
    const factores = plantilla.seccionEspecifica.find((c) => c.ruta === "cap4.factoresEvaluacion")!;
    expect(factores).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("el Capítulo V (proforma del contrato) no se mapea aquí: depende de datos de Fase 2 (buena pro), no de A1-A9", () => {
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas.some((r) => r.startsWith("cap5."))).toBe(false);
  });
});
