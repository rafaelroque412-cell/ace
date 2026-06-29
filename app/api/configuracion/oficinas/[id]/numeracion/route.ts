import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  getSupabaseServerConfig,
  supabaseRest,
  writeAuditLog,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const TIPOS = ["OFICIO", "INFORME", "CARTA", "MEMORANDUM"] as const;
type Tipo = (typeof TIPOS)[number];

// Esquema de un counter individual
const CounterSchema = z.object({
  tipo: z.enum(TIPOS),
  siguiente: z.coerce.number().int().min(1).max(999999),
});

// Esquema del body: { counters: [{ tipo, siguiente }, ...] }
const BodySchema = z.object({
  counters: z.array(CounterSchema).min(1).max(20),
});

type CounterRow = { oficina_id: string; tipo: Tipo; siguiente: number };

// GET /api/configuracion/oficinas/[id]/numeracion
// Devuelve los contadores de la oficina (crea defaults si no existen).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    getSupabaseServerConfig();
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Falta el id" }, { status: 400 });
    }
    const rows = await supabaseRest<CounterRow[]>(
      `expedientes_doc_counters?oficina_id=eq.${id}&select=oficina_id,tipo,siguiente`,
    ).catch(() => []);

    // Si la oficina es nueva y no tiene contadores, los creamos con siguiente=1.
    if (rows.length === 0) {
      const seed = TIPOS.map((tipo) => ({
        oficina_id: id,
        tipo,
        siguiente: 1,
      }));
      await supabaseRest("expedientes_doc_counters", {
        body: JSON.stringify(seed),
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        method: "POST",
      }).catch(() => undefined);
      return NextResponse.json({ counters: seed });
    }
    return NextResponse.json({ counters: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo obtener la numeración" },
      { status: 500 },
    );
  }
}

// PUT /api/configuracion/oficinas/[id]/numeracion
// Body: { counters: [{ tipo, siguiente }, ...] }
// Reemplaza (upsert) los contadores de la oficina. NO toca la oficina misma.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    getSupabaseServerConfig();
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Falta el id" }, { status: 400 });
    }
    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const rows: CounterRow[] = parsed.data.counters.map((c) => ({
      oficina_id: id,
      tipo: c.tipo,
      siguiente: c.siguiente,
    }));
    await supabaseRest("expedientes_doc_counters", {
      body: JSON.stringify(rows),
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      method: "POST",
    });

    await writeAuditLog({
      action: "oficinas.numeracion.update",
      actorReference: auth.user.email ?? auth.user.id,
      details: { id, counters: rows.map((r) => `${r.tipo}=${r.siguiente}`) },
      entityId: id,
      entityType: "oficina",
      module: "configuracion",
    });

    return NextResponse.json({ ok: true, counters: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la numeración" },
      { status: 500 },
    );
  }
}
