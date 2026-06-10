import { NextResponse } from "next/server";
import { requireCapability, requireUser } from "@/lib/auth";
import { type Necesidad, necesidadCreateSchema } from "@/lib/necesidades";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT =
  "id,codigo,nombre,finalidad_publica,objetivo,centro_costo,meta_presupuestal,proyecto_inversion,tipo_contratacion,area_usuaria,status,summary,process_id,owner_id,entity,created_at,updated_at";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const necesidades = await supabaseUserRest<Necesidad[]>(
      auth.user.accessToken,
      `necesidades?select=${SELECT}&order=created_at.desc&limit=100`,
    );
    return NextResponse.json({ necesidades });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron listar las necesidades", necesidades: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const payload = necesidadCreateSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: payload.error.flatten() }, { status: 400 });
  }

  const data = payload.data;
  try {
    const [necesidad] = await supabaseUserRest<Necesidad[]>(auth.user.accessToken, `necesidades?select=${SELECT}`, {
      body: JSON.stringify({
        nombre: data.nombre,
        tipo_contratacion: data.tipoContratacion,
        finalidad_publica: data.finalidadPublica || null,
        objetivo: data.objetivo || null,
        centro_costo: data.centroCosto || null,
        meta_presupuestal: data.metaPresupuestal || null,
        proyecto_inversion: data.proyectoInversion || null,
        area_usuaria: data.areaUsuaria || auth.user.entity || null,
        summary: data.summary || null,
        status: "registrada",
        entity: auth.user.entity || null,
        owner_id: auth.user.id,
      }),
      method: "POST",
    });

    await writeAuditLog({
      action: "necesidad.create",
      actorReference: auth.user.email ?? auth.user.id,
      details: { codigo: necesidad?.codigo, nombre: data.nombre, tipo: data.tipoContratacion },
      entityId: necesidad?.id,
      entityType: "necesidad",
    });

    return NextResponse.json({ necesidad }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar la necesidad" },
      { status: 500 },
    );
  }
}
