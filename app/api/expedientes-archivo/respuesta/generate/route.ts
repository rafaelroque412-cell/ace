import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOpenAIClient, legalAnswerModel as model } from "@/lib/openai-server";
import { searchLegalSources } from "@/lib/legal-chat";
import { writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const toneLabels: Record<string, string> = {
  cercano: "cercano, accesible y didáctico, como si hablaras directamente con el administrado",
  formal: "formal e institucional, propio de un documento oficial municipal",
  tecnico: "técnico-jurídico especializado, con precisión normativa y terminología legal",
};

const lengthLabels: Record<string, string> = {
  concisa: "breve y directa, solo lo esencial",
  media: "equilibrada, con el detalle suficiente sin ser excesiva",
  detallada: "extensa y profunda, cubriendo todos los aspectos del caso",
};

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { documentoTexto, remitente, asunto, tone = "formal", length = "media", selectedSources = [] } = body;

    if (!documentoTexto || documentoTexto.length < 20) {
      return NextResponse.json({ error: "El texto del documento es insuficiente para generar una respuesta." }, { status: 400 });
    }

    const openai = getOpenAIClient();

    const query = `Documento recibido: ${asunto ?? "solicitud"} de ${remitente ?? "administrado"}. ${documentoTexto.slice(0, 1500)}`;
    const { sources, assessment } = await searchLegalSources({ query, topK: 10 });

    const allSources = [...sources];

    const baseLegal = allSources.slice(0, 8).map((s) =>
      `[${s.citation}] ${s.documentTitle}${s.documentNumber ? ` (${s.documentNumber})` : ""}: ${s.excerpt.slice(0, 400)}`
    ).join("\n\n");

    const selectedNormsBlock = selectedSources.length > 0
      ? `\n\nNORMATIVA SOLICITADA POR EL USUARIO:\n${selectedSources.join("\n")}`
      : "";

    const toneInstruction = toneLabels[tone] ?? toneLabels.formal;
    const lengthInstruction = lengthLabels[length] ?? lengthLabels.media;

    const systemPrompt = [
      "Eres un asesor legal municipal peruano. Debes redactar una respuesta oficial (oficio o carta) para el documento recibido.",
      "",
      "La respuesta debe tener esta estructura:",
      "1. ANTECEDENTES: Resumen del documento recibido.",
      "2. ANÁLISIS: Evaluación del caso a la luz de la normativa aplicable.",
      "3. CONCLUSIÓN: Pronunciamiento o decisión final.",
      "",
      `Estilo de redacción: ${toneInstruction}.`,
      `Extensión: ${lengthInstruction}.`,
      "",
      "Debes fundamentar tu respuesta SOLO en la normativa proporcionada abajo. NO inventes leyes ni artículos.",
      "Si no hay suficiente sustento normativo, indícalo explícitamente.",
      "",
      "Usa tercera persona (la entidad, la municipalidad) y un lenguaje profesional.",
    ].join("\n");

    const userMessage = [
      `DOCUMENTO RECIBIDO:`,
      documentoTexto.slice(0, 2000),
      "",
      `REMITENTE: ${remitente ?? "No especificado"}`,
      `ASUNTO: ${asunto ?? "No especificado"}`,
      "",
      `NORMATIVA APLICABLE ENCONTRADA:`,
      baseLegal || "No se encontró normativa directamente aplicable.",
      selectedNormsBlock,
      "",
      "Redacta la respuesta oficial en español con el formato y estilo indicados.",
    ].join("\n");

    const temperature = tone === "tecnico" ? 0.2 : tone === "cercano" ? 0.5 : 0.3;
    const maxTokens = length === "concisa" ? 1500 : length === "detallada" ? 4000 : 3000;

    const response = await openai.responses.create({
      input: userMessage,
      instructions: systemPrompt,
      model,
      temperature,
      max_output_tokens: maxTokens,
    });

    const respuestaTexto = response.output_text;

    await writeAuditLog({
      action: "respuesta.generate",
      actorReference: auth.user.email ?? auth.user.id,
      details: { asunto, remitente, tone, length, sourcesCount: allSources.length, selectedSourcesCount: selectedSources.length },
      entityType: "respuesta",
      module: "expedientes-archivo",
    });

    return NextResponse.json({
      respuesta: respuestaTexto,
      sources: allSources.slice(0, 8).map((s) => ({
        citation: s.citation,
        title: s.documentTitle,
        number: s.documentNumber,
        excerpt: s.excerpt.slice(0, 300),
      })),
      assessment,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la respuesta" },
      { status: 500 },
    );
  }
}
