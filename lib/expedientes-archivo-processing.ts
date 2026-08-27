import { createHash } from "node:crypto";
import { normalizeEntity } from "./entity-utils";
import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { estimateCostUsd, roundCostUsd } from "./openai-cost";
import { supabaseRest, writeAuditLog } from "./supabase-server";
import {
  type PineconeRecord,
  deleteRecords,
  upsertTextRecords,
  verifyDocumentIndexedInPinecone,
} from "./pinecone";
import { type ExtractedPdfText, chunkPages, extractPdfText } from "./pdf-processing";
import {
  type ExpedienteArchivo,
  extractExpedienteNumber,
  extractFecha,
  getExpedientesNamespace,
} from "./expedientes-archivo";

const chunkInsertBatchSize = 100;
const minExtractedTextLength = 120;
const analysisTextLimit = 14000;

// Uso de tokens agregado de un expediente (OCR + análisis semántico). Los
// embeddings (text-embedding-3-small) se omiten: su coste es despreciable.
type ExpedienteTokenUsage = {
  ocr: { model: string; inputTokens: number; outputTokens: number; fromCache: boolean } | null;
  analysis: { model: string; inputTokens: number; outputTokens: number } | null;
  totalTokens: number;
  estimatedCostUsd: number;
};

// Extrae el texto del PDF con CACHE por hash del contenido. Evita re-OCR (el paso
// caro: gpt-4o visión) cuando el mismo PDF ya se procesó (autocompletar /extract,
// indexado, reindex, drainer). Solo cachea resultados de OCR (el texto nativo es
// barato de re-extraer). Si la cache falla, degrada a extracción directa.
async function extractPdfTextCached(
  file: File,
  options: { forceOcr?: boolean } = {},
): Promise<ExtractedPdfText> {
  const bytes = Buffer.from(new Uint8Array(await file.arrayBuffer()));
  const hash = createHash("sha256").update(bytes).digest("hex");

  const cached = await supabaseRest<
    Array<{ extracted: ExtractedPdfText; input_tokens: number; output_tokens: number; model: string | null }>
  >(
    `expedientes_ocr_cache?file_hash=eq.${hash}&select=extracted,input_tokens,output_tokens,model&limit=1`,
  ).catch(() => []);

  const hit = cached[0];
  if (hit?.extracted && (hit.extracted.text?.length ?? 0) >= minExtractedTextLength) {
    return {
      ...hit.extracted,
      usage: {
        fromCache: true,
        inputTokens: hit.input_tokens,
        model: hit.model ?? hit.extracted.usage?.model ?? "",
        outputTokens: hit.output_tokens,
      },
    };
  }

  const extracted = await extractPdfText(file, options);

  if (extracted.extractionMethod === "openai-ocr" && extracted.text.length >= minExtractedTextLength) {
    await supabaseRest("expedientes_ocr_cache", {
      body: JSON.stringify({
        extracted,
        extraction_method: extracted.extractionMethod,
        file_hash: hash,
        input_tokens: extracted.usage?.inputTokens ?? 0,
        model: extracted.usage?.model ?? null,
        output_tokens: extracted.usage?.outputTokens ?? 0,
        page_count: extracted.pageCount,
      }),
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      method: "POST",
    }).catch(() => undefined);
  }

  return extracted;
}

