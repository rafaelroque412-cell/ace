// Deteccion (heuristica por regex) de referencias cruzadas en el texto de una
// norma, para construir el citador/concordancias tipo vLex. La resolucion contra
// el corpus indexado se hace en el pipeline (lib/pdf-processing.ts).

export type RefType = "ley" | "reglamento" | "directiva" | "opinion" | "decreto" | "interno";

export type DetectedCitation = {
  refType: RefType;
  refDocumentNumber: string | null;
  refArticleNumber: string | null;
  rawText: string;
};

// "articulo 144 del Reglamento" / "articulo 5 de la Ley 32069"
const articleOfNormPattern =
  /art[ií]culos?\s+(\d+[a-z-]*)\s*[ºo°]?\s+(?:de la|del|de el)\s+(ley|reglamento|directiva|decreto supremo|opini[oó]n)(?:\s*n?[°ºo.]*\s*([\d][\w./-]*))?/gi;

// "Ley 30225" / "Ley N° 32069" / "Decreto Supremo 009-2025-EF" / "Directiva 001-2024"
// (el "N°" es opcional para capturar referencias externas sin esa marca).
const standaloneNormPattern =
  /\b(ley|decreto supremo|directiva|opini[oó]n)\s+(?:n[°ºo.]*\s*)?(\d[\w./-]*)/gi;

// "articulo 12" (referencia a otro articulo, p. ej. del mismo documento)
const articleMentionPattern = /\bart[ií]culos?\s+(\d+[a-z-]*)/gi;

function keywordToRefType(keyword: string): RefType {
  const value = keyword.toLowerCase();
  if (value.startsWith("decreto")) return "decreto";
  if (value.startsWith("opini")) return "opinion";
  if (value.startsWith("reglamento")) return "reglamento";
  if (value.startsWith("directiva")) return "directiva";
  return "ley";
}

function cleanNumber(raw?: string | null) {
  if (!raw) return null;
  const trimmed = raw.replace(/[.,;:]+$/, "").trim();
  return trimmed || null;
}

export function detectCitations(text: string): DetectedCitation[] {
  const citations: DetectedCitation[] = [];
  let match: RegExpExecArray | null;

  articleOfNormPattern.lastIndex = 0;
  while ((match = articleOfNormPattern.exec(text)) !== null) {
    citations.push({
      refType: keywordToRefType(match[2]),
      refDocumentNumber: cleanNumber(match[3]),
      refArticleNumber: match[1],
      rawText: match[0].replace(/\s+/g, " ").trim().slice(0, 200),
    });
  }

  // Enmascara las referencias "articulo N de la <norma>" ya capturadas para que
  // el patron de norma suelta no las vuelva a contar (evita duplicados).
  const masked = text.replace(articleOfNormPattern, (full) => " ".repeat(full.length));

  standaloneNormPattern.lastIndex = 0;
  while ((match = standaloneNormPattern.exec(masked)) !== null) {
    citations.push({
      refType: keywordToRefType(match[1]),
      refDocumentNumber: cleanNumber(match[2]),
      refArticleNumber: null,
      rawText: match[0].replace(/\s+/g, " ").trim().slice(0, 200),
    });
  }

  return citations;
}

// Numeros de articulo mencionados en el texto (para enlaces internos).
export function extractArticleMentions(text: string): string[] {
  const numbers = new Set<string>();
  let match: RegExpExecArray | null;

  articleMentionPattern.lastIndex = 0;
  while ((match = articleMentionPattern.exec(text)) !== null) {
    numbers.add(match[1]);
  }

  return Array.from(numbers);
}

// Normaliza un numero de norma para comparar ("N° 32069" -> "32069").
export function normalizeNormNumber(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/n[°ºo.]+/g, "")
    .replace(/[^\w-]/g, "")
    .trim();
}
