import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { resolverBases } from "@/lib/bases-elaboracion";
import { generarBasesDocx } from "@/lib/bases-docx";
import { plantillaDeProceso } from "@/lib/bases-plantillas";
import type { HitosMap } from "@/lib/procurement-fases";
import { slugify } from "@/lib/slugify";
import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/processes/{id}/fase1/bases-docx → elabora las Bases del
// procedimiento de selección (A9) en Word, a partir de la plantilla OECE del
// tipo de procedimiento del expediente (lib/bases-plantillas.ts) y de los
// datos ya registrados en A1-A9 (lib/bases-elaboracion.ts). 404 si el
// procedimiento todavía no tiene plantilla cargada.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const [proceso] = await supabaseUserRest<
      Array<{ nomenclature: string; procedure_type: string | null; hitos: HitosMap | null }>
    >(auth.user.accessToken, `procurement_processes?id=eq.${id}&select=nomenclature,procedure_type,hitos`);
    if (!proceso) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

    const plantilla = proceso.procedure_type ? plantillaDeProceso(proceso.procedure_type) : undefined;
    if (!plantilla) {
      return NextResponse.json(
        { error: "Todavía no hay plantilla de bases para este tipo de procedimiento." },
        { status: 404 },
      );
    }

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
      // No debería ocurrir: ya se confirmó `plantilla` arriba con el mismo
      // `proceso.procedure_type`. Defensivo, no silencioso.
      return NextResponse.json(
        { error: "Todavía no hay plantilla de bases para este tipo de procedimiento." },
        { status: 404 },
      );
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
