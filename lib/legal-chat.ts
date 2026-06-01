import { z } from "zod";
import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { searchTextRecords } from "./pinecone";
import { supabaseRest } from "./supabase-server";

export const chatRequestSchema = z.object({
  mode: z.enum(["breve", "tecnica", "informe", "checklist"]).default("tecnica"),
  question: z.string().min(5),
});

type DocumentChunk = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  pinecone_vector_id: string;
  documents: {
    id: string;
    title: string;
    document_type: string;
    source_entity: string | null;
    file_name: string;
  } | null;
};

export type LegalSource = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  fileName: string;
  sourceEntity: string | null;
  chunkIndex: number;
  score: number;
  excerpt: string;
};

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}

function escapePostgrestIn(values: string[]) {
  return values.map((value) => `"${value.replaceAll('"', '\\"')}"`).join(",");
}

function buildModeInstruction(mode: z.infer<typeof chatRequestSchema>["mode"]) {
  const instructions = {
    breve: "Responde en forma breve, directa y con sustento.",
    checklist: "Responde como checklist operativo, con pasos verificables.",
    informe: "Responde como borrador de informe legal formal, con secciones claras.",
    tecnica: "Responde con tono legal tecnico, preciso y sustentado.",
  };

  return instructions[mode];
}

function buildContext(sources: LegalSource[]) {
  return sources
    .map(
      (source, index) => `[Fuente ${index + 1}]
Documento: ${source.documentTitle}
Tipo: ${source.documentType}
Entidad: ${source.sourceEntity ?? "No registrada"}
Fragmento: ${source.excerpt}`,
    )
    .join("\n\n");
}

function buildFallbackAnswer(question: string, sources: LegalSource[]) {
  const sourceLines = sources
    .slice(0, 3)
    .map(
      (source, index) =>
        `${index + 1}. ${source.documentTitle} (${source.documentType}, fragmento ${
          source.chunkIndex + 1
        })`,
    )
    .join("\n");
  const excerpts = sources
    .slice(0, 2)
    .map((source) => source.excerpt.slice(0, 550))
    .join("\n\n");

  return `Respuesta:
No pude generar una redaccion completa con OpenAI en este momento, pero si encontre fuentes semanticamente relacionadas con la pregunta: "${question}".

Fundamento legal:
Los fragmentos recuperados indican lo siguiente:
${excerpts}

Fuentes usadas:
${sourceLines}

Nivel de confianza: baja`;
}

export async function answerLegalQuestion(input: z.infer<typeof chatRequestSchema>) {
  const hits = await searchTextRecords(input.question, 6);
  const vectorIds = uniqueValues(hits.map((hit) => hit._id));

  if (vectorIds.length === 0) {
    return {
      answer:
        "No encontre fuentes indexadas suficientes para responder con sustento. Sube e indexa documentos relacionados antes de consultar.",
      confidence: "baja",
      sources: [],
    };
  }

  const chunks = await supabaseRest<DocumentChunk[]>(
    `document_chunks?pinecone_vector_id=in.(${escapePostgrestIn(
      vectorIds,
    )})&select=id,document_id,chunk_index,content,pinecone_vector_id,documents(id,title,document_type,source_entity,file_name)`,
  );
  const hitById = new Map(hits.map((hit) => [hit._id, hit]));
  const sources = chunks
    .map((chunk): LegalSource => {
      const hit = hitById.get(chunk.pinecone_vector_id);
      return {
        chunkId: chunk.id,
        chunkIndex: chunk.chunk_index,
        documentId: chunk.document_id,
        documentTitle: chunk.documents?.title ?? hit?.title ?? "Documento sin titulo",
        documentType: chunk.documents?.document_type ?? hit?.document_type ?? "otros",
        excerpt: chunk.content.slice(0, 1400),
        fileName: chunk.documents?.file_name ?? "archivo.pdf",
        score: hit?._score ?? 0,
        sourceEntity: chunk.documents?.source_entity ?? hit?.source_entity ?? null,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const context = buildContext(sources);
  let answer = "";
  let model = legalAnswerModel;

  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [
        {
          content:
            "Eres un asistente juridico especializado en contrataciones publicas peruanas. Responde solo con base en las fuentes proporcionadas. Si las fuentes no alcanzan, dilo claramente. Incluye fundamento, fuentes usadas y nivel de confianza.",
          role: "system",
        },
        {
          content: `${buildModeInstruction(input.mode)}

Pregunta:
${input.question}

Fuentes recuperadas:
${context}

Formato obligatorio:
Respuesta:
Fundamento legal:
Fuentes usadas:
Nivel de confianza: alta/media/baja`,
          role: "user",
        },
      ],
      model: legalAnswerModel,
      temperature: 0.2,
    });

    answer = response.output_text;
  } catch (error) {
    answer = buildFallbackAnswer(input.question, sources);
    model = `fallback-source-extract (${error instanceof Error ? error.message.slice(0, 90) : "OpenAI error"})`;
  }

  await supabaseRest("chat_sessions", {
    body: JSON.stringify({
      metadata: {
        mode: input.mode,
      },
      title: input.question.slice(0, 90),
    }),
    method: "POST",
  });

  return {
    answer,
    confidence: sources.length >= 3 ? "media" : "baja",
    model,
    sources,
  };
}
