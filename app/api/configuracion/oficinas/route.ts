import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseServerConfig, supabaseRest, writeAuditLog } from "@/lib/supabase-server";

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
  activo: boolean;
};
type CounterRow = { oficina_id: string; tipo: Tipo; siguiente: number };

const OFI_SELECT =
  "id,nombre,entidad,ruc,responsable_nombre,responsable_cargo,sufijo,ancho,membrete_path,activo";

function text(value: unknown, max = 200): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}
function int(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
}

function fmt(tipo: string, siguiente: number, ancho: number, sufijo: string | null): string {
  const year = new Date().getFullYear();
  const num = String(siguiente).padStart(ancho, "0");
  const parts = [num, String(year)];
  if (sufijo) {
    // El sufijo puede traer varios segmentos separados por "/" o "-"
    // ej: "MDCH/GM" -> se concatenan con guion en el preview
    const segs = sufijo.split(/[\/\-]/).map((s) => s.trim()).filter(Boolean);
    parts.push(...segs);
  }
  return `${tipo} N° ${parts.join("-")}`;
}

async function listOficinas() {
  const [oficinas, counters] = await Promise.all([
    supabaseRest<OficinaRow[]>(`expedientes_oficinas?select=${OFI_SELECT}&order=created_at.asc`).catch(() => []),
    supabaseRest<CounterRow[]>(`expedientes_doc_counters?select=oficina_id,tipo,siguiente`).catch(() => []),
  ]);
  return oficinas.map((o) => ({
    ...o,
    membrete: Boolean(o.membrete_path),
    counters: TIPOS.map((tipo) => {
      const c = counters.find((x) => x.oficina_id === o.id && x.tipo === tipo);
      const siguiente = c?.siguiente ?? 1;
      return { tipo, siguiente, preview: fmt(tipo, siguiente, o.ancho, o.sufijo) };
    }),
  }));
}

async function seedCounters(oficinaId: string) {
  await supabaseRest("expedientes_doc_counters", {
    body: JSON.stringify(TIPOS.map((tipo) => ({ oficina_id: oficinaId, tipo, siguiente: 1 }))),
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    method: "POST",
  }).catch(() => undefined);
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    getSupabaseServerConfig();
    return NextResponse.json({ oficinas: await listOficinas() });
  } catch (error) {
    return NextResponse.json({ oficinas: [], error: error instanceof Error ? error.message : "Error" }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const body = await request.json();
    if (!text(body.nombre)) {
      return NextResponse.json({ error: "El nombre de la oficina es obligatorio" }, { status: 400 });
    }
    const [created] = await supabaseRest<Array<{ id: string }>>("expedientes_oficinas?select=id", {
      body: JSON.stringify({
        nombre: text(body.nombre),
        entidad: text(body.entidad),
        ruc: text(body.ruc, 20),
        responsable_nombre: text(body.responsable_nombre),
        responsable_cargo: text(body.responsable_cargo),
        sufijo: text(body.sufijo, 60),
        ancho: int(body.ancho, 1, 6, 3),
        activo: body.activo !== false,
        created_by: auth.user.id,
      }),
      method: "POST",
    });
    if (created?.id) await seedCounters(created.id);

    await writeAuditLog({
      action: "oficinas.create",
      actorReference: auth.user.email ?? auth.user.id,
      details: { nombre: text(body.nombre) },
      entityId: created?.id,
      entityType: "oficina",
      module: "configuracion",
    });
    return NextResponse.json({ oficinas: await listOficinas(), id: created?.id ?? null }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la oficina" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const body = await request.json();
    const id = text(body.id, 60);
    if (!id) return NextResponse.json({ error: "Falta el id de la oficina" }, { status: 400 });

    await supabaseRest(`expedientes_oficinas?id=eq.${id}`, {
      body: JSON.stringify({
        nombre: text(body.nombre) ?? "Oficina",
        entidad: text(body.entidad),
        ruc: text(body.ruc, 20),
        responsable_nombre: text(body.responsable_nombre),
        responsable_cargo: text(body.responsable_cargo),
        sufijo: text(body.sufijo, 60),
        ancho: int(body.ancho, 1, 6, 3),
        activo: body.activo !== false,
        updated_at: new Date().toISOString(),
      }),
      method: "PATCH",
    });

    // Numeración: upsert de los contadores por tipo (nº inicial editable).
    if (Array.isArray(body.counters)) {
      const rows = body.counters
        .filter((c: { tipo?: string }) => TIPOS.includes(c.tipo as Tipo))
        .map((c: { tipo: string; siguiente?: unknown }) => ({
          oficina_id: id,
          tipo: c.tipo,
          siguiente: int(c.siguiente, 1, 999999, 1),
          updated_at: new Date().toISOString(),
        }));
      if (rows.length > 0) {
        await supabaseRest("expedientes_doc_counters", {
          body: JSON.stringify(rows),
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          method: "POST",
        });
      }
    }

    await writeAuditLog({
      action: "oficinas.update",
      actorReference: auth.user.email ?? auth.user.id,
      details: { id, nombre: text(body.nombre) },
      entityId: id,
      entityType: "oficina",
      module: "configuracion",
    });
    return NextResponse.json({ oficinas: await listOficinas() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la oficina" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
    await supabaseRest(`expedientes_oficinas?id=eq.${id}`, { method: "DELETE" });
    await writeAuditLog({
      action: "oficinas.delete",
      actorReference: auth.user.email ?? auth.user.id,
      details: { id },
      entityId: id,
      entityType: "oficina",
      module: "configuracion",
    });
    return NextResponse.json({ oficinas: await listOficinas() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar" }, { status: 500 });
  }
}
