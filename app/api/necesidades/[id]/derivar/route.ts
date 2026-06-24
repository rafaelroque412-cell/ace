import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import { type Necesidad } from "@/lib/necesidades";
import type { ProcurementProcess } from "@/lib/processes";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Deriva una Necesidad (Modulo 1) a un Expediente de Contratacion: lo crea la
// DEC (capacidad expediente.manage) e inicia el expediente en actuaciones
// preparatorias, dejando la necesidad como "derivada" y vinculada.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as { procedureType?: string };

  try {
    const [necesidades] = await Promise.all([
      supabaseUserRest<Necesidad[]>(
        auth.user.accessToken,
        `necesidades?id=eq.${id}&select=id,codigo,nombre,tipo_objeto,summary,status,process_id,entidad`,
      ),
    ]);
    const necesidad = necesidades[0];
    if (!necesidad) {
      return NextResponse.json({ error: "Necesidad no encontrada" }, { status: 404 });
    }
    if (necesidad.process_id) {
      return NextResponse.json({ error: "La necesidad ya fue derivada a un expediente." }, { status: 409 });
    }

    const nomenclature = necesidad.codigo ? `${necesidad.codigo} — ${necesidad.nombre}` : necesidad.nombre;
    const [process] = await supabaseUserRest<ProcurementProcess[]>(
      auth.user.accessToken,
      "procurement_processes?select=id,nomenclature,object_type,procedure_type,amount,entity,status,summary,created_at,updated_at",
      {
        body: JSON.stringify({
          nomenclature,
          object_type: necesidad.tipo_objeto,
          procedure_type: payload.procedureType || null,
          entity: necesidad.entidad || auth.user.entity || null,
          status: "actuaciones_preparatorias",
          summary: necesidad.summary || null,
          necesidad_id: necesidad.id,
          owner_id: auth.user.id,
        }),
        method: "POST",
      },
    );

    await supabaseUserRest(auth.user.accessToken, `necesidades?id=eq.${id}`, {
      body: JSON.stringify({ status: "incorporado_cmn", process_id: process.id }),
      method: "PATCH",
    });

    await writeAuditLog({
      action: "necesidad.derivar",
      actorReference: auth.user.email ?? auth.user.id,
      details: { necesidad: necesidad.codigo, processId: process.id },
      entityId: process.id,
      entityType: "procurement_process",
    });

    return NextResponse.json({ process }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo derivar la necesidad" },
      { status: 500 },
    );
  }
}
