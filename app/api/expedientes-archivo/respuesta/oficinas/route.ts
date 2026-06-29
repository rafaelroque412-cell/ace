import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIPOS = ["OFICIO", "INFORME", "CARTA", "MEMORANDUM"] as const;
type Tipo = (typeof TIPOS)[number];

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

// Construye el preview de un correlativo con el formato nuevo:
//   {TIPO} N° {nro}-{año}-{sufijo-segmentos}
function buildPreview(tipo: string, siguiente: number, ancho: number, sufijo: string | null): string {
  const year = new Date().getFullYear();
  const num = String(siguiente).padStart(ancho, "0");
  const parts: string[] = [num, String(year)];
  if (sufijo) {
    const segs = sufijo
      .split(/[\/\-]/)
      .map((s) => s.trim())
      .filter(Boolean);
    parts.push(...segs);
  }
  return `${tipo} N° ${parts.join("-")}`;
}

// Normaliza texto para comparacion robusta de nombres de entidad.
// Quita tildes, pasa a minusculas y colapsa espacios.
function normalizeEntity(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function officesMatch(oficina: OficinaRow, userEntity: string): boolean {
  if (!userEntity) return false;
  return normalizeEntity(oficina.entidad) === normalizeEntity(userEntity);
}

// GET /api/expedientes-archivo/respuesta/oficinas
// Lista oficinas activas con preview del siguiente correlativo por tipo.
// El listado se filtra segun el rol del usuario:
//   - admin: ve TODAS las oficinas activas
//   - otros (dec/consulta/legal): solo las oficinas de SU entidad
// Devuelve ademas `defaultOficinaId` para que el cliente pre-seleccione
// la oficina del usuario sin que tenga que elegir manualmente.
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

    // Filtro por rol: admin ve todas, demas usuarios solo su entidad.
    const userEntity = auth.user.entity ?? null;
    const isAdmin = Boolean(auth.user.isAdmin);
    const filtered = isAdmin
      ? oficinas
      : oficinas.filter((o) => officesMatch(o, userEntity ?? ""));

    // Default: la primera oficina que coincide con la entidad del usuario;
    // si no hay coincidencia, la primera de la lista filtrada.
    const defaultOficinaId =
      filtered.find((o) => officesMatch(o, userEntity ?? ""))?.id ??
      filtered[0]?.id ??
      null;

    return NextResponse.json({
      defaultOficinaId,
      isAdmin,
      oficinas: filtered.map((o) => ({
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
            return [tipo, buildPreview(tipo, siguiente, o.ancho, o.sufijo)];
          }),
        ) as Record<Tipo, string>,
      })),
      totalActivas: oficinas.length,
      userEntity,
    });
  } catch (error) {
    return NextResponse.json(
      {
        defaultOficinaId: null,
        isAdmin: false,
        oficinas: [],
        totalActivas: 0,
        userEntity: null,
        error: error instanceof Error ? error.message : "Error",
      },
      { status: 200 },
    );
  }
}
