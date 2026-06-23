import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { expedienteSearchSchema } from "@/lib/expedientes-archivo";
import { searchExpedientes } from "@/lib/expedientes-archivo-search";
import { writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const payload = expedienteSearchSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud invalida", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    const results = await searchExpedientes(payload.data);

    await writeAuditLog({
      action: "expedientes.search",
      actorReference: auth.user.email ?? auth.user.id,
      details: { query: payload.data.query, anio: payload.data.anio ?? null, hits: results.length },
      entityType: "expediente_search",
      module: "expedientes",
    });

    return NextResponse.json({ query: payload.data.query, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo ejecutar la busqueda" },
      { status: 500 },
    );
  }
}
