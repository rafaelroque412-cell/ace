import { z } from "zod";

// Biblioteca de Expedientes Archivados: expedientes/documentos terminados de la
// entidad, escaneados (OCR) e indexados en su PROPIO namespace de Pinecone
// (PINECONE_EXPEDIENTES_NAMESPACE), aislado del corpus normativo (Ley 32069) y del
// archivo administrativo. Además del contenido, registra la UBICACIÓN FÍSICA exacta
// del expediente en papel (caja, archivador, color, ambiente). INDEPENDIENTE del
// "expediente de contratación" (módulo contrataciones): otra tratativa y funcionalidad.

// ── Catálogo fijo de ubicación física ──────────────────────────────────────
// Listas predefinidas (selects, no texto libre). Valores por defecto; reemplazar
// por el catálogo real de la municipalidad cuando se entreguen (ver
// docs/MODULO-EXPEDIENTES.md, decisiones tomadas).

export const CONTENEDOR_TIPOS = [
  "folder",
  "archivador",
  "caja",
  "tomo",
  "paquete",
  "estante",
  "otros",
] as const;

export type ContenedorTipo = (typeof CONTENEDOR_TIPOS)[number];

export const CONTENEDOR_TIPO_LABELS: Record<ContenedorTipo, string> = {
  folder: "Folder",
  archivador: "Archivador",
  caja: "Caja",
  tomo: "Tomo",
  paquete: "Paquete",
  estante: "Estante",
  otros: "Otros",
};

// Colores del archivo físico (catálogo fijo). Reemplazar por la paleta real.
export const ARCHIVO_COLORES = [
  "rojo",
  "azul",
  "verde",
  "amarillo",
  "naranja",
  "celeste",
  "negro",
  "blanco",
  "plomo",
  "otros",
] as const;

export type ArchivoColor = (typeof ARCHIVO_COLORES)[number];

// Ambientes/ubicaciones físicas (catálogo fijo). PLACEHOLDER: reemplazar por los
// ambientes reales del archivo de la municipalidad cuando se entreguen.
export const ARCHIVO_AMBIENTES = [
  "Archivo Central",
  "Archivo de Gestión",
  "Archivo Periférico",
  "Depósito",
] as const;

export type ArchivoAmbiente = (typeof ARCHIVO_AMBIENTES)[number];

export function contenedorTipoLabel(value?: string | null) {
  if (value && (CONTENEDOR_TIPOS as readonly string[]).includes(value)) {
    return CONTENEDOR_TIPO_LABELS[value as ContenedorTipo];
  }
  return "Otros";
}

export function normalizeContenedorTipo(value: unknown): ContenedorTipo {
  return typeof value === "string" && (CONTENEDOR_TIPOS as readonly string[]).includes(value)
    ? (value as ContenedorTipo)
    : "otros";
}

// Devuelve el valor solo si pertenece al catálogo fijo; si no, null (no texto libre).
export function normalizeCatalogValue(value: unknown, catalog: readonly string[]): string | null {
  return typeof value === "string" && catalog.includes(value) ? value : null;
}

// ── Tipos ───────────────────────────────────────────────────────────────────

export type ExpedienteStatus = "uploaded" | "processing" | "indexed" | "error";

export type PersonaTipo = "natural" | "juridica";

