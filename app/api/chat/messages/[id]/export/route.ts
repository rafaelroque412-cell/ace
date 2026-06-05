import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatMessageRow = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  model: string | null;
  role: "user" | "assistant" | "system";
  sources: Array<{
    article?: string | null;
    citation?: string;
    documentTitle?: string;
    pageStart?: number | null;
    pageEnd?: number | null;
    score?: number;
  }>;
  created_at: string;
};

function paragraph(text: string, bold = false) {
  return new Paragraph({
    children: [new TextRun({ bold, text })],
    spacing: { after: 140 },
  });
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) || "respuesta-ace";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const [message] = await supabaseUserRest<ChatMessageRow[]>(
      auth.user.accessToken,
      `chat_messages?id=eq.${id}&select=id,role,content,sources,model,metadata,created_at`,
    );

    if (!message || message.role !== "assistant") {
      return NextResponse.json({ error: "Respuesta no encontrada" }, { status: 404 });
    }

    const question = metadataString(message.metadata ?? {}, "question") ?? "Pregunta no registrada";
    const confidence =
      typeof message.metadata?.confidence === "string"
        ? message.metadata.confidence
        : typeof (message.metadata?.assessment as Record<string, unknown> | undefined)?.confidence === "string"
          ? ((message.metadata.assessment as Record<string, unknown>).confidence as string)
          : "sin dato";
    const sources = Array.isArray(message.sources) ? message.sources : [];
    const children = [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun("ACE IA Jurídica - Respuesta con fuentes")],
      }),
      paragraph(`Fecha: ${new Date(message.created_at).toLocaleString("es-PE")}`),
      paragraph(`Confianza: ${confidence}`, true),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Pregunta")] }),
      paragraph(question),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Respuesta")] }),
      ...message.content.split("\n").filter(Boolean).map((line) => paragraph(line)),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Fuentes")] }),
      ...(sources.length
        ? sources.map((source, index) =>
            paragraph(
              `${index + 1}. ${
                source.citation ??
                [
                  source.documentTitle,
                  source.article ? `art. ${source.article}` : null,
                  source.pageStart ? `pág. ${source.pageStart}` : null,
                ]
                  .filter(Boolean)
                  .join(", ")
              }`,
            ),
          )
        : [paragraph("Sin fuentes persistidas.")]),
      paragraph("Documento generado como apoyo. Verifica la cita y vigencia normativa antes de usarlo formalmente."),
    ];

    const doc = new Document({
      sections: [{ children }],
    });
    const buffer = await Packer.toBuffer(doc);

    await writeAuditLog({
      action: "chat.response.export_docx",
      entityId: id,
      entityType: "chat_message",
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": `attachment; filename="${safeFileName(question)}.docx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo exportar la respuesta" },
      { status: 500 },
    );
  }
}
