import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { type SearchFilters, searchTextRecords } from "./pinecone";
import { supabaseRest } from "./supabase-server";
import {
  type ExpedienteChatInput,
  type ExpedienteSearchInput,
  contenedorTipoLabel,
  getExpedientesNamespace,
} from "./expedientes-archivo";

// Ubicación física del expediente (dónde está en papel).
export type ExpedienteUbicacion = {
  tipoContenedor: string;
  tipoContenedorLabel: string;
  nroArchivador: string | null;
  nroCaja: string | null;
  color: string | null;
  ubicacion: string | null;
  codigoUbicacion: string | null;
  nroFolios: number | null;
};

export type ExpedienteSearchResult = {
  expedienteId: string;
  numeroDocumento: string | null;
  numeroExpediente: string | null;
  title: string;
  asunto: string | null;
  materia: string | null;
  fecha: string | null;
  anio: number | null;
  remitente: string | null;
  destinatario: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  excerpt: string;
  score: number;
  storagePath: string | null;
  storageBucket: string | null;
  citation: string;
  ubicacion: ExpedienteUbicacion;
  ubicacionResumen: string;
};

type ChunkRow = { id: string; content: string };
type ExpRow = {
  id: string;
  title: string;
  asunto: string | null;
  materia: string | null;
  fecha: string | null;
  anio: number | null;
  numero_documento: string | null;
  numero_expediente: string | null;
  remitente: string | null;
  destinatario: string | null;
  tipo_contenedor: string;
  nro_archivador: string | null;
  nro_caja: string | null;
  color: string | null;
  ubicacion: string | null;
  codigo_ubicacion: string | null;
  nro_folios: number | null;
  storage_path: string | null;
  storage_bucket: string | null;
};

const EXP_SELECT =
  "id,title,asunto,materia,fecha,anio,numero_documento,numero_expediente,remitente,destinatario,tipo_contenedor,nro_archivador,nro_caja,color,ubicacion,codigo_ubicacion,nro_folios,storage_path,storage_bucket";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Arma el resumen legible de la ubicación física: "Caja 045 (rojo) · Archivo Central · 120 folios".
