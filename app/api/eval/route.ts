import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getEvaluationOverview, runEvaluation, seedBaselineEvalQuestions } from "@/lib/legal-eval";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// La corrida ejecuta N respuestas del chat (OpenAI + Pinecone) en serie.
export const maxDuration = 300;

const questionSchema = z.object({
  action: z.literal("add"),
  question: z.string().trim().min(8).max(500),
  expectedKeywords: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  expectedSources: z
    .array(
      z.object({
        article: z.string().trim().max(40).optional().or(z.literal("")),
        documentType: z.string().trim().max(60).optional().or(z.literal("")),
        processType: z.string().trim().max(60).optional().or(z.literal("")),
        titleIncludes: z.string().trim().max(120).optional().or(z.literal("")),
      }),
    )
    .max(10)
    .default([]),
  documentType: z.string().trim().max(60).optional().or(z.literal("")),
  processType: z.string().trim().max(60).optional().or(z.literal("")),
});

const runSchema = z.object({ action: z.literal("run") });
const seedSchema = z.object({ action: z.literal("seed") });

const bodySchema = z.discriminatedUnion("action", [questionSchema, runSchema, seedSchema]);

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }
  try {
    const overview = await getEvaluationOverview(auth.user.accessToken);
    return NextResponse.json(overview);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la evaluacion" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  const payload = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Solicitud invalida" }, { status: 400 });
  }

  try {
    if (payload.data.action === "run") {
      const run = await runEvaluation(auth.user.accessToken);
      return NextResponse.json(run);
    }

    if (payload.data.action === "seed") {
      const result = await seedBaselineEvalQuestions(auth.user.accessToken);
      return NextResponse.json(result);
    }

    const [pregunta] = await supabaseUserRest<Array<{ id: string }>>(auth.user.accessToken, "eval_preguntas", {
      body: JSON.stringify({
        document_type: payload.data.documentType || null,
        expected_keywords: payload.data.expectedKeywords,
        expected_sources: payload.data.expectedSources.map((source) => ({
          article: source.article || undefined,
          documentType: source.documentType || undefined,
          processType: source.processType || undefined,
          titleIncludes: source.titleIncludes || undefined,
        })),
        process_type: payload.data.processType || null,
        question: payload.data.question,
      }),
      method: "POST",
    });
    return NextResponse.json({ pregunta });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo completar la accion" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }
  await supabaseUserRest(auth.user.accessToken, `eval_preguntas?id=eq.${id}`, { method: "DELETE" });
  return NextResponse.json({ deleted: true });
}
