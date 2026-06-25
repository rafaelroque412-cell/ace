import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
  WidthType,
} from "docx";

export type RespuestaInput = {
  entity: { name: string; ruc: string; address: string; executingUnit: string };
  nroOficio: string;
  destinatario: string;
  cargoDestinatario: string;
  asunto: string;
  cuerpo: string;
  baseLegal: { referencia: string; texto: string }[];
  remitente: string;
  cargoRemitente: string;
};

export async function buildRespuestaDocx(input: RespuestaInput): Promise<Buffer> {
  const today = new Date().toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const children: Paragraph[] = [];

  // ── Línea de referencia ──
  children.push(
    new Paragraph({
      children: [
        new TextRun({ bold: true, font: "Calibri", size: 22, text: input.entity.name.toUpperCase() }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({ font: "Calibri", size: 20, text: `RUC: ${input.entity.ruc}` }),
      ],
      spacing: { after: 20 },
    }),
    new Paragraph({
      children: [
        new TextRun({ font: "Calibri", size: 20, text: input.entity.address }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      border: {
        bottom: { color: "0d9488", size: 6, style: BorderStyle.SINGLE, space: 1 },
      },
      spacing: { after: 200 },
      text: "",
    }),
  );

  // ── Número de oficio ──
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ bold: true, font: "Calibri", size: 22, text: input.nroOficio }),
      ],
      spacing: { after: 40 },
    }),
  );

  // ── Señor(es) ──
  children.push(
    new Paragraph({
      children: [
        new TextRun({ font: "Calibri", size: 22, text: "Señor(es):" }),
      ],
      spacing: { after: 20 },
    }),
    new Paragraph({
      children: [
        new TextRun({ bold: true, font: "Calibri", size: 22, text: input.destinatario }),
      ],
      spacing: { after: 20 },
    }),
    new Paragraph({
      children: [
        new TextRun({ font: "Calibri", size: 20, text: input.cargoDestinatario }),
      ],
      spacing: { after: 100 },
    }),
  );

  // ── Asunto ──
  children.push(
    new Paragraph({
      children: [
        new TextRun({ bold: true, font: "Calibri", size: 22, text: "Asunto: " }),
        new TextRun({ font: "Calibri", size: 22, text: input.asunto }),
      ],
      spacing: { after: 60 },
    }),
  );

  // ── Fecha ──
  children.push(
    new Paragraph({
      children: [
        new TextRun({ font: "Calibri", size: 22, text: `Fecha: ${today}` }),
      ],
      spacing: { after: 200 },
    }),
  );

  // ── Cuerpo ──
  children.push(
    new Paragraph({
      children: [
        new TextRun({ font: "Calibri", size: 22, text: input.cuerpo }),
      ],
      spacing: { after: 200 },
    }),
  );

  // ── Base legal ──
  if (input.baseLegal.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ bold: true, font: "Calibri", size: 22, text: "Base legal:" })],
        spacing: { after: 80 },
      }),
    );
    for (const ref of input.baseLegal) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ bold: true, font: "Calibri", size: 20, text: `${ref.referencia}: ` }),
            new TextRun({ font: "Calibri", size: 20, text: ref.texto.slice(0, 500) }),
          ],
          spacing: { after: 60 },
          indent: { left: 400 },
        }),
      );
    }
    children.push(new Paragraph({ spacing: { after: 200 }, text: "" }));
  }

  // ── Despedida ──
  children.push(
    new Paragraph({
      children: [
        new TextRun({ font: "Calibri", size: 22, text: "Atentamente," }),
      ],
      spacing: { after: 400 },
    }),
  );

  // ── Firma ──
  children.push(
    new Paragraph({
      children: [
        new TextRun({ bold: true, font: "Calibri", size: 22, text: input.remitente }),
      ],
      spacing: { after: 20 },
    }),
    new Paragraph({
      children: [
        new TextRun({ font: "Calibri", size: 20, text: input.cargoRemitente }),
      ],
      spacing: { after: 20 },
    }),
    new Paragraph({
      children: [
        new TextRun({ color: "888888", font: "Calibri", italics: true, size: 18, text: "Documento generado por ACE IA Jurídica. Revise y valide antes de emitir." }),
      ],
      spacing: { before: 120 },
    }),
  );

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              bottom: 1100,
              left: 1100,
              right: 1100,
              top: 1100,
            },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
