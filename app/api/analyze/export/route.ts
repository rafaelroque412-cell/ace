import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const exportSchema = z.object({
  analysis: z.record(z.string(), z.unknown()),
  title: z.string().trim().min(3).max(240),
});

function paragraph(text: string, bold = false) {
  return new Paragraph({ children: [new TextRun({ bold, text })], spacing: { after: 120 } });
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90) || "analisis-ace"
  );
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const payload = exportSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const analysis = payload.data.analysis;
  const findings = Array.isArray(analysis.findings) ? (analysis.findings as Array<Record<string, unknown>>) : [];
  const checklist = Array.isArray(analysis.checklist) ? (analysis.checklist as Array<Record<string, unknown>>) : [];
  const sources = Array.isArray(analysis.sources) ? (analysis.sources as Array<Record<string, unknown>>) : [];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("ACE IA Juridica - Analisis documental")] }),
          paragraph(`Fecha: ${new Date().toLocaleString("es-PE")}`),
          paragraph(`Documento: ${payload.data.title}`, true),
          paragraph(`Confianza: ${String(analysis.confidence ?? "baja")}`),
          paragraph(`Sustento: ${String(analysis.confidenceReason ?? "Sin detalle")}`),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Resumen")] }),
          paragraph(String(analysis.resumen ?? "")),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Hallazgos")] }),
          ...(findings.length
            ? findings.map((item) =>
                paragraph(`${String(item.category ?? "")} (${String(item.severity ?? "")}): ${String(item.message ?? "")}`),
              )
            : [paragraph("Sin hallazgos estructurados.")]),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Checklist")] }),
          ...(checklist.length
            ? checklist.map((item) =>
                paragraph(`${item.done ? "OK" : "PENDIENTE"} - ${String(item.label ?? "")}: ${String(item.note ?? "")}`),
              )
            : [paragraph("Sin checklist.")]),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Riesgos")] }),
          ...stringList(analysis.riesgos).map((item) => paragraph(item)),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Recomendaciones")] }),
          ...stringList(analysis.recomendaciones).map((item) => paragraph(item)),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Fuentes")] }),
          ...(sources.length
            ? sources.slice(0, 12).map((source, index) =>
                paragraph(
                  `${index + 1}. ${String(source.documentTitle ?? "Documento")} (${String(source.documentType ?? "")})${source.article ? `, art. ${source.article}` : ""}${source.pageStart ? `, pag. ${source.pageStart}` : ""}`,
                ),
              )
            : [paragraph("Sin fuentes.")]),
          paragraph("Documento de apoyo. Verifica texto, pagina, articulo y vigencia antes de usarlo formalmente."),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await writeAuditLog({
    action: "document.analyze.export_docx",
    actorReference: auth.user.email ?? auth.user.id,
    details: { title: payload.data.title, user: { id: auth.user.id, role: auth.user.role } },
    entityType: "document_analysis",
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${safeFileName(payload.data.title)}.docx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  });
}
