import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { objectTypeLabel } from "./legal-taxonomy";
import type { Necesidad } from "./necesidades";

// Genera la "Ficha de Necesidad" (Modulo 1) en formato Word a partir de la
// necesidad registrada. Es un documento de apoyo; debe revisarse y firmarse.

function field(label: string, value: string | number | null | undefined) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ bold: true, text: `${label}: ` }),
      new TextRun(value !== null && value !== undefined && String(value).trim() !== "" ? String(value).trim() : "—"),
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
          heading("I. Identificación General"),
          field("Entidad", necesidad.entidad),
          field("Unidad Ejecutora", necesidad.unidad_ejecutora),
          field("Área usuaria", necesidad.area_usuaria),
          field("Centro de costo", necesidad.centro_costo),
          field("Responsable", necesidad.responsable),
          field("Año Fiscal", necesidad.anio_fiscal),
          field("Fecha de emisión", today),

          heading("II. Clasificación de la Contratación"),
          field("Nombre de la contratación", necesidad.nombre),
          field("Tipo de contratación", objectTypeLabel(necesidad.tipo_objeto)),
          field("Especialidad", necesidad.especialidad),
          field("Subespecialidad", necesidad.subespecialidad),

          heading("III. Planeamiento y Presupuesto"),
          field("Meta presupuestal", necesidad.meta_presupuestal),
          field("Proyecto de inversión / IOARR", necesidad.proyecto_inversion ?? necesidad.ioarr),
          field("Fuente de financiamiento", necesidad.fuente_financiamiento),
          field("Rubro", necesidad.rubro),
          field("Clasificador de gasto", necesidad.clasificador_gasto),
          field("Monto estimado", necesidad.monto_estimado ? `S/ ${necesidad.monto_estimado}` : null),

          heading("IV. Sustento de la necesidad"),
          field("Finalidad pública", necesidad.finalidad_publica),
          field("Problema identificado", necesidad.problema_identificado),
          field("Objetivo", necesidad.objetivo_contratacion),
          field("Beneficio esperado", necesidad.beneficio_esperado),
          field("Descripción detallada", necesidad.descripcion_detallada),
          field("Cantidad", necesidad.cantidad ? `${necesidad.cantidad} ${necesidad.unidad_medida ?? ""}` : null),

          heading("V. Ubicación y Ejecución"),
          field("Lugar de entrega", necesidad.lugar_entrega ? `${necesidad.departamento ?? ""} - ${necesidad.provincia ?? ""} - ${necesidad.distrito ?? ""} (${necesidad.lugar_entrega})` : null),
          field("Fecha requerida", necesidad.fecha_requerida),
          field("Plazo de ejecución (días)", necesidad.plazo_ejecucion),

          heading("VI. Declaración"),
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
