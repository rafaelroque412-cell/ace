import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildRespuestaDocx } from "@/lib/respuesta-generator";
import { writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { entity, nroOficio, destinatario, cargoDestinatario, asunto, cuerpo, baseLegal, remitente, cargoRemitente } = body;

    if (!entity?.name || !asunto || !cuerpo) {
      return NextResponse.json({ error: "Faltan datos obligatorios: entidad, asunto y cuerpo." }, { status: 400 });
    }

    const buffer = await buildRespuestaDocx({
      entity: {
        name: entity.name,
        ruc: entity.ruc ?? "",
        address: entity.address ?? "",
        executingUnit: entity.executingUnit ?? "",
      },
      nroOficio: nroOficio ?? "OFICIO N° ___ -2026",
      destinatario: destinatario ?? "[DESTINATARIO]",
      cargoDestinatario: cargoDestinatario ?? "",
      asunto,
      cuerpo,
      baseLegal: baseLegal ?? [],
      remitente: remitente ?? entity.name,
      cargoRemitente: cargoRemitente ?? "",
    });

    const slug = asunto
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

    await writeAuditLog({
      action: "respuesta.export",
      actorReference: auth.user.email ?? auth.user.id,
      details: { nroOficio, asunto },
      entityType: "respuesta",
      module: "expedientes-archivo",
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": `attachment; filename="respuesta-${slug}.docx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo exportar el documento" },
      { status: 500 },
    );
  }
}
