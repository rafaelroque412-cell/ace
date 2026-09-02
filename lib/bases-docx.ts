// Bases del procedimiento de selección (A9) en Word: Sección General (fija,
// transcrita en lib/bases-plantillas.ts) + Sección Específica (resuelta desde
// los hitos A1-A9 por lib/bases-elaboracion.ts).
//
// // VERIFICAR: es un borrador estructural con las MISMAS convenciones
// tipográficas que lib/buena-pro-docx.ts (Arial 10pt) — el maquetado exacto
// del OECE (numeración, sangrías, tablas) no está replicado carácter por
// carácter. Antes de dar este documento por listo para producción, cotejarlo
// contra el PDF/DOCX oficial del tipo de procedimiento correspondiente.
//
// Un campo con `resuelto: false` se imprime como "[...]", igual que la propia
// plantilla oficial deja sus campos sin completar — nunca se inventa un valor.

import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import type { ValorBases } from "./bases-elaboracion";

const FUENTE = "Arial";
const TAM = 20; // 10 pt.

const TITULO_CAPITULO: Record<string, string> = {
  cap1: "CAPÍTULO I: GENERALIDADES",
  cap2: "CAPÍTULO II: DEL PROCEDIMIENTO DE SELECCIÓN",
  cap3: "CAPÍTULO III: REQUERIMIENTO",
  cap4: "CAPÍTULO IV: EVALUACIÓN",
  cap5: "CAPÍTULO V: PROFORMA DEL CONTRATO",
};

function parrafo(
  texto: string,
  opts?: { negrita?: boolean; alineacion?: (typeof AlignmentType)[keyof typeof AlignmentType] },
): Paragraph {
  return new Paragraph({
    alignment: opts?.alineacion ?? AlignmentType.JUSTIFIED,
    children: [new TextRun({ bold: opts?.negrita, font: FUENTE, size: TAM, text: texto })],
    spacing: { after: 200 },
  });
}

// Heurística para distinguir encabezados ("CAPÍTULO I", "2.2 CONSIDERACIONES
// PARA TODOS LOS PROVEEDORES:") de párrafos de contenido dentro del texto
// plano de la Sección General: un encabezado es una línea corta, en
// mayúsculas, con o sin numeral inicial.
function esEncabezado(linea: string): boolean {
  if (/^CAPÍTULO\s/.test(linea)) return true;
  const sinNumeral = linea.replace(/^\d+(\.\d+)*\.?\s*/, "");
  if (sinNumeral === linea) return false; // no empezaba con numeral
  return sinNumeral.length > 0 && sinNumeral.length < 90 && sinNumeral === sinNumeral.toUpperCase();
}

function parrafosSeccionGeneral(seccionGeneral: string): Paragraph[] {
  return seccionGeneral
    .split("\n")
    .filter((linea) => linea.trim() !== "")
    .map((linea) => parrafo(linea.trim(), { negrita: esEncabezado(linea.trim()) }));
}

function parrafosSeccionEspecifica(valores: ValorBases[]): Paragraph[] {
  const capitulos = new Map<string, ValorBases[]>();
  for (const v of valores) {
    const prefijo = v.ruta.split(".")[0];
    const grupo = capitulos.get(prefijo) ?? [];
    grupo.push(v);
    capitulos.set(prefijo, grupo);
  }

  const parrafos: Paragraph[] = [
    parrafo("SECCIÓN ESPECÍFICA", { alineacion: AlignmentType.CENTER, negrita: true }),
  ];
  for (const [prefijo, campos] of capitulos) {
    parrafos.push(parrafo(TITULO_CAPITULO[prefijo] ?? prefijo.toUpperCase(), { negrita: true }));
    for (const campo of campos) {
      parrafos.push(parrafo(`${campo.label}: ${campo.resuelto ? campo.valor : "[...]"}`));
    }
  }
  return parrafos;
}

export async function generarBasesDocx(
  proceso: string,
  valores: ValorBases[],
  seccionGeneral: string,
): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          parrafo(proceso.toUpperCase(), { alineacion: AlignmentType.CENTER, negrita: true }),
          parrafo("SECCIÓN GENERAL", { alineacion: AlignmentType.CENTER, negrita: true }),
          ...parrafosSeccionGeneral(seccionGeneral),
          ...parrafosSeccionEspecifica(valores),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
