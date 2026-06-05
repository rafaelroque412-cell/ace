import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const exportSchema = z.object({
  result: z.record(z.string(), z.unknown()),
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
      .slice(0, 90) || "validacion-ace"
  );
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

  const result = payload.data.result;
  const rules = result.rules as Record<string, unknown> | null | undefined;
  const legal = result.legal as Record<string, unknown> | null | undefined;
  const critical = result.critical as Record<string, unknown> | null | undefined;
  const sources = Array.isArray(legal?.sources) ? (legal.sources as Array<Record<string, unknown>>) : [];
  const findings = Array.isArray(rules?.findings) ? (rules.findings as Array<Record<string, unknown>>) : [];
  const nextSteps = Array.isArray(rules?.nextSteps) ? rules.nextSteps : [];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("ACE IA Juridica - Validacion de procedimiento")] }),
          paragraph(`Fecha: ${new Date().toLocaleString("es-PE")}`),
          paragraph(`Titulo: ${payload.data.title}`, true),
          paragraph(`Conclusion: ${String(rules?.conclusion ?? "requiere_revision")}`, true),
          paragraph(`Fuentes criticas: ${critical?.ok ? "completas" : "requieren revision"}`),
          ...(Array.isArray(critical?.missing) && critical.missing.length
            ? [paragraph(`Faltantes: ${critical.missing.join(", ")}`)]
            : []),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Hallazgos")] }),
          ...(findings.length
            ? findings.map((item) =>
                paragraph(
                  `${String(item.code ?? "")} - ${String(item.status ?? "")}: ${String(item.message ?? "")} Accion: ${String(item.action ?? "")}`,
                ),
              )
            : [paragraph("Sin hallazgos.")]),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Pasos siguientes")] }),
          ...(nextSteps.length ? nextSteps.map((step) => paragraph(String(step))) : [paragraph("Sin pasos registrados.")]),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Fuentes recuperadas")] }),
          ...(sources.length
            ? sources.slice(0, 10).map((source, index) =>
                paragraph(
                  `${index + 1}. ${String(source.documentTitle ?? "Documento")} (${String(source.documentType ?? "")})${source.article ? `, art. ${source.article}` : ""}${source.pageStart ? `, pag. ${source.pageStart}` : ""}`,
                ),
              )
            : [paragraph("Sin fuentes recuperadas.")]),
          paragraph("Documento de apoyo. Verifica texto, pagina, articulo y vigencia antes de usarlo formalmente."),
        ],
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);

  await writeAuditLog({
    action: "agent.validation.export_docx",
    actorReference: auth.user.email ?? auth.user.id,
    details: { title: payload.data.title, user: { id: auth.user.id, role: auth.user.role } },
    entityType: "agent_orchestrator",
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${safeFileName(payload.data.title)}.docx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  });
}
