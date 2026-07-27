import { describe, expect, it } from "vitest";
import { componerOtrasPenalidades } from "@/lib/otras-penalidades";
import { formatRequisitos } from "@/lib/requisitos-calificacion";
import { generarRequerimientoDocx } from "@/lib/requerimiento-docx";

/**
 * El .docx es un zip de XML, así que se puede comprobar de verdad: se genera y se
 * mira dentro. No se afirma «tiene Arial 10,5» leyendo el código, se lee del
 * documento.
 */
async function xmlDel(docx: Buffer): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(docx);
  return zip.file("word/document.xml")!.async("string");
}

const BASE = {
  areaUsuaria: "Gerencia de Servicios Públicos",
  codigo: "REQ-2026-0001",
  entidad: "Municipalidad de Prueba",
  fecha: "2026-07-27",
  items: [],
  lugar: "Abancay",
  nombre: "Servicio de mantenimiento de vías",
  responsable: "Juan Pérez",
  // Los que el generador ya recibía sueltos y sigue usando en la cabecera.
  alcance: "", adelantoDirecto: "", cantidad: "", clasificadorGasto: "",
  condicionesEjecucion: "", departamento: "", descripcionDetallada: "",
  distrito: "", finalidadPublica: "", formulaReajuste: "", fuenteFinanciamiento: "",
  garantias: "", lugarEntrega: "", metaPresupuestal: "", modalidadPago: "",
  montoEstimado: "", objetoLabel: "", penalidadMora: "", plazoEjecucion: "",
  provincia: "", recepcionConformidad: "", requisitosCalificacion: "",
  sistemaEntrega: "", subcontratacion: "", unidadMedida: "",
};

describe("formato del documento", () => {
  it("todo el texto va en Arial 10,5", async () => {
    const xml = await xmlDel(await generarRequerimientoDocx({ ...BASE }));
    // 21 medios puntos = 10,5 pt. Es el tamaño que pidió la entidad.
    expect(xml).toContain('w:ascii="Arial"');
    expect(xml).toContain('w:val="21"');
    // Y que no se haya quedado el 10 pt de antes en el estilo por defecto.
    expect(xml).not.toContain('w:val="20"');
  });

  it("los títulos de apartado van en negrita", async () => {
    const xml = await xmlDel(await generarRequerimientoDocx({ ...BASE }));
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("DENOMINACIÓN DE LA CONTRATACIÓN");
  });

  it("la cita legal del apartado va en CURSIVA", async () => {
    const xml = await xmlDel(
      await generarRequerimientoDocx({ ...BASE, apartados: [], ficha: { finalidadPublica: "Operatividad" } }),
    );
    expect(xml).toContain("<w:i/>");
  });

  it("los requisitos de calificación salen en VIÑETAS, no como JSON", async () => {
    const xml = await xmlDel(
      await generarRequerimientoDocx({
        ...BASE,
        apartados: ["3.5 Requisitos de calificación"],
        // Se serializa con la MISMA funcion que usa la ficha: escribir el
        // formato a mano en la prueba es como se cuela un formato que no existe.
        ficha: {
          requisitosCalificacion: formatRequisitos({
            obligatorios: ["Capacidad legal: RNP vigente"],
            facultativos: [{ nombre: "Experiencia", sustento: "3 obras similares" }],
          }),
        },
      }),
    );
    expect(xml).toContain("<w:numPr>"); // la viñeta
    expect(xml).toContain("Capacidad legal: RNP vigente");
    expect(xml).toContain("3 obras similares");
  });

  it("las penalidades adicionales salen en TABLA", async () => {
    const xml = await xmlDel(
      await generarRequerimientoDocx({
        ...BASE,
        apartados: ["Penalidades"],
        // Serializado con la MISMA funcion que usa la ficha. Escribir el formato
        // a mano fue justo como se me colo uno que no existe: la prueba pasaba
        // por la via de reserva —texto plano— sin llegar nunca a la tabla.
        ficha: {
          otrasPenalidades: componerOtrasPenalidades([
            { calculo: "0.5 UIT", supuesto: "No usar uniforme", verificacion: "Informe del supervisor" },
          ]),
          penalidadMora: "0.10 × monto",
        },
      }),
    );
    expect(xml).toContain("Supuesto de aplicación");
    expect(xml).toContain("No usar uniforme");
  });

  it("nada de lo registrado se queda fuera", async () => {
    // Este es el fallo que se corrigio: el documento salia SOLO con los
    // apartados del modelo, y lo demas que el area usuaria habia registrado
    // desaparecia. Medido sobre datos reales: en REQ-2026-0020 se registraron 29
    // campos y salian 5.
    const xml = await xmlDel(
      await generarRequerimientoDocx({
        ...BASE,
        apartados: ["Modalidad de pago"],
        ficha: {
          cui: "2456789",
          formulaReajuste: "K = 0.4",
          metaPresupuestal: "0034",
          modalidadPago: "Pago único",
        },
      }),
    );
    expect(xml).toContain("Pago único");
    expect(xml).toContain("K = 0.4");
    expect(xml).toContain("2456789");
    expect(xml).toContain("0034");
  });

  it("un apartado que el modelo exige sale aunque este vacio", async () => {
    // Al reves que arriba: en un documento que se firma, lo que el
    // procedimiento pide y nadie relleno vale mas en blanco que desaparecido.
    const xml = await xmlDel(
      await generarRequerimientoDocx({ ...BASE, apartados: ["Subcontratación"], ficha: {} }),
    );
    expect(xml).toContain("Subcontratación");
  });
});
