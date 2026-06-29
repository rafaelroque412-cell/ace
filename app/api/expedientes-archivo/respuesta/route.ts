import { NextResponse } from "next/server";
import { requireEditor, requireUser } from "@/lib/auth";
import { getSupabaseServerConfig, supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIST_SELECT =
  "id,nro_oficio,tipo_documento,anio,asunto,destinatario,remitente,cuerpo,base_legal,antecedentes,entity,expediente_id,tone,length,token_usage,created_at";

function text(value: unknown, max = 4000): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

// GET: lista las respuestas guardadas más recientes (historial).
export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    getSupabaseServerConfig();

    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));

    const respuestas = await supabaseRest(
      `expedientes_respuestas?select=${LIST_SELECT}&order=created_at.desc&limit=${limit}`,
    );
    return NextResponse.json({ respuestas });
  } catch (error) {
    return NextResponse.json(
      { respuestas: [], error: error instanceof Error ? error.message : "No se pudo listar" },
      { status: 200 },
    );
  }
}

// POST: guarda/archiva una respuesta generada.
export async function POST(request: Request) {
  try {
    const auth = await requireEditor();
    if ("error" in auth) return auth.error;
    getSupabaseServerConfig();

    const body = await request.json();
    if (!text(body.cuerpo)) {
      return NextResponse.json({ error: "No hay cuerpo de respuesta para guardar" }, { status: 400 });
    }

    const tipoDocumento = ["OFICIO", "INFORME", "CARTA", "MEMORANDUM"].includes(body.tipoDocumento)
      ? (body.tipoDocumento as string)
      : null;
    const oficinaId = typeof body.oficinaId === "string" && body.oficinaId ? body.oficinaId : null;

    // Numeración: si se pide asignar (assignNumber) y hay oficina+tipo, se consume
    // el siguiente correlativo de esa oficina de forma ATÓMICA (función SQL). Si no,
    // se respeta el nro que venga del cliente.
    let nroOficio = text(body.nroOficio, 120);
    if (body.assignNumber && oficinaId && tipoDocumento) {
      const assigned = await supabaseRest<string | null>("rpc/expedientes_next_doc_number", {
        body: JSON.stringify({ p_oficina: oficinaId, p_tipo: tipoDocumento }),
        method: "POST",
      }).catch(() => null);
      if (typeof assigned === "string" && assigned.trim()) {
        nroOficio = assigned.trim();
      }
    }

    const anioRaw = body.anio;
    const payload: Record<string, unknown> = {
      nro_oficio: nroOficio,
      tipo_documento: tipoDocumento,
      oficina_id: oficinaId,
      anio: Number.isFinite(Number(anioRaw)) ? Number(anioRaw) : new Date().getFullYear(),
      asunto: text(body.asunto, 500),
      destinatario: text(body.destinatario, 300),
      cargo_destinatario: text(body.cargoDestinatario, 200),
      remitente: text(body.remitente, 300),
      documento_texto: text(body.documentoTexto, 20000),
      cuerpo: text(body.cuerpo, 20000),
      base_legal: Array.isArray(body.baseLegal) ? body.baseLegal : [],
      antecedentes: Array.isArray(body.antecedentes) ? body.antecedentes : [],
      entity: body.entity && typeof body.entity === "object" ? body.entity : {},
      expediente_id: typeof body.expedienteId === "string" && body.expedienteId ? body.expedienteId : null,
      tone: text(body.tone, 20),
      length: text(body.length, 20),
      token_usage: body.tokenUsage && typeof body.tokenUsage === "object" ? body.tokenUsage : null,
      created_by: auth.user.id,
    };

    const [saved] = await supabaseRest<Array<{ id: string }>>("expedientes_respuestas?select=id", {
      body: JSON.stringify(payload),
      method: "POST",
    });

    await writeAuditLog({
      action: "respuesta.save",
      actorReference: auth.user.email ?? auth.user.id,
      details: { nroOficio: payload.nro_oficio, asunto: payload.asunto },
      entityId: saved?.id,
      entityType: "respuesta",
      module: "expedientes-archivo",
    });

    return NextResponse.json({ id: saved?.id ?? null, nroOficio }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la respuesta" },
      { status: 500 },
    );
  }
}
