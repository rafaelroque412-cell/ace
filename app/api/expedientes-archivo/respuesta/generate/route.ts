import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOpenAIClient, legalAnswerModel as model } from "@/lib/openai-server";
import { estimateCostUsd, roundCostUsd } from "@/lib/openai-cost";
import { searchLegalSources } from "@/lib/legal-chat";
import { searchExpedientes } from "@/lib/expedientes-archivo-search";
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
    const {
      intencion,
      tipoDocumento = "OFICIO",
      documentoTexto = "",
      remitente,
      asunto,
      tone = "formal",
      length = "media",
      selectedSources = [],
      includeAntecedentes = true,
    } = body;

    const intent = typeof intencion === "string" ? intencion.trim() : "";
    if (intent.length < 10) {
      return NextResponse.json(
        { error: "Escribe qué quieres responder (mínimo 10 caracteres)." },
        { status: 400 },
      );
    }
    const tipo = ["OFICIO", "INFORME", "CARTA", "MEMORANDUM"].includes(tipoDocumento)
      ? tipoDocumento
      : "OFICIO";
    const recibido = typeof documentoTexto === "string" ? documentoTexto : "";

    const openai = getOpenAIClient();

    const query = `${intent}. ${asunto ?? ""}. ${recibido.slice(0, 1200)}`.trim();
    const { sources, assessment } = await searchLegalSources({ query, topK: 10 });

    const allSources = [...sources];

    const baseLegal = allSources.slice(0, 8).map((s) =>
      `[${s.citation}] ${s.documentTitle}${s.documentNumber ? ` (${s.documentNumber})` : ""}: ${s.excerpt.slice(0, 400)}`
    ).join("\n\n");

    const selectedNormsBlock = selectedSources.length > 0
      ? `\n\nNORMATIVA SOLICITADA POR EL USUARIO:\n${selectedSources.join("\n")}`
      : "";

    // Antecedentes: expedientes archivados relacionados (referenciales, NO norma).
    // No deben romper la generación si la búsqueda falla.
    type Antecedente = { expedienteId: string; title: string; serie: string | null; anio: number | null; ubicacion: string; excerpt: string };
    let antecedentes: Antecedente[] = [];
    if (includeAntecedentes) {
      try {
        const hits = await searchExpedientes({ query: `${intent} ${asunto ?? ""} ${recibido.slice(0, 600)}`.trim(), topK: 4 });
        const seen = new Set<string>();
        antecedentes = hits
          .filter((h) => (seen.has(h.expedienteId) ? false : (seen.add(h.expedienteId), true)))
          .slice(0, 4)
          .map((h) => ({
            expedienteId: h.expedienteId,
            title: h.title,
            serie: h.serieDocumento,
            anio: h.anio,
            ubicacion: h.ubicacionResumen,
            excerpt: h.excerpt.slice(0, 300),
          }));
      } catch {
        antecedentes = [];
      }
    }
    const antecedentesBlock = antecedentes.length > 0
      ? `\n\nANTECEDENTES DEL ARCHIVO (expedientes previos relacionados; son REFERENCIALES, no normativa — cítalos solo como antecedente si aportan):\n${antecedentes
          .map((a) => `- ${a.title}${a.serie ? ` (${a.serie})` : ""}${a.anio ? `, ${a.anio}` : ""} · ${a.ubicacion}: ${a.excerpt}`)
          .join("\n")}`
      : "";

    const toneInstruction = toneLabels[tone] ?? toneLabels.formal;
    const lengthInstruction = lengthLabels[length] ?? lengthLabels.media;

    const tipoLabel = tipo.charAt(0) + tipo.slice(1).toLowerCase(); // OFICIO -> Oficio

    const systemPrompt = [
      `Eres un asesor legal municipal peruano. Debes redactar el CUERPO de un ${tipoLabel} oficial a partir de la INTENCIÓN del funcionario (lo que quiere comunicar/resolver).`,
      "",
      "Tu tarea: convertir esa intención en la redacción formal del documento, con esta estructura:",
      "1. ANTECEDENTES: contexto y referencia al documento recibido (si lo hay).",
      "2. ANÁLISIS: sustento del pronunciamiento a la luz de la normativa aplicable.",
      "3. CONCLUSIÓN: el pronunciamiento o decisión, alineado con la intención del funcionario.",
      "",
      "NO redactes el membrete, el número, la fecha ni la firma (se añaden aparte): solo el CUERPO.",
      `Estilo de redacción: ${toneInstruction}.`,
      `Extensión: ${lengthInstruction}.`,
      "",
      "Fundamenta SOLO en la normativa proporcionada abajo. NO inventes leyes ni artículos.",
      "Si no hay suficiente sustento normativo, indícalo explícitamente.",
      "Usa tercera persona (la entidad, la municipalidad) y lenguaje profesional.",
    ].join("\n");

    const userMessage = [
      `TIPO DE DOCUMENTO A REDACTAR: ${tipoLabel}`,
      "",
      `LO QUE EL FUNCIONARIO QUIERE RESPONDER (intención — esto es lo que debes desarrollar):`,
      intent,
      "",
      `ASUNTO: ${asunto ?? "No especificado"}`,
      `DIRIGIDO A: ${remitente ?? "No especificado"}`,
      "",
      recibido.trim()
        ? `DOCUMENTO RECIBIDO (antecedente, para contexto):\n${recibido.slice(0, 2000)}`
        : "DOCUMENTO RECIBIDO: no se adjuntó.",
      "",
      `NORMATIVA APLICABLE ENCONTRADA:`,
      baseLegal || "No se encontró normativa directamente aplicable.",
      selectedNormsBlock,
      antecedentesBlock,
      "",
      `Redacta el CUERPO del ${tipoLabel} en español con el formato y estilo indicados.`,
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

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const tokenUsage = {
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsd: roundCostUsd(estimateCostUsd(model, inputTokens, outputTokens)),
    };

    await writeAuditLog({
      action: "respuesta.generate",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        tipoDocumento: tipo,
        asunto,
        remitente,
        tone,
        length,
        sourcesCount: allSources.length,
        antecedentesCount: antecedentes.length,
        selectedSourcesCount: selectedSources.length,
        tokenUsage,
      },
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
      antecedentes,
      assessment,
      tokenUsage,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la respuesta" },
      { status: 500 },
    );
  }
}
