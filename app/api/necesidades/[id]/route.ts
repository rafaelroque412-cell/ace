import { NextResponse } from "next/server";
import { requireCapability, requireUser } from "@/lib/auth";
import { type Necesidad, type NecesidadDocumento, necesidadUpdateSchema } from "@/lib/necesidades";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT =
  "id,codigo,nombre,finalidad_publica,objetivo,centro_costo,meta_presupuestal,proyecto_inversion,tipo_contratacion,area_usuaria,status,summary,process_id,owner_id,entity,created_at,updated_at";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  try {
    const [necesidades, documentos] = await Promise.all([
      supabaseUserRest<Necesidad[]>(auth.user.accessToken, `necesidades?id=eq.${id}&select=${SELECT}`),
      supabaseUserRest<NecesidadDocumento[]>(
        auth.user.accessToken,
        `necesidad_documentos?necesidad_id=eq.${id}&select=id,necesidad_id,kind,title,file_name,storage_bucket,storage_path,mime_type,status,error_message,created_at&order=created_at.asc`,
      ).catch(() => []),
    ]);
    const necesidad = necesidades[0];
    if (!necesidad) {
      return NextResponse.json({ error: "Necesidad no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ necesidad, documentos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la necesidad" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const payload = necesidadUpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const data = payload.data;
  const patch: Record<string, unknown> = {};
  if (data.nombre !== undefined) patch.nombre = data.nombre;
  if (data.tipoContratacion !== undefined) patch.tipo_contratacion = data.tipoContratacion;
  if (data.finalidadPublica !== undefined) patch.finalidad_publica = data.finalidadPublica || null;
  if (data.objetivo !== undefined) patch.objetivo = data.objetivo || null;
  if (data.centroCosto !== undefined) patch.centro_costo = data.centroCosto || null;
  if (data.metaPresupuestal !== undefined) patch.meta_presupuestal = data.metaPresupuestal || null;
  if (data.proyectoInversion !== undefined) patch.proyecto_inversion = data.proyectoInversion || null;
  if (data.areaUsuaria !== undefined) patch.area_usuaria = data.areaUsuaria || null;
  if (data.summary !== undefined) patch.summary = data.summary || null;
  if (data.status !== undefined) patch.status = data.status;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  try {
    const [necesidad] = await supabaseUserRest<Necesidad[]>(
      auth.user.accessToken,
      `necesidades?id=eq.${id}&select=${SELECT}`,
      { body: JSON.stringify(patch), method: "PATCH" },
    );
    return NextResponse.json({ necesidad });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la necesidad" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  try {
    await supabaseUserRest(auth.user.accessToken, `necesidades?id=eq.${id}`, { method: "DELETE" });
    await writeAuditLog({
      action: "necesidad.delete",
      actorReference: auth.user.email ?? auth.user.id,
      entityId: id,
      entityType: "necesidad",
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar la necesidad" },
      { status: 500 },
    );
  }
}