type ExpedienteChunkInsert = {
  documento_id: string;
  expediente_id: string | null;
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
  tipoDocumento: string | null;
  serieDocumental: string | null;
  oficina: string | null;
  personaNombre: string | null;
  personaTipo: "natural" | "juridica" | null;
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

// Extrae con la IA los campos semánticos del expediente y los asigna a los campos
// del formulario (asunto, materia, resumen, tipo de documento, oficina y persona
// interesada). Devuelve nulls si falla (los datos del usuario y los extractores
// deterministas mandan).
type AnalysisUsage = { model: string; inputTokens: number; outputTokens: number };
type AnalysisResult = { insights: ExpedienteInsights; usage: AnalysisUsage };

const emptyInsights: ExpedienteInsights = {
  asunto: null,
  materia: null,
  resumen: null,
  tipoDocumento: null,
  serieDocumental: null,
  oficina: null,
  personaNombre: null,
  personaTipo: null,
};

async function analyzeExpedienteWithAi(text: string): Promise<AnalysisResult> {
  const usage: AnalysisUsage = { inputTokens: 0, model: legalAnswerModel, outputTokens: 0 };
  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [
        {
          content: `Analiza este EXPEDIENTE / DOCUMENTO administrativo terminado de una entidad pública.

Devuelve SOLO JSON válido, sin markdown, con estas claves (usa null si no aparece en el texto, NO inventes):
{
  "asunto": "asunto o sumilla en una línea (lo que trata/resuelve)",
  "materia": "materia o tema general (ej: contratación, personal, presupuesto, tránsito)",
  "resumen": "resumen ejecutivo de 3 a 5 líneas de lo que contiene el expediente",
  "tipoDocumento": "EXACTAMENTE uno de: Resolución, Oficio, Decreto, Ordenanza, Informe, Memorando, Carta, Otro",
  "serieDocumental": "denominación oficial COMPLETA del documento tal como aparece LITERAL en su encabezado, con el tipo y el número juntos (ej: 'RESOLUCIÓN DE ALCALDÍA N° 004-2024-MDCH-A', 'OFICIO MÚLTIPLE N° 012-2024-MDCH-A', 'ORDENANZA MUNICIPAL N° 005-2024-MDCH'). Cópiala EXACTA del texto respetando el tipo completo, 'N°' y el número íntegro; NO la inventes ni abrevies. null si no aparece.",
  "oficina": "oficina, gerencia o área de la entidad que emite el documento, o null",
  "personaNombre": "nombre completo de la persona natural o razón social de la empresa ADMINISTRADA/INTERESADA (el ciudadano o empresa del trámite, NUNCA la entidad pública ni un funcionario que firma), o null",
  "personaTipo": "natural si personaNombre es una persona; juridica si es empresa/organización; null si no hay persona interesada"
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
    usage.inputTokens = response.usage?.input_tokens ?? 0;
    usage.outputTokens = response.usage?.output_tokens ?? 0;
    const parsed = parseJsonObject(response.output_text);
    if (Object.keys(parsed).length === 0) {
      console.warn(
        `[expedientes] analyzeExpedienteWithAi: respuesta vacia o sin JSON. output_text len=${response.output_text?.length ?? 0}`,
      );
    }
    const personaTipo =
      parsed.personaTipo === "natural" || parsed.personaTipo === "juridica"
        ? parsed.personaTipo
        : null;
    return {
      insights: {
        asunto: asText(parsed.asunto),
        materia: asText(parsed.materia),
        resumen: asText(parsed.resumen),
        tipoDocumento: asText(parsed.tipoDocumento),
        serieDocumental: asText(parsed.serieDocumental),
        oficina: asText(parsed.oficina),
        personaNombre: asText(parsed.personaNombre),
        personaTipo,
      },
      usage,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[expedientes] analyzeExpedienteWithAi fallo: ${message}`);
    return {
      insights: { ...emptyInsights },
      usage,
    };
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
    // forceOcr: los expedientes archivados suelen ser escaneados sin capa de texto;
    // el OCR es el camino normal aquí (no depende del flag global del corpus legal).
    // extractPdfTextCached reusa el OCR si este PDF ya se procesó (autocompletar,
    // indexado previo, reindex) en vez de volver a gastar gpt-4o.
    const extracted = await extractPdfTextCached(file, { forceOcr: true });
    const text = extracted.text;

    if (text.length < minExtractedTextLength) {
      throw new Error(
        "No se pudo extraer texto suficiente del PDF ni con OCR. El expediente parece ilegible, está en blanco o es de muy baja calidad de escaneo.",
      );
    }

    const chunks = chunkPages(extracted.pages);
    if (chunks.length === 0) {
      throw new Error("El PDF no contiene suficiente texto para indexar");
    }

    const { insights, usage: analysisUsage } = await analyzeExpedienteWithAi(text);

    // Consumo de IA del expediente: OCR (reutilizado de cache o recién gastado) +
    // análisis semántico. Sirve para estimar el coste por subida.
    const tokenUsage: ExpedienteTokenUsage = (() => {
      const ocr = extracted.usage
        ? {
            fromCache: extracted.usage.fromCache ?? false,
            inputTokens: extracted.usage.inputTokens,
            model: extracted.usage.model,
            outputTokens: extracted.usage.outputTokens,
          }
        : null;
      const analysis = {
        inputTokens: analysisUsage.inputTokens,
        model: analysisUsage.model,
        outputTokens: analysisUsage.outputTokens,
      };
      const totalTokens =
        (ocr ? ocr.inputTokens + ocr.outputTokens : 0) + analysis.inputTokens + analysis.outputTokens;
      const estimatedCostUsd =
        (ocr ? estimateCostUsd(ocr.model, ocr.inputTokens, ocr.outputTokens) : 0) +
        estimateCostUsd(analysis.model, analysis.inputTokens, analysis.outputTokens);
      return { analysis, estimatedCostUsd: roundCostUsd(estimatedCostUsd), ocr, totalTokens };
    })();

    // El dato del usuario manda; si no lo dio, se usa lo detectado/IA.
    // sgd_expediente es MANUAL (N° del sistema documental externo): nunca se
    // autocompleta, solo se persiste lo que el usuario haya escrito.
    const sgdExpediente = asText(expediente.sgd_expediente);
    const tipoDocumento = asText(expediente.tipo_documento) ?? insights.tipoDocumento;
    // Serie documental = denominación oficial literal del documento (ej.
    // "RESOLUCIÓN DE ALCALDÍA N° 004-2024-MDCH-A"). Prioridad: lo que puso el
    // usuario > lo que la IA leyó LITERAL del encabezado > fallback compuesto
    // tipo + número detectado por regex.
    const numeroDetectado = extractExpedienteNumber(expediente.title, text);
    const serieDocumento =
      asText(expediente.serie_documento) ??
      insights.serieDocumental ??
      (numeroDetectado ? [tipoDocumento, numeroDetectado].filter(Boolean).join(" ") : null);
    const oficina = asText(expediente.oficina) ?? insights.oficina;
    const fecha = extractFecha(text);
    const asunto = asText(expediente.asunto) ?? insights.asunto;
    const materia = asText(expediente.materia) ?? insights.materia;
    const resumen = asText(expediente.resumen) ?? insights.resumen;
    const anio =
      expediente.anio ?? (fecha ? Number.parseInt(fecha.slice(0, 4), 10) : undefined);

    const chunkRows: ExpedienteChunkInsert[] = chunks.map((chunk) => ({
      chunk_index: chunk.index,
      content: chunk.content,
      documento_id: expediente.id,
      expediente_id: expediente.expediente_id,
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
      source_entity: normalizeEntity(oficina) || undefined,
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
        // Folios = nº de páginas del PDF. Backfill si el usuario no lo puso a mano
        // (cubre subidas sin auto-análisis); no pisa un valor existente.
        folio:
          asText(expediente.folio) ??
          (extracted.pageCount > 0 ? String(extracted.pageCount) : null),
        materia,
        tipo_documento: tipoDocumento,
        oficina,
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
          tokenUsage,
        },
        serie_documento: serieDocumento,
        resumen,
        status: "indexed",
      }),
      method: "PATCH",
    });

    // Registro de consumo de IA (para agregar gasto por periodo si se necesita).
    await writeAuditLog({
      action: "expedientes.tokens",
      actorReference: expediente.uploaded_by ?? "system",
      details: { ...tokenUsage, expedienteId: expediente.id, pageCount: extracted.pageCount },
      entityId: expediente.id,
      entityType: "expediente_archivo",
      module: "expedientes-archivo",
    }).catch(() => undefined);

    return {
      chunkCount: chunks.length,
      pageCount: extracted.pageCount,
      textLength: text.length,
      tokenUsage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error procesando expediente";
    await deleteRecords(insertedVectorIds, namespace).catch(() => undefined);
    await supabaseRest(`expedientes_archivo_chunks?documento_id=eq.${expediente.id}`, {
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
  serieDocumental: string | null;
  fecha: string | null;
  anio: number | null;
  asunto: string | null;
  materia: string | null;
  tipoDocumento: string | null;
  oficina: string | null;
  personaNombre: string | null;
  personaTipo: "natural" | "juridica" | null;
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
    serieDocumental: null,
    fecha: null,
    anio: null,
    asunto: null,
    materia: null,
    tipoDocumento: null,
    oficina: null,
    personaNombre: null,
    personaTipo: null,
    resumen: null,
    nroFolios: null,
    extractionMethod: "none",
  };

  let extracted;
  try {
    // forceOcr: ver nota en processExpedienteDocument (expedientes escaneados).
    // Con cache: el OCR de aquí se reutiliza luego al indexar (no se paga 2 veces).
    extracted = await extractPdfTextCached(file, { forceOcr: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[expedientes] extractPdfText fallo: ${message}`);
    throw new Error(
      `No se pudo leer el PDF. Verifica que no esté dañado o protegido con contraseña. (${message})`,
    );
  }

  const text = extracted.text ?? "";

  // Folios = nº de páginas del PDF subido (no el "nº de folios" que pudiera
  // mencionar el texto). Se conoce del parseo del PDF aunque el OCR falle.
  if (extracted.pageCount > 0) {
    inventory.nroFolios = extracted.pageCount;
  }

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
  const { insights } = await analyzeExpedienteWithAi(text);
  if (insights.asunto) inventory.asunto = insights.asunto;
  if (insights.materia) inventory.materia = insights.materia;
  if (insights.tipoDocumento) inventory.tipoDocumento = insights.tipoDocumento;
  if (insights.serieDocumental) inventory.serieDocumental = insights.serieDocumental;
  if (insights.oficina) inventory.oficina = insights.oficina;
  if (insights.personaNombre) inventory.personaNombre = insights.personaNombre;
  if (insights.personaTipo) inventory.personaTipo = insights.personaTipo;
  if (insights.resumen) inventory.resumen = insights.resumen;

  if (insights.asunto || insights.materia || insights.resumen) {
    inventory.extractionMethod = inventory.extractionMethod === "deterministic" ? "hybrid" : "ai";
  }

  return inventory;
}