// Esquema canónico (single source of truth). Debe coincidir 1:1 con
// app/components/expedientes-archivo/types.ts -> ExpedienteItem.
export type ExpedienteArchivo = {
  id: string;
  // Identificación documental
  sgd_expediente: string | null;
  serie_documento: string | null;
  anio: number | null;
  tipo_documento: string | null;
  asunto: string | null;
  materia: string | null;
  resumen: string | null;
  title: string;
  oficina: string | null;
  // Almacenamiento físico
  tipo_almacenamiento: ContenedorTipo | null;
  nro_archivador: string | null;
  nro_paquete: string | null;
  empastado: boolean | null;
  color_archivador: string | null;
  // Ubicación física exacta
  nro_estante: string | null;
  nro_piso: string | null;
  nro_local: string | null;
  folio: string | null;
  observaciones: string | null;
  // Persona interesada
  persona_tipo: PersonaTipo | null;
  persona_documento: string | null;
  persona_nombre: string | null;
  // Archivo digital
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
  status: ExpedienteStatus;
  error_message: string | null;
  body_text?: string | null;
  metadata: Record<string, unknown>;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export function normalizePersonaTipo(value: unknown): PersonaTipo | null {
  return value === "natural" || value === "juridica" ? value : null;
}

// ── Esquemas de consulta ──────────────────────────────────────────────────────

export const expedienteSearchSchema = z.object({
  query: z.string().trim().min(2, "Escribe al menos 2 caracteres").max(500),
  serieDocumento: z.string().trim().optional(),
  anio: z.coerce.number().int().min(1900).max(2200).optional(),
  topK: z.number().int().min(1).max(20).optional(),
});

export type ExpedienteSearchInput = z.infer<typeof expedienteSearchSchema>;

export const expedienteChatSchema = z.object({
  query: z.string().trim().min(3, "Escribe una pregunta").max(800),
  anio: z.coerce.number().int().min(1900).max(2200).optional(),
});

export type ExpedienteChatInput = z.infer<typeof expedienteChatSchema>;

// ── Extractores deterministas ─────────────────────────────────────────────────

const monthIndex: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function normalizeForMatch(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Detecta la fecha de emisión: "15 de enero de 2024" (con/sin tildes) o dd/mm/yyyy.
// Devuelve ISO (YYYY-MM-DD) o null.
export function extractFecha(text: string): string | null {
  const source = normalizeForMatch(text.slice(0, 6000));

  const textual = source.match(/\b(\d{1,2})\s+de\s+([a-z]+)\s+(?:de\s+|del\s+)?(\d{4})\b/);
  if (textual) {
    const day = Number.parseInt(textual[1], 10);
    const month = monthIndex[textual[2]];
    const year = Number.parseInt(textual[3], 10);
    if (month && day >= 1 && day <= 31 && year >= 1990 && year <= 2100) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const numeric = source.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  if (numeric) {
    const day = Number.parseInt(numeric[1], 10);
    const month = Number.parseInt(numeric[2], 10);
    const year = Number.parseInt(numeric[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

// Detecta el número de expediente o de documento. Ancla a la palabra clave
// ("expediente", "exp", "oficio", "informe"...) para no capturar un número
// referenciado en el cuerpo. El título (nombre de archivo) va al inicio del
// source, así que su número gana.
const expedienteKeyword =
  "expediente|exp|tr[aá]mite|resoluci[oó]n|acuerdo|ordenanza|decreto|oficio|informe|memorando|carta";
const numeroToken = "[0-9]{1,6}(?:\\s*-\\s*[0-9]{2,4})?(?:\\s*-\\s*[A-Za-z0-9./]+)*";

export function extractExpedienteNumber(title: string, text: string): string | null {
  const source = `${title}\n${text.slice(0, 4000)}`;

  const anchored = source.match(
    new RegExp(`\\b(?:${expedienteKeyword})[^\\n]{0,40}?n[°ºo.\\s]*\\s*(${numeroToken})`, "i"),
  );
  if (anchored?.[1]) {
    return anchored[1].replace(/\s+/g, "").replace(/[.,;:]+$/, "");
  }

  const generic = source.match(new RegExp(`\\bn[°ºo.\\s]*\\s*(${numeroToken})`, "i"));
  return generic?.[1] ? generic[1].replace(/\s+/g, "").replace(/[.,;:]+$/, "") : null;
}

export function getExpedientesNamespace() {
  return process.env.PINECONE_EXPEDIENTES_NAMESPACE ?? "expedientes-archivo";
}
