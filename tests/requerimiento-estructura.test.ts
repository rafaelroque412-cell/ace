import { describe, expect, it } from "vitest";
import { estructuraDelRequerimiento, SECCIONES_BASE } from "@/lib/requerimiento-estructura";

/**
 * Qué apartados lleva el Word del requerimiento.
 *
 * El documento salía con NUEVE secciones fijas, las mismas para una Subasta
 * Inversa de bienes que para una Licitación de obras. El modelo del OECE de cada
 * procedimiento no pide lo mismo: los de obras traen metas físicas y fórmulas de
 * reajuste, y el no competitivo no trae ni penalidades ni subcontratación.
 *
 * Así que la estructura la manda el MODELO, con los apartados que
 * `lib/modelo-apartados.ts` ya sabe detectar.
 */
const FICHA = {
  adelantoDirecto: "10% del monto",
  descripcionDetallada: "Servicio de mantenimiento correctivo",
  finalidadPublica: "Garantizar la operatividad",
  formulaReajuste: "K = 0.4",
  metasFisicas: "1 200 m² de pavimento",
  modalidadPago: "Pago único contra conformidad",
  otrasPenalidades: "",
  penalidadMora: "0.10 × monto / (0.25 × plazo)",
  requisitosCalificacion: "",
  solucionControversias: "Arbitraje institucional",
  subcontratacion: "",
};

describe("la estructura la manda el modelo", () => {
  it("solo salen los apartados que el modelo trae", () => {
    const r = estructuraDelRequerimiento(["Modalidad de pago", "Penalidades"], FICHA);
    const titulos = r.map((s) => s.titulo);
    expect(titulos).toContain("MODALIDAD DE PAGO");
    expect(titulos).toContain("PENALIDADES");
    // El modelo no trae fórmula de reajuste: no debe aparecer aunque la ficha
    // tenga el dato. Meter apartados que el formato no pide es lo que hace que
    // el documento no se parezca al modelo.
    expect(titulos).not.toContain("FÓRMULA DE REAJUSTE");
  });

  it("respeta el ORDEN en que el modelo los trae", () => {
    const r = estructuraDelRequerimiento(["Penalidades", "Modalidad de pago"], FICHA);
    expect(r.map((s) => s.titulo)).toEqual(["PENALIDADES", "MODALIDAD DE PAGO"]);
  });

  it("los apartados de obras entran igual que el resto", () => {
    const r = estructuraDelRequerimiento(
      ["Metas físicas u objetivos funcionales (obras)", "Fórmula de reajuste"],
      FICHA,
    );
    expect(r.map((s) => s.titulo)).toEqual(["METAS FÍSICAS U OBJETIVOS FUNCIONALES", "FÓRMULA DE REAJUSTE"]);
  });

  it("sin modelo detectado se cae a la estructura base, no a un documento vacío", () => {
    // Degradar así es lo que ya hace la ficha cuando no hay PDF-modelo cargado.
    const r = estructuraDelRequerimiento([], FICHA);
    expect(r.length).toBe(SECCIONES_BASE.length);
    expect(r[0].titulo).toBe(SECCIONES_BASE[0].titulo);
  });

  it("un apartado sin dato en la ficha sale igual, vacío", () => {
    // El requerimiento se firma: un apartado que el formato pide y la entidad no
    // rellenó tiene que VERSE, no desaparecer sin que nadie lo note.
    const r = estructuraDelRequerimiento(["Subcontratación"], { ...FICHA, subcontratacion: "" });
    expect(r).toHaveLength(1);
    expect(r[0].campos.every((c) => c.valor === "")).toBe(true);
  });
});

describe("cada campo sabe cómo se pinta", () => {
  it("las penalidades adicionales van en TABLA", () => {
    const conFilas = {
      ...FICHA,
      otrasPenalidades: JSON.stringify({
        filas: [{ supuesto: "No usar uniforme", forma: "0.5 UIT", procedimiento: "Descuento" }],
      }),
    };
    const [seccion] = estructuraDelRequerimiento(["Penalidades"], conFilas);
    expect(seccion.campos.some((c) => c.formato === "tabla")).toBe(true);
  });

  it("los requisitos de calificación van en VIÑETAS", () => {
    const conReq = {
      ...FICHA,
      requisitosCalificacion: JSON.stringify({
        obligatorios: [{ nombre: "Capacidad legal", sustento: "RNP vigente" }],
        facultativos: [],
      }),
    };
    const [seccion] = estructuraDelRequerimiento(["3.5 Requisitos de calificación"], conReq);
    expect(seccion.campos.some((c) => c.formato === "vinetas")).toBe(true);
  });

  it("un texto largo va en párrafo", () => {
    const [seccion] = estructuraDelRequerimiento(["3.1 Finalidad pública"], FICHA);
    expect(seccion.campos[0].formato).toBe("parrafo");
    expect(seccion.campos[0].valor).toBe("Garantizar la operatividad");
  });
});
