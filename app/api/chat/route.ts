import { NextResponse } from "next/server";
import { z } from "zod";

const chatRequestSchema = z.object({
  question: z.string().min(5),
  mode: z.enum(["breve", "tecnica", "informe", "checklist"]).default("tecnica"),
});

export async function POST(request: Request) {
  const payload = chatRequestSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Solicitud invalida", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json({
    answer:
      "Endpoint preparado. Siguiente paso: conectar embeddings, Pinecone y generacion OpenAI con citas verificables.",
    mode: payload.data.mode,
    question: payload.data.question,
    sources: [],
  });
}
