import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { resolverBases } from "@/lib/bases-elaboracion";
import { generarBasesDocx } from "@/lib/bases-docx";
import { resolverPlantillaAmbigua } from "@/lib/bases-plantillas";
import type { HitosMap } from "@/lib/procurement-fases";
import { slugify } from "@/lib/slugify";
import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIN_PLANTILLA = "Todavía no hay plantilla de bases para este tipo de procedimiento.";

// GET /api/processes/{id}/fase1/bases-docx?variante=<...> → elabora las
// Bases del procedimiento de selección (A9) en Word, a partir de la
// plantilla OECE del tipo de procedimiento del expediente
// (lib/bases-plantillas.ts) y de los datos ya registrados en A1-A9
// (lib/bases-elaboracion.ts).
//
// Un puñado de procedimientos de catálogo resuelven a MÁS DE UN PDF oficial
// (ver VARIANTES_AMBIGUAS en lib/bases-plantillas.ts); `resolverPlantillaAmbigua`
// decide: 404 si no hay ninguna plantilla, 409 con la lista de variantes si
// hace falta elegir una explícitamente (`?variante=`), o la plantilla
// directa en cualquier otro caso — incluida la variante única de hoy, que
// se resuelve sola sin pedir nada.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  const variante = new URL(request.url).searchParams.get("variante");

  try {
    const [proceso] = await supabaseUserRest<
      Array<{ nomenclature: string; procedure_type: string | null; hitos: HitosMap | null }>
    >(auth.user.accessToken, `procurement_processes?id=eq.${id}&select=nomenclature,procedure_type,hitos`);
    if (!proceso) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

    const resolucion = proceso.procedure_type
      ? resolverPlantillaAmbigua(proceso.procedure_type, variante)
      : ({ ok: false, motivo: "sin_plantilla" } as const);

    if (!resolucion.ok) {
      if (resolucion.motivo === "sin_plantilla") {
        return NextResponse.json({ error: SIN_PLANTILLA }, { status: 404 });
      }
      // "ambiguo" (falta elegir) y "variante_invalida" (se eligió mal) se
      // responden igual: 409, con las opciones válidas para que la UI arme
      // el selector — no es un error del cliente en el sentido de un 400,
      // es un procedimiento que legítimamente necesita una decisión.
      return NextResponse.json(
        {
          error:
            resolucion.motivo === "variante_invalida"
              ? "Esa variante no corresponde a este tipo de procedimiento."
              : "Este tipo de procedimiento agrupa más de una plantilla de bases oficial. Elige cuál corresponde.",
          variantes: resolucion.variantes,
        },
        { status: 409 },
      );
    }
    const plantilla = resolucion.plantilla;

    // entity_settings está cerrada por RLS al usuario normal: se lee con
    // service-role, igual que ya hace lib/evaluadores-docx-datos.ts.
    const [entidad] = await supabaseRest<Array<{ name: string | null; ruc: string | null }>>(
      "entity_settings?id=eq.default&select=name,ruc&limit=1",
    ).catch(() => []);

    const valores = resolverBases(plantilla.proceso, proceso.hitos ?? {}, {
      nombre: entidad?.name ?? "",
      ruc: entidad?.ruc ?? "",
    });
    if (!valores) {
      // No debería ocurrir: `resolverPlantillaAmbigua` ya devolvió `ok: true`
      // con esta misma `plantilla.proceso` arriba. Defensivo, no silencioso.
      return NextResponse.json({ error: SIN_PLANTILLA }, { status: 404 });
    }

    const buffer = await generarBasesDocx(plantilla.proceso, valores, plantilla.seccionGeneral);
    const filename = `Bases-${slugify(proceso.nomenclature || "expediente")}.docx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron elaborar las bases" },
      { status: 500 },
    );
  }
}
