import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { expedienteChatSchema } from "@/lib/expedientes-archivo";
import { answerExpedienteQuestion } from "@/lib/expedientes-archivo-search";
import { writeAuditLog } from "@/lib/supabase-server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "chat"),
      RATE_LIMITS.chat,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const payload = expedienteChatSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud invalida", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    const result = await answerExpedienteQuestion(payload.data);

    await writeAuditLog({
      action: "expedientes.chat",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        query: payload.data.query,
        sufficient: result.sufficient,
        sources: result.sources.length,
      },
      entityType: "expediente_chat",
      module: "expedientes",
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo responder la consulta" },
      { status: 500 },
    );
  }
}
