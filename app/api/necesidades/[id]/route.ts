import { NextResponse } from "next/server";
import { requireCapability, requireUser } from "@/lib/auth";
import { type Necesidad, type NecesidadDocumento, necesidadUpdateSchema } from "@/lib/necesidades";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT =
  "id,codigo,anio_fiscal,periodo_programacion,version_cmn,entidad,unidad_ejecutora,area_usuaria,centro_costo,responsable,nombre,finalidad_publica,problema_identificado,objetivo_contratacion,beneficio_esperado,poblacion_beneficiaria,pei_objetivo,pei_accion,poi_actividad,meta_presupuestal,proyecto_inversion,ioarr,tipo_objeto,especialidad,subespecialidad,codigo_catalogo,descripcion_catalogo,descripcion_detallada,cantidad,unidad_medida,frecuencia,fecha_requerida,trimestre,mes_programado,fuente_financiamiento,rubro,cadena_funcional,clasificador_gasto,monto_estimado,costo_unitario,costo_total,anio_referencia,departamento,provincia,distrito,lugar_entrega,alcance,condiciones_ejecucion,modalidad_pago,sistema_entrega,plazo_ejecucion,experiencia_requerida,personal_clave,equipamiento_minimo,habilitaciones,status,summary,process_id,owner_id,created_at,updated_at";

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
  if (data.tipoObjeto !== undefined) patch.tipo_objeto = data.tipoObjeto;
  if (data.anioFiscal !== undefined) patch.anio_fiscal = data.anioFiscal || null;
  if (data.periodoProgramacion !== undefined) patch.periodo_programacion = data.periodoProgramacion || null;
  if (data.versionCmn !== undefined) patch.version_cmn = data.versionCmn || null;
  if (data.entidad !== undefined) patch.entidad = data.entidad || null;
  if (data.unidadEjecutora !== undefined) patch.unidad_ejecutora = data.unidadEjecutora || null;
  if (data.areaUsuaria !== undefined) patch.area_usuaria = data.areaUsuaria || null;
  if (data.centroCosto !== undefined) patch.centro_costo = data.centroCosto || null;
  if (data.responsable !== undefined) patch.responsable = data.responsable || null;
  if (data.finalidadPublica !== undefined) patch.finalidad_publica = data.finalidadPublica || null;
  if (data.problemaIdentificado !== undefined) patch.problema_identificado = data.problemaIdentificado || null;
  if (data.objetivoContratacion !== undefined) patch.objetivo_contratacion = data.objetivoContratacion || null;
  if (data.beneficioEsperado !== undefined) patch.beneficio_esperado = data.beneficioEsperado || null;
  if (data.poblacionBeneficiaria !== undefined) patch.poblacion_beneficiaria = data.poblacionBeneficiaria || null;
  if (data.peiObjetivo !== undefined) patch.pei_objetivo = data.peiObjetivo || null;
  if (data.peiAccion !== undefined) patch.pei_accion = data.peiAccion || null;
  if (data.poiActividad !== undefined) patch.poi_actividad = data.poiActividad || null;
  if (data.metaPresupuestal !== undefined) patch.meta_presupuestal = data.metaPresupuestal || null;
  if (data.proyectoInversion !== undefined) patch.proyecto_inversion = data.proyectoInversion || null;
  if (data.ioarr !== undefined) patch.ioarr = data.ioarr || null;
  if (data.especialidad !== undefined) patch.especialidad = data.especialidad || null;
  if (data.subespecialidad !== undefined) patch.subespecialidad = data.subespecialidad || null;
  if (data.codigoCatalogo !== undefined) patch.codigo_catalogo = data.codigoCatalogo || null;
  if (data.descripcionCatalogo !== undefined) patch.descripcion_catalogo = data.descripcionCatalogo || null;
  if (data.descripcionDetallada !== undefined) patch.descripcion_detallada = data.descripcionDetallada || null;
  if (data.cantidad !== undefined) patch.cantidad = data.cantidad || null;
  if (data.unidadMedida !== undefined) patch.unidad_medida = data.unidadMedida || null;
  if (data.frecuencia !== undefined) patch.frecuencia = data.frecuencia || null;
  if (data.fechaRequerida !== undefined) patch.fecha_requerida = data.fechaRequerida || null;
  if (data.trimestre !== undefined) patch.trimestre = data.trimestre || null;
  if (data.mesProgramado !== undefined) patch.mes_programado = data.mesProgramado || null;
  if (data.fuenteFinanciamiento !== undefined) patch.fuente_financiamiento = data.fuenteFinanciamiento || null;
  if (data.rubro !== undefined) patch.rubro = data.rubro || null;
  if (data.cadenaFuncional !== undefined) patch.cadena_funcional = data.cadenaFuncional || null;
  if (data.clasificadorGasto !== undefined) patch.clasificador_gasto = data.clasificadorGasto || null;
  if (data.montoEstimado !== undefined) patch.monto_estimado = data.montoEstimado || null;
  if (data.costoUnitario !== undefined) patch.costo_unitario = data.costoUnitario || null;
  if (data.costoTotal !== undefined) patch.costo_total = data.costoTotal || null;
  if (data.anioReferencia !== undefined) patch.anio_referencia = data.anioReferencia || null;
  if (data.departamento !== undefined) patch.departamento = data.departamento || null;
  if (data.provincia !== undefined) patch.provincia = data.provincia || null;
  if (data.distrito !== undefined) patch.distrito = data.distrito || null;
  if (data.lugarEntrega !== undefined) patch.lugar_entrega = data.lugarEntrega || null;
  if (data.alcance !== undefined) patch.alcance = data.alcance || null;
  if (data.condicionesEjecucion !== undefined) patch.condiciones_ejecucion = data.condicionesEjecucion || null;
  if (data.modalidadPago !== undefined) patch.modalidad_pago = data.modalidadPago || null;
  if (data.sistemaEntrega !== undefined) patch.sistema_entrega = data.sistemaEntrega || null;
  if (data.plazoEjecucion !== undefined) patch.plazo_ejecucion = data.plazoEjecucion || null;
  if (data.experienciaRequerida !== undefined) patch.experiencia_requerida = data.experienciaRequerida || null;
  if (data.personalClave !== undefined) patch.personal_clave = data.personalClave || null;
  if (data.equipamientoMinimo !== undefined) patch.equipamiento_minimo = data.equipamientoMinimo || null;
  if (data.habilitaciones !== undefined) patch.habilitaciones = data.habilitaciones || null;
  if (data.status !== undefined) patch.status = data.status;
  if (data.summary !== undefined) patch.summary = data.summary || null;

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
