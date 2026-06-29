/**
 * Acciones de negocio del módulo /expedientes-archivo
 *
 * Funciones puras que encapsulan las llamadas HTTP al backend y la lógica
 * de transformación. Separar estas funciones de la UI permite:
 *   - Reutilizarlas desde otros componentes
 *   - Testearlas sin renderizar React
 *   - Cambiar el backend sin tocar la UI
 */
import { z } from "zod";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "./upload-limits";
import type { ChatAnswer, DuplicateMatch, PdfInventory, SearchResult } from "@/app/components/expedientes-archivo/types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

// ── Esquemas de validación runtime ─────────────────────────────────────

const SearchQuerySchema = z.string().trim().min(2, "La búsqueda debe tener al menos 2 caracteres").max(500);
const AnioSchema = z.coerce.number().int().min(1900).max(2200).optional();
const ChatQuerySchema = z.string().trim().min(3, "La pregunta debe tener al menos 3 caracteres").max(800);

const ChatRequestSchema = z.object({ query: ChatQuerySchema });
const SearchRequestSchema = z.object({
  query: SearchQuerySchema,
  anio: AnioSchema,
  oficina: z.string().trim().max(200).optional(),
  materia: z.string().trim().max(200).optional(),
});
const BulkUpdateSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(["update", "markForDisposal"]),
  updates: z.record(z.string(), z.unknown()).optional(),
});

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const data = await response.json();
    return new Error(data?.error ?? fallback);
  } catch {
    return new Error(`${fallback} (HTTP ${response.status})`);
  }
}

