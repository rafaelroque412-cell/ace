import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { type ExpedienteArchivo } from "@/lib/expedientes-archivo";
import { getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT =
  "id,title,sgd_expediente,serie_documento,anio,asunto,materia,oficina,status,file_name,created_at";

// Detecta posibles duplicados del archivo. Busca por:
//   - titulo exacto (case-insensitive, normalizado)
//   - sgd_expediente
//   - serie_documento
// Devuelve el listado de expedientes con la misma clave (sin incluir el opcional
// `excludeId` para que la UI pueda pedir "dame los duplicados de ESTE id" cuando
// está editando).
export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();

    const url = new URL(request.url);
    const title = url.searchParams.get("title")?.trim();
    const sgd = url.searchParams.get("sgd")?.trim();
    const serie = url.searchParams.get("serie")?.trim();
    const excludeId = url.searchParams.get("excludeId")?.trim();

    if (!title && !sgd && !serie) {
      return NextResponse.json({ error: "Falta al menos un criterio (title, sgd, serie)" }, { status: 400 });
    }

    const filters: string[] = [];
    if (title) {
      const safe = title.replace(/[%_]/g, (m) => `\\${m}`);
      filters.push(`title=ilike.${encodeURIComponent(safe)}`);
    }
    if (sgd) filters.push(`sgd_expediente=eq.${encodeURIComponent(sgd)}`);
    if (serie) filters.push(`serie_documento=eq.${encodeURIComponent(serie)}`);

    let query = `expedientes_archivo?select=${SELECT}&status=eq.indexed&order=created_at.desc&limit=10`;
    if (filters.length > 0) query += `&or=(${filters.join(",")})`;
    if (excludeId) query += `&id=neq.${excludeId}`;

    const duplicates = await supabaseRest<ExpedienteArchivo[]>(query);

    // Si no hay nada con numero/sgd/serie, igual devolver los que tengan título similar
    if (duplicates.length === 0 && title) {
      const prefix = title.slice(0, 12).replace(/[%_]/g, (m) => `\\${m}`);
      const fuzzy = `expedientes_archivo?select=${SELECT}&status=eq.indexed&title=ilike.${encodeURIComponent(prefix + "%")}&order=created_at.desc&limit=5${excludeId ? `&id=neq.${excludeId}` : ""}`;
      const fuzzy2 = await supabaseRest<ExpedienteArchivo[]>(fuzzy);
      return NextResponse.json({ duplicates: fuzzy2, matchType: "fuzzy" });
    }

    return NextResponse.json({ duplicates, matchType: duplicates.length > 0 ? "exact" : "none" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo detectar duplicados" },
      { status: 500 },
    );
  }
}
