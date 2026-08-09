import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  pac_anio: number | null;
  pac_monto_bienes_servicios: number | string | null;
  uit_anio: number | null;
  uit_valor: number | string | null;
  lp_abreviada_bienes_min: number | string | null;
  lp_abreviada_bienes_max: number | string | null;
  lp_abreviada_bienes_anio: number | null;
};

/** Número o `null`; nunca `NaN` ni un 0 que se confunda con "sin registrar". */
function aNumero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

// GET /api/configuracion/parametros-segmentacion
// Expone los dos parámetros institucionales que el resto de la aplicación
// necesita para razonar sobre cuantías:
//
//   * PAC de bienes y servicios → línea de corte de A2 (10%, Art. 125).
//   * UIT del ejercicio → tope del contrato menor (Ley 32069, Art. 34.1), del
//     que depende si un requerimiento puede ir por ítems (Art. 52.1.b).
//
// Se lee con service-role a propósito: entity_settings solo es visible para
// admins por RLS, pero quien segmenta es la DEC/logística. Solo se devuelve el
// monto del PAC y el ejercicio —información que ya es pública (el PAC se
// publica en el SEACE) y que se imprime en el informe que estos mismos
// usuarios exportan—, no el resto de la configuración institucional.
const SELECT_BASE = "pac_anio,pac_monto_bienes_servicios,uit_anio,uit_valor";
const SELECT_LP = "lp_abreviada_bienes_min,lp_abreviada_bienes_max,lp_abreviada_bienes_anio";

function leer(select: string) {
  return supabaseRest<Row[]>(`entity_settings?id=eq.default&select=${select}&limit=1`);
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let rows: Row[];
  try {
    rows = await leer(`${SELECT_BASE},${SELECT_LP}`);
  } catch {
    // Fallback acotado: si las columnas de la LP abreviada aún no se han creado
    // (SQL pendiente), se leen solo los parámetros de siempre para no dejar sin
    // UIT/PAC a la segmentación. El resto queda en `null` (no configurado).
    rows = await leer(SELECT_BASE).catch((err) => {
      console.error("[parametros-segmentacion] no se pudieron leer:", err);
      return [] as Row[];
    });
  }

  const row = rows[0];

  return NextResponse.json({
    pacAnio: row?.pac_anio ?? null,
    pacMontoBienesServicios: aNumero(row?.pac_monto_bienes_servicios),
    // `null` cuando no está registrada, para que quien consuma pueda decir "no
    // se sabe" en vez de dar por incumplido el umbral del contrato menor.
    uitAnio: row?.uit_anio ?? null,
    uitValor: aNumero(row?.uit_valor),
    // Rango de la LP abreviada para bienes (Configuración anual). `null` si no
    // está registrado: quien consume decide "no se sabe" en vez de filtrar mal.
    lpAbreviadaBienesMin: aNumero(row?.lp_abreviada_bienes_min),
    lpAbreviadaBienesMax: aNumero(row?.lp_abreviada_bienes_max),
    lpAbreviadaBienesAnio: row?.lp_abreviada_bienes_anio ?? null,
  });
}
