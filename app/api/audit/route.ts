import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuditRow = {
  id: string;
  actor_reference: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const entityType = url.searchParams.get("entityType");
    const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 300);

    let query = `audit_logs?select=id,actor_reference,action,entity_type,entity_id,details,created_at&order=created_at.desc&limit=${limit}`;
    if (action) {
      query += `&action=eq.${encodeURIComponent(action)}`;
    }
    if (entityType) {
      query += `&entity_type=eq.${encodeURIComponent(entityType)}`;
    }

    const [logs, distinctActions] = await Promise.all([
      supabaseRest<AuditRow[]>(query),
      // Acciones distintas para el filtro: agregadas en la BD (devuelve un arreglo
      // pequeno). Fallback acotado a filas recientes si la RPC aun no esta aplicada.
      supabaseRest<string[]>("rpc/distinct_audit_actions", { body: "{}", method: "POST" }).catch(
        async () => {
          const rows = await supabaseRest<Array<{ action: string }>>(
            "audit_logs?select=action&order=created_at.desc&limit=1000",
          );
          return Array.from(new Set(rows.map((row) => row.action))).sort();
        },
      ),
    ]);

    return NextResponse.json({ actions: distinctActions, logs });
  } catch (error) {
    return NextResponse.json(
      { actions: [], error: error instanceof Error ? error.message : "No se pudo cargar la auditoria", logs: [] },
      { status: 500 },
    );
  }
}
