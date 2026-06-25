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
    if (Object.keys(parsed).length === 0) {
      console.warn(
        `[expedientes] analyzeExpedienteWithAi: respuesta vacia o sin JSON. output_text len=${response.output_text?.length ?? 0}`,
      );
    }
    return {
      asunto: asText(parsed.asunto),
      materia: asText(parsed.materia),
      resumen: asText(parsed.resumen),
      remitente: asText(parsed.remitente),
      destinatario: asText(parsed.destinatario),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[expedientes] analyzeExpedienteWithAi fallo: ${message}`);
    return { asunto: null, materia: null, resumen: null, remitente: null, destinatario: null };
  }
}

function buildExpedienteEmbeddingText(input: {
  title: string;
  sgdExpediente: string | null;
  serieDocumento: string | null;
  tipoDocumento: string | null;
  oficina: string | null;
  asunto: string | null;
  materia: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
}) {
  const header = [
    `Expediente: ${input.title}`,
    input.sgdExpediente ? `Nº SGD: ${input.sgdExpediente}` : null,
    input.serieDocumento ? `Serie documento: ${input.serieDocumento}` : null,
    input.tipoDocumento ? `Tipo: ${input.tipoDocumento}` : null,
    input.oficina ? `Oficina: ${input.oficina}` : null,
    input.materia ? `Materia: ${input.materia}` : null,
    input.asunto ? `Asunto: ${input.asunto}` : null,
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
    const serieDocumento =
      asText(expediente.serie_documento) ?? extractExpedienteNumber(expediente.title, text);
    const sgdExpediente = asText(expediente.sgd_expediente);
    const tipoDocumento = asText(expediente.tipo_documento);
    const oficina = asText(expediente.oficina);
    const fecha = extractFecha(text);
    const asunto = asText(expediente.asunto) ?? insights.asunto;
    const materia = asText(expediente.materia) ?? insights.materia;
    const resumen = asText(expediente.resumen) ?? insights.resumen;
    const anio =
      expediente.anio ?? (fecha ? Number.parseInt(fecha.slice(0, 4), 10) : undefined);

    const chunkRows: ExpedienteChunkInsert[] = chunks.map((chunk) => ({
      chunk_index: chunk.index,
      content: chunk.content,
      expediente_id: expediente.id,
      metadata: {
        serieDocumento,
        anio: Number.isFinite(anio) ? anio : null,
        materia,
        tipoDocumento,
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
      document_number: serieDocumento ?? undefined,
      document_type: "expediente",
      page_end: chunk.page_end ?? undefined,
      page_start: chunk.page_start ?? undefined,
      source_role: "expediente-archivo",
      status: "indexed",
      text: buildExpedienteEmbeddingText({
        asunto,
        content: chunk.content,
        materia,
        oficina,
        pageEnd: chunk.page_end,
        pageStart: chunk.page_start,
        serieDocumento,
        sgdExpediente,
        tipoDocumento,
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
      query: [expediente.title, serieDocumento, sgdExpediente, asunto, materia]
        .filter(Boolean)
        .join(" "),
    });

    await supabaseRest(`expedientes_archivo?id=eq.${expediente.id}`, {
      body: JSON.stringify({
        anio: Number.isFinite(anio) ? anio : null,
        asunto,
        body_text: text.slice(0, 200000),
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
        serie_documento: serieDocumento,
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

// Extrae informacion del PDF para autocompletar el formulario de registro
// del archivo fisico. No guarda nada ni indexa; solo devuelve los datos
// detectados (numero/fecha/asunto/materia/remitente/destinatario/resumen/folios).
export type ExpedienteInventory = {
  numeroExpediente: string | null;
  numeroDocumento: string | null;
  fecha: string | null;
  anio: number | null;
  asunto: string | null;
  materia: string | null;
  remitente: string | null;
  destinatario: string | null;
  resumen: string | null;
  nroFolios: number | null;
  extractionMethod: "ai" | "deterministic" | "hybrid" | "none";
};

export async function extractExpedienteInventory(
  file: File,
  titleHint: string = "",
): Promise<ExpedienteInventory> {
  const inventory: ExpedienteInventory = {
    numeroExpediente: null,
    numeroDocumento: null,
    fecha: null,
    anio: null,
    asunto: null,
    materia: null,
    remitente: null,
    destinatario: null,
    resumen: null,
    nroFolios: null,
    extractionMethod: "none",
  };

  let extracted;
  try {
    extracted = await extractPdfText(file);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[expedientes] extractPdfText fallo: ${message}`);
    throw new Error(
      `No se pudo leer el PDF. Verifica que no esté dañado o protegido con contraseña. (${message})`,
    );
  }

  const text = extracted.text ?? "";

  if (text.length < 50) {
    console.warn(
      `[expedientes] PDF con poco texto (${text.length} chars). Probable escaneado sin OCR.`,
    );
    return inventory;
  }

  // Extractores deterministas
  const numero = extractExpedienteNumber(titleHint, text);
  if (numero) {
    inventory.numeroExpediente = numero;
    inventory.extractionMethod = "deterministic";
  }
  const fecha = extractFecha(text);
  if (fecha) {
    inventory.fecha = fecha;
    const yearMatch = fecha.match(/^(\d{4})-/);
    if (yearMatch) {
      inventory.anio = Number.parseInt(yearMatch[1], 10);
    }
    inventory.extractionMethod = "deterministic";
  }

  // IA para campos semanticos
  const insights = await analyzeExpedienteWithAi(text);
  if (insights.asunto) inventory.asunto = insights.asunto;
  if (insights.materia) inventory.materia = insights.materia;
  if (insights.remitente) inventory.remitente = insights.remitente;
  if (insights.destinatario) inventory.destinatario = insights.destinatario;
  if (insights.resumen) inventory.resumen = insights.resumen;

  if (insights.asunto || insights.materia || insights.resumen) {
    inventory.extractionMethod = inventory.extractionMethod === "deterministic" ? "hybrid" : "ai";
  }

  return inventory;
}
