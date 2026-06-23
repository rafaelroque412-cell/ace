import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { supabaseRest } from "./supabase-server";
import {
  type PineconeRecord,
  deleteRecords,
  upsertTextRecords,
  verifyDocumentIndexedInPinecone,
} from "./pinecone";
import { chunkPages, extractPdfText } from "./pdf-processing";
import {
  type ExpedienteArchivo,
  extractExpedienteNumber,
  extractFecha,
  getExpedientesNamespace,
} from "./expedientes-archivo";

const chunkInsertBatchSize = 100;
const minExtractedTextLength = 120;
const analysisTextLimit = 14000;

type ExpedienteChunkInsert = {
  expediente_id: string;
  chunk_index: number;
  page_start: number | null;
  page_end: number | null;
  content: string;
  pinecone_vector_id: string;
  metadata: Record<string, unknown>;
};

type ExpedienteInsights = {
  asunto: string | null;
  materia: string | null;
  resumen: string | null;
  remitente: string | null;
  destinatario: string | null;
};

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return {};
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Extrae asunto, materia, resumen, remitente y destinatario con la IA. Devuelve
// nulls si falla (los datos del usuario y los extractores deterministas mandan).
async function analyzeExpedienteWithAi(text: string): Promise<ExpedienteInsights> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [
        {
          content: `Analiza este EXPEDIENTE / DOCUMENTO administrativo terminado de una entidad pública.

Devuelve SOLO JSON válido, sin markdown, con estas claves:
{
  "asunto": "asunto o sumilla en una línea (lo que trata/resuelve)",
  "materia": "materia o tema general (ej: contratación, personal, presupuesto, tránsito)",
  "resumen": "resumen ejecutivo de 3 a 5 líneas de lo que contiene el expediente",
  "remitente": "quién emite/remite el documento o null",
  "destinatario": "a quién se dirige o null"
}

Texto:
${text.slice(0, analysisTextLimit)}`,
          role: "user",
        },
      ],
      max_output_tokens: 700,
      model: legalAnswerModel,
      temperature: 0,
    });
    const parsed = parseJsonObject(response.output_text);
    return {
      asunto: asText(parsed.asunto),
      materia: asText(parsed.materia),
      resumen: asText(parsed.resumen),
      remitente: asText(parsed.remitente),
      destinatario: asText(parsed.destinatario),
    };
  } catch {
    return { asunto: null, materia: null, resumen: null, remitente: null, destinatario: null };
  }
}

function buildExpedienteEmbeddingText(input: {
  title: string;
  numeroDocumento: string | null;
  numeroExpediente: string | null;
  fecha: string | null;
  asunto: string | null;
  materia: string | null;
  remitente: string | null;
  destinatario: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
}) {
  const header = [
    `Expediente: ${input.title}`,
    input.numeroExpediente ? `Nº de expediente: ${input.numeroExpediente}` : null,
    input.numeroDocumento ? `Nº de documento: ${input.numeroDocumento}` : null,
    input.fecha ? `Fecha: ${input.fecha}` : null,
    input.materia ? `Materia: ${input.materia}` : null,
    input.asunto ? `Asunto: ${input.asunto}` : null,
    input.remitente ? `Remitente: ${input.remitente}` : null,
    input.destinatario ? `Destinatario: ${input.destinatario}` : null,
    input.pageStart
      ? input.pageEnd && input.pageEnd !== input.pageStart
        ? `Páginas: ${input.pageStart}-${input.pageEnd}`
        : `Página: ${input.pageStart}`
      : null,
  ].filter(Boolean);

  return `${header.join("\n")}\n\nTexto del expediente:\n${input.content}`;
}

async function insertChunksInBatches(rows: ExpedienteChunkInsert[]) {
  const inserted: Array<ExpedienteChunkInsert & { id: string }> = [];
  for (let index = 0; index < rows.length; index += chunkInsertBatchSize) {
    const batch = rows.slice(index, index + chunkInsertBatchSize);
    const result = await supabaseRest<Array<ExpedienteChunkInsert & { id: string }>>(
      "expedientes_archivo_chunks",
      {
        body: JSON.stringify(batch),
        method: "POST",
      },
    );
    inserted.push(...result);
  }
  return inserted;
}

