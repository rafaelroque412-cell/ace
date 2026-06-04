import { answerLegalQuestion } from "@/lib/legal-chat";
import { supabaseUserRest } from "@/lib/supabase-server";

// Evaluacion continua del RAG (Fase 4): corre un set de preguntas curadas contra el
// pipeline real de respuesta del chat y mide cobertura de keywords, suficiencia de
// fuentes y confianza. No persiste el intercambio en el historial (persist:false).

export type EvalQuestion = {
  id: string;
  question: string;
  expected_keywords: string[];
  document_type: string | null;
  process_type: string | null;
  created_at: string;
};

export type EvalResult = {
  id: string;
  corrida_id: string;
  pregunta_id: string | null;
  question: string | null;
  confidence: string | null;
  sufficient: boolean | null;
  sources_count: number | null;
  keyword_hit: number | null;
  score: number | null;
  feedback: string | null;
  created_at: string;
};

export type EvalRun = {
  id: string;
  run_at: string;
  summary: EvalRunSummary;
};

export type EvalRunSummary = {
  total: number;
  avgScore: number;
  sufficientCount: number;
  avgKeywordHit: number | null;
  confidence: { alta: number; media: number; baja: number };
};

const confidenceWeight: Record<string, number> = { alta: 1, media: 0.6, baja: 0.2 };

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function keywordHitRatio(answer: string, keywords: string[]) {
  if (keywords.length === 0) {
    return { ratio: null as number | null, missing: [] as string[] };
  }
  const haystack = normalize(answer);
  const missing = keywords.filter((keyword) => !haystack.includes(normalize(keyword)));
  return { ratio: (keywords.length - missing.length) / keywords.length, missing };
}

function scoreOf(input: { sufficient: boolean; confidence: string; keywordHit: number | null }) {
  const confW = confidenceWeight[input.confidence] ?? 0.2;
  const sufW = input.sufficient ? 1 : 0;
  const raw =
    input.keywordHit === null
      ? 0.6 * sufW + 0.4 * confW
      : 0.4 * sufW + 0.25 * confW + 0.35 * input.keywordHit;
  return Math.round(raw * 1000) / 1000;
}

type RunRow = {
  pregunta_id: string;
  question: string;
  confidence: string;
  sufficient: boolean;
  sources_count: number;
  keyword_hit: number | null;
  score: number;
  feedback: string;
};

// Corre todas las preguntas del banco y persiste una corrida + sus resultados.
// Devuelve la corrida creada con su resumen y las filas de resultado.
export async function runEvaluation(accessToken: string) {
  const preguntas = await supabaseUserRest<EvalQuestion[]>(
    accessToken,
    "eval_preguntas?select=id,question,expected_keywords,document_type,process_type,created_at&order=created_at.asc",
  );

  if (preguntas.length === 0) {
    throw new Error("No hay preguntas de evaluacion. Agrega al menos una.");
  }

  const rows: RunRow[] = [];
  // Secuencial para no saturar OpenAI/Pinecone con N respuestas en paralelo.
  for (const pregunta of preguntas) {
    try {
      const result = await answerLegalQuestion(
        {
          filters: {
            documentType: pregunta.document_type ?? "",
            processType: pregunta.process_type ?? "",
          },
          mode: "tecnica",
          question: pregunta.question,
        },
        { accessToken, ownerId: "eval", persist: false },
      );
      const { ratio, missing } = keywordHitRatio(result.answer, pregunta.expected_keywords ?? []);
      const confidence = result.assessment.confidence;
      const sufficient = result.assessment.sufficient;
      const feedbackParts: string[] = [];
      if (!sufficient) {
        feedbackParts.push(result.assessment.reason || "Fuentes insuficientes.");
      }
      if (missing.length > 0) {
        feedbackParts.push(`Faltan terminos esperados: ${missing.join(", ")}.`);
      }
      rows.push({
        confidence,
        feedback: feedbackParts.join(" ") || "Respuesta correcta y con cobertura esperada.",
        keyword_hit: ratio,
        pregunta_id: pregunta.id,
        question: pregunta.question,
        score: scoreOf({ confidence, keywordHit: ratio, sufficient }),
        sources_count: result.sources.length,
        sufficient,
      });
    } catch (error) {
      rows.push({
        confidence: "baja",
        feedback: error instanceof Error ? error.message : "Error al responder.",
        keyword_hit: null,
        pregunta_id: pregunta.id,
        question: pregunta.question,
        score: 0,
        sources_count: 0,
        sufficient: false,
      });
    }
  }

  const keywordRatios = rows.map((row) => row.keyword_hit).filter((value): value is number => value !== null);
  const summary: EvalRunSummary = {
    avgKeywordHit: keywordRatios.length
      ? Math.round((keywordRatios.reduce((sum, value) => sum + value, 0) / keywordRatios.length) * 1000) / 1000
      : null,
    avgScore: Math.round((rows.reduce((sum, row) => sum + row.score, 0) / rows.length) * 1000) / 1000,
    confidence: {
      alta: rows.filter((row) => row.confidence === "alta").length,
      baja: rows.filter((row) => row.confidence === "baja").length,
      media: rows.filter((row) => row.confidence === "media").length,
    },
    sufficientCount: rows.filter((row) => row.sufficient).length,
    total: rows.length,
  };

  const [corrida] = await supabaseUserRest<EvalRun[]>(accessToken, "eval_corridas", {
    body: JSON.stringify({ summary }),
    method: "POST",
  });

  await supabaseUserRest(accessToken, "eval_resultados", {
    body: JSON.stringify(rows.map((row) => ({ ...row, corrida_id: corrida.id }))),
    method: "POST",
  });

  return { corrida, results: rows };
}

// Carga el banco de preguntas, las ultimas corridas y los resultados de la mas reciente.
export async function getEvaluationOverview(accessToken: string) {
  const [preguntas, corridas] = await Promise.all([
    supabaseUserRest<EvalQuestion[]>(
      accessToken,
      "eval_preguntas?select=id,question,expected_keywords,document_type,process_type,created_at&order=created_at.asc",
    ),
    supabaseUserRest<EvalRun[]>(
      accessToken,
      "eval_corridas?select=id,run_at,summary&order=run_at.desc&limit=10",
    ),
  ]);

  const latest = corridas[0];
  const lastResults = latest
    ? await supabaseUserRest<EvalResult[]>(
        accessToken,
        `eval_resultados?corrida_id=eq.${latest.id}&select=id,corrida_id,pregunta_id,question,confidence,sufficient,sources_count,keyword_hit,score,feedback,created_at&order=score.asc`,
      )
    : [];

  return { corridas, lastResults, preguntas };
}
