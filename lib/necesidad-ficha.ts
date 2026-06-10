import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { objectTypeLabel } from "./legal-taxonomy";
import type { Necesidad } from "./necesidades";

// Genera la "Ficha de Necesidad" (Modulo 1) en formato Word a partir de la
// necesidad registrada. Es un documento de apoyo; debe revisarse y firmarse.

function field(label: string, value: string | null | undefined) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ bold: true, text: `${label}: ` }),
      new TextRun(value && value.trim() ? value.trim() : "—"),
    ],
  });
}

function heading(text: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 80 }, text });
}

export async function buildFichaNecesidadDocx(necesidad: Necesidad): Promise<Buffer> {
  const today = new Date().toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" });

  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            text: "FICHA DE NECESIDAD",
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [new TextRun({ italics: true, text: `Código: ${necesidad.codigo ?? "(pendiente)"}` })],
          }),
          field("Entidad", necesidad.entity),
          field("Área usuaria", necesidad.area_usuaria),
          field("Fecha de emisión", today),
          heading("I. Identificación de la contratación"),
          field("Nombre de la contratación", necesidad.nombre),
          field("Tipo de contratación", objectTypeLabel(necesidad.tipo_contratacion)),
          field("Centro de costo", necesidad.centro_costo),
          field("Meta presupuestal", necesidad.meta_presupuestal),
          field("Proyecto de inversión", necesidad.proyecto_inversion),
          heading("II. Sustento de la necesidad"),
          field("Finalidad pública", necesidad.finalidad_publica),
          field("Objetivo", necesidad.objetivo),
          field("Descripción / resumen", necesidad.summary),
          heading("III. Declaración"),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun(
                "El área usuaria declara la persistencia de la necesidad y la veracidad de la información consignada conforme a la Ley N.° 32069 y su Reglamento.",
              ),
            ],
          }),
          new Paragraph({ spacing: { before: 240 }, children: [new TextRun("Firma / área usuaria: ______________________________")] }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