function buildUbicacion(exp?: ExpRow): { ubicacion: ExpedienteUbicacion; resumen: string } {
  const tipo = exp?.tipo_contenedor ?? "otros";
  const ubicacion: ExpedienteUbicacion = {
    tipoContenedor: tipo,
    tipoContenedorLabel: contenedorTipoLabel(tipo),
    nroArchivador: exp?.nro_archivador ?? null,
    nroCaja: exp?.nro_caja ?? null,
    color: exp?.color ?? null,
    ubicacion: exp?.ubicacion ?? null,
    codigoUbicacion: exp?.codigo_ubicacion ?? null,
    nroFolios: exp?.nro_folios ?? null,
  };

  const contenedor = [
    contenedorTipoLabel(tipo),
    ubicacion.nroCaja ?? ubicacion.nroArchivador ?? null,
  ]
    .filter(Boolean)
    .join(" ");
  const resumen = [
    contenedor || null,
    ubicacion.color ? `(${ubicacion.color})` : null,
    ubicacion.ubicacion,
    ubicacion.codigoUbicacion,
    ubicacion.nroFolios ? `${ubicacion.nroFolios} folios` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { ubicacion, resumen: resumen || "Ubicación física no registrada" };
}

export async function searchExpedientes(
  input: ExpedienteSearchInput,
): Promise<ExpedienteSearchResult[]> {
  const namespace = getExpedientesNamespace();
  const filters: SearchFilters | undefined = input.anio ? { year: input.anio } : undefined;
  const topK = input.topK ?? 8;

  const hits = await searchTextRecords(input.query, topK, filters, namespace);
  if (hits.length === 0) {
    return [];
  }

  const chunkIds = Array.from(
    new Set(hits.map((hit) => asString((hit as Record<string, unknown>).chunk_id)).filter(Boolean)),
  ) as string[];
  const expedienteIds = Array.from(
    new Set(hits.map((hit) => asString((hit as Record<string, unknown>).document_id)).filter(Boolean)),
  ) as string[];

  const [chunkRows, expRows] = await Promise.all([
    chunkIds.length > 0
      ? supabaseRest<ChunkRow[]>(
          `expedientes_archivo_chunks?id=in.(${chunkIds.map((id) => `"${id}"`).join(",")})&select=id,content`,
        ).catch(() => [])
      : Promise.resolve([]),
    expedienteIds.length > 0
      ? supabaseRest<ExpRow[]>(
          `expedientes_archivo?id=in.(${expedienteIds.map((id) => `"${id}"`).join(",")})&select=${EXP_SELECT}`,
        ).catch(() => [])
      : Promise.resolve([]),
  ]);

  const contentById = new Map(chunkRows.map((row) => [row.id, row.content]));
  const expById = new Map(expRows.map((row) => [row.id, row]));

  const results: ExpedienteSearchResult[] = [];
  for (const hit of hits) {
    const record = hit as Record<string, unknown>;
    const expedienteId = asString(record.document_id);
    if (!expedienteId) {
      continue;
    }
    // Post-filtro por número de documento (no es filtro nativo de Pinecone).
    const hitNumber = asString(record.document_number);
    if (input.numeroDocumento && hitNumber && !hitNumber.includes(input.numeroDocumento)) {
      continue;
    }

    const exp = expById.get(expedienteId);
    const chunkId = asString(record.chunk_id);
    const content = chunkId ? contentById.get(chunkId) ?? "" : "";
    const pageStart = asNumber(record.page_start);
    const pageEnd = asNumber(record.page_end);
    const number = hitNumber ?? exp?.numero_documento ?? null;
    const { ubicacion, resumen } = buildUbicacion(exp);

    results.push({
      anio: exp?.anio ?? null,
      asunto: exp?.asunto ?? asString(record.topic),
      citation: `Expediente${number ? ` N° ${number}` : ""}${pageStart ? `, pág. ${pageStart}` : ""}`,
      destinatario: exp?.destinatario ?? null,
      excerpt: content.slice(0, 700),
      expedienteId,
      fecha: exp?.fecha ?? null,
      materia: exp?.materia ?? null,
      numeroDocumento: number,
      numeroExpediente: exp?.numero_expediente ?? null,
      pageEnd,
      pageStart,
      remitente: exp?.remitente ?? null,
      score: asNumber(record._score) ?? 0,
      storageBucket: exp?.storage_bucket ?? null,
      storagePath: exp?.storage_path ?? null,
      title: exp?.title ?? asString(record.title) ?? "Expediente",
      ubicacion,
      ubicacionResumen: resumen,
    });
  }

  return results;
}

export type ExpedienteAnswer = {
  answer: string;
  sufficient: boolean;
  sources: ExpedienteSearchResult[];
};

function buildContext(sources: ExpedienteSearchResult[]) {
  return sources
    .map((source, index) => {
      const head = [
        `[E${index + 1}] ${source.title}`,
        source.numeroDocumento ? `Nº ${source.numeroDocumento}` : null,
        source.fecha ? `Fecha: ${source.fecha}` : null,
        source.materia ? `Materia: ${source.materia}` : null,
        source.asunto ? `Asunto: ${source.asunto}` : null,
        `Ubicación física: ${source.ubicacionResumen}`,
        source.pageStart ? `Pág. ${source.pageStart}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `${head}\n${source.excerpt}`;
    })
    .join("\n\n---\n\n");
}

// Responde preguntas en lenguaje natural sobre la biblioteca de expedientes
// archivados. Si no hay fuentes, lo dice; no inventa. Cita con [E#] e indica la
// ubicación física cuando es relevante ("dónde está").
export async function answerExpedienteQuestion(
  input: ExpedienteChatInput,
): Promise<ExpedienteAnswer> {
  const sources = await searchExpedientes({ query: input.query, anio: input.anio, topK: 8 });

  if (sources.length === 0) {
    return {
      answer: "No encontré expedientes relacionados en la biblioteca de expedientes archivados.",
      sources: [],
      sufficient: false,
    };
  }

  const openai = getOpenAIClient();
  const context = buildContext(sources);

  const response = await openai.responses.create({
    input: [
      {
        content: `Eres un asistente de la biblioteca de EXPEDIENTES ARCHIVADOS de una entidad pública. Responde la consulta del usuario USANDO SOLO la información de los expedientes proporcionados.

Reglas:
- Usa únicamente lo que consta en los fragmentos. No inventes datos, fechas, números ni ubicaciones.
- Cita la fuente con [E#] al final de cada afirmación sustantiva.
- Cuando el usuario pregunte DÓNDE está un expediente, indica su ubicación física (caja/archivador, color, ambiente) tal como consta.
- Menciona número y fecha del expediente cuando sea relevante.
- Si la respuesta no está en los expedientes, dilo claramente.

Expedientes disponibles:
${context}

Consulta del usuario:
${input.query}`,
        role: "user",
      },
    ],
    max_output_tokens: 900,
    model: legalAnswerModel,
    temperature: 0.2,
  });

  return {
    answer:
      response.output_text.trim() || "No pude generar una respuesta a partir de los expedientes.",
    sources,
    sufficient: true,
  };
}
