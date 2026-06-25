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
  tipoAlmacenamiento: string;
  tipoAlmacenamientoLabel: string;
  nroArchivador: string | null;
  nroPaquete: string | null;
  empastado: boolean | null;
  color: string | null;
  nroEstante: string | null;
  nroPiso: string | null;
  nroLocal: string | null;
  folio: string | null;
};

export type ExpedienteSearchResult = {
  expedienteId: string;
  sgdExpediente: string | null;
  serieDocumento: string | null;
  tipoDocumento: string | null;
  title: string;
  asunto: string | null;
  materia: string | null;
  oficina: string | null;
  anio: number | null;
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
  anio: number | null;
  sgd_expediente: string | null;
  serie_documento: string | null;
  tipo_documento: string | null;
  oficina: string | null;
  tipo_almacenamiento: string | null;
  nro_archivador: string | null;
  nro_paquete: string | null;
  empastado: boolean | null;
  color_archivador: string | null;
  nro_estante: string | null;
  nro_piso: string | null;
  nro_local: string | null;
  folio: string | null;
  storage_path: string | null;
  storage_bucket: string | null;
};

const EXP_SELECT =
  "id,title,asunto,materia,anio,sgd_expediente,serie_documento,tipo_documento,oficina,tipo_almacenamiento,nro_archivador,nro_paquete,empastado,color_archivador,nro_estante,nro_piso,nro_local,folio,storage_path,storage_bucket";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Arma el resumen legible de la ubicación física:
// "Archivador 12 (rojo) · Estante 3 · Piso 2 · Local A · folio 120".
function buildUbicacion(exp?: ExpRow): { ubicacion: ExpedienteUbicacion; resumen: string } {
  const tipo = exp?.tipo_almacenamiento ?? "otros";
  const ubicacion: ExpedienteUbicacion = {
    tipoAlmacenamiento: tipo,
    tipoAlmacenamientoLabel: contenedorTipoLabel(tipo),
    nroArchivador: exp?.nro_archivador ?? null,
    nroPaquete: exp?.nro_paquete ?? null,
    empastado: exp?.empastado ?? null,
    color: exp?.color_archivador ?? null,
    nroEstante: exp?.nro_estante ?? null,
    nroPiso: exp?.nro_piso ?? null,
    nroLocal: exp?.nro_local ?? null,
    folio: exp?.folio ?? null,
  };

  const contenedor = [
    contenedorTipoLabel(tipo),
    ubicacion.nroArchivador ?? ubicacion.nroPaquete ?? null,
  ]
    .filter(Boolean)
    .join(" ");
  const resumen = [
    contenedor || null,
    ubicacion.color ? `(${ubicacion.color})` : null,
    ubicacion.nroEstante ? `Estante ${ubicacion.nroEstante}` : null,
    ubicacion.nroPiso ? `Piso ${ubicacion.nroPiso}` : null,
    ubicacion.nroLocal ? `Local ${ubicacion.nroLocal}` : null,
    ubicacion.folio ? `folio ${ubicacion.folio}` : null,
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
    // Post-filtro por serie documental (no es filtro nativo de Pinecone).
    const hitNumber = asString(record.document_number);
    if (input.serieDocumento && hitNumber && !hitNumber.includes(input.serieDocumento)) {
      continue;
    }

    const exp = expById.get(expedienteId);
    const chunkId = asString(record.chunk_id);
    const content = chunkId ? contentById.get(chunkId) ?? "" : "";
    const pageStart = asNumber(record.page_start);
    const pageEnd = asNumber(record.page_end);
    const serie = hitNumber ?? exp?.serie_documento ?? null;
    const { ubicacion, resumen } = buildUbicacion(exp);

    results.push({
      anio: exp?.anio ?? null,
      asunto: exp?.asunto ?? asString(record.topic),
      citation: `Expediente${serie ? ` N° ${serie}` : ""}${pageStart ? `, pág. ${pageStart}` : ""}`,
      excerpt: content.slice(0, 700),
      expedienteId,
      materia: exp?.materia ?? null,
      oficina: exp?.oficina ?? null,
      pageEnd,
      pageStart,
      score: asNumber(record._score) ?? 0,
      serieDocumento: serie,
      sgdExpediente: exp?.sgd_expediente ?? null,
      storageBucket: exp?.storage_bucket ?? null,
      storagePath: exp?.storage_path ?? null,
      tipoDocumento: exp?.tipo_documento ?? null,
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
        source.serieDocumento ? `Serie ${source.serieDocumento}` : null,
        source.anio ? `Año: ${source.anio}` : null,
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
