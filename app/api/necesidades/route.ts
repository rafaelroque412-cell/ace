import { NextResponse } from "next/server";
import { requireCapability, requireUser } from "@/lib/auth";
import { type Necesidad, necesidadCreateSchema } from "@/lib/necesidades";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT =
  "id,codigo,anio_fiscal,periodo_programacion,version_cmn,entidad,unidad_ejecutora,area_usuaria,centro_costo,responsable,nombre,finalidad_publica,problema_identificado,objetivo_contratacion,beneficio_esperado,poblacion_beneficiaria,pei_objetivo,pei_accion,poi_actividad,meta_presupuestal,proyecto_inversion,ioarr,tipo_objeto,especialidad,subespecialidad,codigo_catalogo,descripcion_catalogo,descripcion_detallada,cantidad,unidad_medida,frecuencia,fecha_requerida,trimestre,mes_programado,fuente_financiamiento,rubro,cadena_funcional,clasificador_gasto,monto_estimado,costo_unitario,costo_total,anio_referencia,departamento,provincia,distrito,lugar_entrega,alcance,condiciones_ejecucion,modalidad_pago,sistema_entrega,plazo_ejecucion,experiencia_requerida,personal_clave,equipamiento_minimo,habilitaciones,status,summary,process_id,owner_id,created_at,updated_at";

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
        tipo_objeto: data.tipoObjeto,
        anio_fiscal: data.anioFiscal || null,
        periodo_programacion: data.periodoProgramacion || null,
        version_cmn: data.versionCmn || null,
        entidad: data.entidad || null,
        unidad_ejecutora: data.unidadEjecutora || null,
        area_usuaria: data.areaUsuaria || auth.user.entity || null,
        centro_costo: data.centroCosto || null,
        responsable: data.responsable || null,
        finalidad_publica: data.finalidadPublica || null,
        problema_identificado: data.problemaIdentificado || null,
        objetivo_contratacion: data.objetivoContratacion || null,
        beneficio_esperado: data.beneficioEsperado || null,
        poblacion_beneficiaria: data.poblacionBeneficiaria || null,
        pei_objetivo: data.peiObjetivo || null,
        pei_accion: data.peiAccion || null,
        poi_actividad: data.poiActividad || null,
        meta_presupuestal: data.metaPresupuestal || null,
        proyecto_inversion: data.proyectoInversion || null,
        ioarr: data.ioarr || null,
        especialidad: data.especialidad || null,
        subespecialidad: data.subespecialidad || null,
        codigo_catalogo: data.codigoCatalogo || null,
        descripcion_catalogo: data.descripcionCatalogo || null,
        descripcion_detallada: data.descripcionDetallada || null,
        cantidad: data.cantidad || null,
        unidad_medida: data.unidadMedida || null,
        frecuencia: data.frecuencia || null,
        fecha_requerida: data.fechaRequerida || null,
        trimestre: data.trimestre || null,
        mes_programado: data.mesProgramado || null,
        fuente_financiamiento: data.fuenteFinanciamiento || null,
        rubro: data.rubro || null,
        cadena_funcional: data.cadenaFuncional || null,
        clasificador_gasto: data.clasificadorGasto || null,
        monto_estimado: data.montoEstimado || null,
        costo_unitario: data.costoUnitario || null,
        costo_total: data.costoTotal || null,
        anio_referencia: data.anioReferencia || null,
        departamento: data.departamento || null,
        provincia: data.provincia || null,
        distrito: data.distrito || null,
        lugar_entrega: data.lugarEntrega || null,
        alcance: data.alcance || null,
        condiciones_ejecucion: data.condicionesEjecucion || null,
        modalidad_pago: data.modalidadPago || null,
        sistema_entrega: data.sistemaEntrega || null,
        plazo_ejecucion: data.plazoEjecucion || null,
        experiencia_requerida: data.experienciaRequerida || null,
        personal_clave: data.personalClave || null,
        equipamiento_minimo: data.equipamientoMinimo || null,
        habilitaciones: data.habilitaciones || null,
        summary: data.summary || null,
        status: "pendiente_revision",
        owner_id: auth.user.id,
      }),
      method: "POST",
    });

    await writeAuditLog({
      action: "necesidad.create",
      actorReference: auth.user.email ?? auth.user.id,
      details: { codigo: necesidad?.codigo, nombre: data.nombre, tipo: data.tipoObjeto },
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
