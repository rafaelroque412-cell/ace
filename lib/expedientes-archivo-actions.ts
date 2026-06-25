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
import type { AiSearchResponse, ChatAnswer, DuplicateMatch, PdfInventory, SearchResult } from "@/app/components/expedientes-archivo/types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

// ── Esquemas de validación runtime ─────────────────────────────────────

const SearchQuerySchema = z.string().trim().min(2, "La búsqueda debe tener al menos 2 caracteres").max(500);
const AnioSchema = z.coerce.number().int().min(1900).max(2200).optional();
const ChatQuerySchema = z.string().trim().min(3, "La pregunta debe tener al menos 3 caracteres").max(800);
const AiQuerySchema = z.string().trim().min(3).max(500);
const LimitSchema = z.number().int().min(1).max(50).default(20);

const ChatRequestSchema = z.object({ query: ChatQuerySchema });
const SearchRequestSchema = z.object({ query: SearchQuerySchema, anio: AnioSchema });
const AiSearchRequestSchema = z.object({ query: AiQuerySchema, limit: LimitSchema });
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

/** Llama al endpoint /search para búsqueda por keyword */
export async function searchExpedientes(
  query: string,
  anio?: number,
): Promise<{ query: string; results: SearchResult[] }> {
  const parsed = SearchRequestSchema.parse({ query, anio });
  const res = await fetch("/api/expedientes-archivo/search", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw await parseError(res, "No se pudo ejecutar la búsqueda");
  return res.json();
}

/** Llama al endpoint /ai-search para búsqueda por lenguaje natural en el archivo */
export async function aiSearchExpedientes(query: string, limit = 20): Promise<AiSearchResponse> {
  const parsed = AiSearchRequestSchema.parse({ query, limit });
  const res = await fetch("/api/expedientes-archivo/ai-search", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw await parseError(res, "No se pudo buscar con IA");
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
export async function autoFillFromPdf(file: File, title: string): Promise<PdfInventory> {
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
    // 422 = error operacional (PDF no procesable), el resto son errores del servidor
    if (res.status === 422) {
      throw await parseError(res, "El PDF no se pudo procesar con OCR");
    }
    throw await parseError(res, "No se pudo analizar el PDF");
  }
  const payload = await res.json();
  return payload.inventory ?? payload;
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

/** Carga la lista de expedientes */
export async function loadExpedientes(): Promise<unknown[]> {
  const res = await fetch("/api/expedientes-archivo", { cache: "no-store" });
  if (!res.ok) throw await parseError(res, "No se pudo listar los expedientes");
  const data = await res.json();
  return data.expedientes ?? [];
}
