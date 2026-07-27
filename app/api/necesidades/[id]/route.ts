import { NextResponse } from "next/server";
import { requireCapability, requireUser } from "@/lib/auth";
import { construirColumnas } from "@/lib/necesidad-columnas";
import { nomenclaturaExpediente } from "@/lib/necesidad-denominacion";
import { borrarFicherosDe, type DocumentoConFichero } from "@/lib/necesidad-borrado";
import { hitosEstadoDesdeAuditoria } from "@/lib/necesidad-flujo";
import {
  type Necesidad,
  type NecesidadDocumento,
  type NecesidadItemRow,
  necesidadUpdateSchema,
} from "@/lib/necesidades";
import { supabaseRest, supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Los `numeric` llegan como texto desde PostgREST. */
function aNumero(valor: number | string | null): number | null {
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

const SELECT =
  "id,codigo,anio_fiscal,periodo_programacion,version_cmn,entidad,unidad_ejecutora,area_usuaria,centro_costo,responsable,nombre,finalidad_publica,pei_objetivo,pei_accion,poi_actividad,meta_presupuestal,proyecto_inversion,cui,ioarr,tipo_objeto,tipo_proceso_seleccion,especialidad,subespecialidad,codigo_catalogo,descripcion_catalogo,descripcion_general,descripcion_detallada,ficha_tecnica_identificacion,compatibilizacion,normas_tecnicas,prestaciones_accesorias,cantidad,unidad_medida,frecuencia,fecha_requerida,trimestre,mes_programado,fuente_financiamiento,rubro,cadena_funcional,clasificador_gasto,monto_estimado,costo_unitario,costo_total,moneda,anio_referencia,departamento,provincia,distrito,lugar_entrega,alcance,condiciones_ejecucion,modalidad_pago,sistema_entrega,plazo_ejecucion,plazo_ejecucion_unidad,equipamiento_minimo,habilitaciones,formula_reajuste,adelanto_directo,penalidad_mora,garantias,recepcion_conformidad,subcontratacion,otras_penalidades,solucion_controversias,plazo_respuestas,requisitos_adicionales,gestion_riesgos,metas_fisicas,disponibilidad_terreno,seguros,metodologia_bim,gestion_calidad,anexos_tecnicos,requisitos_calificacion,verificacion_ficha_tecnica,verificacion_almacen,certificacion_presupuestal,fecha_remision_dec,fecha_version_dos,fecha_version_n,status,tipo_area,cmn_verificado,no_objecion,no_objecion_sustento,no_objecion_mecanismo,summary,process_id,owner_id,created_at,updated_at";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const tok = auth.user.accessToken;
  try {
    // Carga combinada: todo lo necesidad-scoped que la página pide al abrir se
    // resuelve en UNA respuesta (consultas en paralelo, una sola autorización),
    // en vez de ~6 peticiones sueltas —cada una con su round-trip y su RLS—. Mismo
    // criterio que /api/processes/:id. Cada lectura tolera su propio fallo: si una
    // tabla nueva no existiera aún, el resto de la ficha carga igual.
    const [necesidades, documentos, riesgos, observaciones, versiones, admisibilidadRows, auditRows, itemRows] = await Promise.all([
      supabaseUserRest<Necesidad[]>(tok, `necesidades?id=eq.${id}&select=${SELECT}`),
      supabaseUserRest<NecesidadDocumento[]>(
        tok,
        `necesidad_documentos?necesidad_id=eq.${id}&select=id,necesidad_id,kind,title,file_name,storage_bucket,storage_path,mime_type,status,error_message,created_at&order=created_at.asc`,
      ).catch(() => []),
      supabaseUserRest<unknown[]>(
        tok,
        `riesgo_necesidad?necesidad_id=eq.${id}&select=id,necesidad_id,riesgo,probabilidad,impacto,mitigacion,responsable,created_at&order=created_at.asc`,
      ).catch(() => []),
      supabaseUserRest<unknown[]>(
        tok,
        `necesidad_observaciones?necesidad_id=eq.${id}&select=id,necesidad_id,campo,comentario,autor_referencia,autor_rol,resuelto,resuelto_por,created_at,resuelto_at&order=created_at.asc`,
      ).catch(() => []),
      supabaseUserRest<unknown[]>(
        tok,
        `necesidad_versiones?necesidad_id=eq.${id}&select=id,snapshot,transicion,etiqueta,autor_referencia,autor_rol,created_at&order=created_at.asc`,
      ).catch(() => []),
      supabaseUserRest<Array<{ items?: unknown; actualizado_por?: string | null; updated_at?: string | null }>>(
        tok,
        `necesidad_admisibilidad?necesidad_id=eq.${id}&select=necesidad_id,items,actualizado_por,updated_at`,
      ).catch(() => []),
      // Transiciones del workflow para el stepper (C): fechas de cada hito. Se lee
      // con service-role (audit_logs no expone RLS al usuario); la visibilidad de
      // la necesidad ya la garantiza la primera consulta con el token del usuario.
      supabaseRest<Array<{ action: string; created_at: string }>>(
        `audit_logs?entity_type=eq.necesidad&entity_id=eq.${id}&select=action,created_at&order=created_at.asc`,
      ).catch(() => []),
      // Ítems del requerimiento (sección 3.2). Van en la carga combinada para
      // que el cuadro no haga su propia petición al abrir la ficha.
      supabaseUserRest<NecesidadItemRow[]>(
        tok,
        `necesidad_items?necesidad_id=eq.${id}&select=id,necesidad_id,nro,descripcion,codigo_catalogo,unidad_medida,cantidad,costo_unitario,costo_total,tipo_objeto,nro_paquete,descripcion_paquete&order=nro.asc`,
      ).catch(() => [] as NecesidadItemRow[]),
    ]);
    const necesidad = necesidades[0];
    if (!necesidad) {
      return NextResponse.json({ error: "Necesidad no encontrada" }, { status: 404 });
    }
    const adm = admisibilidadRows[0];
    return NextResponse.json({
      necesidad,
      documentos,
      riesgos,
      observaciones,
      versiones,
      admisibilidad: { items: adm?.items ?? {}, actualizadoPor: adm?.actualizado_por ?? null, updatedAt: adm?.updated_at ?? null },
      hitosEstado: hitosEstadoDesdeAuditoria(auditRows),
      items: itemRows.map((row) => ({
        cantidad: aNumero(row.cantidad),
        codigoCatalogo: row.codigo_catalogo,
        costoTotal: aNumero(row.costo_total),
        costoUnitario: aNumero(row.costo_unitario),
        descripcion: row.descripcion,
        id: row.id,
        nro: row.nro,
        descripcionPaquete: row.descripcion_paquete,
        nroPaquete: row.nro_paquete,
        tipoObjeto: row.tipo_objeto,
        unidadMedida: row.unidad_medida,
      })),
    });
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
    // Se dice QUÉ campo falla y por qué. Antes solo respondía "Solicitud
    // inválida": con una ficha de ~70 campos, eso deja al usuario sin nada que
    // hacer salvo adivinar. El POST ya devolvía los detalles; el PATCH no.
    const issues = payload.error.issues.map((i) => ({
      campo: i.path.join(".") || "(cuerpo)",
      motivo: i.message,
    }));
    const resumen = issues
      .slice(0, 3)
      .map((i) => `${i.campo}: ${i.motivo}`)
      .join(" · ");
    return NextResponse.json(
      {
        error: `Solicitud inválida — ${resumen}${issues.length > 3 ? ` (y ${issues.length - 3} más)` : ""}`,
        details: payload.error.flatten(),
      },
      { status: 400 },
    );
  }

  const data = payload.data;
  // El patch se DERIVA del schema (una columna por campo camelCase→snake_case),
  // en vez de mapearse a mano campo por campo. La lista manual era el sitio
  // donde `nombre`, `cui` y `year` se guardaban en el formulario y nunca
  // llegaban a la columna: un campo nuevo que nadie añadía aquí fallaba en
  // silencio. Con el conversor, un campo nuevo del schema llega solo.
  //
  // `status` queda fuera a propósito (CAMPOS_NO_COLUMNA): el estado solo se
  // mueve por POST .../transicion, que valida la acción contra la máquina de
  // estados. Aceptarlo aquí convertía ese flujo en decorativo.
  const patch = construirColumnas(data);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  // Bloqueo optimista: el cliente envía el `updated_at` de la versión que cargó.
  // Se filtra el UPDATE por ese sello, así que si otro actor guardó en medio (el
  // trigger `set_updated_at` movió el sello) el filtro no casa ninguna fila y
  // PostgREST responde []. Distingue "nadie lo tocó y no existe/está oculto" de
  // "alguien lo modificó detrás" releyendo la fila. Sin cabecera, se comporta
  // como antes (compatibilidad con llamadas que no la envían).
  const baseUpdatedAt = request.headers.get("x-base-updated-at");
  try {
    const filtro = baseUpdatedAt
      ? `necesidades?id=eq.${id}&updated_at=eq.${encodeURIComponent(baseUpdatedAt)}&select=${SELECT}`
      : `necesidades?id=eq.${id}&select=${SELECT}`;
    const [necesidad] = await supabaseUserRest<Necesidad[]>(
      auth.user.accessToken,
      filtro,
      { body: JSON.stringify(patch), method: "PATCH" },
    );

    if (!necesidad) {
      if (baseUpdatedAt) {
        const [actual] = await supabaseUserRest<Necesidad[]>(
          auth.user.accessToken,
          `necesidades?id=eq.${id}&select=${SELECT}`,
        );
        if (actual) {
          return NextResponse.json(
            {
              error:
                "Otro usuario guardó cambios en esta necesidad mientras la editabas. Recarga para ver la última versión antes de volver a guardar.",
              conflict: true,
              necesidad: actual,
            },
            { status: 409 },
          );
        }
      }
      return NextResponse.json({ error: "Necesidad no encontrada" }, { status: 404 });
    }

    // La denominación es UNA: si cambia el nombre de la necesidad, el
    // expediente derivado deja de llamarse como su requerimiento. Se busca por
    // `necesidad_id` —el puntero del propio expediente— y no por
    // `necesidad.process_id`, porque hay filas antiguas donde ese se perdió y
    // el expediente sigue leyendo esta necesidad.
    //
    // Va después del PATCH y sin romper la respuesta: renombrar es un efecto
    // secundario deseable, pero si falla no debe tumbar el guardado de la ficha.
    if (patch.nombre !== undefined && necesidad) {
      const nomenclature = nomenclaturaExpediente(necesidad.codigo, necesidad.nombre);
      if (nomenclature) {
        await supabaseUserRest(
          auth.user.accessToken,
          `procurement_processes?necesidad_id=eq.${id}`,
          { body: JSON.stringify({ nomenclature }), method: "PATCH" },
        ).catch(() => {
          // Silencioso a propósito: la ficha ya se guardó. Si el expediente no
          // se pudo renombrar, se corrige al volver a guardar.
        });
      }
    }

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
    // No se puede eliminar una necesidad ya derivada: primero el expediente.
    const [nec] = await supabaseUserRest<Array<{ process_id: string | null }>>(
      auth.user.accessToken,
      `necesidades?id=eq.${id}&select=process_id`,
    );
    if (nec?.process_id) {
      return NextResponse.json(
        { error: "Esta necesidad está derivada a un expediente. Elimina primero el expediente." },
        { status: 409 },
      );
    }
    // Los ficheros hay que recogerlos ANTES de borrar: las filas de
    // `necesidad_documentos` se van solas por `on delete cascade`, y con ellas
    // la única referencia a su PDF. Así se quedaban en el almacén para siempre
    // —se encontró uno de 1,6 MB de una necesidad borrada en julio—.
    const adjuntos = await supabaseRest<DocumentoConFichero[]>(
      `necesidad_documentos?necesidad_id=eq.${id}&select=storage_bucket,storage_path`,
    );
    // Los EETT/TDR viven en `documents`, que NO tiene clave foránea a
    // `necesidades`: el vínculo es `metadata->>necesidadId`, JSON puro. Sin
    // borrarlos aquí, la FILA tambien sobrevivía a su necesidad.
    const eettTdr = await supabaseRest<Array<DocumentoConFichero & { id: string }>>(
      `documents?metadata->>necesidadId=eq.${id}&select=id,storage_bucket,storage_path`,
    );
    const fallos = await borrarFicherosDe([...adjuntos, ...eettTdr]);
    for (const doc of eettTdr) {
      await supabaseRest(`documents?id=eq.${doc.id}`, { method: "DELETE" });
    }

    await supabaseUserRest(auth.user.accessToken, `necesidades?id=eq.${id}`, { method: "DELETE" });
    await writeAuditLog({
      action: "necesidad.delete",
      details: {
        adjuntos: adjuntos.length,
        eettTdr: eettTdr.length,
        // Si el almacén falló queda constancia: la necesidad SÍ se borró, y el
        // fichero huérfano se puede limpiar después sabiendo cuál es.
        ...(fallos.length > 0 ? { ficherosNoBorrados: fallos } : {}),
      },
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
