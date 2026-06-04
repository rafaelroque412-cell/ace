import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { type LegalSource, searchLegalSources } from "./legal-chat";

export type ClauseCheck = {
  key: string;
  label: string;
  presente: boolean;
  nota: string;
};

export type LegalAnalysis = {
  resumen: string;
  confidence: "alta" | "media" | "baja";
  clausulas: ClauseCheck[];
  riesgos: string[];
  recomendaciones: string[];
  normasAplicables: Array<{ documentTitle: string; documentType: string; citation: string }>;
  sources: LegalSource[];
  model: string;
};

// Clausulas obligatorias del articulo 60 de la Ley 32069.
const mandatoryClauses: Array<{ key: string; label: string; patterns: string[] }> = [
  { key: "garantias", label: "Garantías", patterns: ["garantia", "carta fianza", "fiel cumplimiento", "retencion", "fideicomiso"] },
  {
    key: "anticorrupcion",
    label: "Cláusula anticorrupción y antisoborno",
    patterns: ["anticorrupcion", "antisoborno", "soborno", "corrupcion"],
  },
  {
    key: "controversias",
    label: "Solución de controversias",
    patterns: ["solucion de controversias", "arbitraje", "conciliacion", "junta de resolucion", "controversia"],
  },
  {
    key: "resolucion",
    label: "Resolución de contrato por incumplimiento",
    patterns: ["resolucion del contrato", "resolucion por incumplimiento", "incumplimiento"],
  },
  {
    key: "riesgos",
    label: "Gestión de riesgos",
    patterns: ["gestion de riesgos", "asignacion de riesgos", "matriz de riesgos", "gestion del riesgo"],
  },
];

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function parseJsonObject(text: string) {
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

function buildSourceContext(sources: LegalSource[]) {
  return sources
    .map(
      (source, index) =>
        `[F${index + 1}] ${source.documentTitle} (${source.documentType}) - ${source.citation}\n${source.excerpt.slice(0, 700)}`,
    )
    .join("\n\n");
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function analyzeLegalDocument(input: {
  text: string;
  title?: string;
  documentType?: string;
}): Promise<LegalAnalysis> {
  const normalizedText = normalize(input.text);

  // Presencia de clausulas obligatorias (deterministica).
  const clausulas: ClauseCheck[] = mandatoryClauses.map((clause) => ({
    key: clause.key,
    label: clause.label,
    presente: clause.patterns.some((pattern) => normalizedText.includes(normalize(pattern))),
    nota: "",
  }));

  // Normas aplicables del corpus.
  const query = [input.title, input.text.slice(0, 1800)].filter(Boolean).join(". ");
  const { sources } = await searchLegalSources({ query, topK: 8 });

  const normasAplicables = sources.slice(0, 6).map((source) => ({
    documentTitle: source.documentTitle,
    documentType: source.documentType,
    citation: source.citation,
  }));

  const clauseList = clausulas
    .map((clause) => `${clause.label}: ${clause.presente ? "detectada" : "NO detectada"}`)
    .join("\n");

  let resumen = "";
  let riesgos: string[] = [];
  let recomendaciones: string[] = [];
  let confidence: LegalAnalysis["confidence"] = "baja";
  let model = legalAnswerModel;

  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [
        {
          content:
            "Eres un asistente juridico de contrataciones publicas peruanas. Analizas un documento (bases, contrato o expediente) frente a la normativa proporcionada. Fundamenta con las fuentes [F#]. No inventes normas. Marca todo como apoyo, no asesoria vinculante. Devuelve solo JSON valido.",
          role: "system",
        },
        {
          content: `Documento a analizar (titulo: ${input.title ?? "sin titulo"}; tipo: ${input.documentType ?? "desconocido"}):
${input.text.slice(0, 12000)}

Clausulas obligatorias del articulo 60 detectadas por busqueda de texto:
${clauseList}

Normas recuperadas del corpus:
${buildSourceContext(sources)}

Devuelve JSON con esta forma exacta:
{
  "resumen": "3-6 lineas sobre que es el documento y su estado frente a la normativa, con marcadores [F#]",
  "confidence": "alta|media|baja",
  "clauseNotes": { "garantias": "nota breve", "anticorrupcion": "...", "controversias": "...", "resolucion": "...", "riesgos": "..." },
  "riesgos": ["riesgo con [F#] si aplica"],
  "recomendaciones": ["recomendacion accionable con [F#] si aplica"]
}
Para clauseNotes, si una clausula NO fue detectada, explica que falta incluirla segun el articulo 60 [F#].`,
          role: "user",
        },
      ],
      max_output_tokens: 1400,
      model: legalAnswerModel,
      temperature: 0.2,
    });

    const parsed = parseJsonObject(response.output_text);
    resumen = typeof parsed.resumen === "string" ? parsed.resumen : "";
    riesgos = stringArray(parsed.riesgos);
    recomendaciones = stringArray(parsed.recomendaciones);
    confidence =
      parsed.confidence === "alta" || parsed.confidence === "media" || parsed.confidence === "baja"
        ? parsed.confidence
        : "baja";

    const clauseNotes = (parsed.clauseNotes ?? {}) as Record<string, unknown>;
    for (const clause of clausulas) {
      const note = clauseNotes[clause.key];
      clause.nota =
        typeof note === "string" && note.trim()
          ? note.trim()
          : clause.presente
            ? "Detectada en el documento."
            : "No se detecto; el articulo 60 la exige como clausula obligatoria.";
    }
  } catch (error) {
    model = `fallback-analysis (${error instanceof Error ? error.message.slice(0, 80) : "OpenAI error"})`;
    resumen =
      "No se pudo generar el analisis con IA en este momento. Se muestran las normas recuperadas y la deteccion automatica de clausulas obligatorias.";
    for (const clause of clausulas) {
      clause.nota = clause.presente
        ? "Detectada en el documento."
        : "No se detecto; el articulo 60 la exige como clausula obligatoria.";
    }
  }

  return {
    resumen,
    confidence,
    clausulas,
    riesgos,
    recomendaciones,
    normasAplicables,
    sources,
    model,
  };
}
