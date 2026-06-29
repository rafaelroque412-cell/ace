import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIPOS = ["OFICIO", "INFORME", "CARTA", "MEMORANDUM"] as const;

type OficinaRow = {
  id: string;
  nombre: string;
  entidad: string | null;
  ruc: string | null;
  responsable_nombre: string | null;
  responsable_cargo: string | null;
  sufijo: string | null;
  ancho: number;
  membrete_path: string | null;
};
type CounterRow = { oficina_id: string; tipo: string; siguiente: number };

// Lista las oficinas activas (para que el usuario elija desde cuál emite la
// respuesta) con el preview del siguiente nº por tipo. NO expone rutas de Storage.
export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    getSupabaseServerConfig();

    const [oficinas, counters] = await Promise.all([
      supabaseRest<OficinaRow[]>(
        `expedientes_oficinas?activo=eq.true&select=id,nombre,entidad,ruc,responsable_nombre,responsable_cargo,sufijo,ancho,membrete_path&order=nombre.asc`,
      ).catch(() => []),
      supabaseRest<CounterRow[]>(`expedientes_doc_counters?select=oficina_id,tipo,siguiente`).catch(() => []),
    ]);

    return NextResponse.json({
      oficinas: oficinas.map((o) => ({
        id: o.id,
        nombre: o.nombre,
        entidad: o.entidad,
        ruc: o.ruc,
        responsableNombre: o.responsable_nombre,
        responsableCargo: o.responsable_cargo,
        tieneMembrete: Boolean(o.membrete_path),
        previews: Object.fromEntries(
          TIPOS.map((tipo) => {
            const c = counters.find((x) => x.oficina_id === o.id && x.tipo === tipo);
            const siguiente = c?.siguiente ?? 1;
            return [tipo, `${tipo} N° ${String(siguiente).padStart(o.ancho, "0")}${o.sufijo ? `-${o.sufijo}` : ""}`];
          }),
        ) as Record<(typeof TIPOS)[number], string>,
      })),
    });
  } catch (error) {
    return NextResponse.json({ oficinas: [], error: error instanceof Error ? error.message : "Error" }, { status: 200 });
  }
}
