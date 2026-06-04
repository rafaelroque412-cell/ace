import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DocErrorRow = {
  id: string;
  title: string;
  error_message: string | null;
  updated_at: string;
};

type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  details: Record<string, unknown>;
  created_at: string;
};

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const [metrics, recentErrors, recentActivity] = await Promise.all([
      // Conteos agregados via funcion SQL (escala sin traer filas). Se llama con el
      // JWT del admin para que el guard is_admin() interno (auth.uid()) pase.
      supabaseUserRest<unknown>(auth.user.accessToken, "rpc/admin_metrics", { body: "{}", method: "POST" }),
      supabaseRest<DocErrorRow[]>(
        "documents?status=eq.error&select=id,title,error_message,updated_at&order=updated_at.desc&limit=8",
      ),
      supabaseRest<AuditRow[]>(
        "audit_logs?select=id,action,entity_type,details,created_at&order=created_at.desc&limit=12",
      ),
    ]);

    return NextResponse.json({ metrics, recentActivity, recentErrors });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las metricas" },
      { status: 500 },
    );
  }
}
