const allowedDocumentTypes = [
  "ley",
  "reglamento",
  "opinion",
  "directiva",
  "bases_integradas",
  "resolucion",
  "contrato",
  "expediente",
  "otros",
] as const;

export type DocumentType = (typeof allowedDocumentTypes)[number];

const allowedProcessTypes = [
  "todos",
  "licitacion_publica",
  "concurso_publico",
  "adjudicacion_simplificada",
  "subasta_inversa_electronica",
  "comparacion_precios",
  "contratacion_directa",
  "acuerdo_marco",
  "seleccion_consultores_individuales",
  "procedimiento_especial",
  "otros",
] as const;

export type ProcessType = (typeof allowedProcessTypes)[number];

export function normalizeDocumentType(value: FormDataEntryValue | null): DocumentType {
  if (typeof value !== "string") {
    return "otros";
  }

  return allowedDocumentTypes.includes(value as DocumentType) ? (value as DocumentType) : "otros";
}

export function normalizeProcessType(value: FormDataEntryValue | null): ProcessType | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return allowedProcessTypes.includes(value as ProcessType) ? (value as ProcessType) : "otros";
}

export function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "documento.pdf";
}

export function buildStoragePath(fileName: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}
