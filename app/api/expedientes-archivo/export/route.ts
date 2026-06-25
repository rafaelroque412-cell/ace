import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { type ExpedienteArchivo } from "@/lib/expedientes-archivo";
import { getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT =
  "id,sgd_expediente,serie_documento,anio,tipo_documento,title,asunto,materia,resumen,oficina,tipo_almacenamiento,nro_archivador,nro_paquete,empastado,color_archivador,nro_estante,nro_piso,nro_local,folio,observaciones,persona_tipo,persona_documento,persona_nombre,file_name,file_size,status,error_message,created_at,updated_at";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

// GET /api/expedientes-archivo/export
//   - formato=csv (default) | json
//   - Acepta los mismos query params que la lista (status, anio, q, oficina, estante)
// Devuelve el inventario completo en CSV (o JSON) para descarga/importación.
export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const anio = url.searchParams.get("anio");
    const oficina = url.searchParams.get("oficina");
    const estante = url.searchParams.get("estante");
    const formato = url.searchParams.get("formato") ?? "csv";

    let query = `expedientes_archivo?select=${SELECT}&order=created_at.desc&limit=1000`;
    if (status) query += `&status=eq.${encodeURIComponent(status)}`;
    if (anio) query += `&anio=eq.${encodeURIComponent(anio)}`;
    if (oficina) query += `&oficina=eq.${encodeURIComponent(oficina)}`;
    if (estante) query += `&nro_estante=eq.${encodeURIComponent(estante)}`;

    const rows = await supabaseRest<ExpedienteArchivo[]>(query);

    if (formato === "json") {
      return NextResponse.json({ count: rows.length, rows });
    }

    const headers = SELECT.split(",");
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((h) => csvEscape((row as Record<string, unknown>)[h])).join(","),
      ),
    ].join("\n");

    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="expedientes-${date}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo exportar" },
      { status: 500 },
    );
  }
}