// Procesa un expediente archivado: extrae texto (OCR vía extractPdfText), detecta
// número/fecha/asunto, fragmenta por páginas, indexa en el namespace AISLADO de
// expedientes en Pinecone y persiste chunks + metadata. Estado: processing -> indexed/error.
export async function processExpedienteDocument(expediente: ExpedienteArchivo, file: File) {
  const namespace = getExpedientesNamespace();
  let insertedVectorIds: string[] = [];

  await supabaseRest(`expedientes_archivo?id=eq.${expediente.id}`, {
    body: JSON.stringify({ error_message: null, status: "processing" }),
    method: "PATCH",
  });

  try {
    const extracted = await extractPdfText(file);
    const text = extracted.text;

    if (text.length < minExtractedTextLength) {
      throw new Error(
        "No se pudo extraer texto suficiente del PDF. El expediente parece escaneado o no legible.",
      );
    }

    const chunks = chunkPages(extracted.pages);
    if (chunks.length === 0) {
      throw new Error("El PDF no contiene suficiente texto para indexar");
    }

    const insights = await analyzeExpedienteWithAi(text);

    // El dato del usuario manda; si no lo dio, se usa lo detectado/IA.
    const numeroDocumento =
      asText(expediente.numero_documento) ?? extractExpedienteNumber(expediente.title, text);
    const numeroExpediente = asText(expediente.numero_expediente);
    const fecha = asText(expediente.fecha) ?? extractFecha(text);
    const asunto = asText(expediente.asunto) ?? insights.asunto;
    const materia = asText(expediente.materia) ?? insights.materia;
    const remitente = asText(expediente.remitente) ?? insights.remitente;
    const destinatario = asText(expediente.destinatario) ?? insights.destinatario;
    const resumen = asText(expediente.resumen) ?? insights.resumen;
    const anio =
      expediente.anio ?? (fecha ? Number.parseInt(fecha.slice(0, 4), 10) : undefined);

    const chunkRows: ExpedienteChunkInsert[] = chunks.map((chunk) => ({
      chunk_index: chunk.index,
      content: chunk.content,
      expediente_id: expediente.id,
      metadata: {
        numeroDocumento,
        fecha,
        materia,
        pageEnd: chunk.pageEnd,
        pageStart: chunk.pageStart,
      },
      page_end: chunk.pageEnd,
      page_start: chunk.pageStart,
      pinecone_vector_id: `expediente::${expediente.id}::${chunk.index}`,
    }));

    const insertedChunks = await insertChunksInBatches(chunkRows);

    const records: PineconeRecord[] = insertedChunks.map((chunk) => ({
      _id: chunk.pinecone_vector_id,
      chunk_id: chunk.id,
      chunk_index: chunk.chunk_index,
      document_id: expediente.id,
      document_number: numeroDocumento ?? undefined,
      document_type: "expediente",
      page_end: chunk.page_end ?? undefined,
      page_start: chunk.page_start ?? undefined,
      source_role: "expediente-archivo",
      status: "indexed",
      text: buildExpedienteEmbeddingText({
        asunto,
        content: chunk.content,
        destinatario,
        fecha,
        materia,
        numeroDocumento,
        numeroExpediente,
        pageEnd: chunk.page_end,
        pageStart: chunk.page_start,
        remitente,
        title: expediente.title,
      }),
      title: expediente.title,
      topic: asunto ?? materia ?? undefined,
      year: Number.isFinite(anio) ? (anio as number) : undefined,
    }));
    insertedVectorIds = records.map((record) => record._id);

    const upsert = await upsertTextRecords(records, namespace);
    const verification = await verifyDocumentIndexedInPinecone({
      documentId: expediente.id,
      expectedMinRecords: records.length,
      namespace,
      query: [expediente.title, numeroDocumento, numeroExpediente, asunto, materia]
        .filter(Boolean)
        .join(" "),
    });

    await supabaseRest(`expedientes_archivo?id=eq.${expediente.id}`, {
      body: JSON.stringify({
        anio: Number.isFinite(anio) ? anio : null,
        asunto,
        body_text: text.slice(0, 200000),
        destinatario,
        fecha,
        materia,
        metadata: {
          ...expediente.metadata,
          chunkCount: chunks.length,
          extractionMethod: extracted.extractionMethod,
          ocrPartial: extracted.ocrPartial,
          pageCount: extracted.pageCount,
          pinecone: {
            namespace,
            recordCount: records.length,
            upserted: upsert?.upserted ?? records.length,
            verification,
          },
          textLength: text.length,
        },
        numero_documento: numeroDocumento,
        remitente,
        resumen,
        status: "indexed",
      }),
      method: "PATCH",
    });

    return { chunkCount: chunks.length, pageCount: extracted.pageCount, textLength: text.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error procesando expediente";
    await deleteRecords(insertedVectorIds, namespace).catch(() => undefined);
    await supabaseRest(`expedientes_archivo_chunks?expediente_id=eq.${expediente.id}`, {
      method: "DELETE",
    }).catch(() => undefined);
    await supabaseRest(`expedientes_archivo?id=eq.${expediente.id}`, {
      body: JSON.stringify({ error_message: errorMessage, status: "error" }),
      method: "PATCH",
    });
    throw error;
  }
}
