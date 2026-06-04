import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { compareNorms, compareRequestSchema } from "@/lib/legal-compare";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const payload = compareRequestSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud invalida", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    const result = await compareNorms(payload.data, {
      accessToken: auth.user.accessToken,
      ownerId: auth.user.id,
    });

    return NextResponse.json({ topic: payload.data.topic, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar la comparacion";
    const isValidation = message.includes("alcances distintos");

    return NextResponse.json({ error: message }, { status: isValidation ? 400 : 500 });
  }
}
