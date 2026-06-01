const allowedDocumentTypes = [
  "ley",
  "reglamento",
  "opinion",
  "directiva",
  "resolucion",
  "contrato",
  "expediente",
  "otros",
] as const;

export type DocumentType = (typeof allowedDocumentTypes)[number];

export function normalizeDocumentType(value: FormDataEntryValue | null): DocumentType {
  if (typeof value !== "string") {
    return "otros";
  }

  return allowedDocumentTypes.includes(value as DocumentType) ? (value as DocumentType) : "otros";
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
