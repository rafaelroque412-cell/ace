import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { formatDocumentNumber } from "@/lib/document-number";
import { supabaseRest } from "@/lib/supabase-server";
import { getYearFromRequest } from "@/lib/year-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OficinaMin = { id: string; nombre: string; ancho: number | null };
type CounterMin = { siguiente: number; sufijo: string | null; year: number };

// GET /api/numeracion/sugerido?tipo=INFORME&year=2026
//
// Número que le TOCARÍA al siguiente documento de ese tipo emitido por la
// oficina que gestiona contrataciones (la DEC): correlativo "Empieza en" +
// "Sigla propia" del tipo, tal como se configuran en Configuración → Numeración
// (p. ej. "INFORME N° 001-2026-JRM-UA-OGA/MDCH", conservando los guiones).
//
// Es una SUGERENCIA, no una asignación: NO consume el correlativo. Reservarlo
// aquí gastaría un número en cada vista previa y dejaría huecos en la serie, que
// es justo lo que una numeración correlativa no puede permitirse. El número se
// escribe en el paso y se confirma al emitir el documento.
//
// Solo pide sesión —no admin— porque quien redacta el informe de segmentación
// es la DEC, no el administrador del sistema, y lo único que devuelve es la
// cadena ya formateada.
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const tipo = (new URL(request.url).searchParams.get("tipo") ?? "INFORME").toUpperCase();
  // El ejercicio lo manda quien pregunta (el selector de año), no el reloj del
  // servidor: en diciembre se planifica el año siguiente, y el número que se
  // propone tiene que ser el de la serie sobre la que se está trabajando.
  const year = getYearFromRequest(request);

  try {
    const oficinas = await supabaseRest<OficinaMin[]>(
      "expedientes_oficinas?select=id,nombre,ancho&gestiona_contrataciones=is.true&activo=eq.true&limit=1",
    ).catch(() => []);
    const oficina = oficinas[0];
    if (!oficina) return NextResponse.json({ numero: "", oficina: null });

    // Se traen los contadores de ese tipo de CUALQUIER ejercicio, no solo el
    // pedido, porque hay que distinguir dos situaciones que se parecen:
    //   * la oficina no emite este tipo  → no hay ninguna fila → sin número
    //   * el ejercicio aún no ha empezado → hay filas de otros años → serie a 1
    // Con el filtro puesto en la consulta, en enero ambas se veían igual y la
    // sugerencia desaparecía hasta que alguien tocase Configuración.
    const counters = await supabaseRest<CounterMin[]>(
      `expedientes_doc_counters?oficina_id=eq.${oficina.id}&tipo=eq.${encodeURIComponent(tipo)}` +
        `&select=siguiente,sufijo,year`,
    ).catch(() => []);
    if (counters.length === 0) return NextResponse.json({ numero: "", oficina: oficina.nombre });

    const delEjercicio = counters.find((c) => c.year === year);
    // Serie nueva: arranca en 1, y hereda el sufijo del tipo si ya lo tenía.
    const siguiente = delEjercicio?.siguiente ?? 1;
    const sufijo = delEjercicio?.sufijo ?? counters[0]?.sufijo ?? null;

    return NextResponse.json({
      numero: formatDocumentNumber({
        ancho: oficina.ancho ?? 3,
        siguiente,
        sufijo,
        tipo,
        year,
      }),
      oficina: oficina.nombre,
    });
  } catch {
    return NextResponse.json({ numero: "", oficina: null });
  }
}
