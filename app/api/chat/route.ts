import { NextResponse } from "next/server";
import { answerLegalQuestion, chatRequestSchema } from "@/lib/legal-chat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = chatRequestSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud invalida", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    const result = await answerLegalQuestion(payload.data);

    return NextResponse.json({
      mode: payload.data.mode,
      question: payload.data.question,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo generar la respuesta",
      },
      { status: 500 },
    );
  }
}
