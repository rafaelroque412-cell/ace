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

describe("PLANTILLAS_BASES · Licitación Pública de obras", () => {
  const plantilla = PLANTILLAS_BASES["Licitación Pública de obras"];

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

  it("la Sección General refleja el contenido propio de obras (dos sistemas de entrega, JPRD y garantías distintas de bienes)", () => {
    // Estos valores NO son los de bienes (S/ 480 000 / S/ 10 000 000 con otro
    // texto): confirman que no se copió la Sección General de bienes por error.
    expect(plantilla.seccionGeneral).toContain("solo construcción");
    expect(plantilla.seccionGeneral).toContain("diseño y construcción");
    expect(plantilla.seccionGeneral).toContain("S/ 5 000 000,00");
    expect(plantilla.seccionGeneral).toContain("Capacidad Técnica y Profesional");
  });

  it("nombre/RUC de la entidad y el año fiscal siguen el mismo patrón que bienes", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.entidad.ruc"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.anioFiscal"]).toMatchObject({ origen: "libre" });
  });

  it("la finalidad pública y el CUI salen de A3/A4, confirmados contra el PDF de obras", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.cui"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "cui" });
  });

  it("no fuerza el mapeo del resto de 3.2/3.5 de obras: su estructura difiere de bienes y no se adivina", () => {
    // "descripcionRequerimiento"/"modalidadPago"/"sistemaEntrega" son rutas de
    // bienes (3.3.a-b); obras numera distinto (3.5.x) y con contenido propio
    // (expediente técnico, responsabilidades, avances) — no se reutilizan.
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas).not.toContain("cap3.descripcionRequerimiento");
    expect(rutas).not.toContain("cap3.modalidadPago");
    expect(rutas).not.toContain("cap3.sistemaEntrega");
  });
});

describe("PLANTILLAS_BASES · Concurso Público de servicios", () => {
  const plantilla = PLANTILLAS_BASES["Concurso Público de servicios"];

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

  it("la Sección General refleja el contenido propio de servicios (ASISTE, sin el literal f de JPRD)", () => {
    expect(plantilla.seccionGeneral).toContain("ASISTE");
    // Confirmado leyendo el PDF: el Capítulo IV de servicios termina en el
    // literal e) Institución Arbitral — NO tiene el literal f) de JPRD que sí
    // tienen bienes y obras. Si algún día aparece "Centro de administración
    // de la JPRD" aquí, la transcripción se copió mal de otro tipo.
    expect(plantilla.seccionGeneral).not.toContain("Centro de administración de la JPRD");
  });

  it("tiene el mismo mapeo completo que bienes: la estructura del Capítulo III es idéntica", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.entidad.ruc"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap1.anioFiscal"]).toMatchObject({ origen: "libre" });
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.descripcionRequerimiento"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "descripcion" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.sistemaEntrega"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_i_sistema_entrega" });
    expect(porRuta["cap3.plazoEntrega"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "plazo_dias" });
    expect(porRuta["cap3.lugarEntrega"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "lugar_entrega" });
    expect(porRuta["cap3.penalidadMora"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "penalidad_mora" });
    expect(porRuta["cap3.otrasPenalidades"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "otras_penalidades" });
    expect(porRuta["cap3.subcontratacion"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "subcontratacion" });
    expect(porRuta["cap3.formulaReajuste"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "formula_reajuste" });
    expect(porRuta["cap3.solucionControversias"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "solucion_controversias" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
    expect(porRuta["cap4.factoresEvaluacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("el Capítulo V (proforma del contrato) no se mapea aquí", () => {
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas.some((r) => r.startsWith("cap5."))).toBe(false);
  });
});

describe("PLANTILLAS_BASES · Concurso Público para consultoría en general", () => {
  const plantilla = PLANTILLAS_BASES["Concurso Público para consultoría en general"];

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

  it("la Sección General refleja el contenido propio de consultoría en general (evaluadores comité o jurado, sin JPRD)", () => {
    expect(plantilla.seccionGeneral).toContain("consultoría en general");
    expect(plantilla.seccionGeneral).toContain("comité o jurado");
    expect(plantilla.seccionGeneral).not.toContain("Centro de administración de la JPRD");
  });

  it("tiene el mismo mapeo completo que bienes y servicios: la estructura del Capítulo III es idéntica", () => {
    const porRuta = Object.fromEntries(plantilla.seccionEspecifica.map((c) => [c.ruta, c]));
    expect(porRuta["cap1.entidad.nombre"]).toMatchObject({ origen: "entidad" });
    expect(porRuta["cap3.finalidadPublica"]).toMatchObject({ origen: "literal", hito: "A3", campoHito: "finalidad_publica" });
    expect(porRuta["cap3.modalidadPago"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" });
    expect(porRuta["cap3.requisitosCalificacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" });
    expect(porRuta["cap4.factoresEvaluacion"]).toMatchObject({ origen: "literal", hito: "A4", campoHito: "factores_items" });
  });

  it("NO está registrada bajo el valor real del catálogo, porque ese valor es ambiguo (resuelve a 3 PDFs)", () => {
    // "Concurso Público para consultorías y servicios de mantenimiento vial"
    // es el value real en lib/procesos-seleccion.ts, y resuelve a 3 PDFs
    // (BASES_CONSULTORIA_VIAL): esta plantilla es solo uno de los tres, y
    // registrarla bajo ese value habría fingido resuelta una ambigüedad que
    // ACE todavía no puede distinguir (ver el comentario junto a
    // SECCION_GENERAL_CONSULTORIA_GENERAL en lib/bases-plantillas.ts).
    expect(PLANTILLAS_BASES["Concurso Público para consultorías y servicios de mantenimiento vial"]).toBeUndefined();
  });
});