/** Llama al endpoint /chat para hacer una pregunta con RAG */
export async function chatWithExpedientes(query: string): Promise<ChatAnswer> {
  const parsed = ChatRequestSchema.parse({ query });
  const res = await fetch("/api/expedientes-archivo/chat", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw await parseError(res, "No se pudo responder la consulta");
  return res.json();
}

/** Llama al endpoint /search para búsqueda por contenido (con filtros opcionales) */
export async function searchExpedientes(
  query: string,
  filters: { anio?: number; oficina?: string; materia?: string } = {},
): Promise<{ query: string; results: SearchResult[] }> {
  const parsed = SearchRequestSchema.parse({
    query,
    anio: filters.anio,
    oficina: filters.oficina || undefined,
    materia: filters.materia || undefined,
  });
  const res = await fetch("/api/expedientes-archivo/search", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw await parseError(res, "No se pudo ejecutar la búsqueda");
  return res.json();
}

/** Llama al endpoint /duplicates para detectar duplicados */
export async function detectDuplicates(params: {
  title?: string;
  sgd?: string;
  serie?: string;
  excludeId?: string;
}): Promise<{ duplicates: DuplicateMatch[]; matchType: "exact" | "fuzzy" | "none" }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  if ([...qs].length === 0) return { duplicates: [], matchType: "none" };
  const res = await fetch(`/api/expedientes-archivo/duplicates?${qs.toString()}`);
  if (!res.ok) throw await parseError(res, "No se pudo detectar duplicados");
  const data = await res.json();
  return {
    duplicates: data.duplicates ?? [],
    matchType: data.matchType ?? "none",
  };
}

/** Llama al endpoint /extract para extraer metadata de un PDF */
export async function autoFillFromPdf(
  file: File,
  title: string,
): Promise<PdfInventory> {
  if (!file) throw new Error("No se proporcionó archivo");
  if (file.type !== "application/pdf") throw new Error("Solo se permiten archivos PDF");
  if (file.size > maxPdfSizeBytes) {
    throw new Error(`El PDF supera el límite de ${maxPdfSizeLabel}`);
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  const res = await fetch("/api/expedientes-archivo/extract", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    if (res.status === 422) {
      throw await parseError(res, "El PDF no se pudo procesar con OCR");
    }
    throw await parseError(res, "No se pudo analizar el PDF");
  }
  const payload = await res.json();
  return payload.inventory ?? payload;
}

/** Ubicación física sugerida por el backend (basada en lo ya archivado) */
export type UbicacionSugerida = {
  tipo_almacenamiento: string | null;
  nro_archivador: string | null;
  nro_paquete: string | null;
  empastado: boolean | null;
  color_archivador: string | null;
  nro_estante: string | null;
  nro_piso: string | null;
  nro_local: string | null;
};

export type UbicacionSugeridaResponse = {
  ultima: UbicacionSugerida | null;
  siguientePaquete: string | null;
  basadoEn: { serie: string | null; anio: string | null } | null;
};

/** Pide una sugerencia de ubicación física para un nuevo expediente */
export async function fetchUbicacionSugerida(params: {
  serie?: string;
  anio?: string | number;
}): Promise<UbicacionSugeridaResponse> {
  const qs = new URLSearchParams();
  if (params.serie) qs.set("serie", params.serie);
  if (params.anio) qs.set("anio", String(params.anio));
  try {
    const res = await fetch(`/api/expedientes-archivo/ubicacion-sugerida?${qs.toString()}`);
    if (!res.ok) return { ultima: null, siguientePaquete: null, basadoEn: null };
    return res.json();
  } catch {
    return { ultima: null, siguientePaquete: null, basadoEn: null };
  }
}

/** Sube un nuevo expediente */
export async function uploadExpediente(formData: FormData, onProgress?: (loaded: number, total: number) => void): Promise<{ expediente: unknown; processing: boolean }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      });
    }
    xhr.addEventListener("load", () => {
      try {
        const body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body);
        } else {
          reject(new Error(body?.error ?? `HTTP ${xhr.status}`));
        }
      } catch (e) {
        reject(new Error(`No se pudo subir el expediente: ${e instanceof Error ? e.message : "error"}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Error de red al subir el PDF")));
    xhr.addEventListener("abort", () => reject(new Error("Subida cancelada")));
    xhr.open("POST", "/api/expedientes-archivo");
    xhr.send(formData);
  });
}

/** Edita la metadata de un expediente (PATCH). El backend aplica una whitelist
 *  de columnas; los campos no permitidos se ignoran silenciosamente. */
export async function updateExpediente(
  id: string,
  updates: Record<string, unknown>,
): Promise<{ updated: string[] }> {
  const res = await fetch(`/api/expedientes-archivo/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw await parseError(res, "No se pudo actualizar el expediente");
  return res.json();
}

/** Reindexa un expediente existente */
export async function reindexExpediente(id: string): Promise<void> {
  const res = await fetch(`/api/expedientes-archivo/${id}`, { method: "POST" });
  if (!res.ok) throw await parseError(res, "No se pudo reindexar");
}

/** Elimina un expediente */
export async function deleteExpediente(id: string): Promise<void> {
  const res = await fetch(`/api/expedientes-archivo/${id}`, { method: "DELETE" });
  if (!res.ok) throw await parseError(res, "No se pudo eliminar");
}

/** Reemplaza el PDF de un expediente */
export async function replaceExpedienteFile(id: string, file: File): Promise<void> {
  if (!file) throw new Error("No se proporcionó archivo");
  if (file.type !== "application/pdf") throw new Error("Solo se permiten archivos PDF");
  if (file.size > maxPdfSizeBytes) {
    throw new Error(`El PDF supera el límite de ${maxPdfSizeLabel}`);
  }
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`/api/expedientes-archivo/${id}`, { method: "PUT", body: formData });
  if (!res.ok) throw await parseError(res, "No se pudo reemplazar el PDF");
}

/** Aplica una actualización masiva a N expedientes */
export async function bulkUpdateExpedientes(
  ids: string[],
  updates: Record<string, unknown>,
): Promise<{ updated: number; fields: string[] }> {
  if (ids.length === 0) return { updated: 0, fields: [] };
  const parsed = BulkUpdateSchema.parse({ ids, action: "update", updates });
  const res = await fetch("/api/expedientes-archivo/bulk", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw await parseError(res, "No se pudo aplicar la operación masiva");
  return res.json();
}

/** Marca expedientes para baja */
export async function bulkMarkForDisposal(ids: string[]): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 };
  const parsed = BulkUpdateSchema.parse({ ids, action: "markForDisposal" });
  const res = await fetch("/api/expedientes-archivo/bulk", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw await parseError(res, "No se pudo marcar para baja");
  return res.json();
}

// ── Respuesta de mesa de partes (oficio/carta fundamentado) ────────────

export type RespuestaSource = {
  citation: string;
  title: string;
  number: string | null;
  excerpt: string;
};

export type RespuestaTokenUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

export type RespuestaAntecedente = {
  expedienteId: string;
  title: string;
  serie: string | null;
  anio: number | null;
  ubicacion: string;
  excerpt: string;
};

export type RespuestaResult = {
  respuesta: string;
  sources: RespuestaSource[];
  antecedentes?: RespuestaAntecedente[];
  assessment?: { sufficient?: boolean; reason?: string } | null;
  tokenUsage?: RespuestaTokenUsage;
};

export const DOC_TIPOS = ["OFICIO", "INFORME", "CARTA", "MEMORANDUM"] as const;
export type DocTipo = (typeof DOC_TIPOS)[number];

const RespuestaGenerateSchema = z.object({
  intencion: z.string().trim().min(10, "Escribe qué quieres responder (mín. 10 caracteres)").max(8000),
  tipoDocumento: z.enum(DOC_TIPOS).default("OFICIO"),
  documentoTexto: z.string().trim().max(20000).optional(),
  remitente: z.string().trim().max(200).optional(),
  asunto: z.string().trim().max(300).optional(),
  tone: z.enum(["cercano", "formal", "tecnico"]).default("formal"),
  length: z.enum(["concisa", "media", "detallada"]).default("media"),
  selectedSources: z.array(z.string()).max(20).optional(),
  includeAntecedentes: z.boolean().optional(),
});

export type RespuestaGenerateInput = z.input<typeof RespuestaGenerateSchema>;

/** Genera el borrador de respuesta oficial fundamentado en el corpus normativo */
export async function generateRespuesta(input: RespuestaGenerateInput): Promise<RespuestaResult> {
  const parsed = RespuestaGenerateSchema.parse(input);
  const res = await fetch("/api/expedientes-archivo/respuesta/generate", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw await parseError(res, "No se pudo generar la respuesta");
  return res.json();
}

export type RespuestaExportInput = {
  format?: "docx" | "pdf";
  oficinaId?: string;
  entity: { name: string; ruc?: string; address?: string; executingUnit?: string };
  nroOficio?: string;
  destinatario?: string;
  cargoDestinatario?: string;
  asunto: string;
  cuerpo: string;
  baseLegal?: { referencia: string; texto: string }[];
  remitente?: string;
  cargoRemitente?: string;
};

/** Exporta la respuesta a .docx (membrete texto) o .pdf (sobre la hoja membretada) */
export async function exportRespuestaDocx(input: RespuestaExportInput): Promise<void> {
  const format = input.format ?? "docx";
  if (!input.asunto) throw new Error("Indica el asunto");
  if (!input.cuerpo) throw new Error("Genera o escribe el cuerpo de la respuesta");
  if (format === "docx" && !input.entity?.name) throw new Error("Para .docx indica el nombre de la entidad");
  const res = await fetch("/api/expedientes-archivo/respuesta/export", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ ...input, format }),
  });
  if (!res.ok) throw await parseError(res, "No se pudo exportar el documento");
  const blob = await res.blob();
  const slug = input.asunto
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "respuesta";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `respuesta-${slug}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Oficinas emisoras (configuradas por el admin) ──────────────────────
export type OficinaOption = {
  id: string;
  nombre: string;
  entidad: string | null;
  ruc: string | null;
  responsableNombre: string | null;
  responsableCargo: string | null;
  tieneMembrete: boolean;
  previews: Record<DocTipo, string>;
};

/** Lista las oficinas activas (para elegir desde cuál se emite la respuesta) */
export async function listOficinas(): Promise<OficinaOption[]> {
  const res = await fetch("/api/expedientes-archivo/respuesta/oficinas", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.oficinas ?? [];
}

// ── Subir PDF recibido (OCR) ───────────────────────────────────────────
export type LeerPdfResult = {
  texto: string;
  asunto: string | null;
  remitente: string | null;
  tokenUsage?: RespuestaTokenUsage;
};

/** Sube el PDF de un documento recibido y devuelve su texto (OCR) + asunto/remitente */
export async function leerDocumentoPdf(file: File): Promise<LeerPdfResult> {
  if (!file) throw new Error("No se proporcionó archivo");
  if (file.type !== "application/pdf") throw new Error("Solo se permiten archivos PDF");
  if (file.size > maxPdfSizeBytes) throw new Error(`El PDF supera el límite de ${maxPdfSizeLabel}`);
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/expedientes-archivo/respuesta/leer", { method: "POST", body: formData });
  if (!res.ok) throw await parseError(res, "No se pudo leer el PDF");
  return res.json();
}

// ── Guardar / listar respuestas ────────────────────────────────────────
export type SaveRespuestaInput = {
  nroOficio?: string;
  tipoDocumento?: DocTipo;
  oficinaId?: string;
  assignNumber?: boolean;
  anio?: number;
  asunto?: string;
  destinatario?: string;
  cargoDestinatario?: string;
  remitente?: string;
  documentoTexto?: string;
  cuerpo: string;
  baseLegal?: { referencia: string; texto: string }[];
  antecedentes?: RespuestaAntecedente[];
  entity?: Record<string, unknown>;
  expedienteId?: string | null;
  tone?: string;
  length?: string;
  tokenUsage?: RespuestaTokenUsage;
};

/** Guarda/archiva una respuesta generada. Si assignNumber, asigna el correlativo del tipo. */
export async function saveRespuesta(input: SaveRespuestaInput): Promise<{ id: string | null; nroOficio?: string }> {
  if (!input.cuerpo?.trim()) throw new Error("No hay cuerpo de respuesta para guardar");
  const res = await fetch("/api/expedientes-archivo/respuesta", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res, "No se pudo guardar la respuesta");
  return res.json();
}

export type SavedRespuesta = {
  id: string;
  nro_oficio: string | null;
  tipo_documento: string | null;
  anio: number | null;
  asunto: string | null;
  destinatario: string | null;
  remitente: string | null;
  cuerpo: string;
  base_legal: { referencia: string; texto: string }[];
  antecedentes: RespuestaAntecedente[];
  entity: Record<string, unknown>;
  tone: string | null;
  length: string | null;
  token_usage: RespuestaTokenUsage | null;
  created_at: string;
};

/** Lista las respuestas guardadas más recientes */
export async function listRespuestas(limit = 20): Promise<SavedRespuesta[]> {
  const res = await fetch(`/api/expedientes-archivo/respuesta?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.respuestas ?? [];
}

/** Carga la lista de expedientes con paginación opcional */
export type ExpedienteCounts = {
  total: number;
  indexed: number;
  pending: number;
  error: number;
  totalBytes: number;
};

export async function loadExpedientes(
  options: { page?: number; limit?: number; status?: string; anio?: number } = {},
): Promise<{
  expedientes: unknown[];
  counts: ExpedienteCounts | null;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.status) params.set("status", options.status);
  if (options.anio) params.set("anio", String(options.anio));
  const qs = params.toString();
  const url = `/api/expedientes-archivo${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw await parseError(res, "No se pudo listar los expedientes");
  const data = await res.json();
  return {
    expedientes: data.expedientes ?? [],
    counts: data.counts ?? null,
    pagination: data.pagination ?? {
      page: 1,
      limit: data.expedientes?.length ?? 0,
      total: data.expedientes?.length ?? 0,
      totalPages: 1,
    },
  };
}

/** Trae la metadata (JSON) de un expediente por id. Para abrir el detalle de un
 *  resultado de búsqueda que no esté en la página cargada de la lista. */
export async function fetchExpedienteById(id: string): Promise<unknown | null> {
  const res = await fetch(`/api/expedientes-archivo/${id}?meta=1`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.expediente ?? null;
}
